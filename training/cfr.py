import random
import numpy as np
from engine import GameState, DECK_INTS, fast_batch_evaluate_7, EVAL_LUT

class Node:
    def __init__(self, num_actions):
        self.regret_sum = np.zeros(num_actions, dtype=np.float16)
        self.strategy_sum = np.zeros(num_actions, dtype=np.float16)
        self.num_actions = num_actions
        self.skip_iterations = np.zeros(num_actions, dtype=np.int32)
        
    def get_strategy(self, realization_weight):
        positive_regrets = np.maximum(self.regret_sum, 0, dtype=np.float16)
        normalizing_sum = np.sum(positive_regrets)
        
        if normalizing_sum > 0:
            strategy = positive_regrets / normalizing_sum
        else:
            strategy = np.full(self.num_actions, 1.0 / self.num_actions, dtype=np.float16)
            
        self.strategy_sum += (realization_weight * strategy).astype(np.float16)
        return strategy
        
    def get_average_strategy(self):
        normalizing_sum = np.sum(self.strategy_sum)
        if normalizing_sum > 0:
            return self.strategy_sum / normalizing_sum
        return np.full(self.num_actions, 1.0 / self.num_actions, dtype=np.float16)

    def apply_discount(self, factor):
        self.regret_sum *= np.float16(factor)
        self.strategy_sum *= np.float16(factor)

class CFRTrainer:
    def __init__(self):
        self.node_map = {}
        self.prune_threshold = -300.0
        self.prune_iterations = 5

    def cfr(self, state: GameState, probs: list, iteration: int) -> list:
        if state.is_terminal():
            # Vectorized Batch Evaluation of Terminal Nodes using 32-bit INTs
            active_indices = [i for i, active in enumerate(state.active_players) if active]
            if len(active_indices) == 1:
                return state.get_payoffs() # Winner by fold
                
            # Multiple players active: use fast evaluator
            hands_matrix = np.zeros((len(active_indices), 7), dtype=np.int32)
            for row_idx, player_idx in enumerate(active_indices):
                # Ensure 7 cards total for evaluation (2 hole + 5 board)
                cards = state.player_cards[player_idx] + state.board
                # Pad with 0s if less than 7 cards (assuming preflop/flop evaluation logic is handled in LUT)
                for c_i, card_int in enumerate(cards):
                    if c_i < 7: hands_matrix[row_idx, c_i] = card_int
                    
            # TASK 3: Vectorized Batch Eval Call
            scores = fast_batch_evaluate_7(hands_matrix, EVAL_LUT)
            
            # Simple payoff logic based on fast scores
            best_score = np.max(scores)
            winners = [active_indices[i] for i in range(len(scores)) if scores[i] == best_score]
            
            payoffs = [0.0] * state.num_players
            win_share = (state.pot) / len(winners)
            loss_share = -state.pot / max(1, (state.num_players - len(winners)))
            for i in range(state.num_players):
                if i in winners: payoffs[i] = win_share
                elif state.active_players[i]: payoffs[i] = loss_share
            return payoffs
            
        player = len(state.history) % state.num_players
        
        if not state.active_players[player]:
            next_state = GameState(
                history=state.history + "-", 
                board=state.board,
                player_cards=state.player_cards,
                pot=state.pot,
                stack=state.stack,
                num_players=state.num_players
            )
            next_state.active_players = state.active_players.copy()
            return self.cfr(next_state, probs, iteration)
        
        my_cards = state.player_cards[player]
        # Canonical hand logic on ints
        info_set = str(sorted(my_cards)) + state.history
        
        if info_set not in self.node_map:
            self.node_map[info_set] = Node(len(state.get_actions()))
            
        node = self.node_map[info_set]
        strategy = node.get_strategy(probs[player])
        
        actions = state.get_actions()
        util = np.zeros(node.num_actions, dtype=np.float16)
        node_util = 0.0
        
        active_actions = node.skip_iterations <= 0
        node.skip_iterations = np.maximum(node.skip_iterations - 1, 0)
        
        for i, a in enumerate(actions):
            if not active_actions[i]:
                continue
                
            next_state = GameState(
                history=state.history + a,
                board=state.board,
                player_cards=state.player_cards,
                pot=state.pot + (1 if a.startswith('b') else 0),
                stack=state.stack,
                num_players=state.num_players
            )
            next_state.active_players = state.active_players.copy()
            if a == 'p':
                next_state.active_players[player] = False
                
            new_probs = probs.copy()
            new_probs[player] *= strategy[i]
            
            action_util = self.cfr(next_state, new_probs, iteration)
            util[i] = action_util[player]
            node_util += strategy[i] * util[i]
            
        for i in range(node.num_actions):
            if active_actions[i]:
                regret = util[i] - node_util
                node.regret_sum[i] += np.float16(probs[1 - player] * regret)
                
                # Dynamic Regret-Based Pruning
                if node.regret_sum[i] < -1000.0:
                    node.skip_iterations[i] = 50  # Catastrophic blunder
                elif node.regret_sum[i] < -300.0:
                    node.skip_iterations[i] = 10  # Baseline negative
                elif node.regret_sum[i] < -100.0:
                    node.skip_iterations[i] = 5   # Marginal negative
                    
        return [-node_util if i != player else node_util for i in range(state.num_players)]

