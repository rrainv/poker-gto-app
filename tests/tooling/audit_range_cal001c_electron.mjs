#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const electron = path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const worker = path.join(repoRoot, 'tests', 'tooling', 'audit_range_cal001c_electron_worker.cjs');
const auditRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-range-cal001c-electron-'));
const userData = path.join(auditRoot, 'user-data');

function runPhase(phase) {
  const resultPath = path.join(auditRoot, `${phase}.json`);
  return new Promise((resolve, reject) => {
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [
      worker,
      `--phase=${phase}`,
      `--user-data=${userData}`,
      `--result=${resultPath}`,
    ], { cwd: repoRoot, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!fs.existsSync(resultPath)) {
        reject(new Error(`Electron ${phase} phase exited ${code}: ${stderr}`));
        return;
      }
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      if (code !== 0 || result.fatal) reject(new Error(result.fatal || `Electron ${phase} phase exited ${code}: ${stderr}`));
      else resolve(result);
    });
  });
}

const write = await runPhase('write');
const read = await runPhase('read');
const findings = [];
if (write.beforeActivation.databases.length || write.beforeActivation.owner !== null) findings.push('Personal Strategy was not dormant before first activation');
if (!write.databases.includes('riverline-personal-strategy')) findings.push('Electron did not create IndexedDB');
if (write.answered !== 1 || write.prompt !== 'AKs') findings.push('Electron did not durably accept the answer');
if (read.answered !== 1 || read.prompt !== 'AKs') findings.push('Electron process restart did not recover the answer');
if (read.profileName !== 'Electron durable profile') findings.push('Electron process restart did not recover the profile');
if (write.errors.length || read.errors.length) findings.push('Electron renderer reported errors');

const report = {
  schemaVersion: 'range-cal001c-electron-qa/v1',
  electron: write,
  restart: read,
  temporaryProfile: auditRoot,
  findings,
};
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
