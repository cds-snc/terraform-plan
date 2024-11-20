"use strict";
/* eslint security/detect-child-process: "off" */

const proc = require("child_process");

/**
 * Executes a command in a given directory
 * @param {Object} command The command to execute
 * @param {String} directory The directory to execute the command in
 * @returns {Object} Results object with the command output and if the command was successful
 */
const execCommand = (command, directory) => {
  let output,
    exitCode = 0;

  try {
    console.log("🧪 \x1b[36m%s\x1b[0m\n", command.exec);
    output = proc
      .execSync(command.exec, {
        cwd: directory,
        maxBuffer: 1024 * 30000,
      })
      .toString("utf8");
  } catch (error) {
    exitCode = error.status;
    output = "";
    output += error.stdout ? error.stdout.toString("utf8") : "";
    output += error.stderr ? error.stderr.toString("utf8") : "";
    console.log(`Command failed: exit code ${exitCode}`);
  }

  if (command.output !== false) {
    console.log(output);
  }

  return {
    isSuccess: exitCode === 0,
    output: output,
  };
};

module.exports = {
  execCommand: execCommand,
};
