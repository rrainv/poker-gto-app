from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import os
import json
import math
from model import DeepCFRNet, encode_cards

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

model = DeepCFRNet(input_dim=69)
model_path = os.path.join(os.path.dirname(__file__), "model.pt")

if os.path.exists(model_path):
    try:
        model.load_state_dict(torch.load(model_path, weights_only=True))
        model.eval()
        print("Loaded Universal Deep CFR Model")
    except Exception as e:
        print("Model size mismatch, serving random noise until training finishes...")
else:
    print("No model.pt found. Serving random noise.")

def get_training_status():
    progress_file = os.path.join(os.path.dirname(__file__), "progress.json")
    if os.path.exists(progress_file):
        try:
            with open(progress_file, "r") as f:
                return json.load(f)
        except: pass
    return {"status": "idle", "progress": 0, "message": ""}

@app.route('/status', methods=['GET'])
def status():
    return jsonify(get_training_status())

# --- Postflop Equity Heuristic ---
RANK_VALUE = {r: i+2 for i, r in enumerate('23456789TJQKA')}
import itertools

def score_five(cards):
    values = sorted([RANK_VALUE[c[0]] for c in cards], reverse=True)
    suits = [c[1] for c in cards]
    counts = {}
    for v in values: counts[v] = counts.get(v, 0) + 1
    groups = sorted([(v, c) for v, c in counts.items()], key=lambda x: (x[1], x[0]), reverse=True)
    unique = sorted(list(set(values)), reverse=True)
    
    wheel = unique == [14, 5, 4, 3, 2]
    straight = len(unique) == 5 and (unique[0] - unique[4] == 4 or wheel)
    straight_high = 5 if wheel else unique[0] if straight else 0
    flush = len(set(suits)) == 1
    
    def pack(cat, tiebreakers):
        return cat * 1e10 + sum(v * (15 ** (4 - i)) for i, v in enumerate(tiebreakers))
        
    if flush and straight: return pack(8, [straight_high])
    if groups[0][1] == 4: return pack(7, [groups[0][0], groups[1][0]])
    if groups[0][1] == 3 and groups[1][1] == 2: return pack(6, [groups[0][0], groups[1][0]])
    if flush: return pack(5, values)
    if straight: return pack(4, [straight_high])
    if groups[0][1] == 3: return pack(3, [groups[0][0]] + [g[0] for g in groups if g[1]==1])
    if groups[0][1] == 2 and groups[1][1] == 2: return pack(2, [groups[0][0], groups[1][0], groups[2][0]])
    if groups[0][1] == 2: return pack(1, [groups[0][0]] + [g[0] for g in groups if g[1]==1])
    return pack(0, values)

def score_preflop(hole):
    def chen_pts(r): return {'A':10,'K':8,'Q':7,'J':6,'T':5}.get(r, int(r)/2 if r.isdigit() else 0)
    RANKS = '23456789TJQKA'
    RANK_VALUE = {r: i for i, r in enumerate(RANKS)}
    p1, p2 = chen_pts(hole[0][0]), chen_pts(hole[1][0])
    score = max(p1, p2)
    is_pair = hole[0][0] == hole[1][0]
    suited = hole[0][1] == hole[1][1]
    if is_pair: score = max(5.0, score * 2)
    if suited: score += 2
    diff = abs(RANK_VALUE[hole[0][0]] - RANK_VALUE[hole[1][0]])
    if diff == 2: score -= 1
    elif diff == 3: score -= 2
    elif diff == 4: score -= 4
    elif diff > 4: score -= 5
    return score

def score_seven(hole, board):
    cards = hole + board
    if len(cards) < 5: return 0
    return max(score_five(c) for c in itertools.combinations(cards, 5))

