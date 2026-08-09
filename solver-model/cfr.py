import random
from engine import GameState, DECK

class Node:
    def __init__(self, num_actions):
        self.regret_sum = [0.0] * num_actions
        self.strategy_sum = [0.0] * num_actions
        self.num_actions = num_actions
        
    def get_strategy(self, realization_weight):
        strategy = [0.0] * self.num_actions
        normalizing_sum = 0
        for a in range(self.num_actions):
            strategy[a] = self.regret_sum[a] if self.regret_sum[a] > 0 else 0
            normalizing_sum += strategy[a]
            
        for a in range(self.num_actions):
            if normalizing_sum > 0:
                strategy[a] /= normalizing_sum
            else:
                strategy[a] = 1.0 / self.num_actions
            self.strategy_sum[a] += realization_weight * strategy[a]
        return strategy
        
    def get_average_strategy(self):
        avg_strategy = [0.0] * self.num_actions
        normalizing_sum = sum(self.strategy_sum)
        for a in range(self.num_actions):
            if normalizing_sum > 0:
                avg_strategy[a] = self.strategy_sum[a] / normalizing_sum
            else:
                avg_strategy[a] = 1.0 / self.num_actions
        return avg_strategy

    def apply_discount(self, factor):
        """Applies linear discount factor to regret sum to prevent inflation."""
        for a in range(self.num_actions):
            self.regret_sum[a] *= factor
            self.strategy_sum[a] *= factor

class CFRTrainer:
    """
    CFRTrainer encapsulating node_map, alternating updates,
    and linear discount factors (DCFR / LCFR) for stability.
    """
    def __init__(self):
        self.node_map = {}

    def cfr(self, state: GameState, probs: list, iteration: int) -> list:
        if state.is_terminal():
            return state.get_payoffs()
            
        player = len(state.history) % state.num_players
        
        # If the player already folded, skip their turn
        if not state.active_players[player]:
            next_state = GameState(
                history=state.history + "-", # dummy action for skipped turn
                board=state.board,
                player_cards=state.player_cards,
                pot=state.pot,
                stack=state.stack,
                num_players=state.num_players,
                rake=state.rake
            )
            next_state.active_players = state.active_players.copy()
            return self.cfr(next_state, probs, iteration)
        
        my_cards = state.player_cards[player]
        info_set = str(sorted(my_cards)) + state.history
        
        if info_set not in self.node_map:
            self.node_map[info_set] = Node(len(state.get_actions()))
            
        node = self.node_map[info_set]
        strategy = node.get_strategy(probs[player])
        
        actions = state.get_actions()
        util = [[0.0] * state.num_players for _ in range(node.num_actions)]
        node_util = [0.0] * state.num_players
        
        for i, a in enumerate(actions):
            next_state = GameState(
                history=state.history + a,
                board=state.board,
                player_cards=state.player_cards,
                pot=state.pot + (1 if a == 'b' else 0),
                stack=state.stack,
                num_players=state.num_players,
                rake=state.rake
            )
            next_state.active_players = state.active_players.copy()
            if a == 'p':
                next_state.active_players[player] = False
                
            new_probs = probs.copy()
            new_probs[player] *= strategy[i]
            
            action_util = self.cfr(next_state, new_probs, iteration)
            util[i] = action_util
            
            for p in range(state.num_players):
                node_util[p] += strategy[i] * action_util[p]
                
        # Regret update with alternating updates & linear discount factor (t / (t + 1))
        discount_factor = iteration / (iteration + 1)
        node.apply_discount(discount_factor)

        for i in range(node.num_actions):
            regret = util[i][player] - node_util[player]
            prob_others = 1.0
            for p in range(state.num_players):
                if p != player:
                    prob_others *= probs[p]
            node.regret_sum[i] += prob_others * regret
            
        return node_util

    def train(self, iterations: int, num_players: int = 6):
        util = [0.0] * num_players
        for t in range(1, iterations + 1):
            deck = DECK.copy()
            random.shuffle(deck)
            
            player_cards = []
            for _ in range(num_players):
                player_cards.append([deck.pop(), deck.pop()])
                
            state = GameState(history="", player_cards=player_cards, num_players=num_players)
            
            game_util = self.cfr(state, [1.0] * num_players, iteration=t)
            for p in range(num_players):
                util[p] += game_util[p]
                
        print(f"Average game value per player: {[round(u / iterations, 2) for u in util]}")

# Convenience helper
def train_cfr(iterations, num_players=6):
    trainer = CFRTrainer()
    trainer.train(iterations, num_players)
    return trainer
