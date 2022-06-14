# How to Contribute

While we may not prioritize some issues and feature requests, we are much more inclined to address them if accompanied with a code contribution. Please feel empowered to make a code contribution through a Github pull request. Please read the following for the best contributor experience.

## Getting started with development

The only requirement for development is having [node](https://nodejs.dev/) installed. Most modern versions will work but LTS is recommended.

Once node is installed, fork the Deploy CLI repository. Once code is downloaded to local development machine, run the following commands:

```shell
npm install # Installs all dependencies
npm run dev # Runs compiler, continuously observes source file changes
```

## Running tests

In order to run the entire test suite, execute `npm run test`.

To run a single test file or single test execute:

```shell
npx ts-mocha --timeout=5000 -p tsconfig.json <PATH_TO_TEST_FILE> -g=<OPTIONAL_NAME_OF_TEST>
```

### Examples

```shell
# Runs all tests within a file
npx ts-mocha --timeout=5000 -p tsconfig.json test/tools/auth0/handlers/actions.tests.js

# Runs a single test within a file
npx ts-mocha --timeout=5000 -p tsconfig.json \
test/tools/auth0/handlers/actions.tests.js \
-g="should create action"
```

## Code Contribution Checklist

Before finally submitting a PR, please ensure to complete the following:

- [ ] All code written in Typescript and compiles
- [ ] Accompanying tests for functional changes
- [ ] Any necessary documentation changes to pages in the /docs directory
- [ ] PR includes thorough description about what code does and why it was added

---

[[table of contents]](../README.md#documentation)
