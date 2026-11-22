import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import cosingIngredients, {
  COSING_DICTIONARY_COUNT,
  hasCosingKey,
  lookupCosingEntry
} from '../src/data/generated/cosing_ingredients.mjs';
import { COSING_PERMITTED_TSV } from '../src/data/generated/cosing_permitted.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

let passed = 0;
let total = 0;
function t(name, fn) {
  total++;
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
console.log('🚀 PHASE 2 ARCHITECTURE, COSING LAZY/ASCII, PLUGINS & UX SUITE');
console.log('======================================================================');

// 1. CosIng 100% lossless parity (30,594 / 30,594) & WeakMap ref identity & Proxy compat
t('[CosIng/Parity] 30,594/30,594 lossless parity via lookupCosingEntry, hasCosingKey & Proxy', () => {
  const rawJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'src/data/cosing_ingredients.json'), 'utf8')
  );
  const expectedKeys = Object.keys(rawJson);
  assert.equal(COSING_DICTIONARY_COUNT, 30594);
  assert.equal(expectedKeys.length, 30594);

  for (let i = 0; i < expectedKeys.length; i++) {
    const k = expectedKeys[i];
    const exp = rawJson[k];
    assert.equal(hasCosingKey(k), true, `Missing key in hasCosingKey: ${k}`);
    const got = lookupCosingEntry(k);
    assert.ok(got, `Null entry in lookupCosingEntry: ${k}`);
    assert.equal(got.ref, exp.ref, `ref mismatch for ${k}`);
    assert.equal(got.inci, exp.inci, `inci mismatch for ${k}`);
    assert.equal(got.s, exp.s, `s mismatch for ${k}`);
    assert.equal(got.f, exp.f, `f mismatch for ${k}`);
    assert.equal(got.a, exp.a, `a mismatch for ${k}`);
  }

  assert.equal(hasCosingKey('nonexistent_ingredient_xyz_999'), false);
  assert.equal(lookupCosingEntry('nonexistent_ingredient_xyz_999'), null);

  // Same object reference invariant (preserves ruleEngine WeakMap cache)
  const a1 = lookupCosingEntry('aqua');
  const a2 = lookupCosingEntry('aqua');
  assert.ok(a1 && a1 === a2, 'Expected stable object reference across repeated lookups');

  // Backward-compatible Proxy semantics
  assert.equal('aqua' in cosingIngredients, true);
  assert.equal(Object.hasOwn(cosingIngredients, 'aqua'), true);
  assert.equal(cosingIngredients['aqua']?.ref, a1.ref);
  assert.equal(Object.keys(cosingIngredients).length, 30594);
  assert.equal(Object.values(cosingIngredients).filter((e) => e.s === 0 && e.a).length, 0);
});

// 2. CosIng bundle size & Hermes 1-byte pure-ASCII guarantees
t('[CosIng/Hermes] Split CosIng bundle < 1.8 MB & zero non-ASCII bytes in source or TSV runtime', () => {
  const files = ['cosing_regulated.mjs', 'cosing_permitted.mjs', 'cosing_ingredients.mjs'];
  let totalBytes = 0;
  for (const f of files) {
    const p = path.join(ROOT_DIR, 'src/data/generated', f);
    const stat = fs.statSync(p);
    totalBytes += stat.size;
    const raw = fs.readFileSync(p, 'utf8');
    assert.equal(/[^\x00-\x7F]/.test(raw), false, `Found non-ASCII in ${f}`);
  }
  assert.ok(
    totalBytes < 1.8 * 1024 * 1024,
    `Expected CosIng split bytes < 1.8 MiB, got ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB`
  );
  assert.equal(/[^\x00-\x7F]/.test(COSING_PERMITTED_TSV), false, 'COSING_PERMITTED_TSV runtime must be pure ASCII');
});

