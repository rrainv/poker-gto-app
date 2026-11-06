// TRAINING-QUICK-001: page bridge for the quick refresher. logic.js is a
// classic script, so the view model and the shared drill components reach it
// through one frozen window object (installed before logic.js runs).
import * as view from './training-quick-drill.mjs';
import * as components from '../ui/drill-components.mjs';
import * as workspace from './training-quick-drill-workspace.mjs';
import * as fullHandDock from './full-hand-decision-dock.mjs';
import * as fullHandHeaderState from './full-hand-header-state.mjs';

// EXTRACT-QUICKDRILL-001: `workspace` is the mounted drill controller
// (mount(container, deps)); logic.js mounts it once and calls it back.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineQuickDrill', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      schemaVersion: view.QUICK_DRILL_VIEW_SCHEMA_VERSION,
      view: Object.freeze({ ...view }),
      components: Object.freeze({ ...components }),
      workspace: Object.freeze({ ...workspace }),
      // TRAINING-FULLHAND-001: the Full Hand dock (mounted controller) and header state.
      fullHandDock: Object.freeze({ ...fullHandDock }),
      fullHandHeaderState: Object.freeze({ ...fullHandHeaderState }),
    }),
  });
}
