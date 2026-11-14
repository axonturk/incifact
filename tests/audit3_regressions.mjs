// Regression vectors from independent audit #3 (80/100 NO-GO, 13 Oct 2026).
// Every case here was a reproducible P1/P2 finding. Run: node tests/audit3_regressions.mjs
import assert from 'node:assert/strict';
import sourcesData from '../src/data/generated/sources.mjs';
import { getLocaleStrings } from '../src/i18n/locales.mjs';
import {
  evaluateProduct,
  parseConcentration,
  parseIngredientList,
  lookupBarcodeProduct,
  createCustomBarcodeEntry
} from '../src/engine/ruleEngine.mjs';

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
t('MCI 5 ppm + MI 5 ppm (1:1 via MCI abbreviation) rinse-off -> 10', () => {
  const r = reg({ rawText: 'Aqua, MCI 5 ppm, MI 5 ppm', applicationType: 'rinse_off' });
  assert.equal(r.score, 10); assert.equal(r.capApplied, 10);
  assert.match(miFinding('Aqua, MCI 5 ppm, MI 5 ppm').legalText, /1:1/);
});
t('MCI 7.5 ppm + MI 2.5 ppm (3:1 via MCI abbreviation) rinse-off -> 80', () => {
  const r = reg({ rawText: 'Aqua, MCI 7.5 ppm, MI 2.5 ppm', applicationType: 'rinse_off' });
  assert.equal(r.score, 80); assert.notEqual(r.capApplied, 10);
  assert.match(miFinding('Aqua, MCI 7.5 ppm, MI 2.5 ppm').legalText, /3:1 olarak doğrulandı/);
});

