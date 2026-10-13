// Adds missing localized INCI names (found by tests/localized_samples_coverage.mjs) to EXISTING substance groups.
// Groups are located by an alias they already contain, so no new ids / collisions are created.
import fs from 'node:fs';

const file = new URL('../src/data/substances.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const additions = [
  ['ceramide np', ['seramida np', 'seramida']],
  ['sodium hyaluronate', ['natriumhyaluronat', 'hyaluronate de sodium', 'natrium hialuronat', 'natrium hyaluronat', 'sodium hialuronat']],
  ['betaine', ['بيتين', 'betaina', 'betaína']],
  ['butylene glycol', ['بوتيلين جليكول', 'butilena glikol', 'butilenglicol', 'butylène glycol']],
  ['1,2-hexanediol', ['1،2-هيكسانديول', '1,2-hexandiol', '1,2-heksanadiol', '1,2-hexanodiol']],
  ['arginine', ['arginin', 'arginina', 'аргинин']],
  ['snail secretion filtrate', ["filtrate de sécrétion d'escargot", 'filtrat de sécrétion d\'escargot', 'filtrado de secreción de caracol', 'фильтрат секрета улитки', 'filtrat lendir siput']],
  ['allantoin', ['allantoïne', 'allantoine', 'alantoína', 'alantoina']],
  ['acrylates copolymer', ['بوليمر أكريليت مشترك', 'كوبوليمر الأكريلات']],
  ['butyl acetate', ['butylacetat']],
  ['ethyl acetate', ['ethylacetat']],
  ['vanillin', ['vanilline', 'vainillina']]
];

for (const [anchor, aliases] of additions) {
  const group = data.substances.find((s) => (s.aliases || []).some((a) => a.toLowerCase() === anchor));
  if (!group) { console.log('!! anchor not found:', anchor); continue; }
  for (const a of aliases) {
    if (!group.aliases.includes(a)) group.aliases.push(a);
  }
  console.log(`${group.id} <- ${aliases.join(', ')}`);
}
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
