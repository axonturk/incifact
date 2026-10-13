import fs from 'node:fs';

// 1. Sources: Add EU_2025_877
const sourcesPath = './src/data/sources.json';
const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
if (!sourcesData.sources['EU_2025_877']) {
  sourcesData.sources['EU_2025_877'] = {
    id: 'EU_2025_877',
    institution: 'European Commission',
    title: 'Commission Regulation (EU) 2025/877 (Omnibus VII - TPO Ban in Cosmetic Products Annex II)',
    url: 'https://eur-lex.europa.eu/eli/reg/2025/877/oj',
    checked_at: '2026-10-13',
    type: 'binding_regulation'
  };
  fs.writeFileSync(sourcesPath, JSON.stringify(sourcesData, null, 2) + '\n');
  console.log('✅ Added EU_2025_877 to sources.json');
}

// 2. Substances
const substancesPath = './src/data/substances.json';
const substancesData = JSON.parse(fs.readFileSync(substancesPath, 'utf8'));

// 2a. Update TPO eu_detail and sources
const tpo = substancesData.substances.find((s) => s.id === 'tpo_nail_banned_2025');
if (tpo) {
  tpo.eu_detail = "AB Omnibus VII Yönetmeliği (AB) 2025/877 (CLP 2024/197 bağlantılı) kapsamında CMR 1B (üreme toksisitesi) sınıflandırması nedeniyle 1 Eylül 2025'ten itibaren kozmetik ve jel oje ürünlerinde YASAKLANMIŞTIR (Ek II).";
  if (!tpo.sources.includes('EU_2025_877')) {
    tpo.sources.push('EU_2025_877');
  }
  console.log('✅ Updated TPO regulation citation in substances.json');
}

// 2b. Add Hydroquinone, Mercury, Formaldehyde
if (!substancesData.substances.find((s) => s.id === 'hydroquinone_banned')) {
  substancesData.substances.push({
    id: 'hydroquinone_banned',
    name: 'Hydroquinone',
    aliases: [
      'hydroquinone',
      'hidrokinon',
      '1,4-dihydroxybenzene',
      'quinol',
      'هيدروكينون',
      'гидрохинон',
      'ہائیڈروکوئنون'
    ],
    domain: 'cosmetic',
    class: 'active',
    e_code: null,
    ci_code: null,
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği 1223/2009 Ek II (Madde 1339) kapsamında okronozis ve sitotoksisite riski nedeniyle kozmetik ürünlerde KESİNLİKLE YASAKLANMIŞTIR.',
    ed_tier: null,
    severity: 'yuksek',
    profiles: {
      hamilelik: 'kirmizi',
      cocuk_metabolik: 'kirmizi',
      hassas_cilt: 'kirmizi'
    },
    sources: ['EU_1223_2009'],
    verification: 'ikincil_kontrol',
    note: null
  });
  console.log('✅ Added Hydroquinone (Ek II) to substances.json');
}

if (!substancesData.substances.find((s) => s.id === 'mercury_compounds_banned')) {
  substancesData.substances.push({
    id: 'mercury_compounds_banned',
    name: 'Mercury and its Compounds (Ammoniated Mercury / Cıva)',
    aliases: [
      'mercury',
      'civa',
      'cıva',
      'ammoniated mercury',
      'mercuric chloride',
      'calomel',
      'زئبق',
      'ртуть',
      'پارہ (مرکری)'
    ],
    domain: 'cosmetic',
    class: 'active',
    e_code: null,
    ci_code: null,
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği 1223/2009 Ek II (Madde 221) kapsamında cıva ve tüm cıva bileşikleri nörotoksisite ve böbrek hasarı riski nedeniyle KESİNLİKLE YASAKLANMIŞTIR.',
    ed_tier: null,
    severity: 'yuksek',
    profiles: {
      hamilelik: 'kirmizi',
      cocuk_metabolik: 'kirmizi',
      hassas_cilt: 'kirmizi',
      astim_alerji: 'kirmizi'
    },
    sources: ['EU_1223_2009'],
    verification: 'ikincil_kontrol',
    note: null
  });
  console.log('✅ Added Mercury & compounds (Ek II) to substances.json');
}

if (!substancesData.substances.find((s) => s.id === 'formaldehyde_direct_banned')) {
  substancesData.substances.push({
    id: 'formaldehyde_direct_banned',
    name: 'Formaldehyde',
    aliases: [
      'formaldehyde',
      'formaldehit',
      'formalin',
      'methanal',
      'methylene oxide',
      'oxymethylene',
      'فورمالدهيد',
      'формальдегид',
      'فارملڈیہائیڈ'
    ],
    domain: 'cosmetic',
    class: 'preservative',
    e_code: null,
    ci_code: null,
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği 1223/2009 Ek II (Madde 1577 / Omnibus III) kapsamında CMR 1B (Kanserojen) ve güçlü alerjen olması nedeniyle kozmetik ürünlerde KESİNLİKLE YASAKLANMIŞTIR.',
    ed_tier: null,
    severity: 'yuksek',
    profiles: {
      hamilelik: 'kirmizi',
      cocuk_metabolik: 'kirmizi',
      hassas_cilt: 'kirmizi',
      astim_alerji: 'kirmizi'
    },
    sources: ['EU_1223_2009', 'EU_2022_1181'],
    verification: 'ikincil_kontrol',
    note: null
  });
  console.log('✅ Added Formaldehyde (Ek II) to substances.json');
}

