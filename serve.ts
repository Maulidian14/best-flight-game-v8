// A tiny static server for Skyhook Courier (Node 22, standard library only).
// Serves game/ so the game plays in desktop Chrome with no build step:
//   node serve.ts [--port 8080]
// Then open http://localhost:8080 and fly.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const port = portArg === -1 ? 8080 : Number(process.argv[portArg + 1]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = resolve(join(root, path === '/' ? 'index.html' : normalize(path).replace(/^(\.\.[/\\])+/, '')));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log('Skyhook Courier at http://localhost:' + port);
});
