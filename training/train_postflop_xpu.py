import torch
import torch.nn as nn
import torch.nn.functional as F
import time
import os
import sys
import argparse
import random
from torch.utils.data import IterableDataset, DataLoader

# Import the mathematically verified O(1) evaluator
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "backend_logic"))
from evaluator import evaluate_hand

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

# Cloud-Scale Hyperparameters
BATCH_SIZE = 2048
HIDDEN_DIM = 512
NUM_HIDDEN_LAYERS = 4
ACCUMULATION_STEPS = 1
EPOCHS = 10
STEPS_PER_EPOCH = 50000

parser = argparse.ArgumentParser(description="Train PostFlop model.")
parser.add_argument("--device", type=str, default="xpu", choices=["xpu", "cpu", "cuda"], help="Device to train on (xpu, cpu, cuda)")
args, _ = parser.parse_known_args()

# Target device
device_str = args.device if (args.device in ["cpu", "cuda"] or (hasattr(torch, 'xpu') and torch.xpu.is_available())) else "cpu"
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

class PokerDataset(IterableDataset):
    """
    Multiprocessing Data Pipeline.
    Evaluates True Poker Hands using the O(1) Bitwise Engine asynchronously,
    preventing the GPU/CPU training loop from ever stalling on data I/O.
    """
    def __init__(self, steps_per_epoch, batch_size):
        self.steps_per_epoch = steps_per_epoch
        self.batch_size = batch_size
        self.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        self.suits = ['s', 'h', 'd', 'c']
        self.full_deck = [r + s for r in self.ranks for s in self.suits]
        
    def __iter__(self):
        worker_info = torch.utils.data.get_worker_info()
        if worker_info is not None:
            per_worker = int(self.steps_per_epoch / worker_info.num_workers)
        else:
            per_worker = self.steps_per_epoch

        for _ in range(per_worker):
            features = torch.rand(self.batch_size, 16)
            
            # Efficiently draw real cards and evaluate mathematically
            hand_strengths = []
            for _ in range(self.batch_size):
                deck = self.full_deck.copy()
                random.shuffle(deck)
                rank, tiebreakers = evaluate_hand(deck[:7])
                
                # Normalize hand rank (0-8) + tiebreaker into [0, 1] continuous space
                fractional = tiebreakers[0] / 14.0 if tiebreakers else 0.0
                strength = min(max((rank + fractional * 0.99) / 9.0, 0.0), 1.0)
                hand_strengths.append(strength)
                
            hand_strength = torch.tensor(hand_strengths, dtype=torch.float32)
            features[:, 0] = hand_strength
            
            # Extract synthetic features for the rest of the state
            draw_potential = features[:, 1]
            board_texture = features[:, 2]
            spr = features[:, 3] * 19.5 + 0.5
            position = torch.round(features[:, 4])
            
            # Tensorized Heuristic Labels based on TRUE Hand Strength
            logits = torch.zeros(self.batch_size, 5)
            logits[:, 0] = (1.0 - hand_strength) * (1.0 - draw_potential) * 10.0
            
            cc_weight = (1.0 - torch.abs(hand_strength - 0.5) * 2.0) * 8.0 + draw_potential * 5.0
            logits[:, 1] = cc_weight + (position * 2.0)
            
            logits[:, 2] = hand_strength * (1.0 - board_texture) * 6.0
            logits[:, 3] = hand_strength * board_texture * 8.0 + draw_potential * 4.0
            logits[:, 4] = F.relu(hand_strength - 0.8) * 20.0 + F.relu(3.0 - spr) * hand_strength * 10.0
            
            target_policy = F.softmax(logits, dim=-1)
            target_value = (hand_strength * 2.0 - 1.0) + (position * 0.2) + (draw_potential * 0.3)
            target_value = target_value.unsqueeze(1)
            features[:, 3] = spr
            
            yield features, target_policy, target_value

def train():
    preflop_model = PreflopNet()
    preflop_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "frozen_models", "preflop_model.pt")
    
    if os.path.exists(preflop_path):
        preflop_model.load_state_dict(torch.load(preflop_path, map_location="cpu", weights_only=True))
        print(f"Successfully loaded frozen preflop weights from {preflop_path}")
    else:
        print(f"Warning: Preflop model not found at {preflop_path}. Using random initialization for preflop freezing.")
        
    preflop_model.to(device)
    preflop_model.eval() 
    
    model = PostFlopNet(state_dim=16, num_actions=5).to(device)
    if device.type == "xpu":
        model = model.to(torch.bfloat16)

    # Optimization: Graph JIT Compilation with Graceful Fallback
    if hasattr(torch, 'compile'):
        try:
            print("Attempting to compile model with PyTorch 2.0 JIT...")
            model = torch.compile(model)
            print("Model compilation successful!")
        except Exception as e:
            print(f"Model compilation failed (likely Windows Triton compatibility). Falling back to Eager mode. Error: {e}")

    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    
    # Optimization: Learning Rate Scheduler (OneCycleLR)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, 
        max_lr=1e-3, 
        steps_per_epoch=STEPS_PER_EPOCH, 
        epochs=EPOCHS
    )

    print(f"Starting Training Loop. BATCH_SIZE={BATCH_SIZE}, ACCUMULATION_STEPS={ACCUMULATION_STEPS}")
    
    # Optimization: Asynchronous Multiprocessing DataLoader
    dataset = PokerDataset(STEPS_PER_EPOCH, BATCH_SIZE)
    # Safely max out workers, minimum 1, max capped by os.cpu_count() // 2
    workers = max(1, os.cpu_count() // 2) if hasattr(os, 'cpu_count') else 4
    dataloader = DataLoader(dataset, batch_size=None, num_workers=workers)

    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0

        for step, (features, target_policy, target_value) in enumerate(dataloader):
            features = features.to(device)
            target_policy = target_policy.to(device)
            target_value = target_value.to(device)
            
            if device.type == "xpu":
                features = features.to(torch.bfloat16)
                target_policy = target_policy.to(torch.bfloat16)
                target_value = target_value.to(torch.bfloat16)

            pred_policy, pred_value = model(features)
            
            policy_loss = -torch.sum(target_policy * torch.log(pred_policy + 1e-8), dim=-1).mean()
            value_loss = F.mse_loss(pred_value, target_value)
            loss = (policy_loss + value_loss)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()

            epoch_loss += loss.item()

            if (step + 1) % 500 == 0:
                if hasattr(torch, 'xpu') and torch.xpu.is_available():
                    torch.xpu.empty_cache()
                print(f"Epoch {epoch+1}, Step {step+1}, Loss: {loss.item():.4f}, LR: {scheduler.get_last_lr()[0]:.6f}")

        print(f"Epoch {epoch+1} completed.")

    torch.save(model.state_dict(), "app/frozen_models/postflop_model.pt")
    print("Training complete. Model saved to app/frozen_models/postflop_model.pt")

if __name__ == '__main__':
    train()
