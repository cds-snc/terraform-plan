"use strict";

const nunjucks = require("nunjucks");
const {
  addComment,
  commentTemplate,
  deleteComment,
  removeRefreshOutput,
} = require("./github.js");
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
    const comment = nunjucks.renderString(commentTemplate, {
      changes: changes,
      plan: results.plan.output,
      results: results,
      title: "Foobar",
    });

    await addComment(octomock, context, "Foobar", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0]).toEqual([
      {
        owner: "foo",
        repo: "bar",
        issue_number: 42,
        body: comment,
      },
    ]);
  });

  test("add a failed comment with changes", async () => {
    const results = {
      fmt: { isSuccess: false },
      plan: { isSuccess: false, output: "Well hello there" },
    };
    const changes = {};
    const comment = nunjucks.renderString(commentTemplate, {
      changes: changes,
      plan: results.plan.output,
      results: results,
      title: "Bambaz",
    });

    await addComment(octomock, context, "Bambaz", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: comment,
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

describe("removePlanRefresh", () => {
  test("remove refresh for plan with changes", () => {
    const plan = `aws_iam_role_policy_attachment.ce_cs: Refreshing state...

    An execution plan has been generated and is shown below.
    Resource actions are indicated with the following symbols:

    + create  
    ~ update in-place
    - destroy

    Terraform will perform the following actions:`;
    const expected = `Resource actions are indicated with the following symbols:

    + create  
    ~ update in-place
    - destroy

    Terraform will perform the following actions:`;
    expect(removeRefreshOutput(plan)).toBe(expected);
  });

  test("remove refresh for plan with no-changes", async () => {
    const plan = `aws_ecr_repository.create_csv: Refreshing state...

    No changes. Infrastructure is up-to-date.
    
    This means that Terraform did not detect any differences between your
    configuration and real physical resources that exist. As a result, no
    actions need to be performed.`;
    const expected = `No changes. Infrastructure is up-to-date.
    
    This means that Terraform did not detect any differences between your
    configuration and real physical resources that exist. As a result, no
    actions need to be performed.`;
    expect(removeRefreshOutput(plan)).toBe(expected);
  });

  test("no change if start tokens do not exist", async () => {
    const plan = `This is a string without any plan start tokens
    for good measure, there's a line break in the mix`;
    expect(removeRefreshOutput(plan)).toBe(plan);
  });
});
