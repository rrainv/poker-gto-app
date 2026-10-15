import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
// DOCS-RESET-001: dossiers are archived history; their guardrails live in docs/project/CAPABILITY_GUARDRAILS.md.
const capabilitiesDirectory = path.join(repositoryRoot, 'docs', 'archive', '2026-10', 'capabilities');

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

  const index = await readRepositoryFile('docs/archive/2026-10/capabilities/README.md');
  for (const dossierName of dossierNames) {
    assert.match(index, new RegExp(dossierName.replaceAll('.', '\\.')));
    const dossier = await readRepositoryFile(`docs/archive/2026-10/capabilities/${dossierName}`);
    const opening = dossier.split(/\r?\n/).slice(0, 12).join('\n');
    assert.match(opening, new RegExp(authorityDisclaimer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('live documentation relative links resolve', async () => {
  const projectEntries = await readdir(path.join(repositoryRoot, 'docs', 'project'), { withFileTypes: true });
  const projectDocuments = projectEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `docs/project/${entry.name}`);

  for (const relativePath of [
    'AGENTS.md',
    'README.md',
    'docs/README.md',
    'docs/NORTH_STAR.md',
    'docs/STATE.md',
    'docs/ISSUE_REGISTER.md',
    'docs/TERMINOLOGY.md',
    'docs/IDEA_BANK.md',
    'docs/archive/README.md',
    ...projectDocuments,
  ]) {
    await assertLocalLinksResolve(relativePath);
  }
});

test('documentation index exposes capability and interaction navigation', async () => {
  const [documentationIndex, capabilityIndex] = await Promise.all([
    readRepositoryFile('docs/README.md'),
    readRepositoryFile('docs/archive/2026-10/capabilities/README.md'),
  ]);

  for (const requiredLink of [
    'project/CAPABILITY_GUARDRAILS.md',
    'project/INTERACTION_GRAMMAR.md',
    'archive/README.md',
  ]) {
    assert.match(documentationIndex, new RegExp(requiredLink.replaceAll('.', '\\.')));
  }
  assert.match(capabilityIndex, /INTERACTION_GRAMMAR\.md/);
  assert.match(capabilityIndex, /LEGACY_ID_INDEX\.md/);
});

test('legacy index keeps every recovered historical PROD identifier searchable', async () => {
  const legacyIndex = await readRepositoryFile(
    'docs/archive/2026-10/capabilities/LEGACY_ID_INDEX.md',
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
