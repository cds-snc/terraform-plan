resource "random_id" "id" {
  byte_length = 8
}

output "id" {
  value = random_id.id.hex
}