@app.route('/solve', methods=['POST'])
def solve():
    try:
        data = request.json
        table_size = float(data.get('table_size', 6))
        stack = float(data.get('stack', 100))
        rake = float(data.get('rake', 0))
        hero_pos = data.get('hero_pos', 'BTN')
        POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
        pos_idx = POSITIONS.index(hero_pos) if hero_pos in POSITIONS else 3

        last_action = data.get('lastAction', 'unopened')
        ACTIONS = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check']
        action_idx = ACTIONS.index(last_action) if last_action in ACTIONS else 0

        pot_size = float(data.get('potSize', 1.5))
        facing_size = float(data.get('facingSize', 0.0))

        hand = data.get('hand', 'AA')
        board = data.get('board', [])
        is_postflop = len(board) >= 3
        
        status_data = get_training_status()
        is_training = status_data.get('status') == 'training'
        
        # Simulate feature encoding
        x = torch.zeros(69)
        x[52] = table_size / 9.0
        x[53] = stack / 200.0
        x[54] = rake / 10.0
        x[55] = pot_size / 200.0
        x[56] = facing_size / 200.0
        x[57 + pos_idx] = 1.0
        x[63 + action_idx] = 1.0
        hole_cards = []
        if len(hand) == 2: hole_cards = [hand[0]+'s', hand[1]+'h'] # Pair
        elif len(hand) == 3 and hand[2] == 's': hole_cards = [hand[0]+'s', hand[1]+'s']
        elif len(hand) == 3 and hand[2] == 'o': hole_cards = [hand[0]+'s', hand[1]+'h']
        encode_cards(hole_cards, x)
        print("HOLE CARDS:", hole_cards, flush=True)
        print("INPUTS: table_size={}, stack={}, rake={}, pot_size={}, facing_size={}".format(table_size, stack, rake, pot_size, facing_size), flush=True)
        print("POS_IDX={}, ACTION_IDX={}".format(pos_idx, action_idx), flush=True)
        print("TOTAL X SUM:", x.sum().item(), flush=True)
        print("X[52:57]:", x[52:57].tolist(), flush=True)
        
        if not is_training:
            with torch.no_grad():
                preds = model(x.unsqueeze(0))
                print("PREDS:", preds.tolist(), flush=True)
                
            if not is_postflop:
                p = preds.tolist()[0]
                
                # --- GTO-INFORMED PREFLOP HEURISTIC ---
                # The neural network has wild discontinuities between adjacent hands.
                # We build a smooth base strategy from hand properties and blend it
                # with the model to produce sensible, continuous decisions.
                
                score = score_preflop(hole_cards)
                r1, r2 = hole_cards[0][0], hole_cards[1][0]
                suited = hole_cards[0][1] == hole_cards[1][1]
                is_pair = r1 == r2
                RVAL = {r: i for i, r in enumerate('23456789TJQKA')}
                high_rank = max(RVAL[r1], RVAL[r2])
                low_rank = min(RVAL[r1], RVAL[r2])
                gap = high_rank - low_rank
                has_ace = high_rank == 12
                has_king = high_rank == 11
                has_broadway = high_rank >= 8  # T+
                connected = gap <= 1 and not is_pair
                one_gap = gap == 2 and not is_pair
                
                # Position modifier: earlier = tighter, late/blinds = looser (defending dead money)
                pos_modifier = {0: -4.0, 1: -2.0, 2: -0.5, 3: 1.0, 4: 1.5, 5: 3.0}.get(pos_idx, 0.0)
                
                # Facing action modifier: bigger raise = tighter
                commitment = facing_size / stack if stack > 0 else 1.0
                action_tightness = 0.0
                if last_action == 'raise':
                    action_tightness = min(3.0, commitment * 8.0)
                elif last_action == '3bet':
                    action_tightness = min(6.0, 3.0 + commitment * 10.0)
                elif last_action == '4bet':
                    action_tightness = min(10.0, 6.0 + commitment * 15.0)
                
                # Build composite hand strength (0-20 scale)
                hand_strength = score + pos_modifier - action_tightness
                
                # Suitedness bonus (playability, nut potential)
                if suited:
                    hand_strength += 1.5
                    if has_ace: hand_strength += 1.0  # nut flush potential
                
                # Connectedness bonus (straight potential)
                if connected: hand_strength += 1.0
                elif one_gap: hand_strength += 0.5
                
                # Broadway bonus: two cards T+ have removal / showdown value
                both_broadway = high_rank >= 8 and low_rank >= 8  # both T+
                if both_broadway and not is_pair:
                    hand_strength += 1.0
                
                # Blocker value for Aces/Kings facing aggression
                if has_ace and action_tightness > 0: hand_strength += 1.0
                elif has_king and action_tightness > 0: hand_strength += 0.5
                
                # --- Smooth linear interpolation between strategy buckets ---
                # Define anchor points: (threshold, [open, call, fold])
                # and linearly interpolate between adjacent anchors
                if is_pair:
                    anchors = [
                        (16, [0.90, 0.08, 0.02]),  # AA
                        (14, [0.80, 0.15, 0.05]),  # KK
                        (10, [0.55, 0.35, 0.10]),  # QQ-TT
                        (6,  [0.10, 0.65, 0.25]),  # 99-55
                        (3,  [0.05, 0.50, 0.45]),  # 44-22
                        (0,  [0.02, 0.38, 0.60]),  # below
                    ]
                else:
                    anchors = [
                        (14, [0.80, 0.15, 0.05]),  # AKs premium
                        (11, [0.65, 0.25, 0.10]),  # AQs, KQs
                        (9,  [0.45, 0.45, 0.10]),  # AJs, KJs, KQo
                        (7,  [0.25, 0.55, 0.20]),  # KTo, ATo, QTs
                        (5,  [0.10, 0.50, 0.40]),  # Marginal
                        (3,  [0.00, 0.30, 0.70]),  # Weak
                        (0,  [0.00, 0.10, 0.90]),  # Junk
                    ]
                
                # Interpolate
                hs = hand_strength
                base = anchors[-1][1][:]  # default to lowest
                for k in range(len(anchors) - 1):
                    hi_thresh, hi_strat = anchors[k]
                    lo_thresh, lo_strat = anchors[k + 1]
                    if hs >= hi_thresh:
                        base = hi_strat[:]
                        break
                    elif hs >= lo_thresh:
                        # Linear interpolation between lo and hi
                        t = (hs - lo_thresh) / (hi_thresh - lo_thresh)
                        base = [
                            lo_strat[0] + t * (hi_strat[0] - lo_strat[0]),
                            lo_strat[1] + t * (hi_strat[1] - lo_strat[1]),
                            lo_strat[2] + t * (hi_strat[2] - lo_strat[2])
                        ]
                        break
                
                # Suited ace 3-bet bluff adjustment: A2s-A5s are good bluff candidates
                # but NOT at 76%+ open frequency — more like 30-40% raise, 30% call
                if has_ace and suited and low_rank <= 3 and action_tightness > 0:
                    # A2s-A5s facing a raise: polarized 3-bet candidate
                    base = [0.35, 0.30, 0.35]
                elif has_ace and suited and low_rank <= 7 and action_tightness > 0:
                    # A6s-A9s facing a raise: more of a calling hand
                    base = [0.20, 0.50, 0.30]
                
                # --- Blend base heuristic with model output ---
                # Use 65% heuristic / 35% model to smooth out network noise
                # but still allow the model to influence the decision
                s_model = p[0] + p[1] + p[2]
                if s_model > 0:
                    m = [p[0]/s_model, p[1]/s_model, p[2]/s_model]
                else:
                    m = [0.33, 0.33, 0.34]
                
                BLEND_HEURISTIC = 0.65
                
                # Blinds Defending logic (pot odds based)
                # When pot odds are good, blinds should call extremely wide.
                # Shift fold percentage into call.
                if pos_idx in [4, 5] and facing_size > 0 and last_action == 'raise':
                    pot_odds = facing_size / (pot_size + facing_size) if (pot_size + facing_size) > 0 else 0
                    defense_factor = 0.0
                    if pot_odds <= 0.23:
                        defense_factor = 0.85 # Min-raise: Defend huge chunks of range
                    elif pot_odds <= 0.28:
                        defense_factor = 0.55 # 2.5x open
                    elif pot_odds <= 0.35:
                        defense_factor = 0.25 # 3x open
                        
                    if pos_idx == 4:
                        defense_factor *= 0.5 # SB doesn't close action, defend half as much
                        
                    if defense_factor > 0:
                        shift = base[2] * defense_factor
                        base[2] -= shift
                        base[1] += shift
                        # Trust mathematical defense over raw model output
                        BLEND_HEURISTIC = max(0.90, BLEND_HEURISTIC)
                blended = [
                    base[0] * BLEND_HEURISTIC + m[0] * (1 - BLEND_HEURISTIC),
                    base[1] * BLEND_HEURISTIC + m[1] * (1 - BLEND_HEURISTIC),
                    base[2] * BLEND_HEURISTIC + m[2] * (1 - BLEND_HEURISTIC)
                ]
                
                # Premium override: never fold AA/KK/QQ/AKs
                if is_pair and score >= 14:
                    blended[2] = min(blended[2], 0.05)
                elif score >= 12:
                    blended[2] = min(blended[2], 0.10)
                
                # BB facing no raise can check/call for free. Never fold.
                if pos_idx == 5 and facing_size == 0.0:
                    blended[1] += blended[2]
                    blended[2] = 0.0
                
                s = sum(blended)
                if s > 0:
                    actions = {
                        "Open": max(0, round((blended[0] / s) * 100, 1)),
                        "Call": max(0, round((blended[1] / s) * 100, 1)),
                        "Fold": max(0, round((blended[2] / s) * 100, 1))
                    }
                else:
                    actions = {"Open": 0, "Call": 0, "Fold": 100}
            else:
                score = score_seven(hole_cards, board)
                # Evaluate draws
                cards = hole_cards + board
                suits = [c[1] for c in cards]
                flush_draw = any(suits.count(s) >= 4 for s in set(suits))
                
                RANK_VALUE = {r: i for i, r in enumerate('23456789TJQKA')}
                ranks = set(RANK_VALUE[c[0]] for c in cards)
                if 12 in ranks: ranks.add(-1) # Ace low
                unique_ranks = sorted(list(ranks))
                oesd = gutshot = False
                for k in range(len(unique_ranks) - 3):
                    r1 = unique_ranks[k]
                    r4 = unique_ranks[k+3]
                    if r4 - r1 == 3:
                        if r1 > -1 and r4 < 12: oesd = True
                        else: gutshot = True
                    elif r4 - r1 == 4:
                        gutshot = True
                
                if score < 2000000:
                    if flush_draw and oesd: score = max(score, 3500000)
                    elif flush_draw: score = max(score, 2500000)
                    elif oesd: score = max(score, 1500000)
                    elif gutshot: score = max(score, 500000)
                
                rel_strength = min(1.0, score / 8000015.0)
                
                # Dynamic Bet Sizing Heuristic
                if rel_strength > 0.8: 
                    if stack <= 50:
                        actions = { "All-in": 60, "Bet 66%": 30, "Bet 33%": 0, "Check/Call": 10, "Fold": 0 }
                    else:
                        actions = { "All-in": 20, "Bet 66%": 60, "Bet 33%": 10, "Check/Call": 10, "Fold": 0 }
                elif rel_strength > 0.5:
                    if stack <= 30:
                        actions = { "All-in": 30, "Bet 66%": 40, "Bet 33%": 0, "Check/Call": 30, "Fold": 0 }
                    else:
                        actions = { "All-in": 0, "Bet 66%": 40, "Bet 33%": 40, "Check/Call": 20, "Fold": 0 }
                elif rel_strength > 0.3:
                    actions = { "All-in": 0, "Bet 66%": 0, "Bet 33%": 30, "Check/Call": 60, "Fold": 10 }
                else:
                    actions = { "All-in": 0, "Bet 66%": 0, "Bet 33%": 0, "Check/Call": 30, "Fold": 70 }
            return jsonify({
                "hand": hand,
                "actions": actions
            })
        else:
            return jsonify({
                "hand": hand,
                "actions": {"Open": 33, "Call": 33, "Fold": 33}
            })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("ERROR:", tb)
        return jsonify({"error": str(e), "traceback": tb}), 500

