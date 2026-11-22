import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  evaluateProduct,
  evaluateNutriScore,
  getIngredientDossier,
  lookupBarcodeProduct,
  isValidGs1CheckDigit,
  VERIFIED_BARCODE_CATALOG
} from '../src/engine/ruleEngine.mjs';
import {
  decode1dBarcodeFromScanline,
  decode1dBarcodeFromRgba,
  isValidGs1Mod10
} from '../src/engine/barcode1dDecoder.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function t(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}\n`, err);
    process.exitCode = 1;
  }
}

const L_BITS = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_BITS = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_BITS = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function encodeEanBits(code) {
  let bits = '000000000000' + '101';
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
  bits += '101' + '000000000000';
  return bits;
}

function bitsToScanline(bits, modulePx = 3) {
  const row = new Uint8Array(bits.length * modulePx);
  for (let i = 0; i < bits.length; i++) {
    const lum = bits[i] === '1' ? 18 : 238;
    for (let p = 0; p < modulePx; p++) {
      row[i * modulePx + p] = lum;
    }
  }
  return row;
}

function scanlineToRgba(row, height = 36) {
  const width = row.length;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = row[x];
      rgba[idx] = lum;
      rgba[idx + 1] = lum;
      rgba[idx + 2] = lum;
      rgba[idx + 3] = 255;
    }
  }
  return { rgba, width, height };
}

console.log('======================================================================');
console.log('🏁 PHASE 5 CLOSING, 1D BARCODE DECODER, NUTRI-SCORE 2023 & OCR SUITE');
console.log('======================================================================');

// 1. Pure-JS 1D Barcode Decoder (Safari/Firefox fallback)
t('[Barcode1D] Pure-JS decoder decodes EAN-13, UPC-A & EAN-8 forward/reversed/RGBA & rejects invalid check digit', () => {
  assert.equal(isValidGs1Mod10('8683310222427'), true);
  assert.equal(isValidGs1Mod10('8683310222428'), false);

  for (const [code, expectedFmt] of [
    ['3017620422003', 'ean_13'],
    ['0036000291452', 'upc_a'],
    ['96385074', 'ean_8']
  ]) {
    const scanline = bitsToScanline(encodeEanBits(code), 3);
    const fwd = decode1dBarcodeFromScanline(scanline);
    assert.deepEqual(fwd, { code, format: expectedFmt }, `Forward decode failed for ${code}`);

    const rev = new Uint8Array(scanline).reverse();
    const back = decode1dBarcodeFromScanline(rev);
    assert.deepEqual(back, { code, format: expectedFmt }, `Reversed upside-down decode failed for ${code}`);

    const { rgba, width, height } = scanlineToRgba(scanline, 36);
    const rgbaHit = decode1dBarcodeFromRgba(rgba, width, height);
    assert.deepEqual(rgbaHit, { code, format: expectedFmt }, `RGBA band decode failed for ${code}`);
  }

  // Corrupt the check digit by modifying last digit module encoding -> must return null
  const invalidEan13 = '3017620422004';
  const invalidRow = bitsToScanline(encodeEanBits(invalidEan13), 3);
  assert.equal(decode1dBarcodeFromScanline(invalidRow), null, 'Invalid GS1 check digit must be rejected');
});

