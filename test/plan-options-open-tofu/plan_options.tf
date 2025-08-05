terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.7.0"
    }
  }
  required_version = ">= 1.0.0"
}

variable "byte_length" {
  type = number
}

resource "random_id" "id" {
  byte_length = var.byte_length
}

output "id" {
  value = random_id.id.hex
}
