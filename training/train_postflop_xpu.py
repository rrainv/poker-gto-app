import torch
import torch.nn as nn
import torch.nn.functional as F
import time
import os
import sys

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
STEPS_PER_EPOCH = 2000

# Target the Arc iGPU
device = torch.device("xpu" if hasattr(torch, 'xpu') and torch.xpu.is_available() else "cpu")
print(f"Targeting device: {device}")

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
    On-the-fly Monte Carlo Counterfactual Regret Minimization (MCCFR)
    synthetic postflop state generator.
    
    Continuous Inputs generated:
    - Active_Players_Mask (float in [0, 1])
    - Relative_Position_to_Button (float in [0, 1])
    - SPR (float, e.g. 0.5 to 20.0)
    + Other dummy features to fill out state_dim
    """
    state_dim = 16
    num_actions = 5
    
    # Generate random features
    features = torch.randn(batch_size, state_dim)
    
    # Specifically assign the continuous inputs
    features[:, 0] = torch.rand(batch_size) # Active_Players_Mask
    features[:, 1] = torch.rand(batch_size) # Relative_Position_to_Button
    features[:, 2] = torch.rand(batch_size) * 19.5 + 0.5 # SPR from 0.5 to 20.0
    
    target_policy = F.softmax(torch.randn(batch_size, num_actions), dim=-1)
    target_value = torch.randn(batch_size, 1)
    
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

        # Thermal Soak Management
        print(f"Epoch {epoch+1} completed. Mitigating thermal soak on mobile chassis: sleeping for 120s...")
        time.sleep(120)

if __name__ == '__main__':
    train()
