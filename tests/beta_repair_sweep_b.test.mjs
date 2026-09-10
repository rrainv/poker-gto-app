import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { applyInitialPresentationTheme, createPresentationThemeController, contrastRatio,
  PRESENTATION_THEME_STORAGE_KEY, PRESENTATION_THEMES } from '../app/src/application/presentation-theme.mjs';
import { createTableGeometryProfile, tableSeatAnchors } from '../app/src/application/table-presentation.mjs';
import { opponentPortrait, OPPONENT_IDENTITIES } from '../app/src/ui/table-environment.mjs';
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function fixture() {
  const data = new Map(), props = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const root = { dataset: {}, style: { setProperty: (k,v) => props.set(k,v), getPropertyValue: k => props.get(k) ?? '', removeProperty: k => props.delete(k) } };
  const controller = createPresentationThemeController({ root, storage, createId: () => 'audit' }).init();
  return { root, storage, props, controller };
}
test('prepaint reproduces durable built-ins/custom selection and excludes editor previews', () => {
  for (const theme of ['midnight','daylight','custom']) {
    const f = fixture();
    if (theme === 'custom') { f.controller.customize({ surface: '#777777', accent: '#ef268c', felt: '#cca955' }); f.controller.saveAsNew('My theme'); }
    else f.controller.apply(theme);
    const savedCache = f.storage.getItem('riverline_theme_prepaint');
    const expected = new Map(f.props);
    f.controller.beginEdit(); f.controller.preview({ surface: '#abcdef' });
    assert.equal(f.storage.getItem('riverline_theme_prepaint'), savedCache);
    const painted = new Map(); const root = { dataset: {}, style: { setProperty: (k,v) => painted.set(k,v) } };
    vm.runInNewContext(read('app/src/application/presentation-theme-prepaint.js'), { document: { documentElement: root }, localStorage: f.storage, setTimeout() {} });
    assert.equal(root.dataset.presentationThemeId, f.controller.getTheme());
    assert.deepEqual(painted, expected);
    assert.equal(root.dataset.themePending, undefined);
    f.controller.cancelEdit();
    f.storage.setItem('riverline_theme_prepaint', '{broken');
    applyInitialPresentationTheme(f.root, f.storage);
    assert.deepEqual(f.props, expected, 'cache loss resolves from canonical library');
    f.storage.setItem(PRESENTATION_THEME_STORAGE_KEY, '{}');
    vm.runInNewContext(read('app/src/application/presentation-theme-prepaint.js'), { document: { documentElement: root }, localStorage: f.storage, setTimeout() {} });
    assert.equal(root.dataset.themePending, 'true', 'mismatched library never paints stale cache');
  }
});
test('custom rendered semantic pairs remain readable without rejecting chosen colors', () => {
  for (const surface of ['#777777','#898989','#aa5500','#ff00ff','#ffffff','#000000','#123abc']) {
    for (const theme of PRESENTATION_THEMES) {
      const f = fixture(); f.controller.apply(theme.id);
      f.controller.customize({ surface, accent: '#ef268c', felt: '#cca955' });
      assert.equal(f.controller.getColors().surface, surface);
      const pairs = [
        ...['canvas','shell','panel','elevated','interactive','interactive-hover','inset'].flatMap(bg => ['primary','secondary','muted','disabled'].map(fg => [`--text-${fg}`, `--surface-${bg}`])),
        ...['text','secondary','muted','support'].flatMap(fg => ['surface','surface-raised'].map(bg => [`--analysis-${fg}`,`--analysis-${bg}`])),
        ...['text','secondary','muted','support'].map(fg => [`--learning-${fg}`,'--learning-surface']),
        ['--navigation-active-text','--navigation-active-surface'], ['--text-on-accent','--accent-primary'], ['--text-on-accent','--accent-primary-hover'],
        ...['warning','danger','info','positive'].flatMap(fg => ['--surface-panel','--analysis-surface','--learning-surface'].map(bg => [`--status-${fg}`,bg])),
      ];
      for (const [fg,bg] of pairs) assert.ok(contrastRatio(f.props.get(fg),f.props.get(bg)) >= 4.5, `${surface} ${theme.id} ${fg} / ${bg}: ${f.props.get(fg)} / ${f.props.get(bg)}`);
    }
  }
});
test('table footprint is stable across 2-10 and mirrored seats preserve Hero bottom', () => {
  const widths = [];
  for (let count = 2; count <= 10; count++) {
    const { geometry } = createTableGeometryProfile(count);
    widths.push(geometry.tableBounds.width / geometry.coordinateSpace.width);
    const seats = tableSeatAnchors(count);
    assert.equal(seats[0][0], .5);
    assert.ok(seats[0][1] >= .78 && seats[0][1] <= .82);
    for (const [x,y] of seats) assert.ok(seats.some(([a,b]) => Math.abs(a - (1-x)) < .001 && b === y), `${count}: missing mirror for ${x},${y}`);
    if (count % 2 === 0) assert.ok(Math.abs(seats[0][1] + seats[count/2][1] - 1) < .001);
  }
  assert.ok(Math.max(...widths) / Math.min(...widths) < 1.1);
  assert.ok(Math.min(...widths) >= .85);
});
test('product formatting localizes names and dashes before interpolating user content', () => {
  const source = read('app/src/locales/i18n.js');
  const fn = source.slice(source.indexOf('function formatProductCopy'), source.indexOf('function resolveTranslation'));
  const scope = vm.createContext({}); vm.runInContext(fn, scope);
  for (const [lang, name] of [['en','Riverline'],['ru','Риверлайн'],['he','ריברליין']]) {
    assert.equal(scope.formatProductCopy('Riverline', lang), name);
    assert.doesNotMatch(scope.formatProductCopy('Riverline — 2–10 players', lang), /[—–]/);
    assert.equal(scope.formatProductCopy('https://example/Riverline/v1 riverline-audio/v1',lang), 'https://example/Riverline/v1 riverline-audio/v1');
  }
  assert.match(source, /interpolateTranslation\(resolveTranslation\(resolvedKey, lang\)\.value, params\)/);
});
test('portrait delivery uses bounded WebP derivatives, retaining source art', () => {
  let total = 0;
  for (const id of OPPONENT_IDENTITIES) {
    for (const size of ['seat','preview']) {
      const buffer = fs.readFileSync(new URL(opponentPortrait(id,size)));
      assert.equal(buffer.subarray(0,4).toString(), 'RIFF');
      assert.equal(buffer.subarray(8,12).toString(), 'WEBP');
      assert.ok(buffer.length < (size === 'seat' ? 10000 : 30000)); total += buffer.length;
    }
    assert.ok(fs.statSync(new URL(`../app/src/ui/assets/opponents/${id}.png`,import.meta.url)).size > 100000);
  }
  assert.ok(total < 250000);
});
