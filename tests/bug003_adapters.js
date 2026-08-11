const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LOGIC_PATH = path.join(__dirname, '..', 'app', 'src', 'core', 'logic.js');

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract production source between ${startMarker} and ${endMarker}`);
  }
  return source.slice(start, end);
}

function createElement(value = '') {
  return { value: String(value), innerHTML: '' };
}

function createHarness() {
  const source = fs.readFileSync(LOGIC_PATH, 'utf8');
  const positionsSource = source.match(/const POSITIONS\s*=\s*\{[\s\S]*?\n\};/);
  if (!positionsSource) throw new Error('Could not extract POSITIONS from logic.js');

  const modelSource = sliceBetween(source, 'const MODEL_POSITION_VOCABULARY', 'const ACTION_COLORS');
  const numericSource = sliceBetween(source, 'function numericValue(id, fallback = 0)', 'function updatePositionSelect(');
  const updateSource = sliceBetween(source, 'function updatePositionSelect(', 'function normalizeTree(data, fileName)');
  const controls = new Map();

  const sandbox = { controls, createElement };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${positionsSource[0]}
    ${modelSource}
    const $ = (selector) => controls.get(selector) || null;
    const selectedValue = (selector) => {
      const element = $(selector);
      return element ? element.value : undefined;
    };
    ${numericSource}
    ${updateSource}
    globalThis.__bug003 = {
      positionsFor(tableSize) { return POSITIONS[tableSize] ? [...POSITIONS[tableSize]] : null; },
      updatePlaybook(tableSize, oldPosition) {
        controls.clear();
        controls.set('#playersNum', createElement(tableSize));
        const select = createElement(oldPosition);
        controls.set('#heroPos', select);
        updatePositions();
        return { value: select.value, html: select.innerHTML };
      },
      updateTraining(tableSize, oldPosition) {
        controls.clear();
        controls.set('#trainingPlayersNum', createElement(tableSize));
        const select = createElement(oldPosition);
        controls.set('#trainingHeroPos', select);
        updateTrainingPositions();
        return { value: select.value, html: select.innerHTML };
      },
      modelIndex: modelPositionIndex,
      modelVocabulary() { return [...MODEL_POSITION_VOCABULARY]; },
      modelCompatibility() { return { ...MODEL_POSITION_COMPATIBILITY }; }
    };
  `, sandbox, { filename: LOGIC_PATH });

  return sandbox.__bug003;
}

const harness = createHarness();
const plain = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

module.exports = {
  positionsFor: (tableSize) => plain(harness.positionsFor(tableSize)),
  updatePlaybook: (...args) => plain(harness.updatePlaybook(...args)),
  updateTraining: (...args) => plain(harness.updateTraining(...args)),
  modelIndex: (...args) => harness.modelIndex(...args),
  modelVocabulary: () => plain(harness.modelVocabulary()),
  modelCompatibility: () => plain(harness.modelCompatibility()),
};
