"use strict";

const { buildPrompt, parseResponse, summarizePlan } = require("../src/ai.js");

const mockFetch = (status, content) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status === 200,
    status: status,
    json: async () => ({ choices: [{ message: { content: content } }] }),
  });
};

afterEach(() => {
  delete global.fetch;
});

describe("summarizePlan", () => {
  test("posts the plan to the chat completions API and parses the reply", async () => {
    mockFetch(
      200,
      '```json\n{"risk_level": "high", "summary": "Replaces the database."}\n```',
    );

    const result = await summarizePlan({
      baseUrl: "https://litellm.example.com/v1/",
      apiKey: "sk-test",
      model: "gpt-test",
      plan: "Terraform will perform the following actions:\n  # aws_db_instance.main must be replaced",
      summary: "| CHANGE | RESOURCE |",
    });

    expect(result).toEqual({
      riskLevel: "HIGH",
      summary: "Replaces the database.",
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://litellm.example.com/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("gpt-test");
    expect(body.messages[1].content).toContain(
      "aws_db_instance.main must be replaced",
    );
  });

  test("throws on an HTTP error", async () => {
    mockFetch(401, "");
    await expect(
      summarizePlan({
        baseUrl: "https://x",
        apiKey: "k",
        model: "m",
        plan: "",
        summary: "",
      }),
    ).rejects.toThrow("HTTP 401");
  });
});

describe("parseResponse", () => {
  test("rejects responses without a valid risk level and summary", () => {
    expect(parseResponse("not json")).toBeNull();
    expect(parseResponse('{"risk_level": "UNKNOWN", "summary": "x"}')).toBe(
      null,
    );
    expect(parseResponse('{"risk_level": "LOW"}')).toBeNull();
  });

  test("neutralizes @mentions in the summary", () => {
    const result = parseResponse(
      '{"risk_level": "LOW", "summary": "Ping @cds-snc/team"}',
    );
    expect(result.summary).toBe("Ping @​cds-snc/team");
  });
});

describe("buildPrompt", () => {
  test("strips refresh output and truncates long plans", () => {
    const plan =
      "aws_s3_bucket.a: Refreshing state...\nTerraform will perform the following actions:\n" +
      "x".repeat(200000);
    const prompt = buildPrompt(plan, "summary");
    expect(prompt).not.toContain("Refreshing state");
    expect(prompt.length).toBeLessThan(151000);
    expect(prompt).toContain("The plan was truncated.");
  });
});
