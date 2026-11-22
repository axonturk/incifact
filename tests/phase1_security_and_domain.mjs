import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  evaluateProduct,
  parseIngredientList,
  compareProducts,
  lookupBarcodeProduct,
  VERIFIED_BARCODE_CATALOG
} from '../src/engine/ruleEngine.mjs';

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

function evalCosmetic(rawText, extra = {}) {
  return evaluateProduct({
    rawText,
    productType: 'cosmetic',
    jurisdiction: 'EU',
    lang: 'en',
    ...extra
  });
}

function evalFood(rawText, extra = {}) {
  return evaluateProduct({
    rawText,
    productType: 'food',
    jurisdiction: 'EU',
    lang: 'tr',
    ...extra
  });
}

console.log('======================================================================');
console.log('🛡️  PHASE 1 SECURITY, HALAL FIQH & SCIENTIFIC REGRESSION SUITE');
console.log('======================================================================');

// 1. SEC-01 ReDoS & Parser Bounds
t('[SEC-01] Nested/unclosed (SIN ...) ReDoS finishes < 50ms & token count capped <= 6000', () => {
  parseIngredientList('Aqua, Glycerin');
  const redosInput = 'Sugar, ' + '(SIN 412, '.repeat(250) + 'Water';
  const t0 = performance.now();
  const parsed = parseIngredientList(redosInput);
  const dt = performance.now() - t0;
  assert.ok(dt < 50, `Expected ReDoS guard < 50ms, took ${dt.toFixed(1)}ms`);
  assert.ok(Array.isArray(parsed) && parsed.length > 0);

  const manyTokens = Array.from({ length: 7000 }, (_, i) => `Aqua_${i}`).join(', ');
  const bounded = parseIngredientList(manyTokens);
  assert.ok(bounded.length <= 6000, `Expected parsed tokens <= 6000, got ${bounded.length}`);
});

// 2. SEC-03 Prototype Pollution / Invalid Option Fallback
t('[SEC-03] Prototype keys & invalid option values never crash evaluateProduct/compareProducts/lookupBarcodeProduct', () => {
  const taintedConfirmations = Object.assign(Object.create({ BHA: 'bha_antioxidant' }), {});
  const res = evaluateProduct({
    rawText: 'Aqua, Glycerin, BHA',
    productType: '__proto__',
    jurisdiction: 'toString',
    halalAuthority: 'valueOf',
    lang: 'constructor',
    userConfirmations: taintedConfirmations
  });
  assert.equal(res.productType, 'cosmetic');
  assert.equal(res.cards.halalCard.selectedAuthority, 'general_cautious');
  // Inherited BHA on Object.create prototype must NOT resolve standalone BHA ambiguity!
  assert.ok(res.unresolvedConfirmations.length >= 1);

  const comp = compareProducts(
    { rawText: 'Aqua, Glycerin', name: 'A' },
    { rawText: 'Aqua, Parfum', name: 'B' },
    { lang: 'toString' }
  );
  assert.ok(comp.productA && comp.productB);

  const bRes = lookupBarcodeProduct({ barcode: '3017620422003', lang: '__proto__' });
  assert.equal(bRes.valid, true);
  assert.equal(bRes.found, true);
});

