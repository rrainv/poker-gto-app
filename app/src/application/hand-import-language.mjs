import { createNaturalLanguageEnvelope } from './natural-language-envelope.mjs';
const messages = {
  input_size: 'Paste one hand history of at most 250,000 characters.',
  format_or_multiple_hands: 'Use one PokerStars English cash No Limit Hold’em hand.',
  missing_header: 'The game header is missing or unsupported.',
  missing_table: 'The table, button or seats are missing.',
  missing_hero: 'This history does not identify Hero and two Hero cards.',
  missing_settlement: 'The history must state the total pot and rake explicitly.',
  unsupported_line: 'This line contains information Riverline cannot safely interpret.',
  duplicate_or_invalid_cards: 'A card is repeated or invalid. Riverline cannot reconstruct this hand safely.',
  missing_showdown_cards: 'A player’s showdown cards are missing. The final result cannot be verified.',
  money_precision: 'These amounts cannot be represented exactly in Riverline’s chip units.',
  raise_amount: 'The raise increment does not agree with the raise-to amount.',
  call_amount: 'The recorded call does not match the amount legally owed.',
  refund_mismatch: 'The uncalled refund does not match the canonical contributions.',
  missing_refund: 'The history is missing an uncalled refund required by the actions.',
  between_hand_roster_notice: 'A join or leave notice does not change the players dealt into this hand.',
  canonical_legality: 'The recorded action or settlement does not reconcile with the legal hand.',
};
export function importDiagnosticLanguage(diagnostic) {
  const messageKey = messages[diagnostic.code] ?? 'The source facts conflict or are incomplete. Inspect the indicated line.';
  return { messageKey, line: diagnostic.line, envelope: createNaturalLanguageEnvelope({ claimClass: 'factual',
    subject: { role: 'imported_source_evidence' }, evidenceRefs: [`line:${diagnostic.line}:${diagnostic.code}`], basis: 'historical',
    facts: { code: diagnostic.code, line: diagnostic.line, classification: diagnostic.classification },
    uncertainty: diagnostic.blocking === false ? [] : [diagnostic.classification] }) };
}
