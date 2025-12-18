"use strict";

function buildSlackPayload(results, changes, options = {}) {
  const { directory = ".", isError = false } = options;

  const created =
    (changes && changes.resourceNames && changes.resourceNames.created) || [];
  const updated =
    (changes && changes.resourceNames && changes.resourceNames.updated) || [];
  const deleted =
    (changes && changes.resourceNames && changes.resourceNames.deleted) || [];

  const hasChanges =
    created.length > 0 || updated.length > 0 || deleted.length > 0;

  const statusText = isError
    ? "❌ Terraform plan failed"
    : hasChanges
      ? "⚠️ Terraform plan has changes"
      : "✅ Terraform plan has no changes";

  const blocks = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Terraform Plan Results",
      emoji: true,
    },
  });

  // Summary section
  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Directory*\n${directory}`,
      },
      {
        type: "mrkdwn",
        text: `*Status*\n${statusText}`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // Created resources
  if (created.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*New resources (${created.length})*\n` +
          created.map((r) => "• `" + r + "`").join("\n"),
      },
    });
  }

  // Updated resources
  if (updated.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Updated resources (${updated.length})*\n` +
          updated.map((r) => "• `" + r + "`").join("\n"),
      },
    });
  }

  // Deleted resources - highlight heavily
  if (deleted.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `:warning: *Deleted resources (${deleted.length})* :warning:\n` +
          deleted.map((r) => "• `" + r + "`").join("\n"),
      },
    });
  }

  if (!hasChanges && !isError) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No resource or output changes detected.",
      },
    });
  }

  const fallbackLines = [];
  fallbackLines.push(`Directory: ${directory}`);
  fallbackLines.push(statusText);

  if (created.length > 0) {
    fallbackLines.push("Created:");
    fallbackLines.push(...created.map((r) => `- ${r}`));
  }
  if (updated.length > 0) {
    fallbackLines.push("Updated:");
    fallbackLines.push(...updated.map((r) => `- ${r}`));
  }
  if (deleted.length > 0) {
    fallbackLines.push("Deleted:");
    fallbackLines.push(...deleted.map((r) => `- ${r}`));
  }

  return {
    text: fallbackLines.join("\n"),
    blocks: blocks,
  };
}

module.exports = {
  buildSlackPayload: buildSlackPayload,
};
