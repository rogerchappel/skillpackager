# Skillpackager PRD

## Problem

Agent skill authors need a repeatable way to check whether a candidate skill is portable, safe to share, and complete enough for another agent to use locally.

## Goals

- Validate required `SKILL.md` sections.
- Generate a deterministic package manifest.
- Produce JSON and Markdown reports for review.
- Keep all behavior local-first and dry-run by default.

## Non-goals

- Publishing packages.
- Installing skills into an agent runtime.
- Calling external accounts or private workspaces.

## Users

- Agent builders preparing OSS skill repos.
- Reviewers checking skill readiness before release.
- Automation lanes that need machine-readable skill quality reports.

## Success criteria

- Fixture-backed tests pass with `npm test`.
- `npm run smoke` prints a Markdown report for a good skill fixture.
- Invalid fixtures return failed check IDs that point to missing sections or safety gaps.
