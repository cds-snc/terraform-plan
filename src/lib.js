"use strict";
/* eslint security/detect-child-process: "off" */

const proc = require("child_process");

/**
 * Adds a comment to the Pull Request with the Terraform plan changes
 * and result of the format/validate checks.
 * @param {Object} octokit GitHub API object
 * @param {Object} context GitHub context for the workflow run
 * @param {String} title Comment heading
 * @param {Object} results Results for all the Terraform commands
 */
const addComment = async (octokit, context, title, results) => {
  const comment = `## ${title}
**${results.fmt.isSuccess ? "✅" : "❌"} &nbsp; Terraform Format:** \`${
    results.fmt.isSuccess ? "success" : "failed"
  }\`
**${results.plan.isSuccess ? "✅" : "❌"} &nbsp; Terraform Plan:** \`${
    results.plan.isSuccess ? "success" : "failed"
  }\`
<details>
<summary>Show plan</summary>

\`\`\`terraform
${results.show.output}
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

/**
 * Executes a command in a given directory
 * @param {String} command The command (and args) to execute
 * @param {String} directory The directory to execute the command in
 * @returns {Object} Results object with the command output and if the command was successful
 */
const execCommand = (command, directory) => {
  let output,
    exitCode = 0;

  try {
    console.log("🧪 \x1b[36m%s\x1b[0m\n", command);
    output = proc.execSync(command, { cwd: directory }).toString("utf8");
    console.log(output);
  } catch (error) {
    exitCode = error.exitCode;
    output = error.stderr.toString("utf8");
  }

  return {
    isSuccess: exitCode === 0,
    output: output,
  };
};

module.exports = {
  addComment: addComment,
  deleteComment: deleteComment,
  execCommand: execCommand,
};
