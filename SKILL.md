# Skillpackager

Use this skill when an agent needs to check whether a local agent skill directory is ready to package, review, or share.

## When to use

- Before opening a release-candidate PR for a skill repo.
- When comparing whether a skill has clear triggers, safety notes, examples, and validation steps.
- When an automation lane needs a deterministic package report.

## Required tools

- Node.js 20 or newer.
- Local filesystem access to the candidate skill directory.
- No network access is required.

## Side-effect boundaries

Run the CLI in dry-run mode only. It reads local files and writes reports to stdout. It must not publish packages, install skills, mutate user files, or write to external accounts.

## Approval requirements

Human approval is required before publishing a package, installing a skill into a live agent, or changing repository release state. This project does not perform those actions.

## Examples

```bash
npm run build
node bin/skillpackager.js fixtures/good-skill --format markdown
node bin/skillpackager.js fixtures/bad-skill --format json
```

## Validation

Run `npm test`, `npm run check`, and `npm run smoke`. A passing package report should include all required sections and fixture evidence.
