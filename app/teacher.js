

// Hand strength tiers for preflop evaluation

const HAND_TIERS = {

  premium: new Set(['AA','KK','QQ','JJ','TT','AKs','AKo','AQs','AQo','AJs','KQs']),

  strong:  new Set(['99','88','ATs','AJo','KJs','KQo','QJs','JTs','KTs','QTs']),

  playable:new Set(['77','66','55','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',

                    'K9s','K8s','Q9s','J9s','T9s','98s','87s','76s','65s',

                    'ATo','KJo','QJo','JTo','KTo'])

};



function getHandTier(h) {

  if (HAND_TIERS.premium.has(h)) return 'premium';

  if (HAND_TIERS.strong.has(h))  return 'strong';

  if (HAND_TIERS.playable.has(h)) return 'playable';

  return 'weak';

}



// ── Preflop hand description ──────────────────────────────────────────────────

function handDescription(h) {

  if (!h) return t('No hand selected.');

  const r1 = h[0], r2 = h[1];

  const isPair    = h.length === 2;

  const isSuited  = h.length === 3 && h[2] === 's';

  const tier = getHandTier(h);



  if (isPair) {

    if (['A','K','Q'].includes(r1))

      return `${t('Premium pair')} (${h}) — ${t('the absolute top of your range. Extremely profitable and almost always played aggressively to build the pot.')}`;

    if (['J','T','9','8'].includes(r1))

      return `${t('Medium pair')} (${h}) — ${t('strong enough to set-mine and often worth a raise when unopened.')}`;

    return `${t('Small pair')} (${h}) — ${t('best played for set value; look to hit trips on the flop.')}`;

  }



  if ((r1 === 'A' && r2 === 'K') || (r1 === 'K' && r2 === 'A')) {

    return isSuited

      ? `AKs — ${t('a top-tier premium hand with massive playability.')} ${t('Combines top high-card equity with nut flush potential, making it a powerhouse.')}`

      : `AKo — ${t('a very strong unpaired hand.')} ${t('Excellent for 3-betting and isolating, but requires hitting the board to realize full equity postflop.')}`;

  }



  const faces = 'AKQJT';

  if (faces.includes(r1) && faces.includes(r2)) {

    const suitInfo = isSuited ? t('suited — adds flush outs') : t('offsuit');

    return `${t('Broadway hand')} (${h}, ${suitInfo}) — ${t('strong blocking power and good equity vs most ranges.')}`;

  }



  if (r1 === 'A' && isSuited)

    return `${t('Suited ace')} (${h}) — ${t('strong nut-flush draw potential and backdoor equity; excellent in position.')}`;



  if (isSuited)

    return `${t('Suited connector')} (${h}) — ${t('great implied odds hand; can make straights and flushes cheaply.')}`;



  const tierLabel = { premium: t('Premium hand'), strong: t('Strong hand'), playable: t('Playable hand'), weak: t('Weak hand') }[tier];

  const tierExpl  = {

    premium:  t('one of the best starting hands; play aggressively.'),

    strong:   t('above average equity; generally worth opening.'),

    playable: t('profitable in the right spots but position-dependent.'),

    weak:     t('usually a fold unless in a very specific situation.')

  }[tier];

  return `${tierLabel} (${h}) — ${tierExpl}`;

}



// ── Board texture analysis ────────────────────────────────────────────────────

