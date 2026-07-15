# Skillpackager

Skillpackager is a local-first CLI for checking whether an agent skill directory is ready to package or review. It reads a candidate `SKILL.md`, docs, and fixtures, then emits a deterministic manifest and validation report.

## Quickstart

```bash
npm install
npm run build
node bin/skillpackager.js fixtures/good-skill --format markdown
```

## CLI

```bash
skillpackager <skill-dir> [--format json|markdown] [--strict]
skillpackager --help
skillpackager --version
```

The command exits with code `2` when packaging checks fail. Reports include required section checks, fixture presence, docs presence, safety language, and a dry-run package plan.

Use `--strict` in automation when stderr should include a compact failed-check count.

## Example

```bash
node bin/skillpackager.js fixtures/bad-skill --format json
```

Use the failed check IDs to decide what the skill needs before release.

## Safety notes

- Reads local files only.
- Writes reports to stdout only.
- Does not publish packages.
- Does not install skills into an agent runtime.
- Does not call external services.

## Limitations

The first release uses conventional Markdown headings and a fixed required-section list. It does not yet support custom policy packs, CI annotation output, or release comparison reports.

## Development

```bash
npm test
npm run check
npm run smoke
npm run package:smoke
npm run release:check
bash scripts/validate.sh
```

Use `npm run release:check` before publishing or opening a release PR.
