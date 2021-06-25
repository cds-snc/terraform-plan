"use strict";

const { addComment, deleteComment } = require("./github.js");
global.console = { log: jest.fn() };

// Mock octokit object and return values
const octomock = {
  rest: {
    issues: {
      createComment: jest.fn(),
      deleteComment: jest.fn(),
      listComments: jest.fn(),
    },
  },
};
octomock.rest.issues.listComments.mockReturnValue({
  data: [
    {
      id: 1,
      body: "Foobar",
      user: {
        type: "Bot",
      },
    },
    {
      id: 2,
      body: "Bort",
      user: {
        type: "User",
      },
    },
  ],
});

// Mock GitHub workflow context
const context = {
  repo: {
    owner: "foo",
    repo: "bar",
  },
  payload: { pull_request: { number: 42 } },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addComment", () => {
  test("add a success comment with changes", async () => {
    const results = {
      fmt: { isSuccess: true },
      plan: { isSuccess: true, output: "Well hello there" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 0,
        delete: 0,
        create: 1,
      },
    };

    await addComment(octomock, context, "Foobar", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0]).toEqual([
      {
        owner: "foo",
        repo: "bar",
        issue_number: 42,
        body: "## Foobar\n**✅ &nbsp; Terraform Format:** `success`\n**✅ &nbsp; Terraform Plan:** `success`\n\n**⚠️ &nbsp; WARNING:** resources will be destroyed by this change!\n```terraform\nPlan: 1 to add, 0 to change, 0 to destroy\n```\n\n<details>\n<summary>Show plan</summary>\n\n```terraform\nWell hello there\n```\n</details>",
      },
    ]);
  });

  test("add a failed comment with changes", async () => {
    const results = {
      fmt: { isSuccess: false },
      plan: { isSuccess: false, output: "Well hello there" },
    };
    const changes = {
      isChanges: false,
      isDeletes: false,
      resources: {
        update: 0,
        delete: 0,
        create: 0,
      },
    };

    await addComment(octomock, context, "Foobar", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: "## Foobar\n**❌ &nbsp; Terraform Format:** `failed`\n**❌ &nbsp; Terraform Plan:** `failed`\n\n\n```terraform\nPlan: 0 to add, 0 to change, 0 to destroy\n```\n\n<details>\n<summary>Show plan</summary>\n\n```terraform\nWell hello there\n```\n</details>",
    });
  });
});

describe("deleteComment", () => {
  test("delete an existing bot comment", async () => {
    await deleteComment(octomock, context, "Foobar");
    expect(octomock.rest.issues.listComments.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.listComments.mock.calls[0][0]).toEqual({
      issue_number: 42,
      owner: "foo",
      repo: "bar",
    });
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls[0][0]).toEqual({
      comment_id: 1,
      owner: "foo",
      repo: "bar",
    });
  });
  test("do nothing for non-bot comments", async () => {
    await deleteComment(octomock, context, "Bort");
    expect(octomock.rest.issues.listComments.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(0);
  });
});
