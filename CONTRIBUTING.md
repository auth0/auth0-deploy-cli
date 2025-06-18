# Contributing to Auth0 Deploy CLI

Thank you for your interest in contributing! This guide will help you get started with contributing to the Auth0 Deploy CLI project.

## Getting Started

### Prerequisites

- Node.js ≥20.18.1
- Git with signed commits configured
- Auth0 Development Tenant (for testing)

### Fork and Clone

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/auth0-deploy-cli.git
   cd auth0-deploy-cli
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/auth0/auth0-deploy-cli.git
   ```

### Development Setup

```bash
# Install dependencies
npm ci
```

## Development Workflow

### Create Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout master
git merge upstream/master

# Create feature branch
git checkout -b feature/your-feature-name
```

### Development Commands

```bash
# Development with watch mode
npm run dev

# Run tests
npm test

# Run single test file
npx ts-mocha test/path/to/specific.test.ts

# Lint and format
npm run lint:fix
npm run format

# Check TypeScript compilation
npx tsc --noEmit

# Run CLI locally for testing
npm run build && node lib/index.js --help
```

### Testing Requirements

Before submitting a PR, ensure all tests pass:

```bash
# Unit tests (required)
npm test
```

### Testing Your Changes Locally

To test your changes with the actual CLI:

```bash
# Build the project
npm run build

# Run CLI commands locally
node lib/index.js --help
node lib/index.js export --help
node lib/index.js import --help

# Example: Test export command
node lib/index.js export -c config.json -f yaml -o ./local-export/

# Example: Test import command
node lib/index.js import -c config.json -i ./local-export/tenant.yaml
```

### Running Individual Tests

To run a single test file or specific test:

```bash
# Run all tests in a file
npx ts-mocha --timeout=7500 -p tsconfig.json test/tools/auth0/handlers/actions.tests.js

# Run a specific test by name
npx ts-mocha --timeout=7500 -p tsconfig.json \
  test/tools/auth0/handlers/actions.tests.js \
  -g="should create action"
```

## Code Standards

- **ESLint** (Airbnb base configuration)
- **Prettier** formatting (100 character line width)
- **Comprehensive test coverage** for new functionality
- **JSDoc comments** for public APIs

## Pull Request Process

1. **Ensure your branch is up to date** with upstream master
2. **Run all tests** and ensure they pass
3. **Create PR** against the `master` branch
4. **Fill out the PR template** completely:
   - Clear description of changes
   - Link to related issues
   - Testing approach
   - Complete the checklist
5. **Address code review feedback**
6. **Ensure CI checks pass**

### PR Requirements

- ✅ All CI checks pass
- ✅ Code review approved
- ✅ Tests added/updated for new functionality
- ✅ Documentation updated (if applicable)
- ✅ No merge conflicts
- ✅ Signed commits

## Commits

All commits should be signed to enhance security, authorship, trust and compliance.

[About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)

## Versioning

Versioning is managed by npm. Npm versioning will execute scripts that uses kacl to manage the CHANGELOG.

Ensure that before running the versioning scripts below, the Unreleased changelog is updated.

### Production Versioning

```sh
npm version patch --no-git-tag-version
```

### Beta Versioning

```sh
npm version prerelease --preid beta --no-git-tag-version
```

## Getting Help

- **Documentation**: Check the [docs/](./docs/) directory for detailed guides
- **Issues**: Search [existing issues](https://github.com/auth0/auth0-deploy-cli/issues) before creating new ones
- **Community**: Visit the [Auth0 Community](https://community.auth0.com/) for general questions
- **Security**: Report security vulnerabilities through [Auth0's responsible disclosure program](https://auth0.com/responsible-disclosure-policy)

## Code of Conduct

This project follows [Auth0's Code of Conduct](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md). By participating, you agree to uphold this code.
