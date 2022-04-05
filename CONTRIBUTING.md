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

## Publishing

Publishing to NPM has 2 different processes. Production process is automated by creating a git tag on master.

Publishing the beta should be done manually:

```sh
npm run build
npm publish --tag beta
```
