import { assertUniqueKnownCards, createAction, createGameRulesSnapshot, createGameRulesDefinition, getLegalActionSpec } from '../../../shared/poker-domain/index.js';
import { createCanonicalHandSession } from './canonical-hand-session.mjs';
import { parsePokerStarsHistory } from './hand-history-pokerstars.mjs';
import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';

export const HAND_IMPORT_VERSION = 'hand-history-import/v1';
export const RECONSTRUCTION_VERSION = 'hand-import-reconstruction/v1';
export async function fingerprintHandHistory(rawText) {
  const bytes = new TextEncoder().encode(rawText);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
function failure(code, line = 0, classification = 'ambiguous') {
  return Object.assign(new Error(code), { code, line, classification });
}
function minorUnits(token, currency) {
  const symbol = { USD: '$', EUR: '€', GBP: '£' }[currency];
  if (typeof token !== 'string' || !new RegExp('^' + symbol.replace('$', '\\$') + '?\\d+(?:\\.\\d{1,2})?$').test(token)) throw failure('money_format');
  const [whole, fraction = ''] = token.replace(/^[€£$]/, '').split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
// Normalizes decimal source units exactly. No floating-point money arithmetic.
export function normalizeHandImport(parsed) {
  const diagnostics = [...parsed.diagnostics];
  if (diagnostics.some(item => item.blocking !== false)) return { request: null, diagnostics };
  try {
    const big = minorUnits(parsed.blinds.big, parsed.currency);
    if (big <= 0n) throw failure('blind_amount');
    const amount = token => {
      const value = minorUnits(token, parsed.currency) * 1000n;
      if (value % big !== 0n || value / big > BigInt(Number.MAX_SAFE_INTEGER)) throw failure('money_precision', 0, 'unsupported');
      return Number(value / big);
    };
    // One cent is the explicitly supported source currency unit, never rounded.
    if (1000n % big !== 0n) throw failure('money_precision', 0, 'unsupported');
    const chipUnitMilliBb = Number(1000n / big);
    if (parsed.players.length < 2 || parsed.players.length > parsed.table.capacity || parsed.table.capacity > 10) throw failure('table_size');
    const names = new Set(), seats = new Set();
    const players = parsed.players.map(player => {
      if (names.has(player.name) || seats.has(player.seat) || player.seat < 1 || player.seat > parsed.table.capacity) throw failure('duplicate_player', player.line);
      names.add(player.name); seats.add(player.seat);
      return { playerId: `seat-${player.seat}`, seat: player.seat - 1, startingStackMilliBb: amount(player.stack), sourceName: player.name };
    });
    const id = (name, line) => { const player = players.find(p => p.sourceName === name); if (!player) throw failure('unknown_player', line); return player.playerId; };
    const posts = parsed.posts.map(p => ({ ...p, playerId: id(p.name, p.line), amountMilliBb: amount(p.amount) }));
    for (const kind of ['small blind', 'big blind']) if (posts.filter(p => p.kind === kind).length !== 1) throw failure('blind_posts');
    const antes = posts.filter(p => p.kind === 'the ante');
    if (antes.length && (antes.length !== players.length || new Set(antes.map(p => p.playerId)).size !== players.length || new Set(antes.map(p => p.amountMilliBb)).size !== 1)) throw failure('ante_unsupported', 0, 'unsupported');
    const events = parsed.events.map(event => ({ ...event,
      ...(event.name ? { playerId: id(event.name, event.line) } : {}),
      ...(event.amount ? { amountMilliBb: amount(event.amount) } : {}),
      ...(event.increment ? { incrementMilliBb: amount(event.increment) } : {}) }));
    const heroPlayerId = id(parsed.hero.name, parsed.hero.line);
    const known = new Map([[heroPlayerId, parsed.hero.cards]]);
    for (const event of events.filter(e => e.kind === 'reveal')) {
      if (event.cards.length !== 2) throw failure('showdown_cards', event.line);
      if (known.has(event.playerId) && [...known.get(event.playerId)].sort().join() !== [...event.cards].sort().join()) throw failure('conflicting_cards', event.line);
      known.set(event.playerId, event.cards);
    }
    if (parsed.hero.cards.length !== 2) throw failure('hero_cards');
    try { assertUniqueKnownCards([...known].map(([label, cards]) => ({ label, cards })).concat(events.filter(e => e.kind === 'board').map(e => ({ label: e.street, cards: e.cards })))); }
    catch { throw failure('duplicate_or_invalid_cards'); }
    const payoutsMilliBbByPlayer = {};
    for (const award of parsed.awards) { const playerId = id(award.name, award.line); payoutsMilliBbByPlayer[playerId] = (payoutsMilliBbByPlayer[playerId] ?? 0) + amount(award.amount); }
    if (!parsed.awards.length) throw failure('missing_awards', 0, 'missing');
    const summarySeats = new Set();
    const summaryPlayers = [];
    for (const row of parsed.summarySeats) {
      const player = players.find(p => p.seat === row.seat - 1);
      if (!player || summarySeats.has(row.seat) || !row.text.startsWith(player.sourceName + ' ')) throw failure('summary_player', row.line);
      summarySeats.add(row.seat);
      const tail = row.text.slice(player.sourceName.length).replace(/ \((?:button|small blind|big blind)\)/g, '').trim();
      const match = tail.match(/^(?:showed|mucked) \[([^\]]+)\] (.+)$/);
      if (match) {
        if (!/^and (?:lost(?: with .+)?|won \([€£$]?\d+(?:\.\d{1,2})?\)(?: with .+)?)$/.test(match[2])) throw failure('summary_unsupported', row.line, 'unsupported');
        const supplied = match[1].split(/\s+/);
        if (!known.has(player.playerId) || [...supplied].sort().join() !== [...known.get(player.playerId)].sort().join()) throw failure('summary_cards', row.line);
      } else if (!/^(?:mucked|folded (?:before Flop|on the (?:Flop|Turn|River))(?: \(didn't bet\))?|collected \([€£$]?\d+(?:\.\d{1,2})?\))$/.test(tail)) throw failure('summary_unsupported', row.line, 'unsupported');
      const win = tail.match(/(?:won|collected) \(([€£$]?\d+(?:\.\d{1,2})?)\)/);
      if (win && amount(win[1]) !== payoutsMilliBbByPlayer[player.playerId]) throw failure('summary_award', row.line);
      if (!win && payoutsMilliBbByPlayer[player.playerId]) throw failure('summary_award', row.line);
      const fold = tail.match(/^folded (before Flop|on the Flop|on the Turn|on the River)/);
      summaryPlayers.push({ playerId: player.playerId, foldedStreet: fold ? { 'before Flop': 'preflop', 'on the Flop': 'flop', 'on the Turn': 'turn', 'on the River': 'river' }[fold[1]] : null, line: row.line });
    }
    if (summarySeats.size !== players.length) throw failure('missing_summary_players', 0, 'missing');
    return { diagnostics, request: {
      schemaVersion: 'canonical-hand-reconstruction-request/v1', players, heroPlayerId, heroCards: parsed.hero.cards,
      buttonSeat: parsed.table.buttonSeat - 1, posts, events, summaryBoard: parsed.summaryBoard, summaryPlayers,
      rules: { smallBlindMilliBb: amount(parsed.blinds.small), bigBlindMilliBb: 1000, chipUnitMilliBb,
        ante: { type: antes.length ? 'per_player' : 'none', amountMilliBb: antes[0]?.amountMilliBb ?? 0 } },
      settlement: { schemaVersion: 'recorded-hand-settlement/v1', grossPotMilliBb: amount(parsed.summary.pot), rakeMilliBb: amount(parsed.summary.rake), payoutsMilliBbByPlayer }
    } };
  } catch (error) { diagnostics.push({ code: error.code ?? 'normalization_failed', line: error.line ?? 0, classification: error.classification ?? 'ambiguous' }); return { request: null, diagnostics }; }
}

export function reconstructImportedHand(request, handId) {
  const session = createCanonicalHandSession(); let line = 0;
  try {
    const rulesSnapshot = createGameRulesSnapshot({ source: { kind: 'direct' }, setup: { seatedPlayers: request.players.length },
      definition: createGameRulesDefinition({ schemaVersion: 'game-rules-definition/v2', variant: 'no_limit_texas_holdem', format: 'cash',
        tableSize: { minimumSeated: 2, maximumSeated: 10 }, blinds: { smallBlindMilliBb: request.rules.smallBlindMilliBb,
          bigBlindMilliBb: 1000, chipUnitMilliBb: request.rules.chipUnitMilliBb }, ante: request.rules.ante,
        straddle: { type: 'none' }, collectionPolicy: { type: 'none' }, recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' } }) });
    session.initializeRecordedHand({ handId, rulesSnapshot, buttonSeat: request.buttonSeat,
      players: request.players.map(({ sourceName: _, ...player }) => player) });
    session.configureHero({ heroPlayerId: request.heroPlayerId });
    const posted = session.getState().ledger;
    for (const post of request.posts) {
      line = post.line;
      const kind = { 'small blind': 'small_blind', 'big blind': 'big_blind', 'the ante': 'ante' }[post.kind];
      if (!posted.some(entry => entry.kind === kind && entry.playerId === post.playerId && entry.amountMilliBb === post.amountMilliBb)) throw failure('posting_mismatch', line);
    }
    session.applyChance({ type: 'deal_hole', cardsByPlayer: { [request.heroPlayerId]: request.heroCards }, hiddenPlayerIds: request.players.filter(p => p.playerId !== request.heroPlayerId).map(p => p.playerId) });
    const refunds = new Set();
    for (const event of request.events) {
      line = event.line; const before = session.getState();
      if (event.kind === 'board') {
        if (event.prior.join() !== before.board.join()) throw failure('board_prefix', line);
        session.applyChance({ type: `deal_${event.street}`, cards: event.cards });
      } else if (event.kind === 'action') {
        if (event.street !== before.street) throw failure('street_order', line);
        const legal = getLegalActionSpec(before);
        if (event.type === 'call' && (!legal.call.available || legal.call.commitMilliBb !== event.amountMilliBb)) throw failure('call_amount', line);
        if (event.type === 'bet' && before.currentBetMilliBb !== 0) throw failure('bet_amount', line);
        if (event.type === 'raise' && (before.currentBetMilliBb === 0 || event.amountMilliBb <= before.currentBetMilliBb)) throw failure('raise_amount', line);
        if (event.type === 'raise' && event.amountMilliBb - before.currentBetMilliBb !== event.incrementMilliBb) throw failure('raise_amount', line);
        const type = event.allIn ? 'all_in' : event.type;
        session.applyAction(createAction(event.playerId, type, ['raise', 'bet'].includes(type) ? event.amountMilliBb : null));
        const record = session.getState().actionHistory.at(-1);
        if (event.allIn && ['raise', 'bet'].includes(event.type) && record.streetContributionAfterMilliBb !== event.amountMilliBb) throw failure('allin_amount', line);
        if (event.type === 'call' && record.committedMilliBb !== event.amountMilliBb) throw failure('call_amount', line);
        if (Boolean(event.allIn) !== record.wasAllIn && ['call', 'bet', 'raise'].includes(event.type)) throw failure('allin_amount', line);
      } else if (event.kind === 'reveal') {
        const player = before.players.find(p => p.playerId === event.playerId);
        if (Array.isArray(player.holeCards)) { if ([...player.holeCards].sort().join() !== [...event.cards].sort().join()) throw failure('conflicting_cards', line); }
        else session.revealPrivateCards({ playerId: event.playerId, cards: event.cards });
      } else if (event.kind === 'refund') {
        const entry = before.ledger.find(e => e.kind === 'uncalled_refund' && e.street === before.street && !refunds.has(e.sequence) && e.playerId === event.playerId && e.amountMilliBb === event.amountMilliBb);
        if (!entry) throw failure('refund_mismatch', line); refunds.add(entry.sequence);
      } else if (event.kind === 'award') {
        if (!['terminal', 'showdown'].includes(before.phase)) throw failure('premature_award', line);
      }
    }
    let state = session.getState();
    for (const summary of request.summaryPlayers) {
      const player = state.players.find(p => p.playerId === summary.playerId);
      const fold = state.actionHistory.find(a => a.playerId === summary.playerId && a.submittedAction.type === 'fold');
      if (Boolean(summary.foldedStreet) !== player.folded || summary.foldedStreet !== (fold?.street ?? null)) throw failure('summary_action', summary.line);
    }
    if ((request.summaryBoard ?? []).join() !== state.board.join()) throw failure('summary_board');
    if (state.ledger.filter(e => e.kind === 'uncalled_refund').length !== refunds.size) throw failure('missing_refund', 0, 'missing');
    if (state.phase === 'showdown') {
      if (state.players.some(p => !p.folded && !Array.isArray(p.holeCards))) throw failure('missing_showdown_cards', line, 'missing');
      session.resolveShowdown();
    }
    if (!session.getState().terminal.isTerminal) throw failure('incomplete_hand', line, 'missing');
    session.applyRecordedSettlement(request.settlement);
    return { status: 'complete', pokerState: session.getState(), heroPlayerId: request.heroPlayerId,
      replaySource: session.createCanonicalHandReplaySource(), journal: session.getHeroDecisionJournal(), completedHandResult: session.getCompletedHandResult() };
  } catch (error) {
    return { status: 'partial', pokerState: null, replaySource: null,
      reconstructedThrough: session.getState()?.street ?? null,
      diagnostic: { code: error.code ?? 'canonical_legality', line: error.line ?? line, classification: error.classification ?? 'ambiguous', detail: error.message } };
  }
}

export async function importHandHistory(rawText) {
  const parsed = parsePokerStarsHistory(rawText);
  const fingerprint = await fingerprintHandHistory(typeof rawText === 'string' ? rawText : '');
  const { request, diagnostics } = normalizeHandImport(parsed);
  const handId = `import-${fingerprint.slice(7)}`;
  const reconstruction = request ? reconstructImportedHand(request, handId) : { status: 'partial', pokerState: null, replaySource: null };
  if (reconstruction.diagnostic) diagnostics.push(reconstruction.diagnostic);
  const factSummary = { exact: request ? ['source:header', 'source:seats', 'source:posts', 'source:actions', 'source:cards', 'source:settlement'] : [],
    inferred: request ? ['format:raise_is_street_total_to', 'format:currency_minor_unit', ...(request.rules.ante.type === 'none' ? ['format:no_ante_when_no_ante_posts'] : [])] : [], missing: [], ambiguous: [], unsupported: [] };
  for (const d of diagnostics) factSummary[d.classification].push(`line:${d.line}:${d.code}`);
  const importProvenance = { schemaVersion: 'hand-import-provenance/v1', importVersion: HAND_IMPORT_VERSION,
    sourceFormat: parsed.sourceFormat, parserVersion: parsed.parserVersion, rawTextFingerprint: fingerprint,
    sourceHandId: parsed.handId, sourceTimestamp: parsed.timestamp, canonicalHandId: reconstruction.status === 'complete' ? handId : null,
    reconstructionVersion: RECONSTRUCTION_VERSION, reconstructionStatus: reconstruction.status, factSummary,
    tableIdentity: { name: parsed.table?.name ?? null, capacity: parsed.table?.capacity ?? null, currency: parsed.currency },
    sourcePlayers: request?.players.map(p => ({ playerId: p.playerId, sourceName: p.sourceName, seat: p.seat })) ?? [], rawTextRetention: 'not_stored' };
  return freeze({ schemaVersion: HAND_IMPORT_VERSION, parsed, diagnostics, importProvenance, ...reconstruction });
}
