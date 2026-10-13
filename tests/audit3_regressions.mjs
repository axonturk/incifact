// Regression vectors from independent audit #3 (80/100 NO-GO, 13 Oct 2026).
// Every case here was a reproducible P1/P2 finding. Run: node tests/audit3_regressions.mjs
import assert from 'node:assert/strict';
import { evaluateProduct, parseConcentration } from '../src/engine/ruleEngine.mjs';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅', name); } catch (e) { fail++; console.log('❌', name, '\n   ', e.message); } };
const reg = (o) => evaluateProduct(o).cards.regulatoryCard;
const allergyAlerts = (rawText) => evaluateProduct({ rawText, productType: 'food', userProfiles: ['astim_alerji'] })
  .cards.profileCard.alerts.filter((a) => a.profile === 'astim_alerji' && a.level === 'kirmizi').map((a) => a.substanceName);

// --- P1-1: concentration normalisation ---
t('parseConcentration: ٤٪ = 4', () => assert.equal(parseConcentration('X ٤٪'), 4));
t('parseConcentration: ۴٪ = 4', () => assert.equal(parseConcentration('X ۴٪'), 4));
t('parseConcentration: ٠٫٠٠١٦٪ = 0.0016', () => assert.equal(parseConcentration('X ٠٫٠٠١٦٪'), 0.0016));
t('parseConcentration: 20 ppm = 0.002', () => assert.equal(parseConcentration('X (20 ppm)'), 0.002));
t('Mexoryl ٤٪ lotion -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate ٤٪', applicationType: 'lotion' }).score, 10));
t('Mexoryl ۴٪ lotion -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate ۴٪', applicationType: 'lotion' }).score, 10));
t('Mexoryl 3% lotion -> 90 (still allowed)', () => assert.equal(reg({ rawText: 'Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate 3%', applicationType: 'lotion' }).score, 90));
t('MI ٠٫٠٠١٦٪ rinse-off -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methylisothiazolinone ٠٫٠٠١٦٪', applicationType: 'rinse_off' }).score, 10));
t('MI (20 ppm) rinse-off -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methylisothiazolinone (20 ppm)', applicationType: 'rinse_off' }).score, 10));
t('MI (15 ppm) rinse-off -> 90', () => assert.equal(reg({ rawText: 'Aqua, Methylisothiazolinone (15 ppm)', applicationType: 'rinse_off' }).score, 90));

