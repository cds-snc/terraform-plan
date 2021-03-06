"use strict";

const { loadPolicy } = require("@open-policy-agent/opa-wasm");
const { policyWasmBase64 } = require("./policy/policy.js");

/**
 * Uses ./policy/resource-changes.rego OPA policy to examine the JSON generated
 * from a tfplan file and check if there are resource changes.
 * @param {Object} planJson Terraform plan JSON object
 * @returns {Object} Resource and output changes in the tfplan
 */
const getPlanChanges = async (planJson) => {
  const policyWasm = Buffer.from(policyWasmBase64, "base64");
  const policy = await loadPolicy(policyWasm);

  const results = policy.evaluate(planJson);

  let changes;
  if (results !== null && results.length) {
    const noChanges = results[0].result.no_changes;
    const resources = results[0].result.resource_changes;
    const outputs = results[0].result.output_changes;

    changes = {
      isChanges: !noChanges,
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
