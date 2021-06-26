"use strict";

const fs = require("fs");
const { loadPolicy } = require("@open-policy-agent/opa-wasm");

/**
 * Uses ./policy/resource-changes.rego OPA policy to examine the JSON generated
 * from a tfplan file and check if there are resource changes.
 * @param {Object} planJson Terraform plan JSON object
 * @returns {Object} Resource and output changes in the tfplan
 */
const getPlanChanges = async (planJson) => {
  const policyWasm = fs.readFileSync("./policy/policy.wasm");

  const policy = await loadPolicy(policyWasm);
  const results = policy.evaluate(planJson);

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
