"use strict";

const {
  addComment,
  cleanFormatOutput,
  deleteComment,
  removeRefreshOutput,
  commentTemplate,
} = require("../src/github.js");

const { getAlarmCoverage } = require("../src/alarms.js");

const nunjucks = require("nunjucks");

global.console = { log: jest.fn() };

// Mock octokit object and return values
const octomock = {
  paginate: jest.fn(),
  rest: {
    issues: {
      createComment: jest.fn(),
      deleteComment: jest.fn(),
      listComments: jest.fn(),
    },
  },
};

// `octokit.paginate` returns the flattened list of comments, not a response object
octomock.paginate.mockResolvedValue([
  {
    id: 1,
    body: "<!-- terraform-plan: Foobar::. -->\n## Foobar",
    user: {
      type: "Bot",
    },
  },
  {
    id: 2,
    body: "<!-- terraform-plan: Bort::. -->\n## Bort",
    user: {
      type: "User",
    },
  },
]);

// Mock GitHub workflow context
const context = {
  repo: {
    owner: "foo",
    repo: "bar",
  },
  payload: { pull_request: { number: 42 } },
  runId: 42,
  serverUrl: "https://github.com",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("commentTemplate", () => {
  test("truncate plans > 64000 characters", async () => {
    const str = nunjucks.renderString(commentTemplate, {
      results: {
        init: { isSuccess: true, output: "" },
        validate: { isSuccess: true, output: "" },
        fmt: { isSuccess: false },
        plan: { isSuccess: false },
        conftest: { isSucces: false },
      },
      changes: {
        resources: {
          create: 10,
          update: 10,
          delete: 10,
          import: 0,
        },
      },
      plan: "x".repeat(66000),
      conftest: {
        output: "x".repeat(2000),
      },
      title: "x".repeat(100),
    });
    expect(str.length).toBeLessThan(65536);
  });
});

describe("addComment", () => {
  test("add a success comment with changes and no imports", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "< General Kenobi >" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 0,
        delete: 0,
        create: 1,
        import: 0,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
\`\`\`terraform
Plan: 1 to add, 0 to change, 0 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


<details>
<summary>Show plan</summary>

\`\`\`terraform
< Hello there >
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
< General Kenobi >
\`\`\`

</details>
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10000,
      10000,
      false,
    );
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

  test("add a success comment with imports", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "< General Kenobi >" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 0,
        delete: 0,
        create: 0,
        import: 1,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
\`\`\`terraform
Plan: 1 to import, 0 to add, 0 to change, 0 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


<details>
<summary>Show plan</summary>

\`\`\`terraform
< Hello there >
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
< General Kenobi >
\`\`\`

</details>
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10000,
      10000,
      false,
    );
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

  test("add a success comment with moved resources", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "< General Kenobi >" },
    };
    const changes = {
      isChanges: true,
      isDeletes: false,
      resources: {
        update: 0,
        delete: 0,
        create: 0,
        import: 0,
        move: 1,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

\`\`\`terraform
Plan: 1 to move, 0 to add, 0 to change, 0 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


<details>
<summary>Show plan</summary>

\`\`\`terraform
< Hello there >
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
< General Kenobi >
\`\`\`

</details>
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10000,
      10000,
      false,
    );
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

  test("add a success comment with combined resources (import, move, add, update, delete)", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: {
        isSuccess: true,
        output: "< Complex plan with multiple actions >",
      },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 1,
        delete: 1,
        create: 2,
        import: 2,
        move: 2,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
\`\`\`terraform
Plan: 2 to import, 2 to move, 2 to add, 1 to change, 1 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


<details>
<summary>Show plan</summary>

\`\`\`terraform
< Complex plan with multiple actions >
\`\`\`

</details>

`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10000,
      10000,
      false,
    );
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
      init: { isSuccess: false, output: "I love you" },
      validate: { isSuccess: false, output: "I know" },
      fmt: {
        isSuccess: false,
        output: "format-error.tf\nnot a doctor\nsome-other-file.tf",
      },
      plan: { isSuccess: false, output: "Hello there" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: false, output: "General Kenobi" },
    };
    const changes = {};
    const comment = `<!-- terraform-plan: Bambaz::. -->
## Bambaz
**❌ &nbsp; Terraform Init:** \`failed\`
**❌ &nbsp; Terraform Validate:** \`failed\`
**❌ &nbsp; Terraform Format:** \`failed\`
**❌ &nbsp; Terraform Plan:** \`failed\`
**❌ &nbsp; Conftest:** \`failed\` 

<details>
<summary>Show Init results</summary>

\`\`\`sh
I love you
\`\`\`

</details>

<details>
<summary>Show Validate results</summary>

\`\`\`sh
I know
\`\`\`

</details>

**🧹 &nbsp; Format:** run \`terraform fmt\` to fix the following: 
\`\`\`sh
format-error.tf
some-other-file.tf
\`\`\`
<details>
<summary>Show plan</summary>

\`\`\`terraform
Hello there
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
General Kenobi
\`\`\`

</details>
`;

    await addComment(octomock, context, "Bambaz", ".", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: comment,
    });
  });

  test("add a comment listing resources without alarm coverage", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "Hello there" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "" },
    };
    const changes = { isChanges: false, isDeletes: false, resources: {} };
    const alarmCoverage = {
      hasGaps: true,
      total: 3,
      covered: [{ address: "aws_lambda_function.api" }],
      uncovered: [
        {
          address: "aws_sqs_queue.jobs",
          type: "aws_sqs_queue",
          service: "SQS",
        },
        {
          address: "module.api.aws_lb.this",
          type: "aws_lb",
          service: "Load balancer",
        },
      ],
    };

    await addComment(
      octomock,
      context,
      "Bambaz",
      ".",
      results,
      changes,
      10000,
      2000,
      false,
      false,
      false,
      true,
      alarmCoverage,
    );

    const body = octomock.rest.issues.createComment.mock.calls[0][0].body;
    expect(body).toContain(
      "**⚠️ &nbsp; Alarm coverage:** `2 of 3 new resources have no alarms`",
    );
    expect(body).toContain("| `aws_sqs_queue.jobs` | SQS |");
    expect(body).toContain("| `module.api.aws_lb.this` | Load balancer |");
    // the table must be separated from the preceding block to render
    expect(body).toContain("\n\n**⚠️ &nbsp; Alarm coverage:** the following");
  });

  test("report full alarm coverage without listing resources", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "Hello there" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "" },
    };
    const changes = { isChanges: false, isDeletes: false, resources: {} };

    await addComment(
      octomock,
      context,
      "Bambaz",
      ".",
      results,
      changes,
      10000,
      2000,
      false,
      false,
      false,
      true,
      { hasGaps: false, total: 4, covered: [], uncovered: [] },
    );

    const body = octomock.rest.issues.createComment.mock.calls[0][0].body;
    expect(body).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 4 new resources covered`",
    );
    expect(body).not.toContain("| Resource | Service |");
  });

  test("hide conftest details if outputs is empty", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: {
        isSuccess: false,
        output: "format-error.tf\nnot a doctor\nsome-other-file.tf",
      },
      plan: { isSuccess: false, output: "Hello there" },
      conftest: { isSuccess: false, output: "" },
    };
    const changes = {};
    const comment = `<!-- terraform-plan: Bambaz::. -->
