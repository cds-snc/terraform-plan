# Terraform Plan GitHub Action
Runs the following commands in order on a Pull Request (PR).  If changes or errors are found during the plan it adds a comment to the PR:
```sh
terraform init
terraform validate
terraform fmt --check
terraform plan
```
This action **does not** install Terraform or Terragrunt.  You can see how it's used in the [test.yaml workflow](.github/workflows/test.yaml).

# Settings
Use the following to control the action:

| Setting          |      Description                                   |  Default     |
|------------------|----------------------------------------------------|--------------|
| `allow-failure`  | Allow the action to fail                           | false        |
| `comment`        | Add comment with changes to the PR                 | true         |
| `comment-delete` | Delete previous comments made by the bot on the PR | false        |
| `comment-title`  | The title to give the PR comment                   | Plan changes |
| `directory`      | Directory with the *.tf files to validate          | .            |
| `github-token`   | GitHub Token used to add comment to PR             |              |
| `terragrunt`     | Use Terragrunt instead of Terraform                | false        |

# Examples
```yaml
# Run Terraform plan and add a comment with changes on the PR
- name: Terraform plan
  uses: cds-snc/action-terraform-plan
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Use Terragrunt, allow failure and set a custom PR comment title
- name: Terraform plan
  uses: cds-snc/action-terraform-plan
  with:
    allow-failure: true
    comment-title: Custom comment title
    github-token: ${{ secrets.GITHUB_TOKEN }}
    terragrunt: true

# Run on a sub project folder, deleting previous PR comments made by the action
- name: Terraform plan
  uses: cds-snc/action-terraform-plan
  with:
    directory: ./infra
    comment-delete: true
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Run Terraform plan with no PR comment
# Plan will still be availabe in the workflow logs
- name: Terraform plan
  uses: cds-snc/action-terraform-plan
  with:
    add-comment: false
```

# Contributing
To setup your local dev environment:
```sh
npm install
npm run prepare
```
Husky provides a pre-commit hook that builds the `dist/index.js` used by the action.  To test locally, [nektos/act](https://github.com/nektos/act) works well.