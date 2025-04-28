const noChangesFound = (resources, outputs) => {
  const noChangeResource = () =>
    resources.create === 0 &&
    resources.update === 0 &&
    resources.delete === 0 &&
    resources.import === 0 &&
    resources.move === 0;

  const noChangeOutput = () =>
    outputs.create === 0 && outputs.update === 0 && outputs.delete === 0;

  return noChangeResource() && noChangeOutput();
};

const countImports = (tfplan) => {
  const imports = tfplan.resource_changes.filter((res) => {
    return res.change.importing !== undefined;
  });
  return imports.length;
};

const countResourceChanges = (tfPlan, action) => {
  const actions = tfPlan.resource_changes.filter((res) =>
    res.change.actions.includes(action),
  );
  return actions.length;
};

const countMoves = (tfPlan) => {
  const moves = tfPlan.resource_changes.filter(
    (res) => res.previous_address !== undefined,
  );
  return moves.length;
};

const countOutputChanges = (tfPlan, action) => {
  let count = 0;
  for (let prop in tfPlan.output_changes) {
    // This is safe as prop comes from the list of props on the object
    // eslint-disable-next-line security/detect-object-injection
    if (tfPlan.output_changes[prop].actions.includes(action)) {
      count = count + 1;
    }
  }
  return count;
};

/**
 * @param {Object} planJson Terraform plan JSON object
 * @returns {Object} Resource and output changes in the tfplan
 */
const getPlanChanges = async (planJson) => {
  let changes;

  let resources = {
    create: 0,
    update: 0,
    delete: 0,
    import: 0,
    move: 0,
  };

  let outputs = {
    create: 0,
    update: 0,
    delete: 0,
  };
  if (planJson.resource_changes != undefined) {
    resources = {
      create: countResourceChanges(planJson, "create"),
      update: countResourceChanges(planJson, "update"),
      delete: countResourceChanges(planJson, "delete"),
      import: countImports(planJson),
      move: countMoves(planJson),
    };
  }

  if (planJson.output_changes != undefined) {
    outputs = {
      create: countOutputChanges(planJson, "create"),
      update: countOutputChanges(planJson, "update"),
      delete: countOutputChanges(planJson, "delete"),
    };
  }

  const noChanges = noChangesFound(resources, outputs);

  changes = {
    isChanges: !noChanges,
    isDeletes: resources.delete > 0,
    resources: resources,
    outputs: outputs,
  };

  return changes;
};

module.exports = {
  getPlanChanges: getPlanChanges,
};
