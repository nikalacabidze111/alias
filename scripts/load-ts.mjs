// Import a TypeScript module from Node scripts by bundling it with esbuild first.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadTs(entry) {
  const out = join(mkdtempSync(join(tmpdir(), 'alias-ts-')), 'mod.mjs');
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
  return import(pathToFileURL(out).href);
}
