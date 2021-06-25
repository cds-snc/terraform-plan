"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { addComment, deleteComment } = require("./github.js");
const { execCommand } = require("./command.js");

/**
 * Runs the action
 */
const action = async () => {
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
    return;
  }

  // Exec commands
  for (let command of commands) {
    results[command.key] = execCommand(command.exec, directory);
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

module.exports = {
  action: action,
};
