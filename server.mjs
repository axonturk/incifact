import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  DATASET_VERSION,
  RULE_ENGINE_VERSION,
  evaluateProduct,
  compareProducts,
  lookupBarcodeProduct,
  evaluateHouseholdProfiles,
  evaluateRoutineShelf,
  getIngredientDossier,
  findCleanerAlternativesAndDupes
} from './src/engine/ruleEngine.mjs';
import { SUPPORTED_LANGUAGES, UI_STRINGS } from './src/i18n/locales.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 3456;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 64 * 1024; // 64 KB protection against DoS
const MAX_JSON_DEPTH = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Math.max(10, Number(process.env.RATE_LIMIT_MAX || 600));
const MAX_TRACKED_IPS = 1000;
const COMPRESS_MIN_BYTES = 1024;
const ipRequestTimestamps = new Map();

function checkRateLimit(req) {
  const ip = req.socket?.remoteAddress || 'local';
  const now = Date.now();
  const prev = ipRequestTimestamps.get(ip);
  const recent = prev ? prev.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS) : [];
  const allowed = recent.length < RATE_LIMIT_MAX;
  if (allowed) {
    recent.push(now);
  }

  // Refresh LRU recency by deleting before re-inserting
  if (ipRequestTimestamps.has(ip)) {
    ipRequestTimestamps.delete(ip);
  } else if (ipRequestTimestamps.size >= MAX_TRACKED_IPS) {
    // Pass 1: TTL sweep of expired IP buckets
    for (const [trackedIp, stamps] of ipRequestTimestamps.entries()) {
      if (!stamps || stamps.length === 0 || now - stamps[stamps.length - 1] >= RATE_LIMIT_WINDOW_MS) {
        ipRequestTimestamps.delete(trackedIp);
      }
    }
    // Pass 2: Bounded LRU eviction of oldest key only (never wipe active buckets via .clear())
    while (ipRequestTimestamps.size >= MAX_TRACKED_IPS) {
      const oldestKey = ipRequestTimestamps.keys().next().value;
      if (oldestKey === undefined) break;
      ipRequestTimestamps.delete(oldestKey);
    }
  }
  ipRequestTimestamps.set(ip, recent);
  return allowed;
}

function getJsonDepth(val, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (val && typeof val === 'object') {
    const children = Array.isArray(val) ? val : Object.values(val);
    let maxD = depth;
    for (let i = 0; i < children.length; i++) {
      const cd = getJsonDepth(children[i], depth + 1);
      if (cd > maxD) maxD = cd;
      if (maxD > MAX_JSON_DEPTH) return maxD;
    }
    return maxD;
  }
  return depth;
}

const BASE_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
});

