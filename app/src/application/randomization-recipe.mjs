export const RANDOMIZATION_RECIPE_VERSION = 'randomization-recipe/v2';

export function deepFreezeRandomization(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeRandomization);
  return Object.freeze(value);
}

export function stableRandomizationValue(value) {
  if (Array.isArray(value)) return value.map(stableRandomizationValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stableRandomizationValue(value[key])]));
}

export function randomizationFingerprint(value) {
  const text = JSON.stringify(stableRandomizationValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function createRandomizationRecipe({
  generatorVersion,
  requestVersion,
  sourceSurface,
  target,
  seed,
  inputContext,
  resultContext,
  details = {},
}) {
  return deepFreezeRandomization({
    schemaVersion: RANDOMIZATION_RECIPE_VERSION,
    generatorVersion,
    requestVersion,
    sourceSurface,
    target,
    seed: seed >>> 0,
    inputFingerprint: randomizationFingerprint(inputContext),
    resultFingerprint: randomizationFingerprint(resultContext),
    inputContext: deepFreezeRandomization(stableRandomizationValue(inputContext)),
    ...details,
  });
}
