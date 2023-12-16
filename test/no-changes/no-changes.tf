terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
  required_version = ">= 1.0.0"
}
