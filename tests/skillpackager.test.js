import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChecks, buildManifest, failedCheckHints, inspectSkill, packageVersion, parseSections, runCli, toMarkdown } from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectories = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('skillpackager', () => {
  it('parses markdown sections', () => {
    const sections = parseSections('# Title\n\n## When to use\n\nNow\n\n## Validation\n\nLater');
    assert.deepEqual(sections.map((section) => section.title), ['When to use', 'Validation']);
  });

  it('parses indented and closed CommonMark level-two headings', () => {
    const markdown = [
      '# Title',
      '   ## When to use',
      '',
      'Now',
      '## Validation ###',
      '',
      'Later',
      '```markdown',
      '   ## Required tools ###',
      '```'
    ].join('\n');

    const sections = parseSections(markdown);
    assert.deepEqual(sections.map((section) => section.title), ['When to use', 'Validation']);
    assert.equal(sections[0].body, 'Now');
    assert.match(sections[1].body, /Later/);
  });

  it('ignores level-two headings inside variable-length backtick and tilde fences', () => {
    const markdown = [
      '# Title',
      '````markdown',
      '## Required tools',
      '```',
      '````',
      '~~~markdown',
      '## Approval requirements',
      '~~~~',
      '## When to use',
      '',
      'Visible guidance.',
      '## Validation',
      '',
      'Visible validation.'
    ].join('\n');

    const sections = parseSections(markdown);
    assert.deepEqual(sections.map((section) => section.title), ['When to use', 'Validation']);
    assert.equal(sections[0].body, 'Visible guidance.');
  });

  it('ignores headings and content inside closed and unclosed HTML comments', () => {
    const markdown = [
      '# Title',
      '## When to use',
      'Visible before.',
      '<!-- ## Required tools',
      'Hidden tools. -->',
      'Visible after.',
      '## Validation',
      'Visible validation.',
      '<!-- ## Approval requirements',
      'Hidden through end.'
    ].join('\n');

    const sections = parseSections(markdown);
    assert.deepEqual(sections.map((section) => section.title), ['When to use', 'Validation']);
    assert.equal(sections[0].body, 'Visible before.\n\n\nVisible after.');
    assert.equal(sections[1].body, 'Visible validation.');
  });

  it('preserves visible declarations surrounding HTML comments', () => {
    const markdown = [
      '## Side-effect boundaries',
      'Reads local files only.',
      '<!-- Performs external writes. -->',
      'No external writes.',
      '## Approval requirements',
      '<!-- Approval requirements are unknown. -->',
      'No approval is required.'
    ].join('\n');

    const sections = parseSections(markdown);
    assert.equal(sections[0].body, 'Reads local files only.\n\nNo external writes.');
    assert.equal(sections[1].body, 'No approval is required.');
  });

  it('preserves HTML comment markers as visible content inside fenced code', () => {
    const markdown = [
      '## Examples',
      '```html',
      '<!-- an unclosed example comment',
      '```',
      '## Validation',
      'Visible validation.'
    ].join('\n');

    const sections = parseSections(markdown);
    assert.deepEqual(sections.map((section) => section.title), ['Examples', 'Validation']);
    assert.match(sections[0].body, /<!-- an unclosed example comment/);
    assert.equal(sections[1].body, 'Visible validation.');
  });

  it('CLI rejects required and safety declarations that exist only in fenced examples', async () => {
    const skillDir = await createFencedHeadingCandidate();
    const result = runBin([skillDir]);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.summary.failedIds, [
      'section:when-to-use',
      'section:required-tools',
      'section:side-effect-boundaries',
      'section:approval-requirements',
      'section:validation',
      'safety:side-effects',
      'safety:approval'
    ]);
    assert.deepEqual(report.manifest.sections, ['Examples']);
  });

  it('CLI rejects comment-hidden declarations mixed with visible placeholders', async () => {
    const skillDir = await createHtmlCommentCandidate();
    const result = runBin([skillDir]);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.summary.failedIds, [
      'section:when-to-use',
      'section:required-tools',
      'section:validation',
      'safety:side-effects',
      'safety:approval'
    ]);
    assert.deepEqual(report.manifest.sections, [
      'When to use',
      'Required tools',
      'Side-effect boundaries',
      'Approval requirements',
      'Examples',
      'Validation'
    ]);
  });

  it('CLI accepts a complete skill using indented and closed headings', async () => {
    const skillDir = await createCommonMarkHeadingCandidate();
    const result = runBin([skillDir]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.ok, true);
    assert.deepEqual(report.manifest.sections, [
      'When to use',
      'Required tools',
      'Side-effect boundaries',
      'Approval requirements',
      'Examples',
      'Validation'
    ]);
  });

  it('passes a complete skill fixture', async () => {
    const report = await inspectSkill(path.join(root, 'fixtures/good-skill'));
    assert.equal(report.summary.ok, true);
    assert.equal(report.summary.failed, 0);
    assert.equal(report.manifest.packagePlan.dryRunOnly, true);
    assert.notEqual(report.manifest.generatedAt, '1970-01-01T00:00:00.000Z');
    assert.match(report.manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const date = new Date(report.manifest.generatedAt);
    assert.ok(Number.isFinite(date.getTime()));
    assert.ok(date.getTime() > 1700000000000);
  });

  it('keeps manifests and package plans aligned with deterministic exclusions', async () => {
    const skillDir = await createPackageCandidate();
    const first = await inspectSkill(skillDir);
    const second = await inspectSkill(skillDir);
    const included = ['SKILL.md', 'docs/README.md', 'fixtures/case.txt'];

    assert.deepEqual(first.manifest.files, included);
    assert.equal(first.manifest.fileCount, included.length);
    assert.deepEqual(first.manifest.packagePlan.include, included);
    assert.deepEqual(
      { ...second, manifest: { ...second.manifest, generatedAt: first.manifest.generatedAt } },
      first
    );
    assert.doesNotMatch(JSON.stringify(first), /\.git|node_modules|coverage|\.cache/);
    assert.deepEqual(
      toMarkdown(second).match(/## Package Plan[\s\S]*/)?.[0],
      '## Package Plan\n\n- SKILL.md\n- docs/README.md\n- fixtures/case.txt\n'
    );
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
      'safety:side-effects',
      'safety:approval'
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

  it('rejects unresolved and negated safety declarations', () => {
    const cases = [
      ['unknown', 'Side effects are unknown.', 'Approval requirements are unknown.'],
      ['TBD', 'TBD', 'To be determined.'],
      ['missing', '', ''],
      ['undocumented', 'No external effects are documented.', 'Approval is not documented.'],
      ['negated', 'This skill does not support dry-run mode.', 'Approval is not yet defined.']
    ];

    for (const [name, sideEffects, approval] of cases) {
      const sections = safetySections(sideEffects, approval);
      const checks = buildChecks({ sections, files: [], skillText: '', requiredSections: [] });
      assert.equal(checks.find((check) => check.id === 'safety:side-effects').ok, false, name);
      assert.equal(checks.find((check) => check.id === 'safety:approval').ok, false, name);
      assert.deepEqual(buildManifest({ root, files: [], sections }).sideEffects, ['unknown'], name);
    }
  });

  it('accepts affirmative safety declarations', () => {
    const cases = [
      ['dry-run', 'Runs in dry-run mode.', 'Ask for user approval before changing files.'],
      ['no-external', 'Performs no external writes.', 'No approval is required.'],
      ['local-only', 'Reads local files only.', 'Approval is required for account changes.']
    ];

    for (const [name, sideEffects, approval] of cases) {
      const sections = safetySections(sideEffects, approval);
      const checks = buildChecks({ sections, files: [], skillText: '', requiredSections: [] });
      assert.equal(checks.find((check) => check.id === 'safety:side-effects').ok, true, name);
      assert.equal(checks.find((check) => check.id === 'safety:approval').ok, true, name);
      assert.deepEqual(buildManifest({ root, files: [], sections }).sideEffects, ['local-filesystem-read'], name);
    }
  });

  it('CLI exits 2 and reports actionable safety ids for a completed unresolved candidate', () => {
    const result = runBin(['fixtures/unresolved-safety-skill']);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.ok, false);
    assert.ok(report.summary.failedIds.includes('safety:side-effects'));
    assert.ok(report.summary.failedIds.includes('safety:approval'));
    assert.deepEqual(report.manifest.sideEffects, ['unknown']);
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

function safetySections(sideEffects, approval) {
  return [
    { title: 'Side-effect boundaries', body: sideEffects },
    { title: 'Approval requirements', body: approval }
  ];
}

async function createPackageCandidate() {
  const skillDir = await mkdtemp(path.join(os.tmpdir(), 'skillpackager-candidate-'));
  temporaryDirectories.push(skillDir);
  const files = {
    'SKILL.md': '# Candidate\n\n## When to use\n\nNow\n',
    'docs/README.md': 'Documentation\n',
    'fixtures/case.txt': 'fixture\n',
    '.git/config': '[core]\n',
    'node_modules/pkg/index.js': 'export default true;\n',
    'coverage/index.html': '<h1>coverage</h1>\n',
    '.cache/result.json': '{}\n'
  };
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(skillDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return skillDir;
}

async function createFencedHeadingCandidate() {
  const skillDir = await mkdtemp(path.join(os.tmpdir(), 'skillpackager-fenced-headings-'));
  temporaryDirectories.push(skillDir);
  const skill = [
    '# Candidate',
    '````markdown',
    '## When to use',
    'Example-only use.',
    '## Required tools',
    'Example-only tools.',
    '## Side-effect boundaries',
    'No external writes.',
    '## Approval requirements',
    'No approval is required.',
    '## Validation',
    'Example-only validation.',
    '````',
    '## Examples',
    '```sh',
    'echo visible-example',
    '```',
    ''
  ].join('\n');
  const files = {
    'SKILL.md': skill,
    'docs/README.md': 'Documentation\n',
    'fixtures/case.txt': 'fixture\n'
  };
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(skillDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return skillDir;
}

async function createCommonMarkHeadingCandidate() {
  const skillDir = await mkdtemp(path.join(os.tmpdir(), 'skillpackager-commonmark-headings-'));
  temporaryDirectories.push(skillDir);
  const skill = [
    '# Candidate',
    '   ## When to use',
    'Use for packaging skills.',
    '## Required tools ###',
    'Use local Node.js.',
    '   ## Side-effect boundaries ###',
    'Runs in dry-run mode.',
    '## Approval requirements',
    'No approval is required.',
    '   ## Examples ###',
    '```sh',
    'skillpackager .',
    '```',
    '## Validation ###',
    'Run the release checks.',
    '````markdown',
    '   ## Required tools ###',
    'Fenced lookalike.',
    '````',
    ''
  ].join('\n');
  const files = {
    'SKILL.md': skill,
    'docs/README.md': 'Documentation\n',
    'fixtures/case.txt': 'fixture\n'
  };
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(skillDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return skillDir;
}

async function createHtmlCommentCandidate() {
  const skillDir = await mkdtemp(path.join(os.tmpdir(), 'skillpackager-html-comments-'));
  temporaryDirectories.push(skillDir);
  const skill = [
    '# Candidate',
    '<!--',
    '## When to use',
    'Hidden use.',
    '## Required tools',
    'Hidden tools.',
    '## Side-effect boundaries',
    'No external writes.',
    '## Approval requirements',
    'No approval is required.',
    '## Validation',
    'Hidden validation.',
    '-->',
    '## When to use',
    '<!-- Hidden body. -->',
    '## Required tools',
    '<!-- Hidden body. -->',
    '## Side-effect boundaries',
    'TBD <!-- No external writes. -->',
    '## Approval requirements',
    'TBD <!-- No approval is required. -->',
    '## Examples',
    '```sh',
    'echo visible-example',
    '```',
    '## Validation',
    '<!-- unclosed hidden body',
    ''
  ].join('\n');
  const files = {
    'SKILL.md': skill,
    'docs/README.md': 'Documentation\n',
    'fixtures/case.txt': 'fixture\n'
  };
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(skillDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return skillDir;
}
