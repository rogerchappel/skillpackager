# Changelog

## Unreleased

- Reject backtick fence openers whose info strings contain a backtick while
  preserving CommonMark tilde-fence behavior.
- Record current generation timestamp (`new Date().toISOString()`) in report
  `manifest.generatedAt`.
- Document CommonMark level-two heading boundary semantics and preservation of
  level-three and deeper subsections within section bodies.
- Exclude closed and unclosed Markdown HTML comments from section parsing and
  readiness checks while preserving surrounding visible declarations.
- Added a committed npm lockfile and switched CI and contributor workflows to
  reproducible `npm ci` installs.
- Require meaningful bodies for required skill sections and scope example and
  safety checks to their relevant sections.
- Reject missing or unsupported `--format` values with a usage error.

## 0.1.0

- Initial local-first skill packaging readiness CLI.
- Added public package metadata for the repository, issue tracker, homepage, license, and supported Node.js version.
- Added a conservative npm `files` allowlist and a package smoke test that verifies packed runtime files and CLI entrypoints.
- Added `release:check` and CI coverage for syntax checks, tests, good and failing fixture smokes, and npm pack dry-run verification.
