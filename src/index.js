"use strict";

const core = require("@actions/core");
const { action } = require("./action.js");

/**
 * Logs an error and sets the action as failed.
 * @param {String} err Error message
 */
const handleError = (err) => {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
};

// Prevent Terragrunt from altering Terraform output
// https://terragrunt.gruntwork.io/docs/reference/cli-options/#terragrunt-forward-tf-stdout
core.exportVariable("TERRAGRUNT_FORWARD_TF_STDOUT", "true");

process.on("unhandledRejection", handleError);
action().catch(handleError);