function analyzeBoardTexture(boardCards) {

  if (!boardCards || boardCards.length < 3) return null;



  const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };

  const ranks = boardCards.map(c => RANK_VAL[c[0]]).sort((a, b) => b - a);

  const suits = boardCards.map(c => c[1]);

  const uniqueSuits = new Set(suits);

  const highCard = ranks[0];



  // Connectivity

  const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);

  let maxConsecutive = 1, cur = 1;

  for (let i = 1; i < sortedRanks.length; i++) {

    if (sortedRanks[i] - sortedRanks[i-1] <= 2) { cur++; maxConsecutive = Math.max(maxConsecutive, cur); }

    else cur = 1;

  }

  const isConnected = maxConsecutive >= 3;



  // Paired board

  const rankCounts = {};

  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });

  const isPaired = Object.values(rankCounts).some(c => c >= 2);



  // Flush texture

  const isMonotone = uniqueSuits.size === 1;

  const isTwoTone  = uniqueSuits.size === 2;

  const isRainbow  = uniqueSuits.size === 3;



  // High-card danger

  const isLowBoard = highCard <= 9;

  const isHighBoard = highCard >= 12;



  let parts = [];

  // Flush

  if (isMonotone)       parts.push(t('🌊 Monotone — three cards of the same suit. Flush draws are complete, and strong flush hands dominate.'));

  else if (isTwoTone)   parts.push(t('💧 Two-tone — flush draws are live for both players. Factor in who has more flush draws in their range.'));

  else if (isRainbow)   parts.push(t('🌈 Rainbow — no flush draws possible yet. Board favors made hands and pure equity.'));



  // Connectivity

  if (isConnected)      parts.push(t('🔗 Connected — many straight draws are possible. Ranges with suited connectors and one-gappers have high equity here.'));

  else                  parts.push(t('🚫 Disconnected — straight draws are unlikely. Made hands and pairs dominate value.'));



  // Pairing

  if (isPaired)         parts.push(t('🃏 Paired board — full houses and trips are possible. Be cautious with one-pair hands facing aggression.'));



  // Height

  if (isHighBoard)      parts.push(t('👑 High board — premium hands and broadway cards connect well. Tight preflop ranges (UTG/HJ) have a natural advantage here.'));

  else if (isLowBoard)  parts.push(t('⬇️ Low board — small pairs, suited connectors, and speculative hands are live. Wide ranges (BTN/BB) gain equity.'));



  return parts;

}



// ── Hand implications on board ────────────────────────────────────────────────

function analyzeHandImplications(hole, boardCards, madeHandLabel, draws) {

  if (!boardCards || boardCards.length < 3) return [];



  const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };

  const boardRanks = boardCards.map(c => RANK_VAL[c[0]]).sort((a, b) => b - a);

  const holeRanks  = hole.map(c => RANK_VAL[c[0]]);

  const holeSuits  = hole.map(c => c[1]);

  const boardSuits = boardCards.map(c => c[1]);



  const implications = [];



  // Overcards on board?

  const myHighCard = Math.max(...holeRanks);

  const overcards  = boardRanks.filter(r => r > myHighCard);

  const isMade = [t('Top Pair'), t('Middle Pair'), t('Bottom Pair'), t('Overpair'), t('Two Pair'), t('Three of a Kind'), t('Straight'), t('Flush'), t('Full House'), t('Quads')].includes(madeHandLabel);

  if (overcards.length > 0 && !isMade) {

    implications.push(t('⚠️ There are {X} overcard(s) on the board higher than your highest hole card. Your unimproved hand is vulnerable.', overcards.length));

  }



  // Blockers — do your hole cards block opponent nut combos?

  const boardTop = boardRanks[0];

  if (holeRanks.includes(boardTop)) {

    implications.push(t("🔒 You hold the top-card rank ({X}), blocking some of your opponent's top-pair and set combos.").replace('{X}', boardCards.find(c=>RANK_VAL[c[0]]===boardTop)[0]));

  }



  // Set potential if holding a pocket pair

  if (holeRanks[0] === holeRanks[1]) {

    if (boardRanks.includes(holeRanks[0])) {

      implications.push(t('✅ You flopped a SET! This is a monster — you should typically look to build the pot aggressively.'));

    } else {

      implications.push(t('🎰 You hold a pocket pair but missed the set. You have roughly 8% (2 outs × ~4%) to hit trips on the next street.'));

    }

  }



  // Flush potential

  const myFlushSuit = holeSuits.find(s => boardSuits.filter(bs => bs === s).length >= 2);

  if (myFlushSuit) {

    const total = boardSuits.filter(s => s === myFlushSuit).length + holeSuits.filter(s => s === myFlushSuit).length;

    if (total >= 5) {

      implications.push(t("♠️ You've made a flush. Consider your kicker rank — a low flush can be beaten by a higher one."));

    } else if (total === 4) {

      implications.push(t('🎯 You have a flush draw (one more {X} needed). ~19% chance to hit by the river on the flop, ~18% turn-to-river.', myFlushSuit));

    } else if (total === 3 && boardCards.length === 3) {

      implications.push(t('🔮 Backdoor flush draw — you need two running {X}s (~4%). Not a primary draw but adds equity.', myFlushSuit));

    }

  }

  

  // Vulnerability to flush draws

  const boardSuitCounts = {};

  boardSuits.forEach(s => boardSuitCounts[s] = (boardSuitCounts[s] || 0) + 1);

  const flushDrawSuitOnBoard = Object.keys(boardSuitCounts).find(s => boardSuitCounts[s] >= 2);

  if (flushDrawSuitOnBoard && !holeSuits.includes(flushDrawSuitOnBoard) && [t('Top Pair'), t('Overpair'), t('Two Pair'), t('Three of a Kind')].includes(madeHandLabel)) {

    implications.push(t("⚠️ The board is two-tone, but you do not hold any cards in that suit. Your strong made hand is vulnerable to flush draws in your opponent's range."));

  }



  // Straight outs

  if (draws.includes('OESD')) {

    implications.push(t('📏 Open-ended straight draw — 8 outs give you ~32% to complete by the river from the flop, ~17% turn-to-river.'));

  } else if (draws.includes('Gutshot')) {

    implications.push(t('📍 Gutshot straight draw — 4 outs give you ~16% to complete by the river from the flop, ~9% turn-to-river.'));

  }



  // Nut-adjacent hands

  if (madeHandLabel === t('Top Pair') || madeHandLabel === t('Overpair')) {

    const topRank = boardRanks[0];

    const myPairRank = holeRanks.find(r => r === topRank || r === holeRanks[0]);

    if (myHighCard === 14) implications.push(t('👑 Top pair with an Ace kicker — very strong. You dominate most 1-pair hands.'));

    else implications.push(t('💪 Top pair — solid but can be outdrawn. Watch for two-pair and set combos in opponent range.'));

  }



  if (madeHandLabel === t('Two Pair')) {

    implications.push(t('🤝 Two pair — strong but check if the board is paired (which gives others full house outs) or if a straight/flush is possible.'));

  }



  if (madeHandLabel === t('Full House') || madeHandLabel === t('Quads')) {

    implications.push(t('🏆 Near-unbeatable hand. Your primary goal is to maximize value — slow-play or build the pot depending on board texture.'));

  }



  return implications;

}



