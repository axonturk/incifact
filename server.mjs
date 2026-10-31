import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProduct, compareProducts, lookupBarcodeProduct, VERIFIED_BARCODE_CATALOG } from './src/engine/ruleEngine.mjs';
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
  const pathname = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(
      JSON.stringify(
        {
          status: 'ok',
          version: '1.0.0',
          datasetVersion: '2026.10-omnibus',
          ruleEngineVersion: '3.2.0',
          engineMode: 'node-http'
        },
        null,
        2
      )
    );
    return;
  }

  if (req.method === 'GET' && pathname === '/api/locales') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify({ supportedLanguages: SUPPORTED_LANGUAGES, uiStrings: UI_STRINGS }, null, 2));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/evaluate') {
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

  if (req.method === 'POST' && pathname === '/api/compare') {
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

  if (req.method === 'GET' && pathname === '/api/barcode') {
    const queryStr = (req.url || '').split('?')[1] || '';
    const params = new URLSearchParams(queryStr);
    const barcode = params.get('code') || params.get('barcode') || '';
    const lang = params.get('lang') || 'tr';
    const result = lookupBarcodeProduct({ barcode, lang });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(result, null, 2));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/barcode') {
    readJsonBody(req, res, (payload) => {
      try {
        const result = lookupBarcodeProduct(payload || {});
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
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/assets/')) {
    const safeSubPath = path.normalize(pathname.replace(/^\/assets\//, '')).replace(/^(\.\.[\/\\])+/, '');
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

  // Static ES Modules handler (/src/*) for Dual-Mode Browser & Offline PWA Engine Fallback
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/src/')) {
    const safeSubPath = path.normalize(pathname.replace(/^\/src\//, '')).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, 'src', safeSubPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.mjs': 'application/javascript; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      const contentType = mimeTypes[ext];
      if (contentType) {
        res.writeHead(200, {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600'
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    res.end('Module not found');
    return;
  }

  // Root PWA & Legal static files (/manifest.webmanifest, /sw.js, /privacy.html)
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    (pathname === '/manifest.webmanifest' || pathname === '/sw.js' || pathname === '/privacy.html')
  ) {
    const filePath = path.join(__dirname, 'public', pathname.slice(1));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const contentType =
        pathname === '/manifest.webmanifest'
          ? 'application/manifest+json; charset=utf-8'
          : pathname === '/sw.js'
          ? 'application/javascript; charset=utf-8'
          : 'text/html; charset=utf-8';
      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
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