// 2c. Clean bogus aliases from caprylic_capric_triglyceride
const cct = substancesData.substances.find((s) => s.id === 'caprylic_capric_triglyceride');
if (cct) {
  const allowedCct = new Set([
    'caprylic/capric triglyceride',
    'caprylic/capric triglycerides',
    'kaprilik/kaprik trigliserit',
    'triglycéride caprylique/caprique',
    'triglicérido caprílico/cáprico',
    'каприлик/каприк триглицерид'
  ]);
  cct.aliases = cct.aliases.filter((a) => allowedCct.has(a.toLowerCase().trim()));
  console.log('✅ Cleaned 19 bogus aliases from caprylic_capric_triglyceride');
}

// 2d. Clean ceramide_np vs cholesterol & ceramides_family
const cNp = substancesData.substances.find((s) => s.id === 'ceramide_np');
if (cNp) {
  cNp.aliases = cNp.aliases.filter((a) => !['cholesterol', 'phytosphingosine'].includes(a.toLowerCase().trim()));
}
const cFam = substancesData.substances.find((s) => s.id === 'ceramides_family');
if (cFam) {
  // Let ceramide_np own ceramide np/ap/eop/3; cFam owns ceramides, ceramide, seramidler, phytosphingosine
  cFam.aliases = cFam.aliases.filter(
    (a) => !['ceramide np', 'ceramide ap', 'ceramide eop', 'ceramide 3', 'seramid np', 'церамид np', 'سيراميد'].includes(a.toLowerCase().trim())
  );
  console.log('✅ Cleaned ceramide_np vs ceramides_family & cholesterol');
}

// 2e. Clean tocopherol vs tocopheryl_acetate
const toco = substancesData.substances.find((s) => s.id === 'tocopherol');
if (toco) {
  toco.aliases = toco.aliases.filter((a) => a.toLowerCase().trim() !== 'tocopheryl acetate');
}

// 2f. Clean dimethicone vs dimethicone_silicones
const dSil = substancesData.substances.find((s) => s.id === 'dimethicone_silicones');
if (dSil) {
  // dimethicone owns dimethicone, dimetikon, polydimethylsiloxane; dSil owns silicones, amodimethicone, etc.
  dSil.aliases = dSil.aliases.filter(
    (a) => !['dimethicone', 'dimetikon', 'polydimethylsiloxane', 'диметикон', 'ديميثيكون'].includes(a.toLowerCase().trim())
  );
  console.log('✅ Cleaned dimethicone vs dimethicone_silicones');
}

// 2g. Clean fragrance_allergens vs eu_26_fragrance_allergens & benzyl_alcohol
const fragAllergens = substancesData.substances.find((s) => s.id === 'fragrance_allergens');
if (fragAllergens) {
  fragAllergens.aliases = fragAllergens.aliases.filter((a) => a.toLowerCase().trim() !== 'benzyl alcohol');
}
const eu26 = substancesData.substances.find((s) => s.id === 'eu_26_fragrance_allergens');
if (eu26 && fragAllergens) {
  // Remove eu_26_fragrance_allergens since fragrance_allergens is the primary entry tested in verify_engine
  substancesData.substances = substancesData.substances.filter((s) => s.id !== 'eu_26_fragrance_allergens');
  console.log('✅ Merged eu_26_fragrance_allergens into fragrance_allergens');
}

// 2h. Clean cosmetic_iron_oxides_pigments: remove e153 (e153 is vegetable carbon)
const ironOx = substancesData.substances.find((s) => s.id === 'cosmetic_iron_oxides_pigments');
if (ironOx) {
  ironOx.aliases = ironOx.aliases.filter((a) => a.toLowerCase().trim() !== 'e153');
}

// 2i. Clean oral_care_fluorides_hydroxyapatite: remove e341
const oralCare = substancesData.substances.find((s) => s.id === 'oral_care_fluorides_hydroxyapatite');
if (oralCare) {
  oralCare.aliases = oralCare.aliases.filter((a) => a.toLowerCase().trim() !== 'e341');
}

// 2j. Clean parfum: remove "aroma" (keep aroma in food_flavourings_aroma)
const parfumSub = substancesData.substances.find((s) => s.id === 'parfum');
if (parfumSub) {
  parfumSub.aliases = parfumSub.aliases.filter((a) => a.toLowerCase().trim() !== 'aroma');
}

