"use strict";

const nunjucks = require("nunjucks");
const commentTemplate = `## {{ title }}
**{{ "✅" if results.fmt.isSuccess else "❌" }} &nbsp; Terraform Format:** \`{{ "success" if results.fmt.isSuccess else "failed" }}\`
{% if not skipPlan -%}
**{{ "✅" if results.plan.isSuccess else "❌" }} &nbsp; Terraform Plan:** \`{{ "success" if results.plan.isSuccess else "failed" }}\`
**{{ "✅" if results.conftest.isSuccess else "❌" }} &nbsp; Conftest:** \`{{ "success" if results.conftest.isSuccess else "failed" }}\` 

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
Plan: {{ changes.resources.create }} to add, {{ changes.resources.update }} to change, {{ changes.resources.delete }} to destroy
\`\`\`
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

{% if results.conftest.output -%}
<details>
<summary>Show Conftest results</summary>

\`\`\`sh
{{ results.conftest.output|safe|truncate(conftestLimit) }}
\`\`\`

</details>
{% endif -%}
{% endif -%}`;

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
  skipPlan
) => {
  const format = cleanFormatOutput(results.fmt.output);
  const plan = skipPlan ? "" : removePlanRefresh(results.plan.output);
  const comment = nunjucks.renderString(commentTemplate, {
    changes: changes,
    plan: plan,
    format: format,
    results: results,
    title: title,
    planLimit: planLimit,
    conftestLimit: conftestLimit,
    skipPlan: skipPlan,
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
    (comment) => comment.user.type === "Bot" && comment.body.indexOf(title) > -1
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
