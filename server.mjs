import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProduct, compareProducts } from './src/engine/ruleEngine.mjs';
import { SUPPORTED_LANGUAGES, UI_STRINGS } from './src/i18n/locales.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3456;
const MAX_BODY_BYTES = 64 * 1024; // 64 KB protection against DoS

function readJsonBody(req, res, callback) {
  const chunks = [];
  let totalBytes = 0;
  let exceeded = false;

  req.on('data', (chunk) => {
    if (exceeded) return;
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      exceeded = true;
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({ error: 'Payload Too Large: maximum allowed body size is 64KB' }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (exceeded) return;
    try {
      const rawStr = Buffer.concat(chunks).toString('utf8');
      if (!rawStr.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ error: 'Request body must not be empty' }));
        return;
      }
      const parsed = JSON.parse(rawStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ error: 'Request body must be a valid JSON object' }));
        return;
      }
      callback(parsed);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({ error: `Invalid JSON syntax: ${err.message}` }));
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/locales') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify({ supportedLanguages: SUPPORTED_LANGUAGES, uiStrings: UI_STRINGS }, null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/evaluate') {
    readJsonBody(req, res, (payload) => {
      try {
        if (payload && payload.type && !payload.productType) {
          payload.productType = payload.type;
        }
        const result = evaluateProduct(payload);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/compare') {
    readJsonBody(req, res, (payload) => {
      try {
        const { productA, productB, sharedOptions } = payload;
        if (!productA || !productB) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff'
          });
          res.end(JSON.stringify({ error: 'Both productA and productB are required for comparison' }));
          return;
        }
        const result = compareProducts(productA, productB, sharedOptions);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static Assets handler (public/assets/*)
  if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/assets/')) {
    const rawUrlPath = req.url.split('?')[0];
    const safeSubPath = path.normalize(rawUrlPath.replace(/^\/assets\//, '')).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, 'public/assets', safeSubPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('Asset not found');
      return;
    }
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 InciFact 5-Screen 10-Language Simulator running at http://localhost:${PORT}`);
});
