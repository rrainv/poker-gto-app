import time
import random
import sys
from evaluator import evaluate_hand

class DeckFactory:
    """
    Factory pattern for generating randomized, valid playing card states.
    Ensures optimal class architecture and isolation of random state generation.
    """
    @staticmethod
    def create_shuffled_deck() -> list:
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        suits = ['s', 'h', 'd', 'c']
        deck = [r + s for r in ranks for s in suits]
        random.shuffle(deck)
        return deck

class MonteCarloFuzzer:
    """
    Fuzzer for stress testing the evaluator mathematically.
    """
    def __init__(self, iterations: int):
        self.iterations = iterations

    def run(self):
        print(f"Starting Monte Carlo Fuzz Test for N={self.iterations} iterations...")
        start_time = time.time()
        
        for i in range(self.iterations):
            deck = DeckFactory.create_shuffled_deck()
            # Draw 7 unique cards (2 hole cards + 5 board cards without replacement)
            hand = deck[:7]
            
            # Assert: No Duplicate Cards
            assert len(set(hand)) == 7, "Assertion Failed: Duplicate cards generated in hand!"
            
            # Assert: No Crashes
            try:
                score = evaluate_hand(hand)
            except Exception as e:
                print(f"[FAIL] Evaluator crashed on hand {hand}: {e}")
                sys.exit(1)
            
            # Assert: Valid Strength Bounds
            rank, tiebreakers = score
            assert 0 <= rank <= 8, f"Assertion Failed: Invalid numerical hand rank {rank} for hand {hand}"
            assert isinstance(tiebreakers, list), "Assertion Failed: Tiebreakers must be a list"

        end_time = time.time()
        duration = end_time - start_time
        evals_per_second = self.iterations / duration if duration > 0 else 0
        
        print("[PASS] Fuzz testing completed successfully with zero crashes, duplicate cards, or out-of-bound errors.")
        print(f"Total Execution Time: {duration:.4f} seconds")
        print(f"Evaluations Per Second: {evals_per_second:.2f} evals/s")

if __name__ == '__main__':
    fuzzer = MonteCarloFuzzer(100000)
    fuzzer.run()