// 3. Expo Config Plugins: Android Hardening, Android ML Kit OCR, iOS Apple Vision OCR
t('[Plugins/Android] withAndroidHardening sets allowBackup=false, R8/minify, shrinkResources & ARM ABIs idempotently', () => {
  const withAndroidHardening = require('../plugins/withAndroidHardening.cjs');
  const manifest = { manifest: { application: [{ $: { 'android:label': 'InciFact' } }] } };
  withAndroidHardening.applyAndroidManifestHardening(manifest);
  withAndroidHardening.applyAndroidManifestHardening(manifest);
  assert.equal(manifest.manifest.application[0].$['android:allowBackup'], 'false');

  const props1 = withAndroidHardening.applyAndroidGradlePropertiesHardening([
    { type: 'property', key: 'reactNativeArchitectures', value: 'armeabi-v7a,arm64-v8a,x86,x86_64' }
  ]);
  const props2 = withAndroidHardening.applyAndroidGradlePropertiesHardening(props1);
  const byKey = Object.fromEntries(props2.map((p) => [p.key, p.value]));
  assert.equal(byKey['android.enableMinifyInReleaseBuilds'], 'true');
  assert.equal(byKey['android.enableShrinkResourcesInReleaseBuilds'], 'true');
  assert.equal(byKey['reactNativeArchitectures'], 'armeabi-v7a,arm64-v8a');
  assert.equal(props2.filter((p) => p.key === 'reactNativeArchitectures').length, 1);
});

t('[Plugins/AndroidOCR] withAndroidMlkitOcr patches build.gradle, MainApplication & renders sorted Kotlin module idempotently', () => {
  const mlkitPlugin = require('../plugins/withAndroidMlkitOcr.cjs');
  const gradleSample = 'android {\n}\ndependencies {\n    implementation("com.facebook.react:react-android")\n}\n';
  const g1 = mlkitPlugin.patchAppBuildGradle(gradleSample);
  const g2 = mlkitPlugin.patchAppBuildGradle(g1);
  assert.equal(g1, g2, 'patchAppBuildGradle must be idempotent');
  assert.ok(g2.includes('com.google.mlkit:text-recognition:16.0.1'));

  const modKt = mlkitPlugin.renderMlkitOcrModuleKt('com.incifact.app');
  assert.ok(modKt.includes('override fun getName(): String = "MlkitOcr"'));
  assert.ok(modKt.includes('fun detectFromUri('));
  assert.ok(modKt.includes('InputImage.fromFilePath'));
  assert.ok(modKt.includes('TextRecognition.getClient'));
  assert.ok(modKt.includes('boundingBox'));

  const pkgKt = mlkitPlugin.renderMlkitOcrPackageKt('com.incifact.app');
  assert.ok(pkgKt.includes('class MlkitOcrPackage : ReactPackage'));

  const mainAppSample =
    'package com.incifact.app\nclass MainApplication : Application() {\n  override fun getPackages(): List<ReactPackage> =\n    PackageList(this).packages.apply {\n    }\n}\n';
  const m1 = mlkitPlugin.patchMainApplication(mainAppSample, 'com.incifact.app');
  const m2 = mlkitPlugin.patchMainApplication(m1, 'com.incifact.app');
  assert.equal(m1, m2, 'patchMainApplication must be idempotent');
  assert.ok(m2.includes('add(MlkitOcrPackage())'));
});

t('[Plugins/IosOCR] withIosVisionOcr renders VNRecognizeTextRequest Swift module & Objc RCT_EXTERN bridge', () => {
  const visionPlugin = require('../plugins/withIosVisionOcr.cjs');
  const swift = visionPlugin.renderVisionOcrSwift();
  const objc = visionPlugin.renderVisionOcrObjcBridge();
  assert.ok(swift.includes('@objc(InciFactVisionOcr)'));
  assert.ok(swift.includes('VNRecognizeTextRequest'));
  assert.ok(swift.includes('VNImageRequestHandler'));
  assert.ok(swift.includes('DispatchQueue.global'));
  assert.ok(swift.includes('detectFromUri'));
  assert.ok(swift.includes('#available(iOS 16.0, *)'));
  assert.ok(objc.includes('RCT_EXTERN_MODULE(InciFactVisionOcr, NSObject)'));
  assert.ok(objc.includes('RCT_EXTERN_METHOD(detectFromUri:'));
});

