terraform {
required_providers {
scratch = {
  source = "BrendanThompson/scratch"
  version = "0.4.0"
}
}
required_version = ">= 1.0.0"
}

variable "testvar" {
  type = string
}

resource "scratch_string" "testarg" {

    in = var.testvar

    description = "Test variable"
}
