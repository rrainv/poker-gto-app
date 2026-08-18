export const HOME_GAME_SCHEMA_VERSION = 'home-game/v1';
export const HOME_GAME_OWNER_REF_SCHEMA_VERSION = 'home-game-owner-ref/v1';
export const HOME_GAME_PLAYER_SCHEMA_VERSION = 'home-game-player/v1';
export const HOME_GAME_GROUP_SCHEMA_VERSION = 'home-game-group/v1';
export const HOME_GAME_PARTICIPANT_SCHEMA_VERSION = 'home-game-participant/v1';
export const HOME_GAME_SESSION_SCHEMA_VERSION = 'home-game-session/v1';
export const HOME_GAME_TRANSACTION_SCHEMA_VERSION = 'home-game-transaction/v1';
export const HOME_GAME_CHIP_SNAPSHOT_SCHEMA_VERSION = 'home-game-chip-snapshot/v1';
export const HOME_GAME_SETTLEMENT_SCHEMA_VERSION = 'home-game-settlement/v1';
export const HOME_GAME_SESSION_EXPORT_SCHEMA_VERSION = 'home-game-session-export/v1';

export const HOME_GAME_OWNER_TYPES = Object.freeze({
  ACCOUNT: 'account_identity',
  GUEST: 'guest_session',
});

export const HOME_GAME_SESSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
});

export const HOME_GAME_PARTICIPANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CASHED_OUT: 'cashed_out',
});

export const HOME_GAME_TRANSACTION_TYPES = Object.freeze({
  BUY_IN: 'buy_in',
  REBUY: 'rebuy',
  ADD_ON: 'add_on',
  CASH_OUT: 'cash_out',
  CORRECTION: 'correction',
});

const OWNER_TYPES = new Set(Object.values(HOME_GAME_OWNER_TYPES));
const SESSION_STATUSES = new Set(Object.values(HOME_GAME_SESSION_STATUS));
const PARTICIPANT_STATUSES = new Set(Object.values(HOME_GAME_PARTICIPANT_STATUS));
const TRANSACTION_TYPES = new Set(Object.values(HOME_GAME_TRANSACTION_TYPES));
const MONEY_IN_TYPES = new Set([
  HOME_GAME_TRANSACTION_TYPES.BUY_IN,
  HOME_GAME_TRANSACTION_TYPES.REBUY,
  HOME_GAME_TRANSACTION_TYPES.ADD_ON,
]);

