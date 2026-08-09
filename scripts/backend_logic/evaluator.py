import itertools
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional

class Card:
    """
    Represents a playing card.
    """
    RANK_MAP = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
    
    def __init__(self, card_str: str):
        self.card_str = card_str
        self.rank_char = card_str[0]
        self.suit = card_str[1]
        self.rank = self.RANK_MAP[self.rank_char]

    def __repr__(self):
        return self.card_str

class IEvaluationStrategy(ABC):
    """
    Interface for hand evaluation strategies.
    """
    @abstractmethod
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        """
        Evaluate exactly 5 cards.
        Returns None if condition is not met.
        Returns Tuple(Rank, [tie-breakers]) if met.
        """
        pass

class HighCardStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = sorted([c.rank for c in cards], reverse=True)
        return (0, ranks)

class PairStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = [c.rank for c in cards]
        for r in set(ranks):
            if ranks.count(r) == 2:
                kickers = sorted([x for x in ranks if x != r], reverse=True)
                return (1, [r] + kickers)
        return None

class TwoPairStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = [c.rank for c in cards]
        pairs = []
        for r in set(ranks):
            if ranks.count(r) == 2:
                pairs.append(r)
        if len(pairs) == 2:
            pairs.sort(reverse=True)
            kicker = [x for x in ranks if x not in pairs][0]
            return (2, pairs + [kicker])
        return None

class ThreeOfAKindStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = [c.rank for c in cards]
        for r in set(ranks):
            if ranks.count(r) == 3:
                kickers = sorted([x for x in ranks if x != r], reverse=True)
                return (3, [r] + kickers)
        return None

class StraightStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = sorted([c.rank for c in cards], reverse=True)
        if ranks[0] - ranks[4] == 4 and len(set(ranks)) == 5:
            return (4, [ranks[0]])
        # Check Ace-low straight (Wheel: A, 5, 4, 3, 2)
        if ranks == [14, 5, 4, 3, 2]:
            return (4, [5])
        return None

class FlushStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        suits = [c.suit for c in cards]
        if len(set(suits)) == 1:
            ranks = sorted([c.rank for c in cards], reverse=True)
            return (5, ranks)
        return None

class FullHouseStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = [c.rank for c in cards]
        threes = [r for r in set(ranks) if ranks.count(r) == 3]
        twos = [r for r in set(ranks) if ranks.count(r) == 2]
        if threes and twos:
            return (6, [threes[0], twos[0]])
        return None

class QuadsStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        ranks = [c.rank for c in cards]
        for r in set(ranks):
            if ranks.count(r) == 4:
                kicker = [x for x in ranks if x != r][0]
                return (7, [r, kicker])
        return None

class StraightFlushStrategy(IEvaluationStrategy):
    def evaluate(self, cards: List[Card]) -> Optional[Tuple[int, List[int]]]:
        is_flush = FlushStrategy().evaluate(cards)
        if is_flush:
            is_straight = StraightStrategy().evaluate(cards)
            if is_straight:
                return (8, is_straight[1])
        return None

class EvaluatorContext:
    """
    Main execution context implementing the Strategy Pattern.
    """
    def __init__(self):
        # Ordered from strongest to weakest
        self.strategies = [
            StraightFlushStrategy(),
            QuadsStrategy(),
            FullHouseStrategy(),
            FlushStrategy(),
            StraightStrategy(),
            ThreeOfAKindStrategy(),
            TwoPairStrategy(),
            PairStrategy(),
            HighCardStrategy()
        ]

    def evaluate_5_cards(self, cards: List[Card]) -> Tuple[int, List[int]]:
        """
        Evaluate exactly 5 cards.
        """
        for strategy in self.strategies:
            result = strategy.evaluate(cards)
            if result:
                return result
        raise ValueError("No strategy matched, which is impossible.")

    def evaluate_7_cards(self, cards: List[Card]) -> Tuple[int, List[int]]:
        """
        Evaluate 7 cards by finding the best 5-card combination.
        """
        best_score = (-1, [])
        for combo in itertools.combinations(cards, 5):
            score = self.evaluate_5_cards(list(combo))
            if score > best_score:
                best_score = score
        return best_score

def evaluate_hand(card_strings: List[str]) -> Tuple[int, List[int]]:
    """
    Wrapper function to evaluate a list of string cards.
    """
    cards = [Card(s) for s in card_strings]
    ctx = EvaluatorContext()
    if len(cards) == 5:
        return ctx.evaluate_5_cards(cards)
    elif len(cards) == 7:
        return ctx.evaluate_7_cards(cards)
    else:
        raise ValueError(f"Can only evaluate 5 or 7 cards. Got {len(cards)}")
