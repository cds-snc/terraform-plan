resource "random_id" "foo" {
  byte_length = 8
  keepers = {
    foo = var.bar
  }
}
