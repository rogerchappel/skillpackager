#!/usr/bin/env node
import { runCli } from '../src/index.js';

runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