const CSP_PROFILES = Object.freeze({
  html: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  sw: "default-src 'self'; connect-src 'self'",
  svg: "default-src 'none'; sandbox; frame-ancestors 'none'",
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

const COMPRESSIBLE_CT_RE = /^(?:application\/(?:javascript|json|manifest\+json)|text\/(?:html|css|plain)|image\/svg\+xml)/i;

function negotiateEncoding(req) {
  const accept = String((req && req.headers && req.headers['accept-encoding']) || '').toLowerCase();
  if (!accept) return null;
  let brQ = -1;
  let gzipQ = -1;
  let starQ = -1;
  for (const part of accept.split(',')) {
    const segs = part.split(';').map((s) => s.trim()).filter(Boolean);
    if (segs.length === 0) continue;
    const cod = segs[0];
    let q = 1;
    for (let i = 1; i < segs.length; i++) {
      const qm = segs[i].match(/^q\s*=\s*([0-9.]+)$/);
      if (qm) {
        const parsed = Number(qm[1]);
        q = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
      }
    }
    if (cod === 'br') brQ = Math.max(brQ, q);
    else if (cod === 'gzip') gzipQ = Math.max(gzipQ, q);
    else if (cod === '*') starQ = Math.max(starQ, q);
  }
  const effBr = brQ >= 0 ? brQ : starQ;
  const effGz = gzipQ >= 0 ? gzipQ : starQ;
  if (effBr > 0 && effBr >= effGz) return 'br';
  if (effGz > 0) return 'gzip';
  return null;
}

function matchesIfNoneMatch(headerVal, etag) {
  const raw = String(headerVal || '').trim();
  if (!raw || !etag) return false;
  if (raw === '*') return true;
  const stripWeak = (t) => t.trim().replace(/^W\//i, '');
  const target = stripWeak(etag);
  return raw.split(',').some((tok) => stripWeak(tok) === target);
}

function buildSecurityHeaders(cspProfile = 'api', extra = {}) {
  return {
    ...BASE_SECURITY_HEADERS,
    'Content-Security-Policy': CSP_PROFILES[cspProfile] || CSP_PROFILES.api,
    ...extra
  };
}

function compressBuffer(buf, encoding) {
  if (encoding === 'br') {
    return zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
    });
  }
  if (encoding === 'gzip') {
    return zlib.gzipSync(buf, { level: 6 });
  }
  return buf;
}

function sendJson(res, statusCode, data, req = null) {
  if (res.headersSent) return;
  const rawBuf = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  const encoding = rawBuf.byteLength > COMPRESS_MIN_BYTES ? negotiateEncoding(req) : null;
  const extra = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Accept-Encoding'
  };
  let bodyBuf = rawBuf;
  if (encoding) {
    bodyBuf = compressBuffer(rawBuf, encoding);
    extra['Content-Encoding'] = encoding;
  }
  extra['Content-Length'] = String(bodyBuf.byteLength);
  res.writeHead(statusCode, buildSecurityHeaders('api', extra));
  res.end(bodyBuf);
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
  if (decoded.includes('\0') || decoded.includes(':')) {
    return { ok: false, status: 400, error: 'Invalid characters in path' };
  }
  if (
    decoded.startsWith('/') ||
    decoded.startsWith('\\') ||
    /^[A-Za-z]:/.test(decoded) ||
    path.isAbsolute(decoded) ||
    /[.\s]$/.test(decoded)
  ) {
    return { ok: false, status: 400, error: 'Invalid path format' };
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, decoded);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return { ok: false, status: 400, error: 'Path traversal is not allowed' };
  }

  const relPosix = path.relative(resolvedBase, resolvedTarget).split(path.sep).join('/');
  return { ok: true, resolvedPath: resolvedTarget, relPosix };
}

async function streamStaticFile(req, res, baseDir, filePath, headers, notFoundMessage) {
  let stat;
  let realBase;
  let realTarget;
  try {
    [realBase, realTarget] = await Promise.all([
      fs.promises.realpath(baseDir),
      fs.promises.realpath(filePath)
    ]);
    if (!realTarget.startsWith(realBase + path.sep)) {
      sendText(res, 403, 'Forbidden', 'api');
      return;
    }
    stat = await fs.promises.stat(realTarget);
  } catch {
    sendText(res, 404, notFoundMessage, 'api');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, notFoundMessage, 'api');
    return;
  }

  const contentType = String(headers['Content-Type'] || '');
  const isCompressible = stat.size > COMPRESS_MIN_BYTES && COMPRESSIBLE_CT_RE.test(contentType);
  const encoding = isCompressible ? negotiateEncoding(req) : null;
  const outHeaders = isCompressible
    ? { ...headers, Vary: 'Accept-Encoding', ...(encoding ? { 'Content-Encoding': encoding } : {}) }
    : headers;

  if (req.method === 'HEAD') {
    res.writeHead(200, outHeaders);
    res.end();
    return;
  }

  const stream = fs.createReadStream(realTarget);
  const encoder =
    encoding === 'br'
      ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
      : encoding === 'gzip'
      ? zlib.createGzip({ level: 6 })
      : null;

  stream.on('open', () => {
    if (!res.headersSent) {
      res.writeHead(200, outHeaders);
    }
    if (encoder) {
      stream.pipe(encoder).pipe(res);
    } else {
      stream.pipe(res);
    }
  });
  const onErr = () => {
    if (!res.headersSent) {
      sendText(res, 500, 'Internal Server Error', 'api');
    } else {
      res.destroy();
    }
  };
  stream.on('error', onErr);
  if (encoder) encoder.on('error', onErr);
  res.on('close', () => {
    if (!stream.destroyed) stream.destroy();
    if (encoder && !encoder.destroyed) encoder.destroy();
  });
}

// In-memory mtime + ETag cache for public/index.html (eliminates redundant disk reads & re-compression)
let indexHtmlCache = {
  mtimeMs: -1,
  size: -1,
  etag: '',
  rawBuf: null,
  brBuf: null,
  gzBuf: null
};

async function getCachedIndexHtml(htmlPath) {
  const stat = await fs.promises.stat(htmlPath);
  if (indexHtmlCache.rawBuf && indexHtmlCache.mtimeMs === stat.mtimeMs && indexHtmlCache.size === stat.size) {
    return indexHtmlCache;
  }
  const rawBuf = await fs.promises.readFile(htmlPath);
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  indexHtmlCache = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    etag,
    rawBuf,
    brBuf: null,
    gzBuf: null
  };
  return indexHtmlCache;
}

