import http from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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

function request(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let payload = null;
    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8')
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
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};

const EXPECTED_HTML_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const EXPECTED_SW_CSP = "default-src 'self'; connect-src 'self'";
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

  // 9. Traversal, malformed URI, null byte & Windows drive rejections -> 400/404
  for (const badPath of [
    '/assets/../../package.json',
    '/assets/%2e%2e%2fpackage.json',
    '/assets/%E0%A4%A',
    '/assets/incifact-app-icon.png%00.jpg',
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

  console.log('✅ ALL SERVER TESTS PASSED!');
} catch (err) {
  console.error('Server test error:', err);
  process.exitCode = 1;
} finally {
  serverProc.kill();
  process.exit(process.exitCode || 0);
}
