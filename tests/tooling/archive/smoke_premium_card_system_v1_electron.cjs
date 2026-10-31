#!/usr/bin/env node
'use strict';

// Premium Card System v1 runtime smoke. Screenshots are written only to the OS temp folder.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const errors = [];
const screenshots = [];

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(win, expression, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(35);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target || target.disabled || target.hidden) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unavailable click target: ${selector}`);
  await settle(win);
}

async function capture(win, name) {
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(os.tmpdir(), `riverline-premium-cards-${name}.png`);
  fs.writeFileSync(screenshotPath, image.toPNG());
  screenshots.push(screenshotPath);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
      partition: `riverline-premium-cards-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(String(message));
  });

  try {
    await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
    win.setContentSize(1920, 1080);
    await waitFor(win, 'window.app && window.tableRenderer && window.RiverlineCardPresentation');
    await click(win, '[data-navigation-id="analyze"]');
    await win.webContents.executeJavaScript(`(async () => {
      app.gto.hero = ['Th', 'As'];
      app.gto.board = ['Kd', 'Qc', '2s'];
      app.gto.dead = [];
      renderAllCards();
      await updateContext('Premium Card System v1 smoke');
    })()`);
    await settle(win);

    const faceSamples = [];
    await click(win, '#openSettings');
    await click(win, '[data-card-rank-style="full-ten"]');
    const fourColorSequence = [await win.webContents.executeJavaScript("document.documentElement.dataset.fourColor")];
    for (const fourColor of [true, false]) {
      const currentFourColor = await win.webContents.executeJavaScript("document.documentElement.dataset.fourColor === 'true'");
      if (currentFourColor !== fourColor) await click(win, '#fourColorDeckToggle');
      fourColorSequence.push(await win.webContents.executeJavaScript("document.documentElement.dataset.fourColor"));
      for (const faceStyle of ['classic', 'minimal', 'high-contrast']) {
        await click(win, `[data-card-face-style="${faceStyle}"]`);
        faceSamples.push(await win.webContents.executeJavaScript(`(() => ({
        style: document.documentElement.dataset.cardFaceStyle,
        fourColor: document.documentElement.dataset.fourColor === 'true',
        pressed: document.querySelector('[data-card-face-style="${faceStyle}"]')?.getAttribute('aria-pressed'),
        tens: document.querySelectorAll('.rank--ten, .table-card-rank--ten').length,
        previews: [...document.querySelectorAll('[data-card-preview-face-style]')].map((card) => ({
          style: card.dataset.cardPreviewFaceStyle,
          suit: card.dataset.cardSuitId,
          color: getComputedStyle(card.querySelector('.card-center .suit')).color,
          cornerColor: getComputedStyle(card.querySelector('.card-corner--top')).color,
          corners: card.querySelectorAll('.card-corner').length,
          ranks: card.querySelectorAll('.rank').length,
          suits: card.querySelectorAll('.suit').length,
          fragmentChildren: [...card.querySelectorAll('.card-corner')].reduce((total, corner) => total + corner.childElementCount, 0),
          topDisplay: getComputedStyle(card.querySelector('.card-corner--top')).display,
          bottomDisplay: getComputedStyle(card.querySelector('.card-corner--bottom')).display,
          centerDisplay: getComputedStyle(card.querySelector('.card-center')).display,
          wideRankCount: card.querySelectorAll('[data-card-rank-width="wide"]').length,
          tenLetterSpacing: getComputedStyle(card.querySelector('.rank--ten')).letterSpacing,
        })),
        runtimeCards: [...document.querySelectorAll('.card-slot.filled')].slice(0, 5).map((card) => ({
          suit: card.querySelector('[data-card-suit-id]')?.dataset.cardSuitId,
          containerColor: getComputedStyle(card).color,
          topCornerColor: getComputedStyle(card.querySelector('.card-corner--top')).color,
          centerRankColor: getComputedStyle(card.querySelector('.card-center .rank')).color,
          centerSuitColor: getComputedStyle(card.querySelector('.card-center .suit')).color,
          size: [card.getBoundingClientRect().width, card.getBoundingClientRect().height],
          overflow: getComputedStyle(card).overflow,
        })),
        tableCards: [...document.querySelectorAll('.poker-card-svg[data-card-suit-id]')].map((card) => ({
          suit: card.dataset.cardSuitId,
          color: getComputedStyle(card).color,
          overflow: getComputedStyle(card).overflow,
          tenAlignments: [...card.querySelectorAll('[data-card-rank-width="wide"]')]
            .filter((rank) => getComputedStyle(rank).display !== 'none')
            .map((rank) => {
              const suit = rank.parentElement.querySelector('.table-card-corner-suit, .table-card-center-suit');
              const rankRect = rank.getBoundingClientRect();
              const suitRect = suit.getBoundingClientRect();
              return Math.abs((rankRect.left + rankRect.right - suitRect.left - suitRect.right) / 2);
            }),
        })),
      }))()`));
      }
    }
    if (await win.webContents.executeJavaScript("document.documentElement.dataset.fourColor !== 'true'")) {
      await click(win, '#fourColorDeckToggle');
    }
    fourColorSequence.push(await win.webContents.executeJavaScript("document.documentElement.dataset.fourColor"));

    const backSamples = [];
    for (const backStyle of ['riverline', 'solid', 'geometric']) {
      await click(win, `[data-card-back-style="${backStyle}"]`);
      backSamples.push(await win.webContents.executeJavaScript(`(() => {
        const snapshot = (card) => {
          const style = getComputedStyle(card);
          const after = getComputedStyle(card, '::after');
          return {
            backgroundImage: style.backgroundImage,
            backgroundSize: style.backgroundSize,
            borderRadius: style.borderRadius,
            afterContent: after.content,
            afterInset: after.inset,
            afterTransform: after.transform,
          };
        };
        const runtime = document.createElement('span');
        runtime.className = 'riverline-card-back';
        runtime.dataset.cardSize = 'picker';
        document.body.append(runtime);
        const preview = document.querySelector('[data-card-preview-back-style="${backStyle}"]');
        const runtimeStyle = snapshot(runtime);
        const previewStyle = snapshot(preview);
        runtime.remove();
        return {
          style: document.documentElement.dataset.cardBackStyle,
          pressed: document.querySelector('[data-card-back-style="${backStyle}"]')?.getAttribute('aria-pressed'),
          previewMatchesRuntime: JSON.stringify(previewStyle) === JSON.stringify(runtimeStyle),
          previewStyle,
        };
      })()`));
    }

    await click(win, '[data-theme-id="daylight"]');
    await capture(win, 'settings-daylight-high-contrast-geometric-1920x1080');
    await click(win, '#closeSettingsModal');
    await waitFor(win, "!document.querySelector('#settingsModal')?.classList.contains('show')");
    await delay(250);
    await capture(win, 'analyze-daylight-high-contrast-geometric-1920x1080');

    const diagnostics = await win.webContents.executeJavaScript(`(() => {
      const root = document.documentElement;
      const cards = [...document.querySelectorAll('.riverline-card')];
      const physicalCards = cards.filter((card) => card.getClientRects().length);
      const domCards = physicalCards.filter((card) => card.namespaceURI !== 'http://www.w3.org/2000/svg');
      const expectedSizes = {
        mini: [28, 40], result: [38, 54], picker: [36, 51], compact: [42, 60],
        slot: [48, 68], standard: [52, 74], representative: [52, 74], full: [56, 80],
      };
      const invalidSizes = domCards.filter((card) => {
        const expected = expectedSizes[card.dataset.cardSize];
        if (!expected) return false;
        const rect = card.getBoundingClientRect();
        return Math.abs(rect.width - expected[0]) > 0.75 || Math.abs(rect.height - expected[1]) > 0.75;
      });
      const htmlFaces = cards.filter((card) => card.querySelector('.card-center'));
      const duplicateNodeCards = htmlFaces.filter((card) => (
        card.querySelectorAll('.card-corner').length !== 2
        || card.querySelectorAll('.rank').length !== 1
        || card.querySelectorAll('.suit').length !== 1
      ));
      const malformedCornerCards = htmlFaces.filter((card) => (
        [...card.querySelectorAll('.card-corner')].some((corner) => corner.childElementCount !== 0)
      ));
      const clippedGeometry = physicalCards.filter((card) => {
        const parent = card.getBoundingClientRect();
        return [...card.querySelectorAll('.card-corner, .card-center')]
          .filter((part) => getComputedStyle(part).display !== 'none')
          .some((part) => {
            const rect = part.getBoundingClientRect();
            return rect.left < parent.left - 1 || rect.top < parent.top - 1
              || rect.right > parent.right + 1 || rect.bottom > parent.bottom + 1;
          });
      });
      const offCenterDomTens = [...document.querySelectorAll('.rank--ten')]
        .filter((rank) => getComputedStyle(rank).display !== 'none')
        .filter((rank) => {
          const center = rank.closest('.card-center');
          if (!center) return false;
          const rankRect = rank.getBoundingClientRect();
          const centerRect = center.getBoundingClientRect();
          return Math.abs((rankRect.left + rankRect.right - centerRect.left - centerRect.right) / 2) > 0.75;
        });
      const malformedTenStyles = [...document.querySelectorAll('.rank--ten')].filter((rank) => {
        const style = getComputedStyle(rank);
        return style.letterSpacing !== 'normal' && style.letterSpacing !== '0px';
      });
      const svgCards = [...document.querySelectorAll('.poker-card-svg[data-card-suit-id]')];
      const offCenterSvgTens = svgCards.flatMap((card) => (
        [...card.querySelectorAll('[data-card-rank-width="wide"]')]
          .filter((rank) => getComputedStyle(rank).display !== 'none')
          .filter((rank) => {
            const suit = rank.parentElement.querySelector('.table-card-corner-suit, .table-card-center-suit');
            const rankRect = rank.getBoundingClientRect();
            const suitRect = suit.getBoundingClientRect();
            return Math.abs((rankRect.left + rankRect.right - suitRect.left - suitRect.right) / 2) > 0.75;
          })
      ));
      const clippedSvgGeometry = svgCards.flatMap((card) => {
        const face = card.querySelector('.table-card-face')?.getBoundingClientRect();
        if (!face) return [];
        return [...card.querySelectorAll('text')]
          .filter((part) => getComputedStyle(part).display !== 'none' && part.getClientRects().length)
          .filter((part) => {
            const rect = part.getBoundingClientRect();
            return rect.left < face.left - 1 || rect.top < face.top - 1
              || rect.right > face.right + 1 || rect.bottom > face.bottom + 1;
          })
          .map((part) => {
            const rect = part.getBoundingClientRect();
            return {
              card: card.dataset.cardSuitId,
              className: part.getAttribute('class'),
              face: [face.left, face.top, face.right, face.bottom],
              part: [rect.left, rect.top, rect.right, rect.bottom],
            };
          });
      });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        faceStyle: root.dataset.cardFaceStyle,
        backStyle: root.dataset.cardBackStyle,
        theme: root.dataset.theme,
        fourColor: root.dataset.fourColor,
        physicalCardCount: physicalCards.length,
        invalidSizeCount: invalidSizes.length,
        duplicateNodeCardCount: duplicateNodeCards.length,
        malformedCornerCardCount: malformedCornerCards.length,
        clippedGeometryCount: clippedGeometry.length,
        offCenterDomTenCount: offCenterDomTens.length,
        malformedTenStyleCount: malformedTenStyles.length,
        offCenterSvgTenCount: offCenterSvgTens.length,
        clippedSvgGeometryCount: clippedSvgGeometry.length,
        clippedSvgGeometry,
        settingsPreviewCount: document.querySelectorAll('[data-card-preview-face-style]').length,
        selectedTenCount: document.querySelectorAll('.rank--ten, .table-card-rank--ten').length,
        tableCardCount: document.querySelectorAll('.poker-card-svg').length,
        rootOverflowX: root.scrollWidth > root.clientWidth + 1,
        stored: JSON.parse(localStorage.getItem('riverline_card_presentation')),
      };
    })()`);

    const unexpectedErrors = errors.filter((message) => (
      !message.includes('Multiple GoTrueClient instances detected')
      && !message.includes('Riverline Home bridge is unavailable')
    ));
    if (unexpectedErrors.length) throw new Error(`Renderer errors: ${JSON.stringify(unexpectedErrors)}`);
    if (diagnostics.viewport.width !== 1920 || diagnostics.viewport.height !== 1080) throw new Error('Unexpected viewport');
    if (diagnostics.invalidSizeCount) throw new Error(`Invalid visible card sizes: ${diagnostics.invalidSizeCount}`);
    if (diagnostics.duplicateNodeCardCount) throw new Error(`Duplicate card nodes: ${diagnostics.duplicateNodeCardCount}`);
    if (diagnostics.malformedCornerCardCount) throw new Error(`Malformed card corners: ${diagnostics.malformedCornerCardCount}`);
    if (diagnostics.clippedGeometryCount) throw new Error(`Clipped card geometry: ${diagnostics.clippedGeometryCount}`);
    if (diagnostics.offCenterDomTenCount || diagnostics.malformedTenStyleCount || diagnostics.offCenterSvgTenCount) {
      throw new Error(`Off-center full-ten geometry: ${JSON.stringify({ dom: diagnostics.offCenterDomTenCount, styles: diagnostics.malformedTenStyleCount, svg: diagnostics.offCenterSvgTenCount })}`);
    }
    if (diagnostics.clippedSvgGeometryCount) throw new Error(`Clipped SVG card geometry: ${JSON.stringify(diagnostics.clippedSvgGeometry)}`);
    if (diagnostics.settingsPreviewCount !== 3) throw new Error('Expected all Settings face previews');
    if (faceSamples.some((sample) => sample.previews.some((preview) => (
      preview.corners !== 2 || preview.ranks !== 1 || preview.suits !== 1 || preview.fragmentChildren !== 0
      || preview.wideRankCount !== 3 || !['normal', '0px'].includes(preview.tenLetterSpacing)
    )))) throw new Error('Settings preview does not use the shared face structure');
    const expectedPreviewDisplays = {
      classic: ['grid', 'grid', 'none'],
      minimal: ['none', 'none', 'grid'],
      'high-contrast': ['grid', 'none', 'grid'],
    };
    if (faceSamples.some((sample) => sample.previews.some((preview) => (
      JSON.stringify([preview.topDisplay, preview.bottomDisplay, preview.centerDisplay])
        !== JSON.stringify(expectedPreviewDisplays[preview.style])
    )))) throw new Error('Settings face preview inherited the selected runtime style');
    const fourColorSuitColors = {
      h: 'rgb(200, 62, 72)', d: 'rgb(50, 111, 181)', c: 'rgb(50, 135, 85)', s: 'rgb(24, 32, 28)',
    };
    const twoColorSuitColors = {
      h: 'rgb(200, 62, 72)', d: 'rgb(200, 62, 72)', c: 'rgb(24, 32, 28)', s: 'rgb(24, 32, 28)',
    };
    for (const sample of faceSamples) {
      const expected = sample.fourColor ? fourColorSuitColors : twoColorSuitColors;
      for (const card of sample.runtimeCards) {
        for (const property of ['topCornerColor', 'centerRankColor', 'centerSuitColor']) {
          if (card[property] !== expected[card.suit]) throw new Error(`Runtime ${sample.style} ${card.suit} ${property}: ${card[property]}`);
        }
      }
      for (const preview of sample.previews) {
        if (preview.color !== expected[preview.suit] || preview.cornerColor !== expected[preview.suit]) {
          throw new Error(`Settings preview ${preview.style} ${preview.suit} has the wrong suit color`);
        }
      }
      for (const card of sample.tableCards) {
        if (card.color !== expected[card.suit]) throw new Error(`SVG table ${card.suit} has the wrong suit color`);
        if (card.overflow !== 'visible' || card.tenAlignments.some((offset) => offset > 0.75)) {
          throw new Error(`SVG table ${card.suit} has unstable bounds or full-ten alignment`);
        }
      }
    }
    if (JSON.stringify(fourColorSequence) !== JSON.stringify(['true', 'true', 'false', 'true'])) {
      throw new Error(`Four-color live sequence failed: ${JSON.stringify(fourColorSequence)}`);
    }
    if (backSamples.some((sample) => !sample.previewMatchesRuntime)) throw new Error('Card-back preview differs from runtime');
    if (diagnostics.rootOverflowX) throw new Error('Global horizontal overflow');
    if (!diagnostics.selectedTenCount || !diagnostics.tableCardCount) {
      throw new Error(`Expected ten and table cards: ${JSON.stringify({ selectedTenCount: diagnostics.selectedTenCount, tableCardCount: diagnostics.tableCardCount })}`);
    }
    process.stdout.write(`${JSON.stringify({ faceSamples, fourColorSequence, backSamples, diagnostics, screenshots, errors: unexpectedErrors }, null, 2)}\n`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
