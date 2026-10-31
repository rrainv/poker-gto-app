const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-saved-objects-benchmark-'));
app.setPath('userData', temporaryUserData);

async function waitForBenchmark(window) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const ready = await window.webContents.executeJavaScript(
      "typeof globalThis.savedObjectsBenchmarkPromise !== 'undefined'",
      true,
    );
    if (ready) return window.webContents.executeJavaScript('globalThis.savedObjectsBenchmarkPromise', true);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Saved Objects benchmark did not initialize');
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  try {
    await window.loadFile(path.join(__dirname, 'saved_objects001_benchmark.html'));
    const report = await waitForBenchmark(window);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  } finally {
    try { window.destroy(); } catch { /* already destroyed */ }
    try { fs.rmSync(temporaryUserData, { recursive: true, force: true }); } catch { /* OS cleanup fallback */ }
  }
});

