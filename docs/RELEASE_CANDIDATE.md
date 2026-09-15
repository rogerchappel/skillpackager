# Release Candidate Notes

## Classification

Ship.

## Included

- Local CLI for skill package inspection.
- Deterministic JSON and Markdown reports.
- Required-section checks for agent skill safety and usability.
- Fixtures and tests for passing and failing skills.

## Verification

Run before release:

```bash
npm ci
npm run release:check
bash scripts/validate.sh
```

## 2026-06-17 verification

- `npm test`: pass
- `npm run check`: pass
- `npm run build`: pass
- `npm run smoke`: pass
- `bash scripts/validate.sh`: pass

## Known limits

- Fixed required-section list.
- Level-two headings (`##`) define section boundaries; level-three and deeper headings are preserved within section bodies.
- No publishing or install actions by design.
- No CI annotation format yet.
