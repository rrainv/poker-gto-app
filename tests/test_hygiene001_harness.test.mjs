// TEST-HYGIENE-001-FIX: self-tests for the behavioural test harness
// (tests/helpers/*). Each fidelity rule the harness promises is checked here so
// a regression in the harness cannot let app tests pass on a browser-impossible
// interaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { StyleSheetModel, appStyleSheet, bootApp } from './helpers/app-under-test.mjs';
import { frameIsAppFile } from './helpers/browser-app.mjs';
import { createFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const app = await bootApp();
const { document } = app;
const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));

function mount(markup) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
}

// --------------------------------------------------------------- platform

test('app paths resolve on every platform (module scripts, classic-script stack frames)', () => {
  // Module scripts loaded: their bridges exist (Windows used to build file:///C:/C:/ URLs).
  assert.equal(typeof app.window.RiverlineEquity?.calculate, 'function');
  // Classic scripts run under their platform path; frames match with either separator.
  let frame = '';
  const probe = new Proxy({ durable: {} }, { get(target, key) { frame ||= new Error().stack.split('\n')[2]; return target[key]; } });
  app.call('reviewContextCopy', probe);
  assert.ok(frameIsAppFile(frame, 'src/core/logic.js'), frame);
  const root = fileURLToPath(new URL('../app/', import.meta.url));
  assert.ok(frameIsAppFile(`    at f (${root.replace(/\//g, '\\')}src\\core\\logic.js:1:1)`, 'src/core/logic.js'));
  assert.ok(frameIsAppFile(`    at f (${pathToFileURL(root).href}src/core/logic.js:1:1)`, 'src/core/logic.js'));
  assert.equal(frameIsAppFile('    at f (node:internal/x:1:1)', 'src/core/logic.js'), false);
});

test('trackReads records the reads page code makes directly', () => {
  const decision = { durable: { decisionContext: null, heroPosition: 'BTN' } };
  const { proxy, reads } = app.trackReads(decision);
  app.call('reviewContextCopy', proxy);
  assert.ok(reads.has('durable'), [...reads].map(String).join());
});

// ------------------------------------------------------------------ errors

test('a page listener error fails the interaction that raised it', async () => {
  const host = mount('<button type="button" id="harnessThrows">Throw</button>');
  const button = host.querySelector('button');
  button.addEventListener('click', () => { throw new TypeError('listener exploded'); });
  await assert.rejects(app.click(button), /page listener raised 1 uncaught error\(s\)[\s\S]*listener exploded/);
  assert.equal(app.errors.length, 0, 'reported errors are cleared');
  // Expected errors are returned instead of failing.
  const errors = await app.expectErrors(() => app.click(button));
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /listener exploded/);
  host.remove();
});

test('an error raised outside interactions fails the test file at teardown', () => {
  const fixture = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-harness-')), 'late-error.test.mjs');
  const helpers = pathToFileURL(path.join(TESTS_DIR, 'helpers', 'app-under-test.mjs')).href;
  fs.writeFileSync(fixture, [
    "import test from 'node:test';",
    `import { bootApp } from '${helpers}';`,
    'const app = await bootApp();',
    "test('raises outside an interaction', () => {",
    "  app.document.body.addEventListener('ping', () => { throw new Error('late failure'); });",
    "  app.document.body.dispatchEvent(new app.window.Event('ping'));",
    '});',
    '',
  ].join('\n'));
  try {
    // A standalone runner (not reporting into this one).
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', fixture], { encoding: 'utf8', timeout: 120000, env });
    assert.notEqual(run.status, 0, run.stdout);
    assert.match(run.stdout, /late failure/);
  } finally {
    fs.rmSync(path.dirname(fixture), { recursive: true, force: true });
  }
});

// ------------------------------------------------------- click and focus

