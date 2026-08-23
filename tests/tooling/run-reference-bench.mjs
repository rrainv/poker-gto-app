import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatReferenceBenchmarkSummary,
  runReferenceBenchmark,
} from './reference-bench-harness.mjs';

function optionValue(args, name) {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

export const REFERENCE_BENCHMARK_CLI_USAGE = [
  'Usage: node tests/tooling/run-reference-bench.mjs --input <path> [--output <path>] [--pretty]',
  '',
  'Input may be anywhere on the local filesystem. Without --output, JSON is written to stdout',
  'and the concise summary to stderr. With --output, JSON is saved there and the summary is stdout.',
].join('\n');

export async function runReferenceBenchmarkCli(args, {
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(`${REFERENCE_BENCHMARK_CLI_USAGE}\n`);
    return 0;
  }
  const inputPath = optionValue(args, '--input');
  if (!inputPath || inputPath.startsWith('--')) {
    throw new TypeError(`--input is required\n${REFERENCE_BENCHMARK_CLI_USAGE}`);
  }
  const outputPath = optionValue(args, '--output');
  if (outputPath?.startsWith('--')) throw new TypeError('--output requires a path');
  const absoluteInput = path.resolve(process.cwd(), inputPath);
  const input = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
  const report = await runReferenceBenchmark(input);
  const json = `${JSON.stringify(report, null, args.includes('--pretty') ? 2 : 0)}\n`;
  const summary = formatReferenceBenchmarkSummary(report);
  if (outputPath) {
    fs.writeFileSync(path.resolve(process.cwd(), outputPath), json, 'utf8');
    stdout.write(summary);
  } else {
    stdout.write(json);
    stderr.write(summary);
  }
  return 0;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    await runReferenceBenchmarkCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Reference benchmark failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

