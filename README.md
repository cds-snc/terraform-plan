# Terraform Plan GitHub Action
Runs `terraform plan` on your project and posts a comment with the changes on a Pull Request (PR).  It runs the following commands:
```sh
terraform init
terraform validate
terraform fmt --check
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan 
```
This action **does not** install Terraform or Terragrunt, but can be installed using [Terraform tools setup action](https://github.com/cds-snc/terraform-tools-setup).  You can see how it's used in the [pr-test.yaml workflow](.github/workflows/pr-test.yaml).

# Settings
Use the following to control the action:

| Setting          |      Description                                                   |  Default     |
|------------------|--------------------------------------------------------------------|--------------|
| `allow-failure`  | Allow the action to fail                                           | false        |
| `args`           | Additional arguments to pass to TF Plan                            |              |
| `comment`        | Add comment with changes to the PR                                 | true         |
| `comment-delete` | Delete previous comments made by the bot on the PR                 | false        |
| `comment-title`  | The title to give the PR comment                                   | Plan changes |
| `conftest-character-limit` | Character limit for Conftest output                      | 2000         |
| `conftest-checks`| Location of custom conftest check definitions                      | git::https://github.com/cds-snc/opa_checks.git//aws_terraform |
| `directory`      | Directory with the `*.tf` files to validate                        | .            |
| `github-token`   | GitHub Token used to add comment to PR (required to add comments). |              |
| `plan-character-limit` | Character limit for Terraform plan output                    | 30000        |
| `terraform-init` | Custom Terraform init args                                         |              |
| `terragrunt`     | Use Terragrunt instead of Terraform                                | false        |
| `skip-conftest`  | Skip the Conftest step                                             | false        |
| `skip-fmt`       | Skip the Terraform format check                                    | false        |
| `skip-plan`      | Skip the Terraform plan for projects without a remote state        | false        |


# Examples
```yaml
# Setup Terraform, Terragrunt, and Conftest
- name: Setup terraform tools
  uses: cds-snc/terraform-tools-setup@v1

# Run Terraform plan and add a comment with changes on the PR
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Run Terraform plan and add a comment with changes on the PR with additional arguments
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    args: -var-file /path/to/varfile

# Use Terragrunt, allow failure and set a custom PR comment title
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    allow-failure: true
    comment-title: Custom comment title
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terragrunt: true

# Run on a sub project folder, deleting previous PR comments made by the action
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    directory: ./infra
    comment-delete: true
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Run Terraform plan with no PR comment
# Plan will still availabe in the workflow logs
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    add-comment: false

# Run Terraform plan custom Terraform init args
- name: Terraform plan
  uses: cds-snc/terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terraform-init: |
      -backend-config="bucket=your-state-bucket-name"
      -backend-config="region=ca-central-1"
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
