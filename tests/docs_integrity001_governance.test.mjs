import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('documentation index exposes live planning and governance authorities', async () => {
  const index = await read('docs/README.md');
  for (const authority of [
    'CURRENT_PHASE.md',
    'ROADMAP.md',
    'PRODUCT_BACKLOG.md',
    'PRODUCT_RETURN_QUEUE.md',
    'QA_BACKLOG.md',
    'DOCUMENTATION_GOVERNANCE.md',
    'DEFINITION_OF_DONE.md',
    'ARCHITECTURE_CONTRACT.md',
  ]) {
    assert.match(index, new RegExp(authority.replace('.', '\\.')));
  }
});

test('historical master plan cannot present itself as live authority', async () => {
  const plan = await read('docs/project/RIVERLINE_MASTER_PRODUCT_STRATEGY_PLAN.md');
  const header = plan.split(/\r?\n/).slice(0, 14).join('\n');
  assert.match(header, /HISTORICAL STRATEGY \/ PRODUCT RATIONALE AND DECISION ARCHIVE/);
  assert.match(header, /Not current status authority/i);
  assert.match(header, /CURRENT_PHASE\.md.*PRODUCT_BACKLOG\.md.*ROADMAP\.md/s);
});

test('Git workflow has no executable broad-staging example', async () => {
  const workflow = await read('docs/project/GIT_WORKFLOW.md');
  assert.doesNotMatch(workflow, /^\s*git add (?:\.|-A|--all)(?:\s|$)/m);
  assert.match(workflow, /stage exact ticket-owned files/i);
});

test('live planning documents defer execution authority to Current Phase', async () => {
  const [roadmap, backlog] = await Promise.all([
    read('docs/project/ROADMAP.md'),
    read('docs/project/PRODUCT_BACKLOG.md'),
  ]);
  assert.match(roadmap, /CURRENT_PHASE\.md.*owns the exact current checkpoint and execution order/i);
  assert.match(backlog, /CURRENT_PHASE\.md.*owns exact execution order/i);
});

test('product backlog contains exactly one numbered section per governed domain', async () => {
  const backlog = await read('docs/project/PRODUCT_BACKLOG.md');
  const headings = backlog.match(/^## \d+\..+$/gm) ?? [];
  assert.deepEqual(headings, [
    '## 1. Strategy / Reference',
    '## 2. Full Hand / Replay / Review',
    '## 3. Audio / Motion',
    '## 4. Training',
    '## 5. Personal Strategy',
    '## 6. Analysis / Matrix / Ranges / Equity',
    '## 7. Saved / Home',
    '## 8. Accounts / Sync / Social',
    '## 9. Home Game Organizer',
    '## 10. Product Experience / Settings / Themes / Layout / Cards',
    '## 11. Opponent Policies / Bots',
    '## 12. Platform / Release / Mobile',
    '## 13. PLO / Other Game Domains',
    '## 14. Open Product Decisions',
  ]);
});
