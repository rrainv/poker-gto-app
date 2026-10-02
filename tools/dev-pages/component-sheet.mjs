// DS-FOUNDATION-001 component sheet (dev only). Renders every DS component and
// variant in EN and HE through the real theme controller and real card faces.
// Theme state lives in memory only, so opening this page never changes the app's
// saved theme. Text comes from the shipped locale catalogs, written once per render (no static i18n attributes).
import { createPresentationThemeController, contrastRatio } from '/src/application/presentation-theme.mjs';
import * as cards from '/src/application/card-presentation.mjs';
import { createSavedPokerPreview } from '/src/application/saved-poker-preview.mjs';

const CUSTOM = Object.freeze({ accent: '#e0a458', surface: '#1b2230', felt: '#5b3a6b' });
const catalogs = Object.values(window).filter((value) => value && typeof value === 'object' && value.he && value.ru && value.en);
const tr = (lang) => (key) => {
  if (lang === 'en') return key;
  for (const catalog of catalogs) if (catalog[lang]?.[key]) return catalog[lang][key];
  return key;
};

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

const root = document.documentElement;
const theme = createPresentationThemeController({ root, storage: memoryStorage() }).init();
let customId = null;
function applyTheme(id) {
  if (id !== 'custom') { theme.apply(id); return; }
  if (!customId) {
    theme.apply('midnight');
    theme.beginEdit();
    theme.customize(CUSTOM);
    customId = theme.saveAsNew('DS sample custom')?.id;
  } else theme.apply(customId);
}

const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter((child) => child != null));
  return node;
};
const section = (title, ...children) => h('section', { class: 'panel sheet-section' }, h('h2', { text: title }), ...children);
const label = (text) => h('h3', { text });
const row = (...children) => h('div', { class: 'sheet-row' }, ...children);

