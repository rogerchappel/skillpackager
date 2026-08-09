import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { failedCheckHints, inspectSkill, packageVersion, parseSections, runCli, toMarkdown } from '../src/index.js';

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

  it('rejects empty required sections and misplaced safety and example content', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/empty-sections-skill'));
    assert.equal(report.summary.ok, false);
    assert.deepEqual(report.summary.failedIds, [
      'section:when-to-use',
      'section:required-tools',
      'section:side-effect-boundaries',
      'section:approval-requirements',
      'section:examples',
      'section:validation',
      'examples:code-block',
      'safety:dry-run'
    ]);
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

  it('prints the package version for release smoke checks', async () => {
    let stdout = '';
    await runCli(['--version'], {
      cwd: root,
      stdout: { write: (chunk) => { stdout += chunk; } },
      stderr: { write: () => {} }
    });
    assert.equal(stdout, `${await packageVersion()}\n`);
  });

  it('accepts each documented output format', () => {
    const json = runBin(['fixtures/good-skill', '--format', 'json']);
    assert.equal(json.status, 0);
    assert.doesNotThrow(() => JSON.parse(json.stdout));

    const markdown = runBin(['fixtures/good-skill', '--format', 'markdown']);
    assert.equal(markdown.status, 0);
    assert.match(markdown.stdout, /^# Skill Package Report/m);
  });

  it('rejects unsupported and missing output format values', () => {
    for (const args of [
      ['fixtures/good-skill', '--format', 'yaml'],
      ['fixtures/good-skill', '--format']
    ]) {
      const result = runBin(args);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /--format requires one of: json, markdown/);
      assert.match(result.stderr, /Usage: skillpackager/);
    }
  });

  it('rejects unknown options with a usage error', () => {
    for (const args of [
      ['--bogus'],
      ['fixtures/good-skill', '--bogus'],
      ['--bogus', 'fixtures/good-skill']
    ]) {
      const result = runBin(args);
      assert.equal(result.status, 64);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /Unknown option: --bogus/);
      assert.match(result.stderr, /Usage: skillpackager/);
    }
  });

  it('rejects surplus positional arguments with a usage error', () => {
    const result = runBin(['fixtures/good-skill', 'extra']);
    assert.equal(result.status, 64);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unexpected argument: extra/);
    assert.match(result.stderr, /Usage: skillpackager/);
  });

  it('accepts documented options in any order', () => {
    for (const args of [
      ['--format', 'markdown', '--strict', 'fixtures/good-skill'],
      ['--strict', 'fixtures/good-skill', '--format', 'markdown'],
      ['fixtures/good-skill', '--strict', '--format', 'markdown']
    ]) {
      const result = runBin(args);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /^# Skill Package Report/m);
      assert.equal(result.stderr, '');
    }

    assert.match(runBin(['--help']).stdout, /Usage: skillpackager/);
    assert.match(runBin(['--strict', '--help']).stdout, /Usage: skillpackager/);
    assert.match(runBin(['--format', 'json', '--version']).stdout, /^\d+\.\d+\.\d+\n$/);
  });
});

function runBin(args) {
  return spawnSync(process.execPath, ['bin/skillpackager.js', ...args], {
    cwd: root,
    encoding: 'utf8'
  });
}
