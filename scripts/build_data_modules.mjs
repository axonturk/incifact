// Converts the JSON data files into plain ES modules so the rule engine needs no Node `fs`.
// The same engine then runs unchanged in Node (server/tests), in the browser and in React Native (Metro/Hermes).
// The .json files stay the single source of truth: run `npm run build:data` after editing any of them.
// `node tests/data_modules_sync.mjs` fails if a generated module is out of date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const outDir = path.join(dataDir, 'generated');
export const DATA_FILES = ['sources', 'substances', 'halal_rules', 'hidden_sugars', 'cosing_ingredients'];

export function renderModule(name) {
  const json = JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
  return `// AUTO-GENERATED from src/data/${name}.json by scripts/build_data_modules.mjs — DO NOT EDIT.\nexport default ${JSON.stringify(json)};\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of DATA_FILES) {
    fs.writeFileSync(path.join(outDir, `${name}.mjs`), renderModule(name), 'utf8');
    console.log(`generated src/data/generated/${name}.mjs`);
  }
}
