// Lists unrecognized tokens in every localized ready-made sample of the web simulator (8 products x 10 languages = 80 samples).
// Run: node tests/localized_samples_coverage.mjs [--strict]   (--strict exits 1 if any sample < 100 % recognised or unconfirmed)
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

let below100Raw = 0, below100Confirmed = 0, total = 0;
const rows = [];
SAMPLES.forEach((s, idx) => {
  const texts = s.texts || s.text || s.rawText || s.labels || {};
  for (const [lang, rawText] of Object.entries(texts)) {
    if (typeof rawText !== 'string') continue;
    total++;
    const productType = s.productType || s.type || 'cosmetic';
    const r = evaluateProduct({ rawText, lang, productType });
    const covRaw = r.cards.regulatoryCard.coveragePercent;
    const unknown = r.observations.filter((o) => o.status === 'unrecognized').map((o) => o.raw);
    if (covRaw < 100) below100Raw++;

    const rConfirmed = evaluateProduct({
      rawText,
      lang,
      productType,
      userConfirmations: { 'Sodium Laur?l Sulfate': 'sles' }
    });
    const covConfirmed = rConfirmed.cards.regulatoryCard.coveragePercent;
    const unresolvedAfter = rConfirmed.observations
      .filter((o) => o.status !== 'recognized')
      .map((o) => `${o.raw}(${o.status})`);
    if (covConfirmed < 100 || !rConfirmed.cards.regulatoryCard.canShowScore) below100Confirmed++;
    if (unknown.length || unresolvedAfter.length) {
      rows.push(`#${idx} ${lang} raw=${covRaw}% confirmed=${covConfirmed}% -> ${[...unknown, ...unresolvedAfter].join(' | ')}`);
    }
  }
});
rows.forEach((r) => console.log(r));
console.log(`\n${total - below100Raw}/${total} samples at 100 % raw (${total - below100Confirmed}/${total} at 100 % post-OCR-confirm)`);
if (process.argv.includes('--strict') && (rows.length || below100Confirmed > 0)) process.exit(1);
