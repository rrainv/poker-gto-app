import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const capabilitiesDirectory = path.join(repositoryRoot, 'docs', 'project', 'capabilities');

const requiredDossiers = [
  'LEARNING_EVIDENCE_FOUNDATION.md',
  'NATURAL_LANGUAGE_INTELLIGENCE.md',
  'REFERENCE_STRATEGY_EVOLUTION.md',
  'EQUITY_HAND_ANALYSIS.md',
  'BLUFF_EXPLOIT_ANALYSIS.md',
  'OPPONENT_INTELLIGENCE.md',
  'DEEP_HAND_REVIEW.md',
  'TRAINING_INTELLIGENCE.md',
  'PERSONAL_STRATEGY_INTELLIGENCE.md',
  'RANGE_EVOLUTION.md',
  'SAVED_KNOWLEDGE_AND_SHARING.md',
  'HOME_GAME_EVOLUTION.md',
  'RANDOM_SPOT_GENERATOR.md',
];

const recoveredProdIds = `
  PROD-BLUFF-001 PROD-CLOUD-001 PROD-COMPARE-001 PROD-DATA-001 PROD-DENSITY-001
  PROD-DESKTOP-001 PROD-DESKTOP-002 PROD-IMPORT-001 PROD-KEYBOARD-001 PROD-LAYOUT-001
  PROD-LAYOUT-002 PROD-MATH-001 PROD-MOBILE-001 PROD-MODE-001 PROD-MODEL-001
  PROD-MOTION-001 PROD-PERSONALIZE-001 PROD-RANGE-000 PROD-RANGE-001 PROD-RANGE-002
  PROD-RANGE-003 PROD-RANGE-004 PROD-RANGE-005 PROD-RANGE-006 PROD-RELEASE-001
  PROD-REPLAY-001 PROD-SAVE-001 PROD-SESSION-001 PROD-SOLVER-001 PROD-TABLE-001
  PROD-TABLE-002 PROD-TABLE-003 PROD-TABLE-004 PROD-TABLE-005 PROD-TABLE-006
  PROD-THEME-001 PROD-TRAIN-001 PROD-TRAIN-002 PROD-TRAIN-003 PROD-TRAIN-004
  PROD-TRAIN-005 PROD-TUTORIAL-001 PROD-WEB-001
`.trim().split(/\s+/);

const authorityDisclaimer =
  'This capability dossier preserves long-term product intent and design direction. ' +
  'It does not own execution priority or current implementation truth. ' +
  'See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. ' +
  'Current implemented contracts remain in subsystem specs/code.';

const readRepositoryFile = (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), 'utf8');

const localMarkdownTargets = (markdown) => {
  const targets = [];
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1);
    }
    target = target.split('#', 1)[0];
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) {
      continue;
    }
    targets.push(decodeURIComponent(target));
  }
  return targets;
};

const assertLocalLinksResolve = async (relativePath) => {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const markdown = await readFile(absolutePath, 'utf8');
  for (const target of localMarkdownTargets(markdown)) {
    const resolved = path.resolve(path.dirname(absolutePath), target);
    await assert.doesNotReject(
      access(resolved),
      `Expected ${relativePath} link ${target} to resolve to an existing file`,
    );
  }
};

test('required capability dossiers exist, are indexed, and disclaim execution authority', async () => {
  const entries = await readdir(capabilitiesDirectory, { withFileTypes: true });
  const dossierNames = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !['README.md', 'LEGACY_ID_INDEX.md'].includes(entry.name),
    )
    .map((entry) => entry.name)
    .sort();

  for (const required of requiredDossiers) {
    assert.ok(dossierNames.includes(required), `Missing required dossier ${required}`);
  }

  const index = await readRepositoryFile('docs/project/capabilities/README.md');
  for (const dossierName of dossierNames) {
    assert.match(index, new RegExp(dossierName.replaceAll('.', '\\.')));
    const dossier = await readRepositoryFile(`docs/project/capabilities/${dossierName}`);
    const opening = dossier.split(/\r?\n/).slice(0, 12).join('\n');
    assert.match(opening, new RegExp(authorityDisclaimer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('capability, interaction, legacy, Roadmap, and Backlog relative links resolve', async () => {
  const entries = await readdir(capabilitiesDirectory, { withFileTypes: true });
  const capabilityDocuments = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `docs/project/capabilities/${entry.name}`);

  for (const relativePath of [
    ...capabilityDocuments,
    'README.md',
    'docs/README.md',
    'docs/agent-prompts/README.md',
    'docs/project/INTERACTION_GRAMMAR.md',
    'docs/project/PROJECT_CHARTER.md',
    'docs/project/PRODUCT_SPEC.md',
    'docs/project/ARCHITECTURE_CONTRACT.md',
    'docs/project/DEFINITION_OF_DONE.md',
    'docs/project/DOCUMENTATION_GOVERNANCE.md',
    'docs/project/CURRENT_PHASE.md',
    'docs/project/ROADMAP.md',
    'docs/project/PRODUCT_BACKLOG.md',
    'docs/project/PRODUCT_RETURN_QUEUE.md',
    'docs/project/QA_BACKLOG.md',
  ]) {
    await assertLocalLinksResolve(relativePath);
  }
});

test('documentation index exposes capability and interaction navigation', async () => {
  const [documentationIndex, capabilityIndex] = await Promise.all([
    readRepositoryFile('docs/README.md'),
    readRepositoryFile('docs/project/capabilities/README.md'),
  ]);

  for (const requiredLink of [
    'capabilities/README.md',
    'capabilities/LEGACY_ID_INDEX.md',
    'INTERACTION_GRAMMAR.md',
  ]) {
    assert.match(documentationIndex, new RegExp(requiredLink.replaceAll('.', '\\.')));
  }
  assert.match(capabilityIndex, /INTERACTION_GRAMMAR\.md/);
  assert.match(capabilityIndex, /LEGACY_ID_INDEX\.md/);
});

test('legacy index keeps every recovered historical PROD identifier searchable', async () => {
  const legacyIndex = await readRepositoryFile(
    'docs/project/capabilities/LEGACY_ID_INDEX.md',
  );

  for (const historicalId of recoveredProdIds) {
    assert.match(legacyIndex, new RegExp(`\\b${historicalId}\\b`));
  }
});

test('interaction applicability matrix includes shared card identity', async () => {
  const interactionGrammar = await readRepositoryFile(
    'docs/project/INTERACTION_GRAMMAR.md',
  );
  assert.match(interactionGrammar, /^\| Card identity \|/m);
});
