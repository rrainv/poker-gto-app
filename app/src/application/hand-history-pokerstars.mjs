// Adapter only: source strings and monetary tokens, never PokerState mutations.
export const POKERSTARS_FORMAT = 'pokerstars_english_nlhe_cash';
export const POKERSTARS_PARSER_VERSION = 'pokerstars-parser/v1';
const money = '([€£$]?\\d+(?:\\.\\d{1,2})?)';
const re = pattern => new RegExp(pattern);
const cards = value => value.trim().split(/\s+/);

export function parsePokerStarsHistory(rawText) {
  const facts = { schemaVersion: 'parsed-hand-history/v1', sourceFormat: POKERSTARS_FORMAT,
    parserVersion: POKERSTARS_PARSER_VERSION, handId: null, timestamp: null, table: null,
    blinds: null, currency: null, players: [], events: [], posts: [], awards: [], refunds: [],
    hero: null, summary: null, summarySeats: [], summaryBoard: null, diagnostics: [] };
  const issue = (code, line, classification = 'unsupported') => facts.diagnostics.push({ code, line, classification });
  if (typeof rawText !== 'string' || rawText.length > 250000 || !rawText.trim()) {
    issue('input_size', 0, 'missing'); return facts;
  }
  const lines = rawText.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim());
  let stage = 'header', headerCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], n = i + 1;
    if (!line) continue;
    let m;
    if (/^PokerStars (?:Hand|Game) #/.test(line)) {
      headerCount++;
      m = line.match(re("^PokerStars (?:Hand|Game) #(\\d+):\\s+Hold'em No Limit \\(" + money + '/' + money + ' (USD|EUR|GBP)\\) - (.+)$'));
      if (!m || stage !== 'header' || headerCount !== 1) { issue('format_or_multiple_hands', n); continue; }
      facts.handId = m[1]; facts.blinds = { small: m[2], big: m[3] }; facts.currency = m[4]; facts.timestamp = m[5];
      if (!/^\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2} [A-Z]+(?: \[\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2} [A-Z]+\])?$/.test(facts.timestamp)) issue('timestamp_format', n);
    } else if ((m = line.match(/^Table '(.+)' (\d+)-max Seat #(\d+) is the button$/))) {
      if (facts.table || stage !== 'header') issue('table_conflict', n, 'ambiguous');
      facts.table = { name: m[1], capacity: Number(m[2]), buttonSeat: Number(m[3]), line: n };
    } else if (stage === 'header' && (m = line.match(re('^Seat (\\d+): (.+) \\(' + money + ' in chips\\)$')))) {
      facts.players.push({ seat: Number(m[1]), name: m[2], stack: m[3], line: n });
    } else if (stage === 'header' && (m = line.match(re('^(.+): posts (small blind|big blind|the ante) ' + money + '( and is all-in)?$')))) {
      facts.posts.push({ name: m[1], kind: m[2], amount: m[3], allIn: Boolean(m[4]), line: n });
    } else if (line === '*** HOLE CARDS ***') {
      if (stage !== 'header') issue('street_order', n, 'ambiguous'); stage = 'preflop';
    } else if ((m = line.match(/^Dealt to (.+) \[([^\]]+)\]$/))) {
      if (facts.hero || stage !== 'preflop' || facts.events.length) issue('hero_conflict', n, 'ambiguous');
      facts.hero = { name: m[1], cards: cards(m[2]), line: n };
    } else if ((m = line.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* \[([^\]]+)\](?: \[([^\]]+)\])?$/))) {
      stage = m[1].toLowerCase();
      facts.events.push({ kind: 'board', street: stage, prior: m[3] ? cards(m[2]) : [], cards: cards(m[3] ?? m[2]), line: n });
    } else if (line === '*** SHOW DOWN ***') { stage = 'showdown';
    } else if (line === '*** SUMMARY ***') { if (stage === 'summary') issue('summary_conflict', n, 'ambiguous'); stage = 'summary';
    } else if (stage === 'summary' && (m = line.match(re('^Total pot ' + money + '(?: Main pot .+?\\.)?(?: Side pot.*?\\.)? \\| Rake ' + money + '$')))) {
      if (facts.summary) issue('summary_conflict', n, 'ambiguous');
      facts.summary = { pot: m[1], rake: m[2], line: n };
    } else if (stage === 'summary' && (m = line.match(/^Board \[([^\]]+)\]$/))) {
      if (facts.summaryBoard) issue('board_conflict', n, 'ambiguous'); facts.summaryBoard = cards(m[1]);
    } else if (stage === 'summary' && (m = line.match(/^Seat (\d+): (.+)$/))) {
      facts.summarySeats.push({ seat: Number(m[1]), text: m[2], line: n });
    } else if (stage !== 'header' && stage !== 'summary' && (m = line.match(/^(.+): (folds|checks)$/))) {
      facts.events.push({ kind: 'action', name: m[1], type: m[2] === 'folds' ? 'fold' : 'check', street: stage, line: n });
    } else if (stage !== 'header' && stage !== 'summary' && (m = line.match(re('^(.+): (calls|bets) ' + money + '( and is all-in)?$')))) {
      facts.events.push({ kind: 'action', name: m[1], type: m[2] === 'calls' ? 'call' : 'bet', amount: m[3],
        amountSemantics: m[2] === 'calls' ? 'incremental_commit' : 'street_total_to', allIn: Boolean(m[4]), street: stage, line: n });
    } else if (stage !== 'header' && stage !== 'summary' && (m = line.match(re('^(.+): raises ' + money + ' to ' + money + '( and is all-in)?$')))) {
      facts.events.push({ kind: 'action', name: m[1], type: 'raise', increment: m[2], amount: m[3],
        amountSemantics: 'street_total_to', allIn: Boolean(m[4]), street: stage, line: n });
    } else if (stage !== 'summary' && (m = line.match(/^(.+): shows \[([^\]]+)\](?: \(.+\))?$/))) {
      facts.events.push({ kind: 'reveal', name: m[1], cards: cards(m[2]), line: n });
    } else if (stage !== 'summary' && (m = line.match(re('^Uncalled bet \\(' + money + '\\) returned to (.+)$')))) {
      facts.refunds.push({ amount: m[1], name: m[2], line: n });
      facts.events.push({ kind: 'refund', amount: m[1], name: m[2], line: n });
    } else if (stage !== 'summary' && (m = line.match(re('^(.+) collected ' + money + ' from (pot|main pot|side pot(?:-\\d+)?)$')))) {
      facts.awards.push({ name: m[1], amount: m[2], pot: m[3], line: n });
      facts.events.push({ kind: 'award', name: m[1], amount: m[2], line: n });
    } else if (/^.+: (?:doesn't show hand|mucks hand)$/.test(line)) {
      facts.events.push({ kind: 'withheld', name: line.slice(0, line.lastIndexOf(':')), line: n });
    } else if (stage !== 'header' && /^.+ (?:leaves the table|joins the table at seat #\d+)$/.test(line)) {
      facts.diagnostics.push({ code: 'between_hand_roster_notice', line: n, classification: 'inferred', blocking: false });
    } else { issue('unsupported_line', n); }
  }
  if (!facts.handId) issue('missing_header', 1, 'missing');
  if (!facts.table) issue('missing_table', 0, 'missing');
  if (!facts.hero) issue('missing_hero', 0, 'missing');
  if (!facts.summary || stage !== 'summary') issue('missing_settlement', 0, 'missing');
  return facts;
}
