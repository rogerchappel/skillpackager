# Skillpackager

Skillpackager is a local-first CLI for checking whether an agent skill directory is ready to package or review. It reads a candidate `SKILL.md`, docs, and fixtures, then emits a deterministic manifest and validation report.

## Quickstart

```bash
npm ci
npm run build
node bin/skillpackager.js fixtures/good-skill --format markdown
```

## CLI

```bash
skillpackager <skill-dir> [--format json|markdown] [--strict]
skillpackager --help
skillpackager --version
```

The command exits with code `2` when packaging checks fail. It exits with code
`64` and prints usage when an option is unknown, an extra positional argument
is supplied, or `--format` is missing a value or is not `json` or `markdown`.

Reports require each named section to contain content. The fenced example must
appear inside `Examples`, and dry-run or approval language must appear in the
boundary sections. Reports also check fixture and docs presence and include a
dry-run package plan.

Level-two headings inside backtick or tilde fenced code blocks are treated as
example content, not declarations. Required and safety sections must therefore
appear as visible headings outside fenced examples.

The manifest describes the same files as the dry-run package plan: `files`,
`fileCount`, and `packagePlan.include` are derived from one sorted file list.
Skill source such as `SKILL.md` and files beneath `docs/` and `fixtures/` is
included. Repository, dependency, cache, and coverage trees named `.git`,
`node_modules`, `.cache`, or `coverage` are excluded at any depth.

Use `--strict` in automation when stderr should include a compact failed-check count.

## Example

```bash
node bin/skillpackager.js fixtures/bad-skill --format json
```

Use the failed check IDs to decide what the skill needs before release.

### Safety declaration contract

The `Side-effect boundaries` and `Approval requirements` sections must each make a resolved, affirmative declaration. Side-effect boundaries can state that the skill is dry-run only, reads local files only, performs no named external effects (for example, no external writes or network calls), or requires review or approval for external effects. Approval requirements must say when approval is required or explicitly state that no approval is required.

Placeholders and uncertainty such as `unknown`, `TBD`, missing text, `not documented`, or `not specified` fail with `safety:side-effects` and/or `safety:approval`. Merely mentioning a token is not enough: negated text such as “does not support dry-run” also fails. Failed CLI reports retain these IDs in `summary.failedIds` and exit with code `2`.

## Safety notes

- Reads local files only.
- Writes reports to stdout only.
- Does not publish packages.
- Does not install skills into an agent runtime.
- Does not call external services.

## Limitations

The first release uses conventional level-two Markdown headings and a fixed
required-section list. It does not yet support custom policy packs, CI
annotation output, or release comparison reports.

## Development

Install the locked dependencies from a fresh checkout before running the
development and release checks:

```bash
npm ci
npm test
npm run check
npm run smoke
npm run package:smoke
npm run release:check
bash scripts/validate.sh
```

Use `npm run release:check` before publishing or opening a release PR.
