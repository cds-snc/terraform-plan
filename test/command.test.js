"use strict";

const { execCommand } = require("../src/command.js");
global.console = { log: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("execCommand", () => {
  test("show command output", () => {
    expect(execCommand("ls", "./test/format-error")).toEqual({
      isSuccess: true,
      output: "format-error.tf\n",
    });
  });
  test("show error message", () => {
    expect(execCommand("cat foo", ".")).toEqual({
      isSuccess: false,
      output: "cat: foo: No such file or directory\n",
    });
  });
});
