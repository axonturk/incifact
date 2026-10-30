import fs from 'node:fs';

const substancesData = JSON.parse(fs.readFileSync('./src/data/substances.json', 'utf8'));
const halalData = JSON.parse(fs.readFileSync('./src/data/halal_rules.json', 'utf8'));
const sugarsData = JSON.parse(fs.readFileSync('./src/data/hidden_sugars.json', 'utf8'));

function foldToken(raw) {
  return (raw || '')
    .normalize('NFKC')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[یے]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[ہھ]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/[üúùû]/g, 'u')
    .replace(/ş/g, 's')
    .replace(/[öóòô]/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàâä]/g, 'a')
    .replace(/[íìîï]/g, 'i')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('--- 1. SUBSTANCES INTERNAL COLLISIONS ---');
const subMap = new Map();
const internalSubCollisions = [];
for (const s of substancesData.substances) {
  for (const a of [s.name, ...(s.aliases || [])]) {
    const folded = foldToken(a);
    if (subMap.has(folded) && subMap.get(folded).id !== s.id) {
      internalSubCollisions.push({ alias: folded, raw: a, id1: subMap.get(folded).id, id2: s.id });
    } else {
      subMap.set(folded, s);
    }
  }
}
console.log('Total internal substances collisions:', internalSubCollisions.length);
const pairMap = new Map();
for (const c of internalSubCollisions) {
  const p = [c.id1, c.id2].sort().join(' <-> ');
  if (!pairMap.has(p)) pairMap.set(p, []);
  pairMap.get(p).push(c.alias);
}
for (const [pair, aliases] of pairMap.entries()) {
  console.log(`\n[COLLISION PAIR] ${pair} (${aliases.length} items):`);
  console.log(`   ${aliases.join(', ')}`);
}

console.log('\n--- 2. HALAL RULES INTERNAL COLLISIONS ---');
const halalMap = new Map();
const internalHalalCollisions = [];
for (const r of halalData.rules) {
  for (const a of [r.canonical, ...(r.aliases || []), ...(r.codes || [])]) {
    const folded = foldToken(a);
    if (halalMap.has(folded) && halalMap.get(folded).id !== r.id) {
      internalHalalCollisions.push({ alias: folded, raw: a, id1: halalMap.get(folded).id, id2: r.id });
    } else {
      halalMap.set(folded, r);
    }
  }
}
console.log('Total internal halal collisions:', internalHalalCollisions.length);
for (const c of internalHalalCollisions) {
  console.log(`  [HALAL COLLISION] "${c.alias}" -> ${c.id1} vs ${c.id2}`);
}

console.log('\n--- 3. CROSS DOMAIN (SUBSTANCES vs SUGARS) ---');
const sugarMap = new Map();
const crossCollisions = [];
for (const sg of sugarsData.free_sugars) {
  for (const a of sg.aliases || []) {
    sugarMap.set(foldToken(a), sg);
  }
}
for (const [k, v] of sugarMap) {
  if (subMap.has(k)) {
    crossCollisions.push({ alias: k, sugar: v.canonical, substance: subMap.get(k).id });
    console.log(`  [SUGAR vs SUBSTANCE] "${k}" -> sugar ${v.canonical} vs substance ${subMap.get(k).id}`);
  }
}
console.log('Total cross-domain collisions:', crossCollisions.length);
