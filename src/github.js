"use strict";

/**
 * Adds a comment to the Pull Request with the Terraform plan changes
 * and result of the format/validate checks.
 * @param {Object} octokit GitHub API object
 * @param {Object} context GitHub context for the workflow run
 * @param {String} title Comment heading
 * @param {Object} results Results for all the Terraform commands
 * @param {Object} changes Resource and output changes for the plan
 */
const addComment = async (octokit, context, title, results, changes) => {
  const comment = `## ${title}
**${results.fmt.isSuccess ? "✅" : "❌"} &nbsp; Terraform Format:** \`${
    results.fmt.isSuccess ? "success" : "failed"
  }\`
**${results.plan.isSuccess ? "✅" : "❌"} &nbsp; Terraform Plan:** \`${
    results.plan.isSuccess ? "success" : "failed"
  }\`

${
  changes.isDeletes
    ? "**⚠️ &nbsp; WARNING:** resources will be destroyed by this change!"
    : ""
}
\`\`\`terraform
Plan: ${changes.resources.create} to add, ${
    changes.resources.update
  } to change, ${changes.resources.delete} to destroy
\`\`\`

<details>
<summary>Show plan</summary>

\`\`\`terraform
${results.plan.output}
\`\`\`
</details>`;

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

module.exports = {
  addComment: addComment,
  deleteComment: deleteComment,
};
