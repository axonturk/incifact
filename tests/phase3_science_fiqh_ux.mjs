import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateProduct,
  compareProducts,
  isValidGs1CheckDigit
} from '../src/engine/ruleEngine.mjs';
import { SUPPORTED_LANGUAGES } from '../src/i18n/locales.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}\n`, err);
    process.exitCode = 1;
  }
}

console.log('======================================================================');
console.log('🔬 PHASE 3 SCIENCE, FIQH, SECURITY, A11Y & MOBILE UX SUITE');
console.log('======================================================================');

// 1. Dermatological Profiles: fungal_acne & egzama_rosacea
t('[Profiles] fungal_acne & egzama_rosacea flag triggers without shifting regulatoryCard.score', () => {
  const baseFungal = evaluateProduct({
    rawText: 'Aqua, Glycerin, Polysorbate 20, Galactomyces Ferment Filtrate',
    productType: 'cosmetic',
    lang: 'en',
    userProfiles: []
  });
  const optFungal = evaluateProduct({
    rawText: 'Aqua, Glycerin, Polysorbate 20, Galactomyces Ferment Filtrate',
    productType: 'cosmetic',
    lang: 'en',
    userProfiles: ['fungal_acne']
  });
  assert.equal(optFungal.cards.regulatoryCard.score, baseFungal.cards.regulatoryCard.score);
  assert.equal(optFungal.cards.profileCard.profileStatuses.fungal_acne, 'false');
  assert.ok(optFungal.cards.profileCard.alerts.some((a) => a.profile === 'fungal_acne'));

  const baseEczema = evaluateProduct({
    rawText: 'Aqua, Glycerin, Menthol, Cinnamaldehyde, Panthenol',
    productType: 'cosmetic',
    lang: 'en',
    userProfiles: []
  });
  const optEczema = evaluateProduct({
    rawText: 'Aqua, Glycerin, Menthol, Cinnamaldehyde, Panthenol',
    productType: 'cosmetic',
    lang: 'en',
    userProfiles: ['egzama_rosacea']
  });
  assert.equal(optEczema.cards.regulatoryCard.score, baseEczema.cards.regulatoryCard.score);
  assert.equal(optEczema.cards.profileCard.profileStatuses.egzama_rosacea, 'false');
  assert.ok(optEczema.cards.profileCard.alerts.some((a) => a.profile === 'egzama_rosacea'));
});

// 2. FAO/WHO NOVA 1-4 Classifier
t('[Science/NOVA] novaCard classifies NOVA 1-4 accurately without changing base regulatoryCard.score', () => {
  const nova1 = evaluateProduct({ rawText: 'Water', productType: 'food', lang: 'en' });
  assert.equal(nova1.cards.novaCard.applicable, true);
  assert.equal(nova1.cards.novaCard.group, 1);

  const nova2 = evaluateProduct({ rawText: 'Olive Oil, Salt', productType: 'food', lang: 'en' });
  assert.equal(nova2.cards.novaCard.group, 2);

  const nova3 = evaluateProduct({ rawText: 'Tomato, Olive Oil, Sugar, Salt', productType: 'food', lang: 'en' });
  assert.equal(nova3.cards.novaCard.group, 3);

  const nova4 = evaluateProduct({
    rawText: 'Carbonated Water, High Fructose Corn Syrup, E471, Aspartame, Flavouring',
    productType: 'food',
    lang: 'en'
  });
  assert.equal(nova4.cards.novaCard.group, 4);
  assert.equal(nova4.cards.novaCard.badgeColor, 'kirmizi');
  assert.ok(nova4.cards.novaCard.markers.length >= 2);

  const cosm = evaluateProduct({ rawText: 'Aqua, Glycerin, Niacinamide', productType: 'cosmetic', lang: 'en' });
  assert.equal(cosm.cards.novaCard.applicable, false);
});

