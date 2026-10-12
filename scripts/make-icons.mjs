// Renders the toolbar/extension icons. Small sizes use the small-size mark
// (heavier A, mask slit); 48 px and up use the full mark.
import { chromium } from 'playwright';
import { loadTs } from './load-ts.mjs';
const { markSvg, smallMarkSvg } = await loadTs(new URL('../src/shared/brand.ts', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const outputs = [
  [16, smallMarkSvg(16)], [24, smallMarkSvg(24)], [32, smallMarkSvg(32)],
  [48, markSvg(48)], [128, markSvg(128)], [1024, markSvg(1024)],
];
for (const [size, svg] of outputs) {
  const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await p.screenshot({ path: size === 1024 ? 'brand/alias-logo-final.png' : `src/assets/icon${size}.png`, omitBackground: true });
  await p.close();
}
await b.close();
console.log('icons written');
