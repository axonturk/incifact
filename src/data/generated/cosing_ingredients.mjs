// AUTO-GENERATED from src/data/cosing_ingredients.json by scripts/build_data_modules.mjs -- DO NOT EDIT.
import { COSING_TOTAL_COUNT, COSING_FUNCS, COSING_REGULATED_ROWS } from './cosing_regulated.mjs';
import { COSING_PERMITTED_TSV } from './cosing_permitted.mjs';

export const COSING_DICTIONARY_COUNT = COSING_TOTAL_COUNT;

let decodedFuncsCache = null;
const regulatedEntryCache = new Map();
let permittedRowsCache = null;
const permittedEntryCache = new Map();
let fullDictCache = null;

function decodeRuntimeAscii(s) {
  if (typeof s !== 'string' || !s.includes('\\')) return s;
  return s.replace(/\\(?:u([0-9a-fA-F]{4})|\\)/g, (_, hex) => (hex ? String.fromCharCode(parseInt(hex, 16)) : '\\'));
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
  permittedRowsCache = COSING_PERMITTED_TSV ? COSING_PERMITTED_TSV.split('\n') : [];
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
    let lineStart = mid > lo ? tsv.lastIndexOf('\n', mid - 1) + 1 : lo;
    if (lineStart < lo) lineStart = lo;
    let lineEnd = tsv.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = len;
    const tabIdx = tsv.indexOf('\t', lineStart);
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
  const parts = line.split('\t');
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
    const tabIdx = row.indexOf('\t');
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
