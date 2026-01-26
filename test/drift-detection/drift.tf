terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.8.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "random_integer" "drift_example_one" {
  min = 1
  max = 100
}

resource "random_integer" "drift_example_two" {
  min = 1
  max = 100
}

resource "random_integer" "drift_example_three" {
  min = 1
  max = 100
}

