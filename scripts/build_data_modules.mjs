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
export const GENERATED_MODULES = [
  'sources',
  'substances',
  'halal_rules',
  'hidden_sugars',
  'cosing_regulated',
  'cosing_permitted',
  'cosing_ingredients'
];

const SIMPLE_MODULES = new Set(['sources', 'substances', 'halal_rules', 'hidden_sugars']);

function encodeRuntimeAscii(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/[^\x00-\x7F]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function normCosingKey(inci) {
  return String(inci).toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
}

function buildCosingArtifacts() {
  const cosingJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'cosing_ingredients.json'), 'utf8'));
  const keys = Object.keys(cosingJson);
  const funcCounts = new Map();
  for (let i = 0; i < keys.length; i++) {
    const f = cosingJson[keys[i]].f;
    if (f) funcCounts.set(f, (funcCounts.get(f) || 0) + 1);
  }
  const funcList = [...funcCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map((entry) => entry[0]);
  const funcIdxMap = new Map(funcList.map((f, i) => [f, i]));

  const regKeys = [];
  const permKeys = [];

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = cosingJson[k];
    if (v.s !== 0 || (v.a && v.a.length > 0)) {
      regKeys.push(k);
    } else {
      permKeys.push(k);
    }
  }

  // Standard UTF-16 code unit lexicographical sort so binary search works in O(log N) for both regulated & permitted rows
  regKeys.sort();
  permKeys.sort();

  const regulatedRows = [];
  for (let i = 0; i < regKeys.length; i++) {
    const k = regKeys[i];
    const v = cosingJson[k];
    const fi = v.f ? funcIdxMap.get(v.f) : -1;
    const row = [
      encodeRuntimeAscii(k),
      String(v.ref),
      v.s,
      encodeRuntimeAscii(v.a || ''),
      fi
    ];
    if (v.inci !== k.toUpperCase()) row.push(encodeRuntimeAscii(v.inci));
    regulatedRows.push(row);
  }

  const permittedLines = [];
  for (let i = 0; i < permKeys.length; i++) {
    const k = permKeys[i];
    const v = cosingJson[k];
    const fi = v.f ? funcIdxMap.get(v.f) : -1;
    const encKey = encodeRuntimeAscii(k);
    const refStr = String(v.ref);
    const kUpper = k.toUpperCase();

    if (
      encKey.includes('\t') ||
      encKey.includes('\n') ||
      encKey.includes('\r') ||
      refStr.includes('\t') ||
      refStr.includes('\n')
    ) {
      throw new Error(`Invalid TSV delimiter character in permitted CosIng key/ref: ${k}`);
    }

    if (v.inci === kUpper) {
      permittedLines.push(`${encKey}\t${refStr}\t${fi}`);
    } else {
      let patch = '';
      if (v.inci.length === kUpper.length) {
        for (let j = 0; j < kUpper.length; j++) {
          if (kUpper[j] !== v.inci[j]) {
            if (kUpper[j] === ' ' && (v.inci[j] === '-' || v.inci[j] === '/' || v.inci[j] === '_')) {
              patch += (patch ? ',' : '') + j + v.inci[j];
            } else {
              patch = null;
              break;
            }
          }
        }
      } else {
        patch = null;
      }

      if (patch !== null && patch.length + 1 < v.inci.length) {
        permittedLines.push(`${encKey}\t${refStr}\t${fi}\t*${patch}`);
      } else {
        const encInci = encodeRuntimeAscii(v.inci);
        if (encInci.includes('\t') || encInci.includes('\n') || encInci.includes('\r')) {
          throw new Error(`Invalid TSV delimiter character in permitted CosIng INCI: ${k}`);
        }
        permittedLines.push(`${encKey}\t${refStr}\t${fi}\t=${encInci}`);
      }
    }
  }

  const encodedFuncs = funcList.map(encodeRuntimeAscii);

  const cosingRegulatedSrc = [
    '// AUTO-GENERATED from src/data/cosing_ingredients.json by scripts/build_data_modules.mjs -- DO NOT EDIT.',
    `export const COSING_TOTAL_COUNT = ${keys.length};`,
    `export const COSING_FUNCS = ${JSON.stringify(encodedFuncs)};`,
    `export const COSING_REGULATED_ROWS = ${JSON.stringify(regulatedRows)};`,
    ''
  ].join('\n');

  const cosingPermittedSrc = [
    '// AUTO-GENERATED from src/data/cosing_ingredients.json by scripts/build_data_modules.mjs -- DO NOT EDIT.',
    `export const COSING_PERMITTED_TSV = ${JSON.stringify(permittedLines.join('\n'))};`,
    ''
  ].join('\n');

  const cosingIngredientsSrc = `// AUTO-GENERATED from src/data/cosing_ingredients.json by scripts/build_data_modules.mjs -- DO NOT EDIT.
import { COSING_TOTAL_COUNT, COSING_FUNCS, COSING_REGULATED_ROWS } from './cosing_regulated.mjs';
import { COSING_PERMITTED_TSV } from './cosing_permitted.mjs';

export const COSING_DICTIONARY_COUNT = COSING_TOTAL_COUNT;

let decodedFuncsCache = null;
const regulatedEntryCache = new Map();
let permittedRowsCache = null;
const permittedEntryCache = new Map();
let fullDictCache = null;

function decodeRuntimeAscii(s) {
  if (typeof s !== 'string' || !s.includes('\\\\')) return s;
  return s.replace(/\\\\(?:u([0-9a-fA-F]{4})|\\\\)/g, (_, hex) => (hex ? String.fromCharCode(parseInt(hex, 16)) : '\\\\'));
}

function getDecodedFuncs() {
  if (!decodedFuncsCache) {
    decodedFuncsCache = COSING_FUNCS.map(decodeRuntimeAscii);
  }
  return decodedFuncsCache;
}

function findRegulatedRow(key) {
  if (typeof key !== 'string' || !key) return null;
  let lo = 0;
  let hi = COSING_REGULATED_ROWS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const row = COSING_REGULATED_ROWS[mid];
    const rk = decodeRuntimeAscii(row[0]);
    if (rk === key) return row;
    if (rk < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

function parseRegulatedRow(key, row) {
  const funcs = getDecodedFuncs();
  return {
    ref: row[1],
    inci: row.length > 5 ? decodeRuntimeAscii(row[5]) : key.toUpperCase(),
    s: row[2],
    f: row[4] >= 0 ? funcs[row[4]] : '',
    a: decodeRuntimeAscii(row[3])
  };
}

function getPermittedRows() {
  if (permittedRowsCache) return permittedRowsCache;
  permittedRowsCache = COSING_PERMITTED_TSV ? COSING_PERMITTED_TSV.split('\\n') : [];
  return permittedRowsCache;
}

function findPermittedRow(key) {
  const tsv = COSING_PERMITTED_TSV;
  const len = tsv.length;
  if (!len || typeof key !== 'string' || !key) return null;
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    let lineStart = mid > lo ? tsv.lastIndexOf('\\n', mid - 1) + 1 : lo;
    if (lineStart < lo) lineStart = lo;
    let lineEnd = tsv.indexOf('\\n', lineStart);
    if (lineEnd === -1) lineEnd = len;
    const tabIdx = tsv.indexOf('\\t', lineStart);
    const keyEnd = tabIdx !== -1 && tabIdx < lineEnd ? tabIdx : lineEnd;
    const rk = decodeRuntimeAscii(tsv.slice(lineStart, keyEnd));
    if (rk === key) return tsv.slice(lineStart, lineEnd);
    if (rk < key) lo = lineEnd + 1;
    else hi = lineStart > 0 ? lineStart - 1 : 0;
  }
  return null;
}

function reconstructInci(key, col3) {
  if (!col3) return key.toUpperCase();
  if (col3.charCodeAt(0) === 42) {
    const chars = key.toUpperCase().split('');
    const specs = col3.slice(1).split(',');
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const ch = sp[sp.length - 1];
      const idx = Number(sp.slice(0, -1));
      chars[idx] = ch;
    }
    return chars.join('');
  }
  return decodeRuntimeAscii(col3.slice(1));
}

function parsePermittedLine(key, line) {
  const parts = line.split('\\t');
  const fi = Number(parts[2]);
  const funcs = getDecodedFuncs();
  return {
    ref: parts[1],
    inci: reconstructInci(key, parts[3]),
    s: 0,
    f: fi >= 0 ? funcs[fi] : '',
    a: ''
  };
}

export function hasCosingKey(key) {
  if (typeof key !== 'string' || !key) return false;
  if (regulatedEntryCache.has(key) || permittedEntryCache.has(key)) return true;
  return findRegulatedRow(key) !== null || findPermittedRow(key) !== null;
}

export function lookupCosingEntry(key) {
  if (typeof key !== 'string' || !key) return null;
  if (regulatedEntryCache.has(key)) return regulatedEntryCache.get(key);
  const regRow = findRegulatedRow(key);
  if (regRow !== null) {
    const entry = parseRegulatedRow(key, regRow);
    regulatedEntryCache.set(key, entry);
    return entry;
  }
  if (permittedEntryCache.has(key)) return permittedEntryCache.get(key);
  const line = findPermittedRow(key);
  if (line === null) return null;
  const entry = parsePermittedLine(key, line);
  permittedEntryCache.set(key, entry);
  return entry;
}

function getFullDictionary() {
  if (fullDictCache) return fullDictCache;
  const dict = Object.create(null);
  for (let i = 0; i < COSING_REGULATED_ROWS.length; i++) {
    const row = COSING_REGULATED_ROWS[i];
    const k = decodeRuntimeAscii(row[0]);
    let entry = regulatedEntryCache.get(k);
    if (!entry) {
      entry = parseRegulatedRow(k, row);
      regulatedEntryCache.set(k, entry);
    }
    dict[k] = entry;
  }
  const rows = getPermittedRows();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const tabIdx = row.indexOf('\\t');
    const k = decodeRuntimeAscii(row.slice(0, tabIdx));
    let entry = permittedEntryCache.get(k);
    if (!entry) {
      entry = parsePermittedLine(k, row);
      permittedEntryCache.set(k, entry);
    }
    dict[k] = entry;
  }
  fullDictCache = dict;
  return dict;
}

const cosingProxy = new Proxy(Object.create(null), {
  get(target, prop) {
    if (typeof prop === 'symbol') return Reflect.get(target, prop);
    return lookupCosingEntry(prop) ?? undefined;
  },
  has(_target, prop) {
    return typeof prop === 'string' && hasCosingKey(prop);
  },
  ownKeys() {
    return Object.keys(getFullDictionary());
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop === 'symbol') return undefined;
    const entry = lookupCosingEntry(prop);
    if (!entry) return undefined;
    return { configurable: true, enumerable: true, writable: true, value: entry };
  }
});

export default cosingProxy;
`;

  return {
    cosing_regulated: cosingRegulatedSrc,
    cosing_permitted: cosingPermittedSrc,
    cosing_ingredients: cosingIngredientsSrc
  };
}

export function renderModule(name) {
  if (SIMPLE_MODULES.has(name)) {
    const json = JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
    return `// AUTO-GENERATED from src/data/${name}.json by scripts/build_data_modules.mjs — DO NOT EDIT.\nexport default ${JSON.stringify(json)};\n`;
  }
  if (name === 'cosing_regulated' || name === 'cosing_permitted' || name === 'cosing_ingredients') {
    const artifacts = buildCosingArtifacts();
    return artifacts[name];
  }
  throw new Error(`Unknown generated module: ${name}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of SIMPLE_MODULES) {
    fs.writeFileSync(path.join(outDir, `${name}.mjs`), renderModule(name), 'utf8');
    console.log(`generated src/data/generated/${name}.mjs`);
  }
  const cosingArtifacts = buildCosingArtifacts();
  for (const name of ['cosing_regulated', 'cosing_permitted', 'cosing_ingredients']) {
    fs.writeFileSync(path.join(outDir, `${name}.mjs`), cosingArtifacts[name], 'utf8');
    console.log(`generated src/data/generated/${name}.mjs`);
  }
}