// 4. Package, App Manifest, EAS & Service Worker Hygiene
t('[Config/Hygiene] package.json, app.json, eas.json, public/sw.js & CI workflow consistent', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const app = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'app.json'), 'utf8'));
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'eas.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(ROOT_DIR, 'public/sw.js'), 'utf8');
  const ci = fs.readFileSync(path.join(ROOT_DIR, '.github/workflows/ci.yml'), 'utf8');

  assert.equal(pkg.version, '1.2.1');
  assert.equal(app.expo.version, '1.2.1');
  assert.ok(pkg.dependencies['expo-secure-store'], 'expo-secure-store must be in package.json dependencies');
  assert.ok(pkg.dependencies['expo-asset'], 'expo-asset must be in package.json dependencies (required by @expo/metro-config)');
  for (const unused of ['expo-localization', 'expo-status-bar']) {
    assert.equal(Object.hasOwn(pkg.dependencies, unused), false, `${unused} should be removed`);
  }

  assert.ok(Array.isArray(app.expo.assetBundlePatterns) && app.expo.assetBundlePatterns.includes('assets/icon.png'));
  assert.ok(app.expo.ios?.privacyManifests?.NSPrivacyAccessedAPITypes?.length >= 2);
  const pluginNames = app.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  for (const expectedPlugin of [
    'expo-secure-store',
    './plugins/withAndroidHardening.cjs',
    './plugins/withAndroidMlkitOcr.cjs',
    './plugins/withIosVisionOcr.cjs'
  ]) {
    assert.ok(pluginNames.includes(expectedPlugin), `Missing plugin in app.json: ${expectedPlugin}`);
  }

  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.ok(eas.build.development.developmentClient === true);

  assert.ok(/CACHE_NAME\s*=\s*'incifact-pwa-v2026\.11-[2-9]'/.test(sw));
  assert.ok(sw.includes('./src/engine/barcode1dDecoder.mjs'));
  assert.ok(sw.includes('./src/engine/nutriScore.mjs'));
  assert.ok(sw.includes('./src/data/generated/cosing_regulated.mjs'));
  assert.ok(sw.includes('./src/data/generated/cosing_permitted.mjs'));

  assert.ok(ci.includes('npm run build:data'));
  assert.ok(ci.includes('npm test'));
  assert.ok(ci.includes('npm run build:pages'));
});

// 5. Mobile & Web UX + RuleEngine Optimization Contracts
t('[UX/Engine] Debounced scan eval, US locale detection, OCR temp cleanup, Mobile Web Scan editor & hoisted formatter', () => {
  const scannerApp = fs.readFileSync(path.join(ROOT_DIR, 'src/mobile/ScannerApp.tsx'), 'utf8');
  const ocrService = fs.readFileSync(path.join(ROOT_DIR, 'src/mobile/ocrService.ts'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'public/index.html'), 'utf8');
  const engine = fs.readFileSync(path.join(ROOT_DIR, 'src/engine/ruleEngine.mjs'), 'utf8');

  assert.ok(scannerApp.includes('debouncedRawText'));
  assert.ok(scannerApp.includes("isUsLocale ? 'US' : 'EU'"));

  assert.ok(ocrService.includes('InciFactVisionOcr'));
  assert.ok(ocrService.includes('MlkitOcr'));
  assert.ok(ocrService.includes('deleteAsync'));

  assert.ok(indexHtml.includes('id="scanLiveInput"'));
  assert.ok(indexHtml.includes('onScanInputChanged'));
  assert.ok(indexHtml.includes('setProductTypeFromScan'));
  assert.ok(indexHtml.includes('onScanAnalyzeNow'));

  assert.ok(engine.includes('function localizeRegulatoryLegalText('));
  assert.ok(engine.includes('lookupCosingEntry'));
  assert.ok(engine.includes('hasCosingKey'));
});

console.log(`\n🎉 Phase 2 suite finished: ${passed}/${total} groups passed.`);