function render(column) {
  const t = tr(column.dataset.sheetLocale);
  const btn = (text, attrs = {}) => h('button', { class: 'ui-button', type: 'button', ...attrs }, text);
  const icon = '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14M12 17h.01"/></svg>';
  const iconButton = (attrs = {}) => { const b = btn('', { 'data-variant': 'icon', 'aria-label': t('Learn Riverline'), ...attrs }); b.innerHTML = icon; return b; };
  const segments = (items, attrs = {}) => h('div', { class: 'ui-segments', role: 'group', ...attrs },
    ...items.map(([text, on, small]) => h('button', { class: 'ui-tab', type: 'button', 'aria-pressed': String(on) }, small ? h('strong', { text }) : text, small ? h('small', { text: small }) : null)));
  const field = (caption, control) => h('label', { class: 'ui-field' }, h('span', { text: caption }), control);
  const select = (...options) => h('select', {}, ...options.map((text) => h('option', { text })));
  const facts = h('dl', { class: 'ui-facts' }, ...[[t('Street'), t('Preflop')], [t('Actor'), 'CO'], [t('Pot'), '1.5 bb'], [t('To call'), '1 bb'], [t('Facing'), t('Raise') + ' 2.5 bb · BTN · 100 bb effective, long value wraps instead of truncating']]
    .map(([dt, dd]) => h('div', {}, h('dt', { text: dt }), h('dd', { text: dd }))));
  const preview = createSavedPokerPreview(document, { kind: 'hand', derivation: 'exact', heroCards: ['Kd', 'Jh'], board: ['Qs', '9c', 'Kc', 'Jh', '4d'] }, {
    translate: t, getCardPresentation: () => cards, getCardRankStyle: () => root.dataset.cardRankStyle || 'poker',
  });
  const amounts = h('span', { class: 'poker-island' }, '2.5 bb → 7.5 bb · 55.6%');

  column.replaceChildren(
    section('Type scale',
      h('div', { class: 'sheet-type' },
        h('p', { class: 't-hero' }, h('span', { class: 'poker-island', text: 'SPOT' })),
        h('p', { class: 't-display' }, h('span', { class: 'poker-island', text: '55.6%' })),
        h('p', { class: 't-title', text: t('Analyze') }),
        h('p', { class: 't-heading', text: t('Players and contributions') }),
        h('p', { class: 't-body', text: t('Choose something you intentionally kept, inspect its stored facts, and reopen it for study.') }),
        h('p', { class: 't-small', text: t('Recently updated') }),
        h('p', { class: 't-label', text: t('Street') })),
      label('hero verdict by poker action (action text roles)'),
      h('div', { class: 'sheet-row' }, ...[['fold', 'Fold'], ['check', 'Check'], ['call', 'Call'], ['raise', 'Raise'], ['all-in', 'All-in']]
        .map(([action, text]) => h('span', { class: 't-hero', 'data-action': action, style: 'font-size: var(--t-display)' }, h('span', { class: 'poker-island', text: t(text) }))))),
    section('Button',
      label('variants · md'),
      row(btn(t('Start hand'), { 'data-variant': 'primary' }), btn(t('Save spot')), btn(t('Edit saved item'), { 'data-variant': 'quiet' }), btn(t('Abort hand'), { 'data-variant': 'danger' }), iconButton()),
      label('sm'),
      row(btn(t('Start hand'), { 'data-variant': 'primary', 'data-size': 'sm' }), btn(t('Save spot'), { 'data-size': 'sm' }), btn(t('Clear filters'), { 'data-variant': 'quiet', 'data-size': 'sm' }), btn(t('Delete'), { 'data-variant': 'danger', 'data-size': 'sm' }), iconButton({ 'data-size': 'sm' })),
      label('states: disabled · pressed toggle · loading'),
      row(btn(t('Calculate equity'), { 'data-variant': 'primary', disabled: true }), btn(t('Save spot'), { disabled: true }), btn(t('Saved'), { 'aria-pressed': 'true' }), btn(t('Analyze'), { 'aria-busy': 'true' })),
      label('poker actions (action colors are poker data)'),
      row(...[['Fold', 'fold'], ['Call', 'passive'], ['Raise', 'aggressive']].map(([text, kind]) => btn(t(text), { class: `ui-button ui-button--poker-${kind}` })), btn('All-in 100 bb', { class: 'ui-button ui-button--poker-all-in' }))),
    section('Field',
      h('div', { class: 'sheet-grid' },
        field(t('Session name'), h('input', { type: 'text', placeholder: 'Friday Game' })),
        field(t('Players'), h('input', { type: 'number', value: '6', min: '2', max: '10' })),
        field(t('Search Saved'), h('input', { type: 'search', placeholder: t('Title, note, or tag'), dir: 'auto' })),
        field(t('Review state'), select(t('Any review state'), t('Review later'))),
        field(t('Monte Carlo samples'), h('div', { class: 'ui-stepper' }, h('input', { type: 'range', min: '1000', max: '50000', value: '10000' }), h('input', { type: 'number', value: '10000', dir: 'ltr' }))),
        field(t('Currency') + ' (disabled)', h('select', { disabled: true }, h('option', { text: 'ILS · ₪' }))))),
    section('Checkbox · Radio · Switch',
      row(h('label', { class: 'ui-check' }, h('input', { type: 'checkbox' }), t('Mistakes only')), h('label', { class: 'ui-check' }, h('input', { type: 'checkbox', checked: true }), t('Review later')),
        h('label', { class: 'ui-check' }, h('input', { type: 'checkbox', disabled: true }), 'disabled'),
        h('label', { class: 'ui-check' }, h('input', { type: 'checkbox', disabled: true, checked: true }), 'disabled · checked')),
      row(h('label', { class: 'ui-check' }, h('input', { type: 'radio', name: `r-${column.dataset.sheetLocale}`, checked: true }), t('Known')), h('label', { class: 'ui-check' }, h('input', { type: 'radio', name: `r-${column.dataset.sheetLocale}` }), t('Unknown')),
        h('button', { class: 'ui-switch', type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'on' }, h('b')), h('button', { class: 'ui-switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': 'off' }, h('b')),
        h('button', { class: 'switch ui-switch on', type: 'button', 'aria-pressed': 'true', 'aria-label': 'on (Settings pattern)' }, h('b')))),
    section('Segmented control · Tabs',
      label('md (selected = elevated surface + accent underline)'),
      segments([[t('Decision'), true], [t('Range Matrix'), false], ['Range Category Comparison', false]]),
      segments([['T', true, t('Poker notation')], ['10', false, t('Full ten')]], { class: 'ui-segments card-rank-style-control' }),
      label('sm'),
      row(segments([[t('Known'), true], [t('Unknown'), false]], { 'data-size': 'sm' })),
      label('tabs'),
      h('div', { class: 'ui-tabs', role: 'tablist' }, h('button', { role: 'tab', type: 'button', 'aria-selected': 'true', text: t('Saved items') }), h('button', { role: 'tab', type: 'button', 'aria-selected': 'false', text: t('Training history') }))),
    section('Chip · Badge',
      label('filter chips'),
      row(...[[t('All'), 3, true], [t('Hands'), 1, false], [t('Spots'), 2, false]].map(([text, n, on]) => h('button', { class: 'ui-chip', type: 'button', 'data-variant': 'filter', 'aria-pressed': String(on) }, h('span', { text }), h('strong', { class: 'ui-chip-count', text: String(n) })))),
      label('tags'),
      row(...['PREFLOP', 'SB', 'heads-up'].map((text) => h('span', { class: 'ui-chip', 'data-variant': 'tag', text }))),
      label('badges: status tones · source · count'),
      row(...['neutral', 'info', 'caution', 'positive', 'danger'].map((tone) => h('span', { class: 'ui-badge', 'data-tone': tone, text: tone === 'caution' ? t('In progress') : tone === 'info' ? t('Not started') : tone })),
        h('span', { class: 'ui-badge', 'data-variant': 'source', text: t('Heuristic fallback') }), h('span', { class: 'ui-badge', 'data-variant': 'count', text: '12' }))),
    section('Callout',
      h('p', { class: 'ui-callout', 'data-tone': 'caution' }, h('span', { text: t('The canonical hand is waiting for another player to act.') })),
      h('p', { class: 'ui-callout', 'data-tone': 'assumption' }, h('span', { text: 'Assumed: villain range is a generic BTN open (hypothetical input).' })),
      h('p', { class: 'ui-callout', 'data-tone': 'info' }, h('span', { text: t('Choose something you intentionally kept, inspect its stored facts, and reopen it for study.') }))),
    section('Fact grid', facts),
    section('Disclosure',
      h('details', { class: 'ui-disclosure', open: true }, h('summary', { text: t('Players and contributions') }), h('p', { text: 'Native details: Enter/Space toggle; Escape behavior unchanged.' })),
      h('details', { class: 'ui-disclosure', 'data-variant': 'inline' }, h('summary', { text: 'Inline disclosure' }), h('p', { text: '…' }))),
    section('List row',
      h('button', { class: 'ui-row', type: 'button', 'aria-current': 'true' }, preview.cloneNode(true), h('span', {}, h('span', { class: 'ui-row-title', text: 'Saved Hand · BTN · Preflop' }), h('br'), h('span', { class: 'ui-row-meta', text: '6-handed · BTN · 100 bb' })), h('span', { class: 'ui-badge', 'data-tone': 'neutral', text: t('Review later') })),
      h('button', { class: 'ui-row', type: 'button' }, h('span', { class: 'ui-badge', 'data-variant': 'count', text: '2' }), h('span', { class: 'ui-row-title', text: 'Saved Spot · BB · Flop' }), h('span', { class: 'ui-row-meta', text: '200 bb' }))),
    section('Poker data island (cards and amounts stay left-to-right)',
      h('div', { class: 'sheet-preview' }, preview, amounts)),
  );
}

