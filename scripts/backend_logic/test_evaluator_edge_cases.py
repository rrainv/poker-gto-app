from evaluator import evaluate_hand

def run_tests():
    passed = 0
    failed = 0

    def assert_eq(actual, expected, name):
        nonlocal passed, failed
        if actual == expected:
            passed += 1
            print(f"[PASS] {name}")
        else:
            failed += 1
            print(f"[FAIL] {name}: Expected {expected}, got {actual}")

    def assert_gt(hand1, hand2, name):
        nonlocal passed, failed
        if hand1 > hand2:
            passed += 1
            print(f"[PASS] {name}")
        else:
            failed += 1
            print(f"[FAIL] {name}: Expected {hand1} > {hand2}")

    # 1. Ace-Low Straight (Wheel)
    # 5d, 4s, 3c, 2h, Ac
    wheel = evaluate_hand(['5d', '4s', '3c', '2h', 'Ac'])
    assert_eq(wheel, (4, [5]), "Ace-Low Straight (Wheel)")

    # 2. Trips vs Set
    # Set: Hero holds 7-7 on A-7-2-3-4 board
    set_hand = evaluate_hand(['7c', '7d', 'Ah', '7s', '2d', '3c', '4h'])
    # Trips: Hero holds A-7 on 7-7-2-3-4 board
    trips_hand = evaluate_hand(['Ac', '7d', '7h', '7s', '2d', '3c', '4h'])
    
    # Both are 3 of a kind (Rank 3) with identical highest 5 cards (7,7,7,A,4)
    assert_eq(set_hand, (3, [7, 14, 4]), "Set evaluated correctly")
    assert_eq(trips_hand, (3, [7, 14, 4]), "Trips evaluated correctly")
    assert_eq(set_hand, trips_hand, "Set and Trips rank identically in value")

    # 3. Counterfeited Two-Pair
    # Hero holds 5-4 on 5-4-9-9-9. 
    # Hand: 5c, 4d, 5h, 4s, 9c, 9d, 9h
    # Best 5 cards: 9, 9, 9, 5, 5 (Full House, 9s full of 5s)
    counterfeited = evaluate_hand(['5c', '4d', '5h', '4s', '9c', '9d', '9h'])
    assert_eq(counterfeited, (6, [9, 5]), "Counterfeited Two-Pair becomes Full House")

    # 4. Royal Flush vs Straight Flush
    royal = evaluate_hand(['Ac', 'Kc', 'Qc', 'Jc', 'Tc'])
    straight_flush = evaluate_hand(['Kc', 'Qc', 'Jc', 'Tc', '9c'])
    assert_gt(royal, straight_flush, "Royal Flush > King-High Straight Flush")

    # 5. The Kicker Problem
    # A-K on Q-J-10-9-2 board beats A-8
    ak_hand = evaluate_hand(['Ac', 'Kd', 'Qs', 'Jh', 'Tc', '9d', '2c'])
    a8_hand = evaluate_hand(['Ac', '8d', 'Qs', 'Jh', 'Tc', '9d', '2c'])
    assert_gt(ak_hand, a8_hand, "A-K beats A-8 on Q-J-T-9-2 board")

    # 6. Non-Maximal Flushes
    # 7 suited cards: Ac, Kc, Qc, 9c, 8c, 7c, 6c
    # Highest 5 should be A, K, Q, 9, 8
    flush_7 = evaluate_hand(['Ac', 'Kc', 'Qc', '9c', '8c', '7c', '6c'])
    assert_eq(flush_7, (5, [14, 13, 12, 9, 8]), "Non-Maximal Flushes (7 suited cards)")

    print(f"\nResults: {passed} passed, {failed} failed.")
    if failed > 0:
        exit(1)

if __name__ == '__main__':
    run_tests()
