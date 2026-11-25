import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { publicFiles, publicDirectories } from './public-files.mjs';
import { createLocalFashn } from './backend/fashn-local.mjs';
import { handleTryOn, route } from './backend/try-on.mjs';

const port = Number(process.env.PORT || 3456);
const fashn = createLocalFashn();
process.on('exit', () => fashn.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit());
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.task': 'application/octet-stream',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === route || url.pathname.startsWith(route + '/')) {
      const host = req.headers.host || 'localhost';
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
        res.writeHead(403).end();
        return;
      }
      if (!['GET', 'POST'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, POST' }).end();
        return;
      }
      const options = { method: req.method, headers: req.headers };
      if (req.method === 'POST') Object.assign(options, { body: Readable.toWeb(req), duplex: 'half' });
      const response = await handleTryOn(new Request('http://' + host + url.pathname, options), fashn);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const segments = relative.split('/');
    const type = mime[extname(relative)];
    const allowed = type && segments.every(segment => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(segment))
      && (publicFiles.includes(relative) || publicDirectories.includes(segments[0]));
    if (!allowed) {
      res.writeHead(404).end();
      return;
    }
    const file = new URL(relative, import.meta.url);
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(file), res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error instanceof URIError || error.code === 'ERR_INVALID_URL'
      ? 400 : error.code === 'ENOENT' ? 404 : 500).end();
    else res.destroy();
  }
}).listen(port, '127.0.0.1', () => console.log('Universe AR · http://localhost:' + port));