// --- Stage 2 [P1-1]: Algorithmic DoS, ReDoS & Prototype-Chain Protection ---
t('[P1-1] Watchlist DoS: 100x Aqua + 3 watch terms < 15ms', () => {
  const rawText = 'Aqua, '.repeat(100) + 'Glycerin';
  const customWatchlist = ['paraben', 'retinol', 'limonene'];
  evaluateProduct({ rawText: 'Aqua', customWatchlist }); // warm cache
  const t0 = performance.now();
  const res = evaluateProduct({ rawText, customWatchlist });
  const dt = performance.now() - t0;
  assert.equal(res.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');
  assert.ok(dt < 15, `Expected < 15ms, got ${dt.toFixed(2)}ms`);
});

t('[P1-1] Watchlist DoS: ~57KB input + 3 watch terms < 150ms', () => {
  const rawText = 'Aqua, Glycerin, Niacinamide, Panthenol, '.repeat(1450) + 'Aqua';
  assert.ok(rawText.length >= 57000, `Expected >= 57KB, got ${rawText.length}`);
  const t0 = performance.now();
  const res = evaluateProduct({ rawText, customWatchlist: ['paraben', 'retinol', 'limonene'] });
  const dt = performance.now() - t0;
  assert.equal(res.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');
  assert.ok(dt < 150, `Expected < 150ms, got ${dt.toFixed(2)}ms`);
});

t('[P1-1] L278 ReDoS: unclosed paren with 55000 spaces < 20ms', () => {
  const evil = '(' + ' '.repeat(55000) + 'Aqua';
  const t0 = performance.now();
  const tokens = parseIngredientList(evil);
  const dt = performance.now() - t0;
  assert.ok(Array.isArray(tokens));
  assert.ok(dt < 20, `Expected < 20ms, got ${dt.toFixed(2)}ms`);
});

t('[P1-1] Prototype-chain hardening: constructor/toString inputs & profiles produce 0 crashes/alerts', () => {
  const res = evaluateProduct({
    rawText: 'Aqua, Glycerin, Niacinamide, Panthenol, Sodium Hyaluronate, Allantoin, Ceramide NP, Cholesterol, Squalane, Caprylic/Capric Triglyceride, Tocopherol, Carbomer, Xanthan Gum, constructor, toString, valueOf',
    productType: 'cosmetic',
    userProfiles: ['constructor', 'toString', 'hassas_cilt']
  });
  assert.ok(res && res.cards && res.cards.profileCard);
  assert.equal(Object.hasOwn(res.cards.profileCard.profileStatuses, 'constructor'), false);
  assert.equal(Object.hasOwn(res.cards.profileCard.profileStatuses, 'toString'), false);
  assert.equal(res.cards.profileCard.profileStatuses.hassas_cilt, 'true');
  assert.equal(res.cards.profileCard.alerts.length, 0);
  const inheritedCatalog = Object.create({
    '8690000000001': { code: '8690000000001', productName: 'Proto', rawText: 'Aqua' }
  });
  const bc1 = lookupBarcodeProduct({ barcode: 'constructor', customCatalog: inheritedCatalog });
  assert.equal(bc1.found, false);
  const bc2 = lookupBarcodeProduct({ barcode: '8690000000001', customCatalog: inheritedCatalog });
  assert.equal(bc2.found, false);
});

// --- Stage 2 [P1-2]: Kojic/Retinol Enforcement, 14/14 Allergens, Negation, Custom Barcode Lock ---
t('[P1-2] Kojic Acid: 1% face = 97, >1% = 10, body_lotion = 10', () => {
  const rOk = reg({ rawText: 'Aqua, Glycerin, Kojic Acid 1%' });
  assert.equal(rOk.score, 97);
  const rHigh = reg({ rawText: 'Aqua, Glycerin, Kojic Acid 2%' });
  assert.equal(rHigh.score, 10);
  assert.equal(rHigh.capApplied, 10);
  const rBody = reg({ rawText: 'Aqua, Glycerin, Kojic Acid 0.5%', applicationType: 'body_lotion' });
  assert.equal(rBody.score, 10);
  assert.equal(rBody.capApplied, 10);
});

t('[P1-2] Retinol: conc<=0.3 face=90, >0.3 face=10, >0.05 body=10, LRP Retinol B3=87 preserved', () => {
  const rNoConc = reg({ rawText: 'Aqua, Glycerin, Retinol' });
  assert.equal(rNoConc.score, 90);
  const rFaceOk = reg({ rawText: 'Aqua, Glycerin, Retinol 0.3%', targetDate: '2025-11-01' });
  assert.equal(rFaceOk.score, 90);
  const rFaceOver = reg({ rawText: 'Aqua, Glycerin, Retinol 0.5%', targetDate: '2025-11-01' });
  assert.equal(rFaceOver.score, 10);
  assert.equal(rFaceOver.capApplied, 10);
  const rBodyOver = reg({ rawText: 'Aqua, Glycerin, Retinol 0.1%', applicationType: 'body_lotion', targetDate: '2025-11-01' });
  assert.equal(rBodyOver.score, 10);
  assert.equal(rBodyOver.capApplied, 10);
  const rPreDeadline = reg({ rawText: 'Aqua, Glycerin, Retinol 0.5%', targetDate: '2025-10-31' });
  assert.equal(rPreDeadline.score, 90);
  const lrp = lookupBarcodeProduct({ barcode: '3337875696586', lang: 'tr' });
  assert.equal(lrp.found, true);
  assert.equal(lrp.evaluation.cards.regulatoryCard.score, 87);
});

t('[P1-2] regulatoryReportCard covers all 14/14 EU 1169/2011 food allergens (incl. crustaceans, fish, molluscs)', () => {
  const res = evaluateProduct({
    rawText: 'Wheat, Shrimp, Egg, Fish, Peanut, Soy, Milk, Hazelnut, Celery, Mustard, Sesame, Sulphites, Lupin, Squid',
    productType: 'food'
  });
  const ids = new Set(res.cards.regulatoryReportCard.detectedAllergens.map((a) => a.allergenId));
  for (const id of ['gluten', 'crustaceans', 'egg', 'fish', 'peanut', 'soy', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']) {
    assert.ok(ids.has(id), `Missing allergenId=${id} in regulatoryReportCard`);
  }
  assert.equal(ids.size, 14);
});

t('[P1-2] Fish species (Shrimp, Cod, Squid) trigger crustaceans+fish+molluscs without code/sodium/cotton false positives', () => {
  const scs = evaluateProduct({ rawText: 'Shrimp, Cod, Squid', productType: 'food', userProfiles: ['astim_alerji'] });
  const regIds = scs.cards.regulatoryReportCard.detectedAllergens.map((a) => a.allergenId);
  assert.deepEqual(regIds, ['crustaceans', 'fish', 'molluscs']);
  const profIds = scs.cards.profileCard.alerts.filter((a) => a.profile === 'astim_alerji').map((a) => a.allergenId);
  assert.deepEqual(profIds, ['crustaceans', 'fish', 'molluscs']);
  const safeRes = evaluateProduct({ rawText: 'Water, Sodium Chloride, Cottonseed Oil, Codeine', productType: 'food', userProfiles: ['astim_alerji'] });
  assert.equal(safeRes.cards.regulatoryReportCard.detectedAllergens.length, 0);
  assert.equal(safeRes.cards.profileCard.alerts.filter((a) => a.profile === 'astim_alerji').length, 0);
});

t('[P1-2] regulatoryReportCard cosmetic sensitizer negation skips without Parfum / parfümsüz / fragrance-free', () => {
  const resNeg = evaluateProduct({
    rawText: 'Aqua, Glycerin, Niacinamide, without Parfum, parfümsüz, fragrance-free',
    productType: 'cosmetic'
  });
  assert.equal(resNeg.cards.regulatoryReportCard.detectedAllergens.length, 0);
  const resPos = evaluateProduct({
    rawText: 'Aqua, Glycerin, Parfum (Paraben-free)',
    productType: 'cosmetic'
  });
  assert.ok(resPos.cards.regulatoryReportCard.detectedAllergens.some((a) => a.allergenId === 'fragrance_allergen'));
});

t('[P1-2] createCustomBarcodeEntry rejects unresolved OCR/BHA confirmations', () => {
  const rejected = createCustomBarcodeEntry({
    barcode: '8690000123457',
    productName: 'Test BHA Cream',
    productType: 'cosmetic',
    rawText: 'Aqua, Glycerin, Niacinamide, Panthenol, BHA'
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'unresolved_ocr_confirmations');
  assert.equal(rejected.entry, null);
});

// --- Stage 3: P2 & P3 Localization, Sources, Manifest & Typo Fixes ---
const NON_TR_LANGS = ['en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
const hasTurkishCharsOrWords = (str = '') => /[ğĞşŞıİ]/.test(str) || /\b(izinlidir|yasaktır|sınırlandırılmalıdır|tavsiye edilmez|dikkatli tüketilmelidir|uyumsuzluğu|teyit edilmelidir|bileşen|ürünlerde|azami|kullanılamaz|sınırıyla)\b/i.test(str);

t('[P2/P3] ms routine advice uses antara (no Russian между)', () => {
  const res = evaluateProduct({ rawText: 'Aqua, Copper Tripeptide-1, Ascorbic Acid', productType: 'cosmetic', lang: 'ms' });
  const joined = [
    ...(res.cards?.regulatoryCard?.warnings || []),
    ...(res.cards?.profileCard?.advice || []),
    ...(res.cards?.regulatoryReportCard?.highlights || []),
    JSON.stringify(res.cards?.routineConflictCard || {})
  ].join(' ');
  assert.ok(!joined.includes('между'), 'Russian word между must not appear in ms advice');
  assert.ok(joined.includes('antara'), 'Malay word antara should appear in ms routine conflict advice');
});

t('[P2/P3] cosingDictionaryCount matches dynamic 30594 dataset count', () => {
  const res = evaluateProduct({ rawText: 'Aqua, Glycerin', productType: 'cosmetic', lang: 'en' });
  assert.equal(res.cards.regulatoryReportCard.datasetManifest.cosingDictionaryCount, 30594);
});

t('[P2/P3] all sources in sources.json have institution, checked_at, and url', () => {
  const entries = Object.values(sourcesData.sources || {});
  assert.ok(entries.length >= 18);
  assert.ok(entries.every((s) => Boolean(s.institution && s.checked_at && s.url)), 'Every source must include institution, checked_at, url');
});

t('[P2/P3] Urdu Pringles barcode 5053990138722 typo fixed to پرنگلز', () => {
  const entry = lookupBarcodeProduct({ barcode: '5053990138722', lang: 'ur' });
  assert.ok(entry && entry.productName && entry.productName.includes('پرنگلز'), `Expected پرنگلز, got ${entry?.productName}`);
  assert.ok(!entry.productName.includes('پرنپگلز'), 'Typo پرنپگلز must be gone');
});

t('[P2/P3] locales.mjs updates 26 allergens to 80+ (2023/1545) in all 10 languages', () => {
  for (const lang of ['tr', ...NON_TR_LANGS]) {
    const loc = getLocaleStrings(lang);
    const desc = loc.profileScreen?.profiles?.hassas_cilt?.desc || '';
    assert.ok(!/\b26\b/.test(desc), `Locale ${lang} hassas_cilt.desc still mentions 26: ${desc}`);
    assert.ok(desc.includes('80+') && desc.includes('2023/1545'), `Locale ${lang} hassas_cilt.desc missing 80+ / 2023/1545: ${desc}`);
  }
});

t('[P2/P3] non-TR localization across all 9 languages (legalText, TR jurisdictionNote, falsePositiveNote, caffeine/taurine, maltodextrin)', () => {
  const regInputs = [
    { raw: 'Aqua, Triphenyl Phosphate', expectNum: '2026/909' },
    { raw: 'Aqua, Trimethylbenzoyl Diphenylphosphine Oxide', expectNum: '2025/877' },
    { raw: 'Aqua, 4-Methylbenzylidene Camphor', expectNum: '2024/996' },
    { raw: 'Aqua, Retinol 0.3%', expectNum: '2024/996' },
    { raw: 'Aqua, Kojic Acid 1%', expectNum: '2024/996' },
    { raw: 'Aqua, Alpha-Arbutin 2%', expectNum: '2024/996' },
    { raw: 'Aqua, Arbutin 7%', expectNum: '2024/996' },
    { raw: 'Aqua, Genistein 0.007%', expectNum: '2024/996' },
    { raw: 'Aqua, Daidzein 0.02%', expectNum: '2024/996' },
    { raw: 'Aqua, Triclosan 0.3%', expectNum: '2024/996' },
    { raw: 'Aqua, Triclocarban 0.2%', expectNum: '2024/996' },
    { raw: 'Aqua, Methylparaben', expectNum: '0.4%' },
    { raw: 'Aqua, Isobutylparaben', expectNum: '358/2014' },
    { raw: 'Aqua, Propylparaben', expectNum: '1004/2014' },
    { raw: 'Aqua, Almondamide DEA', expectNum: 'III' },
    { raw: 'Aqua, 1,2,4-Benzenetriacetate', expectNum: 'II' }
  ];
  for (const lang of NON_TR_LANGS) {
    for (const item of regInputs) {
      const r = evaluateProduct({ rawText: item.raw, productType: 'cosmetic', jurisdiction: 'TR', lang });
      const f = r.cards.regulatoryCard.findings.find((x) => !/^aqua|water$/i.test(x.rawToken)) || r.cards.regulatoryCard.findings[r.cards.regulatoryCard.findings.length - 1];
      assert.ok(f && f.legalText, `Missing finding/legalText for ${item.raw} in ${lang}`);
      assert.ok(!hasTurkishCharsOrWords(f.legalText), `Turkish leak in legalText (${lang}, ${item.raw}): ${f.legalText}`);
      if (item.expectNum) {
        assert.ok(f.legalText.includes(item.expectNum), `Missing ${item.expectNum} in legalText (${lang}, ${item.raw}): ${f.legalText}`);
      }
      if (f.jurisdictionNote) {
        assert.ok(!hasTurkishCharsOrWords(f.jurisdictionNote), `Turkish leak in jurisdictionNote (${lang}): ${f.jurisdictionNote}`);
      }
    }

    const fp = evaluateProduct({ rawText: 'Aqua, Cetyl Alcohol', productType: 'cosmetic', lang });
    const fpFinding = fp.cards.regulatoryCard.findings.find((f) => f.substanceId === 'cetyl_alcohol');
    assert.ok(fpFinding && fpFinding.falsePositiveNote, `Missing falsePositiveNote for cetyl_alcohol in ${lang}`);
    assert.ok(!hasTurkishCharsOrWords(fpFinding.falsePositiveNote), `Turkish leak in falsePositiveNote (${lang}): ${fpFinding.falsePositiveNote}`);

    const food = evaluateProduct({
      rawText: 'Water, Caffeine, Taurine, Maltodextrin',
      productType: 'food',
      userProfiles: ['hamilelik', 'cocuk_metabolik'],
      lang
    });
    const alerts = food.cards.profileCard.alerts.filter((a) => a.profile === 'hamilelik' || a.profile === 'cocuk_metabolik');
    assert.ok(alerts.length >= 2, `Expected pregnancy/child caffeine alerts in ${lang}`);
    for (const a of alerts) {
      assert.ok(!hasTurkishCharsOrWords(a.explanation), `Turkish leak in caffeine/taurine alert (${lang}): ${a.explanation}`);
      assert.ok(!hasTurkishCharsOrWords(a.substanceName), `Turkish leak in caffeine/taurine name (${lang}): ${a.substanceName}`);
    }
    const rapid = food.cards.veganSugarCard?.detectedRapidCarbs || [];
    assert.ok(rapid.length >= 1, `Expected maltodextrin in detectedRapidCarbs (${lang})`);
    assert.ok(!hasTurkishCharsOrWords(rapid[0].explanation), `Turkish leak in maltodextrin explanation (${lang}): ${rapid[0].explanation}`);
  }
});

// --- Stage 5 (Final Judge P2/P3 Content Regressions) ---
t('[P2-C1] Turkish Kojic Acid uses Ek III/375 and Retinol uses Ek III/376 (never Ek III/379)', () => {
  const kojOk = reg({ rawText: 'Aqua, Kojic Acid 0.5%', lang: 'tr' }).findings.find((f) => f.substanceId === 'kojic_acid');
  const kojOver = reg({ rawText: 'Aqua, Kojic Acid 2%', lang: 'tr' }).findings.find((f) => f.substanceId === 'kojic_acid');
  const kojBody = reg({ rawText: 'Aqua, Kojic Acid 0.5%', applicationType: 'body_lotion', lang: 'tr' }).findings.find((f) => f.substanceId === 'kojic_acid');
  for (const f of [kojOk, kojOver, kojBody]) {
    assert.ok(f && f.legalText.includes('Ek III/375'), `Expected Ek III/375 in Kojic TR legalText: ${f?.legalText}`);
    assert.ok(!f.legalText.includes('Ek III/379'), `Unexpected Ek III/379 in Kojic TR legalText: ${f?.legalText}`);
  }
  const retOk = reg({ rawText: 'Aqua, Retinol 0.2%', lang: 'tr' }).findings.find((f) => f.substanceId === 'retinol');
  const retOver = reg({ rawText: 'Aqua, Retinol 0.5%', lang: 'tr', targetDate: '2025-11-01' }).findings.find((f) => f.substanceId === 'retinol');
  const retBody = reg({ rawText: 'Aqua, Retinol 0.1%', applicationType: 'body_lotion', lang: 'tr', targetDate: '2025-11-01' }).findings.find((f) => f.substanceId === 'retinol');
  for (const f of [retOk, retOver, retBody]) {
    assert.ok(f && f.legalText.includes('Ek III/376'), `Expected Ek III/376 in Retinol TR legalText: ${f?.legalText}`);
    assert.ok(!f.legalText.includes('Ek III/375'), `Unexpected Ek III/375 in Retinol TR legalText: ${f?.legalText}`);
  }
});

t('[P2-C2] Localized active aliases (Retinol, Kojic Acid, TPHP) match across regulatoryCard, routineConflictCard, and regulatoryReportCard', () => {
  const arRet = evaluateProduct({ rawText: 'Aqua, ريتينول 0.5%, Glycolic Acid', lang: 'ar', targetDate: '2025-11-01' });
  assert.equal(arRet.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(arRet.cards.regulatoryCard.score, 10);
  assert.ok(arRet.cards.routineConflictCard.totalConflicts >= 1);
  assert.ok(arRet.cards.regulatoryReportCard.transitionCalendarItems.some((x) => /III\/376/.test(x.regulation)));

  const ruRet = evaluateProduct({ rawText: 'Aqua, Ретинол 0.5%, Salicylic Acid', lang: 'ru', targetDate: '2025-11-01' });
  assert.equal(ruRet.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(ruRet.cards.regulatoryCard.score, 10);
  assert.ok(ruRet.cards.routineConflictCard.totalConflicts >= 1);
  assert.ok(ruRet.cards.regulatoryReportCard.transitionCalendarItems.some((x) => /III\/376/.test(x.regulation)));

  for (const [rawText, lang] of [
    ['Aqua, Kojisäure 1.5%', 'de'],
    ['Aqua, Acide Kojique 1.5%', 'fr'],
    ['Aqua, Ácido Kójico 1.5%', 'es'],
    ['Aqua, Asam Kojat 1.5%', 'id'],
    ['Aqua, Asid Kojik 1.5%', 'ms'],
    ['Aqua, کوجک ایسڈ 1.5%', 'ur']
  ]) {
    const res = evaluateProduct({ rawText, lang });
    assert.equal(res.cards.regulatoryCard.coveragePercent, 100, `Expected 100% coverage for ${rawText}`);
    assert.equal(res.cards.regulatoryCard.score, 10, `Expected score 10 for ${rawText}`);
    assert.ok(res.cards.regulatoryReportCard.transitionCalendarItems.some((x) => /III\/375/.test(x.regulation)), `Missing transition item for ${rawText}`);
  }

  for (const [rawText, lang] of [
    ['Aqua, Triphenylphosphat', 'de'],
    ['Aqua, Phosphate de triphényle', 'fr'],
    ['Aqua, Fosfato de trifenilo', 'es'],
    ['Aqua, Трифенилфосфат', 'ru'],
    ['Aqua, فوسفات ثلاثي الفينيل', 'ar']
  ]) {
    const res = evaluateProduct({ rawText, lang, targetDate: '2027-01-01' });
    assert.equal(res.cards.regulatoryCard.coveragePercent, 100, `Expected 100% coverage for ${rawText}`);
    assert.equal(res.cards.regulatoryCard.score, 10, `Expected score 10 for ${rawText} in 2027`);
    assert.ok(res.cards.regulatoryReportCard.transitionCalendarItems.some((x) => /2026\/909/.test(x.regulation)), `Missing TPHP transition item for ${rawText}`);
  }
});

t('[P3-C1] Lupin Flour triggers lupin only (no gluten false-positive), while Wheat Flour triggers gluten', () => {
  const lupinRes = evaluateProduct({ rawText: 'Water, Lupin Flour', productType: 'food', userProfiles: ['astim_alerji'] });
  const lupinIds = lupinRes.cards.regulatoryReportCard.detectedAllergens.map((a) => a.allergenId);
  assert.deepEqual(lupinIds, ['lupin']);
  assert.ok(!lupinRes.cards.profileCard.alerts.some((a) => a.allergenId === 'gluten'));
  assert.ok(!lupinRes.cards.swapGuideCard.items.some((i) => i.swapId === 'swap_allergen_gluten_wheat'));

  const wheatRes = evaluateProduct({ rawText: 'Wheat Flour', productType: 'food', userProfiles: ['astim_alerji'] });
  const wheatIds = wheatRes.cards.regulatoryReportCard.detectedAllergens.map((a) => a.allergenId);
  assert.deepEqual(wheatIds, ['gluten']);
  assert.ok(wheatRes.cards.profileCard.alerts.some((a) => a.allergenId === 'gluten'));
});

t('[P3-C2] Sodium Metabisulfite / Metabisulphite triggers sulphites without E223 code', () => {
  for (const rawText of ['Water, Sodium Metabisulfite', 'Water, Potassium Metabisulphite', 'Su, Sodyum Metabisülfit']) {
    const res = evaluateProduct({ rawText, productType: 'food', userProfiles: ['astim_alerji'] });
    const ids = res.cards.regulatoryReportCard.detectedAllergens.map((a) => a.allergenId);
    assert.deepEqual(ids, ['sulphites'], `Expected ['sulphites'] for "${rawText}", got ${JSON.stringify(ids)}`);
    assert.ok(res.cards.profileCard.alerts.some((a) => a.allergenId === 'sulphites'), `Missing profileCard sulphites alert for "${rawText}"`);
  }
});

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
