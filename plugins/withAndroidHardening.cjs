/**
 * Hardens Android manifest, ProGuard/R8 rules, Data Extraction Rules & Gradle release build configuration during `expo prebuild`:
 * - Disables Android Auto Backup (`android:allowBackup="false"`, `android:fullBackupContent="false"`) and blocks Android 12+ cloud-backup & device-transfer (`android:dataExtractionRules="@xml/data_extraction_rules"`) for GDPR Art. 9 / KVKK md. 6 compliance.
 * - Enables R8/ProGuard code shrinking & resource shrinking in release APK/AAB builds with explicit `-keep` rules for `MlkitOcrModule`, `MlkitOcrPackage`, and `com.googlecode.tesseract.android.**`.
 * - Restricts native ABI builds to ARM architectures (`armeabi-v7a,arm64-v8a`).
 */

const fs = require('node:fs');
const path = require('node:path');

const PROGUARD_KEEP_MARKER = '# InciFact OCR & Tesseract R8/ProGuard keep rules';

function applyAndroidManifestHardening(manifestDoc) {
  const app =
    manifestDoc && manifestDoc.manifest && Array.isArray(manifestDoc.manifest.application)
      ? manifestDoc.manifest.application[0]
      : null;
  if (app && app.$) {
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = 'false';
    app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
  }
  return manifestDoc;
}

function renderDataExtractionRulesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup disableIfNoEncryptionCapabilities="true">
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </device-transfer>
</data-extraction-rules>
`;
}

function patchProguardRules(contents, packageName = 'com.incifact.app') {
  const src = String(contents || '');
  const pkg = String(packageName || 'com.incifact.app').trim() || 'com.incifact.app';
  const block = [
    PROGUARD_KEEP_MARKER,
    `-keep class ${pkg}.MlkitOcrModule { *; }`,
    `-keep class ${pkg}.MlkitOcrPackage { *; }`,
    '-keep class com.googlecode.tesseract.android.** { *; }',
    '-keep class com.googlecode.leptonica.android.** { *; }'
  ].join('\n');

  if (
    src.includes(`-keep class ${pkg}.MlkitOcrModule`) &&
    src.includes(`-keep class ${pkg}.MlkitOcrPackage`) &&
    src.includes('-keep class com.googlecode.tesseract.android.**')
  ) {
    return src;
  }
  const sep = src.length > 0 && !src.endsWith('\n') ? '\n\n' : src.length > 0 ? '\n' : '';
  return `${src}${sep}${block}\n`;
}

function applyAndroidGradlePropertiesHardening(properties) {
  const list = Array.isArray(properties) ? [...properties] : [];
  const hardenedEntries = [
    ['android.enableProguardInReleaseBuilds', 'true'],
    ['android.enableMinifyInReleaseBuilds', 'true'],
    ['android.enableShrinkResourcesInReleaseBuilds', 'true'],
    ['reactNativeArchitectures', 'armeabi-v7a,arm64-v8a']
  ];

  for (const [key, value] of hardenedEntries) {
    const existing = list.find((item) => item && item.type === 'property' && item.key === key);
    if (existing) {
      existing.value = value;
    } else {
      list.push({ type: 'property', key, value });
    }
  }
  return list;
}

function withAndroidHardening(config) {
  const { withAndroidManifest, withGradleProperties, withDangerousMod } = require('@expo/config-plugins');
  const packageName = (config.android && config.android.package) || 'com.incifact.app';

  let next = withAndroidManifest(config, (cfg) => {
    cfg.modResults = applyAndroidManifestHardening(cfg.modResults);
    return cfg;
  });
  next = withGradleProperties(next, (cfg) => {
    cfg.modResults = applyAndroidGradlePropertiesHardening(cfg.modResults);
    return cfg;
  });
  next = withDangerousMod(next, [
    'android',
    async (cfg) => {
      const appDir = path.join(cfg.modRequest.platformProjectRoot, 'app');
      const xmlDir = path.join(appDir, 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'data_extraction_rules.xml'), renderDataExtractionRulesXml(), 'utf8');

      const proguardPath = path.join(appDir, 'proguard-rules.pro');
      const existingProguard = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, 'utf8') : '';
      fs.writeFileSync(proguardPath, patchProguardRules(existingProguard, packageName), 'utf8');
      return cfg;
    }
  ]);
  return next;
}

withAndroidHardening.PROGUARD_KEEP_MARKER = PROGUARD_KEEP_MARKER;
withAndroidHardening.applyAndroidManifestHardening = applyAndroidManifestHardening;
withAndroidHardening.renderDataExtractionRulesXml = renderDataExtractionRulesXml;
withAndroidHardening.patchProguardRules = patchProguardRules;
withAndroidHardening.applyAndroidGradlePropertiesHardening = applyAndroidGradlePropertiesHardening;

module.exports = withAndroidHardening;
