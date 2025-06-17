# Terraform Plan GitHub Action
Runs `terraform plan` on your project and posts a comment with the changes on a Pull Request (PR).  It runs the following commands:
```sh
terraform init
terraform validate
terraform fmt --check
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan 
```
This action **does not** install [Terraform](https://github.com/hashicorp/terraform), [Terragrunt](https://github.com/gruntwork-io/terragrunt) or [TF Summarize](https://github.com/dineshba/tf-summarize), but these can be installed using the [CDS Terraform tools setup action](https://github.com/cds-snc/terraform-tools-setup).  You can see how it's used in the [pr-test.yaml workflow](.github/workflows/pr-test.yaml).

# Settings
Use the following to control the action:

| Setting          |      Description                                                   |  Default     |
|------------------|--------------------------------------------------------------------|--------------|
| `allow-failure`  | Allow the action to fail                                           | false        |
| `comment`        | Add comment with changes to the PR                                 | true         |
| `comment-delete` | Delete previous comments made by the bot on the PR                 | false        |
| `comment-title`  | The title to give the PR comment                                   | Plan changes |
| `conftest-character-limit` | Character limit for Conftest output                      | 2000         |
| `conftest-checks`| Location of custom conftest check definitions                      | git::https://github.com/cds-snc/opa_checks.git//aws_terraform |
| `directory`      | Directory with the `*.tf` files to validate                        | .            |
| `github-token`   | GitHub Token used to add comment to PR (required to add comments). |              |
| `plan-character-limit` | Character limit for Terraform plan output                    | 30000        |
| `terraform-init` | Custom Terraform init args                                         |              |
| `terraform-plan` | Custom Terraform plan args                                         |              |
| `terragrunt`     | Use Terragrunt instead of Terraform                                | false        |
| `skip-conftest`  | Skip the Conftest step                                             | false        |
| `skip-fmt`       | Skip the Terraform format check                                    | false        |
| `skip-plan`      | Skip the Terraform plan for projects without a remote state        | false        |
| `init-run-all`   | Run init across all modules (only applicable for terragrunt).      | false        |


# Examples
```yaml
# Prep
# Setup Terraform, Terragrunt, TF Sumamry and Conftest
- name: Setup terraform tools
  uses: cds-snc/terraform-tools-setup@v1

# Example 1
# Run Terraform plan and add a comment with changes on the PR
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Example 2
# Use Terragrunt, allow failure and set a custom PR comment title
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    allow-failure: true
    comment-title: Custom comment title
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terragrunt: true

# Example 3
# Run on a sub project folder, deleting previous PR comments made by the action
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    directory: ./infra
    comment-delete: true
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Example 4
# Run Terraform plan with no PR comment
# Plan will still availabe in the workflow logs
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    add-comment: false

# Example 5
# Run Terraform plan custom Terraform init args
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terraform-init: |
      -backend-config="bucket=your-state-bucket-name"
      -backend-config="region=ca-central-1"

# Example 6
# Run Terraform plan custom Terraform plan args
- name: Terraform plan with variable file
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terraform-plan: |
      -var-file="path/to/terraform.tfvars"
```

# Contributing
To setup your local dev environment:
```sh
npm install
npm run prepare
```
Husky provides a pre-commit hook that builds the `dist/index.js` used by the action.  To test locally, [nektos/act](https://github.com/nektos/act) works well.

# Policy
[Open Policy Agent](https://www.openpolicyagent.org/) is used to check the `terraform plan` for changes.  [Policies](./policy) are written in Rego and then compiled into a WebAssembly module using `npm run policy`.
