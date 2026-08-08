import torch
from model import PokerNet
import os

# ---------------------------------------------------------------------------
# TASK 4: INT8 Quantization & ONNX Export
# ---------------------------------------------------------------------------

def export_model_to_onnx(model_path, output_path, max_players=10):
    device = torch.device("cpu")
    model = PokerNet(state_dim=100, num_actions=4, max_players=max_players).to(device)
    
    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=device)
        model.load_state_dict(checkpoint['model_state_dict'])
        print(f"Loaded checkpoint from {model_path}")
    else:
        print(f"Warning: Checkpoint not found at {model_path}, exporting untrained model.")
        
    model.eval()
    
    # TASK 4: INT8 Dynamic Quantization
    # Shrinks the final file size by ~75% and improves inference speed
    print("Applying Dynamic INT8 Quantization...")
    quantized_model = torch.quantization.quantize_dynamic(
        model, 
        {torch.nn.Linear}, 
        dtype=torch.qint8
    )
    
    dummy_state = torch.randn(1, 100)
    dummy_pos = torch.randint(0, max_players, (1,))
    
    print(f"Exporting ONNX model to {output_path}...")
    torch.onnx.export(
        quantized_model, 
        (dummy_state, dummy_pos), 
        output_path, 
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['state_features', 'relative_position'],
        output_names=['policy', 'value'],
        dynamic_axes={
            'state_features': {0: 'batch_size'},
            'relative_position': {0: 'batch_size'},
            'policy': {0: 'batch_size'},
            'value': {0: 'batch_size'}
        }
    )
    print("Export complete.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(__file__))
    model_path = os.path.join(base_dir, "training", "checkpoints", "model_latest.pt")
    output_path = os.path.join(base_dir, "shared_models", "model.onnx")
    export_model_to_onnx(model_path, output_path)
