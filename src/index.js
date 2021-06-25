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

process.on("unhandledRejection", handleError);
action().catch(handleError);
