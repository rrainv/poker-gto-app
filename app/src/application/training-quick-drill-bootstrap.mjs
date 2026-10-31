// TRAINING-QUICK-001: page bridge for the quick refresher. logic.js is a
// classic script, so the view model and the shared drill components reach it
// through one frozen window object (installed before logic.js runs).
import * as view from './training-quick-drill.mjs';
import * as components from '../ui/drill-components.mjs';

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineQuickDrill', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      schemaVersion: view.QUICK_DRILL_VIEW_SCHEMA_VERSION,
      view: Object.freeze({ ...view }),
      components: Object.freeze({ ...components }),
    }),
  });
}
