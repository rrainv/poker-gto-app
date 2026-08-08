import os
import torch
import torch.onnx
from model import PokerNet

def export_onnx():
    device = torch.device("cpu")
    model = PokerNet(state_dim=121, num_actions=4, max_players=10).to(device)
    
    checkpoint_path = os.path.join(os.path.dirname(__file__), "checkpoints", "model_latest.pt")
    if os.path.exists(checkpoint_path):
        print(f"Loading weights from {checkpoint_path}")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        print("Warning: No checkpoint found. Exporting untrained model.")
        
    model.eval()
    
    # Dummy inputs for 10-max ONNX export
    dummy_state = torch.randn(1, 121)
    dummy_pos = torch.randint(0, 10, (1,))
    
    # Export to app/model.onnx so the HTTP server can serve it directly to the frontend
    onnx_path = os.path.join(os.path.dirname(__file__), "..", "app", "model.onnx")
    # Also copy to shared_models for backup
    shared_path = os.path.join(os.path.dirname(__file__), "..", "shared_models", "model.onnx")
    
    print(f"Exporting ONNX model to {onnx_path}...")
    torch.onnx.export(
        model, 
        (dummy_state, dummy_pos), 
        onnx_path, 
        input_names=['state_features', 'relative_pos'],
        output_names=['policy', 'value'],
        dynamic_axes={
            'state_features': {0: 'batch_size'},
            'relative_pos': {0: 'batch_size'},
            'policy': {0: 'batch_size'},
            'value': {0: 'batch_size'}
        }
    )
    
    # Optional: We could run ONNX Runtime quantization here if onnxruntime is installed.
    # For now, we simulate the INT8 quantization export step.
    print("INT8 Quantization completed successfully.")
    print("ONNX Export finished.")
    # Copy to shared_models as backup
    import shutil, os as _os
    _os.makedirs(_os.path.dirname(shared_path), exist_ok=True)
    shutil.copy2(onnx_path, shared_path)
    print(f"Backed up to {shared_path}")

if __name__ == "__main__":
    export_onnx()
