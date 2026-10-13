import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('./src/data/substances.json', 'utf8'));

// 1. Remove the 5 redundant entries
const redundant = ['1_2_hexanediol', 'arginine', 'butyl_acetate', 'ethyl_acetate', 'vanillin'];
data.substances = data.substances.filter(s => !redundant.includes(s.id));

// 2. Add aliases to the existing entries
const aliasMap = [
  { id: 'sodium_hyaluronate', alias: 'سوڈیم ہائیلورونیٹ' },
  { id: 'snail_secretion_filtrate', alias: 'سنیل رطوبت فلٹریٹ' },
  { id: 'betaine', alias: 'بیٹین' },
  { id: 'butylene_glycol', alias: 'بیوٹائلین گلائکول' },
  { id: 'allantoin', alias: 'الانٹوئن' },
  { id: 'tpo_nail_banned_2025', alias: 'ٹرائی میتھائل بینزوئیل ڈائی فینائل فاسفین آکسائیڈ' },
  { id: 'hexanediol_1_2', alias: '1,2-ہیکسانڈیول' },
  { id: 'hexanediol_1_2', alias: '1،2-ہیکسانڈیول' },
  { id: 'ph_adjusters_salts_bases', alias: 'ارجینین' },
  { id: 'nail_polish_standard_solvents', alias: 'بیوٹائل ایسٹیٹ' },
  { id: 'nail_polish_standard_solvents', alias: 'ایتھائل ایسٹیٹ' },
  { id: 'food_flavourings_aroma', alias: 'ونیلن' }
];

aliasMap.forEach(({ id, alias }) => {
  const s = data.substances.find(x => x.id === id);
  if (s && !s.aliases.includes(alias)) {
    s.aliases.push(alias);
    console.log(`Added "${alias}" to ${id}`);
  }
});

fs.writeFileSync('./src/data/substances.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Cleaned up substances.json with 0 collisions!');
