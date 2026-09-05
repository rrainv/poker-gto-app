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
  win.webContents.sendInputEvent({ type: 'mouseWheel', ...geometry.panelPoint, deltaY: -180, canScroll: true });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const scrollTop = await win.webContents.executeJavaScript("document.querySelector('#teacherContent').scrollTop");
  await win.webContents.executeJavaScript("document.querySelector('#teacherContent').scrollTop = 0");
  win.webContents.sendInputEvent({ type: 'mouseMove', ...geometry.summaryPoint });
  win.webContents.sendInputEvent({ type: 'mouseDown', ...geometry.summaryPoint, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  win.webContents.sendInputEvent({ type: 'mouseUp', ...geometry.summaryPoint, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const detailOpen = await win.webContents.executeJavaScript("document.querySelector('details').open");
  fs.writeFileSync(resultPath, JSON.stringify({ ...geometry, scrollTop, detailOpen }));
  win.destroy(); app.quit();
}).catch((error) => { fs.writeFileSync(resultPath, JSON.stringify({ error: String(error?.stack || error) })); app.quit(); });