// ── Postflop description (used in teacher) ───────────────────────────────────

function postflopHandDescription(hole, boardCards) {

  if (!hole || hole.length < 2 || !boardCards || boardCards.length < 3) return t('Invalid hand or board');



  const score = scoreSevenJs(hole, boardCards);

  const cat   = Math.floor(score / 10000000000);

  const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };



  let madeHand = '';

  if      (cat >= 8) madeHand = t('Straight Flush');

  else if (cat === 7) madeHand = t('Quads');

  else if (cat === 6) madeHand = t('Full House');

  else if (cat === 5) madeHand = t('Flush');

  else if (cat === 4) madeHand = t('Straight');

  else if (cat === 3) madeHand = t('Three of a Kind');

  else if (cat === 2) madeHand = t('Two Pair');

  else if (cat === 1) {

    let hr1 = RANK_VAL[hole[0][0]], hr2 = RANK_VAL[hole[1][0]];

    let boardRanks = [...new Set(boardCards.map(c => RANK_VAL[c[0]]))].sort((a,b)=>b-a);

    let pairRank = (hr1 === hr2) ? hr1 : (boardRanks.includes(hr1) ? hr1 : (boardRanks.includes(hr2) ? hr2 : 0));

    if      (pairRank > boardRanks[0])                                         madeHand = t('Overpair');

    else if (pairRank === boardRanks[0])                                       madeHand = t('Top Pair');

    else if (pairRank === boardRanks[1])                                       madeHand = t('Middle Pair');

    else if (boardRanks.length >= 3 && pairRank === boardRanks[boardRanks.length-1]) madeHand = t('Bottom Pair');

    else                                                                       madeHand = t('Underpair');

  } else {

    madeHand = t('High Card');

  }



  // Draw detection

  const cards = [...hole, ...boardCards];

  const suits = cards.map(c => c[1]);

  const flushSuit = ['s','h','d','c'].find(s => suits.filter(x=>x===s).length >= 4);

  const isFd = !!flushSuit;

  let isNfd = false;

  if (isFd) {

    const holeSuits  = hole.map(c=>c[1]);

    const boardSuits = boardCards.map(c=>c[1]);

    if (holeSuits.includes(flushSuit) && RANK_VAL[hole.find(c=>c[1]===flushSuit)?.[0]] === 14) isNfd = true;

  }



  let ranks = [...new Set(cards.map(c=>RANK_VAL[c[0]]))].sort((a,b)=>a-b);

  if (ranks.includes(14)) ranks.unshift(1);

  let oesd = false, gutshot = false;

  let straightHighCard = 0;

  

  // Enhanced straight detection with high card tracking

  for (let k = 0; k < ranks.length - 3; k++) {

    const span = ranks[k+3] - ranks[k];

    if (span === 3) { 

      if (ranks[k]>1 && ranks[k+3]<14) {

        oesd = true;

        straightHighCard = Math.max(straightHighCard, ranks[k+3]);

      } else {

        gutshot = true;

        straightHighCard = Math.max(straightHighCard, ranks[k+3] || 14);

      }

    }

    else if (span === 4) {

      gutshot = true;

      straightHighCard = Math.max(straightHighCard, ranks[k+3] || 14);

    }

  }



  // Backdoor draws (3 to flush/straight on flop)

  let backdoorFlush = false, backdoorStraight = false;

  if (boardCards.length === 3 && !isFd) {

    ['s','h','d','c'].forEach(s => {

      if (cards.filter(c=>c[1]===s).length === 3) backdoorFlush = true;

    });

    const flop3 = [...new Set(cards.map(c=>RANK_VAL[c[0]]))];

    for (let k=0; k<flop3.length-1; k++) {

      if (flop3[k+1]-flop3[k] <= 3) backdoorStraight = true;

    }

  }



  const draws = [];

  if (cat < 5) {

    if (isNfd) draws.push(t('Nut Flush Draw'));

    else if (isFd) draws.push(t('Flush Draw'));

    if (oesd) {

      const highCardName = straightHighCard === 14 ? 'Ace-high' : 

                           straightHighCard === 13 ? 'King-high' :

                           straightHighCard === 12 ? 'Queen-high' :

                           straightHighCard === 11 ? 'Jack-high' :

                           straightHighCard === 10 ? 'Ten-high' :

                           `${straightHighCard}-high`;

      draws.push(`${highCardName} ${t('OESD')}`);

    }

    else if (gutshot) {

      const highCardName = straightHighCard === 14 ? 'Ace-high' : 

                           straightHighCard === 13 ? 'King-high' :

                           straightHighCard === 12 ? 'Queen-high' :

                           straightHighCard === 11 ? 'Jack-high' :

                           `${straightHighCard}-high`;

      draws.push(`${highCardName} ${t('Gutshot')}`);

    }

    if (!isFd && backdoorFlush) draws.push(t('Backdoor Flush Draw'));

    if (!oesd && !gutshot && backdoorStraight) draws.push(t('Backdoor Straight Draw'));

  }



  const drawText = draws.length ? ' + ' + draws.join(' / ') : '';



  let desc = '';

  if      (cat >= 6)  desc = t('A monster hand. Almost always bet or raise for maximum value.');

  else if (cat === 5) desc = t('A very strong made hand. Usually bet for value and protection.');

  else if (cat === 4) desc = t('A strong made hand, though vulnerable to flushes on some boards.');

  else if (cat === 3) desc = t('A very strong hand. Excellent for building the pot.');

  else if (cat === 2) desc = t('A strong hand that usually wants to bet for value.');

  else if (madeHand === t('Overpair') || madeHand === t('Top Pair')) {

    const hasStrongDraw = isFd || isNfd || oesd || gutshot;

    desc = hasStrongDraw ? t('A strong top pair with massive draw equity.') : t('A good made hand. Often bets for value, but exercise pot control if facing heavy aggression.');

  } else if (madeHand === t('Middle Pair') || madeHand === t('Bottom Pair')) {

    const hasStrongDraw = isFd || isNfd || oesd || gutshot;

    desc = hasStrongDraw ? t('A marginal made hand with strong draw equity.') : t('A marginal made hand. Usually plays passively (check/call) to realize equity.');

  } else {

    if (isNfd || oesd || (isFd && gutshot)) desc = t('A premium draw. Plays well aggressively as a semi-bluff.');

    else if (isFd || gutshot) desc = t('A reasonable draw. Can be used as a semi-bluff or played passively depending on odds.');

    else desc = t('Weak hand with no significant made strength or draws. Usually a fold to any bet.');

  }



  return { label: `<strong>${madeHand}${drawText}</strong> — ${desc}`, madeHand, draws: draws.map(d=>d.replace(t('Nut Flush Draw'),'Nut Flush Draw').replace(t('Flush Draw'),'Flush Draw').replace(t('OESD'),'OESD').replace(t('Gutshot'),'Gutshot')) };

}



