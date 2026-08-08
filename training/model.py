import torch
import torch.nn as nn
import torch.nn.functional as F

# ---------------------------------------------------------------------------
# TASK 4: Relative Positional Encoding (2 to 10-Max)
# ---------------------------------------------------------------------------
class PokerNet(nn.Module):
    def __init__(self, state_dim, num_actions, max_players=10):
        super(PokerNet, self).__init__()
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.max_players = max_players
        
        # Relative positional encoding for generic 2 to 10 max tables
        # Seats are categorized into relative positions rather than absolute seats
        # (e.g. EP, MP, CO, BTN, SB, BB)
        self.pos_embedding = nn.Embedding(max_players, 16)
        
        self.fc1 = nn.Linear(state_dim + 16, 512)
        self.fc2 = nn.Linear(512, 512)
        self.fc3 = nn.Linear(512, 256)
        
        # Two heads: one for action probabilities (policy), one for value
        self.policy_head = nn.Linear(256, num_actions)
        self.value_head = nn.Linear(256, 1)
        
    def forward(self, state_features, relative_position):
        pos_emb = self.pos_embedding(relative_position)
        x = torch.cat([state_features, pos_emb], dim=-1)
        
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = F.relu(self.fc3(x))
        
        policy = F.softmax(self.policy_head(x), dim=-1)
        value = self.value_head(x)
        return policy, value
