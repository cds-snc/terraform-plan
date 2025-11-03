terraform {
  required_version = ">= 1.0.0"
}

locals {
  secret_value = "gcntfy-1234567890123456789012345678901234567890"
}

output "id" {
  value = local.secret_value
}