// 3. Industrial Trans Fat (EU 2019/649) & Hidden Gluten Allergens
t('[Science/Food] Partially Hydrogenated Oil banned (EU 2019/649) & hidden gluten detected', () => {
  const tf = evaluateProduct({
    rawText: 'Wheat Flour, Partially Hydrogenated Soybean Oil, Sugar, Salt',
    productType: 'food',
    lang: 'tr'
  });
  assert.equal(tf.cards.regulatoryCard.capApplied, 10);
  assert.ok(
    tf.cards.regulatoryCard.findings.some(
      (f) => f.substanceId === 'partially_hydrogenated_trans_fat' && f.euStatus === 'yasak'
    )
  );

  const gluten = evaluateProduct({
    rawText: 'Water, Barley Malt Extract, Hydrolyzed Wheat Protein, Seitan, Salt',
    productType: 'food',
    lang: 'en',
    userProfiles: ['astim_alerji']
  });
  assert.equal(gluten.cards.profileCard.profileStatuses.astim_alerji, 'false');
  assert.ok(gluten.cards.profileCard.alerts.some((a) => a.allergenId === 'gluten'));
});

// 4. Expanded Routine Conflict Matrix (6 new rules + Rinse-off Mitigation)
t('[Science/Routine] 6 new layering conflict rules + rinse-off BPO cleanser mitigation work across languages', () => {
  const ahaBha = evaluateProduct({
    rawText: 'Aqua, Glycolic Acid, Salicylic Acid, Glycerin',
    productType: 'cosmetic',
    lang: 'en'
  });
  assert.ok(ahaBha.cards.routineConflictCard.conflicts.some((c) => c.conflictId === 'conflict_aha_bha_stacking'));

  const doubleRet = compareProducts(
    { name: 'Cream A', productType: 'cosmetic', rawText: 'Aqua, Retinol, Glycerin' },
    { name: 'Gel B', productType: 'cosmetic', rawText: 'Aqua, Adapalene, Glycerin' },
    { lang: 'tr' }
  );
  assert.ok(
    doubleRet.routineLayeringCard.conflicts.some(
      (c) => c.conflictId === 'conflict_retinoid_double_stacking' && c.severity === 'kirmizi'
    )
  );

  const bpoVitC = evaluateProduct({
    rawText: 'Aqua, Benzoyl Peroxide, Ascorbic Acid, Glycerin',
    productType: 'cosmetic',
    lang: 'en'
  });
  assert.ok(bpoVitC.cards.routineConflictCard.conflicts.some((c) => c.conflictId === 'conflict_bpo_vitc'));

  const hqBpo = evaluateProduct({
    rawText: 'Aqua, Hydroquinone, Benzoyl Peroxide, Glycerin',
    productType: 'cosmetic',
    lang: 'en'
  });
  assert.ok(hqBpo.cards.routineConflictCard.conflicts.some((c) => c.conflictId === 'conflict_hq_bpo' && c.severity === 'kirmizi'));

  const spfUnstable = evaluateProduct({
    rawText: 'Aqua, Avobenzone, Octinoxate, Glycerin',
    productType: 'cosmetic',
    lang: 'en'
  });
  assert.ok(
    spfUnstable.cards.routineConflictCard.conflicts.some((c) => c.conflictId === 'conflict_avobenzone_octinoxate')
  );

  const spfStable = evaluateProduct({
    rawText: 'Aqua, Avobenzone, Octinoxate, Octocrylene, Glycerin',
    productType: 'cosmetic',
    lang: 'en'
  });
  assert.ok(
    !spfStable.cards.routineConflictCard.conflicts.some((c) => c.conflictId === 'conflict_avobenzone_octinoxate')
  );

  // Rinse-off BPO cleanser + Leave-on Retinol -> downgraded from kirmizi to sari with rinseOffMitigated
  const rinseComp = compareProducts(
    { name: 'PanOxyl Wash', productType: 'cosmetic', applicationType: 'rinse_off', rawText: 'Aqua, Benzoyl Peroxide, Glycerin' },
    { name: 'Night Retinol', productType: 'cosmetic', applicationType: 'leave_on', rawText: 'Aqua, Retinol, Glycerin' },
    { lang: 'en' }
  );
  const bpoRet = rinseComp.routineLayeringCard.conflicts.find(
    (c) => c.conflictId === 'conflict_retinoid_benzoyl_peroxide'
  );
  assert.ok(bpoRet, 'Expected cross-product Retinoid + BPO conflict');
  assert.equal(bpoRet.severity, 'sari');
  assert.equal(bpoRet.rinseOffMitigated, true);
});

