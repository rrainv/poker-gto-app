import random
from itertools import combinations

RANKS = '23456789TJQKA'
SUITS = 'hsdc'
DECK = [r+s for r in RANKS for s in SUITS]

def evaluate_hand(hole_cards, board_cards):
    """
    Very simplified 5-7 card hand evaluator returning an integer score.
    """
    cards = hole_cards + board_cards
    if len(cards) < 5:
        rank_vals = sorted([RANKS.index(c[0]) + 2 for c in hole_cards], reverse=True)
        return sum(rank_vals)
    
    rank_vals = sorted([RANKS.index(c[0]) + 2 for c in cards], reverse=True)
    suits = [c[1] for c in cards]
    is_flush = any(suits.count(s) >= 5 for s in SUITS)
    unique_ranks = sorted(list(set(rank_vals)), reverse=True)
    if 14 in unique_ranks: unique_ranks.append(1)
        
    is_straight, straight_high, count = False, -1, 1
    for i in range(len(unique_ranks) - 1):
        if unique_ranks[i] - 1 == unique_ranks[i+1]:
            count += 1
            if count >= 5:
                is_straight = True
                straight_high = unique_ranks[i-3]
                break
        else: count = 1
            
    freq = {}
    for r in rank_vals: freq[r] = freq.get(r, 0) + 1
    pairs = sorted(freq.items(), key=lambda x: (x[1], x[0]), reverse=True)
    
    score = 0
    if is_flush and is_straight: score = 8000000 + straight_high
    elif pairs[0][1] == 4: score = 7000000 + pairs[0][0]
    elif pairs[0][1] == 3 and len(pairs) > 1 and pairs[1][1] >= 2: score = 6000000 + pairs[0][0]*100 + pairs[1][0]
    elif is_flush: score = 5000000
    elif is_straight: score = 4000000 + straight_high
    elif pairs[0][1] == 3: score = 3000000 + pairs[0][0]
    elif pairs[0][1] == 2 and len(pairs) > 1 and pairs[1][1] == 2: score = 2000000 + pairs[0][0]*100 + pairs[1][0]
    elif pairs[0][1] == 2: score = 1000000 + pairs[0][0]
    else: score = rank_vals[0]
    return score

class GameState:
    def __init__(self, history="", board=None, player_cards=None, pot=0, stack=100, num_players=6, rake=0.0):
        self.history = history
        self.board = board if board is not None else []
        self.player_cards = player_cards if player_cards is not None else [[] for _ in range(num_players)]
        self.pot = pot
        self.stack = stack
        self.num_players = num_players
        self.rake = rake
        self.active_players = [True] * num_players
        
        # extremely rudimentary logic to track folds via history
        for idx, h in enumerate(self.history):
            if h == 'p':
                self.active_players[idx % self.num_players] = False
        
    def is_terminal(self):
        active_count = sum(self.active_players)
        if active_count <= 1:
            return True
        # Assume max 2 actions per player for toy model
        if len(self.history) >= self.num_players * 2:
            return True
        return False
        
    def get_payoffs(self):
        payoffs = [0.0] * self.num_players
        active_count = sum(self.active_players)
        
        # Someone won by folding everyone else out
        if active_count == 1:
            winner = self.active_players.index(True)
            for i in range(self.num_players):
                payoffs[i] = self.pot * (1 - self.rake) if i == winner else -self.pot / max(1, (self.num_players - 1))
            return payoffs
            
        # Showdown
        scores = []
        for i in range(self.num_players):
            if self.active_players[i]:
                scores.append((evaluate_hand(self.player_cards[i], self.board), i))
        
        scores.sort(reverse=True, key=lambda x: x[0])
        best_score = scores[0][0]
        winners = [x[1] for x in scores if x[0] == best_score]
        
        win_share = (self.pot * (1 - self.rake)) / len(winners)
        loss_share = -self.pot / max(1, (self.num_players - len(winners))) if self.num_players > len(winners) else 0
        
        for i in range(self.num_players):
            if i in winners:
                payoffs[i] = win_share
            else:
                payoffs[i] = loss_share
                
        return payoffs

    def get_actions(self):
        return ['p', 'c', 'b'] # Fold, Call, Bet
