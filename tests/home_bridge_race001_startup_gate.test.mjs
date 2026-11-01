// HOME-BRIDGE-RACE: modules whose graph has a top-level await evaluate after
// logic.js starts in a real browser (bootApp awaits modules one by one and
// hides that). The startup gate holds logic.js until every module script has
// finished evaluating.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const gateSource = fs.readFileSync(new URL('../app/src/application/startup-gate.js', import.meta.url), 'utf8');
const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

function pageWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-gate-'));
  for (const [name, code] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), code);
  const timers = [];
  const warnings = [];
  const root = {
    document: {
      baseURI: pathToFileURL(`${dir}${path.sep}`).href,
      querySelectorAll: (selector) => {
        assert.equal(selector, 'script[type="module"][src]');
        return Object.keys(files).map((name) => ({ getAttribute: () => `${name}?v=1`.split('?')[0] }));
      },
    },
    setTimeout: (callback, ms) => timers.push({ callback, ms }),
    console: { warn: (message) => warnings.push(message) },
  };
  root.window = root;
  vm.runInNewContext(gateSource, Object.assign(vm.createContext(root), { URL, Promise }), {
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  return { root, timers, warnings, dir };
}

test('whenReady waits for a module with a top-level await to install its bridge', async () => {
  const marker = `__gate_${Date.now()}_a`;
  const { root } = pageWith({
    // Same shape as authentication-bootstrap.mjs: top-level await before the install.
    'late-bridge.mjs': `await new Promise((resolve) => setTimeout(resolve, 60));\nglobalThis.${marker} = { installed: true };\n`,
    'importer.mjs': `import './late-bridge.mjs';\nglobalThis.${marker}_importer = true;\n`,
  });
  assert.equal(globalThis[marker], undefined, 'precondition: bridge not installed yet');
  await root.RiverlineStartup.whenReady();
  assert.deepEqual(globalThis[marker], { installed: true });
  assert.equal(globalThis[`${marker}_importer`], true, 'modules importing the late module have also run');
});

test('whenReady settles when a module fails to load', async () => {
  const { root } = pageWith({
    'broken.mjs': `import './does-not-exist.mjs';\n`,
    'fine.mjs': `globalThis.__gate_fine = true;\n`,
  });
  await root.RiverlineStartup.whenReady();
  assert.equal(globalThis.__gate_fine, true);
});

test('whenReady gives up on a module that never settles, with a warning', async () => {
  const { root, timers, warnings } = pageWith({
    'hung.mjs': `await new Promise(() => {});\n`,
  });
  const ready = root.RiverlineStartup.whenReady();
  assert.equal(timers.length, 1);
  assert.ok(timers[0].ms >= 5000, 'liveness limit is a long guard, not a short retry');
  timers[0].callback();
  await ready;
  assert.equal(warnings.length, 1);
  assert.equal(root.RiverlineStartup.whenReady(), ready, 'one gate per page');
});

test('index.html loads the gate before logic.js, and logic.js starts only through it', () => {
  const scripts = [...indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"?]+)[^>]*>/g)].map((match) => match[1]);
  const gate = scripts.indexOf('src/application/startup-gate.js');
  const logic = scripts.indexOf('src/core/logic.js');
  assert.ok(gate >= 0 && logic > gate, 'gate precedes logic.js');
  assert.match(indexHtml, /<script src="src\/application\/startup-gate\.js" defer><\/script>/, 'deferred so every module script is already parsed');
  assert.match(logicSource, /gate\.whenReady\(\)\.then\(\(\) => setTimeout\(init, 10\)\)/);
  assert.doesNotMatch(logicSource, /addEventListener\('DOMContentLoaded', \(\) => setTimeout\(init/);
});

test('the bridges that init reads are installed by modules with an async graph', () => {
  // If this stops holding, the gate may no longer be needed; if a new top-level
  // await appears, the gate already covers it because it waits for every module script.
  const auth = fs.readFileSync(new URL('../app/src/application/authentication-bootstrap.mjs', import.meta.url), 'utf8');
  assert.match(auth, /^if \(typeof window !== 'undefined'\) await installAuthenticationBridge\(window\);$/m);
  const home = fs.readFileSync(new URL('../app/src/application/home-workspace-bootstrap.mjs', import.meta.url), 'utf8');
  assert.match(home, /saved-study-object-bootstrap\.mjs/);
  const savedObjects = fs.readFileSync(new URL('../app/src/application/saved-study-object-bootstrap.mjs', import.meta.url), 'utf8');
  assert.match(savedObjects, /import '\.\/authentication-bootstrap\.mjs'/);
});
