# Changelog

## 0.1.0

- Initial local-first skill packaging readiness CLI.
- Added public package metadata for the repository, issue tracker, homepage, license, and supported Node.js version.
- Added a conservative npm `files` allowlist and a package smoke test that verifies packed runtime files and CLI entrypoints.
- Added `release:check` and CI coverage for syntax checks, tests, good and failing fixture smokes, and npm pack dry-run verification.
