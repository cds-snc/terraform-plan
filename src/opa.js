"use strict";
/* eslint security/detect-non-literal-fs-filename: "off" */

const fs = require("fs");
const { loadPolicy } = require("@open-policy-agent/opa-wasm");

/**
 * Uses ./policy/resource-changes.rego OPA policy to examine the JSON generated
 * from a tfplan file and check if there are resource changes.
 * @param {String} planJsonPath Path to a Terrform plan JSON output
 * @returns {Object} Resource and output changes in the tfplan
 */
const getPlanChanges = async (planJsonPath) => {
  const policyWasm = fs.readFileSync("./policy/policy.wasm");
  const json = fs.readFileSync(planJsonPath);

  const policy = await loadPolicy(policyWasm);
  const results = policy.evaluate(JSON.parse(json));

  let changes;
  if (results !== null && results.length) {
    const resources = results[0].result.resource_changes;
    const outputs = results[0].result.output_changes;

    changes = {
      isChanges:
        resources.create > 0 ||
        resources.update > 0 ||
        resources.delete > 0 ||
        outputs.create > 0 ||
        outputs.update > 0 ||
        outputs.delete > 0,
      isDeletes: resources.delete > 0,
      resources: resources,
      ouputs: outputs,
    };
  }

  return changes;
};

module.exports = {
  getPlanChanges: getPlanChanges,
};