// 5. 4-Madhhab Fiqh Layer, New Halal Rules & Non-Pork Beef/Turkey Guards
t('[Halal/Fiqh] 4-Madhhab refinements, blood/insects/D3 rules, and non-pork ham/gelatin false-positive guards', () => {
  const defShrimp = evaluateProduct({ rawText: 'Water, Shrimp, Salt', productType: 'food', halalAuthority: 'IFANCA', lang: 'en' });
  assert.equal(defShrimp.cards.halalCard.overallStatus, 'uygun_gorunuyor');

  const hanafiShrimp = evaluateProduct({
    rawText: 'Water, Shrimp, Salt',
    productType: 'food',
    halalAuthority: 'IFANCA',
    madhhab: 'hanafi',
    lang: 'en'
  });
  assert.equal(hanafiShrimp.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const shafiiShrimp = evaluateProduct({
    rawText: 'Water, Shrimp, Salt',
    productType: 'food',
    halalAuthority: 'GIMDES',
    madhhab: 'shafii',
    lang: 'en'
  });
  assert.equal(shafiiShrimp.cards.halalCard.overallStatus, 'uygun_gorunuyor');

  const shafiiVinegar = evaluateProduct({
    rawText: 'Water, Wine Vinegar, Salt',
    productType: 'food',
    halalAuthority: 'IFANCA',
    madhhab: 'shafii',
    lang: 'en'
  });
  assert.equal(shafiiVinegar.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const malikiVinegar = evaluateProduct({
    rawText: 'Water, Wine Vinegar, Salt',
    productType: 'food',
    halalAuthority: 'GIMDES',
    madhhab: 'maliki',
    lang: 'en'
  });
  assert.equal(malikiVinegar.cards.halalCard.overallStatus, 'uygun_gorunuyor');

  const blood = evaluateProduct({ rawText: 'Water, Blood Plasma, Salt', productType: 'food', lang: 'tr' });
  assert.equal(blood.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const insect = evaluateProduct({
    rawText: 'Wheat Flour, Acheta domesticus, Salt',
    productType: 'food',
    halalAuthority: 'GIMDES',
    lang: 'en'
  });
  assert.equal(insect.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const vitD3Plain = evaluateProduct({ rawText: 'Water, Cholecalciferol', productType: 'food', lang: 'en' });
  assert.equal(vitD3Plain.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');

  const vitD3Vegan = evaluateProduct({
    rawText: 'Water, Cholecalciferol',
    productType: 'food',
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' },
    lang: 'en'
  });
  assert.equal(vitD3Vegan.cards.halalCard.overallStatus, 'uygun_gorunuyor');

  // Beef / turkey ham and halal beef gelatin must NEVER be marked pork Haram
  const beefHamCert = evaluateProduct({
    rawText: 'Dana Jambon, Su, Tuz',
    productType: 'food',
    halalAuthority: 'GIMDES',
    claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' },
    lang: 'tr'
  });
  assert.equal(beefHamCert.cards.halalCard.overallStatus, 'uygun_gorunuyor');
  assert.ok(!beefHamCert.cards.halalCard.findings.some((f) => f.category === 'A_haram'));

  const beefGelUncert = evaluateProduct({
    rawText: 'Sugar, Water, Halal Beef Gelatin',
    productType: 'food',
    halalAuthority: 'GIMDES',
    claims: { halalCertified: false, veganStatus: 'none', vegetarianStatus: 'none' },
    lang: 'en'
  });
  assert.ok(!beefGelUncert.cards.halalCard.findings.some((f) => f.category === 'A_haram'));
  assert.equal(beefGelUncert.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');
});

// 6. Dual Coverage Metric & Data/Locale Hygiene
t('[Data/Hygiene] curatedCoveragePercent present, zero dead/duplicate sources.json, zero general_cautious defaults', () => {
  const res = evaluateProduct({
    rawText: 'Aqua, Niacinamide, Panthenol, Propylparaben',
    productType: 'cosmetic',
    lang: 'en'
  });
  const reg = res.cards.regulatoryCard;
  assert.equal(typeof reg.curatedCoveragePercent, 'number');
  assert.ok(reg.curatedCoveragePercent >= 0 && reg.curatedCoveragePercent <= reg.coveragePercent);

  const sourcesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sources.json'), 'utf8')).sources;
  assert.equal(sourcesJson.REACH_2024_1328, undefined, 'Duplicate REACH_2024_1328 must be removed');
  assert.ok(sourcesJson.EU_2019_649 && sourcesJson.NOVA_MONTEIRO);

  const combined =
    fs.readFileSync(path.join(ROOT, 'src/data/substances.json'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'src/data/halal_rules.json'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'src/data/hidden_sugars.json'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'src/engine/ruleEngine.mjs'), 'utf8');
  for (const sid of Object.keys(sourcesJson)) {
    assert.ok(combined.includes(sid), `Source ${sid} is unused/dead`);
  }

  for (const l of SUPPORTED_LANGUAGES) {
    assert.notEqual(l.defaultAuthority, 'general_cautious', `Locale ${l.code} must not use general_cautious`);
    assert.ok(l.defaultAuthority === 'GIMDES' || l.defaultAuthority === 'JAKIM' || l.defaultAuthority === 'MUI' || l.defaultAuthority === 'IFANCA');
  }
});

// 7. GS1 Check-Digit Export & Mobile Barcode Guard
t('[Security/Barcode] isValidGs1CheckDigit exported and wired into barcodeService.ts with negative cache', () => {
  assert.equal(isValidGs1CheckDigit('3017620422003'), true);
  assert.equal(isValidGs1CheckDigit('3017620422004'), false);
  const bSvc = fs.readFileSync(path.join(ROOT, 'src/mobile/barcodeService.ts'), 'utf8');
  assert.match(bSvc, /isValidGs1CheckDigit/);
  assert.match(bSvc, /negativeBarcodeCache/);
  assert.match(bSvc, /invalid_check_digit/);
});

// 8. Web Static Headers, No External Google Fonts, A11y & Mobile UX Contracts
t('[UX/A11y/Security] build_static_site _headers, Web privacy/a11y/WebShare & Mobile KeyboardAvoidingView/Dark/44dp', () => {
  const bStatic = fs.readFileSync(path.join(ROOT, 'scripts/build_static_site.mjs'), 'utf8');
  assert.match(bStatic, /_headers/);
  assert.match(bStatic, /Content-Security-Policy/);

  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.ok(!/fonts\.googleapis\.com/i.test(html), 'External Google Fonts must be removed from public/index.html');
  assert.match(html, /--line-strong:\s*#8C857A/i);
  assert.match(html, /<main\b[^>]*id="mainContent"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /html\[lang="ur"\]/);

  const mobile = fs.readFileSync(path.join(ROOT, 'src/mobile/ScannerApp.tsx'), 'utf8');
  assert.match(mobile, /KeyboardAvoidingView/);
  assert.match(mobile, /keyboardShouldPersistTaps="handled"/);
  assert.match(mobile, /useColorScheme/);
  assert.match(mobile, /res\.confidence\s*<\s*0\.65/);
  assert.match(mobile, /setTimeout\(\(\)\s*=>\s*handleCameraScan\('camera'\),\s*320\)/);
  assert.match(mobile, /Share\.share/);
  assert.ok(!/topIconSquare:\s*\{\s*width:\s*40/m.test(mobile));
});

console.log(`\n🎉 Phase 3 suite finished: ${passed} checks passed.`);
