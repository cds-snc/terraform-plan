"use strict";

const {
  getAlarmCoverage,
  normalizeAddress,
  referenceToAddress,
} = require("../src/alarms.js");

const alarmFor = (address, references) => ({
  address: address,
  type: "aws_cloudwatch_metric_alarm",
  expressions: { dimensions: { references: references } },
});

const created = (address, type) => ({
  address: address,
  mode: "managed",
  type: type,
  change: { actions: ["create"] },
});

describe("normalizeAddress", () => {
  test("strips resource and module indexes", () => {
    expect(normalizeAddress("aws_lb.this[0]")).toBe("aws_lb.this");
    expect(normalizeAddress('module.api[0].aws_lb.this["a"]')).toBe(
      "module.api.aws_lb.this",
    );
  });

  test("leaves plain addresses alone", () => {
    expect(normalizeAddress("module.api.aws_lb.this")).toBe(
      "module.api.aws_lb.this",
    );
  });
});

describe("referenceToAddress", () => {
  test("reduces an attribute reference to its resource", () => {
    expect(referenceToAddress("aws_lambda_function.api.function_name")).toBe(
      "aws_lambda_function.api",
    );
    expect(referenceToAddress("aws_sqs_queue.jobs")).toBe("aws_sqs_queue.jobs");
  });

  test("ignores references that are not managed resources", () => {
    for (const reference of [
      "var.name",
      "local.name",
      "data.aws_sqs_queue.jobs.name",
      "module.api.queue_name",
      "each.value",
      "count.index",
      "aws_sqs_queue",
    ]) {
      expect(referenceToAddress(reference)).toBe(null);
    }
  });
});

describe("getAlarmCoverage", () => {
  test("separates covered from uncovered resources", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [
        created("aws_lambda_function.api", "aws_lambda_function"),
        created("aws_sqs_queue.jobs", "aws_sqs_queue"),
      ],
      configuration: {
        root_module: {
          resources: [
            alarmFor("aws_cloudwatch_metric_alarm.errors", [
              "aws_lambda_function.api.function_name",
              "aws_lambda_function.api",
            ]),
          ],
        },
      },
    });

    expect(coverage.hasGaps).toBe(true);
    expect(coverage.total).toBe(2);
    expect(coverage.covered.map((r) => r.address)).toEqual([
      "aws_lambda_function.api",
    ]);
    expect(coverage.uncovered).toEqual([
      {
        address: "aws_sqs_queue.jobs",
        type: "aws_sqs_queue",
        service: "SQS",
      },
    ]);
  });

  test("matches alarms declared inside a module", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [
        created("module.api[0].aws_dynamodb_table.t[1]", "aws_dynamodb_table"),
      ],
      configuration: {
        root_module: {
          resources: [],
          module_calls: {
            api: {
              module: {
                resources: [
                  alarmFor("aws_cloudwatch_metric_alarm.throttles", [
                    "aws_dynamodb_table.t.name",
                  ]),
                ],
              },
            },
          },
        },
      },
    });

    expect(coverage.hasGaps).toBe(false);
    expect(coverage.covered.map((r) => r.address)).toEqual([
      "module.api.aws_dynamodb_table.t",
    ]);
  });

  test("only checks resources that are being created", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [
        {
          address: "aws_sqs_queue.updated",
          mode: "managed",
          type: "aws_sqs_queue",
          change: { actions: ["update"] },
        },
        {
          address: "aws_sqs_queue.destroyed",
          mode: "managed",
          type: "aws_sqs_queue",
          change: { actions: ["delete"] },
        },
        {
          address: "aws_sqs_queue.replaced",
          mode: "managed",
          type: "aws_sqs_queue",
          change: { actions: ["delete", "create"] },
        },
      ],
    });

    expect(coverage.uncovered.map((r) => r.address)).toEqual([
      "aws_sqs_queue.replaced",
    ]);
  });

  test("ignores data sources and resources without CloudWatch metrics", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [
        created("aws_s3_bucket.assets", "aws_s3_bucket"),
        created("aws_iam_role.task", "aws_iam_role"),
        {
          address: "data.aws_sqs_queue.jobs",
          mode: "data",
          type: "aws_sqs_queue",
          change: { actions: ["read"] },
        },
      ],
    });

    expect(coverage.total).toBe(0);
    expect(coverage.hasGaps).toBe(false);
  });

  test("does not count non-resource references as coverage", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [created("aws_sqs_queue.jobs", "aws_sqs_queue")],
      configuration: {
        root_module: {
          resources: [
            alarmFor("aws_cloudwatch_metric_alarm.depth", [
              "var.queue_name",
              "local.prefix",
              "module.other.queue",
            ]),
          ],
        },
      },
    });

    expect(coverage.uncovered.map((r) => r.address)).toEqual([
      "aws_sqs_queue.jobs",
    ]);
  });

  test("reports each resource once regardless of instance count", () => {
    const coverage = getAlarmCoverage({
      resource_changes: [
        created("aws_sqs_queue.jobs[0]", "aws_sqs_queue"),
        created("aws_sqs_queue.jobs[1]", "aws_sqs_queue"),
      ],
    });

    expect(coverage.uncovered).toHaveLength(1);
    expect(coverage.uncovered[0].address).toBe("aws_sqs_queue.jobs");
  });

  test("skips resources matched by the ignore list", () => {
    const plan = {
      resource_changes: [
        created("aws_sqs_queue.jobs", "aws_sqs_queue"),
        created("module.api.aws_lb.this", "aws_lb"),
        created("aws_dynamodb_table.t", "aws_dynamodb_table"),
      ],
    };

    expect(
      getAlarmCoverage(plan, { ignore: ["aws_sqs_queue"] }).uncovered.map(
        (r) => r.address,
      ),
    ).toEqual(["module.api.aws_lb.this", "aws_dynamodb_table.t"]);

    expect(
      getAlarmCoverage(plan, { ignore: ["module.api"] }).uncovered.map(
        (r) => r.address,
      ),
    ).toEqual(["aws_sqs_queue.jobs", "aws_dynamodb_table.t"]);

    expect(
      getAlarmCoverage(plan, {
        ignore: ["aws_dynamodb_table.t"],
      }).uncovered.map((r) => r.address),
    ).toEqual(["aws_sqs_queue.jobs", "module.api.aws_lb.this"]);
  });

  test("handles a plan with no resource changes", () => {
    expect(getAlarmCoverage({}).total).toBe(0);
    expect(getAlarmCoverage({ resource_changes: [] }).hasGaps).toBe(false);
  });
});
