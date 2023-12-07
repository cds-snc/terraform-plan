"use strict";

const {
  addComment,
  cleanFormatOutput,
  deleteComment,
  removeRefreshOutput,
  commentTemplate,
} = require("../src/github.js");

const nunjucks = require("nunjucks");

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
  test("add a success comment with changes", async () => {
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
      },
    };
    const comment = `## Foobar
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
    const comment = `## Bambaz
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

    await addComment(octomock, context, "Bambaz", results, changes);
    expect(octomock.rest.issues.createComment.mock.calls.length).toBe(1);
    expect(octomock.rest.issues.createComment.mock.calls[0][0]).toEqual({
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: comment,
    });
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
    const comment = `## Bambaz
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

    await addComment(octomock, context, "Bambaz", results, changes);
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
    const comment = `## Foobar
**✅ &nbsp; Terraform Init:** \`success\`
**✅ &nbsp; Terraform Validate:** \`success\`
**✅ &nbsp; Terraform Format:** \`success\`
`;

    await addComment(
      octomock,
      context,
      "Foobar",
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
      },
    };
    const comment = `## Foobar
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
      },
    };
    const comment = `## Foobar
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

  test("no change if start tokens do not exist", async () => {
    const plan = `This is a string without any plan start tokens
    for good measure, there's a line break in the mix`;
    expect(removeRefreshOutput(plan)).toBe(plan);
  });
});
