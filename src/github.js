"use strict";

const nunjucks = require("nunjucks");
const commentTemplate = `<!-- terraform-plan: {{ title }}::{{ directory }} -->
## {{ title }}
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
  let result = "";

  if (resources.import > 0) {
    result += `${resources.import} to import, `;
  }

  if (resources.move > 0) {
    result += `${resources.move} to move, `;
  }

  result += `${resources.create} to add, ${resources.update} to change, ${resources.delete} to destroy`;

  return result;
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
 * @param {boolean} skipConftest Skip the conftest step
 */
const addComment = async (
  octokit,
  context,
  title,
  directory,
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
    directory: directory,
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
const deleteComment = async (octokit, context, title, directory) => {
  // Get existing comments.
  const { data: comments } = await octokit.rest.issues.listComments({
    ...context.repo,
    issue_number: context.payload.pull_request.number,
  });

  // Find the bot's comment
  const marker = `<!-- terraform-plan: ${title}::${directory} -->`;
  const comment = comments.find(
    (comment) =>
      comment.user.type === "Bot" && comment.body.indexOf(marker) > -1,
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
    "Terraform will perform the following actions:",
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
