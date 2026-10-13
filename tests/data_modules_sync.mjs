// Fails if src/data/generated/*.mjs is out of sync with the JSON sources, or if the engine imports Node built-ins.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, renderModule } from '../scripts/build_data_modules.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
for (const name of DATA_FILES) {
  const p = path.join(root, 'src/data/generated', `${name}.mjs`);
  const ok = fs.existsSync(p) && fs.readFileSync(p, 'utf8') === renderModule(name);
  if (!ok) bad++;
  console.log(ok ? '✅' : '❌', `generated/${name}.mjs ${ok ? 'in sync' : 'OUT OF DATE — run: npm run build:data'}`);
}
for (const f of ['src/engine/ruleEngine.mjs', 'src/i18n/locales.mjs']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const nodeImport = /from\s+['"](node:|fs['"]|path['"]|url['"])/.test(src) || /\brequire\(/.test(src);
  if (nodeImport) bad++;
  console.log(nodeImport ? '❌' : '✅', `${f} ${nodeImport ? 'imports a Node built-in (breaks React Native / browser)' : 'is platform-neutral'}`);
}
process.exit(bad ? 1 : 0);
