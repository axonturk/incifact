import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, '_site');
const MAX_SITE_BYTES = 8 * 1024 * 1024; // 8 MiB hard cap

function copyFileExact(srcRel, destRel = srcRel) {
  const srcPath = path.join(ROOT_DIR, srcRel);
  const destPath = path.join(OUT_DIR, destRel);
  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
    throw new Error(`Missing whitelisted build file: ${srcRel}`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return fs.statSync(destPath).size;
}

function getManifestExtraPngIcons() {
  const manifestPath = path.join(ROOT_DIR, 'public', 'manifest.webmanifest');
  const extra = [];
  if (!fs.existsSync(manifestPath)) return extra;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (Array.isArray(manifest.icons)) {
      for (const icon of manifest.icons) {
        if (icon && typeof icon.src === 'string') {
          const cleaned = icon.src.replace(/^\.\//, '');
          if (cleaned.startsWith('assets/') && cleaned.toLowerCase().endsWith('.png')) {
            extra.push(path.basename(cleaned));
          }
        }
      }
    }
  } catch {
    // Ignore malformed manifest here; build will copy manifest directly
  }
  return extra;
}

if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

let totalBytes = 0;
let totalFiles = 0;

const publicRootFiles = ['index.html', 'privacy.html', 'manifest.webmanifest', 'sw.js'];
for (const file of publicRootFiles) {
  totalBytes += copyFileExact(path.join('public', file), file);
  totalFiles++;
}

const activeAssets = new Set([
  'hero-shield-crest.jpg',
  'incifact-app-icon.jpg',
  'incifact-app-icon.png',
  'incifact-app-icon-192.png',
  'incifact-app-icon-maskable-512.png',
  'incifact-corporate-seal.jpg',
  ...getManifestExtraPngIcons()
]);

for (const assetName of activeAssets) {
  totalBytes += copyFileExact(path.join('public', 'assets', assetName), path.join('assets', assetName));
  totalFiles++;
}

const engineModules = [
  'src/engine/ruleEngine.mjs',
  'src/i18n/locales.mjs'
];
for (const modPath of engineModules) {
  totalBytes += copyFileExact(modPath, modPath);
  totalFiles++;
}

const generatedDir = path.join(ROOT_DIR, 'src', 'data', 'generated');
for (const entry of fs.readdirSync(generatedDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.mjs')) {
    const rel = path.join('src', 'data', 'generated', entry.name);
    totalBytes += copyFileExact(rel, rel);
    totalFiles++;
  }
}

fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '', 'utf8');
totalFiles++;

if (totalBytes >= MAX_SITE_BYTES) {
  throw new Error(`Static site bundle exceeded 8 MiB limit: ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB`);
}

console.log(
  `✅ Static site bundle built at: ${OUT_DIR} (${totalFiles} files, ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB)`
);
