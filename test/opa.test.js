"use strict";

const fs = require("fs");
const { getPlanChanges } = require("../src/opa.js");

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

  test("plan with two outputs", async () => {
    const planJson = fs.readFileSync("./test/multiple_outputs/2_create.json");
    const changes = await getPlanChanges(JSON.parse(planJson));

    expect(changes.isChanges).toBe(true);
    expect(changes.isDeletes).toBe(false);
    expect(changes.resources).toEqual({
      update: 0,
      delete: 0,
      create: 0,
    });
    expect(changes.ouputs).toEqual({
      update: 0,
      delete: 0,
      create: 2,
    });
  });

  test("plan with all output changes", async () => {
    const planJson = fs.readFileSync("./test/multiple_outputs/all.json");
    const changes = await getPlanChanges(JSON.parse(planJson));

    expect(changes.isChanges).toBe(true);
    expect(changes.isDeletes).toBe(false);
    expect(changes.resources).toEqual({
      update: 0,
      delete: 0,
      create: 0,
    });
    expect(changes.ouputs).toEqual({
      update: 1,
      delete: 1,
      create: 1,
    });
  });
});
