// Build script: bundles the extension into dist/ and the companion page into companion-dist/.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
const companionDist = resolve(root, 'companion-dist');

rmSync(dist, { recursive: true, force: true });
rmSync(companionDist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(companionDist, { recursive: true });

const nodeShims = {
  crypto: resolve(root, 'node_modules/crypto-browserify/index.js'),
  stream: resolve(root, 'node_modules/stream-browserify/index.js'),
  vm: resolve(root, 'node_modules/vm-browserify/index.js'),
  events: resolve(root, 'node_modules/events/events.js'),
  util: resolve(root, 'node_modules/util/util.js'),
  path: resolve(root, 'node_modules/path-browserify/index.js'),
};

// Inject file that provides Buffer and process globals.
const injectFile = resolve(root, 'build-inject.js');
writeFileSync(
  injectFile,
  `import { Buffer as __B } from 'buffer';\nimport __p from 'process';\nexport { __B as Buffer, __p as process };\n`,
);

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  minify: false,
  sourcemap: false,
  platform: 'browser',
  target: ['chrome120'],
  logLevel: 'warning',
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
  },
  alias: nodeShims,
  inject: [injectFile],
  loader: { '.woff2': 'file' },
  legalComments: 'none',
};

async function run() {
  // Background service worker (ES module).
  await build({
    ...common,
    entryPoints: [resolve(root, 'src/background/index.ts')],
    outfile: resolve(dist, 'background.js'),
    format: 'esm',
  });

  // Content scripts must be classic scripts.
  await build({
    ...common,
    entryPoints: [resolve(root, 'src/content/relay.ts')],
    outfile: resolve(dist, 'content/relay.js'),
    format: 'iife',
  });
  await build({
    ...common,
    entryPoints: [resolve(root, 'src/content/inpage.ts')],
    outfile: resolve(dist, 'content/inpage.js'),
    format: 'iife',
  });

  // Extension pages.
  for (const page of ['popup', 'ops', 'manager']) {
    await build({
      ...common,
      entryPoints: [resolve(root, `src/${page}/${page}.ts`)],
      outdir: resolve(dist, page),
      format: 'iife',
      assetNames: 'assets/[name]',
    });
    cpSync(resolve(root, `src/${page}/${page}.html`), resolve(dist, `${page}/${page}.html`));
    const css = resolve(root, `src/${page}/${page}.css`);
    if (existsSync(css)) cpSync(css, resolve(dist, `${page}/${page}.css`));
  }

  // Shared theme + fonts.
  cpSync(resolve(root, 'src/theme.css'), resolve(dist, 'theme.css'));
  mkdirSync(resolve(dist, 'fonts'), { recursive: true });
  for (const weight of [400, 600, 800]) {
    cpSync(
      resolve(root, `node_modules/@fontsource/nunito/files/nunito-latin-${weight}-normal.woff2`),
      resolve(dist, `fonts/nunito-${weight}.woff2`),
    );
  }

  // Manifest and icons.
  cpSync(resolve(root, 'src/manifest.json'), resolve(dist, 'manifest.json'));
  mkdirSync(resolve(dist, 'assets'), { recursive: true });
  for (const size of [16, 48, 128]) {
    cpSync(resolve(root, `src/assets/icon${size}.png`), resolve(dist, `assets/icon${size}.png`));
  }

  // Privacy Cash circuit files, with integrity hashes verified at runtime.
  mkdirSync(resolve(dist, 'circuits'), { recursive: true });
  const circuitManifest = {};
  for (const name of ['transaction2.wasm', 'transaction2.zkey']) {
    const src = resolve(root, `node_modules/privacycash/circuit2/${name}`);
    const bytes = readFileSync(src);
    circuitManifest[name] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    cpSync(src, resolve(dist, `circuits/${name}`));
  }
  writeFileSync(resolve(dist, 'circuits/manifest.json'), JSON.stringify(circuitManifest, null, 2));

  // Companion page (plain website; contains no secrets and no SDK).
  await build({
    ...common,
    entryPoints: [resolve(root, 'companion/companion.ts')],
    outfile: resolve(companionDist, 'companion.js'),
    format: 'iife',
  });
  cpSync(resolve(root, 'companion/index.html'), resolve(companionDist, 'index.html'));
  cpSync(resolve(root, 'src/theme.css'), resolve(companionDist, 'theme.css'));
  mkdirSync(resolve(companionDist, 'fonts'), { recursive: true });
  for (const weight of [400, 600, 800]) {
    cpSync(
      resolve(root, `node_modules/@fontsource/nunito/files/nunito-latin-${weight}-normal.woff2`),
      resolve(companionDist, `fonts/nunito-${weight}.woff2`),
    );
  }

  rmSync(injectFile, { force: true });
  console.log('Built dist/ (extension) and companion-dist/ (funding page).');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
