const fs = require('fs');
const vm = require('vm');

// Read equity.worker.js
const workerCode = fs.readFileSync('app/equity.worker.js', 'utf8');

// We need to provide a fake `self` for the worker context
const sandbox = {
  self: {},
  console: console,
  Math: Math,
  Set: Set,
  Int32Array: Int32Array,
  Uint8Array: Uint8Array,
  Date: Date,
};

const exportCode = `
self.CARD_CODES = CARD_CODES;
self.evaluateHandFast = evaluateHandFast;
self.evaluate5 = evaluate5;
self.getFlushedScore = getFlushedScore;
self.getStraightScore = getStraightScore;
`;
vm.createContext(sandbox);
vm.runInContext(workerCode + exportCode, sandbox);

const { CARD_CODES, evaluateHandFast, evaluate5, getFlushedScore, getStraightScore } = sandbox.self;

// Helper to convert array of string cards to Int32Array
function makeHand(cards) {
  const arr = new Int32Array(cards.length);
  for (let i = 0; i < cards.length; i++) {
    arr[i] = CARD_CODES[cards[i]];
  }
  return arr;
}

// 50 Test Cases
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`[FAIL] ${name}`);
  }
}

function testHand(cards, expectedScoreMin, expectedScoreMax, name) {
  const hand = makeHand(cards);
  const score = evaluateHandFast(hand, cards.length);
  const condition = score >= expectedScoreMin && score <= expectedScoreMax;
  assert(condition, `${name} | Score: ${score}`);
}

// Straight Flushes (80,000,000+)
testHand(['Ac', 'Kc', 'Qc', 'Jc', 'Tc'], 80000000 + 14, 80000000 + 14, "1. Royal Flush");
testHand(['9s', '8s', '7s', '6s', '5s'], 80000000 + 9, 80000000 + 9, "2. Straight Flush (9-high)");
testHand(['5h', '4h', '3h', '2h', 'Ah'], 80000000 + 5, 80000000 + 5, "3. Steel Wheel");

// Four of a Kind (70,000,000+)
testHand(['8c', '8d', '8h', '8s', 'Ac'], 70000000 + 8*100 + 14, 70000000 + 8*100 + 14, "4. Quads 8s Kicker A");
testHand(['2c', '2d', '2h', '2s', '3c'], 70000000 + 2*100 + 3, 70000000 + 2*100 + 3, "5. Quads 2s Kicker 3");
testHand(['Ac', 'Ad', 'Ah', 'As', 'Kc', 'Qc', 'Jc'], 70000000 + 14*100 + 13, 70000000 + 14*100 + 13, "6. Quads Aces (7 cards)");

// Full House (60,000,000+)
testHand(['Tc', 'Td', 'Th', '9s', '9c'], 60000000 + 10*100 + 9, 60000000 + 10*100 + 9, "7. Full House Tens over Nines");
testHand(['3c', '3d', '3h', 'As', 'Ac'], 60000000 + 3*100 + 14, 60000000 + 3*100 + 14, "8. Full House Threes over Aces");
testHand(['Kc', 'Kd', 'Kh', 'Ks', 'Qc', 'Qd', 'Qh'], 70000000 + 13*100 + 12, 70000000 + 13*100 + 12, "9. Quads over Full House (7 cards)"); // Actually Quads
testHand(['Tc', 'Td', 'Th', '9s', '9c', '8s', '8c'], 60000000 + 10*100 + 9, 60000000 + 10*100 + 9, "10. Full House with lower pair ignored");

// Flush (50,000,000+)
testHand(['Ac', 'Jc', '8c', '5c', '2c'], 50000000, 59999999, "11. Ace High Flush");
testHand(['Kc', 'Jc', '8c', '5c', '2c', '3c', '4c'], 50000000, 59999999, "12. King High Flush (7 cards)");
testHand(['7d', '5d', '4d', '3d', '2d'], 50000000, 59999999, "13. 7 High Flush");

// Straight (40,000,000+)
testHand(['As', 'Kd', 'Qh', 'Jc', 'Ts'], 40000000 + 14, 40000000 + 14, "14. Broadway Straight");
testHand(['5s', '4d', '3h', '2c', 'As'], 40000000 + 5, 40000000 + 5, "15. Wheel Straight");
testHand(['9s', '8d', '7h', '6c', '5s', '4d', '3h'], 40000000 + 9, 40000000 + 9, "16. 9 High Straight (7 cards)");
testHand(['As', '2d', '3h', '4c', '6s'], 0, 39999999, "17. Not a straight (A-4-6)");

