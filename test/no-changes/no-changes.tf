terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.9.0"
    }
  }
  required_version = ">= 1.0.0"
}
