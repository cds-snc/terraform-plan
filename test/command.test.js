"use strict";

const { execCommand } = require("../src/command.js");
global.console = { log: jest.fn() };

beforeEach(() => {
  jest.resetAllMocks();
});

describe("execCommand", () => {
  test("show command output", () => {
    expect(execCommand({ exec: "ls" }, "./test/format-error")).toEqual({
      isSuccess: true,
      output: "format-error.tf\n",
    });
    expect(global.console.log.mock.calls).toEqual([
      ["🧪 \x1b[36m%s\x1b[0m\n", "ls"],
      ["format-error.tf\n"],
    ]);
  });
  test("show error message with no command output", () => {
    expect(execCommand({ exec: "cat foo", output: false }, ".")).toEqual({
      isSuccess: false,
      output: "cat: foo: No such file or directory\n",
    });
    expect(global.console.log.mock.calls).toEqual([
      ["🧪 \x1b[36m%s\x1b[0m\n", "cat foo"],
      ["Command failed: exit code 1"],
    ]);
  });
});
