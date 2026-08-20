import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

function themeBlock(themeId) {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`\\[data-theme="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing ${themeId} theme block`);
  return match[1];
}

test('the document and application default to Riverline Midnight', () => {
  assert.match(html, /<html\b[^>]*lang="en"/);
  assert.match(html, /<html\b[^>]*data-theme="midnight"/);
  assert.match(logic, /const defaultTheme = 'midnight';/);
  assert.match(logic, /const persistedTheme = localStorage\.getItem\('appTheme'\);/);
  assert.match(logic, /const selectedTheme = THEME_PREVIEWS\.some\(theme => theme\.id === persistedTheme\)\s*\?\s*persistedTheme\s*:\s*defaultTheme;/);
  assert.doesNotMatch(logic, /localStorage\.setItem\('appTheme', defaultTheme\)/);
});

test('the semantic foundation exposes the required token families', () => {
  const requiredTokens = [
    '--font-display', '--font-ui', '--font-data',
    '--space-1', '--space-11',
    '--surface-canvas', '--surface-panel', '--surface-elevated', '--surface-interactive',
    '--text-primary', '--text-secondary', '--text-muted', '--text-disabled',
    '--border-subtle', '--border-default', '--border-strong', '--border-focus', '--border-invalid',
    '--accent-primary', '--accent-primary-hover', '--accent-secondary',
    '--status-positive', '--status-warning', '--status-danger', '--status-info',
    '--action-fold', '--action-passive', '--action-aggressive', '--action-all-in', '--action-mixed',
    '--equity-primary', '--equity-tie', '--ev-positive', '--ev-neutral', '--ev-negative',
    '--card-face', '--card-border', '--card-back',
    '--suit-heart', '--suit-spade', '--suit-diamond', '--suit-club',
    '--shadow-panel', '--shadow-overlay', '--radius-control', '--radius-panel',
    '--duration-fast', '--duration-normal', '--duration-slow', '--ease-standard',
  ];

  for (const token of requiredTokens) assert.match(css, new RegExp(`${token}\\s*:`), token);
});

test('the three supported themes define distinct semantic surface palettes', () => {
  const midnight = themeBlock('midnight');
  const graphite = themeBlock('graphite');
  const daylight = themeBlock('daylight');

  assert.match(midnight, /color-scheme:\s*dark/);
  assert.match(midnight, /--surface-canvas:\s*#101311/);
  assert.match(graphite, /color-scheme:\s*dark/);
  assert.match(graphite, /--surface-canvas:\s*#151716/);
  assert.match(daylight, /color-scheme:\s*light/);
  assert.match(daylight, /--surface-canvas:\s*#e8e2d8/);

  for (const block of [midnight, graphite, daylight]) {
    assert.match(block, /--surface-panel:/);
    assert.match(block, /--text-primary:/);
    assert.match(block, /--border-focus:/);
    assert.match(block, /--accent-primary:/);
  }
});

test('poker action meanings do not vary by supported theme', () => {
  for (const themeId of ['midnight', 'graphite', 'daylight']) {
    const block = themeBlock(themeId);
    assert.doesNotMatch(block, /--action-/);
    assert.doesNotMatch(block, /--matrix-/);
  }

  assert.match(css, /--theme-act1:\s*var\(--action-aggressive\)/);
  assert.match(css, /--theme-act2:\s*var\(--action-passive\)/);
  assert.match(css, /--theme-act3:\s*var\(--action-fold\)/);
  assert.match(css, /--matrix-mix:\s*var\(--action-mixed\)/);
});

test('theme previews distinguish supported and legacy themes', () => {
  assert.match(logic, /id: 'midnight', name: 'Riverline Midnight'.*legacy: false/);
  assert.match(logic, /id: 'graphite', name: 'Riverline Graphite'.*legacy: false/);
  assert.match(logic, /id: 'daylight', name: 'Riverline Daylight'.*legacy: false/);
  assert.match(logic, /id: 'legacy-midnight-cyan'.*legacy: true/);
  assert.match(logic, /Legacy \/ Experimental/);
  assert.match(logic, /THEME_PREVIEWS\.some\(theme => theme\.id === persistedTheme\)/);
});

test('focus and reduced-motion safety rails are present', () => {
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /outline:\s*2px solid var\(--border-focus\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms !important/);
});
