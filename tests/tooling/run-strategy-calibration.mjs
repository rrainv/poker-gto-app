import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CALIBRATION_SUPPORTED_DIMENSIONS,
  buildCalibrationReport,
  measureCalibrationRuntime,
} from './strategy-calibration-harness.mjs';

function argumentValue(prefix) {
  const argument = process.argv.slice(2).find((value) => value.startsWith(`${prefix}=`));
  return argument ? argument.slice(prefix.length + 1) : null;
}

function readReference(referencePath) {
  if (!referencePath) return null;
  const absolute = path.resolve(process.cwd(), referencePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const pretty = process.argv.includes('--pretty');
  const runtime = process.argv.includes('--runtime');
  const includeClasses = process.argv.includes('--full');
  const reference = readReference(argumentValue('--reference'));
  const runs = Number(argumentValue('--runs') ?? 1);
  const output = runtime
    ? measureCalibrationRuntime({ runs })
    : {
      supportedDimensions: CALIBRATION_SUPPORTED_DIMENSIONS,
      report: buildCalibrationReport({ reference, includeClasses }),
    };
  process.stdout.write(`${JSON.stringify(output, null, pretty ? 2 : 0)}\n`);
}

