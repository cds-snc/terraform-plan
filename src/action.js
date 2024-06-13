"use strict";

const fs = require("fs");
const core = require("@actions/core");
const github = require("@actions/github");
const { execCommand } = require("./command.js");
const { addComment, deleteComment } = require("./github.js");
const { getPlanChanges } = require("./opa.js");

function parseInputInt(str, def) {
  const parsed = parseInt(str, 10);
  if (isNaN(parsed)) {
    return def;
  }
  return parsed;
}

/**
 * Runs the action
 */
const action = async () => {
  const isAllowFailure = core.getBooleanInput("allow-failure");
  const isComment = core.getBooleanInput("comment");
  const isCommentDelete = core.getBooleanInput("comment-delete");
  const isTerragrunt = core.getBooleanInput("terragrunt");
  const skipFormat = core.getBooleanInput("skip-fmt");
  const skipPlan = core.getBooleanInput("skip-plan");
  const skipConftest = core.getBooleanInput("skip-conftest");

  const binary = isTerragrunt ? "terragrunt" : "terraform";
  const summarizeBinary = "tf-summarize";
  const commentTitle = core.getInput("comment-title");
  const directory = core.getInput("directory");
  const terraformInit = core.getMultilineInput("terraform-init");
  const conftestChecks = core.getInput("conftest-checks");
  const token = core.getInput("github-token");
  const args = core.getInput("args") || "";
  const octokit = token !== "false" ? github.getOctokit(token) : undefined;

  const planCharLimit = core.getInput("plan-character-limit");
  const conftestCharLimit = core.getInput("conftest-character-limit");

  const commands = [
    {
      key: "init",
      exec: `${binary} init -no-color ${
        terraformInit ? terraformInit.join(" ") : ""
      }`,
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
      exec: `${binary} plan -no-color -input=false -out=plan.tfplan ${args}`,
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
};
