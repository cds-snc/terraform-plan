terraform {
  required_version = ">= 1.0.0"
}

locals {
  secret_value = "custom-definitely-secret-value"
}

output "custom" {
  value = local.secret_value
}