@app.route('/solve_all', methods=['POST'])
def solve_all():
    data = request.json
    table_size = float(data.get('table_size', 6))
    stack = float(data.get('stack', 100))
    rake = float(data.get('rake', 0))
    hero_pos = data.get('hero_pos', 'BTN')
    POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    pos_idx = POSITIONS.index(hero_pos) if hero_pos in POSITIONS else 3
    
    last_action = data.get('lastAction', 'unopened')
    ACTIONS = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check']
    action_idx = ACTIONS.index(last_action) if last_action in ACTIONS else 0
    
    pot_size = float(data.get('potSize', 1.5))
    facing_size = float(data.get('facingSize', 0.0))

    board = data.get('board', [])
    is_postflop = len(board) >= 3
    
    RANKS = '23456789TJQKA'
    SUITS = 'shdc'
    strategy_map = {}
    
    status_data = get_training_status()
    is_training = status_data.get('status') == 'training'
    
    inputs = torch.zeros(169, 69)
    hand_names = []
    
    if is_postflop:
        for i in range(13):
            for j in range(13):
                r1, r2 = RANKS[i], RANKS[j]
                if i == j: 
                    hand_name = r1 + r2
                    hole = [r1+'s', r2+'h']
                elif i > j: 
                    hand_name = r1 + r2 + 'o'
                    hole = [r1+'s', r2+'h']
                else: 
                    hand_name = r2 + r1 + 's'
                    hole = [r2+'s', r1+'s']
                
                # Check if hand conflicts with board
                conflict = any(c in board for c in hole)
                if conflict:
                    strategy_map[hand_name] = { hero_pos: { "impossible": 100 } }
                    continue
                    
                score = score_seven(hole, board)
                
                # Evaluate draws
                cards = hole + board
                suits = [c[1] for c in cards]
                flush_draw = any(suits.count(s) >= 4 for s in set(suits))
                
                RANK_VALUE = {r: i for i, r in enumerate('23456789TJQKA')}
                ranks = set(RANK_VALUE[c[0]] for c in cards)
                if 12 in ranks: ranks.add(-1) # Ace low
                unique_ranks = sorted(list(ranks))
                oesd = gutshot = False
                for k in range(len(unique_ranks) - 3):
                    r1 = unique_ranks[k]
                    r4 = unique_ranks[k+3]
                    if r4 - r1 == 3:
                        if r1 > -1 and r4 < 12: oesd = True
                        else: gutshot = True
                    elif r4 - r1 == 4:
                        gutshot = True
                
                if score < 2000000:
                    if flush_draw and oesd: score = max(score, 3500000)
                    elif flush_draw: score = max(score, 2500000)
                    elif oesd: score = max(score, 1500000)
                    elif gutshot: score = max(score, 500000)
                
                rel_strength = min(1.0, score / 8000015.0)
                
                # Dynamic Bet Sizing Heuristic
                if rel_strength > 0.8: 
                    # Nuts. Deep stacks want to build pot (Bet 66%), short stacks shove
                    if stack <= 50:
                        actions = { "All-in": 60, "Bet 66%": 30, "Bet 33%": 0, "Check/Call": 10, "Fold": 0 }
                    else:
                        actions = { "All-in": 20, "Bet 66%": 60, "Bet 33%": 10, "Check/Call": 10, "Fold": 0 }
                elif rel_strength > 0.5:
                    # Strong. 
                    if stack <= 30:
                        actions = { "All-in": 30, "Bet 66%": 40, "Bet 33%": 0, "Check/Call": 30, "Fold": 0 }
                    else:
                        actions = { "All-in": 0, "Bet 66%": 40, "Bet 33%": 40, "Check/Call": 20, "Fold": 0 }
                elif rel_strength > 0.3:
                    # Marginal. Don't build massive pots.
                    actions = { "All-in": 0, "Bet 66%": 0, "Bet 33%": 30, "Check/Call": 60, "Fold": 10 }
                else:
                    # Weak.
                    actions = { "All-in": 0, "Bet 66%": 0, "Bet 33%": 0, "Check/Call": 30, "Fold": 70 }
                    
                strategy_map[hand_name] = { hero_pos: actions }
            
    if not is_postflop:
        idx = 0
        for i in range(13):
            for j in range(13):
                r1, r2 = RANKS[i], RANKS[j]
                if i == j: 
                    hand = r1 + r2
                    hole = [r1+'s', r2+'h']
                elif i > j: 
                    hand = r1 + r2 + 'o' 
                    hole = [r1+'s', r2+'h']
                else: 
                    hand = r2 + r1 + 's'       
                    hole = [r2+'s', r1+'s']
                
                hand_names.append((hand, hole))
                encode_cards(hole, inputs[idx])
                inputs[idx, 52] = table_size / 9.0
                inputs[idx, 53] = stack / 200.0
                inputs[idx, 54] = rake / 10.0
                inputs[idx, 55] = min(1.0, pot_size / 200.0)
                inputs[idx, 56] = min(1.0, facing_size / 200.0)
                inputs[idx, 57 + pos_idx] = 1.0
                inputs[idx, 63 + action_idx] = 1.0
                idx += 1
                
        if not is_training:
            with torch.no_grad():
                preds = model(inputs)
            
            for idx, (hand_name, hole) in enumerate(hand_names):
                p = preds[idx].tolist()
                
                # --- GTO-INFORMED PREFLOP HEURISTIC (same as /solve) ---
                score = score_preflop(hole)
                r1, r2 = hole[0][0], hole[1][0]
                suited = hole[0][1] == hole[1][1]
                is_pair = r1 == r2
                RVAL = {r: kk for kk, r in enumerate('23456789TJQKA')}
                high_rank = max(RVAL[r1], RVAL[r2])
                low_rank = min(RVAL[r1], RVAL[r2])
                gap = high_rank - low_rank
                has_ace = high_rank == 12
                has_king = high_rank == 11
                connected = gap <= 1 and not is_pair
                one_gap = gap == 2 and not is_pair
                
                # Position modifier: earlier = tighter, late/blinds = looser (defending dead money)
                pos_modifier = {0: -4.0, 1: -2.0, 2: -0.5, 3: 1.0, 4: 1.5, 5: 3.0}.get(pos_idx, 0.0)
                commitment = facing_size / stack if stack > 0 else 1.0
                action_tightness = 0.0
                if last_action == 'raise':
                    action_tightness = min(3.0, commitment * 8.0)
                elif last_action == '3bet':
                    action_tightness = min(6.0, 3.0 + commitment * 10.0)
                elif last_action == '4bet':
                    action_tightness = min(10.0, 6.0 + commitment * 15.0)
                
                hand_strength = score + pos_modifier - action_tightness
                if suited:
                    hand_strength += 1.5
                    if has_ace: hand_strength += 1.0
                if connected: hand_strength += 1.0
                elif one_gap: hand_strength += 0.5
                
                both_broadway = high_rank >= 8 and low_rank >= 8
                if both_broadway and not is_pair:
                    hand_strength += 1.0
                
                if has_ace and action_tightness > 0: hand_strength += 1.0
                elif has_king and action_tightness > 0: hand_strength += 0.5
                
                if is_pair:
                    anchors = [
                        (16, [0.90, 0.08, 0.02]),
                        (14, [0.80, 0.15, 0.05]),
                        (10, [0.55, 0.35, 0.10]),
                        (6,  [0.10, 0.65, 0.25]),
                        (3,  [0.05, 0.50, 0.45]),
                        (0,  [0.02, 0.38, 0.60]),
                    ]
                else:
                    anchors = [
                        (14, [0.75, 0.20, 0.05]),
                        (11, [0.55, 0.35, 0.10]),
                        (9,  [0.35, 0.50, 0.15]),
                        (7,  [0.15, 0.55, 0.30]),
                        (5,  [0.05, 0.40, 0.55]),
                        (3,  [0.00, 0.20, 0.80]),
                        (0,  [0.00, 0.05, 0.95]),
                    ]
                
                hs = hand_strength
                base = anchors[-1][1][:]
                for kk in range(len(anchors) - 1):
                    hi_thresh, hi_strat = anchors[kk]
                    lo_thresh, lo_strat = anchors[kk + 1]
                    if hs >= hi_thresh:
                        base = hi_strat[:]
                        break
                    elif hs >= lo_thresh:
                        t = (hs - lo_thresh) / (hi_thresh - lo_thresh)
                        base = [
                            lo_strat[0] + t * (hi_strat[0] - lo_strat[0]),
                            lo_strat[1] + t * (hi_strat[1] - lo_strat[1]),
                            lo_strat[2] + t * (hi_strat[2] - lo_strat[2])
                        ]
                        break
                
                if has_ace and suited and low_rank <= 3 and action_tightness > 0:
                    base = [0.35, 0.30, 0.35]
                elif has_ace and suited and low_rank <= 7 and action_tightness > 0:
                    base = [0.20, 0.50, 0.30]
                
                s_model = p[0] + p[1] + p[2]
                if s_model > 0:
                    m = [p[0]/s_model, p[1]/s_model, p[2]/s_model]
                else:
                    m = [0.33, 0.33, 0.34]
                
                BLEND_HEURISTIC = 0.65
                
                # Blinds Defending logic (pot odds based)
                # When pot odds are good, blinds should call extremely wide.
                # Shift fold percentage into call.
                if pos_idx in [4, 5] and facing_size > 0 and last_action == 'raise':
                    pot_odds = facing_size / (pot_size + facing_size) if (pot_size + facing_size) > 0 else 0
                    defense_factor = 0.0
                    if pot_odds <= 0.23:
                        defense_factor = 0.85 # Min-raise: Defend huge chunks of range
                    elif pot_odds <= 0.28:
                        defense_factor = 0.55 # 2.5x open
                    elif pot_odds <= 0.35:
                        defense_factor = 0.25 # 3x open
                        
                    if pos_idx == 4:
                        defense_factor *= 0.5 # SB doesn't close action, defend half as much
                        
                    if defense_factor > 0:
                        shift = base[2] * defense_factor
                        base[2] -= shift
                        base[1] += shift
                        # Trust mathematical defense over raw model output
                        BLEND_HEURISTIC = max(0.90, BLEND_HEURISTIC)

                blended = [
                    base[0] * BLEND_HEURISTIC + m[0] * (1 - BLEND_HEURISTIC),
                    base[1] * BLEND_HEURISTIC + m[1] * (1 - BLEND_HEURISTIC),
                    base[2] * BLEND_HEURISTIC + m[2] * (1 - BLEND_HEURISTIC)
                ]
                
                if is_pair and score >= 14:
                    blended[2] = min(blended[2], 0.05)
                elif score >= 12:
                    blended[2] = min(blended[2], 0.10)
                
                # BB facing no raise can check/call for free. Never fold.
                if pos_idx == 5 and facing_size == 0.0:
                    blended[1] += blended[2]
                    blended[2] = 0.0
                
                s = sum(blended)
                if s > 0:
                    actions = {
                        "Open": max(0, round((blended[0] / s) * 100, 1)),
                        "Call": max(0, round((blended[1] / s) * 100, 1)),
                        "Fold": max(0, round((blended[2] / s) * 100, 1))
                    }
                else:
                    actions = {"Open": 0, "Call": 0, "Fold": 100}
                    
                strategy_map[hand_name] = { hero_pos: actions }
    else:
        # Serve dummy preflop data during training
        actions = {"Open": 33, "Call": 33, "Fold": 33}
        for hand, _ in hand_names:
            strategy_map[hand] = { hero_pos: actions }
        
    return jsonify({
        "title": "Live API DeepCFR",
        "positions": [hero_pos],
        "strategy": strategy_map
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
