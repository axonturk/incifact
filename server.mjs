import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProduct, compareProducts, lookupBarcodeProduct } from './src/engine/ruleEngine.mjs';
import { SUPPORTED_LANGUAGES, UI_STRINGS } from './src/i18n/locales.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 3456;
const MAX_BODY_BYTES = 64 * 1024; // 64 KB protection against DoS

const BASE_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
});

const CSP_PROFILES = Object.freeze({
  html: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  sw: "default-src 'self'; connect-src 'self'",
  api: "default-src 'none'; frame-ancestors 'none'"
});

const ALLOWED_SRC_PATTERN = /^src\/(engine|i18n|data\/generated)\/[^/]+\.mjs$/;

const ASSET_MIME_TYPES = Object.freeze({
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
});

function buildSecurityHeaders(cspProfile = 'api', extra = {}) {
  return {
    ...BASE_SECURITY_HEADERS,
    'Content-Security-Policy': CSP_PROFILES[cspProfile] || CSP_PROFILES.api,
    ...extra
  };
}

function sendJson(res, statusCode, data) {
  if (res.headersSent) return;
  res.writeHead(statusCode, buildSecurityHeaders('api', { 'Content-Type': 'application/json; charset=utf-8' }));
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, message, cspProfile = 'api') {
  if (res.headersSent) return;
  res.writeHead(statusCode, buildSecurityHeaders(cspProfile, { 'Content-Type': 'text/plain; charset=utf-8' }));
  res.end(message);
}

function safeResolveSubpath(baseDir, rawRest) {
  if (typeof rawRest !== 'string') {
    return { ok: false, status: 400, error: 'Invalid path' };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(rawRest);
  } catch {
    return { ok: false, status: 400, error: 'Malformed URI encoding' };
  }
  if (decoded === '') {
    return { ok: false, status: 404, error: 'Not found' };
  }
  if (decoded.includes('\0')) {
    return { ok: false, status: 400, error: 'Invalid null byte in path' };
  }
  if (
    decoded.startsWith('/') ||
    decoded.startsWith('\\') ||
    /^[A-Za-z]:/.test(decoded) ||
    path.isAbsolute(decoded)
  ) {
    return { ok: false, status: 400, error: 'Absolute paths are not allowed' };
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, decoded);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return { ok: false, status: 400, error: 'Path traversal is not allowed' };
  }

  const relPosix = path.relative(resolvedBase, resolvedTarget).split(path.sep).join('/');
  return { ok: true, resolvedPath: resolvedTarget, relPosix };
}

async function streamStaticFile(req, res, filePath, headers, notFoundMessage) {
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    sendText(res, 404, notFoundMessage, 'api');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, notFoundMessage, 'api');
    return;
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    if (!res.headersSent) {
      res.writeHead(200, headers);
    }
    stream.pipe(res);
  });
  stream.on('error', () => {
    if (!res.headersSent) {
      sendText(res, 500, 'Internal Server Error', 'api');
    } else {
      res.destroy();
    }
  });
  res.on('close', () => {
    if (!stream.destroyed) {
      stream.destroy();
    }
  });
}