## Bambaz
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**❌ &nbsp; Terraform Format:** \`failed\`
**❌ &nbsp; Terraform Plan:** \`failed\`
**❌ &nbsp; Conftest:** \`failed\` 

**🧹 &nbsp; Format:** run \`terraform fmt\` to fix the following: 
\`\`\`sh
format-error.tf
some-other-file.tf
\`\`\`
<details>
<summary>Show plan</summary>

\`\`\`terraform
Hello there
\`\`\`

</details>

`;

    await addComment(octomock, context, "Bambaz", ".", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: comment,
    });
  });

  test("don't render plan if skip-plan is true", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: {
        isSuccess: true,
        output: "",
      },
      plan: {},
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      {},
      1000,
      1000,
      false,
      true,
    );
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: comment,
    });
  });

  test("don't render format results if skip-fmt is true", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "< General Kenobi >" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 0,
        delete: 0,
        create: 1,
        import: 0,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
\`\`\`terraform
Plan: 1 to add, 0 to change, 0 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


<details>
<summary>Show plan</summary>

\`\`\`terraform
< Hello there >
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
< General Kenobi >
\`\`\`

</details>
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10000,
      10000,
      true,
      false,
    );
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

  test("add a truncated plan comment", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSucces: true, output: "" },
      conftest: { isSuccess: true, output: "< General Kenobi >" },
    };
    const changes = {
      isChanges: true,
      isDeletes: true,
      resources: {
        update: 0,
        delete: 0,
        create: 1,
        import: 0,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::. -->
## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
**✅ &nbsp; Terraform Plan:** \`success\`
**✅ &nbsp; Conftest:** \`success\` 

**⚠️ &nbsp; Warning:** resources will be destroyed by this change!
\`\`\`terraform
Plan: 1 to add, 0 to change, 0 to destroy
\`\`\`

<details>
<summary>Show summary</summary>



</details>


**✂ &nbsp; Warning:** plan has been truncated! See the [full plan in the logs](https://github.com/foo/bar/actions/runs/42).
<details>
<summary>Show plan</summary>

\`\`\`terraform
< Hello...
\`\`\`

</details>

<details>
<summary>Show Conftest results</summary>

\`\`\`sh
< General Kenobi >
\`\`\`

</details>
`;

    await addComment(
      octomock,
      context,
      "Foobar",
      ".",
      results,
      changes,
      10,
      10000,
      false,
      false,
    );
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

  test("add a comment with a non-root directory in the marker", async () => {
    const results = {
      init: { isSuccess: true, output: "" },
      validate: { isSuccess: true, output: "" },
      fmt: { isSuccess: true, output: "" },
      plan: { isSuccess: true, output: "< Hello there >" },
      summary: { isSuccess: true, output: "" },
      conftest: { isSuccess: true, output: "" },
    };
    const changes = {
      isChanges: true,
      isDeletes: false,
      resources: {
        update: 0,
        delete: 0,
        create: 1,
        import: 0,
      },
    };
    const comment = `<!-- terraform-plan: Foobar::environments/prod -->\n## Foobar\n**✅ &nbsp; Terraform Init:** \`success\`\n**✅ &nbsp; Terraform Validate:** \`success\`\n**✅ &nbsp; Terraform Format:** \`success\`\n**✅ &nbsp; Terraform Plan:** \`success\`\n**✅ &nbsp; Conftest:** \`success\` \n\n\`\`\`terraform\nPlan: 1 to add, 0 to change, 0 to destroy\n\`\`\`\n\n<details>\n<summary>Show summary</summary>\n\n\n\n</details>\n\n\n<details>\n<summary>Show plan</summary>\n\n\`\`\`terraform\n< Hello there >\n\`\`\`\n\n</details>\n\n`;

    await addComment(
      octomock,
      context,
      "Foobar",
      "environments/prod",
      results,
      changes,
      10000,
      10000,
      false,
      false,
    );
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
});

describe("cleanFormatOutput", () => {
  test("does not change output that is just filenames", () => {
    const output = "one.tf\n/path/to/two.tf\n/longer/path/to/three.tf";
    expect(cleanFormatOutput(output)).toBe(output);
  });

  test("removes non-filename output", () => {
    const output = "one.tf\ntceci est un test\n/longer/path/to/three.tf";
    expect(cleanFormatOutput(output)).toBe("one.tf\n/longer/path/to/three.tf");
  });

  test("returns blank if no filenames", () => {
    const output =
      "not a filename.tf   with spaces\nnor this being a filename\ncertainly not this either";
    expect(cleanFormatOutput(output)).toBe("");
  });
});

describe("deleteComment", () => {
  test("delete an existing bot comment", async () => {
    await deleteComment(octomock, context, "Foobar", ".");
    expect(octomock.paginate.mock.calls.length).toBe(1);
    expect(octomock.paginate.mock.calls[0][0]).toBe(
      octomock.rest.issues.listComments,
    );
    expect(octomock.paginate.mock.calls[0][1]).toEqual({
      issue_number: 42,
      owner: "foo",
      repo: "bar",
      per_page: 100,
    });
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls[0][0]).toEqual({
      comment_id: 1,
      owner: "foo",
      repo: "bar",
    });
  });
  test("do nothing for non-bot comments", async () => {
    await deleteComment(octomock, context, "Bort", ".");
    expect(octomock.paginate.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(0);
  });
  test("delete a bot comment matching a non-root directory", async () => {
    octomock.paginate.mockResolvedValueOnce([
      {
        id: 10,
        body: "<!-- terraform-plan: Foobar::environments/prod -->\n## Foobar",
        user: { type: "Bot" },
      },
      {
        id: 11,
        body: "<!-- terraform-plan: Foobar::. -->\n## Foobar",
        user: { type: "Bot" },
      },
    ]);
    await deleteComment(octomock, context, "Foobar", "environments/prod");
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls[0][0]).toEqual({
      comment_id: 10,
      owner: "foo",
      repo: "bar",
    });
  });
  test("do not delete a bot comment with same title but different directory", async () => {
    octomock.paginate.mockResolvedValueOnce([
      {
        id: 11,
        body: "<!-- terraform-plan: Foobar::. -->\n## Foobar",
        user: { type: "Bot" },
      },
    ]);
    await deleteComment(octomock, context, "Foobar", "environments/prod");
    expect(octomock.paginate.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(0);
  });
  test("delete all duplicate bot comments left by previous runs", async () => {
    octomock.paginate.mockResolvedValueOnce([
      {
        id: 20,
        body: "<!-- terraform-plan: Foobar::. -->\n## Foobar",
        user: { type: "Bot" },
      },
      {
        id: 21,
        body: "<!-- terraform-plan: Bort::. -->\n## Bort",
        user: { type: "Bot" },
      },
      {
        id: 22,
        body: "<!-- terraform-plan: Foobar::. -->\n## Foobar",
        user: { type: "Bot" },
      },
    ]);
    await deleteComment(octomock, context, "Foobar", ".");
    expect(octomock.rest.issues.deleteComment.mock.calls.length).toBe(2);
    expect(
      octomock.rest.issues.deleteComment.mock.calls.map(
        (call) => call[0].comment_id,
      ),
    ).toEqual([20, 22]);
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

    Terraform will perform the following actions:

    Changes to Outputs:
      foo=bar`;
    const expected = `Resource actions are indicated with the following symbols:

    + create  
    ~ update in-place
    - destroy

    Terraform will perform the following actions:

    Changes to Outputs:
      foo=bar`;
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

  test("remove refresh for plan with only output changes", async () => {
    const plan = `aws_lambda_permission.api: Refreshing state... [id=AllowAPIGatewayInvoke]
    aws_api_gateway_integration.integration: Refreshing state... [id=agi]

    Changes to Outputs:
      + scan_websites_kms_key_arn = "arn:aws:kms:ca-central-1:12345:key/67890"

    You can apply this plan to save these new output values to the Terraform
    state, without changing any real infrastructure.`;
    const expected = `Changes to Outputs:
      + scan_websites_kms_key_arn = "arn:aws:kms:ca-central-1:12345:key/67890"

    You can apply this plan to save these new output values to the Terraform
    state, without changing any real infrastructure.`;
    expect(removeRefreshOutput(plan)).toBe(expected);
  });

  test("remove refresh for plan with only moved changes", async () => {
    const plan = `aws_lambda_permission.api: Refreshing state... [id=AllowAPIGatewayInvoke]
    aws_api_gateway_integration.integration: Refreshing state... [id=agi]

    Terraform will perform the following actions:

      # aws_ecr_lifecycle_policy.superset_docs has moved to aws_ecr_lifecycle_policy.superset_docs_test
        resource "aws_ecr_lifecycle_policy" "superset_docs_test" {
            id          = "cds-superset-docs"
            # (3 unchanged attributes hidden)
        }

    Plan: 0 to add, 0 to change, 0 to destroy.`;
    const expected = `Terraform will perform the following actions:

      # aws_ecr_lifecycle_policy.superset_docs has moved to aws_ecr_lifecycle_policy.superset_docs_test
        resource "aws_ecr_lifecycle_policy" "superset_docs_test" {
            id          = "cds-superset-docs"
            # (3 unchanged attributes hidden)
        }

    Plan: 0 to add, 0 to change, 0 to destroy.`;
    expect(removeRefreshOutput(plan)).toBe(expected);
  });

  test("no change if start tokens do not exist", async () => {
    const plan = `This is a string without any plan start tokens
    for good measure, there's a line break in the mix`;
    expect(removeRefreshOutput(plan)).toBe(plan);
  });
});

describe("alarm warning for a Terraform plan", () => {
  // These tests run a plan through the real `getAlarmCoverage` and into the
  // rendered comment, so they check the warning a reviewer actually sees.

  const createdBy = (address, type) => ({
    address: address,
    mode: "managed",
    type: type,
    name: address.split(".").pop(),
    provider_name: "registry.terraform.io/hashicorp/aws",
    change: { actions: ["create"], before: null, after: {} },
  });

  const metricAlarm = (name, references) => ({
    address: `aws_cloudwatch_metric_alarm.${name}`,
    mode: "managed",
    type: "aws_cloudwatch_metric_alarm",
    name: name,
    expressions: {
      alarm_name: { constant_value: name },
      namespace: { constant_value: "AWS/ApplicationELB" },
      metric_name: { constant_value: "HTTPCode_ELB_5XX_Count" },
      dimensions: { references: references },
    },
  });

  const plan = (resourceChanges, configResources = [], moduleCalls = {}) => ({
    format_version: "1.2",
    terraform_version: "1.9.5",
    resource_changes: resourceChanges,
    configuration: {
      root_module: { resources: configResources, module_calls: moduleCalls },
    },
  });

  const results = {
    init: { isSuccess: true, output: "" },
    validate: { isSuccess: true, output: "" },
    fmt: { isSuccess: true, output: "" },
    plan: { isSuccess: true, output: "Terraform will perform the following" },
    summary: { isSuccess: true, output: "" },
    conftest: { isSuccess: true, output: "" },
  };

  const changes = {
    isChanges: true,
    isDeletes: false,
    resources: { create: 3, update: 0, delete: 0, import: 0, move: 0 },
  };

  /**
   * Renders the PR comment for a plan and returns its body.
   * @param {Object} planJson Terraform plan JSON
   * @param {Object} [options] `alarms` flag and `ignore` list
   * @returns {Promise<string>} Rendered comment body
   */
  const commentFor = async (planJson, options = {}) => {
    const { alarms = true, ignore = [] } = options;
    const coverage = getAlarmCoverage(planJson, { ignore: ignore });
    await addComment(
      octomock,
      context,
      "Production: alb",
      "environments/production",
      results,
      changes,
      10000,
      2000,
      false,
      false,
      false,
      alarms,
      coverage,
    );
    return octomock.rest.issues.createComment.mock.calls[0][0].body;
  };

  test("warn about a new load balancer that has no alarm", async () => {
    const body = await commentFor(
      plan(
        [
          createdBy("aws_lb.this", "aws_lb"),
          createdBy("aws_lb_listener.https", "aws_lb_listener"),
          createdBy("aws_security_group.alb", "aws_security_group"),
        ],
        [
          {
            address: "aws_lb.this",
            mode: "managed",
            type: "aws_lb",
            name: "this",
            expressions: { name: { constant_value: "app" } },
          },
        ],
      ),
    );

    expect(body).toContain(
      "**⚠️ &nbsp; Alarm coverage:** `1 of 1 new resources have no alarms`",
    );
    expect(body).toContain("| Resource | Service |");
    expect(body).toContain("| `aws_lb.this` | Load balancer |");
    // resources that emit no CloudWatch metrics are not part of the count
    expect(body).not.toContain("aws_lb_listener.https");
    expect(body).not.toContain("aws_security_group.alb");
  });

  test("no warning when the plan also creates the alarm", async () => {
    const body = await commentFor(
      plan(
        [
          createdBy("aws_lb.this", "aws_lb"),
          createdBy(
            "aws_cloudwatch_metric_alarm.alb_5xx",
            "aws_cloudwatch_metric_alarm",
          ),
        ],
        [
          {
            address: "aws_lb.this",
            mode: "managed",
            type: "aws_lb",
            name: "this",
            expressions: { name: { constant_value: "app" } },
          },
          metricAlarm("alb_5xx", ["aws_lb.this.arn_suffix", "aws_lb.this"]),
        ],
      ),
    );

    expect(body).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 1 new resources covered`",
    );
    expect(body).not.toContain("| Resource | Service |");
  });

  test("warn about only the uncovered resource in a mixed plan", async () => {
    const body = await commentFor(
      plan(
        [
          createdBy("aws_lambda_function.api", "aws_lambda_function"),
          createdBy("aws_sqs_queue.jobs", "aws_sqs_queue"),
        ],
        [
          metricAlarm("lambda_errors", [
            "aws_lambda_function.api.function_name",
          ]),
        ],
      ),
    );

    expect(body).toContain(
      "**⚠️ &nbsp; Alarm coverage:** `1 of 2 new resources have no alarms`",
    );
    expect(body).toContain("| `aws_sqs_queue.jobs` | SQS |");
    expect(body).not.toContain("| `aws_lambda_function.api` |");
  });

  test("report success when a plan creates nothing alarmable", async () => {
    const body = await commentFor(
      plan([
        createdBy("aws_s3_bucket.assets", "aws_s3_bucket"),
        createdBy("aws_iam_role.task", "aws_iam_role"),
      ]),
    );

    expect(body).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 0 new resources covered`",
    );
    expect(body).not.toContain("| Resource | Service |");
  });

  test("no warning for services that are not alarm checked", async () => {
    const body = await commentFor(
      plan([
        createdBy("aws_instance.bastion", "aws_instance"),
        createdBy("aws_autoscaling_group.workers", "aws_autoscaling_group"),
        createdBy("aws_opensearch_domain.logs", "aws_opensearch_domain"),
        createdBy("aws_elasticsearch_domain.old", "aws_elasticsearch_domain"),
        createdBy("aws_msk_cluster.events", "aws_msk_cluster"),
        createdBy("aws_redshift_cluster.warehouse", "aws_redshift_cluster"),
      ]),
    );

    expect(body).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 0 new resources covered`",
    );
    expect(body).not.toContain("| Resource | Service |");
  });

  test("warn once for a resource created with count", async () => {
    const body = await commentFor(
      plan([
        createdBy("aws_sqs_queue.jobs[0]", "aws_sqs_queue"),
        createdBy("aws_sqs_queue.jobs[1]", "aws_sqs_queue"),
      ]),
    );

    expect(body).toContain(
      "**⚠️ &nbsp; Alarm coverage:** `1 of 1 new resources have no alarms`",
    );
    expect(body.match(/\| `aws_sqs_queue\.jobs` \| SQS \|/g)).toHaveLength(1);
  });

  test("no warning when an alarm inside a module covers the resource", async () => {
    const body = await commentFor(
      plan(
        [
          createdBy(
            "module.api.aws_dynamodb_table.sessions[0]",
            "aws_dynamodb_table",
          ),
        ],
        [],
        {
          api: {
            module: {
              resources: [
                metricAlarm("throttles", ["aws_dynamodb_table.sessions.name"]),
              ],
            },
          },
        },
      ),
    );

    expect(body).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 1 new resources covered`",
    );
  });

  test("no warning for a resource on the ignore list", async () => {
    const planJson = plan([
      createdBy("aws_sqs_queue.jobs", "aws_sqs_queue"),
      createdBy("aws_efs_file_system.uploads", "aws_efs_file_system"),
    ]);

    const warned = await commentFor(planJson);
    expect(warned).toContain("| `aws_sqs_queue.jobs` | SQS |");
    expect(warned).toContain("| `aws_efs_file_system.uploads` | EFS |");

    jest.clearAllMocks();

    const ignored = await commentFor(planJson, {
      ignore: ["aws_sqs_queue", "aws_efs_file_system.uploads"],
    });
    expect(ignored).toContain(
      "**✅ &nbsp; Alarm coverage:** `all 0 new resources covered`",
    );
    expect(ignored).not.toContain("| Resource | Service |");
  });

  test("no alarm output at all when the check is turned off", async () => {
    const body = await commentFor(plan([createdBy("aws_lb.this", "aws_lb")]), {
      alarms: false,
    });

    expect(body).not.toContain("Alarm coverage");
    expect(body).not.toContain("| Resource | Service |");
    // the rest of the comment is unaffected
    expect(body).toContain("**✅ &nbsp; Terraform Plan:** `success`");
  });
});
