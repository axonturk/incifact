import http from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DATASET_VERSION, RULE_ENGINE_VERSION } from '../src/engine/ruleEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('--- Testing server.mjs ---');

const serverProc = spawn('node', ['server.mjs'], {
  cwd: ROOT_DIR,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderrBuf = '';
serverProc.stderr.on('data', (d) => {
  stderrBuf += d.toString();
  console.error('SERVER ERR:', d.toString().trim());
});

const baseUrl = await new Promise((resolve, reject) => {
  let stdoutBuf = '';
  const timer = setTimeout(() => {
    reject(new Error(`Server failed to bind within 5s. stderr=${stderrBuf}`));
  }, 5000);

  serverProc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdoutBuf += text;
    process.stdout.write(`SERVER: ${text}`);
    const match = stdoutBuf.match(/http:\/\/localhost:(\d+)/);
    if (match) {
      clearTimeout(timer);
      resolve(`http://localhost:${match[1]}`);
    }
  });

  serverProc.on('exit', (code) => {
    clearTimeout(timer);
    reject(new Error(`Server exited prematurely with code ${code}. stderr=${stderrBuf}`));
  });
});

const port = Number(new URL(baseUrl).port);

function request(method, reqPath, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    let payload = null;
    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: reqPath,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            rawBuffer,
            body: rawBuffer.toString('utf8')
          });
        });
      }
    );

    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

const REQUIRED_BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};

const EXPECTED_HTML_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const EXPECTED_SW_CSP = "default-src 'self'; connect-src 'self'";
const EXPECTED_SVG_CSP = "default-src 'none'; sandbox; frame-ancestors 'none'";
const EXPECTED_API_CSP = "default-src 'none'; frame-ancestors 'none'";

function assertSecurityHeaders(res, expectedCsp, label) {
  for (const [key, val] of Object.entries(REQUIRED_BASE_HEADERS)) {
    assert.equal(res.headers[key], val, `${label}: missing/wrong header ${key}`);
  }
  assert.equal(res.headers['content-security-policy'], expectedCsp, `${label}: wrong CSP`);
}