// ── Feedback Engine for Behavioral Analysis ─────────────────────────────────────

class FeedbackEngine {

  constructor() {

    this.strategies = {

      correct: {

        check: (userAction, bestAction, solution) => ({

          title: t('Perfect!'),

          explanation: t('You made the optimal GTO decision. This maximizes your expected value against a balanced opponent.'),

          exploitativeTip: t('Against weaker opponents, consider deviating from GTO to exploit their tendencies.')

        }),

        category: 'correct'

      },

      tooTight: {

        check: (userAction, bestAction, solution) => {

          const isTooTight = userAction === 'fold' && (bestAction === 'open' || bestAction === 'call');

          return isTooTight;

        },

        category: 'tooTight',

        generate: (userAction, bestAction, solution) => ({

          title: t('Too Tight'),

          explanation: t('You folded when you should have played. This is a common leak that loses value over time.'),

          exploitativeTip: t('Consider calling with marginal hands in position to realize equity and avoid being exploited by aggressive opponents.')

        })

      },

      tooLoose: {

        check: (userAction, bestAction, solution) => {

          const isTooLoose = userAction === 'open' && bestAction === 'fold';

          return isTooLoose;

        },

        category: 'tooLoose',

        generate: (userAction, bestAction, solution) => ({

          title: t('Too Loose'),

          explanation: t('You opened with a hand that should be folded. This puts you in difficult spots postflop.'),

          exploitativeTip: t('Tighten your range from early positions and only play speculative hands in position with deep stacks.')

        })

      },

      closeCall: {

        check: (userAction, bestAction, solution) => {

          const isCloseCall = userAction === 'call' && bestAction === 'fold';

          return isCloseCall;

        },

        category: 'closeCall',

        generate: (userAction, bestAction, solution) => ({

          title: t('Close Call'),

          explanation: t('You called with a marginal hand. This can be profitable in position but risky out of position.'),

          exploitativeTip: t('Consider your position and opponent tendencies when making close decisions.')

        })

      }

    };

  }



