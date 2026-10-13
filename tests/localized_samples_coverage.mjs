// Lists unrecognized tokens in every localized ready-made sample of the web simulator (8 products x 10 languages).
// Run: node tests/localized_samples_coverage.mjs [--strict]   (--strict exits 1 if any sample < 100 % recognised)
import fs from 'node:fs';
import vm from 'node:vm';
import { evaluateProduct } from '../src/engine/ruleEngine.mjs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('const SAMPLES');
if (start < 0) throw new Error('SAMPLES not found in index.html');
// Extract the SAMPLES array literal by bracket matching
let i = html.indexOf('[', start), depth = 0, end = i;
for (; end < html.length; end++) {
  const ch = html[end];
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) break; }
}
const SAMPLES = vm.runInNewContext('(' + html.slice(i, end + 1) + ')');

let below100 = 0, total = 0;
const rows = [];
SAMPLES.forEach((s, idx) => {
  const texts = s.texts || s.text || s.rawText || s.labels || {};
  for (const [lang, rawText] of Object.entries(texts)) {
    if (typeof rawText !== 'string') continue;
    total++;
    const r = evaluateProduct({ rawText, lang, productType: s.productType || s.type || 'cosmetic' });
    const cov = r.cards.regulatoryCard.coveragePercent;
    const unknown = r.observations.filter((o) => o.status === 'unrecognized').map((o) => o.raw);
    if (cov < 100) below100++;
    if (unknown.length) rows.push(`#${idx} ${lang} ${cov}% -> ${unknown.join(' | ')}`);
  }
});
rows.forEach((r) => console.log(r));
console.log(`\n${total - below100}/${total} samples at 100 % coverage`);
if (process.argv.includes('--strict') && rows.length) process.exit(1);