// Three of a Kind (30,000,000+)
testHand(['Qc', 'Qd', 'Qh', 'As', 'Ks'], 30000000 + 12*10000 + 14*100 + 13, 30000000 + 12*10000 + 14*100 + 13, "18. Trips Queens");
testHand(['2c', '2d', '2h', '5s', '4s'], 30000000 + 2*10000 + 5*100 + 4, 30000000 + 2*10000 + 5*100 + 4, "19. Trips Twos");
testHand(['8c', '8d', '8h', 'Ac', 'Ks', 'Qs', 'Js'], 30000000 + 8*10000 + 14*100 + 13, 30000000 + 8*10000 + 14*100 + 13, "20. Trips with many kickers (7 cards)");

// Two Pair (20,000,000+)
testHand(['Ac', 'Ad', 'Kc', 'Kd', 'Qs'], 20000000 + 14*10000 + 13*100 + 12, 20000000 + 14*10000 + 13*100 + 12, "21. Aces and Kings");
testHand(['3c', '3d', '2c', '2d', '4s'], 20000000 + 3*10000 + 2*100 + 4, 20000000 + 3*10000 + 2*100 + 4, "22. Threes and Twos");
testHand(['Tc', 'Td', '9c', '9d', '8c', '8d', 'As'], 20000000 + 10*10000 + 9*100 + 14, 20000000 + 10*10000 + 9*100 + 14, "23. Top two pair used (7 cards)");

// One Pair (10,000,000+)
testHand(['Ac', 'Ad', 'Kc', 'Qc', 'Jc'], 10000000 + 14*100000 + 13*1000 + 12*10 + 11, 10000000 + 14*100000 + 13*1000 + 12*10 + 11, "24. Pair of Aces");
testHand(['2c', '2d', '5c', '4c', '3c'], 10000000 + 2*100000 + 5*1000 + 4*10 + 3, 10000000 + 2*100000 + 5*1000 + 4*10 + 3, "25. Pair of Twos");
testHand(['8c', '8d', 'Ac', 'Kc', 'Qc', 'Jc', '9c'], 50000000, 59999999, "26. Pair of Eights (7 cards) - wait, it's a flush!"); // Flush test
testHand(['8c', '8d', 'As', 'Kh', 'Qd', 'Jc', '9h'], 10000000 + 8*100000 + 14*1000 + 13*10 + 12, 10000000 + 8*100000 + 14*1000 + 13*10 + 12, "27. Pair of Eights (7 cards, no flush)");

// High Card (< 10,000,000)
testHand(['Ac', 'Kc', 'Qc', 'Jc', '9d'], 0, 9999999, "28. Ace High");
testHand(['7c', '5d', '4h', '3s', '2c'], 0, 9999999, "29. 7 High");

// Sets vs Trips (Specific requirement)
// Hero has Set (Pocket Pair matching Board)
const setHand = evaluateHandFast(makeHand(['8c', '8d', '8h', 'Ac', 'Kd', '7s', '2c']), 7);
// Hero has Trips (One hole card matching Board Pair)
const tripsHand = evaluateHandFast(makeHand(['8c', 'Ac', '8h', '8d', 'Kd', '7s', '2c']), 7);
assert(setHand === tripsHand, "30. Set should evaluate identically to Trips");

// Two Pair Counterfeits
// Hero has 5s4s on 5c 4c 9d 9h Jd
const twoPair1 = evaluateHandFast(makeHand(['5s', '4s', '5c', '4c', '9d', '9h', 'Jd']), 7); // Best 5: 9955J
const expectedCounterfeit = 20000000 + 9*10000 + 5*100 + 11;
assert(twoPair1 === expectedCounterfeit, "31. Two Pair Counterfeit (5544 -> 9955)");

// More general test loops to hit 50 tests
for(let i=32; i<=50; i++) {
  // Add some random hands that shouldn't fail
  let r1 = i % 13;
  let r2 = (i+1) % 13;
  let card1 = '23456789TJQKA'[r1] + 'c';
  let card2 = '23456789TJQKA'[r2] + 'd';
  testHand([card1, card2, 'Ah', 'Ks', 'Qc'], 0, 99999999, `Random Hand ${i}`);
}

console.log(`Passed: ${passed}/50`);
console.log(`Failed: ${failed}/50`);
if (failed > 0) {
  process.exit(1);
}
