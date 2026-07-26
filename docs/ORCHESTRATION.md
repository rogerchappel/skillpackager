# Orchestration

Use Skillpackager after a skill repository has a first usable `SKILL.md` and fixtures.

## Inputs

- Path to a local skill directory.
- Optional `--format` value: exactly `json` or `markdown` (defaults to `json`).

## Workflow

1. Run `npm run build`.
2. Run `node bin/skillpackager.js <skill-dir> --format markdown`.
3. Review failed checks before creating a release-candidate PR.
4. Attach the report to PR notes when it helps reviewers.
5. Use `--strict` in scheduled automation so failed runs leave a short stderr breadcrumb.

## Side-effect boundary

The CLI only reads local files and writes to stdout. It does not publish packages, install skills, mutate repos, or call external services.

## Failure handling

Treat a failed report as a packaging readiness issue. Required headings need
nonempty bodies, fenced examples belong in the `Examples` body, and affirmative
dry-run or approval language belongs in the boundary sections. Fix the skill or
document why the failed check is intentional before release.

An unsupported or missing `--format` value is a CLI usage error and does not
produce a report.
