import http from 'node:http';
import { spawn } from 'node:child_process';

console.log('--- Testing server.mjs ---');

const serverProc = spawn('node', ['server.mjs'], {
  cwd: 'C:\\Projeler\\clean-halal-scanner',
  stdio: 'pipe'
});

serverProc.stdout.on('data', (d) => console.log('SERVER:', d.toString().trim()));
serverProc.stderr.on('data', (d) => console.error('SERVER ERR:', d.toString().trim()));

// Wait 1 second for server to bind
await new Promise(r => setTimeout(r, 1000));

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3456${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(`http://localhost:3456${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

try {
  // Test 1: Locales endpoint
  const resLoc = await get('/api/locales');
  console.log('Test 1: /api/locales status:', resLoc.status);
  if (resLoc.status !== 200) throw new Error('/api/locales failed');
  const locJson = JSON.parse(resLoc.body);
  console.log('Supported languages count:', locJson.supportedLanguages.length);
  if (locJson.supportedLanguages.length !== 10) throw new Error('Expected 10 supported languages');

  // Test 2: Evaluate endpoint
  const resEval = await post('/api/evaluate', {
    rawText: 'Aqua, Glycerin, Niacinamide, Lilial, Cetearyl Alcohol',
    productType: 'cosmetic',
    lang: 'tr'
  });
  console.log('Test 2: /api/evaluate status:', resEval.status);
  if (resEval.status !== 200) throw new Error('/api/evaluate failed');
  const evalJson = JSON.parse(resEval.body);
  console.log('Evaluate score:', evalJson.cards.regulatoryCard.score, 'capApplied:', evalJson.cards.regulatoryCard.capApplied);
  if (evalJson.cards.regulatoryCard.capApplied !== 10) throw new Error('Lilial must trigger capApplied: 10');

  // Test 3: DoS 64KB limit
  const hugePayload = { rawText: 'A'.repeat(70000) };
  const resHuge = await post('/api/evaluate', hugePayload);
  console.log('Test 3: Huge payload 64KB limit status:', resHuge.status);
  if (resHuge.status !== 413) throw new Error('Expected 413 Payload Too Large');

  console.log('✅ ALL SERVER TESTS PASSED!');
} catch (err) {
  console.error('Server test error:', err);
  process.exitCode = 1;
} finally {
  serverProc.kill();
  process.exit(process.exitCode || 0);
}
