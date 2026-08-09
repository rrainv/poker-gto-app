import itertools
from typing import List, Tuple

PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]

class EvaluatorLookupTable:
    """
    Singleton Cactus Kev / OMPEval style Pre-computed Lookup Table.
    Provides clean memory initialization, zero startup lag, and 
    optimal L1/L2 cache efficiency by storing exactly 7462 
    unique hand equivalence classes.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.flush_lookup = {}
        self.unsuited_lookup = {}
        
        # 13 choose 5 with replacement = 6188 combinations
        for combo in itertools.combinations_with_replacement(range(13), 5):
            counts = {r: combo.count(r) for r in set(combo)}
            if any(c > 4 for c in counts.values()):
                continue

            prime_prod = 1
            bitmask = 0
            for r in combo:
                prime_prod *= PRIMES[r]
                bitmask |= (1 << r)

            rank_counts = sorted([(count, r) for r, count in counts.items()], reverse=True)
            
            if rank_counts[0][0] == 4:
                score = (7, [rank_counts[0][1] + 2, rank_counts[1][1] + 2])
            elif rank_counts[0][0] == 3 and rank_counts[1][0] == 2:
                score = (6, [rank_counts[0][1] + 2, rank_counts[1][1] + 2])
            elif rank_counts[0][0] == 3:
                score = (3, [rank_counts[0][1] + 2, rank_counts[1][1] + 2, rank_counts[2][1] + 2])
            elif rank_counts[0][0] == 2 and rank_counts[1][0] == 2:
                score = (2, [rank_counts[0][1] + 2, rank_counts[1][1] + 2, rank_counts[2][1] + 2])
            elif rank_counts[0][0] == 2:
                score = (1, [rank_counts[0][1] + 2, rank_counts[1][1] + 2, rank_counts[2][1] + 2, rank_counts[3][1] + 2])
            else:
                ranks = sorted([r + 2 for r in combo], reverse=True)
                is_straight = (ranks[0] - ranks[4] == 4 and len(set(ranks)) == 5)
                is_wheel = (ranks == [14, 5, 4, 3, 2])
                
                if is_straight:
                    score = (4, [ranks[0]])
                elif is_wheel:
                    score = (4, [5])
                else:
                    score = (0, ranks)
                    
            self.unsuited_lookup[prime_prod] = score

            if len(counts) == 5:
                if is_straight:
                    f_score = (8, [ranks[0]])
                elif is_wheel:
                    f_score = (8, [5])
                else:
                    f_score = (5, ranks)
                
                self.flush_lookup[bitmask] = f_score

def make_card_int(card_str: str) -> int:
    RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
    SUITS = {'s': 1, 'h': 2, 'd': 4, 'c': 8}
    r = RANK_CHARS.index(card_str[0])
    s = SUITS[card_str[1]]
    prime = PRIMES[r]
    rank_bit = 1 << r
    return (rank_bit << 16) | (s << 12) | (r << 8) | prime

def evaluate5(c1: int, c2: int, c3: int, c4: int, c5: int, lookup: EvaluatorLookupTable) -> Tuple[int, List[int]]:
    if (c1 & c2 & c3 & c4 & c5 & 0xF000) != 0:
        rank_mask = (c1 | c2 | c3 | c4 | c5) >> 16
        return lookup.flush_lookup[rank_mask]
    
    prime_prod = (c1 & 0xFF) * (c2 & 0xFF) * (c3 & 0xFF) * (c4 & 0xFF) * (c5 & 0xFF)
    return lookup.unsuited_lookup[prime_prod]

def evaluate7(c1: int, c2: int, c3: int, c4: int, c5: int, c6: int, c7: int, lookup: EvaluatorLookupTable) -> Tuple[int, List[int]]:
    best = (-1, [])
    
    # 21 fully unrolled combinations for absolute O(1) performance
    s = evaluate5(c1, c2, c3, c4, c5, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c3, c4, c6, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c3, c4, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c3, c5, c6, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c3, c5, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c3, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c4, c5, c6, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c4, c5, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c4, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c2, c5, c6, c7, lookup)
    if s > best: best = s
    
    s = evaluate5(c1, c3, c4, c5, c6, lookup)
    if s > best: best = s
    s = evaluate5(c1, c3, c4, c5, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c3, c4, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c3, c5, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c1, c4, c5, c6, c7, lookup)
    if s > best: best = s
    
    s = evaluate5(c2, c3, c4, c5, c6, lookup)
    if s > best: best = s
    s = evaluate5(c2, c3, c4, c5, c7, lookup)
    if s > best: best = s
    s = evaluate5(c2, c3, c4, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c2, c3, c5, c6, c7, lookup)
    if s > best: best = s
    s = evaluate5(c2, c4, c5, c6, c7, lookup)
    if s > best: best = s
    
    s = evaluate5(c3, c4, c5, c6, c7, lookup)
    if s > best: best = s
    
    return best

def evaluate_hand(card_strings: List[str]) -> Tuple[int, List[int]]:
    """
    Main evaluation wrapper to map string arrays down to the bitwise engine.
    """
    cards = [make_card_int(s) for s in card_strings]
    lookup = EvaluatorLookupTable()
    
    if len(cards) == 5:
        return evaluate5(cards[0], cards[1], cards[2], cards[3], cards[4], lookup)
    elif len(cards) == 7:
        return evaluate7(cards[0], cards[1], cards[2], cards[3], cards[4], cards[5], cards[6], lookup)
    else:
        raise ValueError(f"Can only evaluate 5 or 7 cards. Got {len(cards)}")
