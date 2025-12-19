"use strict";

function buildDriftData(results, changes, options = {}) {
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
