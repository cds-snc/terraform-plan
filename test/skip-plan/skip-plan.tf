terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.8.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "random_id" "id" {
  byte_length = 8
}

output "id" {
  value = random_id.id.hex
}