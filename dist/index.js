require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 488:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const fs = __nccwpck_require__(147);
const core = __nccwpck_require__(159);
const github = __nccwpck_require__(211);
const { execCommand } = __nccwpck_require__(72);
const { addComment, deleteComment } = __nccwpck_require__(232);
const { getPlanChanges } = __nccwpck_require__(183);

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
  const args = core.getInput("args");
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


/***/ }),

/***/ 72:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

/* eslint security/detect-child-process: "off" */

const proc = __nccwpck_require__(81);

/**
 * Executes a command in a given directory
 * @param {Object} command The command to execute
 * @param {String} directory The directory to execute the command in
 * @returns {Object} Results object with the command output and if the command was successful
 */
const execCommand = (command, directory) => {
  let output,
    exitCode = 0;

  try {
    console.log("🧪 \x1b[36m%s\x1b[0m\n", command.exec);
    output = proc
      .execSync(command.exec, {
        cwd: directory,
        maxBuffer: 1024 * 10000,
      })
      .toString("utf8");
  } catch (error) {
    exitCode = error.status;
    output = "";
    output += error.stdout ? error.stdout.toString("utf8") : "";
    output += error.stderr ? error.stderr.toString("utf8") : "";
    console.log(`Command failed: exit code ${exitCode}`);
  }

  if (command.output !== false) {
    console.log(output);
  }

  return {
    isSuccess: exitCode === 0,
    output: output,
  };
};

module.exports = {
  execCommand: execCommand,
};


/***/ }),

/***/ 232:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const nunjucks = __nccwpck_require__(907);
const commentTemplate = `## {{ title }}
**{{ "✅" if results.init.isSuccess else "❌" }} &nbsp; Terraform Init:** \`{{ "success" if results.init.isSuccess else "failed" }}\`
**{{ "✅" if results.validate.isSuccess else "❌" }} &nbsp; Terraform Validate:** \`{{ "success" if results.validate.isSuccess else "failed" }}\`
{% if not skipFormat -%}
**{{ "✅" if results.fmt.isSuccess else "❌" }} &nbsp; Terraform Format:** \`{{ "success" if results.fmt.isSuccess else "failed" }}\`
{% endif -%}
{% if not skipPlan -%}
**{{ "✅" if results.plan.isSuccess else "❌" }} &nbsp; Terraform Plan:** \`{{ "success" if results.plan.isSuccess else "failed" }}\`
{% if not skipConftest -%}
**{{ "✅" if results.conftest.isSuccess else "❌" }} &nbsp; Conftest:** \`{{ "success" if results.conftest.isSuccess else "failed" }}\` 

{% endif -%}
{% endif -%}
{% if not results.init.isSuccess -%}

<details>
<summary>Show Init results</summary>

\`\`\`sh
{{ results.init.output }}
\`\`\`

</details>

{% endif -%}
{% if not results.validate.isSuccess -%}
<details>
<summary>Show Validate results</summary>

\`\`\`sh
{{ results.validate.output }}
\`\`\`

</details>

{% endif -%}
{% if not results.fmt.isSuccess and format|length -%}
**🧹 &nbsp; Format:** run \`terraform fmt\` to fix the following: 
\`\`\`sh
{{ format }}
\`\`\`
{% endif -%}

{% if not skipPlan -%}
{% if changes.isDeletes -%}
**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
{% endif -%}

{% if changes.isChanges -%}
\`\`\`terraform
Plan: {{ changesLine }}
\`\`\`

<details>
<summary>Show summary</summary>

{{ results.summary.output }}

</details>


{% endif -%}

{% if plan|length >= planLimit -%}
**✂ &nbsp; Warning:** plan has been truncated! See the [full plan in the logs]({{ runLink }}).
{% endif -%}
<details>
<summary>Show plan</summary>

\`\`\`terraform
{{ plan|safe|truncate(planLimit) }}
\`\`\`

</details>

{% if not skipConftest and results.conftest.output -%}
<details>
<summary>Show Conftest results</summary>

\`\`\`sh
{{ results.conftest.output|safe|truncate(conftestLimit) }}
\`\`\`

</details>
{% endif -%}
{% endif -%}`;

/**
 *
 * @param {*} resources
 * @returns
 */
const generateChangesLine = (changes) => {
  if (Object.keys(changes).length === 0) {
    return "";
  }
  const resources = changes.resources;
  if (resources.import === 0) {
    return `${resources.create} to add, ${resources.update} to change, ${resources.delete} to destroy`;
  } else {
    return `${resources.import} to import, ${resources.create} to add, ${resources.update} to change, ${resources.delete} to destroy`;
  }
};

/**
 * Adds a comment to the Pull Request with the Terraform plan changes
 * and result of the format/validate checks.
 * @param {Object} octokit GitHub API object
 * @param {Object} context GitHub context for the workflow run
 * @param {String} title Comment heading
 * @param {Object} results Results for all the Terraform commands
 * @param {Object} changes Resource and output changes for the plan
 * @param {number} planLimit the number of characters to render
 * @param {number} conftestPlanLimit the nubmer of characters to render
 * @param {boolean} skipFormat Skip runnting terraform fmt check
 * @param {boolean} skipPlan Skip the rendering of the plan output
 */
