"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { when } = require("jest-when");
const { execCommand } = require("../src/command.js");
const { addComment, deleteComment } = require("../src/github.js");
const { getPlanChanges } = require("../src/opa.js");
const { action } = require("../src/action.js");

jest.mock("@actions/core");
jest.mock("@actions/github");
jest.mock("../src/command.js");
jest.mock("../src/github.js");
jest.mock("../src/opa.js");

describe("action", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("default flow", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "{}" });
    when(core.getInput).calledWith("directory").mockReturnValue("foo");
    when(core.getMultilineInput)
      .calledWith("terraform-init")
      .mockReturnValue([
        "-backend-config='bucket=some-bucket'",
        "-backend-config='region=ca-central-1'",
      ]);

    await action();

    expect(execCommand.mock.calls.length).toBe(7);
    expect(execCommand.mock.calls).toEqual([
      [
        {
          key: "init",
          exec: "terraform init -no-color -backend-config='bucket=some-bucket' -backend-config='region=ca-central-1'",
        },
        "foo",
      ],
      [
        {
          key: "validate",
          exec: "terraform validate -no-color",
        },
        "foo",
      ],
      [
        {
          key: "fmt",
          exec: "terraform fmt --check",
        },
        "foo",
      ],
      [
        {
          key: "plan",
          exec: "terraform plan -no-color -input=false -out=plan.tfplan",
        },
        "foo",
      ],
      [
        {
          key: "show",
          exec: "terraform show -no-color -json plan.tfplan",
          depends: "plan",
          output: false,
        },
        "foo",
      ],
      [
        {
          key: "show-json-out",
          exec: "terraform show -no-color -json plan.tfplan > plan.json",
          depends: "plan",
          output: false,
        },
        "foo",
      ],
      [
        {
          key: "conftest",
          depends: "show-json-out",
          exec: "conftest test plan.json --no-color --update git::https://github.com/cds-snc/opa_checks.git//aws_terraform",
          output: true,
        },
        "foo",
      ],
    ]);
    expect(addComment.mock.calls.length).toBe(0);
    expect(deleteComment.mock.calls.length).toBe(0);
  });

  test("terragrunt flow", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "{}" });
    when(core.getInput).calledWith("directory").mockReturnValue("bar");
    when(core.getBooleanInput).calledWith("terragrunt").mockReturnValue(true);

    await action();

    expect(execCommand.mock.calls.length).toBe(7);
    expect(execCommand.mock.calls).toEqual([
      [
        {
          key: "init",
          exec: "terragrunt init -no-color ",
        },
        "bar",
      ],
      [
        {
          key: "validate",
          exec: "terragrunt validate -no-color",
        },
        "bar",
      ],
      [
        {
          key: "fmt",
          exec: "terragrunt fmt --check",
        },
        "bar",
      ],
      [
        {
          key: "plan",
          exec: "terragrunt plan -no-color -input=false -out=plan.tfplan",
        },
        "bar",
      ],
      [
        {
          key: "show",
          exec: "terragrunt show -no-color -json plan.tfplan",
          depends: "plan",
          output: false,
        },
        "bar",
      ],
      [
        {
          key: "show-json-out",
          exec: "terragrunt show -no-color -json plan.tfplan > plan.json",
          depends: "plan",
          output: false,
        },
        "bar",
      ],
      [
        {
          key: "conftest",
          depends: "show-json-out",
          exec: "conftest test plan.json --no-color --update git::https://github.com/cds-snc/opa_checks.git//aws_terraform",
          output: true,
        },
        "bar",
      ],
    ]);
    expect(getPlanChanges.mock.calls.length).toBe(1);
    expect(addComment.mock.calls.length).toBe(0);
    expect(deleteComment.mock.calls.length).toBe(0);
  });

  test("delete comment", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "{}" });
    when(core.getBooleanInput)
      .calledWith("comment-delete")
      .mockReturnValue(true);
    when(core.getInput)
      .calledWith("comment-title")
      .mockReturnValue("blueberries");
    when(core.getInput).calledWith("github-token").mockReturnValue("mellow");
    github.getOctokit.mockReturnValue("octokit");
    github.context = "context";

    await action();

    expect(github.getOctokit.mock.calls.length).toBe(1);
    expect(getPlanChanges.mock.calls.length).toBe(1);
    expect(deleteComment.mock.calls.length).toBe(1);
    expect(deleteComment.mock.calls[0]).toEqual([
      "octokit",
      "context",
      "blueberries",
    ]);
  });

  test("add comment", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "{}" });
    getPlanChanges.mockReturnValue({ isChanges: true });
    when(core.getBooleanInput).calledWith("comment").mockReturnValue(true);
    when(core.getInput)
      .calledWith("comment-title")
      .mockReturnValue("raspberries");
    when(core.getInput).calledWith("github-token").mockReturnValue("mellow");
    github.getOctokit.mockReturnValue("octokit");
    github.context = "context";

    await action();

    expect(github.getOctokit.mock.calls.length).toBe(1);
    expect(getPlanChanges.mock.calls.length).toBe(1);
    expect(addComment.mock.calls.length).toBe(1);
    expect(addComment.mock.calls[0]).toEqual([
      "octokit",
      "context",
      "raspberries",
      {
        fmt: { isSuccess: true, output: "{}" },
        init: { isSuccess: true, output: "{}" },
        plan: { isSuccess: true, output: "{}" },
        show: { isSuccess: true, output: "{}" },
        validate: { isSuccess: true, output: "{}" },
        "show-json-out": { isSuccess: true, output: "{}" },
        conftest: { isSuccess: true, output: "{}" },
      },
      { isChanges: true },
      30000,
      2000
    ]);
  });

  test("failed command", async () => {
    execCommand.mockReturnValue({ isSuccess: false, output: "" });

    await action();

    expect(core.setFailed.mock.calls.length).toBe(1);
    expect(core.setFailed.mock.calls[0][0]).toBe(`The following commands failed:
terraform init -no-color 
terraform validate -no-color
terraform fmt --check
terraform plan -no-color -input=false -out=plan.tfplan
terraform show -no-color -json plan.tfplan
terraform show -no-color -json plan.tfplan > plan.json
conftest test plan.json --no-color --update git::https://github.com/cds-snc/opa_checks.git//aws_terraform`);
  });

  test("allowed to fail", async () => {
    execCommand.mockReturnValue({ isSuccess: false, output: "" });
    when(core.getBooleanInput)
      .calledWith("allow-failure")
      .mockReturnValue(true);
    when(core.getBooleanInput).calledWith("comment").mockReturnValue(false);
    when(core.getBooleanInput)
      .calledWith("comment-delete")
      .mockReturnValue(false);

    await action();

    expect(core.setFailed.mock.calls.length).toBe(0);
  });

  test("detect terraform_wrapper", async () => {
    execCommand.mockReturnValue({
      isSuccess: false,
      output: "Some command output ::debug::exitcode: 1",
    });

    await action();

    expect(core.setFailed.mock.calls.length).toBe(1);
    expect(core.setFailed.mock.calls[0]).toEqual([
      "Error: `hashicorp/setup-terraform` must have `terraform_wrapper: false`",
    ]);
  });

  test("failed validation", async () => {
    when(core.getBooleanInput).calledWith("comment").mockReturnValue(true);
    when(core.getInput).calledWith("github-token").mockReturnValue("false");

    await action();

    expect(core.setFailed.mock.calls.length).toBe(1);
    expect(core.setFailed.mock.calls[0][0]).toBe(
      "You must pass a GitHub token to comment on PRs"
    );
  });
});
