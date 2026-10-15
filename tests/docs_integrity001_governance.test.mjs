import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// DOCS-RESET-001: the live documentation set is AGENTS.md plus docs/NORTH_STAR, STATE,
// ISSUE_REGISTER, TERMINOLOGY and the reference specs; superseded planning is archived.

test('documentation index exposes the live documentation set', async () => {
  const index = await read('docs/README.md');
  for (const authority of [
    'NORTH_STAR.md',
    'STATE.md',
    'ISSUE_REGISTER.md',
    'TERMINOLOGY.md',
    'DESIGN_SYSTEM.md',
    'ARCHITECTURE_CONTRACT.md',
    'INTERACTION_GRAMMAR.md',
    'CAPABILITY_GUARDRAILS.md',
    'archive/README.md',
  ]) {
    assert.match(index, new RegExp(authority.replace('.', '\\.')));
  }
});

test('historical master plan cannot present itself as live authority', async () => {
  const plan = await read('docs/archive/2026-10/RIVERLINE_MASTER_PRODUCT_STRATEGY_PLAN.md');
  const header = plan.split(/\r?\n/).slice(0, 14).join('\n');
  assert.match(header, /HISTORICAL STRATEGY \/ PRODUCT RATIONALE AND DECISION ARCHIVE/);
  assert.match(header, /Not current status authority/i);
});

test('archive index marks archived material as never required reading', async () => {
  const archive = await read('docs/archive/README.md');
  assert.match(archive, /never required reading/i);
  assert.match(archive, /NORTH_STAR\.md.*STATE\.md.*ISSUE_REGISTER\.md/s);
});

test('agent rules have no executable broad-staging example', async () => {
  const agents = await read('AGENTS.md');
  assert.doesNotMatch(agents, /^\s*git add (?:\.|-A|--all)(?:\s|$)/m);
  assert.match(agents, /exact file lists/i);
  assert.match(agents, /Never broad-stage/i);
});

test('STATE.md declares itself the one live status file', async () => {
  const state = await read('docs/STATE.md');
  assert.match(state, /one live status file/i);
  assert.match(state, /^## Ordered queue/m);
  assert.match(state, /^## Open decisions/m);
});