const addComment = async (
  octokit,
  context,
  title,
  results,
  changes,
  planLimit,
  conftestLimit,
  skipFormat,
  skipPlan,
  skipConftest,
) => {
  const format = cleanFormatOutput(results.fmt.output);
  const plan = skipPlan ? "" : removePlanRefresh(results.plan.output);
  const comment = nunjucks.renderString(commentTemplate, {
    changes: changes,
    changesLine: generateChangesLine(changes),
    plan: plan,
    format: format,
    results: results,
    title: title,
    planLimit: planLimit,
    conftestLimit: conftestLimit,
    skipFormat: skipFormat,
    skipPlan: skipPlan,
    skipConftest: skipConftest,
    runLink: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
  });
  await octokit.rest.issues.createComment({
    ...context.repo,
    issue_number: context.payload.pull_request.number,
    body: comment,
  });
};

/**
 * Deletes a comment made by the action on the PR.
 * @param {Object} octokit GitHub API object
 * @param {Object} context GitHub context for the workflow run
 * @param {String} title Heading of the comment to delete
 */
const deleteComment = async (octokit, context, title) => {
  // Get existing comments.
  const { data: comments } = await octokit.rest.issues.listComments({
    ...context.repo,
    issue_number: context.payload.pull_request.number,
  });

  // Find the bot's comment
  const comment = comments.find(
    (comment) =>
      comment.user.type === "Bot" && comment.body.indexOf(title) > -1,
  );
  if (comment) {
    console.log(`Deleting comment '${title}: ${comment.id}'`);
    await octokit.rest.issues.deleteComment({
      ...context.repo,
      comment_id: comment.id,
    });
  }
};

/**
 * Removes the Terraform refresh output from a plan.
 * @param {String} plan Terraform plan output
 * @returns {String} Terraform plan with the refresh output stripped
 */
const removePlanRefresh = (plan) => {
  const startTokens = [
    "No changes. Infrastructure is up-to-date",
    "Resource actions are indicated with the following symbols",
    "Changes to Outputs",
  ];

  // This will only strip the first refresh token it finds in the plan ouput
  for (let token of startTokens) {
    let index = plan.indexOf(token);
    if (index > -1) {
      plan = plan.substring(index);
      break;
    }
  }
  return plan;
};

/**
 * Remove all lines from a block text that doesn't end with *.tf.
 * This is used to remove errors from the terrform fmt output.
 * @param {String} format Output from the terraform fmt
 * @returns Terraform fmt output with only *.tf filenames.
 */
const cleanFormatOutput = (format) => {
  return format
    .split("\n")
    .filter((line) => line.match(/^.*\.tf$/))
    .join("\n");
};

module.exports = {
  addComment: addComment,
  cleanFormatOutput: cleanFormatOutput,
  deleteComment: deleteComment,
  removeRefreshOutput: removePlanRefresh,
  commentTemplate: commentTemplate,
};


/***/ }),

/***/ 183:
/***/ ((module) => {

const noChangesFound = (resources, outputs) => {
  const noChangeResource = () =>
    resources.create === 0 &&
    resources.update === 0 &&
    resources.delete === 0 &&
    resources.import === 0;

  const noChangeOutput = () =>
    outputs.create === 0 && outputs.update === 0 && outputs.delete === 0;

  return noChangeResource() && noChangeOutput();
};

const countImports = (tfplan) => {
  const imports = tfplan.resource_changes.filter((res) => {
    return res.change.importing !== undefined;
  });
  return imports.length;
};

const countResourceChanges = (tfPlan, action) => {
  const actions = tfPlan.resource_changes.filter((res) =>
    res.change.actions.includes(action),
  );
  return actions.length;
};

const countOutputChanges = (tfPlan, action) => {
  let count = 0;
  for (let prop in tfPlan.output_changes) {
    // This is safe as prop comes from the list of props on the object
    // eslint-disable-next-line security/detect-object-injection
    if (tfPlan.output_changes[prop].actions.includes(action)) {
      count = count + 1;
    }
  }
  return count;
};

/**
 * @param {Object} planJson Terraform plan JSON object
 * @returns {Object} Resource and output changes in the tfplan
 */
const getPlanChanges = async (planJson) => {
  let changes;

  let resources = {
    create: 0,
    update: 0,
    delete: 0,
    import: 0,
  };

  let outputs = {
    create: 0,
    update: 0,
    delete: 0,
  };
  if (planJson.resource_changes != undefined) {
    resources = {
      create: countResourceChanges(planJson, "create"),
      update: countResourceChanges(planJson, "update"),
      delete: countResourceChanges(planJson, "delete"),
      import: countImports(planJson),
    };
  }

  if (planJson.output_changes != undefined) {
    outputs = {
      create: countOutputChanges(planJson, "create"),
      update: countOutputChanges(planJson, "update"),
      delete: countOutputChanges(planJson, "delete"),
    };
  }

  const noChanges = noChangesFound(resources, outputs);

  changes = {
    isChanges: !noChanges,
    isDeletes: resources.delete > 0,
    resources: resources,
    ouputs: outputs,
  };

  return changes;
};

module.exports = {
  getPlanChanges: getPlanChanges,
};


/***/ }),

/***/ 159:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 211:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 907:
/***/ ((module) => {

module.exports = eval("require")("nunjucks");


/***/ }),

/***/ 81:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";


const core = __nccwpck_require__(159);
const { action } = __nccwpck_require__(488);

/**
 * Logs an error and sets the action as failed.
 * @param {String} err Error message
 */
const handleError = (err) => {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
};

process.on("unhandledRejection", handleError);
action().catch(handleError);

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map