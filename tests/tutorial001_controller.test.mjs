import test from 'node:test';
import assert from 'node:assert/strict';

import { createTutorialController } from '../app/src/tutorial/controller.mjs';
import { createTutorialDefinition } from '../app/src/tutorial/domain.mjs';
import { createTutorialPersistence } from '../app/src/tutorial/persistence.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function fixture() {
  const definition = createTutorialDefinition({
    id: 'home.test', version: 1, workspace: 'home', titleKey: 'Title', descriptionKey: 'Description',
    firstUsePolicy: 'prompt', restartPolicy: 'always',
    steps: [
      { id: 'one', anchor: 'home-one', titleKey: 'One', bodyKey: 'One body' },
      { id: 'two', anchor: 'home-two', titleKey: 'Two', bodyKey: 'Two body' },
      { id: 'three', anchor: 'home-three', titleKey: 'Three', bodyKey: 'Three body', interactionRequired: true, interactionLabelKey: 'Open it', completionTrigger: 'home:opened' },
    ],
  });
  const statuses = new Map(definition.steps.map((step) => [step.anchor, 'ready']));
  const shown = [];
  let hidden = 0;
  let workspace = 'home';
  const persistence = createTutorialPersistence({ storage: new MemoryStorage() });
  const surface = {
    show(configuration) { shown.push(configuration); },
    hide() { hidden += 1; },
  };
  const controller = createTutorialController({
    definitions: [definition],
    persistence,
    anchorRegistry: {
      resolve(anchor) {
        const status = statuses.get(anchor) ?? 'missing';
        return { status, anchor, element: status === 'ready' ? { anchor } : null };
      },
    },
    surface,
    getWorkspace: () => workspace,
  });
  return { controller, definition, persistence, statuses, shown, get hidden() { return hidden; }, setWorkspace(value) { workspace = value; } };
}

test('controller starts, advances, goes back, finishes, and reports canonical step state', () => {
  const f = fixture();
  assert.equal(f.controller.start(f.definition.id).stepId, 'one');
  assert.equal(f.controller.next().stepId, 'two');
  assert.equal(f.controller.back().stepId, 'one');
  f.controller.next();
  f.controller.next();
  assert.equal(f.controller.getState().stepId, 'three');
  assert.equal(f.controller.finish().status, 'completed');
  assert.equal(f.persistence.getRecord(f.definition).firstUseStatus, 'completed');
  assert.equal(f.hidden, 1);
});

test('skip, resume, and manual restart have distinct persistence behavior', () => {
  const f = fixture();
  f.controller.start(f.definition.id);
  f.controller.next();
  assert.equal(f.controller.skip().status, 'skipped');
  assert.equal(f.persistence.getRecord(f.definition).firstUseStatus, 'skipped');
  assert.equal(f.controller.start(f.definition.id, { resume: true }).stepId, 'two');
  f.controller.finish();
  assert.equal(f.controller.restart(f.definition.id).stepId, 'one');
  f.controller.skip();
  assert.equal(f.persistence.getRecord(f.definition).firstUseStatus, 'completed');
});

test('missing and hidden targets are skipped safely without fragile selector failures', () => {
  const f = fixture();
  f.statuses.set('home-one', 'missing');
  f.statuses.set('home-two', 'hidden');
  assert.equal(f.controller.start(f.definition.id).stepId, 'three');
  assert.equal(f.shown.length, 1);
  assert.equal(f.controller.next().status, 'active');
  assert.equal(f.controller.handlePresentationEvent('home:opened').status, 'completed');

  const unavailable = fixture();
  unavailable.statuses.forEach((_value, key) => unavailable.statuses.set(key, 'missing'));
  assert.equal(unavailable.controller.start(unavailable.definition.id).reason, 'targets_unavailable');
});

test('workspace change and stale target cancel cleanly, while named presentation events advance interaction steps', () => {
  const f = fixture();
  f.controller.start(f.definition.id);
  f.setWorkspace('training');
  assert.equal(f.controller.workspaceChanged('training').reason, 'workspace_changed');
  assert.equal(f.hidden, 1);

  f.setWorkspace('home');
  f.controller.restart(f.definition.id);
  assert.equal(f.controller.targetLost().reason, 'stale_target');

  f.controller.restart(f.definition.id);
  f.controller.next();
  f.controller.next();
  assert.equal(f.controller.handlePresentationEvent('unrelated').status, 'active');
  assert.equal(f.controller.next().stepId, 'three');
  assert.equal(f.controller.handlePresentationEvent('home:opened').status, 'completed');
});
