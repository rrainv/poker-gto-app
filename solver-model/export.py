import json
import os
import torch
from model import DeepCFRNet, encode_cards

def export_to_json(filename="gto_export.json"):
    print("Loading trained DeepCFRNet model (model.pt)...")
    model = DeepCFRNet(input_dim=69)
    model_path = os.path.join(os.path.dirname(__file__), "model.pt")
    try:
        model.load_state_dict(torch.load(model_path, weights_only=True))
        model.eval()
    except FileNotFoundError:
        print(f"model.pt not found at {model_path}. Did you run train.py?")
        return
    except Exception as e:
        print(f"Loading state dict with weights_only=False due to: {e}")
        model.load_state_dict(torch.load(model_path, weights_only=False))
        model.eval()

    # Generate strategies for all 169 hands across positions
    strategy_map = {}
    ranks = 'AKQJT98765432'
    positions = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]
    
    print("Running DeepCFR neural network inference for all 169 preflop hand combinations...")
    with torch.no_grad():
        for i in range(13):
            for j in range(13):
                r1, r2 = ranks[i], ranks[j]
                if i < j: hand = r1 + r2 + 's'
                elif i > j: hand = r2 + r1 + 'o'
                else: hand = r1 + r2
                
                hand_positions = {}
                for pos_idx, pos in enumerate(positions):
                    x = torch.zeros(69)
                    # Encode dummy card representations
                    if len(hand) == 2:
                        cards = [hand[0] + 's', hand[1] + 'h']
                    elif hand[2] == 's':
                        cards = [hand[0] + 's', hand[1] + 's']
                    else:
                        cards = [hand[0] + 's', hand[1] + 'h']
                    
                    encode_cards(cards, x)
                    x[52] = 6.0  # table size
                    x[53] = 30.0 # stack size
                    x[54] = 0.0  # rake
                    x[55] = 1.5  # pot size
                    x[56] = 0.0  # facing size
                    x[57 + pos_idx] = 1.0 # position one-hot
                    x[63] = 1.0  # unopened
                    
                    policy = model(x).numpy()
                    
                    # Exact physical mapping from trained model.pt weights:
                    # Index 0: Raise / Open
                    # Index 1: Call / Check
                    # Index 2: Fold
                    raise_pct = round(float(policy[0]) * 100, 1)
                    call_pct = round(float(policy[1]) * 100, 1)
                    fold_pct = round(float(policy[2]) * 100, 1)
                    
                    hand_positions[pos] = {
                        "raise": raise_pct,
                        "call": call_pct,
                        "fold": fold_pct,
                        "unopened": raise_pct
                    }
                
                strategy_map[hand] = hand_positions

    export_data = {
        "title": "DeepCFR PyTorch Model (model.pt)",
        "source": "DeepCFR Neural Network",
        "stack": 30,
        "positions": positions,
        "strategy": strategy_map
    }
    
    output_path = os.path.join(os.path.dirname(__file__), "..", "trees", "gto_export.json")
    with open(output_path, 'w') as f:
        json.dump(export_data, f, indent=2)
    print(f"Successfully exported PyTorch model.pt to {output_path}!")

if __name__ == "__main__":
    export_to_json()