test('clicks only reach shown, non-inert controls outside modals; disabled controls ignore them', async () => {
  const css = appStyleSheet();
  const host = mount(`
    <button type="button" id="hClickHidden" hidden>a</button>
    <div class="equity-player-outs"><button type="button" id="hClickCssHidden">b</button></div>
    <div inert><button type="button" id="hClickInert">c</button></div>
    <fieldset disabled><legend><button type="button" id="hClickLegend">d</button></legend><button type="button" id="hClickFieldset">e</button></fieldset>
    <button type="button" id="hClickOk">f</button>
    <label id="hLabel"><span id="hLabelText">Toggle</span><input type="checkbox" id="hLabelBox"></label>`);
  assert.equal(css.cascaded(host.querySelector('.equity-player-outs'), 'display'), 'none');
  const clicks = [];
  for (const button of host.querySelectorAll('button')) button.addEventListener('click', () => clicks.push(button.id));
  await assert.rejects(app.click('#hClickHidden'), /not clickable \(not shown: itself has the hidden attribute\)/);
  // The message names the hiding ancestor and the winning rule.
  await assert.rejects(app.click('#hClickCssHidden'), /not clickable \(not shown: <div\.equity-player-outs> is display:none by "\.equity-player-outs"\)/);
  await assert.rejects(app.click('#hClickInert'), /not clickable \(inert\)/);
  await app.click('#hClickFieldset');
  await app.click('#hClickLegend');
  await app.click('#hClickHidden', { force: true });
  assert.deepEqual(clicks, ['hClickLegend', 'hClickHidden'], 'fieldset-disabled control ignores the click; its legend does not');
  assert.equal(app.$('#hClickFieldset').matches(':disabled'), true);
  // A click on text inside a label activates its control.
  await app.click('#hLabelText');
  assert.equal(app.byId('hLabelBox').checked, true);
  // An open modal dialog blocks the page behind it.
  const dialog = document.createElement('dialog');
  dialog.innerHTML = '<button type="button" id="hDialogButton">ok</button>';
  document.body.appendChild(dialog);
  dialog.showModal();
  try {
    await assert.rejects(app.click('#hClickOk'), /behind an open modal dialog/);
    await app.click('#hDialogButton');
  } finally {
    dialog.close();
    dialog.remove();
  }
  await app.click('#hClickOk');
  assert.equal(clicks.at(-1), 'hClickOk');
  host.remove();
});

test('focus() moves focus only to focusable, rendered, enabled elements', () => {
  const host = mount(`
    <div id="hFocusDiv">plain</div>
    <h2 id="hFocusHeading" tabindex="-1">heading</h2>
    <button type="button" id="hFocusHidden" hidden>hidden</button>
    <div class="equity-player-outs"><button type="button" id="hFocusCssHidden">css hidden</button></div>
    <button type="button" id="hFocusDisabled" disabled>disabled</button>
    <fieldset disabled><input id="hFocusFieldset"></fieldset>
    <div inert><button type="button" id="hFocusInert">inert</button></div>
    <a id="hFocusAnchor">no href</a>
    <button type="button" id="hFocusOk">ok</button>`);
  const start = app.byId('hFocusOk');
  start.focus();
  assert.equal(document.activeElement, start);
  for (const id of ['hFocusDiv', 'hFocusHidden', 'hFocusCssHidden', 'hFocusDisabled', 'hFocusFieldset', 'hFocusInert', 'hFocusAnchor']) {
    app.byId(id).focus();
    assert.equal(document.activeElement, start, `${id} cannot take focus`);
  }
  app.byId('hFocusHeading').focus();
  assert.equal(document.activeElement.id, 'hFocusHeading', 'tabindex=-1 is programmatically focusable');
  start.blur();
  host.remove();
});

test('isShown and visibleText honour stylesheet display:none and visibility:hidden', () => {
  const host = mount(`
    <p id="hShown">shown</p>
    <div class="equity-player-outs"><p id="hCssHidden">css hidden</p></div>
    <div style="visibility: hidden"><p id="hInvisible">invisible</p></div>
    <p id="hInline" style="display: none">inline hidden</p>`);
  assert.equal(app.isShown(app.byId('hShown')), true);
  for (const id of ['hCssHidden', 'hInvisible', 'hInline']) assert.equal(app.isShown(app.byId(id)), false, id);
  const text = app.visibleText(host).replace(/\s+/g, ' ').trim();
  assert.match(text, /shown/);
  assert.doesNotMatch(text, /css hidden|inline hidden/);
  host.remove();
});

// ------------------------------------------------------------------ forms

test('<select> selection follows browser rules', () => {
  const host = mount(`
    <select id="hSelectDefault"><option value="a" disabled>A</option><option value="b">B</option><option value="c">C</option></select>
    <select id="hSelectAttr"><option value="a" selected>A</option><option value="b" selected>B</option></select>`);
  const select = app.byId('hSelectDefault');
  assert.equal(select.value, 'b', 'the first non-disabled option is selected by default');
  assert.equal(select.selectedIndex, 1);
  assert.equal(select.querySelector('option:checked').value, 'b');
  assert.deepEqual(select.selectedOptions.map((option) => option.value), ['b']);
  select.value = 'missing';
  assert.equal(select.value, '', 'an unknown value selects nothing');
  assert.equal(select.selectedIndex, -1);
  assert.equal(select.querySelector('option:checked'), null);
  select.value = 'c';
  assert.equal(select.value, 'c');
  select.selectedIndex = 0;
  assert.equal(select.value, 'a');
  assert.equal(app.byId('hSelectAttr').value, 'b', 'the last selected attribute wins');
  host.remove();
});

