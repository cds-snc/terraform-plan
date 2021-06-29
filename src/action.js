"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { execCommand } = require("./command.js");
const { addComment, deleteComment } = require("./github.js");
const { getPlanChanges } = require("./opa.js");

/**
 * Runs the action
 */
const action = async () => {
  const isAllowFailure = core.getBooleanInput("allow-failure");
  const isComment = core.getBooleanInput("comment");
  const isCommentDelete = core.getBooleanInput("comment-delete");
  const isTerragrunt = core.getBooleanInput("terragrunt");

  const binary = isTerragrunt ? "terragrunt" : "terraform";
  const commentTitle = core.getInput("comment-title");
  const directory = core.getInput("directory");
  const terraformInit = core.getMultilineInput("terraform-init");
  const token = core.getInput("github-token");
  const octokit = token !== "false" ? github.getOctokit(token) : undefined;

  const commands = [
    {
      key: "init",
      exec: `${binary} init ${terraformInit ? terraformInit.join(" ") : ""}`,
    },
    {
      key: "validate",
      exec: `${binary} validate`,
    },
    {
      key: "fmt",
      exec: `${binary} fmt --check`,
    },
    {
      key: "plan",
      exec: `${binary} plan -no-color -input=false -out=plan.tfplan`,
    },
    {
      key: "show",
      exec: `${binary} show -json plan.tfplan`,
      depends: "plan",
      output: false,
    },
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
    if (!command.depends || results[command.depends].isSuccess) {
      results[command.key] = execCommand(command, directory);
    } else {
      results[command.key] = { isSuccess: false };
    }
    isError = isError || !results[command.key].isSuccess;
  }

  // Delete previous PR comments
  if (isCommentDelete) {
    await deleteComment(octokit, github.context, commentTitle);
  }

  // Check for changes
  let changes = {};
  if (results.show.isSuccess) {
    const planJson = JSON.parse(results.show.output);
    changes = await getPlanChanges(planJson);
  }

  // Comment on PR if changes or errors
  if (isComment && (changes.isChanges || isError)) {
    await addComment(octokit, github.context, commentTitle, results, changes);
  }

  if (isError && !isAllowFailure) {
    core.setFailed("Terraform plan failed");
  }
};

module.exports = {
  action: action,
};