function measureContrast() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (color) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
  const blend = (own, under) => own.slice(0, 3).map((v, i) => v * own[3] / 255 + under[i] * (1 - own[3] / 255));
  const backgroundOf = (node) => node ? blend(rgba(getComputedStyle(node).backgroundColor), backgroundOf(node.parentElement)) : rgba(getComputedStyle(document.body).backgroundColor);
  const hex = (rgb) => `#${rgb.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const rootStyle = getComputedStyle(root);
  const token = (name) => rgba(rootStyle.getPropertyValue(name).trim());
  const probes = [
    ['Primary button text (both gradient ends)', '[data-sheet-locale="en"] .ui-button[data-variant="primary"]:not(:disabled)', 4.5, 'gradient'],
    ['Secondary button text', '[data-sheet-locale="en"] .ui-button:not([data-variant]):not(:disabled):not([aria-pressed])', 4.5],
    ['Quiet button text', '[data-sheet-locale="en"] .ui-button[data-variant="quiet"]', 4.5],
    ['Danger button text', '[data-sheet-locale="en"] .ui-button[data-variant="danger"]', 4.5],
    ['Disabled button text', '[data-sheet-locale="en"] .ui-button[data-variant="primary"]:disabled', 3],
    ['Field text', '[data-sheet-locale="en"] input[type="text"]', 4.5],
    ['Field label', '[data-sheet-locale="en"] .ui-field > span', 4.5],
    ['Selected segment', '[data-sheet-locale="en"] .ui-tab[aria-pressed="true"]', 4.5],
    ['Selected segment caption', '[data-sheet-locale="en"] .card-rank-style-control .ui-tab[aria-pressed="true"] small', 4.5],
    ['Unselected segment', '[data-sheet-locale="en"] .ui-tab[aria-pressed="false"]', 4.5],
    ['Selected filter chip', '[data-sheet-locale="en"] .ui-chip[aria-pressed="true"]', 4.5],
    ['Chip count', '[data-sheet-locale="en"] .ui-chip-count', 4.5],
    ['Badge caution', '[data-sheet-locale="en"] .ui-badge[data-tone="caution"]', 4.5],
    ['Badge info', '[data-sheet-locale="en"] .ui-badge[data-tone="info"]', 4.5],
    ['Badge source (provenance)', '[data-sheet-locale="en"] .ui-badge[data-variant="source"]', 4.5],
    ['Callout caution text', '[data-sheet-locale="en"] .ui-callout[data-tone="caution"]', 4.5],
    ['Fact label', '[data-sheet-locale="en"] .ui-facts dt', 4.5],
    ['Fact value', '[data-sheet-locale="en"] .ui-facts dd', 4.5],
    ['Row meta', '[data-sheet-locale="en"] .ui-row-meta', 4.5],
    ['Checkbox glyph vs checked fill', '[data-sheet-locale="en"] .ui-check input:checked:not(:disabled)', 3, 'check'],
    ['Checkbox boundary vs surface', '[data-sheet-locale="en"] .ui-check input:not(:checked):not(:disabled)', 3, 'border'],
    ['Disabled checkbox boundary vs surface', '[data-sheet-locale="en"] .ui-check input:disabled:not(:checked)', 3, 'border'],
    ['Switch on: thumb vs track', '[data-sheet-locale="en"] .ui-switch[aria-checked="true"]', 3, 'thumb'],
    ['Switch on: track vs surface', '[data-sheet-locale="en"] .ui-switch[aria-checked="true"]', 3, 'track'],
    ['Switch on (.on / aria-pressed): thumb vs track', '[data-sheet-locale="en"] .switch.on[aria-pressed="true"]', 3, 'thumb'],
    ['Switch off: thumb vs track', '[data-sheet-locale="en"] .ui-switch[aria-checked="false"]', 3, 'thumb'],
    ['Switch off: track boundary vs surface', '[data-sheet-locale="en"] .ui-switch[aria-checked="false"]', 3, 'border'],
    ['t-hero / display / title / heading (primary)', '[data-sheet-locale="en"] .sheet-type .t-heading', 4.5],
    ['t-body prose (secondary)', '[data-sheet-locale="en"] .sheet-type .t-body', 4.5],
    ['t-small metadata (muted)', '[data-sheet-locale="en"] .sheet-type .t-small', 4.5],
    ['t-label label (muted)', '[data-sheet-locale="en"] .sheet-type .t-label', 4.5],
    ['Verdict fold (action text)', '[data-sheet-locale="en"] .t-hero[data-action="fold"]', 4.5],
    ['Verdict check/call (action text)', '[data-sheet-locale="en"] .t-hero[data-action="call"]', 4.5],
    ['Verdict bet/raise (action text)', '[data-sheet-locale="en"] .t-hero[data-action="raise"]', 4.5],
    ['Verdict all-in (action text)', '[data-sheet-locale="en"] .t-hero[data-action="all-in"]', 4.5],
    ['Verdict fold on Analyze primary surface', 'fold', 4.5, 'verdict'],
    ['Verdict check/call on Analyze primary surface', 'passive', 4.5, 'verdict'],
    ['Verdict bet/raise on Analyze primary surface', 'aggressive', 4.5, 'verdict'],
    ['Verdict all-in on Analyze primary surface', 'all-in', 4.5, 'verdict'],
  ];
  const results = probes.map(([name, selector, minimum, mode]) => {
    if (mode === 'verdict') {
      const fg = token(`--action-${selector}-text`), bg = token('--analysis-primary-surface');
      const ratio = contrastRatio(hex(fg), hex(bg));
      return { name, fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, minimum, pass: ratio >= minimum };
    }
    const node = document.querySelector(selector);
    if (!node) return { name, missing: true };
    const style = getComputedStyle(node);
    // A gradient fill (primary buttons) is measured against both gradient ends.
    const gradientEnds = mode === 'gradient' ? [token('--accent-primary'), token('--accent-primary-hover')] : null;
    const surface = backgroundOf(node.parentElement);
    const own = rgba(style.backgroundColor);
    const thumb = mode === 'thumb' ? rgba(getComputedStyle(node.querySelector('b')).backgroundColor) : null;
    const background = mode === 'check' || mode === 'thumb' ? own
      : mode === 'border' || mode === 'track' ? surface
      : gradientEnds ? gradientEnds[0] : backgroundOf(node);
    const fg = mode === 'check' ? rgba(getComputedStyle(node, '::before').backgroundColor)
      : mode === 'thumb' ? thumb
      : mode === 'border' ? blend(rgba(style.borderTopColor), surface)
      : mode === 'track' ? blend(own, surface)
      : blend(rgba(style.color), background);
    const ratio = Math.min(...(gradientEnds ?? [background]).map((bg) => contrastRatio(hex(fg), hex(bg))));
    return { name, fg: hex(fg), bg: hex(background), ratio: Math.round(ratio * 100) / 100, minimum, pass: ratio >= minimum };
  });
  // Brass provenance must stay distinct from the aggressive poker-action color.
  const provenance = rgba(getComputedStyle(document.querySelector('.ui-badge[data-variant="source"]')).color);
  const aggressive = rgba(rootStyle.getPropertyValue('--action-aggressive').trim());
  const distance = Math.hypot(...provenance.slice(0, 3).map((v, i) => v - aggressive[i]));
  results.push({ name: 'Provenance vs aggressive action (RGB distance)', fg: hex(provenance), bg: hex(aggressive), ratio: Math.round(distance), minimum: 60, pass: distance >= 60 });
  return { theme: root.dataset.presentationThemeId, results };
}

function renderContrast() {
  const report = measureContrast();
  const table = h('table', {}, h('tr', {}, ...['Pair', 'Foreground', 'Background', 'Ratio', 'Min'].map((text) => h('th', { text }))),
    ...report.results.map((r) => h('tr', { 'data-pass': String(r.pass !== false) }, h('td', { text: r.name }), h('td', { text: r.fg || 'missing' }), h('td', { text: r.bg || '' }), h('td', { text: String(r.ratio ?? '') }), h('td', { text: String(r.minimum ?? '') }))));
  document.getElementById('sheetContrast').replaceChildren(table);
  return report;
}

function renderAll() {
  document.querySelectorAll('[data-sheet-locale]').forEach(render);
  requestAnimationFrame(renderContrast);
}

const themeSelect = document.getElementById('sheetTheme');
const params = new URLSearchParams(location.search);
themeSelect.value = params.get('theme') || 'midnight';
applyTheme(themeSelect.value);
themeSelect.addEventListener('change', () => { applyTheme(themeSelect.value); renderAll(); });
document.getElementById('sheetFourColor').addEventListener('change', (event) => { root.dataset.fourColor = String(event.target.checked); });
document.getElementById('sheetCardStyle').addEventListener('change', (event) => { root.dataset.cardFaceStyle = event.target.value; root.dataset.cardStyle = event.target.value; });
window.dsSheet = Object.freeze({ setTheme: (id) => { themeSelect.value = id; applyTheme(id); renderAll(); return measureContrast(); }, contrast: measureContrast });
renderAll();
