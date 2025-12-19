"use strict";

/**
 * Builds a normalized drift summary object from raw drift detection output.
 *
 * @param {{resourceNames?: {created?: string[], updated?: string[], deleted?: string[]}}} changes
 *   An object describing resource-level changes. The optional {@code resourceNames}
 *   property groups resource identifiers by change type.
 * @param {{directory?: string, isError?: boolean}} [options] - Optional settings.
 * @param {string} [options.directory="."] - Directory for which drift was computed.
 * @param {boolean} [options.isError=false] - Whether the overall drift operation failed.
 * @returns {{
 *   directory: string,
 *   status: "failed" | "has_changes" | "no_changes",
 *   hasChanges: boolean,
 *   resources: {
 *     created: string[],
 *     updated: string[],
 *     deleted: string[]
 *   }
 * }} A drift data object summarizing the detected changes for the given directory.
 */
function buildDriftData(changes, options = {}) {
  const { directory = ".", isError = false } = options;

  const created =
    (changes && changes.resourceNames && changes.resourceNames.created) || [];
  const updated =
    (changes && changes.resourceNames && changes.resourceNames.updated) || [];
  const deleted =
    (changes && changes.resourceNames && changes.resourceNames.deleted) || [];

  const hasChanges =
    created.length > 0 || updated.length > 0 || deleted.length > 0;

  return {
    directory: directory,
    status: isError ? "failed" : hasChanges ? "has_changes" : "no_changes",
    hasChanges: hasChanges,
    resources: {
      created: created,
      updated: updated,
      deleted: deleted,
    },
  };
}

module.exports = {
  buildDriftData: buildDriftData,
};