// 2. Official Nutri-Score 2023 Algorithm + Zero-Hallucination Guard
t('[NutriScore] Evaluates 2023 grades A-E, beverage sweetener penalty, 10 langs & zero-hallucination missing data', () => {
  const gradeA = evaluateNutriScore(
    { energyKcal: 368, sugarsG: 1.1, saturatedFatG: 1.2, saltG: 0.01, fiberG: 9.8, proteinG: 13.2 },
    { lang: 'en' }
  );
  assert.equal(gradeA.available, true);
  assert.equal(gradeA.grade, 'A');

  const gradeB = evaluateNutriScore(
    { energyKcal: 64, sugarsG: 4.5, saturatedFatG: 2.3, saltG: 0.13, fiberG: 0, proteinG: 4.2 },
    { lang: 'tr' }
  );
  assert.equal(gradeB.grade, 'B');

  const gradeC = evaluateNutriScore(
    { energyKcal: 250, sugarsG: 8.0, saturatedFatG: 2.5, saltG: 0.7, fiberG: 0, proteinG: 3.0 },
    { lang: 'de' }
  );
  assert.equal(gradeC.grade, 'C');

  const gradeD = evaluateNutriScore(
    { energyKcal: 360, sugarsG: 18, saturatedFatG: 5.5, saltG: 0.8, fiberG: 1.0, proteinG: 2.0 },
    { lang: 'fr' }
  );
  assert.equal(gradeD.grade, 'D');

  const gradeE = evaluateNutriScore(
    { energyKcal: 539, sugarsG: 56.3, saturatedFatG: 10.6, saltG: 0.107, fiberG: 3.5, proteinG: 6.3 },
    { lang: 'es' }
  );
  assert.equal(gradeE.grade, 'E');

  // Beverages: Plain water -> A; diet soda with artificial sweeteners gets +4 penalty and cannot score A
  const water = evaluateNutriScore(
    { energyKcal: 0, sugarsG: 0, saturatedFatG: 0, saltG: 0, isBeverage: true, isWater: true },
    { lang: 'en' }
  );
  assert.equal(water.grade, 'A');

  const dietCola = evaluateProduct({
    rawText: 'Aqua, Carbon Dioxide, E150d, Phosphoric Acid, Aspartame, Acesulfame K',
    productType: 'food',
    nutritionPer100g: { energyKcal: 0.4, sugarsG: 0, saturatedFatG: 0, saltG: 0.02, isBeverage: true },
    lang: 'en'
  });
  const nsCola = dietCola.cards.nutriScoreCard;
  assert.equal(nsCola.available, true);
  assert.equal(nsCola.breakdown.sweetenerPts, 4);
  assert.notEqual(nsCola.grade, 'A');

  // Missing required fields -> zero hallucination, base regulatory score untouched
  const noNutri = evaluateProduct({
    rawText: 'Wheat Flour, Sugar, Salt',
    productType: 'food',
    lang: 'tr'
  });
  const withNutri = evaluateProduct({
    rawText: 'Wheat Flour, Sugar, Salt',
    productType: 'food',
    nutritionPer100g: { energyKcal: 420, sugarsG: 32, saturatedFatG: 8, saltG: 1.8 },
    lang: 'tr'
  });
  assert.equal(noNutri.cards.nutriScoreCard.available, false);
  assert.equal(noNutri.cards.nutriScoreCard.grade, null);
  assert.equal(noNutri.cards.regulatoryCard.score, withNutri.cards.regulatoryCard.score);

  for (const lang of ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur']) {
    const localized = evaluateNutriScore(
      { energyKcal: 539, sugarsG: 56.3, saturatedFatG: 10.6, saltG: 0.107 },
      { lang }
    );
    assert.ok(localized.cardTitle.length > 5);
    assert.ok(localized.trafficLights.sugars.title.length > 1);
  }
});

// 3. Expanded Verified Barcode Catalog (36+) & Nutri-Score integration
t('[Catalog] VERIFIED_BARCODE_CATALOG expanded >=36 with valid check digits and food nutrition metadata', () => {
  const keys = Object.keys(VERIFIED_BARCODE_CATALOG);
  assert.ok(keys.length >= 36, `Expected >=36 catalog items, got ${keys.length}`);
  for (const code of keys) {
    assert.equal(isValidGs1CheckDigit(code), true, `Invalid GS1 check digit in catalog: ${code}`);
  }
  const waterRes = lookupBarcodeProduct({ barcode: '2010000000106', lang: 'en' });
  assert.equal(waterRes.found, true);
  assert.equal(waterRes.evaluation.cards.nutriScoreCard.grade, 'A');

  const nutellaRes = lookupBarcodeProduct({ barcode: '3017620422003', lang: 'tr' });
  assert.equal(nutellaRes.found, true);
  assert.equal(nutellaRes.evaluation.cards.nutriScoreCard.grade, 'E');
});

