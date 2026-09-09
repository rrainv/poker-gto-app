// Bounded CPU/asset audit only; excludes browser style/layout/paint/image decode.
import { readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { deriveFeatureSurfaceRoles, PRESENTATION_THEMES } from '../../app/src/application/presentation-theme.mjs';
import { createTrainingLineupPreview } from '../../app/src/ui/training-lineup-preview.mjs';

function measure(work, iterations = 2000) {
  for (let i = 0; i < 200; i++) work(i);
  const samples = Array.from({ length: 7 }, () => {
    const start = performance.now(); for (let i = 0; i < iterations; i++) work(i);
    return (performance.now() - start) / iterations;
  }).sort((a, b) => a - b);
  return Number(samples[3].toFixed(4));
}
const portraitDir = new URL('../../app/src/ui/assets/opponents/', import.meta.url);
const assets = readdirSync(portraitDir).filter(name => name.endsWith('.png')).map(name => {
  const png = readFileSync(new URL(name, portraitDir));
  return { name, bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
});
console.log(JSON.stringify({ node: process.version, scope: 'CPU only; no browser responsiveness claim', medianMillisecondsPerCall: {
  builtInFeatureRoles: measure(i => deriveFeatureSurfaceRoles(PRESENTATION_THEMES[i % 3].preview)),
  customFeatureRoles: measure(() => deriveFeatureSurfaceRoles({ surface: '#808080', accent: '#aa44bb', felt: '#297757' })),
  tenSeatLineup: measure(() => createTrainingLineupPreview({ playerCount: 10, heroPosition: 'BTN' })),
}, portraits: { count: assets.length, compressedBytes: assets.reduce((n, image) => n + image.bytes, 0),
  decodedRgbaBytes: assets.reduce((n, image) => n + image.width * image.height * 4, 0), dimensions: [...new Set(assets.map(image => `${image.width}x${image.height}`))] } }, null, 2));
