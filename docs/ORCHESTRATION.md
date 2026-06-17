# Orchestration

Use Skillpackager after a skill repository has a first usable `SKILL.md` and fixtures.

## Inputs

- Path to a local skill directory.
- Optional output format, `json` or `markdown`.

## Workflow

1. Run `npm run build`.
2. Run `node bin/skillpackager.js <skill-dir> --format markdown`.
3. Review failed checks before creating a release-candidate PR.
4. Attach the report to PR notes when it helps reviewers.
5. Use `--strict` in scheduled automation so failed runs leave a short stderr breadcrumb.

## Side-effect boundary

The CLI only reads local files and writes to stdout. It does not publish packages, install skills, mutate repos, or call external services.

## Failure handling

Treat a failed report as a packaging readiness issue. Fix the skill or document why the missing section is intentional before release.
