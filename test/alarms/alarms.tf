terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0.0"
}

provider "aws" {
  region = "ca-central-1"
}

# Covered: the plan also creates an alarm that points at this table.
resource "aws_dynamodb_table" "covered" {
  name         = "terraform-plan-test-alarms-covered"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    CostCentre = "terraform-plan-test"
    Terraform  = "true"
  }
}

resource "aws_cloudwatch_metric_alarm" "covered_throttles" {
  alarm_name          = "terraform-plan-test-alarms-covered-throttles"
  namespace           = "AWS/DynamoDB"
  metric_name         = "ThrottledRequests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  threshold           = 0

  dimensions = {
    TableName = aws_dynamodb_table.covered.name
  }

  tags = {
    CostCentre = "terraform-plan-test"
    Terraform  = "true"
  }
}

# Uncovered: no alarm references this queue, so the PR comment must warn.
resource "aws_sqs_queue" "uncovered" {
  name = "terraform-plan-test-alarms-uncovered"

  tags = {
    CostCentre = "terraform-plan-test"
    Terraform  = "true"
  }
}
