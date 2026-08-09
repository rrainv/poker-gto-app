import torch
import torch.nn as nn
import torch.nn.functional as F

def encode_cards(cards, tensor):
    """
    Encodes a list of card strings (e.g. ['As', 'Kh']) into the first 52 dimensions of a tensor.
    Rank mapping: 2=0, 3=1, ..., A=12
    Suit mapping: s=0, h=1, d=2, c=3
    """
    ranks = '23456789TJQKA'
    suits = 'shdc'
    for card in cards:
        if len(card) >= 2:
            r = ranks.find(card[0])
            s = suits.find(card[1])
            if r != -1 and s != -1:
                idx = r * 4 + s
                if idx < 52:
                    tensor[idx] = 1.0

class ResBlock(nn.Module):
    """Residual block with SiLU activation for smooth gradient flow."""
    def __init__(self, dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.fc2 = nn.Linear(dim, dim)
        self.act = nn.SiLU()

    def forward(self, x):
        residual = x
        out = self.act(self.fc1(x))
        out = self.fc2(out)
        return self.act(out + residual)

class DeepCFRNet(nn.Module):
    """
    Universal Deep CFR Network with Smooth ResNet Architecture.
    
    ACTION INDEX MAPPING:
    - policy[0]: Raise / Open
    - policy[1]: Call / Check
    - policy[2]: Fold
    - policy[3]: Check / Passive (auxiliary)
    - policy[4]: All-in / Jam (auxiliary)
    
    input_dim 69:
    - 0-51: 52 cards
    - 52: 1 table size
    - 53: 1 effective stack
    - 54: 1 rake percentage
    - 55: 1 pot size
    - 56: 1 facing size
    - 57-62: 6 position indices
    - 63-68: 6 last action types
    """
    def __init__(self, input_dim=69, hidden_dim=512, num_actions=5):
        super().__init__()
        self.in_proj = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.SiLU()
        )
        self.res1 = ResBlock(hidden_dim)
        self.res2 = ResBlock(hidden_dim)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.SiLU(),
            nn.Linear(hidden_dim // 2, num_actions)
        )

    def forward(self, x):
        h = self.in_proj(x)
        h = self.res1(h)
        h = self.res2(h)
        logits = self.head(h)
        return F.softmax(logits, dim=-1)

# Custom regularization loss functions for GTO physics
def pot_commitment_loss(inputs, outputs):
    """
    Penalizes model if it outputs FOLD (policy[2]) when facing size / stack >= 0.35
    for hands with high card strength.
    """
    facing = inputs[:, 56] * 200.0
    stack = inputs[:, 53] * 200.0
    commitment = torch.where(stack > 0, facing / stack, torch.zeros_like(facing))
    
    fold_prob = outputs[:, 2]
    # Penalty applies when commitment >= 0.35
    high_commit_mask = (commitment >= 0.35).float()
    penalty = fold_prob * high_commit_mask
    return torch.mean(penalty ** 2)
