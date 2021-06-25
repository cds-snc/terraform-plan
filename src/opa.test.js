"use strict";

const { getPlanChanges } = require("./opa.js");

beforeEach(() => {
  jest.resetAllMocks();
});

describe("getPlanChanges", () => {
  test("plan with changes", async () => {
    const changes = await getPlanChanges("./test/changes/tfplan.json");

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
    const changes = await getPlanChanges("./test/no-changes/tfplan.json");

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

  test("missing plan", async () => {
    await expect(getPlanChanges("./foo.json")).rejects.toThrow(
      "ENOENT: no such file or directory, open './foo.json'"
    );
  });
});
