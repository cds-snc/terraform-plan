"use strict";
/* eslint security/detect-child-process: "off" */

const proc = require("child_process");

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
  } catch (error) {
    exitCode = error.exitCode;
    output = error.stderr.toString("utf8");
    console.log(JSON.stringify(error));
  }

  console.log(output);
  return {
    isSuccess: exitCode === 0,
    output: output,
  };
};

module.exports = {
  execCommand: execCommand,
};
