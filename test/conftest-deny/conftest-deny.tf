terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.1.0"
    }
  }
  required_version = ">= 1.0.0"
}

provider "aws" {
  region = "ca-central-1"
}

resource "aws_iam_role" "role" {
  name               = "role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    sid     = "RDSAssume"
    effect  = "Bad"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}