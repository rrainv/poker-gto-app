import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8');
const browserStorage = fs.readFileSync(new URL('../app/src/personal-strategy/browser-storage.mjs', import.meta.url), 'utf8');
const visualAudit = fs.readFileSync(new URL('./tooling/audit_range_cal001a.cjs', import.meta.url), 'utf8');

test('Range Calibration is reachable without reordering or removing existing workspaces', () => {
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(modes.slice(0, 5), ['gto', 'equity', 'training', 'calibration', 'info']);
  assert.match(html, /data-mode="calibration"[^>]*data-mode-title="Range Calibration"/);
  assert.match(html, /id="calibrationMode" class="mode-view range-calibration-mode"/);
  for (const mode of ['gto', 'equity', 'training', 'info']) assert.ok(modes.includes(mode));
  assert.match(logic, /const activeView = \$\(`#\$\{mode\}Mode`\)/);
});

test('Personal Strategy remains dormant until the calibration workspace is opened', () => {
  assert.match(html, /<template id="rangeCalibrationTemplate">/);
  assert.match(html, /<template id="calibrationProfileModalTemplate">/);
  assert.match(html, /id="rangeCalibrationMount"><\/div>/);
  assert.doesNotMatch(bootstrap, /from ['"].*personal-strategy/);
  assert.match(bootstrap, /import\('\.\/range-calibration-workspace\.mjs'\)/);
  assert.doesNotMatch(logic, /personalStrategy|rangeCalibrationRepository|loadSnapshot/);
});

test('profile editor requires exactly three text-named modes and contains no interpolation controls', () => {
  const modal = html.slice(html.indexOf('id="calibrationProfileModalTemplate"'), html.indexOf('</template>', html.indexOf('id="calibrationProfileModalTemplate"')));
  assert.equal((modal.match(/id="calibrationModeName[123]"/g) || []).length, 3);
  assert.doesNotMatch(modal, /type="range"|styleValue|interpolation|Tight 0|Loose 100/i);
  assert.match(service, /Mode names must be different within one profile/);
});

test('profile editor gives the semantic mode legend its own flow space above the bordered input group', () => {
  const modal = html.slice(html.indexOf('id="calibrationProfileModalTemplate"'), html.indexOf('</template>', html.indexOf('id="calibrationProfileModalTemplate"')));
  assert.match(modal, /<fieldset class="calibration-mode-name-fields">[\s\S]*?<legend[^>]*>Your three strategy modes<\/legend>[\s\S]*?<div class="calibration-mode-name-panel">/);
  assert.match(modal, /<div class="calibration-mode-name-inputs">[\s\S]*?calibrationModeName1[\s\S]*?calibrationModeName2[\s\S]*?calibrationModeName3/);
  assert.match(css, /\.calibration-mode-name-fields \{[^}]*padding: 0;[^}]*border: 0;/);
  assert.match(css, /\.calibration-mode-name-panel \{[^}]*padding: clamp\([^}]*border: 1px solid var\(--border-subtle\)/);
  assert.match(css, /\.calibration-mode-name-inputs \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.calibration-mode-name-inputs input \{[^}]*min-inline-size: 0;[^}]*text-overflow: ellipsis;/);
});

test('profile editor keeps its footer usable by scrolling only the form body when viewport height is constrained', () => {
  assert.match(css, /\.calibration-profile-modal \.modal-body \{[^}]*min-block-size: 0;[^}]*flex: 1 1 auto;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/);
  assert.match(css, /\.calibration-profile-modal-actions \{[^}]*flex: 0 0 auto;[^}]*justify-content: flex-end;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.calibration-mode-name-inputs \{ grid-template-columns: minmax\(0, 1fr\); \}/);
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
  const template = html.slice(html.indexOf('id="rangeCalibrationTemplate"'), html.indexOf('</template>', html.indexOf('id="rangeCalibrationTemplate"')));
  for (const id of ['calibrationEnvironment', 'calibrationTableSize', 'calibrationHeroPosition', 'calibrationEffectiveStack']) {
    assert.match(template, new RegExp(`id="${id}"`));
  }
  assert.match(template, /Ready to calibrate this range/);
  assert.match(template, /id="calibrationStartQuestions"[^>]+data-i18n="Start questions"/);
  assert.match(template, /data-calibration-action="fold"/);
  assert.match(template, /data-calibration-action="raise"/);
  assert.doesNotMatch(template, /confidence|inferred|data-calibration-action="call"/i);
  assert.doesNotMatch(workspace, /saveRangeObservation|createRangeObservation|StrategyProvider|Training/);
});

test('workspace localization and RTL preserve poker notation as LTR data islands', () => {
  assert.match(html, /range-calibration-translations\.js/);
  assert.match(html, /data-i18n="Range Calibration"|data-i18n-aria-label="Range Calibration"/);
  assert.match(css, /\[dir="rtl"\] \.calibration-context-preview div[\s\S]*?direction: ltr/);
  assert.match(html, /id="calibrationPreviewSpot" class="poker-data-token"/);
  assert.match(html, /id="calibrationStackHelp" class="poker-data-token"/);
  assert.match(html, /id="calibrationProfileSelect"[^>]*dir="auto"/);
  assert.match(workspace, /button\.dir = 'auto'/);
});

test('desktop responsive rules reflow context and session controls without page overflow', () => {
  const ticketCss = css.slice(css.indexOf('RANGE-CAL-001A: isolated Range Calibration workspace'));
  assert.match(ticketCss, /grid-template-columns: minmax\(0, 1\.58fr\) minmax\(280px, \.62fr\)/);
  assert.match(ticketCss, /@media \(max-width: 1180px\)[\s\S]*?\.calibration-main-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(ticketCss, /@media \(max-width: 820px\)[\s\S]*?\.calibration-empty-state \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(ticketCss, /#calibrationMode[\s\S]*?overflow-x: hidden/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.mode-navigation \{ grid-template-columns: repeat\(5/);
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

function templateSource() { return html.slice(html.indexOf('id="rangeCalibrationTemplate"'), html.indexOf('</template>', html.indexOf('id="rangeCalibrationTemplate"'))); }