// 4. Multi-Script OCR Plugins (Android Tesseract Fallback + iOS ur-PK/RTL + ocrService.ts)
t('[OCR/MultiScript] Android tesseract4android fallback & iOS ur-PK RTL support wired cleanly', () => {
  const androidPlugin = require('../plugins/withAndroidMlkitOcr.cjs');
  const gradleSample = 'dependencies {\n    implementation("com.facebook.react:react-android")\n}\n';
  const g1 = androidPlugin.patchAppBuildGradle(gradleSample);
  const g2 = androidPlugin.patchAppBuildGradle(g1);
  assert.equal(g1, g2);
  assert.ok(g2.includes('com.google.mlkit:text-recognition:16.0.1'));
  assert.ok(g2.includes('cz.adaptech.tesseract4android:tesseract4android:4.7.0'));

  const modKt = androidPlugin.renderMlkitOcrModuleKt('com.incifact.app');
  assert.ok(modKt.includes('fun detectFromUriWithLang('));
  assert.ok(modKt.includes('TessBaseAPI'));
  assert.ok(modKt.includes('OCR_SCRIPT_MODEL_MISSING'));

  const iosPlugin = require('../plugins/withIosVisionOcr.cjs');
  const swift = iosPlugin.renderVisionOcrSwift();
  const objc = iosPlugin.renderVisionOcrObjcBridge();
  assert.ok(swift.includes('"ur-PK"'));
  assert.ok(swift.includes('detectFromUriWithLang'));
  assert.ok(swift.includes('boundingBox.maxX > rhs.boundingBox.maxX'));
  assert.ok(objc.includes('RCT_EXTERN_METHOD(detectFromUriWithLang:'));

  const ocrTs = fs.readFileSync(path.join(ROOT, 'src/mobile/ocrService.ts'), 'utf8');
  assert.match(ocrTs, /detectFromUriWithLang/);
  assert.match(ocrTs, /OCR_SCRIPT_MODEL_MISSING/);

  const bSvcTs = fs.readFileSync(path.join(ROOT, 'src/mobile/barcodeService.ts'), 'utf8');
  assert.match(bSvcTs, /nutriments/);
  assert.match(bSvcTs, /extractNutritionPer100g/);
});

// 5. SW, CI, Web Fallback & Asset Cleanup Hygiene
t('[Hygiene/Web] sw.js v2026.11-2, ci.yml 12 suites + typecheck, Safari barcode fallback & asset cleanup', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.match(sw, /incifact-pwa-v2026\.11-[2-9]/);
  assert.match(sw, /barcode1dDecoder\.mjs/);
  assert.match(sw, /nutriScore\.mjs/);

  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /12 suites/);
  assert.match(ci, /npm run typecheck/);

  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.match(html, /barcode1dDecoder\.mjs/);
  assert.match(html, /camFallbackScan/);
  assert.match(html, /nutriScoreCard/);
  assert.match(html, /foodNutritionDetails/);

  const soyDossier = getIngredientDossier('Lecithins (Soya)', { productType: 'food', lang: 'tr' });
  assert.equal(typeof soyDossier.cleanerSwapTip, 'string');
  assert.ok(soyDossier.cleanerSwapTip.includes('Ayçiçek'), `Expected Sunflower Lecithin tip, got: ${soyDossier.cleanerSwapTip}`);
  assert.equal(soyDossier.cleanerSwapTip.includes('undefined'), false, 'cleanerSwapTip must never render undefined');

  assert.equal(fs.existsSync(path.join(ROOT, 'public/assets/incifact-app-icon.svg')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/icon.png')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/adaptive-icon.png')), true);

  const pubRemaining = fs.readdirSync(path.join(ROOT, 'public/assets'));
  assert.equal(pubRemaining.some((f) => f.startsWith('chatgpt_dalle_')), false, 'Unused DALL-E images must be cleaned');
  assert.equal(pubRemaining.length, 7);

  const rootRemaining = fs.readdirSync(path.join(ROOT, 'assets'));
  assert.equal(rootRemaining.length, 2);
});

console.log('\n🎉 Phase 5 suite finished cleanly.');
