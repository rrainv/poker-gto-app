import os
import torch
import torch.optim as optim
import json
import random
import time
from model import DeepCFRNet, encode_cards, pot_commitment_loss
from engine import evaluate_hand, DECK

def update_progress(status, percent, msg=""):
    path = os.path.join(os.path.dirname(__file__), "progress.json")
    with open(path, "w") as f:
        json.dump({"status": status, "progress": percent, "message": msg}, f)

def generate_preflop_data(num_samples_per_hand=15):
    inputs = []
    targets = []
    
    RANKS = '23456789TJQKA'
    RANK_VALUE = {r: i for i, r in enumerate(RANKS)}
    POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    ACTIONS = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check']
    
    def chen_pts(r): return {'A':10,'K':8,'Q':7,'J':6,'T':5}.get(r, int(r)/2 if r.isdigit() else 0)
    
    for table_size in [2, 6, 8]:
        for pos_idx, pos in enumerate(POSITIONS):
            for action_idx, last_action in enumerate(ACTIONS):
                for i in range(13):
                    for j in range(13):
                        r1, r2 = RANKS[i], RANKS[j]
                        if i == j:
                            cards = [r1+'s', r2+'h']
                            is_pair, suited = True, False
                        elif i > j:
                            cards = [r1+'s', r2+'h']
                            is_pair, suited = False, False
                        else:
                            cards = [r2+'s', r1+'s']
                            is_pair, suited = False, True
                        
                        p1, p2 = chen_pts(cards[0][0]), chen_pts(cards[1][0])
                        score = max(p1, p2)
                        if is_pair: score = max(5.0, score * 2)
                        if suited: score += 2
                        
                        diff = abs(RANK_VALUE[cards[0][0]] - RANK_VALUE[cards[1][0]])
                        if diff == 2: score -= 1
                        elif diff == 3: score -= 2
                        elif diff == 4: score -= 4
                        elif diff > 4: score -= 5
                        
                        pos_modifier = {'UTG': 2.0, 'HJ': 1.0, 'CO': 0.0, 'BTN': -1.0, 'SB': 0.5, 'BB': 1.5}[pos]
                        
                        # Sample multiple continuous stack and facing size variations for broad coverage
                        for _ in range(num_samples_per_hand):
                            stack = random.uniform(15.0, 200.0)
                            
                            threshold_open = 4.0
                            threshold_call = 2.0
                            pot_size = 1.5
                            facing_size = 0.0
                            
                            if last_action == 'raise':
                                facing_size = random.uniform(2.0, 6.0)
                                pot_size = 1.5 + facing_size
                                threshold_open = 7.0
                                threshold_call = 4.0
                            elif last_action == '3bet':
                                facing_size = random.uniform(6.0, 15.0)
                                pot_size = 1.5 + 3.0 + facing_size
                                threshold_open = 11.0
                                threshold_call = 8.0
                            elif last_action == '4bet':
                                facing_size = random.uniform(15.0, 35.0)
                                pot_size = 1.5 + 3.0 + 10.0 + facing_size
                                threshold_open = 15.0
                                threshold_call = 13.0
                            elif last_action == 'bet':
                                facing_size = random.uniform(1.0, 4.0)
                                pot_size = 1.5 + facing_size
                            
                            adj_score = score - pos_modifier
                            commitment = facing_size / stack if stack > 0 else 1.0
                            
                            # FIX POT-COMMITMENT PARADOX:
                            # High-equity hands (score >= 12) MUST NOT fold when facing big commitments (>= 30%)
                            if commitment >= 0.35 and score >= 10.0:
                                # Shove / Call when committed
                                y = torch.tensor([0.7, 0.3, 0.0, 0.0, 0.0])
                            else:
                                # Smooth probability distribution mapped to adjusted score
                                if adj_score >= threshold_open + 2.0:
                                    y = torch.tensor([0.85, 0.15, 0.0, 0.0, 0.0])
                                elif adj_score >= threshold_open:
                                    y = torch.tensor([0.45, 0.45, 0.10, 0.0, 0.0])
                                elif adj_score >= threshold_call:
                                    y = torch.tensor([0.10, 0.40, 0.50, 0.0, 0.0])
                                else:
                                    y = torch.tensor([0.0, 0.05, 0.95, 0.0, 0.0])
                            
                            x = torch.zeros(69)
                            encode_cards(cards, x)
                            x[52] = float(table_size) / 9.0
                            x[53] = float(stack) / 200.0
                            x[54] = 0.0
                            x[55] = min(1.0, pot_size / 200.0)
                            x[56] = min(1.0, facing_size / 200.0)
                            x[57 + pos_idx] = 1.0
                            x[63 + action_idx] = 1.0
                            
                            inputs.append(x)
                            targets.append(y)
                            
    return inputs, targets

