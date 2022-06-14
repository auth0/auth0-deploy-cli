# Auth0 Terraform Provider

The Deploy CLI is not the only tool available for managing your Auth0 tenant configuration, there is also an [officially supported Terraform Provider](https://github.com/auth0/terraform-provider-auth0). [Terraform](https://terraform.io/) is a third-party tool for representing your cloud resources’s configurations as code. It has an established plug-in framework that supports a wide array of cloud providers, including Auth0.

Both the Deploy CLI and Terraform Provider exist to help you manage your Auth0 tenant configurations, but each has their own set of pros and cons.

You may want to consider the Auth0 Terraform Provider if:

- Your development workflows already leverages Terraform
- Your tenant management needs are granular or only pertain to a few specific resources

You may **not** want to consider the Auth0 Terraform Provider if:

- Your development workflow does not use Terraform, requiring extra setup upfront
- Your development workflows are primarily concerned with managing your tenants in bulk
- Your tenant has lots of existing resources, may require significant effort to “import”

---

[[table of contents]](../README.md#documentation)
