import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainUrl = new URL('../app/main.js', import.meta.url);
const preloadUrl = new URL('../app/preload.js', import.meta.url);
const modelDirectoryUrl = new URL('../shared_models/', import.meta.url);
const modelUrl = new URL('../shared_models/model.onnx', import.meta.url);
const manifestUrl = new URL('../app/package.json', import.meta.url);
const lockUrl = new URL('../package-lock.json', import.meta.url);
const appLockUrl = new URL('../app/package-lock.json', import.meta.url);

const main = fs.readFileSync(mainUrl, 'utf8');
const preload = fs.readFileSync(preloadUrl, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockUrl, 'utf8'));
const appLock = JSON.parse(fs.readFileSync(appLockUrl, 'utf8'));

test('Electron main process is only a desktop host for the current app', () => {
  assert.match(main, /path\.join\(__dirname, 'index\.html'\)/);
  assert.match(main, /mainWindow\.loadFile\(indexPath\)/);
  assert.doesNotMatch(main, /onnxruntime-node|InferenceSession|onnx-inference|model\.onnx/i);
  assert.doesNotMatch(main, /\bipcMain\b/);
  assert.match(main, /preload:\s*path\.join\(__dirname, 'preload\.js'\)/);
});

test('obsolete native inference bridge and model assets are absent while the auth preload stays bounded', () => {
  assert.equal(fs.existsSync(preloadUrl), true);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('RiverlineRuntimeConfig'/);
  assert.doesNotMatch(preload, /onnxruntime|InferenceSession|model\.onnx|ipcRenderer/i);
  assert.equal(fs.existsSync(modelUrl), false);
  assert.equal(fs.existsSync(modelDirectoryUrl), false);
});

test('Electron package and lock metadata contain no native inference resources', () => {
  assert.equal(manifest.dependencies?.['onnxruntime-node'], undefined);
  assert.equal(manifest.dependencies?.['onnxruntime-web'], undefined);
  assert.equal(lock.packages?.['']?.dependencies?.['onnxruntime-node'], undefined);
  assert.equal(lock.packages?.['node_modules/onnxruntime-node'], undefined);
  assert.equal(appLock.packages?.['']?.dependencies?.['onnxruntime-node'], undefined);
  assert.equal(appLock.packages?.['node_modules/onnxruntime-node'], undefined);
  assert.doesNotMatch(
    JSON.stringify(manifest.build),
    /shared_models|model\.onnx|onnx|ort(?:\.|-)/i,
  );
});
