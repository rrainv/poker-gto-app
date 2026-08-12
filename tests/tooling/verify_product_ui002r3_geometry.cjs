/*
 * From the repository root in PowerShell:
 *   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
 *   .\node_modules\.bin\electron.cmd .\tests\tooling\verify_product_ui002r3_geometry.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const sizes = [[1024, 768], [1280, 900], [1440, 900], [1600, 900]];
const appRoot = path.join(__dirname, '..', '..', 'app');
const windows = new Set();
let baseUrl = '';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertGeometry(condition, message) {
  if (!condition) throw new Error(`Geometry assertion failed: ${message}`);
}

async function inspect(width, height) {
  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
    },
  });
  windows.add(win);

  const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8')
    .replace('<head>', `<head><base href="${baseUrl}/">`);
  await win.loadURL('data:text/html,<html><body></body></html>').catch(() => {});
  await win.webContents.executeJavaScript(`document.open(); document.write(${JSON.stringify(html)}); document.close();`);
  await delay(1200);
  await win.webContents.executeJavaScript(`document.querySelector('#settingsModal').classList.add('show')`);
  await delay(350);

  const result = await win.webContents.executeJavaScript(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
      };
    };
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      sourceBadge: rect('#sourceBadge'),
      recommendTop: rect('.recommend-top'),
      frequency: rect('.frequency-visualization'),
      betting: rect('#sharedControls'),
      bettingHeading: rect('.playbook-inline-heading'),
      heroPos: rect('#heroPos'),
      lastAction: rect('#lastAction'),
      facingField: rect('#facingSize'),
      potField: rect('#potSize'),
      openCharts: rect('#openCharts'),
      openChartsParent: document.querySelector('#openCharts')?.parentElement?.className || null,
      settingsBackdrop: rect('#settingsModal'),
      settingsModal: rect('#settingsModal .settings-modal'),
      modeRail: rect('#modeRail'),
      toast: rect('#toast'),
    };
  })()`);

  await win.webContents.executeJavaScript(`document.querySelector('#settingsModal').classList.remove('show'); document.querySelector('#cardModal').classList.add('show')`);
  await delay(350);
  result.cardBackdrop = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('#cardModal');
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, zIndex: getComputedStyle(element).zIndex };
  })()`);
  await win.webContents.executeJavaScript(`
    document.querySelector('#cardModal').classList.remove('show');
    document.querySelector('#gtoMode').style.display = 'none';
    document.querySelector('#trainingMode').style.display = 'block';
  `);
  await delay(100);
  result.trainingBadges = await win.webContents.executeJavaScript(`(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, whiteSpace: getComputedStyle(element).whiteSpace };
    };
    const cluster = document.querySelector('.training-state-cluster');
    return { cluster: rect(cluster), badges: [...cluster.querySelectorAll('.badge')].map(rect) };
  })()`);
  return result;
}

function verify(output) {
  const compact = output['1024x768'];

  for (const [label, result] of Object.entries(output)) {
    assertGeometry(result.viewport.width === Number(label.split('x')[0]), `${label} viewport width`);
    assertGeometry(result.viewport.height === Number(label.split('x')[1]), `${label} viewport height`);
    assertGeometry(result.openChartsParent === 'playbook-inline-heading', `${label} View all hands parent`);
    assertGeometry(Number(result.settingsBackdrop.zIndex) > Number(result.modeRail.zIndex), `${label} modal above mode rail`);
    assertGeometry(Number(result.settingsBackdrop.zIndex) > Number(result.toast.zIndex), `${label} modal above toast`);
    assertGeometry(result.settingsBackdrop.left === 0 && result.settingsBackdrop.top === 0, `${label} backdrop origin`);
    assertGeometry(result.settingsBackdrop.right === result.viewport.clientWidth, `${label} backdrop viewport width`);
    assertGeometry(result.settingsBackdrop.bottom === result.viewport.clientHeight, `${label} backdrop viewport height`);
    assertGeometry(result.cardBackdrop.zIndex === result.settingsBackdrop.zIndex, `${label} card picker backdrop layer`);
    assertGeometry(result.cardBackdrop.width === result.settingsBackdrop.width && result.cardBackdrop.height === result.settingsBackdrop.height, `${label} card picker viewport coverage`);
    const [firstTrainingBadge, secondTrainingBadge] = result.trainingBadges.badges;
    assertGeometry(firstTrainingBadge.whiteSpace === 'nowrap' && secondTrainingBadge.whiteSpace === 'nowrap', `${label} Training badges remain one line`);
    assertGeometry(firstTrainingBadge.left >= result.trainingBadges.cluster.left && secondTrainingBadge.right <= result.trainingBadges.cluster.right, `${label} Training badges stay inside their cluster`);
    const trainingBadgesOverlap = !(
      firstTrainingBadge.right <= secondTrainingBadge.left
      || secondTrainingBadge.right <= firstTrainingBadge.left
      || firstTrainingBadge.bottom <= secondTrainingBadge.top
      || secondTrainingBadge.bottom <= firstTrainingBadge.top
    );
    assertGeometry(!trainingBadgesOverlap, `${label} Training badges do not collide`);

    const horizontalGapStart = result.settingsModal.left;
    const horizontalGapEnd = result.viewport.clientWidth - result.settingsModal.right;
    const verticalGapStart = result.settingsModal.top;
    const verticalGapEnd = result.viewport.clientHeight - result.settingsModal.bottom;
    assertGeometry(Math.min(horizontalGapStart, horizontalGapEnd, verticalGapStart, verticalGapEnd) >= 16, `${label} modal safe edge gap`);
    assertGeometry(Math.abs(horizontalGapStart - horizontalGapEnd) <= 1, `${label} modal horizontal centering`);
    assertGeometry(Math.abs(verticalGapStart - verticalGapEnd) <= 1, `${label} modal vertical centering`);

    if (result.viewport.width >= 1280) {
      assertGeometry(result.betting.height >= 95 && result.betting.height <= 115, `${label} Betting Context target height`);
      assertGeometry(result.sourceBadge.right <= result.frequency.left - 12, `${label} source badge/frequency gap`);
      assertGeometry(result.heroPos.left < result.lastAction.left && result.lastAction.left < result.facingField.left && result.facingField.left < result.potField.left, `${label} four-part value row`);
    }
  }

  assertGeometry(compact.sourceBadge.bottom <= compact.frequency.top - 6, '1024 source badge/frequency separation');
  assertGeometry(compact.heroPos.left < compact.lastAction.left, '1024 context first row');
  assertGeometry(compact.facingField.left < compact.potField.left && compact.facingField.top > compact.heroPos.bottom, '1024 context second row');
}

function createStaticServer() {
  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(appRoot, relativePath || 'index.html');
    const root = path.resolve(appRoot);
    if ((!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html'))) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

app.whenReady().then(async () => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const output = {};
  for (const [width, height] of sizes) output[`${width}x${height}`] = await inspect(width, height);
  verify(output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  for (const win of windows) win.destroy();
  windows.clear();
  await new Promise((resolve) => server.close(resolve));
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
