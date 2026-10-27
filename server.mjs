import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root = resolve('public');
const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml'};
http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/time') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    const unixMs = Date.now();
    return res.end(JSON.stringify({unixMs,iso:new Date(unixMs).toISOString(),source:'Local preview server clock'}));
  }
  const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
  if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) {res.writeHead(403); return res.end();}
  try {const data = await readFile(file); res.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream'});res.end(data);}
  catch {res.writeHead(404);res.end('Not found');}
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
