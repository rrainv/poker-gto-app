import torch
import torch.onnx
from model import DeepCFRNet, encode_cards
import os
import sys

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Load the trained model
model = DeepCFRNet(input_dim=69)
model_path = os.path.join(os.path.dirname(__file__), "model.pt")

if os.path.exists(model_path):
    try:
        model.load_state_dict(torch.load(model_path, weights_only=True))
        model.eval()
        print("Loaded model from model.pt")
    except Exception as e:
        print(f"Error loading model: {e}")
        exit(1)
else:
    print("model.pt not found!")
    exit(1)

# Create dummy input matching the expected shape
dummy_input = torch.zeros(1, 69)
dummy_input[0, 52] = 6.0 / 9.0
dummy_input[0, 53] = 100.0 / 200.0
dummy_input[0, 54] = 0.0
dummy_input[0, 55] = 1.5 / 200.0
dummy_input[0, 56] = 0.0
dummy_input[0, 57 + 3] = 1.0
dummy_input[0, 63] = 1.0

onnx_path = os.path.join(os.path.dirname(__file__), "model.onnx")
print(f"Exporting model to {onnx_path}...")

# Use the older, more stable export API with embedded weights
torch.onnx.export(
    model,
    dummy_input,
    onnx_path,
    export_params=True,
    opset_version=12,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output'],
    verbose=False,
    keep_initializers_as_inputs=False  # Embed weights in the model file
)

print(f"Model exported successfully to {onnx_path}")

# Verify the exported model
try:
    import onnx
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed!")
    
    # Check if there are external data files
    from onnx import helper
    if helper.printable_graph(onnx_model.graph).find('.data') != -1:
        print("Warning: Model may still have external data references")
    else:
        print("Model is fully self-contained (no external data files)")
        
except ImportError:
    print("onnx package not installed, skipping validation")
except Exception as e:
    print(f"ONNX validation error: {e}")