function readJsonBody(req, res, callback) {
  const chunks = [];
  let totalBytes = 0;
  let finished = false;

  req.on('error', () => {
    if (finished) return;
    finished = true;
    sendJson(res, 400, { error: 'Request stream error' });
  });

  req.on('data', (chunk) => {
    if (finished) return;
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      finished = true;
      sendJson(res, 413, { error: 'Payload Too Large: maximum allowed body size is 64KB' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (finished) return;
    finished = true;
    try {
      const rawStr = Buffer.concat(chunks).toString('utf8');
      if (!rawStr.trim()) {
        sendJson(res, 400, { error: 'Request body must not be empty' });
        return;
      }
      const parsed = JSON.parse(rawStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        sendJson(res, 400, { error: 'Request body must be a valid JSON object' });
        return;
      }
      callback(parsed);
    } catch (err) {
      sendJson(res, 400, { error: `Invalid JSON syntax: ${err.message}` });
    }
  });
}

const server = http.createServer(async (req, res) => {
  req.on('error', () => {
    if (!res.headersSent) {
      sendText(res, 400, 'Bad Request', 'api');
    }
  });
  res.on('error', () => {});

  try {
    const rawUrl = req.url || '/';
    const qIndex = rawUrl.indexOf('?');
    const pathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
    const queryStr = qIndex === -1 ? '' : rawUrl.slice(qIndex + 1);

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        version: '1.0.0',
        datasetVersion: '2026.10-omnibus',
        ruleEngineVersion: '3.2.0',
        engineMode: 'node-http'
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/locales') {
      sendJson(res, 200, { supportedLanguages: SUPPORTED_LANGUAGES, uiStrings: UI_STRINGS });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/evaluate') {
      readJsonBody(req, res, (payload) => {
        try {
          if (payload && payload.type && !payload.productType) {
            payload.productType = payload.type;
          }
          const result = evaluateProduct(payload);
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/compare') {
      readJsonBody(req, res, (payload) => {
        try {
          const { productA, productB, sharedOptions } = payload;
          if (!productA || !productB) {
            sendJson(res, 400, { error: 'Both productA and productB are required for comparison' });
            return;
          }
          const result = compareProducts(productA, productB, sharedOptions);
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
        }
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/barcode') {
      const params = new URLSearchParams(queryStr);
      const barcode = params.get('code') || params.get('barcode') || '';
      const lang = params.get('lang') || 'tr';
      const result = lookupBarcodeProduct({ barcode, lang });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/barcode') {
      readJsonBody(req, res, (payload) => {
        try {
          const result = lookupBarcodeProduct(payload || {});
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
        }
      });
      return;
    }

    // Static Assets handler (public/assets/*)
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/assets/')) {
      const resolved = safeResolveSubpath(path.join(__dirname, 'public', 'assets'), pathname.slice('/assets/'.length));
      if (!resolved.ok) {
        sendText(res, resolved.status, resolved.error, 'api');
        return;
      }
      const ext = path.extname(resolved.resolvedPath).toLowerCase();
      const contentType = ASSET_MIME_TYPES[ext] || 'application/octet-stream';
      await streamStaticFile(
        req,
        res,
        resolved.resolvedPath,
        buildSecurityHeaders('api', {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        }),
        'Asset not found'
      );
      return;
    }

    // Static ES Modules handler (/src/*) — strictly allowlist engine, i18n and generated .mjs data modules
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/src/')) {
      const resolved = safeResolveSubpath(path.join(__dirname, 'src'), pathname.slice('/src/'.length));
      if (!resolved.ok) {
        sendText(res, resolved.status, resolved.error, 'api');
        return;
      }
      const normalizedSrcPath = `src/${resolved.relPosix}`;
      if (!ALLOWED_SRC_PATTERN.test(normalizedSrcPath)) {
        sendText(res, 404, 'Module not found', 'api');
        return;
      }
      await streamStaticFile(
        req,
        res,
        resolved.resolvedPath,
        buildSecurityHeaders('api', {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }),
        'Module not found'
      );
      return;
    }

    // Root PWA & Legal static files (/manifest.webmanifest, /sw.js, /privacy.html)
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      (pathname === '/manifest.webmanifest' || pathname === '/sw.js' || pathname === '/privacy.html')
    ) {
      const filePath = path.join(__dirname, 'public', pathname.slice(1));
      const contentType =
        pathname === '/manifest.webmanifest'
          ? 'application/manifest+json; charset=utf-8'
          : pathname === '/sw.js'
          ? 'application/javascript; charset=utf-8'
          : 'text/html; charset=utf-8';
      const cspProfile =
        pathname === '/privacy.html' ? 'html' : pathname === '/sw.js' ? 'sw' : 'api';
      await streamStaticFile(
        req,
        res,
        filePath,
        buildSecurityHeaders(cspProfile, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        }),
        'Not found'
      );
      return;
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      const html = await fs.promises.readFile(htmlPath, 'utf8');
      res.writeHead(
        200,
        buildSecurityHeaders('html', {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        })
      );
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(html);
      return;
    }

    sendText(res, 404, 'Not found', 'api');
  } catch {
    if (!res.headersSent) {
      sendText(res, 500, 'Internal Server Error', 'api');
    } else {
      res.destroy();
    }
  }
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;

server.listen(PORT, () => {
  const addr = server.address();
  const actualPort = addr && typeof addr === 'object' ? addr.port : PORT;
  console.log(`🚀 InciFact 5-Screen 10-Language Simulator running at http://localhost:${actualPort}`);
});
