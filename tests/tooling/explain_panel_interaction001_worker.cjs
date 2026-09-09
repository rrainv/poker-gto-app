'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const resultPath = process.argv.find((value) => value.startsWith('--result='))?.slice(9);
const userData = process.argv.find((value) => value.startsWith('--user-data='))?.slice(12);
if (userData) app.setPath('userData', userData);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('headless');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 700 });
  const css = fs.readFileSync(path.resolve(__dirname, '..', '..', 'app', 'styles.css'), 'utf8');
  const html = `<style>${css}</style><section class="panel recommend playbook-primary-decision"><div class="teacher-panel"><button id="toggleTeacher">Explain</button><div id="teacherContent" class="analysis-panel-content" style="display:block;max-height:300px;overflow:auto"><details class="analysis-detail-group"><summary>Supporting detail</summary><p>Detail</p></details><div style="height:700px"></div></div></div></section>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const geometry = await win.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('#teacherContent');
    const summary = panel.querySelector('summary');
    const pr = panel.getBoundingClientRect(); const sr = summary.getBoundingClientRect();
    const panelPoint = { x: Math.round(pr.left + pr.width / 2), y: Math.round(pr.top + 180) };
    const summaryPoint = { x: Math.round(sr.left + sr.width / 2), y: Math.round(sr.top + sr.height / 2) };
    return { panelPoint, summaryPoint, clientHeight: panel.clientHeight, scrollHeight: panel.scrollHeight,
      panelHitOwned: panel.contains(document.elementFromPoint(panelPoint.x, panelPoint.y)),
      summaryHitOwned: summary.contains(document.elementFromPoint(summaryPoint.x, summaryPoint.y)) };
  })()`);

  // Native Electron sendInputEvent(mouseWheel) is dropped by this hidden Windows
  // window. CDP dispatches real Chromium input through hit testing/default scrolling.
  // Arm observable completion before input; never substitute a fixed sleep or a
  // synthetic DOM event for the wheel/scroll behavior under test.
  win.webContents.debugger.attach('1.3');
  await win.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('#teacherContent');
    window.wheelReceived = false;
    panel.addEventListener('wheel', () => { window.wheelReceived = true; }, { once: true, passive: true });
    window.scrollCompletion = new Promise(resolve => {
      const deadline = setTimeout(() => resolve(false), 5000);
      panel.addEventListener('scroll', () => { clearTimeout(deadline); resolve(true); }, { once: true });
    });
  })()`);
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseWheel', ...geometry.panelPoint, deltaX: 0, deltaY: 180,
  });
  const scroll = await win.webContents.executeJavaScript(`(async () => ({
    scrollObserved: await window.scrollCompletion,
    wheelReceived: window.wheelReceived,
    scrollTop: document.querySelector('#teacherContent').scrollTop,
  }))()`);
  // Remove the scroll offset, then measure the actual nested target again.
  const summaryPoint = await win.webContents.executeJavaScript(`(() => {
    document.querySelector('#teacherContent').scrollTop = 0;
    const summary = document.querySelector('summary');
    const rect = summary.getBoundingClientRect();
    window.detailCompletion = new Promise(resolve => {
      const deadline = setTimeout(() => resolve(false), 5000);
      summary.parentElement.addEventListener('toggle', () => {
        clearTimeout(deadline); resolve(summary.parentElement.open);
      }, { once: true });
    });
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
    type: 'mousePressed', ...summaryPoint, button: 'left', clickCount: 1,
  });
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseReleased', ...summaryPoint, button: 'left', clickCount: 1,
  });
  const detailOpen = await win.webContents.executeJavaScript('window.detailCompletion');
  fs.writeFileSync(resultPath, JSON.stringify({ ...geometry, ...scroll, detailOpen }));
  win.destroy(); app.quit();
}).catch((error) => { fs.writeFileSync(resultPath, JSON.stringify({ error: String(error?.stack || error) })); app.quit(); });