try {
  // 1. /api/health
  const resHealth = await request('GET', '/api/health');
  assert.equal(resHealth.status, 200);
  assertSecurityHeaders(resHealth, EXPECTED_API_CSP, 'GET /api/health');
  const healthJson = JSON.parse(resHealth.body);
  assert.equal(healthJson.status, 'ok');
  assert.equal(healthJson.engineMode, 'node-http');

  // 2. /api/locales
  const resLoc = await request('GET', '/api/locales');
  assert.equal(resLoc.status, 200);
  assertSecurityHeaders(resLoc, EXPECTED_API_CSP, 'GET /api/locales');
  const locJson = JSON.parse(resLoc.body);
  assert.equal(locJson.supportedLanguages.length, 10);

  // 3. /api/evaluate (valid + invalid JSON)
  const resEval = await request('POST', '/api/evaluate', {
    rawText: 'Aqua, Glycerin, Niacinamide, Lilial, Cetearyl Alcohol',
    productType: 'cosmetic',
    lang: 'tr'
  });
  assert.equal(resEval.status, 200);
  assertSecurityHeaders(resEval, EXPECTED_API_CSP, 'POST /api/evaluate');
  const evalJson = JSON.parse(resEval.body);
  assert.equal(evalJson.cards.regulatoryCard.capApplied, 10);

  const resBadJson = await request('POST', '/api/evaluate', '{bad json');
  assert.equal(resBadJson.status, 400);
  assertSecurityHeaders(resBadJson, EXPECTED_API_CSP, 'POST /api/evaluate invalid JSON');

  // 4. /api/compare
  const resCompare = await request('POST', '/api/compare', {
    productA: { rawText: 'Aqua, Glycerin, Niacinamide', productType: 'cosmetic' },
    productB: { rawText: 'Aqua, Glycerin, Lilial', productType: 'cosmetic' },
    sharedOptions: { lang: 'tr' }
  });
  assert.equal(resCompare.status, 200);
  assertSecurityHeaders(resCompare, EXPECTED_API_CSP, 'POST /api/compare');
  const compareJson = JSON.parse(resCompare.body);
  assert.ok(compareJson.productA && compareJson.productB);

  const resCompareBad = await request('POST', '/api/compare', { productA: { rawText: 'Aqua' } });
  assert.equal(resCompareBad.status, 400);
  assertSecurityHeaders(resCompareBad, EXPECTED_API_CSP, 'POST /api/compare 400');

  // 5. /api/barcode GET + POST
  const resBarcodeGet = await request('GET', '/api/barcode?code=3017620422003&lang=tr');
  assert.equal(resBarcodeGet.status, 200);
  assertSecurityHeaders(resBarcodeGet, EXPECTED_API_CSP, 'GET /api/barcode');
  const barcodeGetJson = JSON.parse(resBarcodeGet.body);
  assert.equal(barcodeGetJson.found, true);
  assert.equal(barcodeGetJson.barcode, '3017620422003');

  const resBarcodePost = await request('POST', '/api/barcode', { barcode: '3017620422003', lang: 'en' });
  assert.equal(resBarcodePost.status, 200);
  assertSecurityHeaders(resBarcodePost, EXPECTED_API_CSP, 'POST /api/barcode');
  const barcodePostJson = JSON.parse(resBarcodePost.body);
  assert.equal(barcodePostJson.found, true);
  assert.equal(barcodePostJson.barcode, '3017620422003');

  // 6. HTML, HEAD, PWA & legal routes
  const resHome = await request('GET', '/');
  assert.equal(resHome.status, 200);
  assertSecurityHeaders(resHome, EXPECTED_HTML_CSP, 'GET /');
  assert.match(resHome.body, /InciFact/);

  const resHead = await request('HEAD', '/');
  assert.equal(resHead.status, 200);
  assertSecurityHeaders(resHead, EXPECTED_HTML_CSP, 'HEAD /');
  assert.equal(resHead.body, '');

  const resPrivacy = await request('GET', '/privacy.html');
  assert.equal(resPrivacy.status, 200);
  assertSecurityHeaders(resPrivacy, EXPECTED_HTML_CSP, 'GET /privacy.html');
  assert.match(resPrivacy.body, /prefers-color-scheme: dark/);
  assert.match(resPrivacy.body, /Open Food Facts/);

  const resManifest = await request('GET', '/manifest.webmanifest');
  assert.equal(resManifest.status, 200);
  assertSecurityHeaders(resManifest, EXPECTED_API_CSP, 'GET /manifest.webmanifest');
  const manifestJson = JSON.parse(resManifest.body);
  assert.equal(manifestJson.short_name, 'InciFact');

  const resSw = await request('GET', '/sw.js');
  assert.equal(resSw.status, 200);
  assertSecurityHeaders(resSw, EXPECTED_SW_CSP, 'GET /sw.js');
  assert.match(resSw.body, /CACHE_NAME/);

  // 7. Allowed /src/* .mjs module & active asset
  const resEngine = await request('GET', '/src/engine/ruleEngine.mjs');
  assert.equal(resEngine.status, 200);
  assertSecurityHeaders(resEngine, EXPECTED_API_CSP, 'GET /src/engine/ruleEngine.mjs');
  assert.match(resEngine.headers['content-type'], /javascript/);

  const resAsset = await request('HEAD', '/assets/hero-shield-crest.jpg');
  assert.equal(resAsset.status, 200);
  assertSecurityHeaders(resAsset, EXPECTED_API_CSP, 'HEAD /assets/hero-shield-crest.jpg');

  const resSvgAsset = await request('HEAD', '/assets/incifact-app-icon.svg');
  assert.equal(resSvgAsset.status, 200);
  assertSecurityHeaders(resSvgAsset, EXPECTED_SVG_CSP, 'HEAD /assets/incifact-app-icon.svg');

  // 8. Blocked /src/* extensions and subdirectories -> 404
  for (const blockedSrc of [
    '/src/data/cosing_ingredients.json',
    '/src/engine/ruleEngine.d.mts',
    '/src/mobile/ScannerApp.tsx',
    '/src/mobile/barcodeService.ts',
    '/src/engine/../data/cosing_ingredients.json'
  ]) {
    const resBlocked = await request('GET', blockedSrc);
    assert.equal(resBlocked.status, 404, `Expected 404 for ${blockedSrc}`);
    assertSecurityHeaders(resBlocked, EXPECTED_API_CSP, `GET ${blockedSrc}`);
  }

  // 9. Traversal, malformed URI, null byte, colon/NTFS ADS & Windows drive rejections -> 400/404
  for (const badPath of [
    '/assets/../../package.json',
    '/assets/%2e%2e%2fpackage.json',
    '/assets/%E0%A4%A',
    '/assets/incifact-app-icon.png%00.jpg',
    '/assets/incifact-app-icon.png:ads',
    '/assets/C:/Windows/win.ini',
    '/assets//etc/passwd',
    '/src/%2e%2e/package.json'
  ]) {
    const resTraversal = await request('GET', badPath);
    assert.ok(resTraversal.status === 400 || resTraversal.status === 404, `Expected 400/404 for ${badPath}, got ${resTraversal.status}`);
    assertSecurityHeaders(resTraversal, EXPECTED_API_CSP, `GET ${badPath}`);
  }

  // 10. 404 unknown route
  const resNotFound = await request('GET', '/does-not-exist');
  assert.equal(resNotFound.status, 404);
  assertSecurityHeaders(resNotFound, EXPECTED_API_CSP, 'GET /does-not-exist');

  // 11. DoS 64KB limit -> 413
  const hugePayload = { rawText: 'A'.repeat(70000) };
  const resHuge = await request('POST', '/api/evaluate', hugePayload);
  assert.equal(resHuge.status, 413);
  assertSecurityHeaders(resHuge, EXPECTED_API_CSP, 'POST /api/evaluate 413');

  // 12. Phase 1 Security Regressions: Content-Type 415, Sec-Fetch-Site 403, Deep JSON 400
  const resBadCt = await request('POST', '/api/evaluate', JSON.stringify({ rawText: 'Aqua' }), { 'Content-Type': 'text/plain' });
  assert.equal(resBadCt.status, 415);
  assertSecurityHeaders(resBadCt, EXPECTED_API_CSP, 'POST /api/evaluate text/plain 415');

  const resCrossSite = await request('POST', '/api/evaluate', { rawText: 'Aqua' }, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(resCrossSite.status, 403);
  assertSecurityHeaders(resCrossSite, EXPECTED_API_CSP, 'POST /api/evaluate cross-site 403');

  let deepObj = { rawText: 'Aqua' };
  for (let i = 0; i < 16; i++) deepObj = { nested: deepObj };
  const resDeepJson = await request('POST', '/api/evaluate', deepObj);
  assert.equal(resDeepJson.status, 400);
  assertSecurityHeaders(resDeepJson, EXPECTED_API_CSP, 'POST /api/evaluate deep JSON 400');

  // 13. Phase 4 REST endpoints: /api/household, /api/shelf, /api/dossier, /api/alternatives
  assert.ok(Array.isArray(healthJson.endpoints) && healthJson.endpoints.includes('/api/household'));

  const resHouse = await request('POST', '/api/household', {
    product: { rawText: 'Aqua, Retinol, Methyl Glucose Sesquistearate', productType: 'cosmetic', lang: 'en' },
    members: [
      { id: 'm1', name: 'Me', userProfiles: [] },
      { id: 'm2', name: 'Partner', userProfiles: ['hamilelik'] }
    ]
  });
  assert.equal(resHouse.status, 200);
  assertSecurityHeaders(resHouse, EXPECTED_API_CSP, 'POST /api/household');
  const houseJson = JSON.parse(resHouse.body);
  assert.equal(houseJson.memberCount, 2);
  assert.equal(houseJson.members[1].overallColor, 'kirmizi');

  const resHouseBad = await request('POST', '/api/household', { product: { rawText: 'Aqua' } });
  assert.equal(resHouseBad.status, 400);
  const resHouseCsrf = await request('POST', '/api/household', { rawText: 'Aqua', members: [] }, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(resHouseCsrf.status, 403);

  const resShelf = await request('POST', '/api/shelf', {
    items: [
      { id: 's1', name: 'Vit C', slot: 'AM', productType: 'cosmetic', applicationType: 'leave_on', rawText: 'Aqua, Ascorbic Acid' },
      { id: 's2', name: 'Copper', slot: 'AM', productType: 'cosmetic', applicationType: 'leave_on', rawText: 'Aqua, Copper Tripeptide-1' }
    ],
    options: { lang: 'en' }
  });
  assert.equal(resShelf.status, 200);
  assertSecurityHeaders(resShelf, EXPECTED_API_CSP, 'POST /api/shelf');
  const shelfJson = JSON.parse(resShelf.body);
  assert.ok(Array.isArray(shelfJson.amConflicts) && shelfJson.amConflicts.length >= 1);

  const resShelfBad = await request('POST', '/api/shelf', { items: 'not-array' });
  assert.equal(resShelfBad.status, 400);
  const resShelfCsrf = await request('POST', '/api/shelf', { items: [] }, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(resShelfCsrf.status, 403);

  const resDossier = await request('POST', '/api/dossier', {
    query: 'Niacinamide',
    options: { lang: 'en', productType: 'cosmetic' }
  });
  assert.equal(resDossier.status, 200);
  assertSecurityHeaders(resDossier, EXPECTED_API_CSP, 'POST /api/dossier');
  const dossierJson = JSON.parse(resDossier.body);
  assert.equal(dossierJson.isSuperstar, true);

  const resDossierBad = await request('POST', '/api/dossier', { query: '   ' });
  assert.equal(resDossierBad.status, 400);
  const resDossierCsrf = await request('POST', '/api/dossier', { query: 'Aqua' }, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(resDossierCsrf.status, 403);

  const resAlts = await request('POST', '/api/alternatives', {
    product: { rawText: 'Aqua, Glycerin, Lilial', productType: 'cosmetic', lang: 'en' },
    options: { lang: 'en' }
  });
  assert.equal(resAlts.status, 200);
  assertSecurityHeaders(resAlts, EXPECTED_API_CSP, 'POST /api/alternatives');
  const altsJson = JSON.parse(resAlts.body);
  assert.ok(Array.isArray(altsJson.cleanerAlternatives));

  const resAltsBad = await request('POST', '/api/alternatives', {});
  assert.equal(resAltsBad.status, 400);
  const resAltsCsrf = await request('POST', '/api/alternatives', { rawText: 'Aqua' }, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(resAltsCsrf.status, 403);

  // 14. Phase 6 Boost Server Hardening: Cache-Control no-store, Brotli/Gzip, ETag 304, dynamic version sync
  assert.equal(healthJson.datasetVersion, DATASET_VERSION, 'GET /api/health datasetVersion must match ruleEngine.mjs');
  assert.equal(healthJson.ruleEngineVersion, RULE_ENGINE_VERSION, 'GET /api/health ruleEngineVersion must match ruleEngine.mjs');
  assert.equal(resHealth.headers['cache-control'], 'no-store', 'API responses must set Cache-Control: no-store');
  assert.equal(resEval.headers['cache-control'], 'no-store', 'POST /api/evaluate must set Cache-Control: no-store');

  // Brotli & Gzip compression on responses > 1 KB
  const resLocBr = await request('GET', '/api/locales', null, { 'Accept-Encoding': 'br, gzip' });
  assert.equal(resLocBr.status, 200);
  assert.equal(resLocBr.headers['content-encoding'], 'br', 'Expected Brotli encoding on /api/locales');
  const locBrJson = JSON.parse(zlib.brotliDecompressSync(resLocBr.rawBuffer).toString('utf8'));
  assert.equal(locBrJson.supportedLanguages.length, 10);

  const resLocGz = await request('GET', '/api/locales', null, { 'Accept-Encoding': 'gzip' });
  assert.equal(resLocGz.status, 200);
  assert.equal(resLocGz.headers['content-encoding'], 'gzip', 'Expected Gzip encoding on /api/locales');
  const locGzJson = JSON.parse(zlib.gunzipSync(resLocGz.rawBuffer).toString('utf8'));
  assert.equal(locGzJson.supportedLanguages.length, 10);

  const resEngineBr = await request('GET', '/src/engine/ruleEngine.mjs', null, { 'Accept-Encoding': 'br' });
  assert.equal(resEngineBr.status, 200);
  assert.equal(resEngineBr.headers['content-encoding'], 'br');
  assert.match(zlib.brotliDecompressSync(resEngineBr.rawBuffer).toString('utf8'), /RULE_ENGINE_VERSION/);

  // ETag + 304 Not Modified on GET /
  const etag = resHome.headers['etag'];
  assert.ok(typeof etag === 'string' && etag.length > 4, 'GET / must return ETag header');
  const resHomeBr = await request('GET', '/', null, { 'Accept-Encoding': 'br' });
  assert.equal(resHomeBr.status, 200);
  assert.equal(resHomeBr.headers['content-encoding'], 'br');
  assert.match(zlib.brotliDecompressSync(resHomeBr.rawBuffer).toString('utf8'), /InciFact/);

  const resHome304 = await request('GET', '/', null, { 'If-None-Match': etag });
  assert.equal(resHome304.status, 304, 'Matching If-None-Match on GET / must return 304');
  assertSecurityHeaders(resHome304, EXPECTED_HTML_CSP, 'GET / 304');
  assert.equal(resHome304.body, '');

  const resHome304List = await request('GET', '/', null, { 'If-None-Match': `W/"stale", ${etag}` });
  assert.equal(resHome304List.status, 304, 'Comma-separated If-None-Match containing ETag must return 304');

  // RFC 9110 Accept-Encoding q=0 negotiation & HEAD / Content-Length parity
  const resLocQ0 = await request('GET', '/api/locales', null, { 'Accept-Encoding': 'br;q=0, gzip;q=0' });
  assert.equal(resLocQ0.status, 200);
  assert.equal(resLocQ0.headers['content-encoding'], undefined, 'br;q=0, gzip;q=0 must NOT compress response');
  assert.equal(JSON.parse(resLocQ0.body).supportedLanguages.length, 10);

  const resLocBr0Gz1 = await request('GET', '/api/locales', null, { 'Accept-Encoding': 'br;q=0, gzip;q=1' });
  assert.equal(resLocBr0Gz1.status, 200);
  assert.equal(resLocBr0Gz1.headers['content-encoding'], 'gzip', 'br;q=0, gzip;q=1 must select gzip');
  assert.equal(JSON.parse(zlib.gunzipSync(resLocBr0Gz1.rawBuffer).toString('utf8')).supportedLanguages.length, 10);

  const resHeadGz = await request('HEAD', '/', null, { 'Accept-Encoding': 'gzip' });
  assert.equal(resHeadGz.status, 200);
  assert.equal(resHeadGz.headers['content-encoding'], 'gzip');
  assert.ok(Number(resHeadGz.headers['content-length']) > 1000, 'HEAD / must return accurate compressed Content-Length');

  console.log('✅ ALL SERVER TESTS PASSED!');
} catch (err) {
  console.error('Server test error:', err);
  process.exitCode = 1;
} finally {
  serverProc.kill();
  process.exit(process.exitCode || 0);
}
