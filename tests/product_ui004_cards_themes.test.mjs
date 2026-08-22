import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const themes = fs.readFileSync(new URL('../app/src/application/presentation-theme.mjs', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');

function fullTenRules(source) {
  return [...source.matchAll(/(?:^|})([^{}]*(?:rank--ten|table-card-rank--ten)[^{}]*)\{([^{}]*)\}/g)]
    .map(([, selector, declarations]) => ({ selector: selector.trim(), declarations }));
}

function assertFullTenUsesOnlyHorizontalGeometry(source) {
  const rules = fullTenRules(source);
  assert.ok(rules.length > 0, 'full-ten geometry rules must remain explicit');
  const allowedProperties = new Set([
    'display', 'width', 'min-inline-size', 'inline-size', 'letter-spacing',
    'text-align', 'transform', 'transform-origin', 'transform-box',
  ]);
  for (const { selector, declarations } of rules) {
    assert.doesNotMatch(declarations, /\bfont(?:-size)?\s*:/, `${selector} must inherit its sibling rank font`);
    assert.doesNotMatch(declarations, /scaleY\s*\(|\bscale\s*\(/, `${selector} may not vertically scale full-ten`);
    for (const [, property] of declarations.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)) {
      assert.ok(allowedProperties.has(property), `${selector} may only use horizontal full-ten geometry, not ${property}`);
    }
  }
}

test('all four Card Styles are available independently of T and full-ten notation', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="cardStyleSelect"/);
  for (const style of ['classic-mirrored', 'tournament', 'clean-corner', 'clarity-corner']) {
    assert.match(html, new RegExp(`value="${style}"`));
    assert.match(logic, new RegExp(`'${style}'`));
    assert.match(css, new RegExp(`data-card-style="${style}"`));
  }
  assert.match(logic, /const CARD_STYLES = Object\.freeze/);
  assert.match(logic, /function applyCardStyle\(style, refresh = true\)/);
  assert.match(logic, /riverline_card_style/);
  assert.match(logic, /document\.documentElement\.dataset\.cardStyle = nextStyle/);
  assert.match(logic, /riverlineCardStyleChanged/);
  assert.match(logic, /savedCardStyle = localStorage\.getItem\('riverline_card_style'\)/);
  assert.match(logic, /applyCardStyle\(savedCardStyle, false\)/);
  assert.match(table, /window\.addEventListener\('riverlineCardStyleChanged'/);
});

test('DOM cards use paired centered corners and full-ten retains matching rank height', () => {
  const markup = logic.match(/function cardMarkup\(card\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(markup, /card-corner--top/);
  assert.match(markup, /card-corner--bottom/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(css, /\.card-slot \{[^}]*overflow:\s*visible/);
  assert.match(css, /\.card-corner,[\s\S]*?justify-items:\s*center[\s\S]*?width:\s*22px[\s\S]*?text-align:\s*center/);
  assert.match(css, /\.card-slot \.card-corner \.rank,[\s\S]*?width:\s*100%/);
  assert.match(css, /\.card-slot \.card-corner \.rank,[\s\S]*?font-size:\s*15px/);
  assert.match(css, /\.deck-card \.card-corner \.rank \{[^}]*font-size:\s*13px/);
  assert.match(css, /\.training-readonly-card \.card-corner \.rank \{[^}]*font-size:\s*1rem/);
  assert.match(css, /\.card-corner--top \{[^}]*inset-inline-start:\s*5px[^}]*inset-block-start:\s*5px/);
  assert.match(css, /\.card-corner--bottom \{[\s\S]*?inset-inline-end:\s*5px[\s\S]*?inset-block-end:\s*5px[\s\S]*?rotate\(180deg\)/);
  assert.match(css, /\.card-slot \.card-corner \.rank--ten,[\s\S]*?display:\s*inline-block[\s\S]*?width:\s*28px[\s\S]*?min-inline-size:\s*28px[\s\S]*?letter-spacing:\s*-\.035em[\s\S]*?transform:\s*scaleX\(\.82\)/);
  assert.doesNotMatch(css, /\[data-card-rank-style="full-ten"\][^{]*\.card-slot/);
  assert.match(css, /\[data-card-style="tournament"\] \.card-corner--bottom,[\s\S]*?display:\s*none/);
  assert.match(css, /\[data-card-style="clean-corner"\] \.card-corner--bottom/);
  assert.match(css, /\[data-card-style="clarity-corner"\] \.card-corner--bottom \{[^}]*inset-inline-end:\s*7px[^}]*opacity:\s*\.34/);
  assert.match(css, /\[data-card-style="classic-mirrored"\] \.card-corner--bottom \{[^}]*opacity:\s*1/);
  assert.match(css, /\[data-card-style="classic-mirrored"\] \.card-corner--bottom \.rank \{[^}]*font-size:\s*15px/);
  assert.match(css, /\[data-card-style="clarity-corner"\] \.card-corner--bottom \.rank \{[^}]*font-size:\s*9px/);
  assert.match(css, /\[data-card-style="tournament"\] \.card-corner--top \.rank \{[^}]*font-size:\s*25px/);
  assert.match(css, /\[data-card-style="tournament"\] \.card-corner--top \.rank--ten \{[^}]*width:\s*1\.18em[^}]*transform:\s*scaleX\(\.82\)/);
  assertFullTenUsesOnlyHorizontalGeometry(css);
});

test('picker and Training cards consume the same face markup and rank preference refreshes visible analyses', () => {
  const deck = logic.match(/function renderDeck\(\)[\s\S]*?\n\}/)?.[0] || '';
  const training = logic.match(/function renderTrainingCards\(\)[\s\S]*?\n\}/)?.[0] || '';
  const rankStyle = logic.match(/function applyCardRankStyle\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(deck, /card-corner--top/);
  assert.match(deck, /card-corner--bottom/);
  assert.match(training, /\$\{cardMarkup\(card\)\}/);
  assert.match(rankStyle, /renderPlaybookDecisionAnalysis\(/);
  assert.match(rankStyle, /renderTrainingDecisionAnalysis\(/);
});

test('table cards expose bounded style variants without changing table geometry', () => {
  const renderCard = table.match(/renderCard\(rank, suit, index[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(renderCard, /table-card-corner--top/);
  assert.match(renderCard, /const secondaryCorner = cardStyle === 'clean-corner' \? ''/);
  assert.match(renderCard, /table-card-corner--bottom table-card-corner--\$\{cardStyle === 'clarity-corner' \? 'subdued' : 'full'\}/);
  assert.match(renderCard, /const cornerText =/);
  assert.match(renderCard, /table-card-corner-suit/);
  assert.match(renderCard, /card--style-\$\{cardStyle\}/);
  assert.match(renderCard, /data-card-style="\$\{cardStyle\}"/);
  assert.match(renderCard, /translate\(40 57\) rotate\(180\)/);
  assert.match(renderCard, /x="10" y="14" text-anchor="middle"/);
  assert.match(renderCard, /x="10" y="27" text-anchor="middle"/);
  assert.match(renderCard, /table-card-tournament/);
  assert.match(renderCard, /const visualRank = rank === 'T'/);
  assert.match(renderCard, /const rankClass = visualRank === '10'/);
  assert.match(table, /width="40" height="57" rx="5" ry="5"/);
  assert.match(css, /\.table-card-corner-suit \{[^}]*font:/);
  assert.match(css, /\.table-card-corner--top \.table-card-corner-rank \{[^}]*font-size:\s*15px/);
  assert.match(css, /\.table-card-corner-rank\.table-card-rank--ten \{[^}]*letter-spacing:\s*-\.06em[^}]*transform:\s*scaleX\(\.82\)/);
  assert.match(css, /\.riverline-card-tournament-rank \{[^}]*23px/);
  assert.match(css, /\.riverline-card-tournament-rank\.table-card-rank--ten \{[^}]*letter-spacing:\s*-\.07em[^}]*transform:\s*scaleX\(\.82\)/);
  assertFullTenUsesOnlyHorizontalGeometry(css);
  assert.match(css, /\.poker-card-svg\.card--style-clarity-corner \.table-card-corner--subdued \{[^}]*opacity:\s*\.34/);
  const cardBounds = { width: 40, height: 57 };
  for (const [x, y] of [[10, 14], [10, 27], [20, 25], [20, 42]]) {
    assert.ok(x > 0 && x < cardBounds.width);
    assert.ok(y > 0 && y < cardBounds.height);
  }
});

test('Clean Corner keeps its primary table corner while omitting the secondary markup', () => {
  const renderCard = table.match(/renderCard\(rank, suit, index[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(renderCard, /const secondaryCorner = cardStyle === 'clean-corner' \? ''/);
  assert.match(renderCard, /const cornerMarkup = cardStyle === 'tournament' \? ''/);
  assert.match(renderCard, /table-card-corner--top/);
  assert.match(renderCard, /riverline-card-corner-rank table-card-corner-rank\$\{rankClass\}/);
  assert.match(renderCard, /riverline-card-corner-suit table-card-corner-suit/);
  assert.match(css, /\[data-card-style="clean-corner"\] \.table-card-corner--bottom \{ display:\s*none; \}/);
});

test('Classic and Clarity secondary corners have distinct semantic presentation', () => {
  assert.match(table, /cardStyle === 'clarity-corner' \? 'subdued' : 'full'/);
  assert.match(css, /card--style-classic-mirrored \.table-card-corner--full \{[^}]*opacity:\s*1/);
  assert.match(css, /card--style-clarity-corner \.table-card-corner--subdued \{[^}]*opacity:\s*\.34/);
  assert.match(css, /card--style-clarity-corner \.table-card-corner--subdued \.table-card-corner-rank \{[^}]*font-size:\s*7px/);
  assert.match(css, /card--style-classic-mirrored \.table-card-corner--full \.table-card-corner-rank \{[^}]*font-size:\s*10px/);
});

test('Analysis hero cards use spacious suit notation, separate from table Card Style', () => {
  assert.match(teacher, /const ANALYSIS_CARD_SUITS = Object\.freeze/);
  assert.match(teacher, /function analysisCardTokenElement\(card\)/);
  assert.match(teacher, /token\.setAttribute\('aria-label', `\$\{rank\}\$\{suit\.symbol\}`\)/);
  assert.match(teacher, /function analysisCardPairElement\(analysisFact\)/);
  assert.match(teacher, /analysisFact\.key === 'hero_cards'/);
  assert.match(css, /\.analysis-card-token \{[^}]*gap:\s*var\(--space-3\)/);
  assert.match(css, /\.analysis-mini-card \{[^}]*font:\s*800 1rem/);
  assert.doesNotMatch(css.match(/\.analysis-mini-card \{[^}]*\}/)?.[0] || '', /background:|border:|border-radius:/);
  assert.match(css, /\[dir="rtl"\] \.analysis-card-token \{[^}]*direction:\s*ltr/);
  assert.doesNotMatch(teacher, /cardStyle|riverline_card_style/);
  assert.doesNotMatch(teacher, /calculateEquity|evaluateSeven|DecisionContext|StrategyResult/);
});

test('four-color semantics and Daylight controls retain their semantic tokens', () => {
  for (const [suit, color] of Object.entries({ heart: '#c83e48', spade: '#18201c', diamond: '#326fb5', club: '#328755' })) {
    assert.match(css, new RegExp(`--suit-${suit}:\\s*${color}`, 'i'));
  }
  assert.match(css, /select, input\[type=number\] \{[\s\S]*?background:\s*var\(--surface-interactive\)[\s\S]*?color:\s*var\(--text-primary\)/);
  assert.doesNotMatch(css.match(/select, input\[type=number\] \{[\s\S]*?\n\}/)?.[0] || '', /#0b1120/);
});

test('theme names are curated user-facing descriptions without legacy or debug labels', () => {
  assert.doesNotMatch(themes, /name: '[^']*\(0px\)|legacy:\s*true/);
  assert.doesNotMatch(themes, /Discord|Terminal|Brutalist|Casino|Cyberpunk|Luxury/);
  assert.match(themes, /name: 'Riverline Midnight'/);
  assert.match(themes, /name: 'Riverline Graphite'/);
  assert.match(themes, /name: 'Riverline Daylight'/);
  assert.doesNotMatch(logic, /THEME_PREVIEWS|initThemeSwatches/);
});
