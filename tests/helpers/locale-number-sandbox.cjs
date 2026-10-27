// LOCALE-NUMBERS-001: harnesses that run slices of the classic page scripts
// (logic.js, teacher.js, TableRenderer.js) in a vm sandbox need what the page
// provides before those scripts run: the shared number formatter bridge and,
// for logic.js slices, its thin formatUi* delegates.
const fs = require('fs');
const path = require('path');

const LOGIC_PATH = path.join(__dirname, '..', '..', 'app', 'src', 'core', 'logic.js');
const START = '// LOCALE-NUMBERS-001: user-facing numbers go through the one shared formatter';
const END = 'let applicationExperienceSequence';

let helpersSource = null;

/** Source of logic.js's formatUi* delegates, to prepend to a logic.js slice. */
function logicNumberHelpersSource() {
  if (helpersSource === null) {
    const logic = fs.readFileSync(LOGIC_PATH, 'utf8');
    const from = logic.indexOf(START);
    const to = logic.indexOf(END, from);
    if (from < 0 || to < 0) throw new Error('Could not find the formatUi* helpers in logic.js');
    helpersSource = logic.slice(from, to);
  }
  return helpersSource;
}

/**
 * Set RiverlineLocaleNumberFormat on each target (a sandbox and/or its
 * `window`). Uses the side-effect-free core module, never the page bootstrap:
 * loading the bootstrap here would cache it before a test boots the app, and
 * the booted page would then never install its bridge.
 */
function installLocaleNumbers(...targets) {
  const { createLocaleNumberFormatBridge } = require('../../app/src/application/locale-number-format.mjs');
  for (const target of targets) if (target) target.RiverlineLocaleNumberFormat = createLocaleNumberFormatBridge();
  return targets[0];
}

module.exports = { installLocaleNumbers, logicNumberHelpersSource };