function readJsonBody(req, res, callback) {
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    sendJson(res, 403, { error: 'Cross-site request blocked' }, req);
    return;
  }
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('application/json')) {
    sendJson(res, 415, { error: 'Content-Type must be application/json' }, req);
    return;
  }
  const declaredLen = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
    res.setHeader('Connection', 'close');
    sendJson(res, 413, { error: 'Payload Too Large: maximum allowed body size is 64KB' }, req);
    res.once('finish', () => {
      if (!req.destroyed) req.destroy();
    });
    return;
  }

  const chunks = [];
  let totalBytes = 0;
  let finished = false;

  req.on('error', () => {
    if (finished) return;
    finished = true;
    sendJson(res, 400, { error: 'Request stream error' }, req);
  });

  req.on('data', (chunk) => {
    if (finished) return;
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      finished = true;
      chunks.length = 0;
      res.setHeader('Connection', 'close');
      sendJson(res, 413, { error: 'Payload Too Large: maximum allowed body size is 64KB' }, req);
      res.once('finish', () => {
        if (!req.destroyed) req.destroy();
      });
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
        sendJson(res, 400, { error: 'Request body must not be empty' }, req);
        return;
      }
      const parsed = JSON.parse(rawStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        sendJson(res, 400, { error: 'Request body must be a valid JSON object' }, req);
        return;
      }
      if (getJsonDepth(parsed) > MAX_JSON_DEPTH) {
        sendJson(res, 400, { error: 'JSON nesting depth exceeds limit' }, req);
        return;
      }
      callback(parsed);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON payload' }, req);
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

    if (pathname.startsWith('/api/') && !checkRateLimit(req)) {
      sendJson(res, 429, { error: 'Too Many Requests' }, req);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(
        res,
        200,
        {
          status: 'ok',
          version: '1.2.1',
          datasetVersion: DATASET_VERSION,
          ruleEngineVersion: RULE_ENGINE_VERSION,
          engineMode: 'node-http',
          endpoints: [
            '/api/health',
            '/api/locales',
            '/api/evaluate',
            '/api/compare',
            '/api/barcode',
            '/api/household',
            '/api/shelf',
            '/api/dossier',
            '/api/alternatives'
          ]
        },
        req
      );
      return;
    }

    if (req.method === 'GET' && pathname === '/api/locales') {
      sendJson(res, 200, { supportedLanguages: SUPPORTED_LANGUAGES, uiStrings: UI_STRINGS }, req);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/evaluate') {
      readJsonBody(req, res, (payload) => {
        try {
          if (payload && payload.type && !payload.productType) {
            payload.productType = payload.type;
          }
          const result = evaluateProduct(payload);
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('evaluate error:', err);
          sendJson(res, 400, { error: 'Invalid evaluation request' }, req);
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/compare') {
      readJsonBody(req, res, (payload) => {
        try {
          const { productA, productB, sharedOptions } = payload;
          if (!productA || !productB) {
            sendJson(res, 400, { error: 'Both productA and productB are required for comparison' }, req);
            return;
          }
          const result = compareProducts(productA, productB, sharedOptions);
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('compare error:', err);
          sendJson(res, 400, { error: 'Invalid comparison request' }, req);
        }
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/barcode') {
      const params = new URLSearchParams(queryStr);
      const barcode = params.get('code') || params.get('barcode') || '';
      const lang = params.get('lang') || 'tr';
      const result = lookupBarcodeProduct({ barcode, lang });
      sendJson(res, 200, result, req);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/barcode') {
      readJsonBody(req, res, (payload) => {
        try {
          const result = lookupBarcodeProduct(payload || {});
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('barcode error:', err);
          sendJson(res, 400, { error: 'Invalid barcode request' }, req);
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/household') {
      readJsonBody(req, res, (payload) => {
        try {
          const productInput =
            payload && payload.product && typeof payload.product === 'object'
              ? payload.product
              : payload && typeof payload.rawText === 'string'
              ? payload
              : null;
          if (!productInput || typeof productInput.rawText !== 'string' || !Array.isArray(payload.members)) {
            sendJson(res, 400, { error: 'Both product/rawText and members array are required' }, req);
            return;
          }
          const result = evaluateHouseholdProfiles(productInput, payload.members);
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('household error:', err);
          sendJson(res, 400, { error: 'Invalid household request' }, req);
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/shelf') {
      readJsonBody(req, res, (payload) => {
        try {
          if (!payload || !Array.isArray(payload.items)) {
            sendJson(res, 400, { error: 'items array is required for shelf analysis' }, req);
            return;
          }
          const result = evaluateRoutineShelf(payload.items, payload.options || {});
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('shelf error:', err);
          sendJson(res, 400, { error: 'Invalid shelf request' }, req);
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/dossier') {
      readJsonBody(req, res, (payload) => {
        try {
          const query =
            typeof payload?.query === 'string'
              ? payload.query.trim()
              : typeof payload?.token === 'string'
              ? payload.token.trim()
              : '';
          if (!query) {
            sendJson(res, 400, { error: 'Non-empty query (or token) string is required' }, req);
            return;
          }
          const result = getIngredientDossier(query, payload.options || {});
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('dossier error:', err);
          sendJson(res, 400, { error: 'Invalid dossier request' }, req);
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/alternatives') {
      readJsonBody(req, res, (payload) => {
        try {
          const productInput =
            payload && payload.product && typeof payload.product === 'object'
              ? payload.product
              : payload && typeof payload.rawText === 'string'
              ? payload
              : null;
          if (!productInput || typeof productInput.rawText !== 'string') {
            sendJson(res, 400, { error: 'product or rawText string is required' }, req);
            return;
          }
          const result = findCleanerAlternativesAndDupes(productInput, payload.options || {});
          sendJson(res, 200, result, req);
        } catch (err) {
          console.error('alternatives error:', err);
          sendJson(res, 400, { error: 'Invalid alternatives request' }, req);
        }
      });
      return;
    }

    // Static Assets handler (public/assets/*)
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/assets/')) {
      const assetsBase = path.join(__dirname, 'public', 'assets');
      const resolved = safeResolveSubpath(assetsBase, pathname.slice('/assets/'.length));
      if (!resolved.ok) {
        sendText(res, resolved.status, resolved.error, 'api');
        return;
      }
      const ext = path.extname(resolved.resolvedPath).toLowerCase();
      const contentType = ASSET_MIME_TYPES[ext] || 'application/octet-stream';
      const assetCsp = ext === '.svg' ? 'svg' : 'api';
      await streamStaticFile(
        req,
        res,
        assetsBase,
        resolved.resolvedPath,
        buildSecurityHeaders(assetCsp, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        }),
        'Asset not found'
      );
      return;
    }

    // Static ES Modules handler (/src/*) — strictly allowlist engine, i18n and generated .mjs data modules
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/src/')) {
      const srcBase = path.join(__dirname, 'src');
      const resolved = safeResolveSubpath(srcBase, pathname.slice('/src/'.length));
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
        srcBase,
        resolved.resolvedPath,
        buildSecurityHeaders('api', {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache'
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
      const publicBase = path.join(__dirname, 'public');
      const filePath = path.join(publicBase, pathname.slice(1));
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
        publicBase,
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
      const cached = await getCachedIndexHtml(htmlPath);
      const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
      const baseHtmlHeaders = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        ETag: cached.etag,
        Vary: 'Accept-Encoding'
      };
      if (matchesIfNoneMatch(ifNoneMatch, cached.etag)) {
        res.writeHead(304, buildSecurityHeaders('html', baseHtmlHeaders));
        res.end();
        return;
      }
      const encoding = cached.rawBuf.byteLength > COMPRESS_MIN_BYTES ? negotiateEncoding(req) : null;
      let outBuf = cached.rawBuf;
      if (encoding === 'br') {
        if (!cached.brBuf) cached.brBuf = compressBuffer(cached.rawBuf, 'br');
        outBuf = cached.brBuf;
      } else if (encoding === 'gzip') {
        if (!cached.gzBuf) cached.gzBuf = compressBuffer(cached.rawBuf, 'gzip');
        outBuf = cached.gzBuf;
      }
      res.writeHead(
        200,
        buildSecurityHeaders('html', {
          ...baseHtmlHeaders,
          ...(encoding ? { 'Content-Encoding': encoding } : {}),
          'Content-Length': String(outBuf.byteLength)
        })
      );
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(outBuf);
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

server.maxConnections = 100;
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;

let shuttingDown = false;
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const actualPort = addr && typeof addr === 'object' ? addr.port : PORT;
  console.log(`🚀 InciFact 5-Screen 10-Language Simulator running at http://localhost:${actualPort}`);
});
