"use strict";

const fs = require("fs");
const path = require("path");
const core = require("@actions/core");
const github = require("@actions/github");
const { execCommand } = require("./command.js");
const { addComment, deleteComment } = require("./github.js");
const { getPlanChanges } = require("./opa.js");

// Sanitize input to prevent command injection
function sanitizeInput(input, options = {}) {
  const { allowEmpty = true, allowedChars = /[^a-zA-Z0-9\-_/.+=:'"@]/g } =
    options;

  // Check if the input is empty
  if (!input) {
    return allowEmpty ? "" : null;
  }

  return input.replace(allowedChars, "");
}

function parseInputInt(str, def) {
  const parsed = parseInt(str, 10);
  if (isNaN(parsed)) {
    return def;
  }
  return parsed;
}

/**
 * Scans a Terraform plan with trufflehog for secrets
 * @param {string} planOutput The Terraform plan output to scan
 * @param {string} configPath Path to the TruffleHog config file
 * @returns {Array} Array of detected secrets
 */
function scanPlanForSecrets(planOutput, configPath) {
  try {
    const tempPlanFile = path.join(__dirname, "plan.tf");
    fs.writeFileSync(tempPlanFile, planOutput);
    const scanCommand = {
      key: "secret-scan",
      exec: `trufflehog filesystem plan.tf --no-verification --config=${configPath} --json --no-update`,
      output: false,
    };
    const result = execCommand(scanCommand, __dirname);
    fs.unlinkSync(tempPlanFile);

    if (!result.isSuccess) {
      core.warning(
        "Trufflehog scan failed, continuing without secret redaction",
      );
      return [];
    }

    // Parse JSON output - each line is a separate JSON object
    const secrets = [];
    const lines = result.output
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    for (const line of lines) {
      try {
        const secretData = JSON.parse(line);
        if (secretData.Raw) {
          secrets.push(secretData.Raw);
        }
      } catch (parseError) {
        core.warning(`Failed to parse trufflehog output line: ${line}`);
      }
    }

    return secrets;
  } catch (error) {
    core.warning(`Error during trufflehog scan: ${error.message}`);
    return [];
  }
}

/**
 * Redacts detected secrets from plan output by replacing them with ***
 * @param {string} planOutput The original plan output
 * @param {Array} secrets Array of secret values to redact
 * @returns {string} Plan output with secrets redacted
 */
function redactSecretsFromPlan(planOutput, secrets) {
  if (!secrets || secrets.length === 0) {
    return planOutput;
  }

  let redactedPlan = planOutput;
  for (const secret of secrets) {
    redactedPlan = redactedPlan.split(secret).join("***");
  }
  return redactedPlan;
}

/**
 * Runs the action
 */
const action = async () => {
  const isAllowFailure = core.getBooleanInput("allow-failure");
  const isComment = core.getBooleanInput("comment");
  const isCommentDelete = core.getBooleanInput("comment-delete");
  const isTerragrunt = core.getBooleanInput("terragrunt");
  const isOpenTofu = core.getBooleanInput("open-tofu");
  const skipFormat = core.getBooleanInput("skip-fmt");
  const skipPlan = core.getBooleanInput("skip-plan");
  const skipConftest = core.getBooleanInput("skip-conftest");
  const initRunAll = core.getBooleanInput("init-run-all");
  const isSecretScan = core.getBooleanInput("secret-scan");
  const secretConfig = core.getInput("secret-config") || "secrets.yml";

  const commentTitle = core.getInput("comment-title");
  const directory = core.getInput("directory");
  const terraformInit = core.getMultilineInput("terraform-init");
  const terraformPlan = core.getMultilineInput("terraform-plan");
  const conftestChecks = sanitizeInput(core.getInput("conftest-checks"));
  const token = core.getInput("github-token");
  const octokit = token !== "false" ? github.getOctokit(token) : undefined;

  const planCharLimit = core.getInput("plan-character-limit");
  const conftestCharLimit = core.getInput("conftest-character-limit");

  // Determine binary: support all combinations
  let binary = "terraform";
  if (isTerragrunt) {
    binary = "terragrunt"; // terragrunt will call tofu if configured
  } else if (isOpenTofu) {
    binary = "tofu";
  }
  const summarizeBinary = "tf-summarize";

  const terraformInitOption = terraformInit
    ? terraformInit.map((item) => sanitizeInput(item)).join(" ")
    : "";
  const terraformPlanOption = terraformPlan
    ? terraformPlan.map((item) => sanitizeInput(item)).join(" ")
    : "";

  const commands = [
    {
      key: "init",
      exec: `${binary}${
        isTerragrunt && initRunAll ? " run-all" : ""
      } init -no-color ${terraformInitOption}`.trim(),
    },
    {
      key: "validate",
      exec: `${binary} validate -no-color`,
    },
    {
      key: "fmt",
      exec: `${binary} fmt --check`,
    },
    {
      key: "plan",
      exec: `${binary} plan -no-color -input=false -out=plan.tfplan ${terraformPlanOption}`.trim(),
    },
    {
      key: "show",
      exec: `${binary} show -no-color -json plan.tfplan`,
      depends: "plan",
      output: false,
    },
    {
      key: "show-json-out",
      exec: `${binary} show -no-color -json plan.tfplan > plan.json`,
      depends: "plan",
      output: false,
    },
    {
      key: "summary",
      exec: `cat plan.json | ${summarizeBinary} -md`,
      depends: "show-json-out",
    },
    {
      key: "conftest",
      depends: "show-json-out",
      exec: `conftest test plan.json --no-color --update ${conftestChecks}`,
      output: true,
    },
  ];
  let results = {};
  let isError = false;

  // if not terragrunt and init-run-all is true, then notify the user that this command is only valid for terragrunt
  if (!isTerragrunt && initRunAll) {
    core.error(
      "init-run-all is only valid when using terragrunt, skipping this option",
    );
  }

  // Validate that directory exists
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(directory)) {
    core.setFailed(`Directory ${directory} does not exist`);
    return;
  }

  // Validate input
  if (octokit === undefined && (isComment || isCommentDelete)) {
    core.setFailed("You must pass a GitHub token to comment on PRs");
    return;
  }

  // Exec commands
  for (let command of commands) {
    if (skipPlan) {
      switch (command.key) {
        case "plan":
        case "summary":
        case "show":
        case "show-json-out":
        case "conftest":
          results[command.key] = { isSuccess: true, output: "" };
          continue;
      }
    }

    if (skipFormat && command.key === "fmt") {
      results[command.key] = { isSuccess: true, output: "" };
      continue;
    }

    if (skipConftest && command.key === "conftest") {
      results[command.key] = { isSuccess: true, output: "" };
      continue;
    }

    if (!command.depends || results[command.depends].isSuccess) {
      results[command.key] = execCommand(command, directory);
    } else {
      results[command.key] = { isSuccess: false, output: "" };
    }
    isError = isError || !results[command.key].isSuccess;

    // Check for hashicorp/setup-terraform action's terraform_wrapper output
    if (results[command.key].output.indexOf("::debug::exitcode:") > -1) {
      core.setFailed(
        "Error: `hashicorp/setup-terraform` must have `terraform_wrapper: false`",
      );
      return;
    }
  }

  // Delete previous PR comments
  if (isCommentDelete) {
    await deleteComment(octokit, github.context, commentTitle);
  }

  // Check for changes
  let changes = {};
  if (results.show.isSuccess && !skipPlan) {
    const planJson = JSON.parse(results.show.output);
    changes = await getPlanChanges(planJson);
  }

  // Comment on PR if changes or errors
  if (isComment && (changes.isChanges || isError || skipPlan)) {
    const planLimit = parseInputInt(planCharLimit, 30000);
    const conftestLimit = parseInputInt(conftestCharLimit, 2000);

    // Scan for secrets and redact if secret scanning is enabled
    if (isSecretScan && !skipPlan && results.plan.output) {
      const detectedSecrets = scanPlanForSecrets(
        results.plan.output,
        secretConfig,
      );
      if (detectedSecrets.length > 0) {
        results.plan.output = redactSecretsFromPlan(
          results.plan.output,
          detectedSecrets,
        );
      }
    }

    await addComment(
      octokit,
      github.context,
      commentTitle,
      results,
      changes,
      planLimit,
      conftestLimit,
      skipFormat,
      skipPlan,
      skipConftest,
    );
  }

  if (isError && !isAllowFailure) {
    let failedCommands = commands
      .filter((c) => !results[c.key].isSuccess)
      .map((c) => c.exec);
    core.setFailed(
      `The following commands failed:\n${failedCommands.join("\n")}`,
    );
  }
};

module.exports = {
  action: action,
  sanitizeInput: sanitizeInput,
  scanPlanForSecrets: scanPlanForSecrets,
  redactSecretsFromPlan: redactSecretsFromPlan,
};
