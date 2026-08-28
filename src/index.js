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
const EXCLUDED_DIRECTORIES = new Set(['.cache', '.git', 'coverage', 'node_modules']);

export { REQUIRED_SECTIONS };

export async function packageVersion() {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  return packageJson.version;
}

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
  const visibleMarkdown = maskHtmlComments(markdown);
  const matches = [];
  let fence = null;
  for (const match of visibleMarkdown.matchAll(/^.*(?:\n|$)/gm)) {
    const line = match[0].replace(/\n$/, '');
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.character
        && fenceMatch[1].length >= fence.length && /^\s*$/.test(fenceMatch[2])) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    const heading = line.match(/^ {0,3}##(?:[ \t]+(.*?))?[ \t]*$/);
    if (heading) {
      const title = (heading[1] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim();
      if (title) matches.push({ index: match.index, 0: line, 1: title });
    }
  }
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? visibleMarkdown.length;
    return {
      title: match[1].trim(),
      body: visibleMarkdown.slice(start, end).replace(/^[ \t]+$/gm, '').trim()
    };
  });
}

function maskHtmlComments(markdown) {
  let inComment = false;
  let fence = null;
  let masked = '';
  for (const match of markdown.matchAll(/^.*(?:\n|$)/gm)) {
    const line = match[0];
    if (fence) {
      masked += line;
      const closingFence = line.match(/^ {0,3}(`{3,}|~{3,})(?:[ \t]*\n?)$/);
      if (closingFence && closingFence[1][0] === fence[0] && closingFence[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    let visibleLine = '';
    let cursor = 0;
    while (cursor < line.length) {
      if (inComment) {
        const closing = line.indexOf('-->', cursor);
        const end = closing === -1 ? line.length : closing + 3;
        visibleLine += line.slice(cursor, end).replace(/[^\n]/g, ' ');
        cursor = end;
        inComment = closing === -1;
        continue;
      }
      const start = line.indexOf('<!--', cursor);
      if (start === -1) {
        visibleLine += line.slice(cursor);
        break;
      }
      visibleLine += line.slice(cursor, start);
      cursor = start;
      inComment = true;
    }
    masked += visibleLine;
    const openingFence = visibleLine.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) fence = openingFence[1];
  }
  return masked;
}

export function buildChecks({ sections, files, skillText, requiredSections = REQUIRED_SECTIONS }) {
  const sectionsByTitle = new Map(
    sections.map((section) => [section.title.toLowerCase(), section])
  );
  const checks = requiredSections.map((title) => {
    const section = sectionsByTitle.get(title.toLowerCase());
    return {
      id: `section:${slug(title)}`,
      ok: Boolean(section?.body.trim()),
      message: section
        ? `SKILL.md section "${title}" includes meaningful content`
        : `SKILL.md includes section "${title}"`
    };
  });
  const examples = sectionsByTitle.get('examples');
  const sideEffectBody = sectionsByTitle.get('side-effect boundaries')?.body;
  const approvalBody = sectionsByTitle.get('approval requirements')?.body;

  checks.push({
    id: 'examples:code-block',
    ok: /```[\s\S]*?```/.test(examples?.body ?? ''),
    message: 'Examples section includes a complete fenced block'
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
    id: 'safety:side-effects',
    ok: hasResolvedSideEffectDeclaration(sideEffectBody),
    message: 'Side-effect boundaries affirm dry-run, local-only, or explicit external-effect limits'
  });
  checks.push({
    id: 'safety:approval',
    ok: hasResolvedApprovalDeclaration(approvalBody),
    message: 'Approval requirements affirm when approval is required or that none is required'
  });
  return checks;
}

export function buildManifest({ root, files, sections }) {
  return {
    name: path.basename(root),
    generatedAt: new Date().toISOString(),
    entrypoint: 'SKILL.md',
    fileCount: files.length,
    files,
    sections: sections.map((section) => section.title),
    sideEffects: inferSideEffects(sections),
    packagePlan: {
      dryRunOnly: true,
      include: files
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
    `Files: ${report.manifest.fileCount}`,
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

export function failedCheckHints(report) {
  return report.checks
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.message}`);
}

export async function runCli(argv, io) {
  const args = parseArgs(argv);
  if (args.error) {
    io.stderr.write(`${args.error}\n${usage()}`);
    process.exitCode = 64;
    return;
  }
  if (args.version) {
    io.stdout.write(`${await packageVersion()}\n`);
    return;
  }
  if (args.help || !args.skillDir) {
    io.stdout.write(usage());
    return;
  }
  const report = await inspectSkill(path.resolve(io.cwd, args.skillDir));
  const output = args.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : toMarkdown(report);
  io.stdout.write(output);
  if (args.strict && report.summary.failed > 0) {
    io.stderr.write(`${report.summary.failed} packaging checks failed\n`);
  }
  if (!report.summary.ok) {
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const args = { format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') args.help = true;
    else if (value === '--version') args.version = true;
    else if (value === '--strict') args.strict = true;
    else if (value === '--format') {
      const format = argv[++index];
      if (!['json', 'markdown'].includes(format)) {
        args.error = '--format requires one of: json, markdown';
        return args;
      }
      args.format = format;
    }
    else if (value.startsWith('-')) {
      args.error = `Unknown option: ${value}`;
      return args;
    }
    else if (!args.skillDir) args.skillDir = value;
    else {
      args.error = `Unexpected argument: ${value}`;
      return args;
    }
  }
  return args;
}

function usage() {
  return `Usage: skillpackager <skill-dir> [--format json|markdown] [--strict]\n`;
}

async function listFiles(root, prefix = '') {
  const dir = path.join(root, prefix);
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry)) continue;
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
  if (!hasResolvedSideEffectDeclaration(boundary?.body)) return ['unknown'];
  if (hasAffirmativeLocalOnlyDeclaration(boundary.body)) return ['local-filesystem-read'];
  return ['review-required'];
}

function hasResolvedSideEffectDeclaration(body = '') {
  if (isUnresolvedDeclaration(body)) return false;
  return hasAffirmativeLocalOnlyDeclaration(body)
    || /\bexternal (?:writes?|calls?|requests?|side[ -]effects?|effects?|changes?) (?:require|requires|need|needs) (?:review|approval)\b/i.test(body);
}

function hasAffirmativeLocalOnlyDeclaration(body) {
  const dryRun = /\bdry[- ]run(?: only| mode)?\b/i.test(body)
    && !/\b(?:no|not|without|does not|doesn't|cannot|can't)\b[^.\n]{0,30}\bdry[- ]run\b/i.test(body);
  const localOnly = /\b(?:reads?|access(?:es)?|operations? (?:are|is)) local (?:files?|filesystem) only\b/i.test(body);
  const noExternal = /\bno external (?:writes?|calls?|requests?|services?|side[ -]effects?|effects?|changes?|network access)\b/i.test(body);
  return dryRun || localOnly || noExternal;
}

function hasResolvedApprovalDeclaration(body = '') {
  if (isUnresolvedDeclaration(body)) return false;
  return /\b(?:ask|prompt)(?:s|ed)? (?:for )?(?:(?:user|human) )?(?:approval )?before\b/i.test(body)
    || /\b(?:request|obtain|require|requires|needs?) (?:for )?(?:user |human )?approval before\b/i.test(body)
    || /\bapproval (?:is )?(?:required|needed) (?:before|for|to)\b/i.test(body)
    || /\b(?:no approval (?:is )?required|approval is not required|does not require approval)\b/i.test(body);
}

function isUnresolvedDeclaration(body) {
  if (!body.trim()) return true;
  return /\b(?:unknown|tbd|to be determined|not yet (?:defined|determined|documented|specified)|undocumented|not documented|not specified|missing)\b/i.test(body)
    || /\bno external (?:side[ -])?effects? (?:are|is) documented\b/i.test(body);
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
