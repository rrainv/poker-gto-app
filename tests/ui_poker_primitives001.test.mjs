import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const primitiveSource = fs.readFileSync(
  new URL('../app/src/ui/PokerPrimitives.js', import.meta.url),
  'utf8',
);
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const translations = fs.readFileSync(
  new URL('../app/src/locales/analysis-translations.js', import.meta.url),
  'utf8',
);

const sandbox = {};
vm.runInNewContext(primitiveSource, sandbox);
const primitives = sandbox.RiverlinePokerPrimitives;
const contributionPointStart = renderer.indexOf('function tableContributionPoint(');
const contributionPointEnd = renderer.indexOf('\nclass TableRenderer', contributionPointStart);
const geometrySandbox = {};
vm.runInNewContext(
  `${renderer.slice(contributionPointStart, contributionPointEnd)}\nthis.tableContributionPoint = tableContributionPoint;`,
  geometrySandbox,
);
const { tableContributionPoint } = geometrySandbox;

test('one scalable chip visual authority serves inline glyphs and physical table stacks', () => {
  assert.ok(primitives);
  assert.equal(Object.isFrozen(primitives), true);
  assert.deepEqual([...Object.keys(primitives.sizes)], ['small', 'normal']);
  assert.ok(html.indexOf('src/ui/PokerPrimitives.js') < html.indexOf('src/ui/TableRenderer.js'));
  assert.equal((html.match(/src\/ui\/PokerPrimitives\.js/g) || []).length, 1);

  const visual = primitives.pokerChipVisualSvg({ transform: 'scale(2)' });
  const sharedVisual = primitives.pokerChipVisualSvg().trim();
  const small = primitives.pokerChipGlyphSvg({ size: 'small' });
  const normal = primitives.pokerChipGlyphSvg({ size: 'normal' });
  const stack = primitives.pokerChipStackSvg({ transform: 'scale(1.25)' });
  assert.match(visual, /<g class="poker-chip-visual" transform="scale\(2\)"/);
  assert.doesNotMatch(visual, /width=|height=|viewBox=/);
  assert.equal((visual.match(/class="poker-chip-body"/g) || []).length, 1);
  assert.equal((visual.match(/<path d=/g) || []).length, 8);
  assert.match(visual, /poker-chip-edge-inserts/);
  assert.match(visual, /poker-chip-inner-ring/);
  assert.match(visual, /poker-chip-core/);
  for (const markup of [small, normal]) {
    assert.match(markup, /<svg[^>]*class="poker-chip-glyph/);
    assert.ok(markup.includes(sharedVisual));
    assert.match(markup, /aria-hidden="true"[^>]*focusable="false"/);
  }
  assert.match(small, /width="14" height="14"/);
  assert.match(normal, /width="18" height="18"/);
  assert.match(stack, /class="poker-chip-stack poker-chip-stack--pair" transform="scale\(1\.25\)"/);
  assert.equal((stack.match(/class="poker-chip-visual poker-chip-stack-/g) || []).length, 2);
  assert.equal((stack.match(/class="poker-chip-body"/g) || []).length, 2);
  assert.doesNotMatch(primitiveSource, /emoji|icon-font|fontawesome|material-icons|lucide|coin|\p{Extended_Pictographic}/iu);
});

test('amount contract preserves trusted display text and semantic number-unit order', () => {
  const markup = primitives.pokerAmountSvg({
    prefix: 'Pot', value: '2.500', unit: 'bb', ariaLabel: 'Pot 2.500 big blinds',
  });
  assert.match(markup, /class="poker-amount poker-amount--normal"/);
  assert.match(markup, /poker-amount-prefix">Pot <\/tspan><tspan class="poker-amount-value">2\.500<\/tspan><tspan class="poker-amount-unit"> bb<\/tspan>/);
  assert.match(markup, /role="group" aria-label="Pot 2\.500 big blinds"/);
  assert.doesNotMatch(markup, /poker chip icon/i);
  assert.doesNotMatch(primitiveSource, /toFixed|Intl\.NumberFormat|parseFloat|parseInt|\/\s*1000|Math\./);
  assert.equal(primitives.sizes.small.width, 76);
  assert.equal(primitives.sizes.normal.width, 112);
  assert.ok(primitives.sizes.small.textX - primitives.sizes.small.chipX < 40);
});

test('decorative chip stays silent while the amount can expose one accessible label', () => {
  const markup = primitives.pokerAmountSvg({
    size: 'small', value: '96', unit: 'bb', ariaLabel: '96 big blinds',
  });
  assert.match(markup, /role="group" aria-label="96 big blinds"/);
  assert.match(markup, /class="poker-chip-glyph[^>]*aria-hidden="true"/);

  const nodes = {
    '.poker-amount-prefix': { textContent: '' },
    '.poker-amount-value': { textContent: '' },
    '.poker-amount-unit': { textContent: '' },
  };
  const attributes = new Map();
  const element = {
    querySelector(selector) { return nodes[selector]; },
    toggleAttribute(name, present) { if (present) attributes.set(name, ''); else attributes.delete(name); },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
  };
  primitives.setPokerAmount(element, {
    prefix: 'Pot', value: '14.25', unit: 'bb', ariaLabel: 'Pot 14.25 big blinds',
  });
  assert.equal(nodes['.poker-amount-prefix'].textContent, 'Pot ');
  assert.equal(nodes['.poker-amount-value'].textContent, '14.25');
  assert.equal(nodes['.poker-amount-unit'].textContent, ' bb');
  assert.equal(attributes.get('aria-label'), 'Pot 14.25 big blinds');
});

test('physical table amount groups have no nested viewport that can clip chip or label', () => {
  const markup = primitives.pokerTableAmountSvg({
    id: 'table-pot',
    className: 'table-pot',
    size: 'normal',
    x: 400,
    y: 213,
    prefix: 'Pot',
    value: '123.5',
    unit: 'bb',
    ariaHidden: true,
    visualVariant: 'pot',
  });
  assert.match(markup, /<g id="table-pot" class="poker-table-amount poker-table-amount--normal poker-table-amount--pot table-pot"/);
  assert.match(markup, /transform="translate\(400 213\)"/);
  assert.match(markup, /poker-table-amount-chip-stack/);
  assert.match(markup, /class="poker-table-amount-surface"/);
  assert.equal((markup.match(/class="poker-chip-body"/g) || []).length, 4);
  assert.match(markup, /text-anchor="start"/);
  assert.match(markup, /poker-amount-prefix">Pot <\/tspan><tspan class="poker-amount-value">123\.5/);
  assert.doesNotMatch(markup, /<svg|viewBox=/);
});

test('Hebrew keeps each amount as an LTR poker-data island', () => {
  const markup = primitives.pokerAmountSvg({ prefix: 'קופה', value: '100', unit: 'bb' });
  assert.match(markup, /dir="ltr"/);
  assert.ok(markup.indexOf('poker-chip') < markup.indexOf('קופה'));
  assert.ok(markup.indexOf('קופה') < markup.indexOf('100'));
  assert.ok(markup.indexOf('100') < markup.indexOf(' bb'));
  assert.match(css, /\.poker-amount\s*\{[\s\S]*?direction:\s*ltr;[\s\S]*?unicode-bidi:\s*isolate/);
  assert.match(css, /\.poker-amount-prefix,[\s\S]*?\.poker-amount-unit \{ unicode-bidi: isolate; \}/);
  assert.match(css, /\.poker-amount-value,[\s\S]*?\.poker-amount-unit \{ direction: ltr; \}/);
  assert.match(css, /\[dir="rtl"\] \.poker-amount/);
});

test('chip color and amount typography are token-driven in Midnight and Daylight', () => {
  assert.match(css, /\.poker-chip-glyph,[\s\S]*?\.poker-table-amount\s*\{[\s\S]*?color:\s*var\(--accent-primary\)/);
  assert.match(css, /\.poker-chip-body\s*\{[\s\S]*?currentColor/);
  assert.match(css, /\.poker-chip-edge-inserts\s*\{[\s\S]*?var\(--surface-overlay\)/);
  assert.match(css, /\.poker-amount-text\s*\{[\s\S]*?fill:\s*var\(--text-primary\)/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\[data-theme="midnight"\]/);
  assert.match(css, /\[data-theme="daylight"\]/);
  assert.doesNotMatch(primitiveSource, /#[0-9a-f]{3,8}/i);
});

test('table keeps inline stacks while pot and contributions use physical chip groups', () => {
  assert.match(renderer, /id: 'table-pot',[\s\S]*?className: 'table-pot'[\s\S]*?size: 'normal'/);
  assert.match(renderer, /id: `seat-stack-\$\{i\}`[\s\S]*?className: 'table-seat-meta table-seat-stack'[\s\S]*?size: 'small'/);
  assert.match(renderer, /id: `seat-stack-\$\{i\}`[\s\S]*?chipStyle: 'stack'/);
  assert.match(renderer, /id: `contribution-\$\{i\}`,[\s\S]*?className: 'table-contribution',[\s\S]*?size: 'small'/);
  assert.match(renderer, /visualVariant: 'pot'/);
  assert.match(renderer, /visualVariant: 'contribution'/);
  assert.match(renderer, /id="table-contributions-layer" class="table-contributions-layer"/);
  assert.match(renderer, /contributionsLayer\.innerHTML = contributionsHtml/);
  assert.match(renderer, /this\.setPokerAmount\(stack/);
  assert.match(renderer, /this\.setPokerAmount\(contribution/);
  assert.match(renderer, /this\.setPokerAmount\(pot/);
  assert.match(renderer, /id="contribution-lane-\$\{i\}" class="table-contribution-lane"/);
  assert.match(primitiveSource, /poker-table-amount-surface/);
  assert.equal((translations.match(/'table\.potLabel':/g) || []).length, 3);
});

test('bottom, top, and side contributions share one symmetric radial seat-to-pot rule', () => {
  assert.deepEqual(
    { ...tableContributionPoint({ centerX: 400, centerY: 250, seatX: 400, seatY: 460 }) },
    { x: 400, y: 355 },
  );
  assert.deepEqual(
    { ...tableContributionPoint({ centerX: 400, centerY: 250, seatX: 400, seatY: 40 }) },
    { x: 400, y: 145 },
  );
  assert.deepEqual(
    { ...tableContributionPoint({ centerX: 400, centerY: 250, seatX: 740, seatY: 250 }) },
    { x: 570, y: 250 },
  );

  for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
    const points = [];
    for (let visualSeatIndex = 0; visualSeatIndex < playerCount; visualSeatIndex += 1) {
      const angle = (Math.PI / 2) + (visualSeatIndex * (2 * Math.PI / playerCount));
      const seatX = Math.round(400 + (340 * Math.cos(angle)));
      const seatY = Math.round(250 + (210 * Math.sin(angle)));
      const point = tableContributionPoint({ centerX: 400, centerY: 250, seatX, seatY });
      points.push(point);
      const seatVectorX = seatX - 400;
      const seatVectorY = seatY - 250;
      const pointVectorX = point.x - 400;
      const pointVectorY = point.y - 250;
      const perpendicularDistance = Math.abs(
        (seatVectorX * pointVectorY) - (seatVectorY * pointVectorX),
      ) / Math.hypot(seatVectorX, seatVectorY);
      assert.ok(perpendicularDistance < Number.EPSILON,
        `${playerCount}-player seat ${visualSeatIndex} drifted off its radial line`);
      assert.ok(Math.hypot(pointVectorX, pointVectorY) < Math.hypot(seatVectorX, seatVectorY),
        `${playerCount}-player seat ${visualSeatIndex} did not move inward`);
      const insideBettingLine = (((point.x - 400) / 300) ** 2)
        + (((point.y - 250) / 150) ** 2);
      assert.ok(insideBettingLine <= 1, `${playerCount}-player seat ${visualSeatIndex} clipped`);
      const overlapsCardLane = point.x + 38 >= seatX - 33
        && point.x - 38 <= seatX + 33
        && point.y + 10 >= seatY - 94
        && point.y - 10 <= seatY - 36;
      assert.equal(overlapsCardLane, false,
        `${playerCount}-player seat ${visualSeatIndex} overlaps cards`);
    }
    if (playerCount % 2 === 0) {
      for (let index = 0; index < playerCount / 2; index += 1) {
        const opposite = points[index + (playerCount / 2)];
        assert.equal(points[index].x + opposite.x, 800,
          `${playerCount}-player opposite seats must mirror horizontally`);
        assert.equal(points[index].y + opposite.y, 500,
          `${playerCount}-player opposite seats must mirror vertically`);
      }
    }
  }

  assert.match(renderer, /tableContributionPoint\(\{[\s\S]*?centerX, centerY, seatX: x, seatY: y/);
  assert.ok(renderer.indexOf('id="table-contributions-layer"') < renderer.indexOf('id="seats-layer"'));
  assert.doesNotMatch(renderer, /activePlayers\s*===?\s*(?:2|6|10)/);
  assert.doesNotMatch(tableContributionPoint.toString(), /hero|button|position|dealer|isHero/i);
});

test('a real card collision receives only the minimum inward correction on the same ray', () => {
  const corrected = tableContributionPoint({
    centerX: 400, centerY: 250, seatX: 400, seatY: 400,
  });
  assert.deepEqual({ ...corrected }, { x: 400, y: 295 });
  assert.equal(corrected.x, 400);
  assert.ok(corrected.y < 325);
  assert.doesNotMatch(tableContributionPoint.toString(), /ClearanceX|directionAway|mirroredPoint/);
});

test('every trusted non-zero contribution renders once and zero or reset values hide it', () => {
  const contributionRender = renderer.slice(
    renderer.indexOf('if (contribution) {'),
    renderer.indexOf('if (action) {', renderer.indexOf('if (contribution) {')),
  );
  assert.match(contributionRender, /const isVisible = state\.showStreetContributions === true[\s\S]*?player\.streetContributionMilliBb > 0/);
  assert.match(contributionRender, /contributionLane\?\.toggleAttribute\('hidden', !isVisible\)/);
  assert.match(contributionRender, /contribution\.toggleAttribute\('hidden', !isVisible\)/);
  assert.match(contributionRender, /this\.setPokerAmount\(contribution/);
  assert.doesNotMatch(contributionRender, /isHero|visualSeatIndex\s*===?\s*0|position|isButton/);
  assert.equal((renderer.match(/id: `contribution-\$\{i\}`/g) || []).length, 1);
});

test('Replay emphasis continues to animate complete amount regions for all table sizes', () => {
  assert.match(renderer, /seat\.querySelector\('\.table-seat-stack'\)\?\.classList\.add\('is-replay-value-motion'\)/);
  assert.match(renderer, /querySelector\(`#contribution-\$\{change\.visualSeatIndex\}`\)/);
  assert.match(renderer, /motion\.transitionKind === 'action'[\s\S]*?state\.showStreetContributions === false[\s\S]*?state\.status === 'awaiting_board'/);
  assert.doesNotMatch(renderer, /change\.contribution\.previousMilliBb > 0[\s\S]*?change\.contribution\.nextMilliBb === 0/);
  assert.match(renderer, /querySelector\('#table-pot'\)\?\.classList\.add\('is-replay-pot-motion'\)/);
  assert.match(css, /\.is-replay-value-motion/);
  assert.match(css, /\.table-pot\.is-replay-pot-motion/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#visual-table-container \.is-replay-value-motion/);
  assert.match(renderer, /for \(let i = 0; i < activePlayers; i\+\+\)/);
  assert.doesNotMatch(renderer, /activePlayers\s*===?\s*(?:2|6|10)/);
});

test('primitive and renderer introduce no poker-domain or amount arithmetic authority', () => {
  assert.doesNotMatch(primitiveSource, /PokerState|TablePresence|applyAction|potMilliBb|streetContributionMilliBb|shared\/poker-domain/);
  assert.doesNotMatch(primitiveSource, /\b(?:add|subtract|multiply|divide|calculate|derive|infer)(?:Bb|Amount|Pot|Stack)/i);
  assert.doesNotMatch(renderer, /potMilliBb\s*[-+*/]|streetContributionMilliBb\s*[-+*/]|currentStackMilliBb\s*[-+*/]/);
});
