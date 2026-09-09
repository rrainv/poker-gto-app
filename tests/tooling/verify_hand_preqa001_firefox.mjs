#!/usr/bin/env node

import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-hand-preqa-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const pageErrors = [];

function staticServer() {
  const types = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function settle(page, milliseconds = 180) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds > 0) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigate(page, navigationId) {
  await page.click(`.mode-nav-item[data-navigation-id="${navigationId}"]`);
  await page.waitForFunction((id) => document.documentElement.dataset.layoutWorkspace === id, {}, navigationId);
  await settle(page);
}


const server = staticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true, extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 } });
  const page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.app && window.RiverlinePlaybookState);
  await page.evaluate(() => { window.RiverlinePresentationTheme.apply('daylight'); window.setLanguage('en'); });
  await navigate(page, 'hand');
  if (await page.$('#gtoMode .tutorial-offer-actions button:first-child')) await page.click('#gtoMode .tutorial-offer-actions button:first-child');

  await page.select('#handCollectionType','fixed_per_seated_player');
  await page.evaluate(()=>{const e=document.querySelector('#handTableSize');e.value='7';e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#handTableSize',e=>e.min),'7');
  assert.match(await page.$eval('#handAccountingPreview',e=>e.textContent),/outside the pot.*0.1/);
  assert.doesNotMatch(await page.$eval('#handSetupSection',e=>e.textContent),/Home|ClubGG|Game mode/);
  assert.ok(await page.evaluate(()=>document.querySelector('#handCollectionType').getBoundingClientRect().width > document.querySelector('#handTableSize').getBoundingClientRect().width * 1.8), 'collection choice must have a full-width readable field');
  await page.screenshot({path:path.join(artifactRoot,'explicit-collection-setup.png'),fullPage:true});
  await page.click('#handStartButton');
  assert.equal(await page.evaluate(()=>window.RiverlinePlaybookState.getState().deductionTotalMilliBb),700);
  await page.evaluate(()=>{window.RiverlinePlaybookState.resetHand();window.renderCanonicalHandWorkspace();});
  await page.select('#handCollectionType','none');
  await page.select('#handAnteType','big_blind');
  await page.evaluate(()=>{for(const [id,value] of [['handTableSize','5'],['handAnteBb','1']]) {const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
  await page.click('#handStartButton');
  await settle(page);
  const bba=await page.evaluate(()=>{
    const b=window.RiverlinePlaybookState,state=b.getState();
    const p=b.createTablePresenceViewModel().seats.find(p=>p.position==='BB');
    const group=document.getElementById(`forced-contribution-${p.visualSeatIndex}`);
    document.querySelector('#handSeatList').closest('details').open=true;
    return {pot:state.potMilliBb, caption:group.textContent,hidden:group.hasAttribute('hidden'),breakdown:document.querySelector('#handSeatList').textContent};
  });
  assert.equal(bba.pot,2500);assert.equal(bba.hidden,false);
  assert.match(bba.caption,/Ante 1/);assert.match(bba.caption,/BB 1/);assert.match(bba.breakdown,/Ante 1 bb/);
  await page.screenshot({path:path.join(artifactRoot,'bba-initialized.png'),fullPage:true});
  const result = await page.evaluate(() => {
    const b = window.RiverlinePlaybookState;
    b.resetHand();
    b.initializeHand({tableSize:3,gameMode:'home',stackBb:10,heroSeat:0,buttonSeat:0});
    b.dealHoleCards({'seat-0':['As','Ah'],'seat-1':['Ks','Kh'],'seat-2':['Qs','Qh']});
    for(let n=0;n<6 && !b.getState().pendingChance;n++) {
      const a=b.getLegalActions(); b.applyAction(a.check.available?'check':'call');
    }
    b.dealBoardCards(['2c','3d','4h']);
    b.applyAction('bet', 1);
    b.applyAction('call');
    b.applyAction('fold');
    for(let n=0;n<6 && !b.getState().pendingChance;n++) {
      const a=b.getLegalActions(); b.applyAction(a.check.available?'check':'call');
    }
    b.dealBoardCards(['8s']);
    for(let n=0;n<6 && !b.getState().pendingChance;n++) { const a=b.getLegalActions(); b.applyAction(a.allIn.available?'all_in':'call'); }
    window.renderCanonicalHandWorkspace();
    return {state:{phase:b.getState().phase, pendingChance:b.getState().pendingChance,hero:b.getState().players[0]},projection:b.createReplayProjectionViewModel().readOnly,
      random:document.querySelector('#handRandomizeBoard').outerHTML,errors:b.getDiagnostics?.()};
  });

  assert.equal(result.state.hero.folded,true);
  assert.equal(result.state.pendingChance.type,'deal_river');
  assert.equal(await page.$eval('#handRandomizeBoard',e=>e.disabled),false);
  const before=await page.evaluate(()=>JSON.stringify(window.RiverlinePlaybookState.getState()));
  await page.click('#handRandomizeBoard');
  await settle(page);
  assert.equal(await page.evaluate(()=>window.app.playbookHandDraft.board.length),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.RiverlinePlaybookState.getState())),before);
  assert.equal(await page.$eval('#handDealBoardButton',e=>e.disabled),false);
  await page.screenshot({path:path.join(artifactRoot,'folded-pending-river.png'),fullPage:true});
  await page.evaluate(()=>{window.RiverlinePlaybookState.selectReplayFrame(0);window.renderCanonicalHandWorkspace();});
  assert.equal(await page.$eval('#handRandomizeBoard',e=>e.disabled),true);
  assert.equal(await page.evaluate(()=>window.randomizeCanonicalHandPendingDraft()),false);
  await page.evaluate(()=>{window.RiverlinePlaybookState.returnReplayToLive();window.renderCanonicalHandWorkspace();});
  assert.equal(await page.$eval('#handRandomizeBoard',e=>e.disabled),false);
  await page.click('#handDealBoardButton');
  assert.equal(await page.evaluate(()=>window.RiverlinePlaybookState.getState().board.length),5);
  assert.equal(await page.$eval('#handRandomizeBoard',e=>e.hidden && e.disabled),true);
  const committed=await page.evaluate(()=>JSON.stringify(window.RiverlinePlaybookState.getState()));
  assert.equal(await page.evaluate(()=>window.randomizeCanonicalHandPendingDraft()),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.RiverlinePlaybookState.getState())),committed);
  assert.deepEqual(pageErrors,[]);
  console.log(JSON.stringify({artifactRoot,bba,checks:['explicit rules setup and fixed collection','BBA table and breakdown','folded Hero with two all-in opponents','Random River draft leaves state unchanged','Replay read-only and return to live','commit preserves history and prevents rerandomization'],pageErrors},null,2));
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
