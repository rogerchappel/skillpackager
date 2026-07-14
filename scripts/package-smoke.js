#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const binEntries = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin || {};

for (const [name, entry] of Object.entries(binEntries)) {
  if (!fs.existsSync(entry)) {
    throw new Error(`missing bin entry for ${name}: ${entry}`);
  }
}

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));

for (const required of ['package.json', 'README.md', 'LICENSE', 'bin/skillpackager.js', 'src/index.js', 'fixtures/good-skill/SKILL.md']) {
  if (!files.has(required)) {
    throw new Error(`npm pack is missing ${required}`);
  }
}

for (const file of files) {
  if (file.startsWith('tests/') || file.startsWith('.github/')) {
    throw new Error(`npm pack includes non-runtime file ${file}`);
  }
}

console.log(`package smoke passed for ${pkg.name} with ${files.size} packed files`);
