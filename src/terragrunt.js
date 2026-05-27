"use strict";

/* eslint security/detect-child-process: "off" */
const proc = require("child_process");

/**
 * Parses the output of `terragrunt --version` and returns a version object.
 * Handles output like "terragrunt version v0.98.4" or "terragrunt v1.0.0".
 * @param {string} output
 * @returns {{major: number, minor: number, patch: number}|null}
 */
function parseTerragruntVersion(output) {
  const match = output.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Runs `terragrunt --version` and returns the parsed version.
 * Returns null if the command fails or the output cannot be parsed.
 * @returns {{major: number, minor: number, patch: number}|null}
 */
function getTerragruntVersion() {
  try {
    const output = proc
      .execSync("terragrunt --version", {
        stdio: ["pipe", "pipe", "pipe"],
      })
      .toString("utf8");
    return parseTerragruntVersion(output);
  } catch {
    return null;
  }
}

/**
 * Returns true when the installed Terragrunt uses the new CLI style (>= 0.98.0):
 *   terragrunt run [--all] [options] -- <tf-command> [tf-options]
 *
 * Returns false for legacy CLI style (< 0.98.0):
 *   terragrunt [options] <tf-command> [tf-options]
 *   terragrunt run-all <tf-command>  (for init-run-all)
 *
 * Defaults to true (new CLI) when version detection fails.
 * @param {{major: number, minor: number, patch: number}|null} version
 * @returns {boolean}
 */
function useNewTerragruntCli(version) {
  if (!version) return true;
  if (version.major > 0) return true;
  if (version.minor >= 98) return true;
  return false;
}

module.exports = {
  parseTerragruntVersion,
  getTerragruntVersion,
  useNewTerragruntCli,
};
