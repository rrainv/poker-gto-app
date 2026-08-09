import torch
import torch.nn as nn
import torch.nn.functional as F
import time
import os
import sys
import argparse

class ResBlock(nn.Module):
    def __init__(self, dim):
        super(ResBlock, self).__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.fc2 = nn.Linear(dim, dim)
        
    def forward(self, x):
        return x + F.relu(self.fc2(F.relu(self.fc1(x))))

class PreflopNet(nn.Module):
    def __init__(self):
        super(PreflopNet, self).__init__()
        self.in_proj = nn.Sequential(nn.Linear(69, 512), nn.ReLU())
        self.res1 = ResBlock(512)
        self.res2 = ResBlock(512)
        self.head = nn.Sequential(nn.Linear(512, 256), nn.ReLU(), nn.Linear(256, 5))
        
    def forward(self, x):
        x = self.in_proj(x)
        x = self.res1(x)
        x = self.res2(x)
        return self.head(x)
# Hyperparameters explicitly mandated
BATCH_SIZE = 32
HIDDEN_DIM = 512
NUM_HIDDEN_LAYERS = 4
ACCUMULATION_STEPS = 64
EPOCHS = 10
STEPS_PER_EPOCH = 50000

parser = argparse.ArgumentParser(description="Train PostFlop model.")
parser.add_argument("--device", type=str, default="xpu", choices=["xpu", "cpu"], help="Device to train on (xpu or cpu)")
args, _ = parser.parse_known_args()

# Target device
device_str = args.device if (args.device == "cpu" or (hasattr(torch, 'xpu') and torch.xpu.is_available())) else "cpu"
device = torch.device(device_str)
print(f"Targeting device: {device}")
if device.type == "cpu":
    torch.set_num_threads(16)
    print("CPU detected: Setting oneDNN thread count to 16 for maximum utilization.")

class PostFlopNet(nn.Module):
    def __init__(self, state_dim, num_actions):
        super(PostFlopNet, self).__init__()
        layers = []
        in_dim = state_dim
        for _ in range(NUM_HIDDEN_LAYERS):
            layers.append(nn.Linear(in_dim, HIDDEN_DIM))
            layers.append(nn.ReLU())
            in_dim = HIDDEN_DIM
        self.mlp = nn.Sequential(*layers)
        self.policy_head = nn.Linear(HIDDEN_DIM, num_actions)
        self.value_head = nn.Linear(HIDDEN_DIM, 1)

    def forward(self, x):
        features = self.mlp(x)
        policy = F.softmax(self.policy_head(features), dim=-1)
        value = self.value_head(features)
        return policy, value

def generate_synthetic_mccfr_batch(batch_size):
    """
    On-the-fly Heuristic GTO trajectory generator.
    Generates meaningful features and deterministically calculates 
    GTO-like policies (Fold, Check/Call, Bet Small, Bet Large, All-in) 
    so the neural network has a consistent, learnable mathematical landscape.
    """
    state_dim = 16
    num_actions = 5
    
    # Generate realistic continuous features [0, 1]
    features = torch.rand(batch_size, state_dim)
    
    # Extract semantic features for heuristic mapping
    hand_strength = features[:, 0]
    draw_potential = features[:, 1]
    board_texture = features[:, 2]
    spr = features[:, 3] * 19.5 + 0.5 # SPR from 0.5 to 20.0
    position = torch.round(features[:, 4]) # 0 for OOP, 1 for IP
    
    # Map to 5 actions: [Fold, Check/Call, Bet Small, Bet Large, All-in]
    logits = torch.zeros(batch_size, num_actions)
    
    # 1. Fold: high when hand_strength is very low and draw_potential is very low
    logits[:, 0] = (1.0 - hand_strength) * (1.0 - draw_potential) * 10.0
    
    # 2. Check/Call: preferred for medium hand strengths and decent draws
    cc_weight = (1.0 - torch.abs(hand_strength - 0.5) * 2.0) * 8.0 + draw_potential * 5.0
    logits[:, 1] = cc_weight + (position * 2.0)
    
    # 3. Bet Small: good for dry boards, medium-strong hands
    logits[:, 2] = hand_strength * (1.0 - board_texture) * 6.0
    
    # 4. Bet Large: strong hands, wet boards (protection), or semi-bluffing
    logits[:, 3] = hand_strength * board_texture * 8.0 + draw_potential * 4.0
    
    # 5. All-in: Nuts (hand_strength > 0.8) with low SPR
    logits[:, 4] = F.relu(hand_strength - 0.8) * 20.0 + F.relu(3.0 - spr) * hand_strength * 10.0
    
    # Softmax to get target probabilities
    target_policy = F.softmax(logits, dim=-1)
    
    # Target EV (Expected Value) from -1.0 to +1.0 roughly
    target_value = (hand_strength * 2.0 - 1.0) + (position * 0.2) + (draw_potential * 0.3)
    target_value = target_value.unsqueeze(1)
    
    # Replace SPR feature with scaled value
    features[:, 3] = spr
    
    return features, target_policy, target_value

def train():
    # 1. Load Preflop frozen model
    preflop_model = PreflopNet()
    preflop_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "frozen_models", "preflop_model.pt")
    
    if os.path.exists(preflop_path):
        preflop_model.load_state_dict(torch.load(preflop_path, map_location="cpu", weights_only=True))
        print(f"Successfully loaded frozen preflop weights from {preflop_path}")
    else:
        print(f"Warning: Preflop model not found at {preflop_path}. Using random initialization for preflop freezing.")
        
    preflop_model.to(device)
    preflop_model.eval() # Freeze weights
    
    model = PostFlopNet(state_dim=16, num_actions=5).to(device)
    if device.type == "xpu":
        model = model.to(torch.bfloat16)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    
    print(f"Starting XPU Training Loop. BATCH_SIZE={BATCH_SIZE}, ACCUMULATION_STEPS={ACCUMULATION_STEPS}")
    
    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad()
        epoch_loss = 0.0

        for step in range(STEPS_PER_EPOCH):
            # Generate synthetic MCCFR data
            features, target_policy, target_value = generate_synthetic_mccfr_batch(BATCH_SIZE)
            features = features.to(device)
            target_policy = target_policy.to(device)
            target_value = target_value.to(device)
            
            if device.type == "xpu":
                features = features.to(torch.bfloat16)
                target_policy = target_policy.to(torch.bfloat16)
                target_value = target_value.to(torch.bfloat16)

            pred_policy, pred_value = model(features)
            
            # Loss computation
            policy_loss = -torch.sum(target_policy * torch.log(pred_policy + 1e-8), dim=-1).mean()
            value_loss = F.mse_loss(pred_value, target_value)
            loss = (policy_loss + value_loss) / ACCUMULATION_STEPS

            # Backward pass
            loss.backward()

            # Gradient Accumulation
            if (step + 1) % ACCUMULATION_STEPS == 0:
                # Note: No GradScaler is used as per constraints
                optimizer.step()
                optimizer.zero_grad()

            epoch_loss += loss.item() * ACCUMULATION_STEPS

            # Memory Management: Empty Cache
            if (step + 1) % 500 == 0:
                if hasattr(torch, 'xpu') and torch.xpu.is_available():
                    torch.xpu.empty_cache()
                print(f"Epoch {epoch+1}, Step {step+1}, Loss: {loss.item()*ACCUMULATION_STEPS:.4f}")

        # Epoch completed
        print(f"Epoch {epoch+1} completed.")

    torch.save(model.state_dict(), "app/frozen_models/postflop_model.pt")
    print("Training complete. Model saved to app/frozen_models/postflop_model.pt")

if __name__ == '__main__':
    train()
