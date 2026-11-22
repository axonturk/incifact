import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  DATASET_VERSION,
  RULE_ENGINE_VERSION,
  evaluateProduct,
  evaluateNutriScore,
  evaluateHouseholdProfiles,
  findCleanerAlternativesAndDupes,
  getIngredientDossier,
  compareProducts,
  extractSmartLabelContext,
  lookupBarcodeProduct,
  normalizeBarcodeInput,
  isValidGs1CheckDigit,
  createCustomBarcodeEntry,
  VERIFIED_BARCODE_CATALOG
} from '../src/engine/ruleEngine.mjs';
import {
  decode1dBarcodeFromScanline,
  decode1dBarcodeFromRgba
} from '../src/engine/barcode1dDecoder.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
async function t(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}\n`, err);
    process.exitCode = 1;
  }
}

function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.join(ROOT, relPath);
  const tsSrc = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(tsSrc, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const moduleObj = { exports: {} };
  const customRequire = (spec) => {
    if (Object.hasOwn(mocks, spec)) return mocks[spec];
    return require(spec);
  };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  fn(moduleObj.exports, customRequire, moduleObj, fullPath, path.dirname(fullPath));
  return moduleObj.exports;
}

const L_BITS = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_BITS = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_BITS = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function encodeEanBits(code, quietModules = 10) {
  const q = '0'.repeat(quietModules);
  let bits = q + '101';
  if (code.length === 13) {
    const par = EAN13_PARITY[Number(code[0])];
    for (let i = 0; i < 6; i++) bits += (par[i] === 'L' ? L_BITS : G_BITS)[Number(code[i + 1])];
    bits += '01010';
    for (let i = 0; i < 6; i++) bits += R_BITS[Number(code[i + 7])];
  } else {
    for (let i = 0; i < 4; i++) bits += L_BITS[Number(code[i])];
    bits += '01010';
    for (let i = 0; i < 4; i++) bits += R_BITS[Number(code[i + 4])];
  }
  bits += '101' + q;
  return bits;
}

function bitsToScanline(bits, modulePx = 3, { inverted = false, shadowSlope = 0 } = {}) {
  const len = bits.length * modulePx;
  const row = new Uint8Array(len);
  for (let i = 0; i < bits.length; i++) {
    const isBar = bits[i] === '1';
    for (let p = 0; p < modulePx; p++) {
      const x = i * modulePx + p;
      const ramp = shadowSlope ? Math.round((x / Math.max(1, len - 1)) * shadowSlope) : 0;
      const baseBar = inverted ? 235 : 22;
      const baseSpace = inverted ? 22 : 235;
      const v = (isBar ? baseBar : baseSpace) - ramp;
      row[x] = Math.max(0, Math.min(255, v));
    }
  }
  return row;
}

console.log('======================================================================');
console.log('🚀 PHASE 6 BOOST HARDENING — P0 / P1 / P2 REGRESSION SUITE');
console.log('======================================================================');

// P0-1: getIngredientDossier Zero-Hallucination, Rinse-Off, Top-5 Suppression, Allergens, Watchlist, CosIng
await t('[P0-1/Dossier] Unrecognized -> unknown; rinse-off MI kisitli; Alcohol Denat. pos>5 clean; allergens+watchlist+CosIng', () => {
  // 1a. Unrecognized ingredient must NEVER return green/yesil/uygun
  for (const lang of ['tr', 'en', 'ar', 'de']) {
    const unk = getIngredientDossier('UnverifiedMysteryChemX99', { productType: 'cosmetic', lang });
    assert.equal(unk.isUnrecognized, true, `Expected isUnrecognized=true in ${lang}`);
    assert.equal(unk.euStatus, 'bilinmiyor');
    assert.equal(unk.halalSummary.status, 'unknown', `halalSummary must be unknown in ${lang}`);
    assert.equal(unk.halalSummary.category, 'UNKNOWN');
    for (const board of ['GIMDES', 'JAKIM', 'MUI', 'IFANCA']) {
      assert.equal(unk.authorityMatrix[board], 'unknown', `Board ${board} must be unknown in ${lang}`);
    }
    assert.equal(unk.profileMatrix.length, 7);
    assert.ok(unk.profileMatrix.every((p) => p.status === 'unknown'), `All 7 profiles must be unknown in ${lang}`);
    assert.ok(!/helal kriter|halal criteria|no halal concern/i.test(unk.legalText), `legalText must not leak halalOkDesc in ${lang}`);
  }

  // 1b. Rinse-off Methylisothiazolinone 0.001% must NOT be marked euStatus='yasak'
  const miRinse = getIngredientDossier('Methylisothiazolinone 0.001%', {
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'en'
  });
  assert.equal(miRinse.euStatus, 'kisitli', 'Rinse-off MI 0.001% must be kisitli, not yasak');

  const miLeave = getIngredientDossier('Methylisothiazolinone', {
    productType: 'cosmetic',
    applicationType: 'leave_on',
    lang: 'en'
  });
  assert.equal(miLeave.euStatus, 'yasak', 'Leave-on MI must remain yasak');

  // 1c. Alcohol Denat. at position 12 must suppress sari_ilk5 on hassas_cilt & egzama_rosacea
  const alcPos12 = getIngredientDossier({ raw: 'Alcohol Denat.', position: 12 }, { productType: 'cosmetic', lang: 'en' });
  const hassas12 = alcPos12.profileMatrix.find((p) => p.profile === 'hassas_cilt');
  const egzama12 = alcPos12.profileMatrix.find((p) => p.profile === 'egzama_rosacea');
  assert.equal(hassas12?.status, 'uygun', 'Alcohol Denat. at pos 12 must not show Top-5 hassas_cilt warning');
  assert.equal(egzama12?.status, 'uygun', 'Alcohol Denat. at pos 12 must not show Top-5 egzama_rosacea warning');

  const alcPos2 = getIngredientDossier({ raw: 'Alcohol Denat.', position: 2 }, { productType: 'cosmetic', lang: 'en' });
  const hassas2 = alcPos2.profileMatrix.find((p) => p.profile === 'hassas_cilt');
  assert.ok(hassas2 && hassas2.status !== 'uygun', 'Alcohol Denat. at pos 2 must flag hassas_cilt');

  // 1d. 14 major food allergens flag astim_alerji even when userProfiles is empty
  for (const allergen of ['Peanut', 'Milk', 'Wheat Flour', 'Soy Lecithin']) {
    const d = getIngredientDossier(allergen, { productType: 'food', lang: 'en', userProfiles: [] });
    const allergyProf = d.profileMatrix.find((p) => p.profile === 'astim_alerji');
    assert.equal(allergyProf?.status, 'kirmizi', `Allergen ${allergen} must flag astim_alerji as kirmizi`);
  }

  // 1e. Custom watchlist matches surface in profileMatrix + watchlistMatch
  const wlDossier = getIngredientDossier('Niacinamide', {
    productType: 'cosmetic',
    lang: 'en',
    customWatchlist: ['Niacinamide']
  });
  assert.equal(wlDossier.watchlistMatch, true);
  assert.ok(wlDossier.profileMatrix.some((p) => p.profile === 'ozel_kara_liste' && p.status === 'kirmizi'));

  // 1f. Concentration & Cyrillic/localized tokens resolve CosIng functions
  const retConc = getIngredientDossier('Retinol 0.3%', { productType: 'cosmetic', lang: 'en' });
  assert.ok(retConc.cosingFunctions.length >= 1, 'Retinol 0.3% must populate cosingFunctions');
  assert.ok(retConc.cosingRef, 'Retinol 0.3% must populate cosingRef');

  const ruNiac = getIngredientDossier('Ниацинамид', { productType: 'cosmetic', lang: 'ru' });
  assert.ok(ruNiac.cosingFunctions.length >= 1, 'Cyrillic Ниацинамид must populate cosingFunctions');
  assert.equal(ruNiac.isSuperstar, true, 'Cyrillic Ниацинамид must retain Superstar badge');
});

// P0-2: Open Food Facts Food->Cosmetic, Beverage/Water & Redirect Security (transpiled TS execution!)
await t('[P0-2/OFF] Real barcodeService.ts fixes cream/milk false positives, maps energy_100g/fat_100g/isWater & verifies redirect host', async () => {
  const memStore = new Map();
  const mockAsyncStorage = {
    getItem: async (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: async (k, v) => { memStore.set(k, v); },
    removeItem: async (k) => { memStore.delete(k); },
    multiRemove: async (keys) => { for (const k of keys) memStore.delete(k); }
  };
  const secureMod = loadTsModule('src/mobile/secureStorage.ts', {
    '@react-native-async-storage/async-storage': { default: mockAsyncStorage }
  });
  const barcodeMod = loadTsModule('src/mobile/barcodeService.ts', {
    '@react-native-async-storage/async-storage': { default: mockAsyncStorage },
    '../engine/ruleEngine.mjs': {
      normalizeBarcodeInput,
      isValidGs1CheckDigit,
      lookupBarcodeProduct,
      createCustomBarcodeEntry,
      VERIFIED_BARCODE_CATALOG
    },
    './secureStorage': secureMod
  });

  // 2a. Food cream tags must NEVER be misclassified as cosmetic
  for (const tag of ['en:ice-creams', 'en:cream-cheeses', 'en:whipped-creams', 'en:sour-creams']) {
    assert.equal(
      barcodeMod.resolveOpenFactsProductType({ categories_tags: [tag] }, 'food'),
      'food',
      `${tag} must stay food`
    );
  }
  for (const tag of ['en:cosmetics', 'en:face-creams', 'en:hand-creams', 'en:shampoos', 'en:skin-care']) {
    assert.equal(
      barcodeMod.resolveOpenFactsProductType({ categories_tags: [tag] }, 'food'),
      'cosmetic',
      `${tag} should resolve to cosmetic`
    );
  }

  // 2b. Solid dairy/chocolate/powder tags must NEVER trigger isBeverage
  for (const tag of ['en:milk-chocolates', 'en:milk-powders', 'en:milk-breads', 'en:condensed-milk', 'en:ice-creams']) {
    const nut = barcodeMod.extractNutritionPer100g(
      { categories_tags: [tag], nutriments: { 'energy-kcal_100g': 520, sugars_100g: 48, 'saturated-fat_100g': 18, salt_100g: 0.2 } },
      true
    );
    assert.equal(Boolean(nut.isBeverage), false, `${tag} must NOT be isBeverage`);
  }

  // 2c. Real beverage tags including German de:getränke, chocolate-milk, oat-milk & drinking-yogurt set isBeverage; energy_100g & fat_100g & isWater mapped
  for (const [lbl, tags] of [
    ['de:getränke', ['de:getränke']],
    ['chocolate-milk', ['en:beverages', 'en:dairies', 'en:dairy-drinks', 'en:chocolate-milks']],
    ['oat-milk', ['en:plant-based-foods-and-beverages', 'en:beverages', 'en:cereals-and-their-products', 'en:plant-based-beverages', 'en:milk-substitutes', 'en:oat-milks']],
    ['drinking-yogurt', ['en:beverages', 'en:dairies', 'en:dairy-drinks', 'en:drinking-yogurts']]
  ]) {
    const bev = barcodeMod.extractNutritionPer100g(
      { categories_tags: tags, nutriments: { energy_100g: 180, sugars_100g: 10.6, 'saturated-fat_100g': 0, salt_100g: 0 } },
      true
    );
    assert.equal(bev.isBeverage, true, `${lbl} must set isBeverage=true`);
    assert.equal(bev.energyKj, 180, `OFF energy_100g (kJ) must map to energyKj for ${lbl}`);
    assert.equal(Boolean(bev.isWater), false, `${lbl} must not be plain water`);
  }

  const plainWater = barcodeMod.extractNutritionPer100g(
    { categories_tags: ['en:beverages', 'en:spring-waters'], nutriments: { energy_100g: 0, sugars_100g: 0, 'saturated-fat_100g': 0, salt_100g: 0 } },
    true
  );
  assert.equal(plainWater.isBeverage, true);
  assert.equal(plainWater.isWater, true, 'Plain spring water must set isWater=true');

  const flavoredWater = barcodeMod.extractNutritionPer100g(
    { categories_tags: ['en:waters', 'en:flavored-waters'], nutriments: { energy_100g: 80, sugars_100g: 4.5, 'saturated-fat_100g': 0, salt_100g: 0 } },
    true
  );
  assert.equal(Boolean(flavoredWater.isWater), false, 'Flavored/sweetened water must NOT set isWater=true');

  const offOliveOil = barcodeMod.extractNutritionPer100g(
    { categories_tags: ['en:extra-virgin-olive-oils'], nutriments: { 'energy-kcal_100g': 884, fat_100g: 100, 'saturated-fat_100g': 13.8, sugars_100g: 0, salt_100g: 0 } },
    true
  );
  assert.equal(offOliveOil.totalFatG, 100);
  assert.equal(offOliveOil.category, 'fats_oils_nuts');
  assert.equal(evaluateNutriScore(offOliveOil, { lang: 'en' }).grade, 'B');

  // 2d. Redirect host allowlist guard: evil redirect rejected, same-host HTTPS redirect accepted
  const origFetch = globalThis.fetch;
  try {
    let seenRedirectOpt = null;
    assert.equal(isValidGs1CheckDigit('4000000000013'), true);
    assert.equal(isValidGs1CheckDigit('4000000000020'), true);
    globalThis.fetch = async (_url, opts) => {
      seenRedirectOpt = opts?.redirect;
      return {
        ok: true,
        url: 'https://evil-attacker.example/api/v2/product/4000000000013.json',
        headers: { get: () => null },
        text: async () => JSON.stringify({ status: 1, product: { product_name: 'Hijacked', ingredients_text: 'Aqua, Glycerin' } })
      };
    };
    const evilRes = await barcodeMod.lookupBarcodeOnDevice('4000000000013', 'en', { productType: 'food' }, { enableLiveLookup: true });
    assert.equal(seenRedirectOpt, 'follow');
    assert.equal(evilRes.found, false, 'Off-host redirect must be rejected');

    // Non-standard port & silent redirected empty-URL responses must also be rejected
    globalThis.fetch = async () => ({
      ok: true,
      redirected: true,
      url: 'https://world.openfoodfacts.org:8443/api/v2/product/4000000000037.json',
      headers: { get: () => null },
      text: async () => JSON.stringify({ status: 1, product: { product_name: 'PortSpoof', ingredients_text: 'Aqua, Glycerin' } })
    });
    assert.equal(isValidGs1CheckDigit('4000000000037'), true);
    const portRes = await barcodeMod.lookupBarcodeOnDevice('4000000000037', 'en', { productType: 'food' }, { enableLiveLookup: true });
    assert.equal(portRes.found, false, 'Non-standard port redirect must be rejected');

    globalThis.fetch = async () => ({
      ok: true,
      url: 'https://world.openfoodfacts.org/api/v2/product/4000000000020.json',
      headers: { get: () => null },
      text: async () => JSON.stringify({
        status: 1,
        product: {
          product_name: 'Vanilla Ice Cream',
          categories_tags: ['en:ice-creams', 'en:dairy-desserts'],
          ingredients_text: 'Whole Milk, Sugar, Salt',
          nutriments: { 'energy-kcal_100g': 207, sugars_100g: 21, 'saturated-fat_100g': 6.8, salt_100g: 0.15 }
        }
      })
    });
    const goodRes = await barcodeMod.lookupBarcodeOnDevice('4000000000020', 'en', { productType: 'food' }, { enableLiveLookup: true });
    assert.equal(goodRes.found, true, 'Allowlisted HTTPS Open Food Facts host must succeed');
    assert.equal(goodRes.productType, 'food', 'Ice cream must remain food');
    assert.equal(Boolean(goodRes.nutritionPer100g?.isBeverage), false, 'Ice cream must not be beverage');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// P1-5: Nutri-Score 2023 Scientific Accuracy & Full Food Catalog
await t('[P1-5/NutriScore2023] Exact 15-pt sugar steps, coffee/tea Grade B, FSA drink salt 0.3g, Fats/Oils/Nuts (Olive Oil=B) & 20/20 food catalog', () => {
  // Exact sugar step boundary checks (20, 41, 51)
  const s20 = evaluateNutriScore({ energyKcal: 100, sugarsG: 20.0, saturatedFatG: 0, saltG: 0 });
  const s20_1 = evaluateNutriScore({ energyKcal: 100, sugarsG: 20.1, saturatedFatG: 0, saltG: 0 });
  assert.equal(s20.breakdown.sugarsPts, 5);
  assert.equal(s20_1.breakdown.sugarsPts, 6);

  const s41 = evaluateNutriScore({ energyKcal: 100, sugarsG: 41.0, saturatedFatG: 0, saltG: 0 });
  const s41_1 = evaluateNutriScore({ energyKcal: 100, sugarsG: 41.1, saturatedFatG: 0, saltG: 0 });
  assert.equal(s41.breakdown.sugarsPts, 11);
  assert.equal(s41_1.breakdown.sugarsPts, 12);

  const s51 = evaluateNutriScore({ energyKcal: 100, sugarsG: 51.0, saturatedFatG: 0, saltG: 0 });
  const s51_1 = evaluateNutriScore({ energyKcal: 100, sugarsG: 51.1, saturatedFatG: 0, saltG: 0 });
  assert.equal(s51.breakdown.sugarsPts, 14);
  assert.equal(s51_1.breakdown.sugarsPts, 15);

  // Plain black coffee/tea -> Grade B (not Water Grade A!)
  const blackCoffee = evaluateNutriScore({ energyKcal: 0, sugarsG: 0, saturatedFatG: 0, saltG: 0, isBeverage: true });
  assert.equal(blackCoffee.grade, 'B', 'Plain unsweetened coffee/tea must score B, not Water A');

  // Plain water via raw.isWater (even without explicit isBeverage) or options.isWater -> beverage Grade A
  const waterImplicitBev = evaluateNutriScore({ energyKcal: 0, sugarsG: 0, saturatedFatG: 0, saltG: 0, isWater: true });
  assert.equal(waterImplicitBev.category, 'beverage');
  assert.equal(waterImplicitBev.grade, 'A');
  const waterViaOpt = evaluateNutriScore({ energyKcal: 0, sugarsG: 0, saturatedFatG: 0, saltG: 0, isBeverage: true }, { isWater: true });
  assert.equal(waterViaOpt.grade, 'A');

  // Sugary water with stray isWater: true must NOT bypass penalties
  const sweetWater = evaluateNutriScore({ energyKcal: 36, sugarsG: 9, saturatedFatG: 0, saltG: 0, isBeverage: true, isWater: true });
  assert.notEqual(sweetWater.grade, 'A', 'Sugary drink with stray isWater=true must never score A');

  // UK FSA beverage low-salt threshold = 0.3g (<=0.3 low, <=0.75 medium, >0.75 high)
  assert.equal(evaluateNutriScore({ energyKcal: 20, sugarsG: 2, saturatedFatG: 0, saltG: 0.25, isBeverage: true }).trafficLights.salt.level, 'low');
  assert.equal(evaluateNutriScore({ energyKcal: 20, sugarsG: 2, saturatedFatG: 0, saltG: 0.5, isBeverage: true }).trafficLights.salt.level, 'medium');
  assert.equal(evaluateNutriScore({ energyKcal: 20, sugarsG: 2, saturatedFatG: 0, saltG: 0.8, isBeverage: true }).trafficLights.salt.level, 'high');

  // Fats, Oils, Nuts & Seeds 2023 category: Extra Virgin Olive Oil = Grade B, Walnuts = Grade A, Butter = Grade E
  const oliveCatalog = lookupBarcodeProduct({ barcode: '2010000000137', lang: 'en' });
  assert.equal(oliveCatalog.evaluation.cards.nutriScoreCard.category, 'fats_oils_nuts');
  assert.equal(oliveCatalog.evaluation.cards.nutriScoreCard.grade, 'B', 'Extra Virgin Olive Oil must score B');

  const oliveAuto = evaluateProduct({
    rawText: 'Olive Oil',
    productType: 'food',
    nutritionPer100g: { energyKcal: 884, totalFatG: 100, sugarsG: 0, saturatedFatG: 13.8, saltG: 0 },
    lang: 'en'
  });
  assert.equal(oliveAuto.cards.nutriScoreCard.category, 'fats_oils_nuts');
  assert.equal(oliveAuto.cards.nutriScoreCard.grade, 'B', 'Auto-detected pure Olive Oil must score B');

  const walnuts = evaluateNutriScore({
    category: 'fats_oils_nuts',
    totalFatG: 65,
    saturatedFatG: 6.1,
    sugarsG: 2.6,
    saltG: 0,
    fiberG: 6.7,
    proteinG: 15.2
  });
  assert.equal(walnuts.grade, 'A');

  const butter = evaluateNutriScore({
    category: 'fats_oils_nuts',
    totalFatG: 82,
    saturatedFatG: 51,
    sugarsG: 0.1,
    saltG: 0.1,
    proteinG: 10
  });
  assert.equal(butter.grade, 'E');
  assert.equal(butter.breakdown.proteinPts, 0, 'Fats/oils/nuts N>=7 protein cap must zero protein points');

  // Missing totalFatG in fats_oils_nuts -> Zero-Hallucination unavailable
  const missingTotalFat = evaluateNutriScore({ category: 'fats_oils_nuts', saturatedFatG: 14, sugarsG: 0, saltG: 0 });
  assert.equal(missingTotalFat.available, false);
  assert.ok(missingTotalFat.missingFields.includes('totalFatG'));

  // ALL food entries in VERIFIED_BARCODE_CATALOG must have nutritionPer100g & available Nutri-Score
  const foodEntries = Object.entries(VERIFIED_BARCODE_CATALOG).filter(([, v]) => v.productType === 'food');
  assert.equal(foodEntries.length, 20);
  for (const [code, item] of foodEntries) {
    assert.ok(item.nutritionPer100g, `Food catalog entry ${code} must have nutritionPer100g`);
    const look = lookupBarcodeProduct({ barcode: code, lang: 'en' });
    assert.equal(look.evaluation.cards.nutriScoreCard.available, true, `Catalog ${code} must compute Nutri-Score`);
  }

  // 2010000000168 (Strawberries) and 2010000000175 (Potatoes) must achieve 100% coverage across all 10 langs
  for (const code of ['2010000000168', '2010000000175']) {
    for (const lang of ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur']) {
      const look = lookupBarcodeProduct({ barcode: code, lang });
      assert.equal(look.coveragePercent, 100, `Catalog ${code} must have 100% coverage in ${lang}`);
    }
  }
  assert.match(VERIFIED_BARCODE_CATALOG['2010000000168'].rawText, /Strawberries/i);
  assert.match(VERIFIED_BARCODE_CATALOG['2010000000175'].rawText, /Potatoes/i);
});

// P1-6: Multilingual NOVA 1-4 (DE, FR, RU, AR, UR, ID, MS + English UPF)
await t('[P1-6/NOVA] Multilingual NOVA 4 UPF markers & NOVA 2 culinary markers work across non-ASCII scripts', () => {
  const nova4Cases = [
    ['de', 'Wasser, Modifizierte Stärke, Emulgator, Süßungsmittel'],
    ['fr', 'Eau, Amidon modifié, Émulsifiant, Édulcorant'],
    ['ru', 'Вода, Модифицированный крахмал, Эмульгатор, Подсластитель'],
    ['ar', 'ماء، شراب الجلوكوز، مستحلب'],
    ['ur', 'پانی، ایملسیفائر، مصنوعی مٹھاس'],
    ['id', 'Air, Pengemulsi, Pemanis buatan'],
    ['en', 'Water, Sugar, Taurine, Caramel, Phosphoric Acid, E322'],
    ['de', 'Wasser, E 338, E 150d'],
    ['tr', 'Su, Şeker, E 322']
  ];
  for (const [lang, rawText] of nova4Cases) {
    const ev = evaluateProduct({ rawText, productType: 'food', lang });
    assert.equal(ev.cards.novaCard.group, 4, `Expected NOVA 4 for ${lang}: ${rawText}`);
    assert.ok(ev.cards.novaCard.markers.length >= 1, `Expected NOVA 4 markers for ${lang}`);
  }

  const nova2Cases = [
    ['ar', 'زيت زيتون، ملح'],
    ['ur', 'چینی، نمک'],
    ['ru', 'Оливковое масло, Соль'],
    ['id', 'Minyak zaitun, Garam']
  ];
  for (const [lang, rawText] of nova2Cases) {
    const ev = evaluateProduct({ rawText, productType: 'food', lang });
    assert.equal(ev.cards.novaCard.group, 2, `Expected NOVA 2 culinary for ${lang}: ${rawText}`);
  }
});

// P1-7: Native Plugins & iOS Keychain ThisDeviceOnly
await t('[P1-7/Plugins+SecureStore] ProGuard keeps, dataExtractionRules, Android ML Kit fallback/EXIF/invalidate, iOS row-clustering & secureStorage', async () => {
  const androidHard = require('../plugins/withAndroidHardening.cjs');
  const manifest = { manifest: { application: [{ $: {} }] } };
  androidHard.applyAndroidManifestHardening(manifest);
  assert.equal(manifest.manifest.application[0].$['android:allowBackup'], 'false');
  assert.equal(manifest.manifest.application[0].$['android:dataExtractionRules'], '@xml/data_extraction_rules');
  const xml = androidHard.renderDataExtractionRulesXml();
  assert.ok(xml.includes('<cloud-backup') && xml.includes('<device-transfer>'));

  const pg1 = androidHard.patchProguardRules('# base rules\n', 'com.incifact.app');
  const pg2 = androidHard.patchProguardRules(pg1, 'com.incifact.app');
  assert.equal(pg1, pg2, 'patchProguardRules must be idempotent');
  assert.ok(pg2.includes('-keep class com.incifact.app.MlkitOcrModule'));
  assert.ok(pg2.includes('-keep class com.incifact.app.MlkitOcrPackage'));
  assert.ok(pg2.includes('-keep class com.googlecode.tesseract.android.**'));

  const androidOcr = require('../plugins/withAndroidMlkitOcr.cjs');
  const kt = androidOcr.renderMlkitOcrModuleKt('com.incifact.app');
  assert.ok(kt.includes('override fun invalidate()'));
  assert.ok(kt.includes('ocrExecutor.shutdownNow()'));
  assert.ok(kt.includes('ExifInterface'));
  assert.ok(kt.includes('inSampleSize'));
  assert.ok(kt.includes('tessApi.getUTF8Text()'));
  assert.ok(kt.includes('rawText.lines()'));
  assert.ok(kt.includes('$tessCode+eng'));
  assert.ok(kt.includes('RejectedExecutionException'));
  assert.ok(kt.includes('.traineddata.tmp'));
  assert.match(kt, /runMlkitLatinOcr\(\s*parsedUri,\s*promise,\s*"OCR_SCRIPT_MODEL_MISSING"/);

  const iosOcr = require('../plugins/withIosVisionOcr.cjs');
  const swift = iosOcr.renderVisionOcrSwift();
  assert.ok(swift.includes('sortObservationsByRowClusters'));
  assert.equal(swift.includes('if abs(lhsTop - rhsTop) > 0.015'), false, 'Non-transitive comparator must be removed');
  assert.ok(swift.includes('supportedRecognitionLanguages'));
  assert.ok(swift.includes('resolveOnce'));
  assert.ok(swift.includes('rejectOnce'));
  assert.ok(swift.includes('["ur-PK", "ar-SA", "en-US"]'));

  // Test secureStorage.ts passes keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  const mockAsync = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    multiRemove: async () => {}
  };
  let capturedOpts = null;
  const origExpo = globalThis.expo;
  try {
    globalThis.expo = {
      modules: {
        ExpoSecureStore: {
          AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
          getValueWithKeyAsync: async () => null,
          setValueWithKeyAsync: async (_v, _k, opts) => { capturedOpts = opts; },
          deleteValueWithKeyAsync: async () => {}
        }
      }
    };
    const sec = loadTsModule('src/mobile/secureStorage.ts', {
      '@react-native-async-storage/async-storage': { default: mockAsync }
    });
    await sec.writeSensitiveJson('incifact_test_key', { ok: true });
    assert.deepEqual(capturedOpts, { keychainAccessible: 6 });
  } finally {
    globalThis.expo = origExpo;
  }
});

// P1-8: 1D Barcode Decoder Robustness (1px EAN-8, Shadow Gradient, Inverted Contrast, 3-Row Noise, 90° Vertical)
await t('[P1-8/Barcode1D] 1px EAN-8 (67px), shadow gradient adaptive threshold, inverted bars, 3-row noise & 90° vertical scan', () => {
  // 1px-module EAN-8 (exact 67px without quiet zone!)
  const ean8Bare = bitsToScanline(encodeEanBits('96385074', 0), 1);
  assert.equal(ean8Bare.length, 67);
  assert.deepEqual(decode1dBarcodeFromScanline(ean8Bare), { code: '96385074', format: 'ean_8' });

  // Strong linear shadow gradient (normal 3px-module & wide high-res 18px-module)
  const shadowEan13 = bitsToScanline(encodeEanBits('3017620422003', 8), 3, { shadowSlope: 150 });
  assert.deepEqual(decode1dBarcodeFromScanline(shadowEan13), { code: '3017620422003', format: 'ean_13' });
  const hiResShadow = bitsToScanline(encodeEanBits('3017620422003', 8), 18, { shadowSlope: 150 });
  assert.deepEqual(decode1dBarcodeFromScanline(hiResShadow), { code: '3017620422003', format: 'ean_13' });

  // Inverted contrast (white bars on dark background)
  const invertedUpc = bitsToScanline(encodeEanBits('0036000291452', 10), 3, { inverted: true });
  assert.deepEqual(decode1dBarcodeFromScanline(invertedUpc), { code: '0036000291452', format: 'upc_a' });

  // Noisy RGBA frame: corrupt the exact middle row with salt-and-pepper noise, 3-row average must recover cleanly
  const cleanRow = bitsToScanline(encodeEanBits('3017620422003', 10), 3);
  const w = cleanRow.length;
  const h = 36;
  const noisyRgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = y === 18 ? (x % 2 === 0 ? 0 : 255) : cleanRow[x];
      noisyRgba[idx] = lum;
      noisyRgba[idx + 1] = lum;
      noisyRgba[idx + 2] = lum;
      noisyRgba[idx + 3] = 255;
    }
  }
  assert.deepEqual(decode1dBarcodeFromRgba(noisyRgba, w, h), { code: '3017620422003', format: 'ean_13' });

  // 90-degree vertical barcode in RGBA buffer
  const vertCol = bitsToScanline(encodeEanBits('96385074', 8), 2);
  const vw = 40;
  const vh = vertCol.length;
  const vertRgba = new Uint8ClampedArray(vw * vh * 4);
  for (let y = 0; y < vh; y++) {
    for (let x = 0; x < vw; x++) {
      const idx = (y * vw + x) * 4;
      const lum = vertCol[y];
      vertRgba[idx] = lum;
      vertRgba[idx + 1] = lum;
      vertRgba[idx + 2] = lum;
      vertRgba[idx + 3] = 255;
    }
  }
  assert.deepEqual(decode1dBarcodeFromRgba(vertRgba, vw, vh), { code: '96385074', format: 'ean_8' });
});

// P2-10: Household profileColor, Smart Nutrition Extraction, Alternatives Metadata, Compare Nutri-Score+NOVA & UI Parity
await t('[P2-10/Parity+Science] Household unknown profileColor, smart per-100g OCR extraction, alternatives nutrition, compare & Web/Mobile parity', () => {
  // Household profileColor must be 'unknown' on low coverage (<80%)
  const hhLow = evaluateHouseholdProfiles(
    { rawText: 'Aqua, MysteryA1, MysteryB2, MysteryC3', productType: 'cosmetic', lang: 'en' },
    [{ id: 'm1', name: 'Me', userProfiles: ['hassas_cilt'] }]
  );
  assert.equal(hhLow.members[0].overallColor, 'unknown');
  assert.equal(hhLow.members[0].profileColor, 'unknown');

  // Smart per-100g nutrition extraction across EN/TR/FR + zero-hallucination guard on per-serving only
  const smartTr = extractSmartLabelContext(
    'İçindekiler: Şeker, Palm Yağı, Fındık\n100 g için Enerji ve Besin Öğeleri\nEnerji: 2252 kJ / 539 kcal\nYağ: 30,9 g\nDoymuş Yağ: 10,6 g\nŞekerler: 56,3 g\nLif: 3,5 g\nProtein: 6,3 g\nTuz: 0,11 g'
  );
  assert.ok(smartTr.detectedNutritionPer100g);
  assert.equal(smartTr.detectedNutritionPer100g.energyKcal, 539);
  assert.equal(smartTr.detectedNutritionPer100g.sugarsG, 56.3);
  assert.equal(smartTr.detectedNutritionPer100g.saturatedFatG, 10.6);
  assert.equal(smartTr.detectedNutritionPer100g.saltG, 0.11);
  assert.equal(evaluateNutriScore(smartTr.detectedNutritionPer100g).grade, 'E');

  const smartFrBev = extractSmartLabelContext(
    'Ingrédients: Eau, Sucre\nValeurs nutritionnelles pour 100 ml: Énergie 180 kJ / 42 kcal, Matières grasses 0 g, dont acides gras saturés 0 g, dont sucres 10,6 g, Sel 0 g'
  );
  assert.equal(smartFrBev.detectedNutritionPer100g?.isBeverage, true);
  assert.equal(smartFrBev.detectedNutritionPer100g?.sugarsG, 10.6);

  // Russian (г / ккал / кДж) & Arabic (غ) non-ASCII unit extraction
  const smartRu = extractSmartLabelContext(
    'Состав: Вода, Сахар\nПищевая ценность на 100 г:\nЭнергетическая ценность: 200 ккал / 840 кДж\nЖиры: 10 г\nНасыщенные жиры: 3 г\nСахар: 15 г\nБелки: 4 г\nСоль: 0,5 г'
  );
  assert.ok(smartRu.detectedNutritionPer100g, 'Russian per-100g nutrition must parse cleanly');
  assert.equal(smartRu.detectedNutritionPer100g.energyKcal, 200);
  assert.equal(smartRu.detectedNutritionPer100g.energyKj, 840);
  assert.equal(smartRu.detectedNutritionPer100g.sugarsG, 15);
  assert.equal(smartRu.detectedNutritionPer100g.saltG, 0.5);

  const smartAr = extractSmartLabelContext(
    'المكونات: سكر، حليب\nالقيمة الغذائية لكل 100 غ:\nطاقة: 450 kcal\nدهون: 20 غ\nدهون مشبعة: 8 غ\nسكريات: 35 غ\nبروتين: 6 غ\nملح: 0.4 غ'
  );
  assert.ok(smartAr.detectedNutritionPer100g, 'Arabic per-100g nutrition must parse cleanly');
  assert.equal(smartAr.detectedNutritionPer100g.energyKcal, 450);
  assert.equal(smartAr.detectedNutritionPer100g.sugarsG, 35);
  assert.equal(smartAr.detectedNutritionPer100g.saltG, 0.4);

  // Olive Oil per 100 ml must NOT be misclassified as beverage -> stays fats_oils_nuts Grade B
  const oil100ml = extractSmartLabelContext(
    'Ingredients: Extra Virgin Olive Oil\nNutrition per 100 ml\nEnergy: 828 kcal\nFat: 91.6 g\nSaturated fat: 13 g\nSugars: 0 g\nSalt: 0 g'
  );
  assert.ok(oil100ml.detectedNutritionPer100g);
  assert.equal(Boolean(oil100ml.detectedNutritionPer100g.isBeverage), false, 'Olive oil per 100 ml must NOT be beverage');
  const oil100mlEval = evaluateProduct({
    rawText: 'Extra Virgin Olive Oil',
    productType: 'food',
    nutritionPer100g: oil100ml.detectedNutritionPer100g,
    lang: 'en'
  });
  assert.equal(oil100mlEval.cards.nutriScoreCard.category, 'fats_oils_nuts');
  assert.equal(oil100mlEval.cards.nutriScoreCard.grade, 'B');

  // "Net: 100 ml" before "Nutrition Facts per 100 g" must NOT set isBeverage=true
  const netMlThenG = extractSmartLabelContext(
    'Net: 100 ml\nIngredients: Whole Milk, Sugar\nNutrition Facts per 100 g\nEnergy 200 kcal\nFat 8 g\nSaturated fat 5 g\nSugars 18 g\nSalt 0.2 g'
  );
  assert.ok(netMlThenG.detectedNutritionPer100g);
  assert.equal(Boolean(netMlThenG.detectedNutritionPer100g.isBeverage), false);

  // Per-serving block preceding Per-100g block must extract Per-100g values, NOT per-serving values
  const servingThen100g = extractSmartLabelContext(
    'Ingredients: Oats, Sugar\nNutrition Facts\nPer serving (30g): Energy 120 kcal, Sugars 4 g\nPer 100g: Energy 400 kcal, Sugars 13.3 g, Saturated fat 2 g, Salt 0.5 g'
  );
  assert.equal(servingThen100g.detectedNutritionPer100g?.energyKcal, 400);
  assert.equal(servingThen100g.detectedNutritionPer100g?.sugarsG, 13.3);

  const perServingOnly = extractSmartLabelContext('Ingredients: Wheat Flour, Sugar\nPer serving (30g): Energy 150 kcal, Sugars 12 g');
  assert.equal(perServingOnly.detectedNutritionPer100g, null, 'Per-serving-only text must NOT fabricate per-100g nutrition');

  // findCleanerAlternativesAndDupes returns nutritionPer100g, applicationType, allergenStatement
  const foodAlts = findCleanerAlternativesAndDupes(
    { rawText: 'Sugar, Palm Oil, E120, Gelatin', productType: 'food' },
    { lang: 'en' }
  );
  assert.ok(foodAlts.cleanerAlternatives.length >= 1);
  assert.ok(foodAlts.cleanerAlternatives.every((a) => a.nutritionPer100g && Object.hasOwn(a, 'applicationType') && Object.hasOwn(a, 'allergenStatement')));

  // compareProducts surfaces Nutri-Score + NOVA
  const foodComp = compareProducts(
    {
      name: 'Oat Flour',
      productType: 'food',
      rawText: 'Oat Flour',
      nutritionPer100g: VERIFIED_BARCODE_CATALOG['2010000000144'].nutritionPer100g
    },
    {
      name: 'Nutella',
      productType: 'food',
      rawText: VERIFIED_BARCODE_CATALOG['3017620422003'].rawText,
      nutritionPer100g: VERIFIED_BARCODE_CATALOG['3017620422003'].nutritionPer100g
    },
    { lang: 'en' }
  );
  assert.equal(foodComp.productA.nutriScoreGrade, 'A');
  assert.equal(foodComp.productB.nutriScoreGrade, 'E');
  assert.equal(foodComp.productA.novaGroup, 1);
  assert.equal(foodComp.productB.novaGroup, 4);

  // Web XSS, camera race, favicon, stale 22+, dossier localization & focus contracts
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.equal(/removeShelfItem\('\$\{/.test(html), false, 'Stored DOM XSS inline interpolation in removeShelfItem must be eliminated');
  assert.ok(html.includes('data-shelf-id='), 'removeShelfItem must use data-shelf-id attribute');
  assert.ok(html.includes('^[A-Za-z0-9_-]{1,64}$'), 'sanitizeShelfSchema must enforce strict ID regex');
  assert.ok(html.includes('_webCamSessionToken'), 'Web camera modal must guard async stream races with session token');
  assert.ok(html.includes("document.getElementById('ingredientDossierModal')"));
  assert.ok(html.includes("document.getElementById('webBarcodeCameraModal')"));
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="./assets/incifact-app-icon.svg"'));
  assert.equal(/22\+/.test(html), false, 'Stale 22+ catalog count must be updated to 43+');
  assert.ok(html.includes('43+'));
  assert.equal(/st\.toUpperCase\(\)/.test(html), false, 'Web Dossier must localize 4-authority statuses instead of raw st.toUpperCase()');
  assert.ok(html.includes('nutritionDraftStrings'));
  assert.ok(html.includes('preserveNutritionInputFocus'));

  // Mobile parity & decimal/stale nutrition/memoization contracts
  const mobile = fs.readFileSync(path.join(ROOT, 'src/mobile/ScannerApp.tsx'), 'utf8');
  assert.ok(mobile.includes('nutritionDraftStrings'));
  assert.ok(mobile.includes('applyNutritionObject'));
  assert.ok(mobile.includes("m.overallColor === 'unknown'"));
  assert.ok(mobile.includes('shelfEval.amConflicts'));
  assert.ok(mobile.includes('shelfEval.omnibusAlerts'));
  assert.ok(mobile.includes('alternativesData.dupes'));
  assert.ok(mobile.includes('evalMain.cards.novaCard.markers'));
  assert.ok(mobile.includes('dossierModalData.profileMatrix'));
  assert.ok(mobile.includes('dossierModalData.authorityMatrix'));
  assert.ok(mobile.includes('dossierModalData.sources'));
  assert.ok(mobile.includes('customWatchlist,'));

  // Server hardening source contracts
  const srv = fs.readFileSync(path.join(ROOT, 'server.mjs'), 'utf8');
  assert.equal(srv.includes('ipRequestTimestamps.clear()'), false, 'Rate limiter must use TTL/LRU eviction, not .clear()');
  assert.ok(srv.includes('RULE_ENGINE_VERSION') && srv.includes('DATASET_VERSION'));
  assert.ok(srv.includes("process.on('SIGTERM'") && srv.includes("process.on('SIGINT'"));

  // SW & static site SVG icon inclusion
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.ok(sw.includes('./assets/incifact-app-icon.svg'));
  assert.ok(sw.includes('OPTIONAL_ASSETS'));
  const buildStatic = fs.readFileSync(path.join(ROOT, 'scripts/build_static_site.mjs'), 'utf8');
  assert.ok(buildStatic.includes("'incifact-app-icon.svg'"));

  assert.ok(typeof RULE_ENGINE_VERSION === 'string' && RULE_ENGINE_VERSION.length > 5);
  assert.equal(DATASET_VERSION, '2026.10-omnibus');
});

// P0-3 & P0-4: Live VM execution of public/index.html runtime (XSS schema, decimal/shadow nutrition, compare slots, camera races)
await t('[P0-3+4/WebRuntime] Live execution of index.html shelf XSS guard, decimal nutrition state, compare nutrition & camera race cleanup', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch && scriptMatch[1], 'Inline script block must exist in public/index.html');

  const elements = new Map();
  const makeEl = (id) => {
    const attrs = new Map();
    const el = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      srcObject: null,
      readyState: 0,
      videoWidth: 640,
      videoHeight: 480,
      play: async () => {},
      focus: () => {},
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) || null,
      addEventListener: () => {},
      closest: () => null,
      contains: () => false
    };
    elements.set(id, el);
    return el;
  };
  for (const id of [
    'liveInput',
    'prodType',
    'halalAuth',
    'screenContent',
    'webBarcodeCameraModal',
    'webBarcodeModalTitle',
    'webBarcodeCamStatus',
    'webBarcodeVideo',
    'ingredientDossierModal',
    'ingredientDossierTitle',
    'ingredientDossierBody',
    'ingredientDossierCloseBtn'
  ]) {
    makeEl(id);
  }
  elements.get('prodType').value = 'food';
  elements.get('liveInput').value = 'Oat Flour';
  elements.get('halalAuth').value = 'GIMDES';

  const lsMap = new Map();
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    URL,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    localStorage: {
      getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
      setItem: (k, v) => lsMap.set(k, String(v)),
      removeItem: (k) => lsMap.delete(k)
    },
    navigator: {
      language: 'en-US',
      languages: ['en-US'],
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] })
      }
    },
    location: { protocol: 'http:', hostname: 'localhost', href: 'http://localhost:3456/' },
    document: {
      activeElement: null,
      documentElement: { lang: 'en', dir: 'ltr', setAttribute: () => {}, classList: { toggle: () => {} } },
      body: { classList: { toggle: () => {} } },
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ getContext: () => null, width: 0, height: 0 }),
      addEventListener: () => {}
    },
    window: null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.matchMedia = () => ({ matches: false, addEventListener: () => {} });

  const ctx = vm.createContext(sandbox);
  vm.runInContext(scriptMatch[1], ctx);

  // Stub refreshAll & renderScreen to prevent real HTTP fetches while testing state transitions
  vm.runInContext('refreshAll = async () => {}; renderScreen = () => {};', ctx);

  // 1. Adversarial Stored XSS shelf IDs must be rejected and replaced with safe IDs
  const sanitizedShelf = vm.runInContext(
    `sanitizeShelfSchema([{ id: "a');alert(1)//", name: 'Evil', slot: 'AM', productType: 'cosmetic', rawText: 'Aqua' }, { id: 'valid_id-42', name: 'Ok', slot: 'PM', productType: 'cosmetic', rawText: 'Aqua' }])`,
    ctx
  );
  assert.equal(sanitizedShelf[0].id, 'sh_1', 'Adversarial XSS shelf ID must be replaced');
  assert.equal(sanitizedShelf[1].id, 'valid_id-42', 'Valid shelf ID must be preserved');

  // 2. Decimal entry ("0." -> "0.05") + clearing stale energyKj / sodiumMg / isWater + eraseAllWebData
  vm.runInContext(
    `state.nutritionPer100g = { energyKj: 2200, energyKcal: 526, sodiumMg: 400, isBeverage: true, isWater: true }; state.nutritionDraftStrings = {};`,
    ctx
  );
  vm.runInContext(`onWebNutritionChanged('sugarsG', '0.');`, ctx);
  assert.equal(vm.runInContext(`state.nutritionDraftStrings.sugarsG`, ctx), '0.', 'Typing "0." must preserve raw draft');
  assert.equal(vm.runInContext(`state.nutritionPer100g.sugarsG`, ctx), 0);
  vm.runInContext(`onWebNutritionChanged('sugarsG', '0.05');`, ctx);
  assert.equal(vm.runInContext(`state.nutritionDraftStrings.sugarsG`, ctx), '0.05');
  assert.equal(vm.runInContext(`state.nutritionPer100g.sugarsG`, ctx), 0.05);
  vm.runInContext(`onWebNutritionChanged('energyKcal', '100');`, ctx);
  assert.equal(vm.runInContext(`state.nutritionPer100g.energyKcal`, ctx), 100);
  assert.equal(vm.runInContext(`state.nutritionPer100g.energyKj`, ctx), undefined, 'Editing energyKcal must clear stale energyKj');
  vm.runInContext(`onWebNutritionChanged('saltG', '');`, ctx);
  assert.equal(vm.runInContext(`state.nutritionPer100g.sodiumMg`, ctx), undefined, 'Clearing saltG must clear stale sodiumMg');
  vm.runInContext(`onWebNutritionChanged('isBeverage', false);`, ctx);
  assert.equal(vm.runInContext(`state.nutritionPer100g.isWater`, ctx), undefined, 'Unchecking isBeverage must clear isWater');
  if (sandbox._liveInputDebounce) clearTimeout(sandbox._liveInputDebounce);

  // 3. setCompareSlot preserves food nutritionPer100g
  vm.runInContext(`state.productTitle = 'Oat Flour'; setCompareSlot('A');`, ctx);
  assert.equal(vm.runInContext(`state.customCompareA.nutritionPer100g.energyKcal`, ctx), 100);
  if (sandbox._slotTimer) clearTimeout(sandbox._slotTimer);

  // 4. eraseAllWebData clears both nutritionPer100g & nutritionDraftStrings
  vm.runInContext(`eraseAllWebData();`, ctx);
  assert.equal(vm.runInContext(`state.nutritionPer100g`, ctx), null);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(state.nutritionDraftStrings)`, ctx)), {});

  // 5. Camera cancel-during-getUserMedia race stops resolved tracks immediately
  let resolveGUM1;
  let stopped1 = 0;
  sandbox.navigator.mediaDevices.getUserMedia = () =>
    new Promise((res) => {
      resolveGUM1 = () => res({ getTracks: () => [{ stop: () => { stopped1++; } }] });
    });
  const camP1 = vm.runInContext(`openWebBarcodeCameraModal()`, ctx);
  vm.runInContext(`stopWebBarcodeCamera()`, ctx);
  resolveGUM1();
  await camP1;
  assert.equal(stopped1, 1, 'Stream resolved after stopWebBarcodeCamera() must stop its tracks immediately');

  // 6. Camera double-open race: Session 1 stale vid.play() rejection must NOT kill Session 2's live stream!
  let rejectPlay1;
  let resolvePlay1Started;
  const play1Started = new Promise((res) => {
    resolvePlay1Started = res;
  });
  let stoppedA = 0;
  let stoppedB = 0;
  let gumCall = 0;
  sandbox.navigator.mediaDevices.getUserMedia = async () => {
    gumCall++;
    if (gumCall === 1) return { getTracks: () => [{ stop: () => { stoppedA++; } }] };
    return { getTracks: () => [{ stop: () => { stoppedB++; } }] };
  };
  let playCall = 0;
  elements.get('webBarcodeVideo').play = () => {
    playCall++;
    if (playCall === 1) {
      resolvePlay1Started();
      return new Promise((_res, rej) => {
        rejectPlay1 = () => rej(new Error('AbortError'));
      });
    }
    return Promise.resolve();
  };
  // Force BarcodeDetector to throw so Session 2 tests automatic fallback to pure-JS decoder too
  sandbox.BarcodeDetector = function ThrowingDetector() {
    throw new Error('Unsupported formats');
  };
  vm.runInContext(`getBrowserBarcode1dDecoder = async () => { __fallbackCalls++; return { decode1dBarcodeFromRgba: () => null }; };`, ctx);
  sandbox.__fallbackCalls = 0;

  const pSess1 = vm.runInContext(`openWebBarcodeCameraModal()`, ctx);
  await play1Started;
  const pSess2 = vm.runInContext(`openWebBarcodeCameraModal()`, ctx);
  await pSess2;
  rejectPlay1();
  await pSess1;
  const fallbackLoaderCalls = sandbox.__fallbackCalls;

  assert.ok(stoppedA >= 1, 'Session 1 superseded stream must be stopped');
  assert.equal(stoppedB, 0, 'Session 2 live stream must NOT be killed by Session 1 stale AbortError');
  assert.equal(fallbackLoaderCalls, 1, 'Throwing BarcodeDetector must automatically fall back to pure-JS 1D decoder');
  vm.runInContext(`stopWebBarcodeCamera()`, ctx);
  assert.equal(stoppedB, 1, 'Closing modal must cleanly stop Session 2 stream');

  // 7. openIngredientDossierModal on unrecognized ingredient in 'en' localizes 4-authority statuses (no Turkish leak)
  sandbox.__engMock = { getIngredientDossier };
  vm.runInContext(`
    getBrowserRuleEngine = async () => __engMock;
    state.lang = 'en';
    state.evalData = {
      dir: 'ltr',
      productType: 'cosmetic',
      applicationType: 'leave_on',
      locale: {
        badges: { halalOk: 'Halal OK', halalRed: 'Haram', musbooh: 'Doubtful', conflict: 'Conflict' },
        profileScreen: { profiles: {} }
      },
      observations: [{ raw: 'MysteryCompoundZ99', position: 1, status: 'unrecognized' }]
    };
  `, ctx);
  await vm.runInContext(`openIngredientDossierModal(1)`, ctx);
  const dossierBodyHtml = elements.get('ingredientDossierBody').innerHTML;
  assert.ok(dossierBodyHtml.includes('GIMDES: Unknown'), 'Web Dossier must localize unknown authority status in EN');
  assert.equal(/\b(?:YESIL|SARI|KIRMIZI)\b/.test(dossierBodyHtml), false, 'Web Dossier must never leak raw Turkish status codes');
});

console.log(`\n🎉 Phase 6 Boost Hardening suite finished: ${passed} groups passed.`);