  generateFeedback(userAction, bestAction, solution) {

    // Determine the category

    let category = 'correct';

    

    if (this.strategies.tooTight.check(userAction, bestAction, solution)) {

      category = 'tooTight';

    } else if (this.strategies.tooLoose.check(userAction, bestAction, solution)) {

      category = 'tooLoose';

    } else if (this.strategies.closeCall.check(userAction, bestAction, solution)) {

      category = 'closeCall';

    }



    // Generate feedback based on category

    if (category === 'correct') {

      return this.strategies.correct.check(userAction, bestAction, solution);

    } else {

      return this.strategies[category].generate(userAction, bestAction, solution);

    }

  }

}



const feedbackEngine = new FeedbackEngine();

// ── Main teacher function ─────────────────────────────────────────────────────



// ── Main teacher function ─────────────────────────────────────────────────────

/**
 * Generates rich HTML content explaining the GTO reasoning for the current decision.
 *
 * TASK 3 - i18n CONTRACT (enforced):
 *   1. Every user-visible string MUST be wrapped in t() before insertion into the
 *      returned HTML. This includes section headers like 'Hand Strength:',
 *      'Strategy:', 'Board Texture:', etc.
 *   2. After the caller injects the returned HTML into the DOM via innerHTML, it
 *      MUST immediately call updateDomTranslations() to translate any [data-i18n]
 *      child elements that may have been created inside the HTML template strings.
 *      This is already done in updateContext() in logic.js.
 *   3. Do NOT use raw English string literals here - every piece of user-facing
 *      text must go through t() so RU and HE translations render correctly.
 *
 * @param {object} profile - The current GTO action profile from actionProfile().
 *   Expected shape: { best, reason, source, actions, equity }
 * @returns {string} An HTML string ready to be injected into #teacherContent.
 */
