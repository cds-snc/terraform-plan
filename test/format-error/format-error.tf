terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.1.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "random_id" "id" {
    byte_length = 8
}
