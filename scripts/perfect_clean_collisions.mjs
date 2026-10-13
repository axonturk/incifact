import fs from 'node:fs';

// 1. Substances cleanups
const substancesPath = './src/data/substances.json';
const substancesData = JSON.parse(fs.readFileSync(substancesPath, 'utf8'));

// Remove 'seramid' from ceramides_family
const cFam = substancesData.substances.find((s) => s.id === 'ceramides_family');
if (cFam) {
  cFam.aliases = cFam.aliases.filter((a) => a.toLowerCase().trim() !== 'seramid');
}

// Remove caprylic/capric triglyceride from light_non_comedogenic_emollients
const lightEmoll = substancesData.substances.find((s) => s.id === 'light_non_comedogenic_emollients');
if (lightEmoll) {
  lightEmoll.aliases = lightEmoll.aliases.filter(
    (a) => !['caprylic/capric triglyceride', 'kaprilik/kaprik trigliserit'].includes(a.toLowerCase().trim())
  );
}

fs.writeFileSync(substancesPath, JSON.stringify(substancesData, null, 2) + '\n');
console.log('✅ Cleaned remaining 2 substance collisions');

// 2. Halal Rules cleanups
const halalPath = './src/data/halal_rules.json';
const halalData = JSON.parse(fs.readFileSync(halalPath, 'utf8'));

// Remove the duplicate rule alcoholic_beverages_khamr
halalData.rules = halalData.rules.filter((r) => r.id !== 'alcoholic_beverages_khamr');

// Enrich wine_beer_liquor with mirin, sake, bourbon, cognac, vodka, whisky, etc.
const wineRule = halalData.rules.find((r) => r.id === 'wine_beer_liquor');
if (wineRule) {
  const newAliases = [
    'mirin',
    'sake',
    'saké',
    'bourbon',
    'cognac',
    'konyak',
    'vodka',
    'votka',
    'whisky',
    'whiskey',
    'viski',
    'rom',
    'liqueur',
    'liquor',
    'champagne',
    'şampanya',
    'ميرين',
    'ساكي',
    'виски',
    'водка',
    'ром',
    'ликёр'
  ];
  for (const a of newAliases) {
    if (!wineRule.aliases.includes(a)) {
      wineRule.aliases.push(a);
    }
  }
}

fs.writeFileSync(halalPath, JSON.stringify(halalData, null, 2) + '\n');
console.log('✅ Enriched wine_beer_liquor and removed duplicate rule');
