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


resource "aws_cloudwatch_log_group" "topic" {
  name              = "topic"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "controltower-notificationforwarder" {
  name              = "/aws/lambda/aws-controltower-NotificationForwarder"
  retention_in_days = 14
}

import {
  to = aws_cloudwatch_log_group.controltower-notificationforwarder
  id = "/aws/lambda/aws-controltower-NotificationForwarder"
}

resource "aws_sns_topic" "controltower-notificationforwarder" {
  name = "internal-sre-alert"
  tags = {
    "CostCentre" = "SRE"
    "Terraform"  = "true"
    "managed_by" = "AFT"
  }
}

import {
  to = aws_sns_topic.controltower-notificationforwarder
  id = "arn:aws:sns:ca-central-1:124044056575:internal-sre-alert"
}