test(':invalid / :valid and checkValidity evaluate constraints; submission validates first', () => {
  const host = mount(`
    <form id="hForm">
      <input id="hRequired" required>
      <input id="hNumber" type="number" min="1" max="10" step="1" value="5">
      <input id="hPattern" pattern="[a-z]+" value="abc">
      <button type="submit" id="hSubmit">Submit</button>
    </form>`);
  const form = app.byId('hForm');
  const required = app.byId('hRequired');
  const number = app.byId('hNumber');
  const pattern = app.byId('hPattern');
  let submits = 0;
  const invalid = [];
  form.addEventListener('submit', (event) => { event.preventDefault(); submits += 1; });
  required.addEventListener('invalid', () => invalid.push('required'));
  assert.equal(required.matches(':invalid'), true);
  assert.equal(required.validity.valueMissing, true);
  assert.equal(form.matches(':invalid'), true);
  form.requestSubmit();
  assert.equal(submits, 0, 'an invalid form does not submit');
  assert.deepEqual(invalid, ['required']);
  required.value = 'x';
  assert.equal(required.matches(':valid'), true);
  for (const [value, flag] of [['0', 'rangeUnderflow'], ['11', 'rangeOverflow'], ['2.5', 'stepMismatch']]) {
    number.value = value;
    assert.equal(number.validity[flag], true, `${value} ${flag}`);
    assert.equal(number.matches(':invalid'), true, value);
  }
  number.value = '7';
  pattern.value = 'ABC';
  assert.equal(pattern.validity.patternMismatch, true);
  pattern.value = 'abc';
  pattern.setCustomValidity('custom');
  assert.equal(pattern.matches(':invalid'), true, 'a custom error is invalid');
  pattern.setCustomValidity('');
  assert.equal(form.checkValidity(), true);
  form.requestSubmit();
  assert.equal(submits, 1);
  required.value = '';
  form.noValidate = true;
  form.requestSubmit();
  assert.equal(submits, 2, 'novalidate submits without validating');
  required.disabled = true;
  assert.equal(required.willValidate, false);
  assert.equal(required.matches(':invalid'), false, 'disabled controls are barred from validation');
  host.remove();
});

// --------------------------------------------------------------- CSS model

test('the CSS model reports selectors it cannot evaluate', () => {
  const element = mount('<p class="ok x"></p>').firstElementChild;
  // Unparseable: reported when the cascade index is built, never skipped.
  const unparseable = new StyleSheetModel('.ok { color: red; } .x[data-a=1 2] { color: blue; }');
  assert.throws(() => unparseable.cascaded(element, 'color'), /cannot evaluate selector "\.x\[data-a=1 2\]"/);
  // Parseable but unsupported pseudo-classes throw when matched.
  const unsupported = new StyleSheetModel('.ok { color: red; } .x:unknown-state { color: blue; }');
  assert.throws(() => unsupported.cascaded(element, 'color'), /Unsupported pseudo-class :unknown-state/);
  element.parentNode.remove();
});

test('the CSS model maps logical *-inline-start/end and *-block-start/end to physical sides by direction', () => {
  const sheet = new StyleSheetModel(`
    .box { padding-inline-start: 1px; padding-inline-end: 2px; margin-inline-start: 3px; margin-inline-end: 4px; inset-inline-start: 5px; inset-inline-end: 6px; }
    .edge { border: 1px solid gray; border-block-start: 2px solid red; border-inline-start: 3px solid blue; }
    .short { padding: 1px 2px 3px 4px; padding-inline: 7px 8px; }
    .phys { padding-left: 9px; }`);
  const host = mount('<div class="box edge"></div><div dir="rtl"><div class="box edge"></div></div><div class="short"></div><div class="phys"></div>');
  const [ltr, wrapper, short, phys] = host.children;
  const rtl = wrapper.firstElementChild;
  const read = (element, property) => sheet.cascaded(element, property);
  assert.deepEqual(['padding-left', 'padding-right', 'margin-left', 'margin-right', 'left', 'right'].map((p) => read(ltr, p)), ['1px', '2px', '3px', '4px', '5px', '6px']);
  assert.deepEqual(['padding-right', 'padding-left', 'margin-right', 'margin-left', 'right', 'left'].map((p) => read(rtl, p)), ['1px', '2px', '3px', '4px', '5px', '6px']);
  assert.equal(read(ltr, 'border-top'), '2px solid red', 'a later logical declaration wins over the shorthand');
  assert.equal(read(ltr, 'border-left'), '3px solid blue');
  assert.equal(read(rtl, 'border-right'), '3px solid blue');
  assert.equal(read(rtl, 'border-left'), '1px solid gray');
  assert.equal(read(short, 'padding-left'), '7px');
  assert.equal(read(short, 'padding-right'), '8px');
  assert.equal(read(short, 'padding-top'), '1px');
  assert.equal(read(phys, 'padding-inline-start'), '9px');
  host.remove();
});

