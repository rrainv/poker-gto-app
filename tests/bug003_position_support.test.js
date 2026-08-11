const test = require('node:test');
const assert = require('node:assert/strict');

const positions = require('./bug003_adapters');

const EXPECTED = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'CO', 'SB', 'BB'],
  5: ['BTN', 'HJ', 'CO', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

for (let tableSize = 2; tableSize <= 10; tableSize += 1) {
  test(`${tableSize}-player position list is exact`, () => {
    assert.deepEqual(positions.positionsFor(tableSize), EXPECTED[tableSize]);
  });

  test(`${tableSize}-player Playbook preserves every valid hero position`, () => {
    for (const position of EXPECTED[tableSize]) {
      assert.equal(positions.updatePlaybook(tableSize, position).value, position);
    }
  });

  test(`${tableSize}-player Playbook repairs an invalid hero position to BTN`, () => {
    assert.equal(positions.updatePlaybook(tableSize, 'INVALID').value, 'BTN');
  });

  test(`${tableSize}-player Training selector preserves every valid position`, () => {
    for (const position of EXPECTED[tableSize]) {
      assert.equal(positions.updateTraining(tableSize, position).value, position);
    }
  });

  test(`${tableSize}-player Training selector repairs an invalid position to BTN`, () => {
    assert.equal(positions.updateTraining(tableSize, 'INVALID').value, 'BTN');
  });

}

test('model position vocabulary remains the existing six model features', () => {
  assert.deepEqual(positions.modelVocabulary(), ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
});

test('every supported UI position has an explicit model compatibility mapping', () => {
  assert.deepEqual(positions.modelCompatibility(), {
    UTG: 'UTG',
    'UTG+1': 'UTG',
    'UTG+2': 'UTG',
    MP: 'HJ',
    LJ: 'HJ',
    HJ: 'HJ',
    CO: 'CO',
    BTN: 'BTN',
    SB: 'SB',
    BB: 'BB',
  });

  const expectedIndices = {
    UTG: 0,
    'UTG+1': 0,
    'UTG+2': 0,
    MP: 1,
    LJ: 1,
    HJ: 1,
    CO: 2,
    BTN: 3,
    SB: 4,
    BB: 5,
  };
  for (const [position, index] of Object.entries(expectedIndices)) {
    assert.equal(positions.modelIndex(position), index);
  }
});

test('unknown positions fail explicitly instead of silently becoming UTG', () => {
  assert.throws(() => positions.modelIndex('INVALID'), /Unsupported position: INVALID/);
});