function cloneData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function immutable(value) {
  return deepFreeze(cloneData(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) {
    throw new TypeError(`${label} must be a non-empty opaque ID`);
  }
  return value;
}

function requireText(value, label, { min = 1, max = 120, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  const normalized = value.trim();
  if ([...normalized].length < min || [...normalized].length > max) {
    throw new RangeError(`${label} must contain ${min}-${max} characters`);
  }
  return normalized;
}

function requireTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

function requireSafeInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${label} must be a safe integer of at least ${min}`);
  }
  return value;
}

function requireRevision(value, label = 'revision') {
  return requireSafeInteger(value, label, { min: 1 });
}

function requireOwnerRef(ownerRef) {
  requireObject(ownerRef, 'Home Game owner reference');
  if (ownerRef.schemaVersion !== HOME_GAME_OWNER_REF_SCHEMA_VERSION) {
    throw new TypeError('Unsupported Home Game owner reference schema');
  }
  if (!OWNER_TYPES.has(ownerRef.ownerType)) throw new RangeError('Unsupported Home Game owner type');
  requireId(ownerRef.ownerId, 'Home Game owner ID');
  return ownerRef;
}

function sameOwner(left, right) {
  return left.ownerType === right.ownerType && left.ownerId === right.ownerId;
}

function requireOwned(record, ownerRef, label) {
  if (!sameOwner(record.ownerRef, ownerRef)) throw new RangeError(`${label} belongs to another owner`);
}

export function createHomeGameOwnerRef(ownerId, ownerType = HOME_GAME_OWNER_TYPES.ACCOUNT) {
  const result = {
    schemaVersion: HOME_GAME_OWNER_REF_SCHEMA_VERSION,
    ownerType,
    ownerId,
  };
  requireOwnerRef(result);
  return immutable(result);
}

export function createHomeGameCurrency({ code = 'ILS', label = code, minorUnit = 2 } = {}) {
  const normalizedCode = requireText(code, 'Currency code', { max: 12 }).toUpperCase();
  const result = {
    code: normalizedCode,
    label: requireText(label, 'Currency label', { max: 24 }),
    minorUnit: requireSafeInteger(minorUnit, 'Currency minor unit', { min: 0 }),
  };
  if (result.minorUnit > 6) throw new RangeError('Currency minor unit cannot exceed 6');
  return immutable(result);
}

export function parseMoneyToMinorUnits(value, minorUnit = 2) {
  requireSafeInteger(minorUnit, 'Currency minor unit', { min: 0 });
  if (minorUnit > 6) throw new RangeError('Currency minor unit cannot exceed 6');
  const normalized = String(value ?? '').trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new TypeError('Money amount must be an exact decimal number');
  const fraction = match[3] || '';
  if (fraction.length > minorUnit) throw new RangeError(`Money amount supports at most ${minorUnit} decimal places`);
  const scale = 10n ** BigInt(minorUnit);
  const absolute = (BigInt(match[2]) * scale) + BigInt((fraction + '0'.repeat(minorUnit)).slice(0, minorUnit) || '0');
  const signed = match[1] === '-' ? -absolute : absolute;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Money amount exceeds safe accounting range');
  }
  return Number(signed);
}

export function formatMinorUnits(amountMinor, currency) {
  requireSafeInteger(amountMinor, 'Money amount');
  const { minorUnit } = createHomeGameCurrency(currency);
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  if (minorUnit === 0) return `${negative ? '-' : ''}${absolute}`;
  const scale = 10 ** minorUnit;
  return `${negative ? '-' : ''}${Math.floor(absolute / scale)}.${String(absolute % scale).padStart(minorUnit, '0')}`;
}

export function createHomeGamePlayer({
  playerId,
  ownerRef,
  displayName,
  nickname = null,
  notes = null,
  archived = false,
  createdAt,
  updatedAt = createdAt,
  revision = 1,
}) {
  const result = {
    schemaVersion: HOME_GAME_PLAYER_SCHEMA_VERSION,
    playerId: requireId(playerId, 'Player ID'),
    ownerRef: cloneData(requireOwnerRef(ownerRef)),
    displayName: requireText(displayName, 'Player display name', { max: 80 }),
    nickname: requireText(nickname, 'Player nickname', { max: 80, nullable: true }),
    notes: requireText(notes, 'Player notes', { max: 500, nullable: true }),
    archived: Boolean(archived),
    createdAt: requireTimestamp(createdAt, 'Player createdAt'),
    updatedAt: requireTimestamp(updatedAt, 'Player updatedAt'),
    revision: requireRevision(revision),
  };
  if (Date.parse(result.updatedAt) < Date.parse(result.createdAt)) throw new RangeError('Player updatedAt precedes createdAt');
  return immutable(result);
}

export function createHomeGameGroup({
  groupId,
  ownerRef,
  name,
  playerIds = [],
  createdAt,
  updatedAt = createdAt,
  revision = 1,
}) {
  if (!Array.isArray(playerIds)) throw new TypeError('Group player IDs must be an array');
  const normalizedPlayerIds = playerIds.map((id) => requireId(id, 'Group player ID'));
  if (new Set(normalizedPlayerIds).size !== normalizedPlayerIds.length) throw new RangeError('Group roster cannot contain duplicate players');
  const result = {
    schemaVersion: HOME_GAME_GROUP_SCHEMA_VERSION,
    groupId: requireId(groupId, 'Group ID'),
    ownerRef: cloneData(requireOwnerRef(ownerRef)),
    name: requireText(name, 'Group name', { max: 100 }),
    playerIds: normalizedPlayerIds,
    createdAt: requireTimestamp(createdAt, 'Group createdAt'),
    updatedAt: requireTimestamp(updatedAt, 'Group updatedAt'),
    revision: requireRevision(revision),
  };
  if (Date.parse(result.updatedAt) < Date.parse(result.createdAt)) throw new RangeError('Group updatedAt precedes createdAt');
  return immutable(result);
}

export function createHomeGameParticipant({
  playerId,
  seatNumber = null,
  status = HOME_GAME_PARTICIPANT_STATUS.ACTIVE,
  isButton = false,
  initialChipCount = null,
}) {
  const normalizedSeat = seatNumber === null ? null : requireSafeInteger(seatNumber, 'Seat number', { min: 1 });
  const normalizedChips = initialChipCount === null ? null : requireSafeInteger(initialChipCount, 'Initial chip count', { min: 0 });
  if (!PARTICIPANT_STATUSES.has(status)) throw new RangeError('Unsupported participant status');
  return immutable({
    schemaVersion: HOME_GAME_PARTICIPANT_SCHEMA_VERSION,
    playerId: requireId(playerId, 'Participant player ID'),
    seatNumber: normalizedSeat,
    status,
    isButton: Boolean(isButton),
    initialChipCount: normalizedChips,
  });
}

function validateParticipants(participants) {
  if (!Array.isArray(participants) || participants.length < 2) throw new RangeError('A Home Game session requires at least two participants');
  const normalized = participants.map((participant) => createHomeGameParticipant(participant));
  const playerIds = normalized.map((entry) => entry.playerId);
  const seats = normalized.map((entry) => entry.seatNumber).filter((seat) => seat !== null);
  if (new Set(playerIds).size !== playerIds.length) throw new RangeError('Session participants cannot contain duplicate players');
  if (new Set(seats).size !== seats.length) throw new RangeError('Session seats cannot be duplicated');
  if (normalized.filter((entry) => entry.isButton).length > 1) throw new RangeError('Only one participant may hold the button');
  return normalized;
}

function normalizeBlinds(blinds, currency) {
  if (blinds === null || blinds === undefined) return null;
  requireObject(blinds, 'Session blinds');
  const result = {
    smallBlindMinor: requireSafeInteger(blinds.smallBlindMinor, 'Small blind', { min: 0 }),
    bigBlindMinor: requireSafeInteger(blinds.bigBlindMinor, 'Big blind', { min: 0 }),
    anteMinor: requireSafeInteger(blinds.anteMinor ?? 0, 'Ante', { min: 0 }),
  };
  const maximum = 10 ** (15 - currency.minorUnit);
  if (result.bigBlindMinor < result.smallBlindMinor || result.bigBlindMinor > maximum) {
    throw new RangeError('Session blinds are invalid');
  }
  return result;
}

export function createHomeGameSession({
  sessionId,
  ownerRef,
  title,
  currency = createHomeGameCurrency(),
  blinds = null,
  participants,
  notes = null,
  status = HOME_GAME_SESSION_STATUS.DRAFT,
  startedAt = null,
  endedAt = null,
  sourceGroupId = null,
  createdAt,
  updatedAt = createdAt,
  revision = 1,
}) {
  if (!SESSION_STATUSES.has(status)) throw new RangeError('Unsupported Home Game session status');
  const normalizedCurrency = createHomeGameCurrency(currency);
  const normalizedParticipants = validateParticipants(participants);
  const result = {
    schemaVersion: HOME_GAME_SESSION_SCHEMA_VERSION,
    sessionId: requireId(sessionId, 'Session ID'),
    ownerRef: cloneData(requireOwnerRef(ownerRef)),
    title: requireText(title, 'Session title', { max: 120 }),
    status,
    currency: cloneData(normalizedCurrency),
    blinds: normalizeBlinds(blinds, normalizedCurrency),
    participants: cloneData(normalizedParticipants),
    notes: requireText(notes, 'Session notes', { max: 2000, nullable: true }),
    sourceGroupId: sourceGroupId === null ? null : requireId(sourceGroupId, 'Source group ID'),
    startedAt: requireTimestamp(startedAt, 'Session startedAt', { nullable: true }),
    endedAt: requireTimestamp(endedAt, 'Session endedAt', { nullable: true }),
    createdAt: requireTimestamp(createdAt, 'Session createdAt'),
    updatedAt: requireTimestamp(updatedAt, 'Session updatedAt'),
    revision: requireRevision(revision),
  };
  if (status === HOME_GAME_SESSION_STATUS.DRAFT && (result.startedAt !== null || result.endedAt !== null)) {
    throw new RangeError('Draft session cannot have lifecycle timestamps');
  }
  if (status === HOME_GAME_SESSION_STATUS.ACTIVE && result.startedAt === null) throw new RangeError('Active session requires startedAt');
  if (status === HOME_GAME_SESSION_STATUS.ACTIVE && result.endedAt !== null) throw new RangeError('Active session cannot have endedAt');
  if (status === HOME_GAME_SESSION_STATUS.COMPLETED && (result.startedAt === null || result.endedAt === null)) {
    throw new RangeError('Completed session requires startedAt and endedAt');
  }
  return immutable(result);
}

export function createSessionFromGroup({ sessionId, ownerRef, title, currency, blinds = null, group, players, createdAt }) {
  requireOwned(group, ownerRef, 'Home Game group');
  const playerById = new Map(players.map((player) => {
    requireOwned(player, ownerRef, 'Home Game player');
    return [player.playerId, player];
  }));
  const participants = group.playerIds.map((playerId, index) => {
    if (!playerById.has(playerId)) throw new RangeError(`Group references missing player ${playerId}`);
    return createHomeGameParticipant({ playerId, seatNumber: index + 1 });
  });
  return createHomeGameSession({
    sessionId,
    ownerRef,
    title: title || group.name,
    currency,
    blinds,
    participants,
    sourceGroupId: group.groupId,
    createdAt,
  });
}

export function createHomeGameTransaction({
  transactionId,
  sessionId,
  ownerRef,
  playerId,
  type,
  amountMinor,
  createdAt,
  note = null,
  correctionOfTransactionId = null,
}) {
  if (!TRANSACTION_TYPES.has(type)) throw new RangeError('Unsupported Home Game transaction type');
  const correction = type === HOME_GAME_TRANSACTION_TYPES.CORRECTION;
  if (correction !== (correctionOfTransactionId !== null)) {
    throw new RangeError('Only correction entries may reference a corrected transaction');
  }
  return immutable({
    schemaVersion: HOME_GAME_TRANSACTION_SCHEMA_VERSION,
    transactionId: requireId(transactionId, 'Transaction ID'),
    sessionId: requireId(sessionId, 'Transaction session ID'),
    ownerRef: cloneData(requireOwnerRef(ownerRef)),
    playerId: requireId(playerId, 'Transaction player ID'),
    type,
    amountMinor: requireSafeInteger(amountMinor, 'Transaction amount', { min: 1 }),
    createdAt: requireTimestamp(createdAt, 'Transaction createdAt'),
    note: requireText(note, 'Transaction note', { max: 500, nullable: true }),
    correctionOfTransactionId: correction ? requireId(correctionOfTransactionId, 'Corrected transaction ID') : null,
  });
}

export function createCorrectionTransaction({ transactionId, original, createdAt, note = null }) {
  if (original.type === HOME_GAME_TRANSACTION_TYPES.CORRECTION) throw new RangeError('A correction cannot reverse another correction');
  return createHomeGameTransaction({
    transactionId,
    sessionId: original.sessionId,
    ownerRef: original.ownerRef,
    playerId: original.playerId,
    type: HOME_GAME_TRANSACTION_TYPES.CORRECTION,
    amountMinor: original.amountMinor,
    correctionOfTransactionId: original.transactionId,
    createdAt,
    note,
  });
}

export function validateHomeGameLedger(session, transactions) {
  if (!Array.isArray(transactions)) throw new TypeError('Home Game ledger must be an array');
  const participantIds = new Set(session.participants.map((entry) => entry.playerId));
  const byId = new Map();
  const corrected = new Set();
  for (const transaction of transactions) {
    const normalized = createHomeGameTransaction(transaction);
    requireOwned(normalized, session.ownerRef, 'Home Game transaction');
    if (normalized.sessionId !== session.sessionId) throw new RangeError('Ledger transaction belongs to another session');
    if (!participantIds.has(normalized.playerId)) throw new RangeError('Ledger transaction references a non-participant');
    if (byId.has(normalized.transactionId)) throw new RangeError('Ledger contains a duplicate transaction ID');
    if (normalized.type === HOME_GAME_TRANSACTION_TYPES.CORRECTION) {
      const original = byId.get(normalized.correctionOfTransactionId);
      if (!original) throw new RangeError('Correction must reference an earlier transaction');
      if (original.type === HOME_GAME_TRANSACTION_TYPES.CORRECTION) throw new RangeError('Correction cannot reverse another correction');
      if (original.playerId !== normalized.playerId || original.amountMinor !== normalized.amountMinor) {
        throw new RangeError('Correction must exactly reverse the original player and amount');
      }
      if (corrected.has(original.transactionId)) throw new RangeError('A transaction cannot be corrected twice');
      corrected.add(original.transactionId);
    }
    byId.set(normalized.transactionId, normalized);
  }
  return immutable({ transactions: [...byId.values()], correctedTransactionIds: [...corrected] });
}

export function calculateHomeGameAccounting(session, transactions) {
  const ledger = validateHomeGameLedger(session, transactions);
  const resultByPlayer = new Map(session.participants.map((participant) => [participant.playerId, {
    playerId: participant.playerId,
    totalInMinor: 0,
    totalOutMinor: 0,
    netMinor: 0,
  }]));
  const byId = new Map(ledger.transactions.map((entry) => [entry.transactionId, entry]));
  for (const transaction of ledger.transactions) {
    const target = transaction.type === HOME_GAME_TRANSACTION_TYPES.CORRECTION
      ? byId.get(transaction.correctionOfTransactionId)
      : transaction;
    const direction = transaction.type === HOME_GAME_TRANSACTION_TYPES.CORRECTION ? -1 : 1;
    const result = resultByPlayer.get(transaction.playerId);
    if (MONEY_IN_TYPES.has(target.type)) result.totalInMinor += direction * transaction.amountMinor;
    if (target.type === HOME_GAME_TRANSACTION_TYPES.CASH_OUT) result.totalOutMinor += direction * transaction.amountMinor;
  }
  const participantResults = session.participants.map((participant) => {
    const result = resultByPlayer.get(participant.playerId);
    if (result.totalInMinor < 0 || result.totalOutMinor < 0) throw new RangeError('Corrections cannot make ledger totals negative');
    result.netMinor = result.totalOutMinor - result.totalInMinor;
    return immutable(result);
  });
  const totalInMinor = participantResults.reduce((sum, entry) => sum + entry.totalInMinor, 0);
  const totalOutMinor = participantResults.reduce((sum, entry) => sum + entry.totalOutMinor, 0);
  const balanceMinor = totalOutMinor - totalInMinor;
  return immutable({
    sessionId: session.sessionId,
    currency: session.currency,
    totalInMinor,
    totalOutMinor,
    balanceMinor,
    balanced: balanceMinor === 0,
    participantResults,
  });
}

function lifecycleUpdate(session, patch, updatedAt) {
  return createHomeGameSession({
    ...session,
    ...patch,
    ownerRef: session.ownerRef,
    currency: session.currency,
    participants: patch.participants || session.participants,
    updatedAt: requireTimestamp(updatedAt, 'Session updatedAt'),
    revision: session.revision + 1,
  });
}

export function startHomeGameSession(session, startedAt) {
  if (session.status !== HOME_GAME_SESSION_STATUS.DRAFT) throw new RangeError('Only a draft session can start');
  return lifecycleUpdate(session, { status: HOME_GAME_SESSION_STATUS.ACTIVE, startedAt, endedAt: null }, startedAt);
}

export function updateHomeGameParticipant(session, playerId, patch, updatedAt) {
  if (session.status === HOME_GAME_SESSION_STATUS.COMPLETED) throw new RangeError('Completed session must be reopened before editing');
  const index = session.participants.findIndex((entry) => entry.playerId === playerId);
  if (index < 0) throw new RangeError('Unknown session participant');
  const participants = session.participants.map((entry, entryIndex) => (
    entryIndex === index ? createHomeGameParticipant({ ...entry, ...patch, playerId: entry.playerId }) : entry
  ));
  return lifecycleUpdate(session, { participants }, updatedAt);
}

export function completeHomeGameSession(session, transactions, endedAt) {
  if (session.status !== HOME_GAME_SESSION_STATUS.ACTIVE) throw new RangeError('Only an active session can complete');
  if (session.participants.some((entry) => entry.status === HOME_GAME_PARTICIPANT_STATUS.ACTIVE)) {
    throw new RangeError('All active players need a final cash-out state');
  }
  const accounting = calculateHomeGameAccounting(session, transactions);
  if (!accounting.balanced) {
    const error = new RangeError(`Session is unbalanced by ${Math.abs(accounting.balanceMinor)} minor units`);
    error.code = 'unbalanced_session';
    error.balanceMinor = accounting.balanceMinor;
    throw error;
  }
  createHomeGameSettlement(session, transactions);
  return lifecycleUpdate(session, { status: HOME_GAME_SESSION_STATUS.COMPLETED, endedAt }, endedAt);
}

export function reopenHomeGameSession(session, reopenedAt) {
  if (session.status !== HOME_GAME_SESSION_STATUS.COMPLETED) throw new RangeError('Only a completed session can reopen');
  return lifecycleUpdate(session, { status: HOME_GAME_SESSION_STATUS.ACTIVE, endedAt: null }, reopenedAt);
}

export function createHomeGameSettlement(session, transactions) {
  const accounting = calculateHomeGameAccounting(session, transactions);
  if (!accounting.balanced) {
    const error = new RangeError(`Settlement unavailable: session is unbalanced by ${Math.abs(accounting.balanceMinor)} minor units`);
    error.code = 'unbalanced_session';
    error.balanceMinor = accounting.balanceMinor;
    throw error;
  }
  const ordered = new Map(session.participants.map((entry, index) => [entry.playerId, index]));
  const creditors = accounting.participantResults
    .filter((entry) => entry.netMinor > 0)
    .map((entry) => ({ playerId: entry.playerId, remainingMinor: entry.netMinor }))
    .sort((a, b) => ordered.get(a.playerId) - ordered.get(b.playerId));
  const debtors = accounting.participantResults
    .filter((entry) => entry.netMinor < 0)
    .map((entry) => ({ playerId: entry.playerId, remainingMinor: -entry.netMinor }))
    .sort((a, b) => ordered.get(a.playerId) - ordered.get(b.playerId));
  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.remainingMinor, creditor.remainingMinor);
    transfers.push(immutable({ fromPlayerId: debtor.playerId, toPlayerId: creditor.playerId, amountMinor }));
    debtor.remainingMinor -= amountMinor;
    creditor.remainingMinor -= amountMinor;
    if (debtor.remainingMinor === 0) debtorIndex += 1;
    if (creditor.remainingMinor === 0) creditorIndex += 1;
  }
  if (debtors.some((entry) => entry.remainingMinor !== 0) || creditors.some((entry) => entry.remainingMinor !== 0)) {
    throw new Error('Settlement reconciliation failed');
  }
  const totalPositiveMinor = accounting.participantResults
    .filter((entry) => entry.netMinor > 0)
    .reduce((sum, entry) => sum + entry.netMinor, 0);
  const totalTransferredMinor = transfers.reduce((sum, entry) => sum + entry.amountMinor, 0);
  if (totalTransferredMinor !== totalPositiveMinor) throw new Error('Settlement conservation invariant failed');
  return immutable({
    schemaVersion: HOME_GAME_SETTLEMENT_SCHEMA_VERSION,
    sessionId: session.sessionId,
    currency: session.currency,
    totalTransferredMinor,
    transfers,
  });
}

export function createHomeGameChipSnapshot({
  snapshotId,
  sessionId,
  ownerRef,
  playerId,
  chipCount,
  phase = 'current',
  recordedAt,
}) {
  return immutable({
    schemaVersion: HOME_GAME_CHIP_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: requireId(snapshotId, 'Chip snapshot ID'),
    sessionId: requireId(sessionId, 'Chip snapshot session ID'),
    ownerRef: cloneData(requireOwnerRef(ownerRef)),
    playerId: requireId(playerId, 'Chip snapshot player ID'),
    chipCount: requireSafeInteger(chipCount, 'Chip count', { min: 0 }),
    phase: requireText(phase, 'Chip snapshot phase', { max: 24 }),
    recordedAt: requireTimestamp(recordedAt, 'Chip snapshot recordedAt'),
  });
}

export function createHomeGameSessionExport({ session, transactions, snapshots = [], exportedAt }) {
  const ledger = validateHomeGameLedger(session, transactions);
  const normalizedSnapshots = snapshots.map((entry) => createHomeGameChipSnapshot(entry));
  normalizedSnapshots.forEach((entry) => {
    requireOwned(entry, session.ownerRef, 'Home Game chip snapshot');
    if (entry.sessionId !== session.sessionId) throw new RangeError('Snapshot belongs to another session');
  });
  return immutable({
    schemaVersion: HOME_GAME_SESSION_EXPORT_SCHEMA_VERSION,
    exportedAt: requireTimestamp(exportedAt, 'Export timestamp'),
    session: cloneData(session),
    transactions: cloneData(ledger.transactions),
    snapshots: cloneData(normalizedSnapshots),
  });
}