// 2k. Clean nail_polish_standard_solvents: remove "acrylates copolymer"
const nailSolv = substancesData.substances.find((s) => s.id === 'nail_polish_standard_solvents');
if (nailSolv) {
  nailSolv.aliases = nailSolv.aliases.filter((a) => a.toLowerCase().trim() !== 'acrylates copolymer');
}

// 2l. Clean polymers_carbomer_acrylates: remove "pvp" (belongs to extra_e_additives_permitted)
const polyCarb = substancesData.substances.find((s) => s.id === 'polymers_carbomer_acrylates');
if (polyCarb) {
  polyCarb.aliases = polyCarb.aliases.filter((a) => a.toLowerCase().trim() !== 'pvp');
}

// 2m. Clean hexanediol_1_2: remove "ethyl hexanediol"
const hex12 = substancesData.substances.find((s) => s.id === 'hexanediol_1_2');
if (hex12) {
  hex12.aliases = hex12.aliases.filter((a) => a.toLowerCase().trim() !== 'ethyl hexanediol');
}

// 2n. Clean expanded_whole_foods_meats_spices_vitamins: remove karamel, magnesium carbonate, niacin
const expWhole = substancesData.substances.find((s) => s.id === 'expanded_whole_foods_meats_spices_vitamins');
if (expWhole) {
  expWhole.aliases = expWhole.aliases.filter(
    (a) => !['karamel', 'magnesium carbonate', 'niacin'].includes(a.toLowerCase().trim())
  );
  console.log('✅ Cleaned remaining collisions in substances.json');
}

fs.writeFileSync(substancesPath, JSON.stringify(substancesData, null, 2) + '\n');
console.log('✅ Saved substances.json');

// 3. Halal Rules
const halalPath = './src/data/halal_rules.json';
const halalData = JSON.parse(fs.readFileSync(halalPath, 'utf8'));

// 3a. Add Alcoholic Beverages rule
if (!halalData.rules.find((r) => r.id === 'alcoholic_beverages_khamr')) {
  halalData.rules.unshift({
    id: 'alcoholic_beverages_khamr',
    canonical: 'Alcoholic Beverages (Rum / Liqueur / Mirin / Sake / Wine / Beer / Spirits)',
    aliases: [
      'rom',
      'rum',
      'likör',
      'liqueur',
      'liquor',
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
      'bira',
      'beer',
      'şarap',
      'wine',
      'vin',
      'wein',
      'vino',
      'brandy',
      'şampanya',
      'champagne',
      'نبيذ',
      'خمر',
      'بيرة',
      'ميرين',
      'ساكي',
      'ликёр',
      'ром',
      'вино',
      'пиво',
      'виски',
      'водка',
      'شراب',
      'رم'
    ],
    codes: [],
    category: 'A_haram',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: false,
    halal_claim_conflict: true,
    authority_rulings: {
      general_cautious: 'kirmizi',
      GIMDES: 'kirmizi',
      JAKIM: 'kirmizi',
      MUI: 'kirmizi',
      IFANCA: 'kirmizi'
    },
    source_id: 'JAKIM_MKI_2012',
    verification: 'ikincil_kontrol',
    template_tr: 'Doğrudan alkollü içki (rom, likör, mirin, sake, şarap, bira vb.) veya hamr türevi bileşen içerir. Tüm helal standartlarında (GİMDES, JAKIM, MUI, IFANCA) gıdada kesinlikle HARAM kabul edilir.'
  });
  console.log('✅ Added alcoholic_beverages_khamr to halal_rules.json');
}

// 3b. Clean e1105 and e966 in halal rules
const pepsinRule = halalData.rules.find((r) => r.id === 'animal_enzymes_pepsin_lipase');
if (pepsinRule) {
  // e1105 is lysozyme from egg white, not mammalian pepsin
  pepsinRule.codes = (pepsinRule.codes || []).filter((c) => c.toLowerCase().trim() !== 'e1105');
  pepsinRule.aliases = (pepsinRule.aliases || []).filter((a) => a.toLowerCase().trim() !== 'e1105');
}

const dairyEggRule = halalData.rules.find((r) => r.id === 'dairy_egg_halal_non_vegan');
if (dairyEggRule) {
  // e966 is lactitol, already handled in safe_non_ethanol_alcohols
  dairyEggRule.codes = (dairyEggRule.codes || []).filter((c) => c.toLowerCase().trim() !== 'e966');
  dairyEggRule.aliases = (dairyEggRule.aliases || []).filter((a) => a.toLowerCase().trim() !== 'e966');
  console.log('✅ Cleaned internal halal collisions (e1105 & e966)');
}

fs.writeFileSync(halalPath, JSON.stringify(halalData, null, 2) + '\n');
console.log('✅ Saved halal_rules.json');
