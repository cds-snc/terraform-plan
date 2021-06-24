"use strict";
/* eslint security/detect-child-process: "off"
    --------
    Script needs child_process to run Terraform commands. */

const core = require("@actions/core");
const github = require("@actions/github");
const proc = require("child_process");

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

const execCommand = (command, directory) => {
  let output,
    exitCode = 0;

  try {
    console.log("🧪 \x1b[36m%s\x1b[0m\n", command.exec);
    output = proc.execSync(command.exec, { cwd: directory }).toString("utf8");
    console.log(output);
  } catch (error) {
    exitCode = error.exitCode;
    output = error.message.toString("utf8");
  }

  return {
    isSuccess: exitCode === 0,
    output: output,
  };
};

const run = async () => {
  const isAllowFailure = core.getInput("allow-failure") === "true";
  const isComment = core.getInput("comment") === "true";
  const isCommentDelete = core.getInput("comment-delete") === "true";
  const isTerragrunt = core.getInput("terragrunt") === "true";

  const commentTitle = core.getInput("comment-title");
  const directory = core.getInput("directory");
  const binary = isTerragrunt ? "terragrunt" : "terraform";
  const token = core.getInput("github-token");
  const octokit = token !== "false" ? github.getOctokit(token) : undefined;

  const commands = [
    { key: "init", exec: `${binary} init` },
    { key: "validate", exec: `${binary} validate` },
    { key: "fmt", exec: `${binary} fmt --check` },
    { key: "plan", exec: `${binary} plan -json -out=plan.tfplan` },
    { key: "show", exec: `${binary} show plan.tfplan -no-color` },
  ];
  let results = {};
  let isError = false;

  // Validate input
  if (octokit === undefined && (isComment || isCommentDelete)) {
    core.setFailed("You must pass a GitHub token to comment on PRs");
  }

  // Exec commands
  for (let command of commands) {
    results[command.key] = execCommand(command, directory);
    isError = isError || !results[command.key].isSuccess;
  }

  // Delete previous PR comments
  if (isCommentDelete) {
    await deleteComment(octokit, github.context, commentTitle);
  }

  // Comment on PR if changes or errors
  const isChanges = results.plan.output.indexOf('"type":"planned_change"') > -1;
  if (isComment && (isChanges || isError)) {
    await addComment(octokit, github.context, commentTitle, results);
  }

  if (isError && !isAllowFailure) {
    core.setFailed("Terraform plan failed");
  }
};

run();
