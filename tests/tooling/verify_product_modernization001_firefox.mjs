// Start node tools/dev-web-server.mjs. Uses only a disposable Firefox profile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const {default: puppeteer} = await import(process.env.RIVERLINE_PUPPETEER_MODULE || 'puppeteer');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-modernization-'));
console.log(out);
const browser = await puppeteer.launch({browser:'firefox',headless:true, executablePath:process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe'});
const errors=[], checks=[];
try {
const page = await browser.newPage();
page.on('pageerror',e=>errors.push(String(e)));
const settle = () => page.evaluate(async()=>{
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 await Promise.race([Promise.allSettled(document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)),new Promise(r=>setTimeout(r,600))]);
});
const shot = async name => {await settle(); await page.mouse.move(1,1); await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});};
const visible = selector => page.$eval(selector,e=>!!e.getClientRects().length);
const nav = async id => {
 await page.click(`.mode-nav-item[data-navigation-id="${id}"]`);
 if (['home','saved'].includes(id)) await page.waitForFunction(()=>document.querySelector('#homeWorkspace').getAttribute('aria-busy')==='false');
 if(id==='personal-strategy') await page.waitForFunction(()=>['empty','configured','guest','error'].includes(document.querySelector('#rangeCalibrationWorkspace').dataset.calibrationState));
 await settle();
 for (const skip of await page.$$('.tutorial-offer button')) {
  if (await skip.evaluate(e=>e.getClientRects().length && /Skip|Пропустить/.test(e.textContent))) await skip.click();
 }
};
await page.setViewport({width:1920,height:1080});
await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle0'});
await page.waitForFunction(()=>window.RiverlineWelcome && window.RiverlinePresentationTheme);
await page.evaluate(()=>setLanguage('en')); await shot('welcome-first');
await page.click('[data-welcome-destination="home"]');
for (const width of [1920,1366]) {
 await page.setViewport({width,height:width===1920?1080:768});
 for (const id of ['home','analyze','training','personal-strategy','equity','saved','guide']) {
  await nav(id); await shot(`${id}-empty-${width}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} ${width} horizontal fit`);
 }
 await nav('analyze');
 await page.evaluate(async()=>{app.gto.hero=[];renderPlaybookCards();await updateContext();});
 assert.ok(await visible('#analysisInputState'));
 assert.equal(await visible('#bestAction'),false);
 await page.click('#analysisEditInputs');
 assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
 await page.evaluate(()=>randomizeCurrentAnalyzeScenario());
 await page.waitForFunction(()=>app.strategyResult && !document.querySelector('#analysisInputState').getClientRects().length);
 await shot(`analyze-ready-${width}`);
 await nav('equity');
 assert.ok(await visible('.equity-before-calculation'));
 await page.evaluate(async()=>{setEquityPlayerCount(2);app.equity.players[0].cards=['As','Ah'];app.equity.players[1].cards=['Ks','Kh'];app.equity.players[1].handMode="known";app.equity.board=['2c','3d','4h','8s','9s'];renderEquityPlayers();setEquityPending();await calculateEquity();});
 assert.equal(await page.$eval('.equity-workspace',e=>e.dataset.equityState),'complete');
 assert.equal(await visible('.equity-before-calculation'),false);
 await shot(`equity-result-${width}`);
 await page.evaluate(()=>{app.equity.board=['2c','3d','4h','8s'];setEquityPending();});
 assert.equal(await page.$eval('.equity-workspace',e=>e.dataset.equityState),'stale');
 await shot(`equity-stale-${width}`);
 await page.evaluate(()=>resetEquityCalculator());
 checks.push({viewport:width,emptyStates:true,analysisTransition:true,equityTransition:true});
}
await nav('personal-strategy');
await page.click('#calibrationCreateFirstProfile'); await page.type('#calibrationProfileDisplayName','Evening study'); await page.click('#calibrationProfileSubmit');
await page.waitForFunction(()=>document.querySelectorAll('.personal-hand-map button').length===169);
for(const width of [1920,1366]) {await page.setViewport({width,height:width===1920?1080:768});await shot(`personal-question-${width}`);}
assert.equal(await page.$$eval('.personal-hand-map button',nodes=>nodes.filter(e=>e.tabIndex===0).length),1);
await page.focus('.personal-hand-map button');await page.keyboard.press('ArrowDown');
assert.equal(await page.$$eval('.personal-hand-map button',nodes=>nodes.indexOf(document.activeElement)),13);
await page.click('[data-calibration-action=raise]');
await page.waitForFunction(()=>document.querySelector('#personalTeacherLearning')?.hidden===false);
await shot('personal-learn');
const knownHand=await page.$eval('.personal-hand-map [data-coverage-state="directly_known"]',e=>e.dataset.mapHand);
await page.click(`.personal-hand-map [data-map-hand="${knownHand}"]`);
assert.equal(await page.$eval('#rangeCalibrationWorkspace',e=>e.dataset.personalView),'matrix');
assert.equal(await page.evaluate(()=>RiverlineRangeCalibration.getState().matrixSelectedHand),knownHand);
assert.equal(await page.evaluate(()=>document.activeElement.id),'calibrationMatrixTab');
await shot('personal-inspect');
await page.click('#calibrationMatrixFold'); await settle(); await shot('personal-corrected');
await page.click('#calibrationUnderstandingTab');await page.waitForFunction(()=>document.querySelectorAll('.personal-hand-map button').length===169);
await shot('personal-understanding');
const unknownHand=await page.$eval('.personal-hand-map [data-coverage-state="unknown"]',e=>e.dataset.mapHand);
await page.click(`.personal-hand-map [data-map-hand="${unknownHand}"]`);
await page.waitForFunction(hand=>RiverlineRangeCalibration.getState().calibrationState?.prompt?.handClass===hand,{},unknownHand);
checks.push({personalMap:true,knownHand,unknownHand,correction:true});
await nav('training');await page.click('#trainingNewHand');
await page.waitForFunction(()=>document.querySelector('.training-workspace').dataset.trainingState==='ready');
assert.equal(await visible('#trainingFeedback'),false);await shot('training-decide');
await page.click('#trainingGuessButtons button');
await page.waitForFunction(()=>document.querySelector('.training-workspace').dataset.trainingState==='feedback');
assert.equal(await page.evaluate(()=>document.activeElement.id),'feedbackTitle');
assert.ok(await page.evaluate(()=>document.querySelector('#trainingFeedback').getBoundingClientRect().top<document.querySelector('#trainingExerciseSurface').getBoundingClientRect().top));
await shot('training-learn');
if(await visible('#trainingRequestRevisit')) {await page.click('#trainingRequestRevisit');await settle();await shot('training-revisit');}
checks.push({trainingEmbargo:true,feedbackFocus:true,feedbackComposition:true});
await nav('hand');
await shot('hand-configured');
await page.evaluate(()=>{const b=RiverlinePlaybookState;b.resetHand();b.initializeHand({tableSize:2,gameMode:'home',stackBb:10,heroSeat:0,buttonSeat:0});const p=b.getState().players;b.dealObservedHoleCards({[p[0].playerId]:['As','Ah'],[p[1].playerId]:['Ks','Kh']});renderCanonicalHandWorkspace();});
await shot('hand-live');
await page.evaluate(()=>{const b=RiverlinePlaybookState;b.applyAction('call');b.applyAction('check');for(const cards of [['2c','3d','4h'],['8s'],['9s']]){b.dealBoardCards(cards);b.applyAction('check');b.applyAction('check');}if(b.getState().phase==='showdown')b.resolveShowdown();renderCanonicalHandWorkspace();});
await page.click('#handCompletedReviewButton');await page.waitForSelector('.study-primary-roles');await shot('review-no-intent');
assert.deepEqual(await page.$$eval('.study-primary-roles > section',nodes=>nodes.map(e=>e.dataset.deltaRole)),['observedAction','personalIntent','heuristicBaseline']);
await page.click('#deepStudyReview [data-study-disclosure$=":evidence"] > summary');
await page.focus('#deepStudyReview [data-study-disclosure$=":evidence"] > summary');
await page.evaluate(async()=>{const {renderDeepReview}=await import('/src/application/study-workspace.mjs');const review=app.handReview.model;renderDeepReview({root:document.querySelector('#deepStudyReview'),review,evidence:{[review.selectedDecision.decisionId]:{personal:{personalStatus:'available',intendedAction:'call',precision:'dominant_only',frequency:null,evidenceIds:['browser-intent-fixture']}}},onAction(){},onSelect(){}});});
assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
assert.ok(await page.$eval('#deepStudyReview [data-study-disclosure$=":evidence"]',e=>e.open));
assert.ok(!await page.$eval('[data-delta-role="personalIntent"]',e=>e.textContent.includes('%')));
await shot('review-intent-evidence-fixture');checks.push({reviewPrimaryRoles:true,disclosureFocus:true,qualitativeIntent:true});
await page.click('#handReviewSaveHand');await settle();await nav('saved');await shot('saved-populated');
await nav('home');await shot('home-continuity');
await page.click('#openSettings');await shot('settings');await page.keyboard.press('Escape');
for(const theme of ['midnight','daylight','custom']) {
 await page.evaluate(theme=>{const c=RiverlinePresentationTheme;if(theme==='custom'){c.apply('midnight');c.customize({surface:'#777777',accent:'#e33685',felt:'#335544'});c.saveAsNew('Modernization QA');}else c.apply(theme);},theme);
 for(const lang of ['en','ru','he']) {
  await page.evaluate(lang=>setLanguage(lang),lang);
  for(const route of ['guide','personal-strategy','equity','analyze','training']) {
   await nav(route);await shot(`${route}-${theme}-${lang}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} ${theme} ${lang} fit`);
  }
 }
 checks.push({theme,languages:['en','ru','he']});
}
await page.evaluate(()=>{setLanguage('en');RiverlinePresentationTheme.apply('midnight');});
await nav('equity');
await page.evaluate(()=>{resetEquityCalculator();setEquityPlayerCount(2);app.equity.players[0].cards=['As','Ah'];app.equity.players[1].cards=['Ks','Kh'];app.equity.players[1].handMode='known';app.equity.board=['2c','3d','4h','8s'];renderAllCards({mode:'equity'});setEquityPending({renderInputs:'players'});});
await page.click('#advancedEquityWorkspace > details > summary');
await page.click('#advancedEquityWorkspace .advanced-equity-controls button:first-child');
await page.waitForSelector('#advancedEquityWorkspace .advanced-equity-value');
await page.click('#advancedEquityWorkspace .advanced-equity-runout-controls > button');
await page.waitForSelector('#advancedEquityWorkspace .runout-card');
await page.click('#advancedEquityWorkspace .runout-card');await shot('equity-runout');
assert.equal(await page.$eval('#advancedEquityWorkspace .runout-card',e=>e.getAttribute('aria-pressed')),'true');
await page.focus('#advancedEquityWorkspace > details > summary');await page.keyboard.press('Escape');
assert.equal(await page.$eval('#advancedEquityWorkspace > details',e=>e.open),false);
await nav('analyze');await page.evaluate(()=>requestPlaybookMode('scenario'));await page.evaluate(()=>randomizeCurrentAnalyzeScenario());
if(await page.$eval('#toggleTeacher',e=>e.getAttribute('aria-expanded')!=='true')) await page.click('#toggleTeacher');await shot('analyze-explain');
checks.push({runout:true,runoutDismissal:true,explain:true});
const knownDiagnostics=errors.filter(e=>e==='Error: RangeError: Personal Strategy is saved locally. Cloud sync requires a compatible schema upgrade.');
checks.push({knownDiagnostics,diagnosticOwner:'Existing Personal Strategy sync compatibility boundary; no migration attempted.'});
assert.deepEqual(errors.filter(e=>!knownDiagnostics.includes(e)),[]);console.log(JSON.stringify(checks));
} finally {fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