// --- P1-2: MCI + MI mixture total ---
t('MCI 0.0012% + MI 0.0004% rinse-off (total 0.0016) -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.0012%, Methylisothiazolinone 0.0004%', applicationType: 'rinse_off' }).score, 10));
t('MCI 0.001125% + MI 0.000375% rinse-off (total 0.0015) -> not capped', () => assert.notEqual(reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.001125%, Methylisothiazolinone 0.000375%', applicationType: 'rinse_off' }).capApplied, 10));

// --- P1-3: explicit applicationType beats label word ---
t('leave_on + "Shampoo:" label -> 10 with conflict note', () => {
  const r = reg({ rawText: 'Shampoo: Aqua, Methylisothiazolinone', applicationType: 'leave_on' });
  assert.equal(r.score, 10);
  assert.ok(r.findings.some((f) => /ÇELİŞKİ/.test(f.legalText || '')), 'conflict note missing');
});
t('No explicit type + "Shampoo:" label -> rinse-off 90', () => assert.equal(reg({ rawText: 'Shampoo: Aqua, Methylisothiazolinone 0.0015%' }).score, 90));

// --- P1-4: target-bound negation ---
t('Milk-free Soy Lecithin -> soy alert, no milk', () => { const a = allergyAlerts('Water, Sugar, Salt, Citric Acid, Milk-free Soy Lecithin'); assert.ok(a.includes('Soya'), JSON.stringify(a)); assert.ok(!a.some((x) => /Süt/.test(x)), JSON.stringify(a)); });
t('Gluten-free Mustard -> mustard alert, no gluten', () => { const a = allergyAlerts('Water, Sugar, Salt, Citric Acid, Gluten-free Mustard'); assert.ok(a.includes('Hardal'), JSON.stringify(a)); assert.ok(!a.some((x) => /Gluten/.test(x)), JSON.stringify(a)); });
t('Glutensiz un -> no gluten alert', () => assert.ok(!allergyAlerts('Su, Şeker, Glutensiz Un').some((x) => /Gluten/.test(x))));

// --- P1-5: Turkish "Acı Bakla" ---
t('Acı Bakla -> lupin alert', () => assert.ok(allergyAlerts('Su, Şeker, Tuz, Sitrik Asit, Acı Bakla').some((x) => /Acıbakla/.test(x))));

// --- P2: fake gluten on egg / mustard ---
t('Egg -> egg only, no gluten', () => { const a = allergyAlerts('Water, Sugar, Egg'); assert.ok(a.includes('Yumurta')); assert.ok(!a.some((x) => /Gluten/.test(x)), JSON.stringify(a)); });
t('Hardal -> mustard only, no gluten', () => { const a = allergyAlerts('Su, Şeker, Hardal'); assert.ok(a.includes('Hardal')); assert.ok(!a.some((x) => /Gluten/.test(x)), JSON.stringify(a)); });
t('Nutella still flags hazelnut, milk, soy', () => { const a = allergyAlerts('Sugar, Palm Oil, Hazelnuts (13%), Skimmed Milk Powder (8.7%), Fat-Reduced Cocoa (7.4%), Emulsifier: Lecithins (Soya), Vanillin'); assert.equal(new Set(a).size, 3, JSON.stringify(a)); });

// --- P2: hydroquinone nail exception requires professional use ---
t('HQ nail 0.02% professionalUse=false -> 10', () => assert.equal(reg({ rawText: 'Professional artificial nail system: Aqua, Hydroquinone 0.02%', professionalUse: false }).score, 10));
t('HQ nail 0.02% professionalUse=true -> 90', () => assert.equal(reg({ rawText: 'Artificial nail system: Aqua, Hydroquinone 0.02%', professionalUse: true }).score, 90));
t('HQ home nail 0.02% (no flag, no "professional") -> 10', () => assert.equal(reg({ rawText: 'Home artificial nail kit: Aqua, Hydroquinone 0.02%' }).score, 10));

// --- Audit 4 P1: MCI/MI 3:1 ratio (EU 1003/2014 Annex V/39) ---
const miFinding = (rawText) => reg({ rawText, applicationType: 'rinse_off' }).findings.find((f) => f.substanceId === 'mi_mci');
t('MCI 0.0005% + MI 0.0005% (1:1) rinse-off -> 10', () => {
  const r = reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.0005%, Methylisothiazolinone 0.0005%', applicationType: 'rinse_off' });
  assert.equal(r.score, 10); assert.equal(r.capApplied, 10);
  assert.match(miFinding('Aqua, Methylchloroisothiazolinone 0.0005%, Methylisothiazolinone 0.0005%').legalText, /1:1/);
});
t('MCI 0.00075% + MI 0.00025% (3:1) rinse-off -> allowed, ratio verified', () => {
  const r = reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.00075%, Methylisothiazolinone 0.00025%', applicationType: 'rinse_off' });
  assert.notEqual(r.capApplied, 10);
  assert.match(miFinding('Aqua, Methylchloroisothiazolinone 0.00075%, Methylisothiazolinone 0.00025%').legalText, /doğrulandı/);
});
t('MCI 0.001125% + MI 0.000375% (3:1, total exactly 0.0015) -> allowed', () => assert.notEqual(reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.001125%, Methylisothiazolinone 0.000375%', applicationType: 'rinse_off' }).capApplied, 10));
t('MCI 0.0006% + MI 0.0004% (1.5:1) rinse-off -> 10', () => assert.equal(reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.0006%, Methylisothiazolinone 0.0004%', applicationType: 'rinse_off' }).score, 10));
t('MCI + MI without amounts -> restricted, ratio NOT claimed as verified', () => {
  const f = miFinding('Aqua, Methylchloroisothiazolinone, Methylisothiazolinone');
  assert.equal(f.euStatus, 'kisitli'); assert.match(f.legalText, /DOĞRULANAMADI/); assert.doesNotMatch(f.legalText, /doğrulandı/);
});
t('MCI amount only, MI amount missing -> ratio unverified, not banned', () => {
  const f = miFinding('Aqua, Methylchloroisothiazolinone 0.0005%, Methylisothiazolinone');
  assert.equal(f.euStatus, 'kisitli'); assert.match(f.legalText, /DOĞRULANAMADI/);
});
t('MCI 0.0007% + MI 0.00025% (2.8:1) rinse-off -> 10 (Audit 5 boundary)', () => {
  const r = reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.0007%, Methylisothiazolinone 0.00025%', applicationType: 'rinse_off' });
  assert.equal(r.score, 10); assert.equal(r.capApplied, 10);
  assert.match(miFinding('Aqua, Methylchloroisothiazolinone 0.0007%, Methylisothiazolinone 0.00025%').legalText, /2\.8:1/);
});
t('MCI 0.0008% + MI 0.00025% (3.2:1) rinse-off -> 10 (Audit 5 boundary)', () => {
  const r = reg({ rawText: 'Aqua, Methylchloroisothiazolinone 0.0008%, Methylisothiazolinone 0.00025%', applicationType: 'rinse_off' });
  assert.equal(r.score, 10); assert.equal(r.capApplied, 10);
  assert.match(miFinding('Aqua, Methylchloroisothiazolinone 0.0008%, Methylisothiazolinone 0.00025%').legalText, /3\.2:1/);
});

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
