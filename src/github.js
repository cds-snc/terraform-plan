"use strict";

const nunjucks = require("nunjucks");

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
  const plan = removePlanRefresh(results.plan.output);
  const comment = nunjucks.render("./src/templates/comment.njk", {
    changes: changes,
    plan: plan,
    results: results,
    title: title,
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
  ];
  for (let token of startTokens) {
    plan = plan.substring(plan.indexOf(token));
  }
  return plan;
};

module.exports = {
  addComment: addComment,
  deleteComment: deleteComment,
  removeRefreshOutput: removePlanRefresh,
};
