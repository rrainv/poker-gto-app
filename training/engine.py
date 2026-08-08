import numpy as np
import mmap
import os
from numba import njit, prange

# ---------------------------------------------------------------------------
# TASK 1: CACTUS KEV'S PRIME REPRESENTATION (32-BIT INTEGER CARDS)
# ---------------------------------------------------------------------------
PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]
RANKS = '23456789TJQKA'
SUITS = 'hsdc'

def get_card_int(rank_char, suit_char):
    """Converts a string card (e.g. 'Ah') into a 32-bit Cactus Kev integer."""
    r = RANKS.index(rank_char)
    s = SUITS.index(suit_char)
    suit_bit = 1 << s
    prime = PRIMES[r]
    rank_bit = 1 << r
    return (rank_bit << 16) | (suit_bit << 12) | (r << 8) | prime

DECK_INTS = np.array([get_card_int(r, s) for r in RANKS for s in SUITS], dtype=np.int32)

# ---------------------------------------------------------------------------
# DEEP STACK ABSTRACTION
# ---------------------------------------------------------------------------
STACK_BUCKETS = np.array([10, 20, 30, 50, 100, 200, 300, 400, 500], dtype=np.int32)

@njit
def discretize_stack(stack_size):
    idx = np.abs(STACK_BUCKETS - stack_size).argmin()
    return STACK_BUCKETS[idx]

@njit
def get_bet_sizes(pot, stack, is_preflop):
    if is_preflop:
        return np.array([2.5, 3.5, stack], dtype=np.float32)
    if stack > 150:
        return np.array([pot * 0.33, pot * 0.75, stack], dtype=np.float32)
    else:
        return np.array([pot * 0.33, pot * 0.5, pot * 0.75, stack], dtype=np.float32)

# ---------------------------------------------------------------------------
# GAME TREE PRUNING & ISOMORPHISM (MOCK LOGIC)
# ---------------------------------------------------------------------------
def canonical_hand(cards):
    """Placeholder for canonical isomorphism logic on 32-bit ints."""
    return tuple(sorted(cards))

def is_playable_hand(c1_int, c2_int):
    """
    Placeholder for heuristic pruning using 32-bit integer logic.
    For now, returns True to ensure compatibility until bitwise heuristics are fully built.
    """
    return True

# ---------------------------------------------------------------------------
# TASK 2: PRECOMPUTED LUT WITH MEMORY MAPPING (mmap)
# ---------------------------------------------------------------------------
LUT_FILE_PATH = os.path.join(os.path.dirname(__file__), 'eval_lut.dat')
LUT_SIZE_BYTES = 32487834 * 4 # Standard TwoPlusTwo size

def get_mmap_lut():
    if not os.path.exists(LUT_FILE_PATH):
        # Create a dummy LUT file if it doesn't exist so the pipeline won't hard crash.
        # DO NOT DO THIS IN PRODUCTION: This is solely to unblock the execution 
        # before the generation script is run.
        try:
            with open(LUT_FILE_PATH, "wb") as f:
                f.write(b'\0' * LUT_SIZE_BYTES)
        except Exception:
            return np.zeros(LUT_SIZE_BYTES // 4, dtype=np.int32)
            
    f = open(LUT_FILE_PATH, "r+b")
    mmapped_file = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    return np.ndarray(shape=(LUT_SIZE_BYTES // 4,), dtype=np.int32, buffer=mmapped_file)

EVAL_LUT = get_mmap_lut()

# ---------------------------------------------------------------------------
# TASK 3: VECTORIZED BATCH EVALUATION
# ---------------------------------------------------------------------------
@njit(parallel=True)
def fast_batch_evaluate_7(cards_matrix, lut):
    """
    Evaluates a batch of 7-card hands using Numba's parallelization and mmap LUT.
    cards_matrix: (N, 7) array of 32-bit card integers.
    """
    N = cards_matrix.shape[0]
    scores = np.zeros(N, dtype=np.int32)
    
    for i in prange(N):
        idx = 53
        idx = lut[idx + cards_matrix[i, 0]]
        idx = lut[idx + cards_matrix[i, 1]]
        idx = lut[idx + cards_matrix[i, 2]]
        idx = lut[idx + cards_matrix[i, 3]]
        idx = lut[idx + cards_matrix[i, 4]]
        idx = lut[idx + cards_matrix[i, 5]]
        idx = lut[idx + cards_matrix[i, 6]]
        scores[i] = idx
        
    return scores

class GameState:
    def __init__(self, history="", board=None, player_cards=None, pot=0, stack=100, num_players=6):
        self.history = history
        # Cards are now lists of 32-bit integers
        self.board = board if board is not None else []
        self.player_cards = player_cards if player_cards is not None else [[] for _ in range(num_players)]
        self.pot = pot
        self.stack = discretize_stack(stack)
        self.num_players = num_players
        self.active_players = [True] * num_players
        
    def get_actions(self):
        sizes = get_bet_sizes(self.pot, self.stack, len(self.board) < 3)
        actions = ['p', 'c'] + [f"b{int(s)}" for s in sizes]
        return actions

    def is_terminal(self):
        return sum(self.active_players) <= 1 or len(self.history) >= self.num_players * 2
        
    def get_payoffs(self):
        # Actual payoffs calculation will rely on fast_batch_evaluate_7 
        # applied to active players in cfr.py or here.
        return [0.0] * self.num_players
