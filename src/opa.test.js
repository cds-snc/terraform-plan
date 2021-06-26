"use strict";

const fs = require("fs");
const { getPlanChanges } = require("./opa.js");

beforeEach(() => {
  jest.resetAllMocks();
});

describe("getPlanChanges", () => {
  test("plan with changes", async () => {
    const planJson = fs.readFileSync("./test/changes/tfplan.json");
    const changes = await getPlanChanges(JSON.parse(planJson));

    expect(changes.isChanges).toBe(true);
    expect(changes.isDeletes).toBe(false);
    expect(changes.resources).toEqual({
      update: 0,
      delete: 0,
      create: 1,
    });
    expect(changes.ouputs).toEqual({
      update: 0,
      delete: 0,
      create: 1,
    });
  });

  test("plan without changes", async () => {
    const planJson = fs.readFileSync("./test/no-changes/tfplan.json");
    const changes = await getPlanChanges(JSON.parse(planJson));

    expect(changes.isChanges).toBe(false);
    expect(changes.isDeletes).toBe(false);
    expect(changes.resources).toEqual({
      update: 0,
      delete: 0,
      create: 0,
    });
    expect(changes.ouputs).toEqual({
      update: 0,
      delete: 0,
      create: 0,
    });
  });
});
