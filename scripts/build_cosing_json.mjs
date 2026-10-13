import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const csvPath = 'C:\\Users\\fakma\\Downloads\\COSING_DOGRULANMIS_BILESENLER.csv';
const outPath = 'C:\\Projeler\\clean-halal-scanner\\src\\data\\cosing_ingredients.json';

console.log('Building cosing_ingredients.json from:', csvPath);

const fileStream = fs.createReadStream(csvPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let isHeader = true;
let total = 0;
const cosingMap = {};

for await (const line of rl) {
  if (isHeader) {
    isHeader = false;
    continue;
  }
  if (!line.trim()) continue;

  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());

  const ref = cols[0];
  const inci = cols[1];
  const cas = cols[2] || '';
  const funcs = cols[4] || '';
  const annex = cols[6] || '';
  const status = cols[7] || '';

  if (!inci) continue;
  total++;

  const normKey = inci.toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
  
  // Status code:
  // 0: serbest / ek kaydı yok
  // 1: kısıtlı (Ek III)
  // 2: yasak (Ek II)
  // 3: izinli pozitif liste (Ek IV, V, VI)
  // 4: koşullu / grup
  let sCode = 0;
  if (/yasak|banned/i.test(status)) sCode = 2;
  else if (/kısıtlı|restricted/i.test(status)) sCode = 1;
  else if (/izinli/i.test(status)) sCode = 3;
  else if (/koşullu/i.test(status)) sCode = 4;

  cosingMap[normKey] = {
    ref,
    inci,
    s: sCode,
    f: funcs.slice(0, 40),
    a: annex
  };
}

fs.writeFileSync(outPath, JSON.stringify(cosingMap));
console.log(`Successfully generated ${outPath} with ${total} ingredients!`);
console.log('File size:', (fs.statSync(outPath).size / 1024 / 1024).toFixed(2), 'MB');
