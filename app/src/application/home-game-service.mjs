import {
  HOME_GAME_OWNER_TYPES,
  HOME_GAME_SESSION_STATUS,
  HOME_GAME_TRANSACTION_TYPES,
  createCorrectionTransaction,
  createHomeGameChipSnapshot,
  createHomeGameCurrency,
  createHomeGameOwnerRef,
  createHomeGameParticipant,
  createHomeGameRepository,
  createHomeGameSessionExport,
  createMemoryHomeGameDatabase,
} from '../home-game/index.mjs';

export const HOME_GAME_WORKSPACE_STATE_SCHEMA_VERSION = 'home-game-workspace-state/v1';

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function normalizePlayerNames(playerNames) {
  if (!Array.isArray(playerNames)) throw new TypeError('Player names must be an array');
  const names = playerNames.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (names.length < 2) throw new RangeError('Add at least two players');
  const normalized = names.map((entry) => entry.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new RangeError('Player names must be unique within a session');
  return names;
}

function requireAmount(amountMinor, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(amountMinor) || amountMinor < minimum) {
    throw new RangeError(`Amount must be a safe integer of at least ${minimum} minor units`);
  }
  return amountMinor;
}

export function createHomeGameApplication({
  authQueries,
  identityQueries,
  accountDatabase = null,
  guestDatabase = createMemoryHomeGameDatabase({ name: 'home-game-guest-session' }),
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  repositoryFactory = createHomeGameRepository,
} = {}) {
  if (!authQueries || typeof authQueries.getState !== 'function') throw new TypeError('Home Game application requires authentication state');
  if (!identityQueries || typeof identityQueries.getActiveIdentityId !== 'function') throw new TypeError('Home Game application requires account identity queries');
  const guestOwner = createHomeGameOwnerRef(idFactory('home-game-guest'), HOME_GAME_OWNER_TYPES.GUEST);
  const guestRepository = repositoryFactory({ ownerRef: guestOwner, database: guestDatabase, clock, idFactory });
  const accountRepositories = new Map();
  const currentSessionByScope = new Map();

  async function context() {
    const authState = authQueries.getState();
    if (authState?.status !== 'signed_in') {
      return { mode: 'guest', scope: guestOwner.ownerId, ownerRef: guestOwner, repository: guestRepository };
    }
    const identityId = await identityQueries.getActiveIdentityId();
    if (!identityId) throw new RangeError('Signed-in Home Game persistence requires an active Riverline identity');
    let repository = accountRepositories.get(identityId);
    if (!repository) {
      const ownerRef = createHomeGameOwnerRef(identityId, HOME_GAME_OWNER_TYPES.ACCOUNT);
      repository = repositoryFactory({ ownerRef, ...(accountDatabase ? { database: accountDatabase } : {}), clock, idFactory });
      accountRepositories.set(identityId, repository);
    }
    return { mode: 'account', scope: identityId, ownerRef: repository.ownerRef, repository };
  }

  async function load() {
    const active = await context();
    const [players, groups, recentSessions] = await Promise.all([
      active.repository.listPlayers({ includeArchived: true }),
      active.repository.listGroups({ includeArchived: true }),
      active.repository.listRecentSessions({ limit: 40, includeArchived: true }),
    ]);
    const visibleSessions = recentSessions.filter((entry) => !entry.archived);
    let currentSessionId = currentSessionByScope.get(active.scope) || null;
    if (!currentSessionId || !visibleSessions.some((entry) => entry.sessionId === currentSessionId)) {
      currentSessionId = visibleSessions.find((entry) => entry.status !== HOME_GAME_SESSION_STATUS.COMPLETED)?.sessionId
        || visibleSessions[0]?.sessionId
        || null;
    }
    if (currentSessionId) currentSessionByScope.set(active.scope, currentSessionId);
    const current = currentSessionId ? await active.repository.getSessionBundle(currentSessionId) : null;
    return Object.freeze({
      schemaVersion: HOME_GAME_WORKSPACE_STATE_SCHEMA_VERSION,
      persistence: active.mode === 'account' ? 'account_local' : 'guest_memory',
      ownerId: active.mode === 'account' ? active.scope : null,
      players,
      availablePlayers: players.filter((entry) => !entry.archived),
      groups: groups.filter((entry) => !entry.archived),
      archivedGroups: groups.filter((entry) => entry.archived),
      recentSessions: visibleSessions.slice(0, 12),
      archivedSessions: recentSessions.filter((entry) => entry.archived),
      current,
    });
  }

  async function createSession({
    title,
    currencyCode = 'ILS',
    currencyLabel = currencyCode,
    minorUnit = 2,
    playerNames = [],
    playerIds = [],
    roster = null,
    buyInMinor = 0,
    saveGroupName = null,
    blinds = null,
    sourceGroupId = null,
  } = {}) {
    const active = await context();
    if (!Array.isArray(playerIds) || (roster !== null && !Array.isArray(roster))) throw new TypeError('Home Game roster must be an array');
    const savedPlayers = await active.repository.listPlayers();
    const savedById = new Map(savedPlayers.map((entry) => [entry.playerId, entry]));
    const rosterValues = roster || [
      ...playerIds.map((playerId) => ({ playerId })),
      ...playerNames.map((displayName) => ({ displayName })),
    ];
    const selectedIds = rosterValues.filter((entry) => entry?.playerId).map((entry) => entry.playerId);
    const selectedPlayers = selectedIds.map((playerId) => {
      const player = savedById.get(playerId);
      if (!player) throw new RangeError('A selected Home Game player is unavailable or archived');
      return player;
    });
    if (new Set(selectedIds).size !== selectedIds.length) throw new RangeError('A player can only appear once in a session');
    const newNames = rosterValues.filter((entry) => !entry?.playerId).map((entry) => String(entry?.displayName || '').trim()).filter(Boolean);
    const rosterNames = rosterValues.map((entry) => entry?.playerId ? savedById.get(entry.playerId)?.displayName : String(entry?.displayName || '').trim()).filter(Boolean);
    const names = normalizePlayerNames(rosterNames);
    requireAmount(buyInMinor, { allowZero: true });
    const createdPlayers = newNames.map((displayName) => active.repository.createPlayer({ displayName }));
    for (const player of createdPlayers) await active.repository.savePlayer(player);
    const createdQueue = [...createdPlayers];
    const players = rosterValues.map((entry) => entry?.playerId ? savedById.get(entry.playerId) : createdQueue.shift()).filter(Boolean);
    if (saveGroupName && active.mode !== 'account') throw new RangeError('Sign in to save a reusable player group');
    if (saveGroupName) {
      await active.repository.saveGroup(active.repository.createGroup({
        name: saveGroupName,
        playerIds: players.map((entry) => entry.playerId),
      }));
    }
    const session = active.repository.createSession({
      title: String(title || '').trim() || 'Home Game',
      currency: createHomeGameCurrency({ code: currencyCode, label: currencyLabel, minorUnit }),
      blinds,
      sourceGroupId,
      participants: players.map((player, index) => createHomeGameParticipant({ playerId: player.playerId, seatNumber: index + 1 })),
    });
    await active.repository.saveSession(session);
    await active.repository.startSession(session.sessionId);
    if (buyInMinor > 0) {
      for (const player of players) {
        await active.repository.appendTransaction(active.repository.createTransaction({
          sessionId: session.sessionId,
          playerId: player.playerId,
          type: HOME_GAME_TRANSACTION_TYPES.BUY_IN,
          amountMinor: buyInMinor,
        }));
      }
    }
    currentSessionByScope.set(active.scope, session.sessionId);
    return load();
  }

  async function createSessionFromGroup({ groupId, title, currencyCode = 'ILS', currencyLabel = currencyCode, minorUnit = 2, buyInMinor = 0, blinds = null } = {}) {
    const active = await context();
    requireAmount(buyInMinor, { allowZero: true });
    const session = await active.repository.createSessionFromGroup({
      groupId,
      title,
      currency: createHomeGameCurrency({ code: currencyCode, label: currencyLabel, minorUnit }),
      blinds,
    });
    await active.repository.startSession(session.sessionId);
    if (buyInMinor > 0) {
      for (const participant of session.participants) {
        await active.repository.appendTransaction(active.repository.createTransaction({
          sessionId: session.sessionId,
          playerId: participant.playerId,
          type: HOME_GAME_TRANSACTION_TYPES.BUY_IN,
          amountMinor: buyInMinor,
        }));
      }
    }
    currentSessionByScope.set(active.scope, session.sessionId);
    return load();
  }

  async function openSession(sessionId) {
    const active = await context();
    if (!await active.repository.getSession(sessionId)) throw new RangeError('Home Game session is unavailable');
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function addTransaction({ sessionId, playerId, type, amountMinor, note = null } = {}) {
    if (![HOME_GAME_TRANSACTION_TYPES.BUY_IN, HOME_GAME_TRANSACTION_TYPES.REBUY, HOME_GAME_TRANSACTION_TYPES.ADD_ON].includes(type)) {
      throw new RangeError('Use cashOut or correctTransaction for this ledger action');
    }
    requireAmount(amountMinor);
    const active = await context();
    await active.repository.appendTransaction(active.repository.createTransaction({ sessionId, playerId, type, amountMinor, note }));
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function cashOut({ sessionId, playerId, amountMinor, note = null } = {}) {
    requireAmount(amountMinor, { allowZero: true });
    const active = await context();
    await active.repository.recordCashOut({ sessionId, playerId, amountMinor, note });
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function correctTransaction({ sessionId, transactionId, replacementAmountMinor = null, note = null } = {}) {
    const active = await context();
    const bundle = await active.repository.getSessionBundle(sessionId);
    if (!bundle) throw new RangeError('Home Game session is unavailable');
    const original = bundle.transactions.find((entry) => entry.transactionId === transactionId);
    if (!original) throw new RangeError('Home Game transaction is unavailable');
    const correction = createCorrectionTransaction({
      transactionId: idFactory('home-game-transaction'),
      original,
      createdAt: new Date(clock()).toISOString(),
      note,
    });
    let replacement = null;
    if (replacementAmountMinor !== null) {
      requireAmount(replacementAmountMinor);
      replacement = active.repository.createTransaction({
        sessionId,
        playerId: original.playerId,
        type: original.type,
        amountMinor: replacementAmountMinor,
        replacementOfTransactionId: original.transactionId,
        note: note ? `Replacement: ${note}` : null,
      });
    }
    await active.repository.appendCorrection({ correction, replacement });
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function recordChipCount({ sessionId, playerId, chipCount, phase = 'current' } = {}) {
    if (!Number.isSafeInteger(chipCount) || chipCount < 0) throw new RangeError('Chip count must be a non-negative whole number');
    const active = await context();
    await active.repository.saveSnapshot(createHomeGameChipSnapshot({
      snapshotId: idFactory('home-game-chip-snapshot'),
      sessionId,
      ownerRef: active.ownerRef,
      playerId,
      chipCount,
      phase,
      recordedAt: new Date(clock()).toISOString(),
    }));
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function completeSession(sessionId) {
    const active = await context();
    await active.repository.completeSession(sessionId);
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function reopenSession(sessionId) {
    const active = await context();
    await active.repository.reopenSession(sessionId);
    currentSessionByScope.set(active.scope, sessionId);
    return load();
  }

  async function requireAccount() {
    const active = await context();
    if (active.mode !== 'account') throw new RangeError('Sign in to manage a durable player and group library');
    return active;
  }

  async function createPlayer(values) {
    const active = await requireAccount();
    await active.repository.savePlayer(active.repository.createPlayer(values));
    return load();
  }

  async function updatePlayer(playerId, values) {
    const active = await requireAccount();
    await active.repository.updatePlayer(playerId, values);
    return load();
  }

  async function setPlayerArchived(playerId, archived) {
    return updatePlayer(playerId, { archived: Boolean(archived) });
  }

  async function createGroup(values) {
    const active = await requireAccount();
    await active.repository.saveGroup(active.repository.createGroup(values));
    return load();
  }

  async function updateGroup(groupId, values) {
    const active = await requireAccount();
    await active.repository.updateGroup(groupId, values);
    return load();
  }

  async function setGroupArchived(groupId, archived) {
    return updateGroup(groupId, { archived: Boolean(archived) });
  }

  async function setSessionArchived(sessionId, archived) {
    const active = await requireAccount();
    await active.repository.setSessionArchived(sessionId, Boolean(archived));
    if (archived) currentSessionByScope.delete(active.scope);
    return load();
  }

  async function exportSession(sessionId) {
    const active = await requireAccount();
    const bundle = await active.repository.getSessionBundle(sessionId);
    if (!bundle) throw new RangeError('Home Game session is unavailable');
    return createHomeGameSessionExport({
      session: bundle.session,
      transactions: bundle.transactions,
      snapshots: bundle.snapshots,
      exportedAt: new Date(clock()).toISOString(),
    });
  }

  return Object.freeze({
    load,
    createSession,
    createSessionFromGroup,
    openSession,
    addTransaction,
    cashOut,
    correctTransaction,
    recordChipCount,
    completeSession,
    reopenSession,
    createPlayer,
    updatePlayer,
    setPlayerArchived,
    createGroup,
    updateGroup,
    setGroupArchived,
    setSessionArchived,
    exportSession,
    async close() {
      await guestRepository.close();
      await Promise.all([...accountRepositories.values()].map((repository) => repository.close()));
    },
  });
}
