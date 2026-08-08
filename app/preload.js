const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    runONNXInference: (stateFeatures, relativePos) => ipcRenderer.invoke('onnx-inference', stateFeatures, relativePos)
});