test('app/styles.css is fully evaluable by the CSS model', () => {
  const css = appStyleSheet();
  // Building the full index parses every selector; an unsupported one throws.
  assert.doesNotThrow(() => css.matchingRules(document.body));
});

// ------------------------------------------------------------- IndexedDB

function openDatabase(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open('harness', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('inline', { keyPath: 'id' });
      request.result.createObjectStore('outline');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const done = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const nextTask = () => new Promise((resolve) => setImmediate(resolve));

test('fake IndexedDB transactions deactivate when control returns to the event loop, then auto-commit', async () => {
  const db = await openDatabase(createFakeIndexedDB());
  // Microtasks keep the creating task's transaction active.
  const tx = db.transaction(['inline'], 'readwrite');
  await Promise.resolve();
  tx.objectStore('inline').put({ id: 1 });
  // Requests chained from success events stay valid.
  const chained = db.transaction(['inline'], 'readwrite');
  const store = chained.objectStore('inline');
  const first = store.put({ id: 2 });
  first.onsuccess = () => store.put({ id: 3 });
  await new Promise((resolve) => { chained.oncomplete = resolve; });
  // Awaiting a later task deactivates it.
  const late = db.transaction(['inline'], 'readwrite');
  const lateStore = late.objectStore('inline');
  const lateDone = new Promise((resolve) => { late.oncomplete = resolve; });
  await nextTask();
  assert.throws(() => lateStore.put({ id: 4 }), { name: 'TransactionInactiveError' });
  await lateDone;
  const read = db.transaction(['inline']).objectStore('inline');
  assert.deepEqual((await done(read.getAll())).map(({ id }) => id), [1, 2, 3]);
  // In-line key stores reject an explicit key; out-of-line stores take it.
  const keys = db.transaction(['inline', 'outline'], 'readwrite');
  assert.throws(() => keys.objectStore('inline').put({ id: 5 }, 5), { name: 'DataError' });
  assert.equal(await done(keys.objectStore('outline').put({ any: true }, 'k')), 'k');
});

// --------------------------------------------------------- test hygiene

test('booted-app tests do not import self-installing app modules before bootApp()', () => {
  // SOURCE-SHAPE: a module imported statically by a test evaluates before
  // bootApp() installs the window, so its window bridge silently never
  // installs; this scans test files (not app sources) for that pattern.
  const SELF_INSTALL = /^(?:if \(typeof window !== ['"]undefined['"]|(?:Object\.)?defineProperty\(window|window\.Riverline\w*\s*=)/m;
  // Bridges that the booted bootstraps install again themselves.
  const REINSTALLED = new Set(['app/src/application/experience-events.mjs']);
  const appRoot = path.resolve(TESTS_DIR, '..');
  const importsOf = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s[^'";]*?from\s*['"](\.[^'"]+)['"]|^\s*import\s*['"](\.[^'"]+)['"]/gm)]
    .map((match) => path.resolve(path.dirname(file), match[1] || match[2]));
  const installer = (file, seen = new Set()) => {
    if (seen.has(file) || !fs.existsSync(file) || !/[\\/](app|shared)[\\/]/.test(file)) return null;
    seen.add(file);
    if (SELF_INSTALL.test(fs.readFileSync(file, 'utf8'))) return file;
    for (const dependency of importsOf(file)) {
      const found = installer(dependency, seen);
      if (found) return found;
    }
    return null;
  };
  const offenders = [];
  for (const name of fs.readdirSync(TESTS_DIR).filter((entry) => /\.test\.m?js$/.test(entry))) {
    const file = path.join(TESTS_DIR, name);
    if (!/\bbootApp\(/.test(fs.readFileSync(file, 'utf8'))) continue;
    for (const dependency of importsOf(file)) {
      const found = installer(dependency);
      const relative = found && path.relative(appRoot, found).replace(/\\/g, '/');
      if (relative && !REINSTALLED.has(relative)) offenders.push(`${name} -> ${relative}`);
    }
  }
  assert.deepEqual(offenders, [], 'import these after bootApp() (dynamic import)');
});
