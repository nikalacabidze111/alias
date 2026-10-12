// Serves the built funding page on http://localhost:8765 (the extension's
// default funding page URL). Run `node build.mjs` first.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../companion-dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };

if (!existsSync(join(dir, 'index.html'))) {
  console.error('companion-dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = join(dir, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!p.startsWith(dir) || !existsSync(p)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(8765, () => {
  console.log('Alias funding page: http://localhost:8765 (keep this running while funding)');
});
