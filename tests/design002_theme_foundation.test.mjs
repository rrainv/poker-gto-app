import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_THEME,
  PRESENTATION_THEMES,
  normalizePresentationTheme,
} from '../app/src/application/presentation-theme.mjs';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');

function themeBlock(themeId) {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`\\[data-theme="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing ${themeId} theme block`);
  return match[1];
}

test('the document and presentation authority default to Riverline Midnight', () => {
  assert.match(html, /<html\b[^>]*lang="en"/);
  assert.match(html, /<html\b[^>]*data-theme="midnight"/);
  assert.equal(DEFAULT_PRESENTATION_THEME, 'midnight');
  assert.equal(normalizePresentationTheme('discord'), 'midnight');
  assert.match(bootstrap, /createPresentationThemeController/);
  assert.match(bootstrap, /storage: window\.localStorage/);
  assert.doesNotMatch(logic, /THEME_PREVIEWS|initThemeSwatches|localStorage\.(?:getItem|setItem)\('appTheme'/);
});

test('the semantic foundation exposes the required token families', () => {
  const requiredTokens = [
    '--font-display', '--font-ui', '--font-data', '--space-1', '--space-11',
    '--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated', '--surface-interactive', '--surface-inset',
    '--text-primary', '--text-secondary', '--text-muted', '--text-disabled',
    '--border-subtle', '--border-default', '--border-strong', '--border-focus', '--border-invalid',
    '--selection-background', '--selection-border', '--accent-primary', '--accent-primary-hover', '--accent-secondary',
    '--status-positive', '--status-warning', '--status-danger', '--status-info',
    '--action-fold', '--action-passive', '--action-aggressive', '--action-all-in', '--action-mixed',
    '--equity-primary', '--equity-tie', '--ev-positive', '--ev-neutral', '--ev-negative',
    '--card-face', '--card-border', '--card-back', '--poker-felt-accent',
    '--suit-heart', '--suit-spade', '--suit-diamond', '--suit-club',
    '--shadow-panel', '--shadow-overlay', '--radius-control', '--radius-panel',
    '--duration-fast', '--duration-normal', '--duration-slow', '--ease-standard',
  ];
  for (const token of requiredTokens) assert.match(css, new RegExp(`${token}\\s*:`), token);
});

test('the three supported themes define distinct restrained semantic palettes', () => {
  assert.deepEqual(PRESENTATION_THEMES.map((theme) => theme.id), ['midnight', 'graphite', 'daylight']);
  const midnight = themeBlock('midnight');
  const graphite = themeBlock('graphite');
  const daylight = themeBlock('daylight');

  assert.match(midnight, /color-scheme:\s*dark/);
  assert.match(midnight, /--surface-canvas:\s*#101311/);
  assert.match(graphite, /color-scheme:\s*dark/);
  assert.match(graphite, /--surface-canvas:\s*#14171a/);
  assert.match(graphite, /--accent-primary:\s*#7897c8/);
  assert.match(daylight, /color-scheme:\s*light/);
  assert.match(daylight, /--surface-canvas:\s*#ebe7df/);
  assert.match(daylight, /--status-danger:\s*#a34049/);

  for (const block of [midnight, graphite, daylight]) {
    for (const token of [
      '--surface-panel', '--surface-elevated', '--text-primary', '--text-muted',
      '--border-focus', '--selection-background', '--accent-primary',
      '--status-positive', '--status-warning', '--status-danger', '--status-info', '--poker-felt-accent',
    ]) assert.match(block, new RegExp(`${token}:`), token);
  }
});

test('poker action and suit meanings do not vary by supported theme', () => {
  for (const themeId of PRESENTATION_THEMES.map((theme) => theme.id)) {
    const block = themeBlock(themeId);
    assert.doesNotMatch(block, /--action-/);
    assert.doesNotMatch(block, /--matrix-/);
    assert.doesNotMatch(block, /--suit-/);
  }
  assert.match(css, /--theme-act1:\s*var\(--action-aggressive\)/);
  assert.match(css, /--theme-act2:\s*var\(--action-passive\)/);
  assert.match(css, /--theme-act3:\s*var\(--action-fold\)/);
  assert.match(css, /--matrix-mix:\s*var\(--action-mixed\)/);
});

test('Settings exposes immutable built-ins, a custom library, and three exact Riverline color triggers', () => {
  assert.match(html, /id="themeSwatchGrid"[^>]+role="group"/);
  assert.match(html, /id="customThemeGrid"[^>]+role="group"/);
  assert.match(html, /id="themeAccentColor"[^>]+data-theme-color-token="accent"/);
  assert.match(html, /id="themeSurfaceColor"[^>]+data-theme-color-token="surface"/);
  assert.match(html, /id="themeFeltColor"[^>]+data-theme-color-token="felt"/);
  assert.match(html, /id="riverlineColorPicker"[^>]+role="dialog"/);
  assert.doesNotMatch(html, /type="color"/);
  assert.match(html, /id="resetThemeCustomization"/);
  assert.doesNotMatch(html, /Legacy \/ Experimental|discord-0px|Casino Felt/);
});

test('focus, selection, and reduced-motion safety rails are present', () => {
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /outline:\s*2px solid var\(--border-focus\)/);
  assert.match(css, /::selection\s*\{[\s\S]*?var\(--selection-background\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms !important/);
});
