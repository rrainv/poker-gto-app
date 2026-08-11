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
