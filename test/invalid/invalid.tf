terraform {
  required_providers {
    test = {
      source  = "hashicorp/random"
      version = "~> 3.7.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "random_id" "id" {
   muffin = "blueberry"
}
