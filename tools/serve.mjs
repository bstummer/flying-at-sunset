// A local web server for working on the piece: the sources run as they are (ES modules, no build
// step: edit, then reload), the built page next to them.
//
//   node tools/serve.mjs [port]      http://localhost:8000/src/  the sources
//                                    http://localhost:8000/      the built index.html
// (ES modules do not load from file://, hence the server. Only this machine can connect.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/plain' };

export function serve(port = 8000, root = ROOT) {
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, { 'content-type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = parseInt(process.argv[2] || '8000', 10);
  serve(port).then(() => console.log(`http://localhost:${port}/src/   the sources (edit, reload)\nhttp://localhost:${port}/       the built index.html (node build.mjs)`),
    e => { console.error(e.message); process.exit(1); });
}
