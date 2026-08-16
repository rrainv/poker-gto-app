export const TUTORIAL_DEFINITION_SCHEMA_VERSION = 'tutorial-definition/v1';
export const TUTORIAL_STEP_SCHEMA_VERSION = 'tutorial-step/v1';

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const ANCHOR_PATTERN = /^[a-z][a-z0-9]*(?:[-:.][a-z0-9]+)*$/;
const EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[-:.][a-z0-9]+)*$/;
const PLACEMENTS = new Set(['auto', 'top', 'right', 'bottom', 'left', 'center']);
const EMPHASIS_MODES = new Set(['spotlight', 'outline', 'none']);
const FIRST_USE_POLICIES = new Set(['prompt', 'manual']);
const RESTART_POLICIES = new Set(['always', 'never']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requiredString(value, field, pattern = null) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  const normalized = value.trim();
  if (pattern && !pattern.test(normalized)) throw new TypeError(`${field} has an invalid format`);
  return normalized;
}

function localizedKey(value, field, hasTranslationKey) {
  const key = requiredString(value, field);
  if (hasTranslationKey && !hasTranslationKey(key)) throw new RangeError(`${field} is not localized: ${key}`);
  return key;
}

function optionalNamedValue(value, field, pattern) {
  if (value === undefined || value === null) return null;
  return requiredString(value, field, pattern);
}

function createTutorialStep(step, index, hasTranslationKey) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new TypeError(`steps[${index}] must be an object`);
  }
  const placement = step.placement ?? 'auto';
  const emphasis = step.emphasis ?? 'spotlight';
  if (!PLACEMENTS.has(placement)) throw new RangeError(`steps[${index}].placement is unsupported`);
  if (!EMPHASIS_MODES.has(emphasis)) throw new RangeError(`steps[${index}].emphasis is unsupported`);
  if (step.interactionRequired && !step.completionTrigger) {
    throw new TypeError(`steps[${index}] interactionRequired needs a completionTrigger`);
  }
  return {
    schemaVersion: TUTORIAL_STEP_SCHEMA_VERSION,
    id: requiredString(step.id, `steps[${index}].id`, ID_PATTERN),
    anchor: requiredString(step.anchor, `steps[${index}].anchor`, ANCHOR_PATTERN),
    titleKey: localizedKey(step.titleKey, `steps[${index}].titleKey`, hasTranslationKey),
    bodyKey: localizedKey(step.bodyKey, `steps[${index}].bodyKey`, hasTranslationKey),
    placement,
    emphasis,
    interactionRequired: Boolean(step.interactionRequired),
    interactionLabelKey: step.interactionLabelKey
      ? localizedKey(step.interactionLabelKey, `steps[${index}].interactionLabelKey`, hasTranslationKey)
      : null,
    precondition: optionalNamedValue(step.precondition, `steps[${index}].precondition`, EVENT_PATTERN),
    completionTrigger: optionalNamedValue(step.completionTrigger, `steps[${index}].completionTrigger`, EVENT_PATTERN),
  };
}

export function createTutorialDefinition(input, { hasTranslationKey = null } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('TutorialDefinition must be an object');
  }
  if (input.schemaVersion && input.schemaVersion !== TUTORIAL_DEFINITION_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported TutorialDefinition schema: ${input.schemaVersion}`);
  }
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new RangeError('TutorialDefinition version must be a positive safe integer');
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new TypeError('TutorialDefinition needs at least one step');
  }
  const firstUsePolicy = input.firstUsePolicy ?? 'manual';
  const restartPolicy = input.restartPolicy ?? 'always';
  if (!FIRST_USE_POLICIES.has(firstUsePolicy)) throw new RangeError('Unsupported first-use policy');
  if (!RESTART_POLICIES.has(restartPolicy)) throw new RangeError('Unsupported restart policy');
  const steps = input.steps.map((step, index) => createTutorialStep(step, index, hasTranslationKey));
  const stepIds = new Set();
  for (const step of steps) {
    if (stepIds.has(step.id)) throw new RangeError(`Duplicate tutorial step id: ${step.id}`);
    stepIds.add(step.id);
  }
  return deepFreeze({
    schemaVersion: TUTORIAL_DEFINITION_SCHEMA_VERSION,
    id: requiredString(input.id, 'id', ID_PATTERN),
    version: input.version,
    workspace: requiredString(input.workspace, 'workspace', ID_PATTERN),
    titleKey: localizedKey(input.titleKey, 'titleKey', hasTranslationKey),
    descriptionKey: localizedKey(input.descriptionKey, 'descriptionKey', hasTranslationKey),
    firstUsePolicy,
    restartPolicy,
    steps,
  });
}

