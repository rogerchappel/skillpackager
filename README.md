# Skillpackager

Skillpackager is a local-first CLI for checking whether an agent skill directory is ready to package or review. It reads a candidate `SKILL.md`, docs, and fixtures, then emits a package manifest with a generation timestamp and validation report.

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

Reports require each named section to contain content. The `Examples` section
must contain a complete CommonMark backtick or tilde fence. A closing fence
must use the same character and at least as many delimiters as its opener;
shorter, mismatched, and unclosed fences fail validation. Dry-run or approval
language must appear in the boundary sections. Reports also check fixture and
docs presence and include a dry-run package plan.

Visible level-two CommonMark ATX headings may have zero to three leading spaces
and an optional closing sequence of `#` characters, such as
`   ## Validation ###`. Section parsing recognizes level-two headings (`##`)
as top-level section boundaries; level-three and deeper headings (`###`) within
a section are preserved as section body content. Level-two headings inside
backtick or tilde fenced code blocks are treated as example content, not
declarations. Required and safety sections must therefore appear as visible
level-two headings outside fenced examples. Backtick fence openers follow
CommonMark and are ignored when their info string contains a backtick; tilde
fence info strings may contain backticks. Content inside closed or unclosed
Markdown HTML comments is non-rendered and is also excluded from section
headings, bodies, examples, and safety checks; visible declarations before and
after comments remain eligible. Literal `<!--` and `-->` sequences inside
backtick code spans remain visible content and do not open or close comments;
the closing backtick run must match the opener length, including for spans that
use multiple backticks to contain a literal backtick. Matching code spans may
continue across line endings. Escaped or unclosed backtick runs do not shield
a genuine HTML comment. Section, comment, code-span, and fenced-example parsing
accepts LF, CRLF, and CR line endings with identical results.

The manifest describes the same files as the dry-run package plan: `files`,
`fileCount`, and `packagePlan.include` are derived from one sorted file list.
`generatedAt` records the ISO-8601 UTC timestamp of report generation.
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

The first release uses CommonMark level-two ATX headings for section
boundaries and a fixed required-section list (preserving level-three and deeper
subsections within section bodies). It does not yet support custom policy packs,
CI annotation output, or release comparison reports.

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
