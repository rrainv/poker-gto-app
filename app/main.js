const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const ort = require('onnxruntime-node'); // TASK 5: Native C++ bindings

let mainWindow = null;
let ortSession = null;

async function loadModel() {
    try {
        const modelPath = path.join(__dirname, '..', 'shared_models', 'model.onnx');
        ortSession = await ort.InferenceSession.create(modelPath);
        console.log('[ONNX] Native ONNX model loaded successfully.');
    } catch (err) {
        console.error('[ONNX] Failed to load model:', err);
    }
}

// IPC handler for inference
ipcMain.handle('onnx-inference', async (event, stateFeatures, relativePos) => {
    if (!ortSession) return null;
    try {
        const stateTensor = new ort.Tensor('float32', Float32Array.from(stateFeatures), [1, 100]);
        const posTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(relativePos)]), [1]);
        
        const feeds = { state_features: stateTensor, relative_position: posTensor };
        const results = await ortSession.run(feeds);
        
        return {
            policy: Array.from(results.policy.data),
            value: Array.from(results.value.data)
        };
    } catch (err) {
        console.error('[ONNX Inference Error]', err);
        return null;
    }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 768,
    title: 'Riverline Poker Workstation',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js') // Added preload
    }
  });

  mainWindow.setMenuBarVisibility(false);
  const indexPath = path.join(__dirname, 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await loadModel();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
