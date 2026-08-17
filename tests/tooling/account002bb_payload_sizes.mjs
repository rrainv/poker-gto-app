import { performance } from 'node:perf_hooks';
import { PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import {
  createCalibrationSession,
  createLocalOwnerRef,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
} from '../../app/src/personal-strategy/index.mjs';
import {
  createPersonalStrategyProfileBundle,
  toRemotePersonalStrategyEntity,
} from '../../app/src/sync/index.mjs';

const ownerRef = createLocalOwnerRef('payload-owner');
const context = createRfiCalibrationContext({
  gameRulesId: 'holdem-nl-home-v1', tableSize: 6, heroPosition: 'BTN',
  effectiveStackBb: 100, anteType: 'none', anteBb: 0,
  forcedContributionPerPlayerBb: 0, rakeMode: 'off',
});
const timestamp = (index) => new Date(Date.parse('2026-08-17T12:00:00.000Z') + index * 1000).toISOString();

function fixture(observationCount) {
  const profiles = Array.from({ length: 3 }, (_, profileIndex) => createStrategyProfileBundle({
    profileId: `profile-${profileIndex}`,
    ownerRef,
    displayName: `Representative Profile ${profileIndex + 1}`,
    description: 'Representative private Personal Strategy profile.',
    tags: ['home'],
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds: Array.from({ length: 3 }, (_, modeIndex) => `mode-${profileIndex}-${modeIndex}`),
    createdAt: timestamp(profileIndex),
  }));
  const session = createCalibrationSession({
    id: 'calibration-session-active',
    profileId: profiles[0].profile.id,
    modeId: profiles[0].modes[0].id,
    contextScope: context,
    startedAt: timestamp(10),
    state: 'active',
    nextPromptIndex: 100,
  });
  const observations = [];
  const latestByKey = new Map();
  for (let index = 0; index < observationCount; index += 1) {
    const profile = profiles[index % profiles.length];
    const mode = profile.modes[Math.floor(index / profiles.length) % profile.modes.length];
    const handClass = PREFLOP_HAND_CLASSES[index % PREFLOP_HAND_CLASSES.length];
    const key = `${profile.profile.id}:${mode.id}:${handClass}`;
    const observation = createRangeObservation({
      id: `range-observation-${index}`,
      profileId: profile.profile.id,
      modeId: mode.id,
      context,
      handClass,
      dominantAction: { type: index % 4 === 0 ? 'fold' : 'raise' },
      calibrationSessionId: null,
      supersedesObservationId: latestByKey.get(key) ?? null,
      createdAt: timestamp(20 + index),
    });
    latestByKey.set(key, observation.id);
    observations.push(observation);
  }
  return [
    ...profiles.map((bundle) => createPersonalStrategyProfileBundle(bundle.profile, bundle.modes)),
    session,
    ...observations,
  ];
}

function measure(observationCount) {
  const entities = fixture(observationCount);
  const startedAt = performance.now();
  const documents = entities.map((entity) => toRemotePersonalStrategyEntity(entity));
  const serializationMs = performance.now() - startedAt;
  const bytes = documents.map((document) => Buffer.byteLength(JSON.stringify(document), 'utf8'));
  return {
    profiles: 3,
    modesPerProfile: 3,
    observations: observationCount,
    activeSessions: 1,
    operationCount: documents.length,
    totalPayloadBytes: bytes.reduce((sum, value) => sum + value, 0),
    largestOperationBytes: Math.max(...bytes),
    serializationMs: Number(serializationMs.toFixed(3)),
  };
}

console.log(JSON.stringify({
  schemaVersion: 'account-002bb-payload-report/v1',
  note: 'UTF-8 JSON bytes before transport compression; one coalesced operation per mutable entity.',
  samples: [measure(100), measure(500)],
}, null, 2));