function analyzeGameState(profile, board, hand, madeHandLabel, draws) {
  // Extract data for Coach's Clipboard
  const state = {
    madeHand: madeHandLabel || t('High Card'),
    drawStatus: draws && draws.length > 0 ? draws.join(', ') : t('No obvious draws'),
    boardTexture: t('Dry'),
    blockers: t('None'),
    handStrength: '',
    potOddsInfo: '',
    playstyleNote: ''
  };

  if (board.length >= 3) {
    const textureParts = analyzeBoardTexture(board);
    if (textureParts && textureParts.length > 0) {
      state.boardTexture = textureParts.join(', ');
    }
    
    // Simplistic blockers check for UI
    const implications = analyzeHandImplications(app.gto.hero, board, madeHandLabel, draws);
    const blockerImp = implications.find(i => i.includes('🔒') || i.includes('blocking'));
    if (blockerImp) state.blockers = blockerImp.replace('🔒 ', '');
  }

  return state;
}

function generateTeacherText(profile) {
  if (typeof t !== 'function') window.t = (str) => str;
  const board = app.gto.board.filter(Boolean);
  const street = currentStreet(board);
  const h = handClass(app.gto.hero) || '';
  
  let madeHandForImplications = '';
  let drawsForImplications = [];

  if (board.length >= 3) {
    const evalRes = evaluatePostflopHand(app.gto.hero, board);
    if (evalRes) {
      madeHandForImplications = evalRes.madeHand;
      drawsForImplications = evalRes.draws;
    }
  }

  const gameState = analyzeGameState(profile, board, h, madeHandForImplications, drawsForImplications);
  
  // Hand & Board
  let handBoardText = '';
  if (street === 'preflop') {
    handBoardText = handDescription(handClass(app.gto.hero));
    if (typeof cardMarkup === 'function' && app.gto.hero && app.gto.hero.length === 2) {
      handBoardText = handBoardText.replace(/\(.*?\)/, `(${cardMarkup(app.gto.hero[0])} ${cardMarkup(app.gto.hero[1])})`);
    }
  } else {
    handBoardText = `<strong>${gameState.madeHand}</strong> ${t('on a')} <strong>${gameState.boardTexture}</strong> ${t('board')}. `;
    if (gameState.drawStatus !== t('No obvious draws')) {
      handBoardText += `${t('You have')} ${gameState.drawStatus}. `;
    }
    if (gameState.blockers !== t('None')) {
      handBoardText += ` ${gameState.blockers}`;
    }
  }

  // Math & Odds
  let mathOddsText = '';
  const facingStr = $('#facingSize') ? $('#facingSize').value : '0';
  const potStr = $('#potSize') ? $('#potSize').value : '1.5';
  const isUnopened = (selectedValue('#lastAction') === 'unopened' && parseFloat(facingStr) === 0);
  
  if (isUnopened) {
    mathOddsText = t('Pot is unopened. Focus on positional range advantages and stealing dead money.');
  } else {
    const odds = parseFloat(facingStr) / (parseFloat(potStr) + parseFloat(facingStr));
    if (!isNaN(odds) && isFinite(odds) && odds > 0) {
      mathOddsText = `${t('You are facing a raise of')} ${facingStr} bb. ${t('Your pot odds are roughly')} <strong>${(odds * 100).toFixed(1)}%</strong>, ${t('which sets your Minimum Defense Frequency (MDF).')}`;
    } else {
      mathOddsText = t('Calculate your Pot Odds and MDF against this bet size to determine your required equity.');
    }
  }

  // Playstyle Note / Exploitative Tip
  let playstyleNote = '';
  const heroPos = selectedValue('#heroPos') || 'BTN';
  if (street === 'preflop') {
    if (['UTG', 'HJ'].includes(heroPos)) playstyleNote = t('Early position dictates a very tight, premium-heavy range.');
    else if (['CO', 'BTN'].includes(heroPos)) playstyleNote = t('Late position allows you to open wider and leverage positional advantage.');
    else playstyleNote = t('Playing out of the blinds means you will be Out Of Position (OOP) postflop. Defend carefully.');
  } else {
    const hasAir = madeHandForImplications === t('High Card');
    const isDrawHeavy = gameState.boardTexture.includes('Two-tone') || gameState.boardTexture.includes('Connected');
    if (hasAir && isDrawHeavy && (profile.best.includes('BET') || profile.best.includes('RAISE'))) {
      playstyleNote = t("💡 Exploitative Tip: You have air on a board that heavily connects with recreational calling ranges. It might be better to give up rather than bluffing a calling station.");
    } else if (drawsForImplications.length > 0 && parseFloat(facingStr) > 0 && (profile.best.includes('CALL') || profile.best.includes('RAISE'))) {
      playstyleNote = t("💡 Exploitative Tip: With a strong draw, raising instead of calling gives you two paths to victory: forcing a fold now, or hitting your draw later.");
    } else {
      playstyleNote = t('Play solid GTO. Stick to your assigned frequencies unless you have a specific read on the villain.');
    }
  }

  // Strategy
  const pickRandomTeacher = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let strategy = '';
  if (profile.best === 'FOLD') {
    strategy = pickRandomTeacher([
      t('Your hand is too weak on this board, especially facing this sizing.'),
      t('Without a strong draw or blocker, floating here is mathematically losing EV.'),
      t('GTO dictates folding here as your equity is insufficient to withstand aggression.')
    ]);
  } else if (profile.best === 'OPEN' || profile.best.includes('RAISE') || profile.best.includes('BET')) {
    strategy = pickRandomTeacher([
      t('This hand is strong enough to play aggressively. Take the betting lead and build the pot.'),
      t('GTO heavily prefers an aggressive action here to capture dead money and extract value.'),
      t('Raising establishes initiative and maximizes EV with a dominant value or high-frequency bluff.')
    ]);
  } else if (profile.best === 'CALL') {
    strategy = pickRandomTeacher([
      t('This hand has enough equity to see the next street, but is not strong enough to raise.'),
      t('Calling realizes your equity smoothly without over-inflating the pot.'),
      t('This holding fits well into a passive calling range, catching bluffs while controlling pot size.')
    ]);
  } else {
    strategy = pickRandomTeacher([
      t('Your hand is part of a mixed strategy or passive line. Observe how opponents react.'),
      t('This spot represents a mixed equilibrium frequency. Balance your range to remain unexploitable.')
    ]);
  }

  let fallbackNote = '';
  if (profile.source === 'MATH FALLBACK') {
    fallbackNote = ` <em style="color:var(--muted); font-size:12px;">${t('(Math heuristic fallback active)')}</em>`;
  }

  // Coach's Clipboard UI
  const clipboardHTML = `
    <div class="coach-clipboard" style="margin-top: 10px;">
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px;">
        <li style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">🃏</span>
          <div>
            <strong style="color: var(--text-color); font-size: 13px; display: block; margin-bottom: 2px;">${t('Hand & Board')}</strong>
            <span style="color: var(--muted); font-size: 13px; line-height: 1.4;">${handBoardText}</span>
          </div>
        </li>
        <li style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">🧮</span>
          <div>
            <strong style="color: var(--text-color); font-size: 13px; display: block; margin-bottom: 2px;">${t('Math & Odds')}</strong>
            <span style="color: var(--muted); font-size: 13px; line-height: 1.4;">${mathOddsText}</span>
          </div>
        </li>
        <li style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">🎯</span>
          <div>
            <strong style="color: var(--text-color); font-size: 13px; display: block; margin-bottom: 2px;">${t('Playstyle Note')}</strong>
            <span style="color: var(--muted); font-size: 13px; line-height: 1.4;">${playstyleNote}</span>
          </div>
        </li>
        <li style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">🧠</span>
          <div>
            <strong style="color: var(--text-color); font-size: 13px; display: block; margin-bottom: 2px;">${t('Strategy')}</strong>
            <span style="color: var(--muted); font-size: 13px; line-height: 1.4;">${strategy}${fallbackNote}</span>
          </div>
        </li>
      </ul>
    </div>
  `;

  return clipboardHTML;
}