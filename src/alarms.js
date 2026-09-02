"use strict";

/**
 * AWS resource types that emit CloudWatch metrics and are therefore
 * candidates for alarm coverage, mapped to the service name shown in the
 * PR comment.
 */
const ALARM_CAPABLE_RESOURCES = {
  aws_alb: "Load balancer",
  aws_alb_target_group: "Load balancer",
  aws_api_gateway_stage: "API Gateway",
  aws_apigatewayv2_stage: "API Gateway",
  aws_cloudfront_distribution: "CloudFront",
  aws_db_instance: "RDS",
  aws_docdb_cluster: "DocumentDB",
  aws_dynamodb_table: "DynamoDB",
  aws_ecs_service: "ECS",
  aws_efs_file_system: "EFS",
  aws_elasticache_cluster: "ElastiCache",
  aws_elasticache_replication_group: "ElastiCache",
  aws_kinesis_firehose_delivery_stream: "Kinesis Firehose",
  aws_kinesis_stream: "Kinesis",
  aws_lambda_function: "Lambda",
  aws_lb: "Load balancer",
  aws_lb_target_group: "Load balancer",
  aws_nat_gateway: "NAT Gateway",
  aws_rds_cluster: "RDS",
  aws_rds_cluster_instance: "RDS",
  aws_sfn_state_machine: "Step Functions",
  aws_sqs_queue: "SQS",
  aws_wafv2_web_acl: "WAF",
};

/** Resource types that provide alarm coverage. */
const ALARM_RESOURCES = [
  "aws_cloudwatch_metric_alarm",
  "aws_cloudwatch_composite_alarm",
];

/**
 * Terraform expression prefixes that are not references to a managed
 * resource, so cannot establish alarm coverage.
 */
const NON_RESOURCE_PREFIXES = [
  "var",
  "local",
  "data",
  "module",
  "each",
  "count",
  "path",
  "self",
  "terraform",
];

/**
 * Strips `count`/`for_each` indexes so a plan address can be compared with a
 * configuration address, e.g. `module.api[0].aws_lb.this[1]` becomes
 * `module.api.aws_lb.this`.
 * @param {string} address Resource address
 * @returns {string} Address without indexes
 */
function normalizeAddress(address) {
  return address.replace(/\[[^\]]*\]/g, "");
}

/**
 * Converts a Terraform reference into the address of the resource it points
 * at, e.g. `aws_lambda_function.api.function_name` becomes
 * `aws_lambda_function.api`.  Returns null for references that do not point at
 * a managed resource (variables, locals, data sources, module outputs).
 * @param {string} reference Reference from the plan's configuration section
 * @returns {string|null} Resource address, or null
 */
function referenceToAddress(reference) {
  const parts = reference.split(".");
  if (parts.length < 2) {
    return null;
  }
  if (NON_RESOURCE_PREFIXES.includes(parts[0])) {
    return null;
  }
  if (!/^[a-z][a-z0-9_]*$/.test(parts[0])) {
    return null;
  }
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Recursively collects every `references` entry found in a configuration
 * expression tree.  Alarms reference their target from `dimensions`, but also
 * from `alarm_name`, `alarm_description` and provider-specific attributes, so
 * the whole tree is walked rather than a fixed set of keys.
 * @param {*} node Expression node from the plan configuration
 * @param {Set<string>} found Accumulator of reference strings
 */
function collectReferences(node, found) {
  if (node === null || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectReferences(item, found);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "references" && Array.isArray(value)) {
      for (const reference of value) {
        if (typeof reference === "string") {
          found.add(reference);
        }
      }
    } else {
      collectReferences(value, found);
    }
  }
}

/**
 * Walks the plan's configuration tree and returns the set of absolute resource
 * addresses referenced by CloudWatch alarms.
 *
 * Configuration addresses are module relative, so the module path is prefixed
 * as the tree is walked to produce addresses comparable with `resource_changes`.
 * @param {Object} module A configuration module node
 * @param {string} modulePath Absolute prefix for this module, e.g. `module.api.`
 * @param {Set<string>} covered Accumulator of covered resource addresses
 */
function collectAlarmTargets(module, modulePath, covered) {
  if (!module || typeof module !== "object") {
    return;
  }

  for (const resource of module.resources || []) {
    if (!ALARM_RESOURCES.includes(resource.type)) {
      continue;
    }
    const references = new Set();
    collectReferences(resource.expressions, references);
    for (const reference of references) {
      const address = referenceToAddress(reference);
      if (address) {
        covered.add(`${modulePath}${address}`);
      }
    }
  }

  for (const [name, call] of Object.entries(module.module_calls || {})) {
    collectAlarmTargets(call.module, `${modulePath}module.${name}.`, covered);
  }
}

/**
 * Returns true when a resource is excluded by the ignore list.  An entry
 * matches a resource type, an exact address, or a module path prefix.
 * @param {Object} resource Resource with `address` and `type`
 * @param {Array<string>} ignore Ignore list entries
 * @returns {boolean} True when the resource should be skipped
 */
function isIgnored(resource, ignore) {
  return ignore.some(
    (entry) =>
      entry === resource.type ||
      entry === resource.address ||
      resource.address.startsWith(`${entry}.`),
  );
}

/**
 * Examines a Terraform plan and reports which newly created resources have no
 * CloudWatch alarm pointing at them.
 *
 * Coverage is established from the plan's `configuration` section: a resource
 * is covered when an alarm in the same plan references it.  Only resources
 * being created are checked, since that is the change a reviewer can act on.
 *
 * @param {Object} planJson Terraform plan JSON object
 * @param {Object} [options] Options
 * @param {Array<string>} [options.ignore] Resource types or addresses to skip
 * @returns {{
 *   isChecked: boolean,
 *   hasGaps: boolean,
 *   total: number,
 *   covered: Array<{address: string, type: string, service: string}>,
 *   uncovered: Array<{address: string, type: string, service: string}>
 * }} Alarm coverage summary
 */
function getAlarmCoverage(planJson, options = {}) {
  const { ignore = [] } = options;

  const empty = {
    isChecked: true,
    hasGaps: false,
    total: 0,
    covered: [],
    uncovered: [],
  };

  if (!planJson || !Array.isArray(planJson.resource_changes)) {
    return empty;
  }

  const alarmTargets = new Set();
  if (planJson.configuration) {
    collectAlarmTargets(planJson.configuration.root_module, "", alarmTargets);
  }

  const seen = new Set();
  const covered = [];
  const uncovered = [];

  for (const change of planJson.resource_changes) {
    if (change.mode !== "managed") {
      continue;
    }
    if (!(change.change.actions || []).includes("create")) {
      continue;
    }
    const service = ALARM_CAPABLE_RESOURCES[change.type];
    if (!service) {
      continue;
    }

    const address = normalizeAddress(change.address);
    if (seen.has(address)) {
      continue;
    }
    seen.add(address);

    const resource = { address: address, type: change.type, service: service };
    if (isIgnored(resource, ignore)) {
      continue;
    }

    if (alarmTargets.has(address)) {
      covered.push(resource);
    } else {
      uncovered.push(resource);
    }
  }

  return {
    isChecked: true,
    hasGaps: uncovered.length > 0,
    total: covered.length + uncovered.length,
    covered: covered,
    uncovered: uncovered,
  };
}

module.exports = {
  ALARM_CAPABLE_RESOURCES: ALARM_CAPABLE_RESOURCES,
  getAlarmCoverage: getAlarmCoverage,
  normalizeAddress: normalizeAddress,
  referenceToAddress: referenceToAddress,
};
