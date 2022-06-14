# Available Resource Config Formats

Auth0 resource state is expressed in two available different configuration file formats: YAML and JSON (aka “directory”). When using the Deploy CLI’s export command, you will be prompted with the choice of one versus the other.

## YAML

The YAML format is expressed mostly as a flat `tenant.yaml` file with supplemental code files for resources like actions and email templates. The single file makes tracking changes over time in version control more straightforward. Additionally, the single file eliminates a bit of ambiguity with directory and file names, which may not be immediately obvious.

## Directory (JSON)

The directory format separates resource types into separate directories, with each single resource living inside a dedicated JSON file. This format allows for easier conceptual separation between each type of resource as well as the individual resources themselves. Also, the Deploy CLI closely mirrors the data shapes defined in the [Auth0 Management API](https://auth0.com/docs/api/management/v2), so referencing the JSON examples in the docs may provide useful when using this format.

## How to Choose

The decision to select which format to use should be primarily made off of preference. Both formats are tenable solutions that achieve the same task, but with subtly different strengths and weaknesses described above. Be sure to evaluate each in the context of your context. Importantly, **this choice is not permanent**, and switching from one to the other via the import command is an option at your disposal.

---

[[table of contents]](../README.md#documentation)
