"use strict";

const core = require("@actions/core");
const { main } = require("./lib.js");

/**
 * Logs an error and sets the action as failed.
 * @param {String} err Error message
 */
const handleError = (err) => {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
};

process.on("unhandledRejection", handleError);
main().catch(handleError);
