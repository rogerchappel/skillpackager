import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { failedCheckHints, inspectSkill, parseSections, toMarkdown } from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('skillpackager', () => {
  it('parses markdown sections', () => {
    const sections = parseSections('# Title\n\n## When to use\n\nNow\n\n## Validation\n\nLater');
    assert.deepEqual(sections.map((section) => section.title), ['When to use', 'Validation']);
  });

  it('passes a complete skill fixture', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/good-skill'));
    assert.equal(report.summary.ok, true);
    assert.equal(report.summary.failed, 0);
    assert.equal(report.manifest.packagePlan.dryRunOnly, true);
  });

  it('fails an incomplete skill fixture with actionable ids', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/bad-skill'));
    assert.equal(report.summary.ok, false);
    assert.ok(report.summary.failedIds.includes('section:required-tools'));
    assert.ok(report.summary.failedIds.includes('examples:code-block'));
  });

  it('renders markdown reports', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/good-skill'));
    const markdown = toMarkdown(report);
    assert.match(markdown, /Status: pass/);
    assert.match(markdown, /fixtures\/evidence\.txt/);
  });

  it('returns failed check hints for reviewers', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/bad-skill'));
    assert.ok(failedCheckHints(report).some((hint) => hint.startsWith('section:required-tools')));
  });
});
