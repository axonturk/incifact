// Live API vs disk engine parity for the audit-3 vectors (timestamp excluded).
import { evaluateProduct } from '../src/engine/ruleEngine.mjs';
const cases = [
  { rawText: 'Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate ٤٪', applicationType: 'lotion' },
  { rawText: 'Aqua, Methylisothiazolinone ٠٫٠٠١٦٪', applicationType: 'rinse_off' },
  { rawText: 'Aqua, Methylisothiazolinone (20 ppm)', applicationType: 'rinse_off' },
  { rawText: 'Aqua, Methylchloroisothiazolinone 0.0012%, Methylisothiazolinone 0.0004%', applicationType: 'rinse_off' },
  { rawText: 'Aqua, Methylchloroisothiazolinone 0.0005%, Methylisothiazolinone 0.0005%', applicationType: 'rinse_off', expectScore: 10 },
  { rawText: 'Aqua, Methylchloroisothiazolinone 0.00075%, Methylisothiazolinone 0.00025%', applicationType: 'rinse_off', expectNotCapped: true },
  { rawText: 'Aqua, Methylchloroisothiazolinone 0.001125%, Methylisothiazolinone 0.000375%', applicationType: 'rinse_off', expectNotCapped: true },
  { rawText: 'Aqua, Methylchloroisothiazolinone, Methylisothiazolinone', applicationType: 'rinse_off', expectNotCapped: true },
  { rawText: 'Shampoo: Aqua, Methylisothiazolinone', applicationType: 'leave_on' },
  { rawText: 'Water, Sugar, Salt, Citric Acid, Milk-free Soy Lecithin', productType: 'food', userProfiles: ['astim_alerji'] },
  { rawText: 'Water, Sugar, Salt, Citric Acid, Gluten-free Mustard', productType: 'food', userProfiles: ['astim_alerji'] },
  { rawText: 'Su, Şeker, Tuz, Sitrik Asit, Acı Bakla', productType: 'food', userProfiles: ['astim_alerji'] },
  { rawText: 'Professional artificial nail system: Aqua, Hydroquinone 0.02%', professionalUse: false }
];
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'timestamp' ? undefined : v));
let ok = 0;
for (const c of cases) {
  const { expectScore, expectNotCapped, ...input } = c;
  const disk = evaluateProduct(input);
  const res = await fetch('http://localhost:3456/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const live = await res.json();
  const same = strip(disk) === strip(live);
  const r = live.cards.regulatoryCard, al = live.cards.profileCard.alerts.filter((a) => a.level === 'kirmizi').map((a) => a.substanceName);
  const expectOk = (expectScore === undefined || r.score === expectScore) && (!expectNotCapped || r.capApplied !== 10);
  if (same && res.status === 200 && expectOk) ok++;
  console.log(res.status, same ? 'EQUAL' : 'DIFF ', expectOk ? 'OK ' : 'BAD', 'score=' + r.score, 'cap=' + r.capApplied, al.length ? 'allergens=' + al.join('|') : '', '<-', input.rawText.slice(0, 70));
}
console.log(`\n${ok}/${cases.length} live==disk`);
process.exit(ok === cases.length ? 0 : 1);