def generate_postflop_data(num_samples=250000):
    inputs = []
    targets = []
    POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    ACTIONS = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check']
    
    for _ in range(num_samples):
        table_size = random.randint(2, 8)
        stack = random.uniform(15, 200)
        rake = 0.0
        pos_idx = random.randint(0, 5)
        action_idx = random.choice([4, 5])
        
        board_len = random.choice([3, 4, 5])
        cards = random.sample(DECK, board_len + 2)
        hole = cards[:2]
        board = cards[2:]
        
        score = evaluate_hand(hole, board)
        rel_strength = min(1.0, score / 8000015.0)
        
        if rel_strength > 0.7: 
            y = torch.tensor([0.6, 0.3, 0.0, 0.1, 0.0])
        elif rel_strength > 0.4:
            y = torch.tensor([0.1, 0.5, 0.2, 0.2, 0.0])
        elif rel_strength > 0.2:
            y = torch.tensor([0.0, 0.0, 0.4, 0.5, 0.1])
        else:
            y = torch.tensor([0.0, 0.0, 0.0, 0.3, 0.7])
            
        x = torch.zeros(69)
        encode_cards(cards, x)
        x[52] = float(table_size) / 9.0
        x[53] = float(stack) / 200.0
        x[54] = float(rake) / 10.0
        x[55] = random.uniform(1.0, 30.0) / 200.0
        x[56] = (random.uniform(0.5, 15.0) if action_idx == 4 else 0.0) / 200.0
        x[57 + pos_idx] = 1.0
        x[63 + action_idx] = 1.0
        
        inputs.append(x)
        targets.append(y)
        
    return inputs, targets

def train_model(continuous=False):
    print("Initializing Universal Deep CFR Model with Smooth ResNet Architecture...")
    model = DeepCFRNet()
    
    model_path = os.path.join(os.path.dirname(__file__), "model.pt")
    if os.path.exists(model_path):
        try:
            model.load_state_dict(torch.load(model_path, weights_only=True))
            print("Loaded existing model weights.")
        except Exception as e:
            print(f"Starting fresh model weights due to architecture upgrade ({e}).")

    update_progress("training", 5, "Generating Preflop data with continuous sampling...")
    start_time = time.time()
    pre_inputs, pre_targets = generate_preflop_data()
    
    update_progress("training", 10, "Generating Postflop data...")
    post_inputs, post_targets = generate_postflop_data(num_samples=100000)
    
    inputs = torch.stack(pre_inputs + post_inputs)
    targets = torch.stack(pre_targets + post_targets)
    
    print(f"Generated {len(inputs)} total training samples in {time.time() - start_time:.2f} seconds.")
    
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    epochs = 5
    batch_size = 1024
    
    def run_training_cycle():
        nonlocal inputs, targets, model
        dataset = torch.utils.data.TensorDataset(inputs, targets)
        dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        for epoch in range(epochs):
            epoch_loss = 0.0
            for batch_inputs, batch_targets in dataloader:
                preds = model(batch_inputs)
                
                # Base MSE loss + Pot Commitment Penalty Loss
                mse_loss = torch.nn.functional.mse_loss(preds, batch_targets)
                commit_loss = pot_commitment_loss(batch_inputs, preds)
                loss = mse_loss + 0.1 * commit_loss
                
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
                time.sleep(0.005)
                
            avg_loss = epoch_loss / len(dataloader)
            update_progress("training", 10 + int(90 * ((epoch+1)/epochs)), f"Epoch {epoch+1}/{epochs} (Loss: {avg_loss:.4f})")
            print(f"Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}")
            
        torch.save(model.state_dict(), model_path)
        print(f"Saved smooth model to {model_path}")

    if continuous:
        cycle = 1
        while True:
            print(f"--- Continuous Training Cycle {cycle} ---")
            run_training_cycle()
            post_inputs, post_targets = generate_postflop_data(num_samples=100000)
            inputs = torch.stack(pre_inputs + post_inputs)
            targets = torch.stack(pre_targets + post_targets)
            cycle += 1
    else:
        run_training_cycle()
        update_progress("complete", 100, "Training finished successfully.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--continuous', action='store_true', help='Run continuous overnight training')
    args = parser.parse_args()
    
    try:
        train_model(continuous=args.continuous)
    except Exception as e:
        update_progress("error", 0, str(e))
        import traceback
        traceback.print_exc()
