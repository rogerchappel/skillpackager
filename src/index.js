import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  'When to use',
  'Required tools',
  'Side-effect boundaries',
  'Approval requirements',
  'Examples',
  'Validation'
];

export { REQUIRED_SECTIONS };

export async function inspectSkill(skillDir) {
  const root = path.resolve(skillDir);
  const skillPath = path.join(root, 'SKILL.md');
  const skillText = await readFile(skillPath, 'utf8');
  const files = await listFiles(root);
  const sections = parseSections(skillText);
  const checks = buildChecks({ sections, files, skillText, requiredSections: REQUIRED_SECTIONS });
  return {
    skillDir: root,
    manifest: buildManifest({ root, files, sections }),
    checks,
    summary: summarize(checks)
  };
}

export function parseSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return {
      title: match[1].trim(),
      body: markdown.slice(start, end).trim()
    };
  });
}

export function buildChecks({ sections, files, skillText, requiredSections = REQUIRED_SECTIONS }) {
  const sectionTitles = new Set(sections.map((section) => section.title.toLowerCase()));
  const checks = requiredSections.map((section) => ({
    id: `section:${slug(section)}`,
    ok: sectionTitles.has(section.toLowerCase()),
    message: `SKILL.md includes "${section}"`
  }));

  checks.push({
    id: 'examples:code-block',
    ok: /```/.test(skillText),
    message: 'Examples include a fenced block'
  });
  checks.push({
    id: 'fixtures:present',
    ok: files.some((file) => file.startsWith('fixtures/')),
    message: 'Fixture files are included'
  });
  checks.push({
    id: 'docs:present',
    ok: files.some((file) => file.startsWith('docs/')),
    message: 'Documentation files are included'
  });
  checks.push({
    id: 'safety:dry-run',
    ok: /dry[- ]run|no external|approval/i.test(skillText),
    message: 'Skill describes dry-run or approval boundaries'
  });
  return checks;
}

export function buildManifest({ root, files, sections }) {
  return {
    name: path.basename(root),
    generatedAt: new Date(0).toISOString(),
    entrypoint: 'SKILL.md',
    fileCount: files.length,
    files,
    sections: sections.map((section) => section.title),
    sideEffects: inferSideEffects(sections),
    packagePlan: {
      dryRunOnly: true,
      include: files.filter((file) => !file.includes('node_modules'))
    }
  };
}

export function toMarkdown(report) {
  const status = report.summary.ok ? 'pass' : 'fail';
  const lines = [
    `# Skill Package Report`,
    '',
    `Status: ${status}`,
    '',
    `Skill: ${report.manifest.name}`,
    '',
    '## Checks',
    ''
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.ok ? '[x]' : '[ ]'} ${check.id}: ${check.message}`);
  }
  lines.push('', '## Package Plan', '');
  for (const file of report.manifest.packagePlan.include) {
    lines.push(`- ${file}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function runCli(argv, io) {
  const args = parseArgs(argv);
  if (args.help || !args.skillDir) {
    io.stdout.write(usage());
    return;
  }
  const report = await inspectSkill(path.resolve(io.cwd, args.skillDir));
  const output = args.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : toMarkdown(report);
  io.stdout.write(output);
  if (!report.summary.ok) {
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const args = { format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') args.help = true;
    else if (value === '--format') args.format = argv[++index] ?? 'json';
    else if (!args.skillDir) args.skillDir = value;
  }
  return args;
}

function usage() {
  return `Usage: skillpackager <skill-dir> [--format json|markdown]\n`;
}

async function listFiles(root, prefix = '') {
  const dir = path.join(root, prefix);
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry);
    const info = await stat(path.join(root, relative));
    if (info.isDirectory()) {
      files.push(...await listFiles(root, relative));
    } else {
      files.push(relative.replaceAll(path.sep, '/'));
    }
  }
  return files.sort();
}

function inferSideEffects(sections) {
  const boundary = sections.find((section) => section.title.toLowerCase() === 'side-effect boundaries');
  if (!boundary) return ['unknown'];
  if (/no external|dry[- ]run|local/i.test(boundary.body)) return ['local-filesystem-read'];
  return ['review-required'];
}

function summarize(checks) {
  const failed = checks.filter((check) => !check.ok);
  return {
    ok: failed.length === 0,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedIds: failed.map((check) => check.id)
  };
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
