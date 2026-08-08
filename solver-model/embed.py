import onnx
import os

onnx_path = os.path.join(os.path.dirname(__file__), "model.onnx")
embedded_path = os.path.join(os.path.dirname(__file__), "model_embedded.onnx")

print("Loading model.onnx...")
model = onnx.load(onnx_path)

print("Saving model with embedded weights...")
onnx.save_model(model, embedded_path, save_as_external_data=False)

print(f"Done! {embedded_path} is now a standalone model.")