// 3. CosIng Porcine / Animal Classifier & Plant Squalane Guard
t('[Halal/CosIng] Porcine Placenta & Lard -> uyugunsuz_bulgu; Hydrolyzed Keratin -> musbooh; Olive Squalane -> halal ok', () => {
  const porcine = evalCosmetic('Aqua, Porcine Placenta, Glycerin');
  assert.equal(porcine.cards.halalCard.overallStatus, 'uygunsuz_bulgu');
  assert.ok(porcine.cards.halalCard.findings.some((f) => f.category === 'A_haram'));

  const lard = evalCosmetic('Aqua, Lard, Glycerin');
  assert.equal(lard.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const keratin = evalCosmetic('Aqua, Hydrolyzed Keratin, Glycerin');
  assert.equal(keratin.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');

  const plantSq = evalCosmetic('Aqua, Squalane (Olive), Panthenol, Niacinamide, Tocopherol');
  assert.equal(plantSq.cards.halalCard.overallStatus, 'uygun_gorunuyor');
});

// 4. Halal Cross-Contamination Scanner & Alcohol-free / Isopropyl Negation
t('[Halal/CrossContact] Traces of alcohol / Domuz jelatini izi -> musbooh; Alcohol-free & Isopropyl Alcohol -> clean', () => {
  const alcoholTrace = evalFood('Sugar, Cocoa. May contain traces of alcohol', { lang: 'en' });
  assert.equal(alcoholTrace.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');
  assert.ok(alcoholTrace.cards.halalCard.findings.some((f) => f.ruleId === 'halal_cross_contamination'));

  const porkTraceTr = evalFood('Şeker, Kakao. Domuz jelatini izi içerebilir', { lang: 'tr' });
  assert.equal(porkTraceTr.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');
  assert.ok(porkTraceTr.cards.halalCard.findings.some((f) => f.ruleId === 'halal_cross_contamination'));

  const alkFree = evalFood('Water, Sugar, Alcohol-free vanilla flavor', { lang: 'en' });
  assert.notEqual(alkFree.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const ipa = evaluateProduct({
    rawText: 'Water, Glycerin, Isopropyl Alcohol',
    productType: 'food',
    halalAuthority: 'GIMDES'
  });
  assert.ok(!ipa.cards.halalCard.findings.some((f) => f.ruleId === 'ethanol_cosmetic_or_food'));
});

// 5. Phase 1 Halal Rule Splits (Fish Gelatin, Cheese Rennet, Crustaceans/Chitosan, Lipase/Pepsin/Cholesterol)
t('[Halal/Fiqh] Fish Gelatin ok, Cheddar Cheese musbooh, Shrimp/Chitosan shellfish_molluscs_fiqh, Lipase vs Pepsin/Cholesterol', () => {
  const fishGel = evalFood('Sugar, Water, Fish Gelatin, Citric Acid');
  assert.equal(fishGel.cards.halalCard.overallStatus, 'uygun_gorunuyor');
  assert.ok(fishGel.cards.halalCard.findings.some((f) => f.ruleId === 'fish_gelatin_halal'));

  const cheese = evalFood('Milk, Cheddar Cheese, Salt');
  assert.equal(cheese.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');
  assert.ok(cheese.cards.halalCard.findings.some((f) => f.ruleId === 'cheese_rennet_unspecified'));

  const shrimp = evalFood('Water, Shrimp, Salt');
  assert.ok(shrimp.cards.halalCard.findings.some((f) => f.ruleId === 'shellfish_molluscs_fiqh'));

  const chitosan = evalCosmetic('Aqua, Chitosan, Glycerin');
  assert.ok(chitosan.cards.halalCard.findings.some((f) => f.ruleId === 'shellfish_molluscs_fiqh'));

  const lipaseVegan = evalFood('Milk, Lipase, Salt', {
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
  });
  const lipF = lipaseVegan.cards.halalCard.findings.find((f) => f.ruleId === 'microbial_or_animal_lipase');
  assert.ok(lipF && lipF.status === 'yesil');

  const pepsinVegan = evalFood('Milk, Pepsin, Salt', {
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
  });
  const pepF = pepsinVegan.cards.halalCard.findings.find((f) => f.ruleId === 'animal_enzymes_pepsin_lipase');
  assert.ok(pepF && pepF.status === 'conflict');

  const cholVegan = evalCosmetic('Aqua, Cholesterol, Glycerin', {
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
  });
  const cholF = cholVegan.cards.halalCard.findings.find((f) => f.ruleId === 'cholesterol_lipid');
  assert.ok(cholF && cholF.status !== 'yesil');
});

// 6. EU 2023/1545 Fragrance Allergens (12 newly added aliases) + Cosmetic vs Food Vanillin
t('[EU 2023/1545] 12 expanded fragrance allergens recognized + cosmetic Vanillin alert vs food Vanillin clean', () => {
  const newAllergens = [
    'Oakmoss Extract',
    'Treemoss Extract',
    'Pinus Mugo',
    'Cedrus Atlantica Oil',
    'Alpha-Pinene',
    'Sandalwood Oil',
    'Clove Oil',
    'Carvone',
    'Geranium Oil',
    'Ylang Ylang Oil',
    'Linalyl Acetate',
    'Terpineol'
  ];
  const res = evalCosmetic(`Aqua, ${newAllergens.join(', ')}, Glycerin`, {
    userProfiles: ['hassas_cilt']
  });
  assert.equal(res.cards.regulatoryCard.coveragePercent, 100);
  assert.ok(res.cards.profileCard.alerts.some((a) => a.profile === 'hassas_cilt'));

  const cosVanillin = evalCosmetic('Aqua, Vanillin, Glycerin', { userProfiles: ['hassas_cilt'] });
  assert.equal(cosVanillin.cards.profileCard.profileStatuses.hassas_cilt, 'false');
  assert.ok(cosVanillin.cards.profileCard.alerts.some((a) => a.level === 'sari'));

  const foodVanillin = evalFood('Sugar, Cocoa, Vanillin', { userProfiles: ['hassas_cilt'] });
  assert.equal(foodVanillin.cards.profileCard.alerts.length, 0);
});

// 7. Enforced 6 EU Concentration/Form Limits + Non-Banned Text Localization Guard
t('[EU Limits] Homosalate, Benzophenone-3, BHT, Propylparaben, Salicylic Acid, D5/D6 enforce bans over limit & keep clean text under limit', () => {
  const overLimitCases = [
    evalCosmetic('Aqua, Homosalate 10%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Body Lotion: Aqua, Homosalate 5%, Glycerin'),
    evalCosmetic('Aqua, Homosalate 5%, Glycerin', { applicationType: 'spray' }),
    evalCosmetic('Aqua, Benzophenone-3 7%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Body Lotion: Aqua, Benzophenone-3 3%, Glycerin'),
    evalCosmetic('Aqua, BHT 1.0%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Toothpaste: Aqua, BHT 0.2%, Glycerin'),
    evalCosmetic('Mouthwash: Aqua, BHT 0.01%, Glycerin'),
    evalCosmetic('Aqua, Propylparaben 0.2%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Baby Nappy Cream: Aqua, Propylparaben, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Salicylic Acid 2.5%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Body Lotion: Aqua, Salicylic Acid 1.0%, Glycerin'),
    evalCosmetic('Baby Cream: Aqua, Salicylic Acid, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Cyclopentasiloxane 0.5%, Glycerin', { applicationType: 'rinse_off' })
  ];
  for (const r of overLimitCases) {
    assert.equal(r.cards.regulatoryCard.capApplied, 10, `Expected capApplied=10 for: ${r.cards.regulatoryCard.findings.map((f) => f.rawToken).join(', ')}`);
    assert.equal(r.cards.regulatoryCard.score, 10);
  }

  const underLimitCases = [
    evalCosmetic('Aqua, Homosalate 5%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Benzophenone-3 4%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, BHT 0.5%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Propylparaben 0.1%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Salicylic Acid 1.5%, Glycerin', { applicationType: 'leave_on' }),
    evalCosmetic('Aqua, Cyclopentasiloxane 0.5%, Glycerin', { applicationType: 'leave_on' })
  ];
  for (const r of underLimitCases) {
    assert.equal(r.cards.regulatoryCard.capApplied, null);
    assert.notEqual(r.cards.regulatoryCard.score, 10);
    for (const f of r.cards.regulatoryCard.findings) {
      if (f.euStatus !== 'yasak') {
        assert.ok(!/is prohibited/i.test(f.legalText || ''), `Legal text for ${f.substanceId} must not say prohibited when kisitli: ${f.legalText}`);
      }
    }
  }
});

// 8. Endocrine / Sensitizer Profiles (Triclosan, Triclocarban, Genistein, Daidzein) & BIT
t('[Profiles/BIT] Triclosan/Triclocarban/Genistein/Daidzein alert hamilelik & cocuk_metabolik; BIT cites EU_1223_2009 & profiles', () => {
  for (const active of ['Triclosan', 'Triclocarban', 'Genistein', 'Daidzein']) {
    const r = evalCosmetic(`Aqua, ${active}, Glycerin`, { userProfiles: ['hamilelik', 'cocuk_metabolik'] });
    assert.equal(r.cards.profileCard.profileStatuses.hamilelik, 'false', `${active} hamilelik`);
    assert.equal(r.cards.profileCard.profileStatuses.cocuk_metabolik, 'false', `${active} cocuk_metabolik`);
  }

  const bit = evalCosmetic('Aqua, Benzisothiazolinone, Glycerin', {
    userProfiles: ['hassas_cilt', 'astim_alerji']
  });
  const bitFinding = bit.cards.regulatoryCard.findings.find((f) => f.substanceId === 'benzisothiazolinone');
  assert.ok(bitFinding && bitFinding.sources.some((s) => s.id === 'EU_1223_2009'));
  assert.equal(bit.cards.profileCard.profileStatuses.hassas_cilt, 'false');
  assert.equal(bit.cards.profileCard.profileStatuses.astim_alerji, 'false');
});

// 9. GS1 Test Barcodes & Removal of Commercial Prefix SKUs
t('[Barcodes] Synthetic fixtures use GS1 200-299 test range; legacy commercial SKUs removed', () => {
  for (const gs1 of ['2000000000015', '2000000000022', '2000000000039', '2000000000046']) {
    assert.ok(Object.hasOwn(VERIFIED_BARCODE_CATALOG, gs1), `Expected GS1 test barcode ${gs1}`);
    const look = lookupBarcodeProduct({ barcode: gs1, lang: 'en' });
    assert.equal(look.valid, true);
    assert.equal(look.found, true);
  }
  for (const oldCode of ['8690504011507', '5900000202501', '4005808811137', '0000000000017']) {
    assert.equal(Object.hasOwn(VERIFIED_BARCODE_CATALOG, oldCode), false, `Old synthetic SKU ${oldCode} must be removed`);
  }
});

console.log(`\n🎉 Phase 1 suite finished: ${passed}/9 groups passed.`);
