import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createRangeCalibrationLifecycle } from '../app/src/application/range-calibration-lifecycle.mjs';
import { normalizeModeNames } from '../app/src/application/range-calibration-service.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup and templates, the cascade, the running shell).
// Bootstrap/workspace/service/storage/audit sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const templateContent = (id) => markup.getElementById(id).content;
function mountTemplate(id) {
  // Instantiate a template into the parsed document so selectors and the
  // cascade see it in context.
  const host = markup.createElement('div');
  host.appendChild(templateContent(id).cloneNode(true));
  (markup.getElementById('calibrationMode') || markup.body).appendChild(host);
  return host;
}
const workspaceHost = mountTemplate('rangeCalibrationTemplate');
const modalHost = mountTemplate('calibrationProfileModalTemplate');
const bootstrap = fs.readFileSync(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8');
const browserStorage = fs.readFileSync(new URL('../app/src/personal-strategy/browser-storage.mjs', import.meta.url), 'utf8');
const visualAudit = fs.readFileSync(new URL('./tooling/audit_range_cal001a.cjs', import.meta.url), 'utf8');

test('Personal Strategy is the top-level destination while its existing workspace remains canonical', async () => {
  const destinations = markup.querySelectorAll('[data-navigation-id]').map((node) => node.dataset.navigationId);
  assert.deepEqual(destinations.slice(0, 9), ['hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved', 'home', 'home-game', 'guide']);
  const item = markup.querySelector('[data-navigation-id="personal-strategy"]');
  assert.equal(item.dataset.mode, 'calibration');
  assert.equal(item.dataset.modeTitle, 'Personal Strategy');
  const view = markup.getElementById('calibrationMode');
  assert.ok(view.classList.contains('mode-view') && view.classList.contains('range-calibration-mode'));
  for (const destination of ['hand', 'analyze', 'training', 'equity', 'guide']) assert.ok(destinations.includes(destination));
  // Navigation shows the `${mode}Mode` view for the destination.
  await app.navigate('personal-strategy');
  assert.ok(app.byId('calibrationMode').classList.contains('active'));
  assert.equal(app.byId('calibrationMode').style.display, 'block');
  await app.navigate('home');
});

test('the full Personal Strategy workspace remains dormant until Personal Strategy is opened', async () => {
  assert.equal(markup.getElementById('rangeCalibrationTemplate').localName, 'template');
  assert.equal(markup.getElementById('calibrationProfileModalTemplate').localName, 'template');
  assert.doesNotMatch(bootstrap, /from ['"].*personal-strategy/);
  assert.match(bootstrap, /import\('\.\/range-calibration-workspace\.mjs'\)/);
  // The classic runtime holds no Personal Strategy repository or snapshot loader.
  assert.equal(app.evaluate('typeof rangeCalibrationRepository'), 'undefined');
  assert.equal(app.evaluate('typeof loadSnapshot'), 'undefined');

  let selected = false;
  let mountCalls = 0;
  const lifecycle = createRangeCalibrationLifecycle({
    authentication: {
      ready: async () => {},
      getState: () => ({ status: 'signed_in' }),
    },
    accountIdentity: { getActiveIdentityId: async () => 'range-cal-owner' },
    surface: {
      showLoading() {},
      showGuest() {},
      showError() {},
      async mountAuthenticated() { mountCalls += 1; return {}; },
      async disposeAuthenticated() {},
    },
    isSelected: () => selected,
  });
  assert.equal(lifecycle.start(), true);
  await Promise.resolve();
  assert.equal(mountCalls, 0);
  selected = true;
  await lifecycle.activate();
  assert.equal(mountCalls, 1);
});

test('Game Setup editor accepts any positive number of named Approaches and contains no interpolation controls', () => {
  // Every calibration/personal id across the page and both templates is unique.
  const personal = (nodes) => nodes.map((node) => node.id).filter((id) => /^(?:calibration|personal)/.test(id));
  const pageIds = personal(markup.querySelectorAll('[id]').filter((node) => !workspaceHost.contains(node) && !modalHost.contains(node)));
  const templateIds = ['rangeCalibrationTemplate', 'calibrationProfileModalTemplate'].flatMap((id) => personal(templateContent(id).querySelectorAll('[id]')));
  const personalIds = [...pageIds, ...templateIds];
  assert.ok(templateIds.length > 10);
  assert.equal(new Set(personalIds).size, personalIds.length, 'Workspace and modal fields must resolve to distinct DOM elements');
  const modal = modalHost;
  assert.ok(modal.querySelector('#personalApproachNameFields'));
  assert.equal(modal.querySelector('#calibrationModeName1, #calibrationModeName2, #calibrationModeName3'), null);
  assert.doesNotMatch(text(modal), /three strategy modes/i);
  assert.deepEqual(normalizeModeNames(['Usual']), ['Usual']);
  const names = ['Usual', 'Against Alex', 'Deep', 'Short', 'Experiment'];
  assert.deepEqual(normalizeModeNames(names), names);
  assert.throws(() => normalizeModeNames([]), /At least one Approach/);
  assert.throws(() => normalizeModeNames(['Usual', 'usual']), /different/);
  assert.equal(modal.querySelector('input[type="range"]'), null);
  assert.doesNotMatch(modal.innerHTML, /styleValue|interpolation|Tight 0|Loose 100/i);
  assert.match(workspace, /entry\.modes\.map\(\(candidate\) => candidate\.displayName\)/);
  assert.match(workspace, /personalApproachNameFields'\)\.replaceChildren\(\.\.\.names\.map/);
  const form = [workspaceHost, modalHost].map((host) => host.querySelector('#personalApproachForm')).find(Boolean) || markup.getElementById('personalApproachForm');
  const submit = form.querySelector('[type="submit"]');
  assert.equal(submit.dataset.i18n, 'Add Approach');
});

test('Game Setup editor groups dynamically generated Approach fields beneath an accessible legend', () => {
  const fieldset = modalHost.querySelector('fieldset.calibration-mode-name-fields');
  assert.ok(fieldset);
  assert.equal(text(fieldset.querySelector('legend')), 'Approaches');
  const inputs = fieldset.querySelector('div#personalApproachNameFields');
  assert.ok(inputs.classList.contains('calibration-mode-name-inputs'));
  assert.equal(css.cascaded(fieldset, 'padding'), '0');
  assert.equal(css.cascaded(fieldset, 'border'), '0');
  assert.equal(css.cascaded(fieldset.querySelector('legend'), 'overflow-wrap'), 'anywhere');
  assert.match(workspace, /label\.append\(caption, input\)/);
  assert.match(workspace, /input\.required = true; input\.dir = 'auto'/);
  const input = markup.createElement('input');
  inputs.appendChild(input);
  assert.equal(css.cascaded(input, 'min-inline-size'), '0');
  assert.equal(css.cascaded(input, 'text-overflow'), 'ellipsis');
  input.remove();
});

test('profile editor keeps its footer usable by scrolling only the form body when viewport height is constrained', () => {
  const dialog = modalHost.querySelector('.calibration-profile-modal');
  const body = dialog.querySelector('.modal-body');
  assert.equal(css.cascaded(body, 'min-block-size'), '0');
  assert.equal(css.cascaded(body, 'flex'), '1 1 auto');
  assert.equal(css.cascaded(body, 'overflow-y'), 'auto');
  assert.equal(css.cascaded(body, 'overscroll-behavior'), 'contain');
  const actions = dialog.querySelector('.calibration-profile-modal-actions');
  assert.equal(css.cascaded(actions, 'flex'), '0 0 auto');
  assert.equal(css.cascaded(actions, 'justify-content'), 'flex-end');
  assert.equal(css.cascaded(modalHost.querySelector('.calibration-mode-name-inputs'), 'grid-template-columns', { width: 600 }), 'minmax(0, 1fr)');
});

test('focused renderer audit covers long-name modal geometry across desktop sizes, RTL, locales, theme, and zoom', () => {
  assert.match(visualAudit, /RIVERLINE_RANGE_CAL_ARTIFACT_ROOT/);
  for (const captureId of [
    'M-profile-editor-long-1920x1080-en',
    'N-profile-editor-long-1024x768-en',
    'O-profile-editor-long-1280x720-en',
    'P-profile-editor-long-2560x1600-en',
    'Q-profile-editor-hebrew-rtl-1440x900',
    'R-profile-editor-russian-1440x900',
    'S-profile-editor-daylight-1920x1080-en',
    'T-profile-editor-125pct-1920x1080-en',
  ]) assert.match(visualAudit, new RegExp(captureId));
  assert.match(visualAudit, /fieldsetBorderTop !== '0px' \|\| !geometry\.legendClearsModePanel/);
  assert.match(visualAudit, /!geometry\.footerBelowBody \|\| !geometry\.footerReachable/);
  assert.match(visualAudit, /geometry\.modalOverflows\.length/);
});

test('context builder remains truthful while the bounded RFI question loop is operational', () => {
  const template = workspaceHost;
  for (const id of ['calibrationEnvironment', 'calibrationTableSize', 'calibrationHeroPosition', 'calibrationEffectiveStack']) {
    assert.ok(template.querySelector(`#${id}`), id);
  }
  assert.match(text(template), /Ready to calibrate this range/);
  assert.equal(template.querySelector('#calibrationStartQuestions').dataset.i18n, 'Start questions');
  assert.match(workspace, /button\.dataset\.calibrationAction = action\.type/);
  assert.match(service, /RFI calibration supports only canonical fold and raise actions/);
  assert.ok(template.querySelectorAll('[data-i18n="Inferred high"]').some((node) => text(node) === 'Inferred high'));
  assert.doesNotMatch(template.innerHTML, /confidence/i);
  assert.equal(template.querySelector('[data-calibration-action="call"]'), null);
  assert.doesNotMatch(workspace, /saveRangeObservation|createRangeObservation|StrategyProvider|from ['"][^'"]*training/i);
});

test('workspace localization and RTL preserve poker notation as LTR data islands', () => {
  assert.ok(markup.querySelectorAll('script[src]').some((script) => script.getAttribute('src').includes('range-calibration-translations.js')));
  assert.ok(markup.querySelector('[data-i18n="Personal Strategy"], [data-i18n-aria-label="Personal Strategy"]'));
  assert.ok([markup, workspaceHost].some((root) => root.querySelector('[data-i18n-aria-label="How Range Calibration works"]')));
  const cell = workspaceHost.querySelector('.calibration-context-preview div');
  markup.documentElement.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(cell, 'direction'), 'ltr');
  markup.documentElement.setAttribute('dir', 'ltr');
  for (const id of ['calibrationPreviewSpot', 'calibrationStackHelp']) {
    assert.ok(workspaceHost.querySelector(`#${id}`).classList.contains('poker-data-token'), id);
  }
  assert.equal(workspaceHost.querySelector('#calibrationProfileSelect').getAttribute('dir'), 'auto');
  assert.match(workspace, /button\.dir = 'auto'/);
});

test('desktop responsive rules reflow context and session controls without page overflow', () => {
  const grid = workspaceHost.querySelector('.calibration-main-grid');
  assert.equal(css.cascaded(grid, 'grid-template-columns', { width: 1440 }), 'minmax(0, 1.58fr) minmax(280px, .62fr)');
  assert.equal(css.cascaded(grid, 'grid-template-columns', { width: 1100 }), 'minmax(0, 1fr)');
  assert.equal(css.cascaded(workspaceHost.querySelector('.calibration-empty-state'), 'grid-template-columns', { width: 800 }), 'minmax(0, 1fr)');
  assert.equal(css.cascaded(markup.getElementById('calibrationMode'), 'overflow-x'), 'hidden');
  const navigation = markup.querySelector('.mode-navigation');
  assert.equal(css.cascaded(navigation, 'display', { width: 800 }), 'flex');
  assert.equal(css.cascaded(navigation, 'overflow-x', { width: 800 }), 'auto');
});

test('profile dialog and mode controls have keyboard and focus-management fundamentals', () => {
  assert.match(workspace, /event\.key === 'Escape'/);
  assert.match(workspace, /event\.key !== 'Tab'/);
  assert.match(workspace, /\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'\]/);
  assert.match(workspace, /setAttribute\('role', 'radio'\)/);
  assert.match(workspace, /setAttribute\('aria-checked'/);
  assert.match(workspace, /calibrationProfileDisplayName'\)\.focus/);
});

test('UI and workspace modules do not read or write Web Storage directly', () => {
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|\.getItem\(|\.setItem\(/);
  assert.doesNotMatch(bootstrap, /localStorage|sessionStorage|\.getItem\(|\.setItem\(/);
  assert.doesNotMatch(service, /globalThis\.localStorage|window\.localStorage/);
  assert.match(service, /createPersonalStrategyRepository/);
  assert.match(service, /createPersonalStrategyBrowserStorage/);
  assert.match(browserStorage, /globalThis\.localStorage/);
});
