// ONNX Model Lazy Loader Service
class LazyLoader {
  constructor() {
    this.sessions = new Map();
    this.loading = new Map(); // Promises to prevent duplicate fetches
  }

  /**
   * Lazily loads an ONNX model if not already cached.
   * @param {string} street - The street name (e.g. 'flop', 'turn', 'river')
   * @param {string} modelType - e.g. 'student' or 'teacher'
   * @returns {Promise<ort.InferenceSession>}
   */
  async getSession(street, modelType = 'student') {
    const modelName = `${street}_${modelType}.onnx`;
    
    // Return cached session if available
    if (this.sessions.has(modelName)) {
      return this.sessions.get(modelName);
    }

    // If currently loading, wait for it
    if (this.loading.has(modelName)) {
      return this.loading.get(modelName);
    }

    const loadPromise = this._loadModel(modelName);
    this.loading.set(modelName, loadPromise);

    try {
      const session = await loadPromise;
      this.sessions.set(modelName, session);
      window.dispatchEvent(new CustomEvent('onnxLoaded', { detail: { modelName } }));
      return session;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      throw error;
    } finally {
      this.loading.delete(modelName);
      this._hideSpinner();
    }
  }

  async _loadModel(modelName) {
    this._showSpinner(modelName);
    
    // We expect the models to be served from /solver-model/
    const url = `solver-model/${modelName}`;
    
    // Fetch buffer via HTTP
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    
    // Instantiate inference session (Assuming ort is globally available from ort.min.js)
    if (typeof ort === 'undefined') {
      throw new Error('ONNX Runtime (ort) is not loaded.');
    }
    
    const session = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] });
    return session;
  }

  _showSpinner(modelName) {
    let spinner = document.getElementById('onnx-lazy-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'onnx-lazy-spinner';
      spinner.style.position = 'fixed';
      spinner.style.bottom = '20px';
      spinner.style.right = '20px';
      spinner.style.background = 'rgba(0,0,0,0.8)';
      spinner.style.color = 'var(--color-primary, #ff4655)';
      spinner.style.padding = '10px 20px';
      spinner.style.borderRadius = '5px';
      spinner.style.zIndex = '9999';
      spinner.style.fontFamily = 'monospace';
      spinner.style.fontWeight = 'bold';
      document.body.appendChild(spinner);
    }
    spinner.textContent = `Loading Weights: ${modelName}...`;
    spinner.style.display = 'block';
  }

  _hideSpinner() {
    const spinner = document.getElementById('onnx-lazy-spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
  }
}

// Instantiate globally
if (typeof window !== 'undefined') {
  window.onnxLazyLoader = new LazyLoader();
}

window.LazyLoader = LazyLoader;
