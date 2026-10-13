import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../src/data');

// 1. Load existing files
const substancesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'substances.json'), 'utf8'));
const halalData = JSON.parse(fs.readFileSync(path.join(dataDir, 'halal_rules.json'), 'utf8'));
const sugarsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'hidden_sugars.json'), 'utf8'));
const sourcesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'sources.json'), 'utf8'));

// Add any additional official sources if not present
const extraSources = {
  EU_2021_1902: {
    id: 'EU_2021_1902',
    title: 'Commission Regulation (EU) 2021/1902 (Omnibus IV - Zinc Pyrithione & Lilial Ban)',
    jurisdiction: 'EU',
    type: 'regulation',
    url: 'https://eur-lex.europa.eu/eli/reg/2021/1902/oj'
  },
  EU_2024_1328: {
    id: 'EU_2024_1328',
    title: 'Commission Regulation (EU) 2024/1328 (REACH Restriction on D4, D5, D6 Cyclosiloxanes)',
    jurisdiction: 'EU',
    type: 'regulation',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1328/oj'
  },
  EU_2023_1545: {
    id: 'EU_2023_1545',
    title: 'Commission Regulation (EU) 2023/1545 (Extended Fragrance Allergens Labeling in Cosmetics)',
    jurisdiction: 'EU',
    type: 'regulation',
    url: 'https://eur-lex.europa.eu/eli/reg/2023/1545/oj'
  },
  BPJPH_MUI_ID: {
    id: 'BPJPH_MUI_ID',
    title: 'BPJPH / LPPOM MUI Indonesia Halal Product Assurance Standards (SJPH HAS 23000)',
    jurisdiction: 'ID',
    type: 'halal_standard',
    url: 'https://halalmui.org/'
  }
};
for (const [k, v] of Object.entries(extraSources)) {
  sourcesData.sources[k] = v;
}
fs.writeFileSync(path.join(dataDir, 'sources.json'), JSON.stringify(sourcesData, null, 2), 'utf8');

// Helper to add substance if id does not exist, or merge new aliases into existing id
const existingSubMap = new Map(substancesData.substances.map((s) => [s.id, s]));

function upsertSubstance(sub) {
  if (existingSubMap.has(sub.id)) {
    const existing = existingSubMap.get(sub.id);
    const mergedAliases = new Set([...existing.aliases, ...(sub.aliases || [])]);
    existing.aliases = Array.from(mergedAliases);
  } else {
    const fullSub = {
      id: sub.id,
      name: sub.name,
      aliases: Array.from(new Set(sub.aliases || [])),
      domain: sub.domain || 'cosmetic',
      class: sub.class || 'emollient',
      e_code: sub.e_code || null,
      ci_code: sub.ci_code || null,
      eu_status: sub.eu_status || 'izinli',
      eu_detail: sub.eu_detail || 'AB Kozmetik Yönetmeliği (1223/2009) ve CosIng kapsamında standart kullanımda izinlidir.',
      ed_tier: sub.ed_tier || null,
      severity: sub.severity || 'bilgi',
      profiles: sub.profiles || {},
      sources: sub.sources || ['COSING'],
      verification: sub.verification || 'ikincil_kontrol',
      note: sub.note || null
    };
    substancesData.substances.push(fullSub);
    existingSubMap.set(fullSub.id, fullSub);
  }
}

// ============================================================================
// EXPAND ALIASES OF EXISTING CORE SUBSTANCES ACROSS 10 LANGUAGES
// (EN, AR, TR, DE, FR, ID, MS, ES, RU, UR)
// ============================================================================
const coreAliasExpansions = {
  aqua: [
    'ماء', 'الماء', 'agua', 'air', 'вода', 'پانی', 'water (aqua)', 'aqua/water/eau',
    'aqua / water / eau', 'thermal spring water', 'maris aqua', 'sea water'
  ],
  glycerin: [
    'جلسرين', 'غليسرين', 'glicerina', 'gliserin', 'глицерин', 'گلیسرین', 'vegetal glycerin',
    'vegetable glycerin', 'pflanzliches glycerin', 'glycérine végétale'
  ],
  cetyl_alcohol: [
    'كحول سيتيلي', 'alcohol cetílico', 'setil alkohol', 'цетиловый спирт', 'سیٹائل الکحل'
  ],
  cetearyl_alcohol: [
    'كحول سيتيريلي', 'alcohol cetearílico', 'setearil alkohol', 'цетеариловый спирт', 'سیٹیرائل الکحل'
  ],
  stearyl_alcohol: [
    'كحول ستيريلي', 'alcohol estearílico', 'stearil alkohol', 'стеариловый спирт', 'اسٹیرائل الکحل'
  ],
  phenoxyethanol: [
    'فينوكسي إيثانول', 'fenoxietanol', 'fenoksietanol', 'феноксиэтанол', 'فینوکسی ایتھانول'
  ],
  niacinamide: [
    'نياسيناميد', 'niacinamida', 'niasinamida', 'ниацинамид', 'نیاسینامائڈ', 'vitamine b3'
  ],
  panthenol: [
    'بانثينول', 'pantenol', 'd-panthenol', 'декспантенол', 'пантенол', 'پینتھینول', 'provitamin b5'
  ],
  tocopherol: [
    'توكوفيرول', 'فيتامين هـ', 'tocoferol', 'tokoferol', 'токоферол', 'وٹامن ای', 'vitamin e', 'e306', 'e307'
  ],
  sodium_hyaluronate: [
    'هيالورونات الصوديوم', 'حمض الهيالورونيك', 'hialuronato de sodio', 'ácido hialurónico',
    'natrium hyaluronat', 'hyaluronsäure', 'acide hyaluronique', 'гиалуронат натрия', 'гиалуроновая кислота', 'ہائیلورونک ایسڈ'
  ],
  salicylic_acid: [
    'حمض الساليسيليك', 'ácido salicílico', 'salicylsäure', 'acide salicylique', 'asam salisilat',
    'asid salisilik', 'салициловая кислота', 'سیلیسیلک ایسڈ'
  ],
  retinol_retinoids: [
    'ريتينول', 'فيتامين أ', 'retinol', 'ویتامین اے', 'ретинол', 'ретинилпальмитат'
  ],
  SLS: [
    'كبريتات لوريل الصوديوم', 'lauril sulfato de sodio', 'natriumlaurylsulfat', 'лаурилсульфат натрия'
  ],
  sles: [
    'كبريتات لوريث الصوديوم', 'laureth sulfato de sodio', 'natriumlaurethsulfat', 'лауретсульфат натрия'
  ],
  titanium_dioxide_e171_ci77891: [
    'ثاني أكسيد التيتانيوم', 'dióxido de titanio', 'titandioxid', 'dioxyde de titane',
    'titanium dioksida', 'диоксид титана', 'ٹائٹینیم ڈائی آکسائیڈ', 'ci77891', 'e-171'
  ],
  msg_e621: [
    'غلوتامات أحادي الصوديوم', 'glutamato monosódico', 'mononatriumglutamat', 'glutamate monosodique',
    'mononatrium glutamat', 'vetsin', 'глутамат натрия', 'مونو سوڈیم گلوٹامیٹ', 'e-621'
  ],
  carrageenan_e407: [
    'كاراجينان', 'carragenina', 'carrageen', 'carraghénane', 'karagenan', 'каррагинан', 'کیراجینن', 'e-407'
  ]
};

for (const [id, extraAliases] of Object.entries(coreAliasExpansions)) {
  if (existingSubMap.has(id)) {
    const sub = existingSubMap.get(id);
    sub.aliases = Array.from(new Set([...sub.aliases, ...extraAliases]));
  }
}

// ============================================================================
// MASSIVE REAL-WORLD COSMETIC & FOOD INGREDIENT EXPANSION (420+ SUBSTANCES)
// ============================================================================
const newSubstances = [
  // --- A. HUMECTANTS, SOLVENTS & GLYCOLS (SAFE BASE) ---
  {
    id: 'propanediol',
    name: 'Propanediol',
    aliases: ['propanediol', '1,3-propanediol', 'propandiol', 'пропандиол', 'بروبانديول'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Mısır şekerinden veya sentetik olarak elde edilen cilt dostu çözücü ve nem tutucu.'
  },
  {
    id: 'butylene_glycol',
    name: 'Butylene Glycol',
    aliases: ['butylene glycol', 'bütilen glikol', '1,3-butylene glycol', 'butylenglykol', 'бутиленгликоль', 'بوتيلين جلايكول'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Kozmetik serum ve kremlerde yaygın kullanılan güvenli nemlendirici ve penetrasyon artırıcı çözücü.'
  },
  {
    id: 'propylene_glycol_e1520',
    name: 'Propylene Glycol (E1520)',
    aliases: ['propylene glycol', 'propilen glikol', 'e1520', 'propylenglykol', 'propylène glycol', 'propilena glikol', 'пропиленгликоль', 'بروبيلين جلايكول'],
    domain: 'cosmetic+food',
    class: 'humectant',
    e_code: 'E1520',
    eu_detail: 'Kozmetikte nem tutucu çözücü; gıdada (E1520) aroma taşıyıcı olarak sınırlı düzeyde izinlidir.'
  },
  {
    id: 'pentylene_glycol',
    name: 'Pentylene Glycol',
    aliases: ['pentylene glycol', 'pentilen glikol', '1,2-pentanediol', 'пентиленгликоль', 'بنتيلين جلايكول'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Nem tutucu ve antimikrobiyal destekleyici cilt bakım bileşeni.'
  },
  {
    id: 'hexylene_glycol',
    name: 'Hexylene Glycol',
    aliases: ['hexylene glycol', 'heksilen glikol', 'гексиленгликоль'],
    domain: 'cosmetic',
    class: 'solvent',
    eu_detail: 'Kozmetik formüllerde viskozite düzenleyici ve çözücü.'
  },
  {
    id: 'caprylyl_glycol',
    name: 'Caprylyl Glycol',
    aliases: ['caprylyl glycol', 'kaprilil glikol', '1,2-octanediol', 'каприлилгликоль', 'كابريليل جلايكول'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Cildi yumuşatan ve koruyucu sistemlerin etkinliğini artıran nem tutucu.'
  },
  {
    id: 'hexanediol_1_2',
    name: '1,2-Hexanediol',
    aliases: ['1,2-hexanediol', 'hexanediol', 'ethyl hexanediol', '1,2-heksandiol', '1,2-гександиол'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Özellikle Kore kozmetiğinde (K-Beauty) yaygın kullanılan yumuşak nem tutucu ve koruyucu destekleyici.'
  },
  {
    id: 'ethylhexylglycerin',
    name: 'Ethylhexylglycerin',
    aliases: ['ethylhexylglycerin', 'etilheksilgliserin', 'этилгексилглицерин', 'إيثيلهكسيل جلسرين'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Gliserin türevi cilt yumuşatıcı, deodorant aktif ve koruyucu güçlendirici.'
  },
  {
    id: 'dipropylene_glycol',
    name: 'Dipropylene Glycol',
    aliases: ['dipropylene glycol', 'dipropilen glikol', 'dpg', 'дипропиленгликоль'],
    domain: 'cosmetic',
    class: 'solvent',
    eu_detail: 'Parfüm ve cilt bakım ürünlerinde kullanılan çözücü.'
  },
  {
    id: 'sodium_pca',
    name: 'Sodium PCA & PCA',
    aliases: ['sodium pca', 'pca', 'pyrrolidone carboxylic acid', 'sodyum pca', 'zinc pca', 'çinko pca', 'copper pca', 'натрия пка'],
    domain: 'cosmetic',
    class: 'humectant',
    eu_detail: 'Cildin Doğal Nemlendirme Faktörünün (NMF) fizyolojik bir parçası olan güvenli nem tutucu.'
  },
  {
    id: 'urea_carbamide',
    name: 'Urea (Carbamide / E927b)',
    aliases: ['urea', 'üre', 'carbamide', 'karbamid', 'hydroxyethyl urea', 'hidroksietil üre', 'harnstoff', 'urée', 'мочевина', 'يوريا'],
    domain: 'cosmetic+food',
    class: 'humectant',
    e_code: 'E927B',
    eu_detail: 'Düşük oranlarda güçlü nem tutucu, yüksek oranlarda (%10+) keratolilitik (sert deriyi yumuşatıcı). Kozmetik üre %100 sentetiktir (helaldir).'
  },
  {
    id: 'betaine',
    name: 'Betaine (Trimethylglycine)',
    aliases: ['betaine', 'betain', 'trimethylglycine', 'бетаин', 'بيتايين'],
    domain: 'cosmetic+food',
    class: 'humectant',
    eu_detail: 'Şeker pancarından elde edilen, tahrişi azaltıcı ve nem tutucu amino asit türevi.'
  },
  {
    id: 'trehalose_humectant',
    name: 'Trehalose',
    aliases: ['trehalose', 'trehaloz', 'трегалоза', 'تريهالوز'],
    domain: 'cosmetic+food',
    class: 'humectant',
    eu_detail: 'Hücre zarını dehidrasyona karşı koruyan doğal disakkarit nemlendirici.'
  },
  {
    id: 'allantoin',
    name: 'Allantoin',
    aliases: ['allantoin', 'alantoin', 'аллантоин', 'آلانتوين'],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Cildi yatıştırıcı ve bariyer onarımını destekleyici güvenli bileşen.'
  },
  {
    id: 'ectoin',
    name: 'Ectoin',
    aliases: ['ectoin', 'ektoin', 'эктоин', 'إكتوين'],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Hücresel nem kalkanı oluşturan ekstremofil amino asit türevi.'
  },
  {
    id: 'beta_glucan',
    name: 'Beta-Glucan',
    aliases: ['beta-glucan', 'beta glucan', 'beta glukan', 'oat beta-glucan', 'бета-глюкан', 'بيتا جلوكان'],
    domain: 'cosmetic+food',
    class: 'active',
    eu_detail: 'Yulaf veya maya kaynaklı cilt yatıştırıcı ve nemlendirici polisakkarit.'
  },
  {
    id: 'squalane',
    name: 'Squalane (Plant-Derived Hydrogenated)',
    aliases: ['squalane', 'skualan', '식물성 스쿠알란', 'сквалаane', 'сквалан', 'سكوالان'],
    domain: 'cosmetic',
    class: 'emollient',
    eu_detail: 'Zeytin veya şeker kamışından elde edilen, gözenek tıkamayan (non-komedojenik) cilt bariyeri lipidi.',
    note: 'YANLIŞ POZİTİF KORUMASI: "Squalane" (a harfiyle) bitkisel ve stabildir; köpekbalığı şüphesi taşıyan "Squalene" (e harfiyle) ile karıştırılmamalıdır.'
  },
  {
    id: 'ceramides_family',
    name: 'Ceramides (Ceramide NP / AP / EOP / NS / EOS)',
    aliases: [
      'ceramide np', 'ceramide ap', 'ceramide eop', 'ceramide ns', 'ceramide eos', 'ceramide ng',
      'ceramide 1', 'ceramide 2', 'ceramide 3', 'ceramide 6 ii', 'ceramides', 'seramid', 'seramid np',
      'phytosphingosine', 'fitosfingozin', 'sphingolipids', 'церамид np', 'церамиды', 'سيراميد'
    ],
    domain: 'cosmetic',
    class: 'emollient',
    eu_detail: 'Cilt bariyerinin doğal yapı taşını oluşturan güvenli seramid ve sfingolipid ailesi.'
  },
  {
    id: 'cholesterol_lipid',
    name: 'Cholesterol',
    aliases: ['cholesterol', 'kolesterol', 'холестерин', 'كوليسترول'],
    domain: 'cosmetic',
    class: 'emollient',
    eu_detail: 'Seramidlerle birlikte cilt bariyerini onaran lipit bileşeni.'
  },
  {
    id: 'bisabolol',
    name: 'Bisabolol (Alpha-Bisabolol)',
    aliases: ['bisabolol', 'alpha-bisabolol', 'alfa-bisabolol', 'бисаболол', 'بيسابولول'],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Papatyadan elde edilen cilt yatıştırıcı aktif bileşen.'
  },
  {
    id: 'centella_cica_actives',
    name: 'Centella Asiatica (Cica) & Madecassoside / Asiaticoside',
    aliases: [
      'centella asiatica extract', 'centella asiatica leaf extract', 'centella asiatica leaf water',
      'madecassoside', 'asiaticoside', 'madecassic acid', 'asiatic acid', 'cica', 'gotu kola',
      'центелла азиатская', 'мадекассосид', 'سنتيلا أسياتيكا'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Cilt kızarıklığını yatıştıran ve bariyer onarımını destekleyen Centella Asiatica (Cica) bileşenleri.'
  },
  {
    id: 'vitamin_c_derivatives',
    name: 'Vitamin C & Derivatives (Ascorbic Acid / E300 / SAP / MAP)',
    aliases: [
      'ascorbic acid', 'l-ascorbic acid', 'askorbik asit', 'vitamin c', 'vitamine c', 'e300',
      'sodium ascorbyl phosphate', 'magnesium ascorbyl phosphate', 'ascorbyl glucoside',
      '3-o-ethyl ascorbic acid', 'ethyl ascorbic acid', 'ascorbyl tetraisopalmitate',
      'tetrahexyldecyl ascorbate', 'ascorbyl palmitate', 'e304', 'sodium ascorbate', 'e301',
      'calcium ascorbate', 'e302', 'аскорбиновая кислота', 'حمض الأسكوربيك', 'فيتامين سي'
    ],
    domain: 'cosmetic+food',
    class: 'antioxidant',
    e_code: 'E300',
    eu_detail: 'Ciltte antioksidan/aydınlatıcı vitamin, gıdada (E300-E304) güvenli antioksidan.'
  },
  {
    id: 'tocopheryl_acetate',
    name: 'Tocopheryl Acetate (Vitamin E Ester)',
    aliases: ['tocopheryl acetate', 'tokoferil asetat', 'vitamin e acetate', 'токоферола ацетат', 'أسيتات التوكوفيرل'],
    domain: 'cosmetic',
    class: 'antioxidant',
    eu_detail: 'Stabil E vitamini türevi antioksidan.'
  },
  {
    id: 'peptides_matrixyl_argireline',
    name: 'Cosmetic Peptides (Palmitoyl Tripeptide / Matrixyl / Argireline / Copper Peptide)',
    aliases: [
      'palmitoyl tripeptide-1', 'palmitoyl tetrapeptide-7', 'palmitoyl tripeptide-5',
      'palmitoyl pentapeptide-4', 'acetyl hexapeptide-8', 'argireline', 'copper tripeptide-1',
      'tripeptide-1', 'hexapeptide-9', 'nonapeptide-1', 'sh-oligopeptide-1', 'oligopeptide-1',
      'carnosine', 'karnozin', 'пептиды', 'ببتيدات'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Cilt elastikiyetini ve nemini destekleyen biyomimetik kozmetik peptitler.'
  },
  {
    id: 'adenosine_coq10_resveratrol',
    name: 'Antioxidant Actives (Adenosine / Coenzyme Q10 / Ferulic Acid / Resveratrol / Glutathione)',
    aliases: [
      'adenosine', 'adenozin', 'ubiquinone', 'coenzyme q10', 'koenzim q10', 'ferulic acid', 'ferulik asit',
      'resveratrol', 'glutathione', 'glutatyon', 'astaxanthin', 'superoxide dismutase', 'аденозин', 'коэнзим q10'
    ],
    domain: 'cosmetic',
    class: 'antioxidant',
    eu_detail: 'Serbest radikallere karşı koruyucu antioksidan aktif bileşenler.'
  },
  {
    id: 'tranexamic_azelaic_arbutin',
    name: 'Brightening Actives (Azelaic Acid / Tranexamic Acid / Alpha-Arbutin)',
    aliases: [
      'azelaic acid', 'azelaik asit', 'potassium azeloyl diglycinate', 'tranexamic acid', 'traneksamik asit',
      'alpha-arbutin', 'alfa arbutin', 'arbutin', 'niacin', 'азелаиновая кислота', 'ترانيكساميك', 'أربوتين'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'izinli',
    eu_detail: 'Leke ve cilt tonu eşitsizliği bakımında kullanılan aktif bileşenler (Alpha-Arbutin AB 2024/996 kapsamında yüz kremlerinde %2, vücut losyonlarında %0.5 sınırıyla izinlidir).',
    sources: ['EU_2024_996', 'COSING']
  },
  {
    id: 'kojic_acid',
    name: 'Kojic Acid',
    aliases: ['kojic acid', 'kojik asit', 'койевая кислота', 'حمض الكوجيك'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB Yönetmeliği 2024/996 kapsamında yüz ve el ürünlerinde maksimum %1 konsantrasyon sınırıyla izinlidir.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' },
    sources: ['EU_2024_996']
  },

  // --- B. EXFOLIATING ACIDS (AHA / PHA / LHA) & ACNE ACTIVES ---
  {
    id: 'aha_glycolic_lactic_mandelic',
    name: 'AHA Acids (Glycolic Acid / Lactic Acid E270 / Mandelic Acid)',
    aliases: [
      'glycolic acid', 'glikolik asit', 'lactic acid', 'laktik asit', 'e270', 'mandelic acid', 'mandelik asit',
      'malic acid', 'malik asit', 'e296', 'tartaric acid', 'tartarik asit', 'e334',
      'гликолевая кислота', 'молочная кислота', 'حمض الجليكوليك', 'حمض اللاكتيك'
    ],
    domain: 'cosmetic+food',
    class: 'active',
    e_code: 'E270',
    eu_status: 'izinli',
    eu_detail: 'Alfa Hidroksi Asit (AHA); kozmetikte hücre yenileyici/pH düzenleyici, gıdada (E270/E296/E334) asitlik düzenleyici.',
    severity: 'bilgi',
    profiles: { hassas_cilt: 'sari_ilk5' },
    note: 'Kozmetikte ilk 5 sırada (yüksek konsantrasyonda) yer aldığında hassas ciltlerde karıncalanma yapabilir ve güneş koruyucu kullanımı önerilir.'
  },
  {
    id: 'pha_gluconolactone_lactobionic',
    name: 'PHA Acids (Gluconolactone E575 / Lactobionic Acid)',
    aliases: [
      'gluconolactone', 'glukonolakton', 'e575', 'glucono-delta-lactone', 'lactobionic acid', 'laktobiyonik asit',
      'глюконолактон', 'جلوكونولاكتون'
    ],
    domain: 'cosmetic+food',
    class: 'active',
    e_code: 'E575',
    eu_detail: 'Büyük molekül yapılı Poli Hidroksi Asit (PHA); AHA\'lara göre hassas ciltlerde çok daha nazik nemlendirici ve yenileyicidir.'
  },
  {
    id: 'citric_acid_citrates_e330',
    name: 'Citric Acid & Citrates (E330–E333)',
    aliases: [
      'citric acid', 'sitrik asit', 'limon tuzu', 'e330', 'sodium citrate', 'sodyum sitrat', 'trisodium citrate', 'e331',
      'potassium citrate', 'e332', 'calcium citrate', 'e333', 'zitronensäure', 'acide citrique', 'ácido cítrico',
      'asam sitrat', 'asid sitrik', 'лимонная кислота', 'حمض الستريك', 'سائٹرک ایسڈ'
    ],
    domain: 'cosmetic+food',
    class: 'pH_adjuster',
    e_code: 'E330',
    eu_detail: 'Kozmetikte pH dengeleyici (tampon), gıdada (E330-E333) doğal asitlik düzenleyici.'
  },
  {
    id: 'benzoyl_peroxide',
    name: 'Benzoyl Peroxide (BPO)',
    aliases: ['benzoyl peroxide', 'benzoil peroksit', 'бензоилпероксид', 'بنزويل بيروكسايد'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III/II kapsamında yalnızca profesyonel/reçeteli akne ürünlerinde veya özel koşullarda kullanılır; hassas ciltleri kurutabilir.',
    severity: 'orta',
    profiles: { hassas_cilt: 'kirmizi', hamilelik: 'sari' }
  },

  // --- C. SILICONES, EMOLLIENTS, OILS & WAXES ---
  {
    id: 'dimethicone_silicones',
    name: 'Linear & Safe Silicones (Dimethicone / Dimethiconol / Phenyl Trimethicone / Caprylyl Methicone)',
    aliases: [
      'dimethicone', 'dimetikon', 'dimethiconol', 'dimetikonol', 'phenyl trimethicone', 'caprylyl methicone',
      'amodimethicone', 'cetyl dimethicone', 'stearyl dimethicone', 'vinyl dimethicone', 'dimethicone crosspolymer',
      'dimethicone/vinyl dimethicone crosspolymer', 'peg-12 dimethicone', 'peg/ppg-18/18 dimethicone',
      'polydimethylsiloxane', 'e900', 'trimethylsiloxysilicate', 'trisiloxane', 'диметикон', 'ديميثيكون'
    ],
    domain: 'cosmetic+food',
    class: 'emollient',
    e_code: 'E900',
    eu_detail: 'Cilt yüzeyinde nefes alabilen koruyucu bariyer oluşturan, gözenek tıkamayan (non-komedojenik) doğrusal silikon.'
  },
  {
    id: 'cyclosiloxanes_d5_d6',
    name: 'Cyclic Silicones: Cyclopentasiloxane (D5) & Cyclohexasiloxane (D6)',
    aliases: ['cyclopentasiloxane', 'siklopentasiloksan', 'cyclohexasiloxane', 'sikloheksasiloksan', 'd5', 'd6', 'циклопентасилоксан'],
    domain: 'cosmetic',
    class: 'emollient',
    eu_status: 'kisitli',
    eu_detail: 'AB REACH Yönetmeliği (EU) 2024/1328 kapsamında çevresel kalıcılık/biyobirikim (PBT/vPvB) nedeniyle durulanan ürünlerde %0.1 ile sınırlandırılmış, durulanmayan ürünlerde geçiş süreci başlatılmıştır.',
    severity: 'dusuk',
    sources: ['EU_2024_1328', 'COSING']
  },
  {
    id: 'cyclotetrasiloxane_d4',
    name: 'Cyclotetrasiloxane (D4)',
    aliases: ['cyclotetrasiloxane', 'siklotetrasiloksan', 'octamethylcyclotetrasiloxane', 'циклотетрасилоксан'],
    domain: 'cosmetic',
    class: 'emollient',
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek II (Madde 1388) kapsamında üreme toksisitesi (CMR 2) ve çevresel kalıcılık nedeniyle kozmetik ürünlerde YASAKLANMIŞTIR.',
    ed_tier: 'sartli_supheli',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi' },
    sources: ['EU_1223_2009', 'EU_2024_1328']
  },
  {
    id: 'light_non_comedogenic_emollients',
    name: 'Lightweight Non-Comedogenic Emollients (Caprylic/Capric Triglyceride / Dicaprylyl Carbonate / C12-15 Alkyl Benzoate)',
    aliases: [
      'caprylic/capric triglyceride', 'kaprilik/kaprik trigliserit', 'dicaprylyl carbonate', 'dicaprylyl ether',
      'coco-caprylate/caprate', 'coco-caprylate', 'c12-15 alkyl benzoate', 'cetyl ethylhexanoate',
      'ethylhexyl stearate', 'isoamyl laurate', 'isododecane', 'isohexadecane', 'hydrogenated polyisobutene',
      'hydrogenated polydecene', 'c13-14 isoparaffin', 'triethylhexanoin', 'pentaerythrityl tetraethylhexanoate',
      'isononyl isononanoate', 'isopropyl isostearate', 'octyldodecanol', 'hexyldecanol', 'oleyl erucate',
      'каприлик/каприк триглицерид', 'كابريليك/كابريك ثلاثي الجليسريد'
    ],
    domain: 'cosmetic',
    class: 'emollient',
    eu_detail: 'Cildi ağırlaştırmadan yumuşatan güvenli hafif emolyent ve çözücü esterler.'
  },
  {
    id: 'mineral_oils_petrolatum',
    name: 'Refined Mineral Oils & Waxes (Petrolatum / Paraffinum Liquidum / Microcrystalline Wax)',
    aliases: [
      'petrolatum', 'vazelin', 'vaseline', 'paraffinum liquidum', 'mineral oil', 'mineral yağ', 'sıvı parafin',
      'paraffin', 'parafin', 'cera microcristallina', 'microcrystalline wax', 'mikrokristalin mum', 'e905c',
      'ozokerite', 'ceresin', 'вазелин', 'минеральное масло', 'بارافين', 'فازلين'
    ],
    domain: 'cosmetic',
    class: 'emollient',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek II uyarınca tam rafine edilmiş (Avrupa Farmakopesi saflık kriterlerine uygun) petrolatum ve mineral yağlar güvenli oklüzif (nem kilitleyici) olarak izinlidir.'
  },
  {
    id: 'non_comedogenic_botanical_oils_butters',
    name: 'Skin-Friendly Plant Oils & Butters (Shea Butter / Jojoba / Argan / Sunflower / Rosehip / Olive / Sweet Almond)',
    aliases: [
      'butyrospermum parkii butter', 'butyrospermum parkii (shea) butter', 'shea butter', 'karite yağı', 'shea yağı',
      'simmondsia chinensis seed oil', 'jojoba oil', 'jojoba yağı', 'argania spinosa kernel oil', 'argan oil', 'argan yağı',
      'helianthus annuus seed oil', 'sunflower oil', 'sunflower seed oil', 'ayçiçek yağı', 'huile de tournesol', 'sonnenblumenöl',
      'olea europaea fruit oil', 'olive oil', 'zeytinyağı', 'huile d\'olive', 'olivenöl', 'زيت الزيتون',
      'prunus amygdalus dulcis oil', 'sweet almond oil', 'tatlı badem yağı', 'persea gratissima oil', 'avocado oil', 'avokado yağı',
      'rosa canina fruit oil', 'rosehip oil', 'kuşburnu yağı', 'ricinus communis seed oil', 'castor oil', 'hint yağı',
      'hydrogenated castor oil', 'peg-40 hydrogenated castor oil', 'peg-60 hydrogenated castor oil',
      'vitis vinifera seed oil', 'grapeseed oil', 'üzüm çekirdeği yağı', 'macadamia ternifolia seed oil',
      'cannabis sativa seed oil', 'hemp seed oil', 'kenevir tohumu yağı', 'nigella sativa seed oil', 'çörek otu yağı',
      'carthamus tinctorius seed oil', 'safflower oil', 'aspir yağı', 'brassica napus seed oil', 'rapeseed oil', 'canola oil', 'kanola yağı',
      'palm oil', 'elaeis guineensis oil', 'palm yağı', 'palmfett', 'huile de palme', 'minyak kelapa sawit', 'زيت النخيل',
      'vegetable oil', 'bitkisel yağ', 'pflanzenöl', 'huile végétale', 'minyak nabati', 'растительное масло',
      'масло ши', 'زبدة الشيا', 'زيت الجوجوبا', 'زيت الأرغان'
    ],
    domain: 'cosmetic+food',
    class: 'emollient',
    eu_detail: 'Bitkisel yağ ve tereyağı bileşenleri; hem kozmetikte hem gıdada güvenli temel yağlardır.'
  },
  {
    id: 'soothing_botanical_extracts',
    name: 'Soothing Botanical Extracts (Aloe Vera / Green Tea / Chamomile / Calendula / Licorice / Oat)',
    aliases: [
      'aloe barbadensis leaf juice', 'aloe barbadensis leaf extract', 'aloe vera', 'aloe barbadensis leaf water',
      'camellia sinensis leaf extract', 'green tea extract', 'yeşil çay ekstraktı',
      'chamomilla recutita flower extract', 'matricaria recutita', 'chamomile extract', 'papatya özütü',
      'calendula officinalis flower extract', 'aynısefa özütü',
      'glycyrrhiza glabra root extract', 'licorice root extract', 'meyan kökü özütü', 'dipotassium glycyrrhizate',
      'hamamelis virginiana water', 'hamamelis virginiana extract', 'witch hazel', 'cadı fındığı',
      'avena sativa kernel flour', 'avena sativa kernel extract', 'colloidal oatmeal', 'yulaf özütü', 'yulaf unu',
      'cucumis sativus fruit extract', 'cucumber extract', 'salatalık özütü',
      'panax ginseng root extract', 'ginseng extract', 'ginkgo biloba leaf extract',
      'rosemary extract', 'rosmarinus officinalis leaf extract', 'biberiye ekstraktı', 'e392',
      'houttuynia cordata extract', 'heartleaf extract', 'artemisia princeps leaf extract', 'mugwort extract',
      'oryza sativa extract', 'rice extract', 'pirinç özütü', 'galactomyces ferment filtrate', 'bifida ferment lysate',
      'saccharomyces ferment filtrate', 'lactobacillus ferment', 'алоэ вера', 'экстракт зеленого чая', 'ألوفيرا'
    ],
    domain: 'cosmetic+food',
    class: 'active',
    eu_detail: 'Bitkisel ve fermente özütler; cilt yatıştırıcı ve antioksidan destek sağlar.'
  },
  {
    id: 'essential_oils_potent',
    name: 'Essential Oils & Menthol (Tea Tree / Lavender / Peppermint / Eucalyptus / Menthol)',
    aliases: [
      'melaleuca alternifolia leaf oil', 'tea tree oil', 'çay ağacı yağı',
      'lavandula angustifolia oil', 'lavender oil', 'lavanta yağı',
      'mentha piperita oil', 'peppermint oil', 'nane yağı', 'menthol', 'mentol',
      'eucalyptus globulus leaf oil', 'okaliptüs yağı', 'citrus aurantium dulcis peel oil', 'orange peel oil',
      'citrus limon peel oil', 'lemon peel oil', 'cymbopogon citratus leaf oil', 'camphor', 'kafur',
      'масло чайного дерева', 'ментол', 'زيت شجرة الشاي', 'منثول'
    ],
    domain: 'cosmetic+food',
    class: 'fragrance_allergen',
    eu_status: 'izinli',
    eu_detail: 'Uçucu bitkisel yağlar ve mentol; ferahlatıcı ve aromatik etki sağlar ancak hassas ciltlerde uçucu bileşenleri nedeniyle uyarıcı olabilir.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' }
  },
  {
    id: 'plant_waxes_candelilla_carnauba',
    name: 'Plant Waxes: Candelilla Wax (E902), Carnauba Wax (E903) & Rice Bran Wax',
    aliases: [
      'euphorbia cerifera cera', 'candelilla cera', 'candelilla wax', 'kandelilla mumu', 'e902',
      'copernicia cerifera cera', 'carnauba wax', 'karnauba mumu', 'e903',
      'oryza sativa cera', 'rice bran wax', 'helianthus annuus seed cera', 'synthetic wax', 'sentetik mum',
      'карнаубский воск', 'شمع الكرنوبا'
    ],
    domain: 'cosmetic+food',
    class: 'emollient',
    e_code: 'E903',
    eu_detail: 'Bitkisel/vegan kaynaklı doğal mumlar; kozmetikte kıvam verici, gıdada (E902/E903) parlatıcı olarak izinlidir.'
  },

  // --- D. SURFACTANTS, CLEANSERS & EMULSIFIERS ---
  {
    id: 'gentle_surfactants_betaines_glucosides',
    name: 'Gentle Amphoteric & Non-Ionic Surfactants (Cocamidopropyl Betaine / Glucosides / Cocoyl Isethionate)',
    aliases: [
      'cocamidopropyl betaine', 'kokamidopropil betain', 'coco-betaine', 'lauryl betaine', 'cocamidopropyl hydroxysultaine',
      'decyl glucoside', 'desil glukozit', 'coco-glucoside', 'koko-glukozit', 'lauryl glucoside', 'caprylyl/capryl glucoside',
      'cetearyl glucoside', 'arachidyl glucoside', 'sodium cocoyl isethionate', 'sodium lauroyl methyl isethionate',
      'sodium cocoyl glutamate', 'disodium cocoyl glutamate', 'sodium lauroyl glutamate', 'sodium lauroyl sarcosinate',
      'sodium methyl cocoyl taurate', 'disodium laureth sulfosuccinate', 'sodium cocoamphoacetate', 'disodium cocoamphodiacetate',
      'poloxamer 184', 'poloxamer 407', 'peg-6 caprylic/capric glycerides', 'peg-7 glyceryl cocoate',
      'кокамидопропилбетаин', 'децилглюкозид', 'كوكاميدو بروبيل بيتايين'
    ],
    domain: 'cosmetic',
    class: 'surfactant',
    eu_detail: 'Yüz temizleme jelleri, bebek şampuanları ve misel sularda kullanılan nazik yüzey aktif temizleyiciler.'
  },
  {
    id: 'stronger_anionic_surfactants',
    name: 'Strong Anionic Surfactants (Ammonium Lauryl Sulfate / Sodium C14-16 Olefin Sulfonate / Sodium Coco-Sulfate)',
    aliases: [
      'ammonium lauryl sulfate', 'als', 'ammonium laureth sulfate', 'sodium c14-16 olefin sulfonate',
      'sodium coco-sulfate', 'scs', 'sodium myreth sulfate', 'tea-lauryl sulfate', 'sodium dodecylbenzenesulfonate'
    ],
    domain: 'cosmetic',
    class: 'surfactant',
    eu_status: 'izinli',
    eu_detail: 'Yüksek köpürme ve yağ çözme gücüne sahip anyonik yüzey aktifler; çok kuru/hassas ciltlerde kuruluk yapabilir.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' }
  },
  {
    id: 'cocamide_dea_mea',
    name: 'Alkanolamides: Cocamide DEA & Cocamide MEA',
    aliases: ['cocamide dea', 'kokamid dea', 'cocamide diethanolamine', 'lauramide dea', 'cocamide mea', 'cocamide mipa'],
    domain: 'cosmetic',
    class: 'surfactant',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III kapsamında ikincil amin/nitrozamin oluşumunu önlemek için sıkı saflık ve maksimum yağ asidi dialkanolamid sınırlarına tabidir.',
    severity: 'orta',
    profiles: { hassas_cilt: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'cosmetic_emulsifiers_pegs_polysorbates',
    name: 'Standard Emulsifiers (Polysorbates E432–E436 / Sorbitan Esters / PEG-100 Stearate / Ceteareth-20)',
    aliases: [
      'polysorbate 20', 'polisorbat 20', 'e432', 'polysorbate 80', 'polisorbat 80', 'e433',
      'polysorbate 40', 'e434', 'polysorbate 60', 'polisorbat 60', 'e435', 'polysorbate 65', 'e436',
      'sorbitan stearate', 'e491', 'sorbitan tristearate', 'e492', 'sorbitan monolaurate', 'e493',
      'sorbitan oleate', 'sorbitan monooleate', 'e494', 'sorbitan palmitate', 'e495', 'sorbitan olivate', 'cetearyl olivate',
      'sorbitan isostearate', 'peg-100 stearate', 'peg-40 stearate', 'ceteareth-20', 'ceteareth-12', 'ceteareth-25',
      'steareth-2', 'steareth-20', 'steareth-21', 'laureth-7', 'laureth-23', 'ceteth-20',
      'potassium cetyl phosphate', 'sodium stearoyl glutamate', 'glyceryl stearate citrate', 'glyceryl stearate se',
      'polyglyceryl-3 methylglucose distearate', 'polyglyceryl-4 laurate', 'polyglyceryl-10 laurate', 'polyglyceryl-6 distearate',
      'полисорбат 20', 'полисорбат 80', 'بوليسوربات 20', 'بوليسوربات 80'
    ],
    domain: 'cosmetic+food',
    class: 'emulsifier',
    e_code: 'E432-E495',
    eu_detail: 'Su ve yağ fazlarını birleştiren emülgatörler; çift kaynaklı (bitkisel/hayvansal) yağ asidi türevleri Helal/Vegan Bağlam Motorunda ayrıca değerlendirilir.'
  },

  // --- E. THICKENERS, POLYMERS, CHELATORS, ACIDS/BASES & HAIR CONDITIONERS ---
  {
    id: 'polymers_carbomer_acrylates',
    name: 'Synthetic Gel Polymers (Carbomer / Acrylates Crosspolymer / VP Copolymer)',
    aliases: [
      'carbomer', 'karbomer', 'acrylates/c10-30 alkyl acrylate crosspolymer', 'acrylates copolymer',
      'sodium polyacrylate', 'sodium polyacryloyldimethyl taurate', 'ammonium acryloyldimethyltaurate/vp copolymer',
      'hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer', 'polyacrylate crosspolymer-6',
      'polyacrylate-13', 'polyisobutene', 'vp/eicosene copolymer', 'vp/va copolymer', 'pvp', 'polyvinyl alcohol',
      'карбомер', 'كاربومير'
    ],
    domain: 'cosmetic',
    class: 'thickener',
    eu_detail: 'Jel ve krem dokusunu stabilize eden yüksek molekül ağırlıklı (ciltten emilmeyen) güvenli polimerler.'
  },
  {
    id: 'natural_gums_hydrocolloids',
    name: 'Natural Gums & Hydrocolloids (Xanthan E415 / Guar E412 / Pectin E440 / Cellulose E460–E466 / Alginate E401)',
    aliases: [
      'xanthan gum', 'ksantan gam', 'ksantan sakızı', 'e415', 'gomme xanthane', 'xanthan',
      'guar gum', 'guar gam', 'cyamopsis tetragonoloba gum', 'e412', 'hydroxypropyl guar',
      'locust bean gum', 'keçiboynuzu gamı', 'ceratonia siliqua gum', 'e410',
      'tara gum', 'tara gam', 'caesalpinia spinosa gum', 'e417',
      'gum arabic', 'acacia senegal gum', 'arap zamkı', 'akasya gamı', 'e414', 'gomme arabique',
      'tragacanth', 'kitre', 'e413', 'gellan gum', 'jellan gam', 'e418', 'konjac', 'glucomannan', 'e425',
      'pectin', 'pektin', 'e440', 'pectine', 'agar', 'agar-agar', 'e406',
      'alginic acid', 'e400', 'sodium alginate', 'sodyum aljinat', 'algin', 'e401', 'potassium alginate', 'e402',
      'calcium alginate', 'e404', 'propylene glycol alginate', 'e405',
      'cellulose', 'selüloz', 'microcrystalline cellulose', 'mikrokristalin selüloz', 'e460',
      'methylcellulose', 'e461', 'hydroxypropyl cellulose', 'e463', 'hydroxypropyl methylcellulose', 'hypromellose', 'e464',
      'ethylcellulose', 'e462', 'cellulose gum', 'carboxymethylcellulose', 'sodium carboxymethylcellulose', 'cmc', 'e466',
      'hydroxyethylcellulose', 'hidroksietilselüloz', 'sclerotium gum', 'pullulan', 'e1204',
      'ксантановая камедь', 'пектин', 'صمغ الزانثان', 'بكتين'
    ],
    domain: 'cosmetic+food',
    class: 'thickener',
    e_code: 'E400-E466',
    eu_detail: 'Bitkisel, deniz yosunu veya mikrobiyal fermantasyon kaynaklı güvenli kıvam artırıcı gamlar ve lifler.'
  },
  {
    id: 'clays_minerals_fillers',
    name: 'Mineral Clays, Silica & Powders (Silica E551 / Kaolin / Bentonite / Mica / Talc E553b)',
    aliases: [
      'silica', 'silika', 'silicon dioxide', 'silikon dioksit', 'topaklanmayı önleyici (e551)', 'e551',
      'hydrated silica', 'hidrate silika', 'silica silylate', 'silica dimethyl silylate',
      'kaolin', 'kaolin kili', 'e559', 'bentonite', 'bentonit', 'e558', 'hectorite', 'disteardimonium hectorite',
      'magnesium aluminum silicate', 'calcium silicate', 'e552', 'magnesium silicate', 'e553a',
      'talc', 'talk', 'e553b', 'mica', 'mika', 'ci 77019', 'fluorphlogopite', 'synthetic fluorphlogopite',
      'boron nitride', 'nylon-12', 'polymethyl methacrylate', 'polymethylsilsesquioxane', 'perlite', 'pumice',
      'zeolite', 'calamine', 'диоксид кремния', 'тальк', 'мика', 'سيليكا', 'تالك'
    ],
    domain: 'cosmetic+food',
    class: 'thickener',
    e_code: 'E551',
    eu_detail: 'Kozmetikte matlaştırıcı/kıvam verici, gıdada (E551-E553) topaklanmayı önleyici mineral bileşenler.'
  },
  {
    id: 'chelators_edta_phytate',
    name: 'Chelating Agents (Disodium EDTA / Tetrasodium EDTA / Calcium Disodium EDTA E385 / Sodium Phytate)',
    aliases: [
      'disodium edta', 'disodyum edta', 'tetrasodium edta', 'tetrasodyum edta', 'edta',
      'calcium disodium edta', 'e385', 'trisodium edta', 'trisodium ethylenediamine disuccinate',
      'tetrasodium glutamate diacetate', 'phytic acid', 'fitik asit', 'sodium phytate', 'sodyum fitat',
      'динатрий эдта', 'ثنائي صوديوم إيديتا'
    ],
    domain: 'cosmetic+food',
    class: 'chelator',
    e_code: 'E385',
    eu_detail: 'Formüldeki metal iyonlarını bağlayarak ürünün bozulmasını önleyen şelatlayıcılar (Gıdada E385 soslarda/konservelerde ADI sınırıyla izinlidir).'
  },
  {
    id: 'ph_adjusters_salts_bases',
    name: 'pH Adjusters, Salts & Electrolytes (Sodium Hydroxide E524 / Baking Soda E500 / Salt / Magnesium Sulfate)',
    aliases: [
      'sodium hydroxide', 'sodyum hidroksit', 'kostik', 'e524', 'potassium hydroxide', 'potasyum hidroksit', 'e525',
      'calcium hydroxide', 'e526', 'ammonium hydroxide', 'e527', 'magnesium hydroxide', 'e528',
      'aminomethyl propanol', 'tromethamine', 'arginine', 'arjinin', 'lysine', 'histidine', 'glycine', 'e640',
      'sodium bicarbonate', 'sodyum bikarbonat', 'karbonat', 'kabartma tozu', 'sodium carbonate', 'e500', 'e500i', 'e500ii',
      'potassium carbonate', 'e501', 'ammonium bicarbonate', 'ammonium carbonate', 'amonyum karbonat', 'e503',
      'magnesium carbonate', 'e504', 'sodium chloride', 'sodyum klorür', 'salt', 'tuz', 'sea salt', 'deniz tuzu',
      'maris sal', 'sel', 'salz', 'sal', 'garam', 'соль', 'ملح', 'نمک',
      'potassium chloride', 'potasyum klorür', 'e508', 'calcium chloride', 'kalsiyum klorür', 'e509',
      'magnesium chloride', 'e511', 'magnesium sulfate', 'magnezyum sülfat', 'epsom salt', 'calcium sulfate', 'e516',
      'zinc sulfate', 'zinc gluconate', 'çinko glukonat', 'copper gluconate', 'manganese gluconate',
      'calcium carbonate', 'kalsiyum karbonat', 'e170', 'ci 77220',
      'гидроксид натрия', 'хлорид натрия', 'هيدروكسيد الصوديوم', 'كلوريد الصوديوم'
    ],
    domain: 'cosmetic+food',
    class: 'pH_adjuster',
    e_code: 'E500-E528',
    eu_detail: 'Formülün pH dengesini cilt/gıda ile uyumlu hale getiren bazlar, tuzlar ve kabartıcı mineraller (Son üründe nötralize haldedir).'
  },
  {
    id: 'triethanolamine_tea',
    name: 'Triethanolamine (TEA)',
    aliases: ['triethanolamine', 'trietanolamin', 'tea', 'триэтаноламин'],
    domain: 'cosmetic',
    class: 'pH_adjuster',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III (Madde 62): Durulanmayan ürünlerde maksimum %2.5 sınırına ve nitrozamin saflık kriterlerine tabidir.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'hair_conditioning_quats',
    name: 'Hair Conditioning Agents (Behentrimonium Chloride / Cetrimonium Chloride / Polyquaternium)',
    aliases: [
      'behentrimonium chloride', 'behentrimonium methosulfate', 'cetrimonium chloride', 'setrimonyum klorür',
      'stearamidopropyl dimethylamine', 'distearoylethyl dimonium chloride', 'dicetyldimonium chloride',
      'quaternium-80', 'quaternium-22', 'polyquaternium-7', 'polyquaternium-10', 'polyquaternium-11',
      'polyquaternium-22', 'polyquaternium-37', 'polyquaternium-39', 'polyquaternium-47',
      'guar hydroxypropyltrimonium chloride', 'panthenyl ethyl ether', 'hydrolyzed wheat protein',
      'hydrolyzed soy protein', 'hydrolyzed corn protein', 'hydrolyzed rice protein', 'amino acids',
      'цетримониум хлорид', 'بيهنترمونيوم كلوريد'
    ],
    domain: 'cosmetic',
    class: 'conditioner',
    eu_detail: 'Saç tellerindeki statik elektriği önleyen ve tarama kolaylığı sağlayan katyonik saç bakım bileşenleri.'
  },
  {
    id: 'anti_dandruff_permitted',
    name: 'Permitted Anti-Dandruff Actives (Piroctone Olamine / Climbazole / Selenium Sulfide)',
    aliases: ['piroctone olamine', 'pirokton olamin', 'climbazole', 'klimazol', 'selenium sulfide', 'selenyum sülfür', 'ketoconazole'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III/V kapsamında izinli kepek karşıtı aktifler.'
  },
  {
    id: 'zinc_pyrithione_banned',
    name: 'Zinc Pyrithione (Pyrithione Zinc)',
    aliases: ['zinc pyrithione', 'pyrithione zinc', 'çinko pirition', 'zpt', 'пиритион цинка'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'yasak',
    eu_detail: 'AB Yönetmeliği (EU) 2021/1902 (Omnibus IV) ile CMR 1B (üreme toksisitesi) sınıflandırması nedeniyle Mart 2022\'den itibaren AB kozmetiklerinde YASAKLANMIŞTIR.',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi' },
    sources: ['EU_2021_1902', 'EU_1223_2009']
  },

  // --- F. UV FILTERS (MINERAL, MODERN EU & BANNED) ---
  {
    id: 'zinc_oxide_ci77947',
    name: 'Zinc Oxide (CI 77947)',
    aliases: ['zinc oxide', 'çinko oksit', 'ci 77947', 'zinkoxid', 'oxyde de zinc', 'оксид цинка', 'أكسيد الزنك'],
    domain: 'cosmetic',
    class: 'uv_filter',
    ci_code: 'CI 77947',
    eu_status: 'izinli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek VI (maks. %25) ve Ek IV kapsamında güvenli mineral (fiziksel) UV filtresi ve cilt yatıştırıcı.',
    sources: ['EU_1223_2009']
  },
  {
    id: 'modern_eu_uv_filters',
    name: 'Photostable Modern UV Filters (Tinosorb S / Tinosorb M / Uvinul A Plus / Uvinul T 150 / Mexoryl)',
    aliases: [
      'bis-ethylhexyloxyphenol methoxyphenyl triazine', 'bemotrizinol', 'tinosorb s',
      'methylene bis-benzotriazolyl tetramethylbutylphenol', 'bisoctrizole', 'tinosorb m',
      'diethylamino hydroxybenzoyl hexyl benzoate', 'dhhb', 'uvinul a plus',
      'ethylhexyl triazone', 'octyl triazone', 'uvinul t 150',
      'diethylhexyl butamido triazone', 'iscotrizinol', 'uvasorb heb',
      'terephthalylidene dicamphor sulfonic acid', 'ecamsule', 'mexoryl sx',
      'drometrizole trisiloxane', 'mexoryl xl', 'phenylbenzimidazole sulfonic acid', 'ensulizole',
      'polysilicone-15', 'tris-biphenyl triazine', 'tinosorb a2b', 'methoxypropylamino cyclohexenylidene ethoxyethylcyanoacetate', 'mexoryl 400'
    ],
    domain: 'cosmetic',
    class: 'uv_filter',
    eu_status: 'izinli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek VI kapsamında yüksek fotostabiliteye ve düşük cilt emilimine sahip yeni nesil güneş filtreleri.',
    sources: ['EU_1223_2009']
  },
  {
    id: 'avobenzone_octisalate',
    name: 'Conventional Organic UV Filters: Avobenzone & Ethylhexyl Salicylate (Octisalate)',
    aliases: [
      'butyl methoxydibenzoylmethane', 'avobenzone', 'avobenzon',
      'ethylhexyl salicylate', 'octisalate', 'oktisalat', 'octyl salicylate',
      'isoamyl p-methoxycinnamate', 'amiloxate', 'benzophenone-4', 'sulisobenzone'
    ],
    domain: 'cosmetic',
    class: 'uv_filter',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek VI kapsamında konsantrasyon sınırıyla (%5) izinli organik UV filtreleri.',
    severity: 'bilgi',
    profiles: { hassas_cilt: 'bilgi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'banned_uv_filters_paba_3bc',
    name: 'Banned UV Filters: PABA (4-Aminobenzoic Acid) & 3-Benzylidene Camphor',
    aliases: ['paba', '4-aminobenzoic acid', 'para-aminobenzoic acid', '3-benzylidene camphor'],
    domain: 'cosmetic',
    class: 'uv_filter',
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek II kapsamında kozmetik ürünlerde kullanımı YASAKLANMIŞ eski nesil UV filtreleri.',
    ed_tier: 'sartli_supheli',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi', hassas_cilt: 'kirmizi' },
    sources: ['EU_1223_2009']
  },

  // --- G. PRESERVATIVES & ANTIMICROBIALS ---
  {
    id: 'organic_acid_preservatives',
    name: 'Gentle Organic Acid Preservatives (Sodium Benzoate E211 / Potassium Sorbate E202 / Sorbic Acid E200)',
    aliases: [
      'sodium benzoate', 'sodyum benzoat', 'e211', 'benzoic acid', 'benzoik asit', 'e210',
      'potassium benzoate', 'e212', 'calcium benzoate', 'e213',
      'potassium sorbate', 'potasyum sorbat', 'e202', 'sorbic acid', 'sorbik asit', 'e200', 'calcium sorbate', 'e203',
      'dehydroacetic acid', 'dehidroasetik asit', 'sodium dehydroacetate', 'e265', 'e266',
      'calcium propionate', 'kalsiyum propiyonat', 'e282', 'sodium propionate', 'e281', 'propionic acid', 'e280',
      'sodium levulinate', 'levulinic acid', 'sodium anisate', 'p-anisic acid', 'caprylhydroxamic acid',
      'hydroxyacetophenone', 'p-hydroxyacetophenone', 'o-cymen-5-ol', 'isopropyl methylphenol',
      'бензоат натрия', 'сорбат калия', 'بنزوات الصوديوم', 'سوربات البوتاسيوم'
    ],
    domain: 'cosmetic+food',
    class: 'preservative',
    e_code: 'E200-E213',
    eu_status: 'izinli',
    eu_detail: 'Kozmetik (Ek V) ve gıdada (AB 1333/2008) yaygın kullanılan organik asit tuzu koruyucular.'
  },
  {
    id: 'benzyl_alcohol',
    name: 'Benzyl Alcohol (E1519)',
    aliases: ['benzyl alcohol', 'benzil alkol', 'e1519', 'бензиловый спирт', 'كحول بنزيلي'],
    domain: 'cosmetic+food',
    class: 'preservative',
    e_code: 'E1519',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek V (%1 koruyucu sınırı) ve Ek III (koku alerjeni bildirimi) kapsamında izinli aromatik alkol.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' },
    note: 'YANLIŞ POZİTİF KORUMASI: İsminde "Alcohol" geçmesine rağmen sarhoş edici etil alkol (etanol) değildir; aromatik koruyucu/çözücüdür.',
    sources: ['EU_1223_2009']
  },
  {
    id: 'chlorphenesin_ipbc_chlorhexidine',
    name: 'Synthetic Preservatives (Chlorphenesin / IPBC / Chlorhexidine / Cetylpyridinium Chloride)',
    aliases: [
      'chlorphenesin', 'klorfenezin', 'iodopropynyl butylcarbamate', 'ipbc',
      'chlorhexidine digluconate', 'klorheksidin diglukonat', 'chlorhexidine dihydrochloride',
      'cetylpyridinium chloride', 'setilpiridinyum klorür', 'piroctone olamine',
      'benzalkonium chloride', 'benzethonium chloride', 'polyaminopropyl biguanide', 'phmb'
    ],
    domain: 'cosmetic',
    class: 'preservative',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek V kapsamında belirli konsantrasyon ve ürün tipi sınırlarıyla izinli koruyucular.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'quaternium_15_chloroacetamide_banned',
    name: 'Banned Preservatives: Quaternium-15 & Chloroacetamide',
    aliases: ['quaternium-15', 'quaternium 15', 'chloroacetamide', 'kloroasetamid'],
    domain: 'cosmetic',
    class: 'preservative',
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek II kapsamında CMR sınıflandırması ve yüksek duyarlılaştırma riski nedeniyle YASAKLANMIŞTIR.',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi', hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi' },
    sources: ['EU_1223_2009']
  },

  // --- H. EXTENDED FRAGRANCE ALLERGENS & BANNED FRAGRANCES ---
  {
    id: 'eu_26_fragrance_allergens',
    name: 'EU Declarable Fragrance Allergens (Citral / Citronellol / Geraniol / Coumarin / Eugenol / Hexyl Cinnamal / Benzyl Salicylate)',
    aliases: [
      'citral', 'sitral', 'citronellol', 'sitronellol', 'geraniol', 'jeraniol', 'eugenol', 'öjenol', 'isoeugenol',
      'coumarin', 'kumarin', 'cinnamal', 'sinnamal', 'cinnamyl alcohol', 'sinnamil alkol',
      'benzyl benzoate', 'benzil benzoat', 'benzyl salicylate', 'benzil salisilat', 'benzyl cinnamate',
      'farnesol', 'hexyl cinnamal', 'heksil sinnamal', 'alpha-isomethyl ionone', 'alfa-izometil iyonon',
      'amyl cinnamal', 'amil sinnamal', 'amylcinnamyl alcohol', 'hydroxycitronellal', 'hidroksisitronellal',
      'anise alcohol', 'anason alkolü', 'methyl 2-octynoate', 'evernia prunastri extract', 'oakmoss extract',
      'evernia furfuracea extract', 'treemoss extract', 'vanillin', 'vanilin', 'ethyl vanillin', 'etil vanilin',
      'гераниол', 'цитраль', 'цитронеллол', 'кумарин', 'جيرانيول', 'سيترال'
    ],
    domain: 'cosmetic+food',
    class: 'fragrance_allergen',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III (ve EU 2023/1545) kapsamında durulanmayan ürünlerde %0.001, durulanan ürünlerde %0.01 eşiği aşıldığında etikette beyanı zorunlu koku bileşenleri.',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari', astim_alerji: 'sari' },
    sources: ['EU_1223_2009', 'EU_2023_1545']
  },
  {
    id: 'lyral_hicc_banned',
    name: 'HICC / Lyral (Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde)',
    aliases: ['hydroxyisohexyl 3-cyclohexene carboxaldehyde', 'hicc', 'lyral'],
    domain: 'cosmetic',
    class: 'fragrance_allergen',
    eu_status: 'yasak',
    eu_detail: 'AB Yönetmeliği (EU) 2017/1410 ile yüksek kontakt alerji riski nedeniyle AB\'de kozmetik ürünlerde YASAKLANMIŞTIR (Ek II).',
    severity: 'yuksek',
    profiles: { hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi' },
    sources: ['EU_1223_2009']
  },

  // --- I. ORAL CARE, DEODORANT & MAKEUP PIGMENTS ---
  {
    id: 'oral_care_fluorides_hydroxyapatite',
    name: 'Oral Care Actives (Sodium Fluoride / Stannous Fluoride / Hydroxyapatite / Calcium Phosphate)',
    aliases: [
      'sodium fluoride', 'sodyum florür', 'sodium monofluorophosphate', 'sodyum monoflorofosfat',
      'stannous fluoride', 'kalay florür', 'olaflur', 'amine fluoride',
      'hydroxyapatite', 'hidroksiapatit', 'dicalcium phosphate dihydrate', 'dicalcium phosphate', 'e341',
      'tetrapotassium pyrophosphate', 'tetrasodium pyrophosphate', 'zinc citrate', 'çinko sitrat',
      'фторид натрия', 'فلوريد الصوديوم'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'Diş minesini güçlendiren ve çürük önleyen ağız bakım aktifleri (AB Ek III kapsamında florür toplam maksimum %0.15 / 1500 ppm sınırıyla izinlidir).'
  },
  {
    id: 'deodorant_aluminum_salts',
    name: 'Antiperspirant Aluminum Salts & Alum (Aluminum Chlorohydrate / Potassium Alum)',
    aliases: [
      'aluminum chlorohydrate', 'alüminyum klorohidrat', 'aluminum sesquichlorohydrate',
      'aluminum zirconium tetrachlorohydrex gly', 'potassium alum', 'potasyum alum', 'şap', 'ammonium alum'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB SCCS (2020/2023) bilimsel görüşüne göre ter önleyici ürünlerde güvenli konsantrasyon sınırları içinde kullanımı güvenli bulunmuştur; tıraş sonrası tahrişli ciltte hassasiyet yapabilir.',
    severity: 'bilgi',
    profiles: { hassas_cilt: 'bilgi' }
  },
  {
    id: 'cosmetic_iron_oxides_pigments',
    name: 'Mineral & Approved Pigments (Iron Oxides CI 77491/77492/77499 / Ultramarines CI 77007 / Chromium Greens)',
    aliases: [
      'ci 77491', 'ci 77492', 'ci 77499', 'iron oxides', 'demir oksitler', 'e172',
      'ci 77007', 'ultramarines', 'ci 77288', 'chromium oxide greens', 'ci 77289', 'chromium hydroxide green',
      'ci 77510', 'ferric ferrocyanide', 'ferric ammonium ferrocyanide', 'ci 77742', 'manganese violet',
      'ci 77861', 'tin oxide', 'kalay oksit', 'ci 77163', 'bismuth oxychloride', 'ci 77266', 'carbon black', 'e153',
      'ci 15850', 'red 6', 'red 7 lake', 'ci 45410', 'red 27', 'red 28 lake', 'ci 19140', 'yellow 5 lake',
      'ci 15985', 'yellow 6 lake', 'ci 42090', 'blue 1 lake', 'ci 17200', 'red 33', 'ci 14700', 'red 4',
      'ci 77400', 'bronze powder', 'copper powder', 'ci 77820', 'silver',
      'оксиды железа', 'أكاسيد الحديد'
    ],
    domain: 'cosmetic+food',
    class: 'colorant',
    e_code: 'E172',
    ci_code: 'CI 77491-77499',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek IV kapsamında onaylı mineral ve kozmetik pigmentler (Böcek kaynaklı CI 75470 / E120 Karmin değildir).'
  },

  // --- J. COMPREHENSIVE FOOD ADDITIVES (E100–E1521) & WHOLE FOOD BASES ---
  {
    id: 'natural_food_colors_e100_e163',
    name: 'Natural Food Colors (Curcumin E100 / Riboflavin E101 / Chlorophyll E140 / Carotenes E160a / Paprika E160c / Beetroot E162 / Anthocyanins E163)',
    aliases: [
      'e100', 'curcumin', 'kurkumin', 'turmeric extract', 'zerdeçal',
      'e101', 'riboflavin', 'vitamin b2',
      'e140', 'chlorophyll', 'chlorophylls', 'klorofil', 'e141', 'copper complexes of chlorophylls',
      'e150a', 'plain caramel', 'sade karamel', 'karamel', 'caramel color',
      'e153', 'vegetable carbon', 'bitkisel karbon',
      'e160a', 'carotenes', 'beta-carotene', 'beta karoten', 'karotenler', 'ci 40800', 'ci 75130',
      'e160b', 'annatto', 'bixin', 'norbixin', 'e160c', 'paprika extract', 'capsanthin', 'paprika ekstraktı',
      'e160d', 'lycopene', 'likopen', 'e161b', 'lutein',
      'e162', 'beetroot red', 'betanin', 'pancar kökü kırmızısı',
      'e163', 'anthocyanins', 'antosiyaninler',
      'куркумин', 'бета-каротин', 'كركمين', 'بيتا كاروتين'
    ],
    domain: 'cosmetic+food',
    class: 'colorant',
    e_code: 'E100-E163',
    eu_detail: 'Bitkisel ve doğal kaynaklı gıda/kozmetik renklendiriciler (Southampton 6 sentetik azo boyaları grubunda değildir).'
  },
  {
    id: 'ammonia_sulfite_caramel_e150c_d',
    name: 'Ammonia & Sulfite Ammonia Caramel (E150b / E150c / E150d)',
    aliases: ['e150b', 'caustic sulphite caramel', 'e150c', 'ammonia caramel', 'amonyak karameli', 'e150d', 'sulphite ammonia caramel', 'amonyum sülfit karamel', 'renklendirici (e150d)', 'colorant e150d'],
    domain: 'food',
    class: 'colorant',
    e_code: 'E150d',
    eu_status: 'izinli_ADI',
    eu_detail: 'EFSA grup ADI 300 mg/kg vücut ağırlığı/gün (E150c için 100 mg/kg). Kolalı içeceklerde ve soslarda yaygın kullanılır; üretim yan ürünü 4-MEI için yasal saflık limitleri uygulanır.',
    severity: 'dusuk',
    profiles: { cocuk_metabolik: 'sari' },
    sources: ['EU_1333_2008']
  },
  {
    id: 'other_synthetic_food_colors_e123_e155',
    name: 'Regulated Synthetic Food Colors (Amaranth E123 / Erythrosine E127 / Patent Blue E131 / Indigotine E132 / Brilliant Blue E133)',
    aliases: [
      'e123', 'amaranth', 'amarant', 'e127', 'erythrosine', 'eritrozin',
      'e131', 'patent blue v', 'patent mavisi v', 'e132', 'indigotine', 'indigo carmine', 'indigotin',
      'e133', 'brilliant blue fcf', 'parlak mavi fcf', 'e142', 'green s', 'e151', 'brilliant black bn', 'e155', 'brown ht'
    ],
    domain: 'food',
    class: 'colorant',
    e_code: 'E123-E155',
    eu_status: 'izinli_ADI',
    eu_detail: 'AB 1333/2008 kapsamında belirli gıda kategorilerinde ve ADI sınırlarıyla izinli sentetik gıda boyaları (Not: E127 Eritrozin ABD FDA tarafından 2025\'te kısıtlama takvimine alınmıştır).',
    severity: 'orta',
    profiles: { cocuk_metabolik: 'sari', astim_alerji: 'sari' },
    sources: ['EU_1333_2008']
  },
  {
    id: 'phosphates_e338_e452',
    name: 'Phosphoric Acid & Food Phosphates (E338–E343 / Diphosphates E450 / Triphosphates E451 / Polyphosphates E452)',
    aliases: [
      'e338', 'phosphoric acid', 'fosforik asit', 'orthophosphoric acid', 'acide phosphorique', 'phosphorsäure',
      'e339', 'sodium phosphate', 'monosodium phosphate', 'disodium phosphate', 'trisodium phosphate', 'sodyum fosfat',
      'e340', 'potassium phosphate', 'dipotassium phosphate', 'monopotassium phosphate', 'potasyum fosfat',
      'e341', 'calcium phosphate', 'tricalcium phosphate', 'monocalcium phosphate', 'kalsiyum fosfat',
      'e343', 'magnesium phosphate',
      'e450', 'diphosphates', 'difosfatlar', 'disodium diphosphate', 'tetrasodium diphosphate', 'sodium acid pyrophosphate', 'sapp',
      'e451', 'triphosphates', 'trifosfatlar', 'pentasodium triphosphate',
      'e452', 'polyphosphates', 'polifosfatlar', 'sodium polyphosphate', 'sodium hexametaphosphate',
      'ортофосфорная кислота', 'пирофосфаты', 'حمض الفوسفوريك'
    ],
    domain: 'cosmetic+food',
    class: 'e_additive',
    e_code: 'E338-E452',
    eu_status: 'izinli_ADI',
    eu_detail: 'EFSA 2019 değerlendirmesi: Fosfatlar (E338-341, E343, E450-452) için toplam grup ADI 40 mg/kg vücut ağırlığı/gün (fosfor cinsinden).',
    severity: 'dusuk',
    profiles: { cocuk_metabolik: 'bilgi' },
    sources: ['EU_1333_2008']
  },
  {
    id: 'tbhq_propyl_gallate_e310_e319',
    name: 'Synthetic Lipid Antioxidants: Propyl Gallate (E310) & TBHQ (E319)',
    aliases: ['e310', 'propyl gallate', 'propil gallat', 'e319', 'tert-butylhydroquinone', 'tbhq', 'tersiyer bütilhidrokinon'],
    domain: 'cosmetic+food',
    class: 'antioxidant',
    e_code: 'E310-E319',
    eu_status: 'izinli_ADI',
    eu_detail: 'Kızartma yağları ve atıştırmalıklarda acılaşmayı önleyen sentetik antioksidanlar (ADI: E319 için 0.7 mg/kg/gün).',
    severity: 'dusuk',
    profiles: { hassas_cilt: 'sari', cocuk_metabolik: 'sari' },
    sources: ['EU_1333_2008']
  },
  {
    id: 'flavor_enhancers_nucleotides_e627_e635',
    name: 'Ribonucleotide Flavour Enhancers: Disodium Guanylate (E627), Disodium Inosinate (E631) & E635',
    aliases: [
      'e626', 'guanylic acid', 'e627', 'disodium guanylate', 'disodyum guanilat',
      'e630', 'inosinic acid', 'e631', 'disodium inosinate', 'disodyum inosinat',
      'e635', 'disodium 5\'-ribonucleotides', 'disodyum 5-ribonükleotidler', 'ribonükleotidler',
      'инозинат натрия', 'гуанилат натрия', 'إينوزينات ثنائي الصوديوم'
    ],
    domain: 'food',
    class: 'e_additive',
    e_code: 'E627-E635',
    eu_status: 'izinli_ADI',
    eu_detail: 'Cips, çorba ve soslarda lezzet artırıcı olarak kullanılır. Pürin metabolizması (gut/ürik asit) hassasiyeti olanlar dikkat etmelidir; ayrıca E631/E635 kaynağı (mikrobiyal vs et/balık/domuz) Helal Bağlam Motorunda kontrol edilir.',
    severity: 'bilgi',
    sources: ['EU_1333_2008']
  },
  {
    id: 'artificial_sweeteners_aspartame_acesulfame_sucralose',
    name: 'Intense Non-Nutritive Sweeteners (Acesulfame K E950 / Aspartame E951 / Cyclamate E952 / Saccharin E954 / Sucralose E955)',
    aliases: [
      'e950', 'acesulfame k', 'acesulfame potassium', 'asesülfam k', 'asesülfam potasyum',
      'e951', 'aspartame', 'aspartam',
      'e952', 'cyclamate', 'cyclamic acid', 'sodium cyclamate', 'siklamat', 'sodyum siklamat',
      'e954', 'saccharin', 'sodium saccharin', 'sakarin', 'sodyum sakarin',
      'e955', 'sucralose', 'sükraloz', 'sukraloz',
      'e961', 'neotame', 'neotam',
      'аспартам', 'сукралоза', 'ацесульфам калия', 'أسبارتام', 'سوكرالوز'
    ],
    domain: 'cosmetic+food',
    class: 'e_additive',
    e_code: 'E950-E955',
    eu_status: 'izinli_ADI',
    eu_detail: 'Kalorisiz yoğun tatlandırıcılar (EFSA Aspartam ADI: 40 mg/kg/gün; Fenilketonüri/PKU hastaları için "Fenilalanin kaynağı içerir" uyarısı zorunludur. DSÖ 2023 kılavuzu kilo kontrolü amacıyla uzun süreli yapay tatlandırıcı kullanımını önermemektedir).',
    severity: 'dusuk',
    profiles: { cocuk_metabolik: 'sari', hamilelik: 'bilgi' },
    sources: ['EU_1333_2008']
  },
  {
    id: 'stevia_polyol_sweeteners',
    name: 'Stevia (E960) & Sugar Alcohols / Polyols (Sorbitol E420 / Xylitol E967 / Erythritol E968 / Maltitol E965 / Isomalt E953)',
    aliases: [
      'e960', 'e960a', 'e960c', 'steviol glycosides', 'stevia', 'steviol glikozitler', 'rebaudioside a',
      'sorbitol', 'sorbitol syrup', 'e420', 'mannitol', 'e421', 'isomalt', 'izomalt', 'e953',
      'maltitol', 'maltitol syrup', 'maltitol şurubu', 'e965', 'lactitol', 'laktitol', 'e966',
      'xylitol', 'ksilitol', 'e967', 'erythritol', 'eritritol', 'e968', 'polydextrose', 'polidekstroz', 'e1200',
      'сорбит', 'ксилит', 'эритрит', 'стевия', 'سوربيتول', 'إكسيليتول', 'ستيفيا'
    ],
    domain: 'cosmetic+food',
    class: 'humectant',
    e_code: 'E420-E968',
    eu_status: 'izinli',
    eu_detail: 'Şeker alkolleri (polioller) ve Stevia; diş dostudur ve kan şekerini sükroz kadar yükseltmez (Gıdada %10 üzeri poliol kullanımında "aşırı tüketimi laksatif etki yaratabilir" uyarısı yer alır).',
    note: 'YANLIŞ POZİTİF KORUMASI: Şeker alkolleri (-ol ile biten Sorbitol, Xylitol, Maltitol, Erythritol) etil alkol değildir ve helaldir.'
  },
  {
    id: 'food_emulsifiers_lecithin_pgpr',
    name: 'Food Emulsifiers & Stabilizers (Lecithin E322 / PGPR E476 / Stearoyl Lactylates E481-E482 / Modified Starches E1404-E1451)',
    aliases: [
      'lecithin', 'lesitin', 'soy lecithin', 'soya lesitini', 'sunflower lecithin', 'ayçiçek lesitini', 'e322', 'lécithine', 'sojalecithin', 'лецитин', 'ليسيثين',
      'e471', 'mono- and diglycerides of fatty acids', 'mono- ve digliseritler', 'yağ asitlerinin mono ve digliseritleri',
      'e472a', 'e472b', 'e472c', 'e472e', 'datem', 'e473', 'sucrose esters of fatty acids', 'e475', 'polyglycerol esters of fatty acids',
      'e476', 'polyglycerol polyricinoleate', 'pgpr', 'poligliserol polirisinoleat',
      'e481', 'sodium stearoyl-2-lactylate', 'sodyum stearoil laktilat', 'e482', 'calcium stearoyl-2-lactylate',
      'modified starch', 'modifiye nişasta', 'modified corn starch', 'modified tapioca starch',
      'e1404', 'e1410', 'e1412', 'e1414', 'e1420', 'e1422', 'acetylated distarch adipate', 'e1440', 'e1442', 'hydroxypropyl distarch phosphate', 'e1450'
    ],
    domain: 'cosmetic+food',
    class: 'emulsifier',
    e_code: 'E322-E1450',
    eu_detail: 'Gıda ve kozmetik ürünlerinde dokuyu stabilize eden emülgatör ve modifiye nişastalar (E471-E482 grubu için bitkisel/hayvansal kaynak durumu Helal kartında incelenir).'
  },
  {
    id: 'common_whole_food_ingredients',
    name: 'Staple Food Ingredients (Flours, Starches, Cocoa, Dairy, Nuts, Spices, Tea/Coffee, Taurine)',
    aliases: [
      'wheat flour', 'buğday unu', 'weizenmehl', 'farine de blé', 'harina de trigo', 'tepung terigu', 'tepung gandum', 'пшеничная мука', 'دقيق القمح', 'میدہ',
      'whole wheat flour', 'tam buğday unu', 'wheat starch', 'buğday nişastası', 'wheat gluten', 'gluten', 'glüten',
      'corn starch', 'maize starch', 'mısır nişastası', 'maisstärke', 'amidon de maïs', 'almidón de maíz', 'pati jagung', 'кукурузный крахмал', 'نشا الذرة',
      'potato starch', 'patates nişastası', 'kartoffelstärke', 'potatoes', 'patates', 'dried potatoes',
      'rice flour', 'pirinç unu', 'rice starch', 'pirinç nişastası', 'oat flour', 'oats', 'rolled oats', 'yulaf', 'yulaf ezmesi',
      'corn flour', 'mısır unu', 'corn', 'maize', 'mısır', 'semolina', 'irmik', 'barley', 'arpa', 'rye flour', 'çavdar unu',
      'cocoa powder', 'fat-reduced cocoa powder', 'fat-reduced cocoa', 'kakao', 'kakao tozu', 'yağı azaltılmış kakao tozu', 'yağı azaltılmış kakao', 'cacao maigre', 'fettarmer kakao', 'cocoa mass', 'kakao kitlesi', 'kakaomasse', 'pâte de cacao', 'какао-порошок', 'كاكاو',
      'milk', 'süt', 'whole milk powder', 'tam yağlı süt tozu', 'skimmed milk powder', 'yağsız süt tozu', 'milk powder', 'süt tozu', 'magermilchpulver', 'lait écrémé en poudre', 'leche desnatada en polvo', 'susu bubuk', 'сухое молоко', 'حليب مجفف',
      'lactose', 'laktoz', 'süt şekeri', 'milk fat', 'butterfat', 'anhydrous milk fat', 'süt yağı', 'butter', 'tereyağı', 'beurre', 'mantequilla', 'сливочное масло', 'زبدة',
      'cream', 'krema', 'yogurt', 'yoğurt', 'cheese powder', 'peynir tozu', 'peynir', 'casein', 'sodium caseinate', 'kazein',
      'egg', 'yumurta', 'egg yolk', 'yumurta sarısı', 'egg white', 'yumurta akı', 'pasteurized egg',
      'soy protein', 'soya proteini', 'soy flour', 'soya unu', 'soybeans', 'soya',
      'hazelnuts', 'hazelnut', 'hazelnut paste', 'fındık', 'fındık püresi', 'haselnüsse', 'noisettes', 'avellanas', 'фундук', 'بندق',
      'peanuts', 'peanut', 'peanut butter', 'yer fıstığı', 'almonds', 'almond', 'badem', 'walnuts', 'ceviz', 'pistachios', 'antep fıstığı', 'cashews', 'kaju',
      'sesame', 'sesame seeds', 'susam', 'tahin', 'tahini', 'mustard', 'hardal', 'celery', 'kereviz',
      'yeast', 'maya', 'baker\'s yeast', 'ekmek mayası', 'yeast extract', 'maya ekstraktı', 'hefeextrakt', 'extrait de levure',
      'vinegar', 'sirke', 'spirit vinegar', 'apple cider vinegar', 'elma sirkesi', 'üzüm sirkesi', 'essig', 'vinaigre',
      'spices', 'baharatlar', 'paprika', 'kırmızı biber', 'garlic powder', 'sarımsak tozu', 'onion powder', 'soğan tozu', 'black pepper', 'karabiber', 'cinnamon', 'tarçın',
      'tomato paste', 'tomato powder', 'domates salçası', 'domates tozu', 'lemon juice', 'limon suyu', 'limon suyu konsantresi',
      'coffee', 'kahve', 'caffeine', 'kafein', 'кофеин', 'كافيين', 'taurine', 'taurin', 'таурин', 'تورين', 'inositol', 'guarana extract'
    ],
    domain: 'food',
    class: 'food_base',
    eu_detail: 'Gıda ürünlerinin temel tarımsal ve besinsel bileşenleri (Gluten, süt, yumurta, soya, sert kabuklu yemişler, yer fıstığı, susam, hardal ve kereviz AB 1169/2011 Ek II kapsamında alerjen bildirimi gerektirir).'
  },
  {
    id: 'food_flavourings_aroma',
    name: 'Flavourings / Natural Flavouring / Aroma',
    aliases: [
      'flavouring', 'flavourings', 'flavoring', 'flavorings', 'natural flavouring', 'natural flavor', 'natural flavors',
      'artificial flavor', 'aroma', 'aroma verici', 'aroma vericiler', 'doğal aroma verici', 'doğal aroma vericiler',
      'aromen', 'natürliches aroma', 'arômes', 'arôme naturel', 'aromas', 'saborizantes', 'perisa', 'perisa alami', 'perisa sintetik',
      'ароматизатор', 'ароматизаторы', 'نكهة', 'نكهات', 'نكهة طبيعية'
    ],
    domain: 'cosmetic+food',
    class: 'e_additive',
    eu_detail: 'Gıdalarda tat ve koku veren aroma bileşenleri (Sıvı aromalarda taşıyıcı çözücü olarak etil alkol veya propilen glikol kullanılıp kullanılmadığı Helal Bağlam Motorunda değerlendirilir).'
  },
  {
    id: 'vanilla_extract_alcoholic_carrier',
    name: 'Vanilla Extract (Alcohol Carrier Check)',
    aliases: ['vanilla extract', 'vanilya özütü', 'vanilya ekstraktı', 'pure vanilla extract', 'extrait de vanille', 'vanilleextrakt', 'экстракт ванили', 'خلاصة الفانيليا'],
    domain: 'cosmetic+food',
    class: 'e_additive',
    eu_detail: 'Doğal vanilya özütü; geleneksel üretimde (ör. ABD FDA standardı) en az %35 etil alkol çözücü içerebilir. Helal Bağlam Motorunda kontrol edilir (Sentetik Vanilin ise alkolsüzdür).'
  },
  {
    id: 'snail_secretion_filtrate',
    name: 'Snail Secretion Filtrate (Snail Mucin)',
    aliases: ['snail secretion filtrate', 'snail mucin', 'salyangoz salgısı filtratı', 'salyangoz özütü', 'муцин улитки', 'خلاصة الحلزون'],
    domain: 'cosmetic',
    class: 'active',
    eu_detail: 'Kore kozmetiğinde (K-Beauty) yaygın kullanılan nemlendirici/onarıcı salyangoz müsin filtratı; helal ve vegan uygunluğu Helal/Vegan kartlarında ayrıca değerlendirilir.'
  }
];

for (const sub of newSubstances) {
  upsertSubstance(sub);
}

substancesData.version = '2026-10-13-v3-comprehensive-10lang';
fs.writeFileSync(path.join(dataDir, 'substances.json'), JSON.stringify(substancesData, null, 2), 'utf8');

// ============================================================================
// EXPAND HALAL RULES (src/data/halal_rules.json) ACROSS 10 LANGUAGES + NEW RULES
// ============================================================================
const existingHalalMap = new Map(halalData.rules.map((r) => [r.id, r]));

function upsertHalalRule(rule) {
  if (existingHalalMap.has(rule.id)) {
    const existing = existingHalalMap.get(rule.id);
    existing.aliases = Array.from(new Set([...existing.aliases, ...(rule.aliases || [])]));
    existing.codes = Array.from(new Set([...(existing.codes || []), ...(rule.codes || [])]));
  } else {
    halalData.rules.push(rule);
    existingHalalMap.set(rule.id, rule);
  }
}

// Expand existing halal rules with 10-language aliases
const halalAliasExpansions = {
  pork_gelatin: ['gelatina de cerdo', 'gelatin babi', 'свиной желатин', 'سور کا جیلیٹن'],
  lard: ['manteca de cerdo', 'lemak babi', 'свиной жир', 'سور کی چربی'],
  pork_generic: ['cerdo', 'porcino', 'babi', 'khinzir', 'свинина', 'سور'],
  wine_beer_liquor: ['vino', 'cerveza', 'licor', 'khamr', 'arak', 'вино', 'пиво', 'خمر', 'نبيذ', 'شراب'],
  ethanol_cosmetic_or_food: ['alcohol etílico', 'etanol', 'alkohol denat', 'этиловый спирт', 'этанол', 'إيثانول', 'كحول إيثيلي', 'ایتھانول', 'الکحل'],
  gelatin_unspecified: ['gelatina', 'желатин', 'جیلیٹن', 'beef gelatin', 'bovine gelatin', 'sığır jelatini'],
  e471: ['mono y diglicéridos de ácidos grasos', 'моно- и диглицериды жирных кислот', 'أحادي وثنائي الجليسريد'],
  glycerin: ['glicerina', 'глицерин', 'جلسرين', 'گلیسرین'],
  l_cysteine: ['l-cisteína', 'l-sisteina', 'л-цистеин', 'إل-سيستين'],
  collagen_keratin: ['colágeno', 'queratina', 'kolagen', 'коллаген', 'кератин', 'كولاجين', 'كيراتين'],
  whey_rennet: ['suero de leche', 'cuajo', 'air dadih', 'renet', 'молочная сыворотка', 'сычужный фермент', 'مصل اللبن', 'منفحة'],
  carmine_e120: ['carmín', 'ácido carmínico', 'karmin', 'кармин', 'كارمين', 'قرمز', 'کارمائن'],
  shellac_e904: ['goma laca', 'syelak', 'шеллак', 'شيلاك'],
  lecithin_e322: ['lecitina', 'lecitina de soja', 'lesitin kedelai', 'лецитин', 'ليسيثين'],
  beeswax_honey_lanolin: ['cera de abejas', 'miel', 'lanolina', 'lilin lebah', 'madu', 'пчелиный воск', 'мед', 'ланолин', 'شمع العسل', 'عسل', 'لانولين'],
  safe_non_ethanol_alcohols: [
    'propanediol', '1,2-hexanediol', 'dipropylene glycol', 'ethylhexylglycerin', 'stearyl alcohol',
    'arachidyl alcohol', 'behenyl alcohol', 'octyldodecanol', 'hexyldecanol', 'cholesterol', 'panthénol'
  ]
};

for (const [id, extra] of Object.entries(halalAliasExpansions)) {
  if (existingHalalMap.has(id)) {
    const r = existingHalalMap.get(id);
    r.aliases = Array.from(new Set([...r.aliases, ...extra]));
  }
}

// Add new real-world Halal rules so zero blind spots remain
const newHalalRules = [
  {
    id: 'e631_e635_nucleotides',
    canonical: 'Disodium Inosinate (E631), Disodium Guanylate (E627) & Ribonucleotides (E635)',
    aliases: [
      'disodium inosinate', 'disodyum inosinat', 'inosinic acid', 'disodium guanylate', 'disodyum guanilat',
      'disodium 5\'-ribonucleotides', 'disodyum 5-ribonükleotidler', 'ribonükleotidler', 'инозинат натрия', 'إينوزينات ثنائي الصوديوم'
    ],
    codes: ['E627', 'E630', 'E631', 'E632', 'E633', 'E635'],
    category: 'C_musbooh',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: true,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Lezzet artırıcı ribonükleotidler (E631/E635) mikrobiyal fermantasyondan (tapyoka/şeker), balıktan veya hayvansal et özütünden (domuz/sığır) elde edilebilir. Üründe Vegan veya Helal sertifikası varsa bitkisel/mikrobiyal kaynaklıdır.'
  },
  {
    id: 'e432_e436_polysorbates',
    canonical: 'Polysorbates (E432–E436) & Sorbitan Esters (E491–E495)',
    aliases: [
      'polysorbate 20', 'polisorbat 20', 'polysorbate 60', 'polisorbat 60', 'polysorbate 80', 'polisorbat 80',
      'polysorbate 40', 'polysorbate 65', 'sorbitan stearate', 'sorbitan tristearate', 'sorbitan oleate',
      'sorbitan monolaurate', 'sorbitan palmitate', 'полисорбат 80', 'بوليسوربات 80'
    ],
    codes: ['E432', 'E433', 'E434', 'E435', 'E436', 'E491', 'E492', 'E493', 'E494', 'E495'],
    category: 'C_musbooh',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: true,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'EU_1333_2008',
    verification: 'ikincil_kontrol',
    template_tr: 'Polisorbatlar (E432–E436) ve sorbitan esterleri (E491–E495) üretiminde kullanılan yağ asitleri bitkisel veya hayvansal kaynaklı olabilir. Vegan veya Helal sertifikası varsa bitkisel kaynaklıdır.'
  },
  {
    id: 'e481_e482_stearoyl_lactylates',
    canonical: 'Sodium & Calcium Stearoyl-2-Lactylate (E481 / E482)',
    aliases: ['sodium stearoyl-2-lactylate', 'sodyum stearoil laktilat', 'calcium stearoyl-2-lactylate', 'kalsiyum stearoil laktilat'],
    codes: ['E481', 'E482'],
    category: 'C_musbooh',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: true,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'EU_1333_2008',
    verification: 'ikincil_kontrol',
    template_tr: 'Unlu mamullerde kullanılan E481/E482 emülgatörlerinin stearik asit kısmı bitkisel veya hayvansal olabilir. Vegan veya Helal sertifikası ile bitkisel kaynağı doğrulanır.'
  },
  {
    id: 'flavourings_aroma_solvent_check',
    canonical: 'Flavourings / Natural Flavouring / Aroma (Carrier Solvent Check)',
    aliases: [
      'flavouring', 'flavourings', 'flavoring', 'flavorings', 'natural flavouring', 'natural flavor', 'natural flavors',
      'artificial flavor', 'aroma', 'aroma verici', 'aroma vericiler', 'doğal aroma verici', 'doğal aroma vericiler',
      'aromen', 'natürliches aroma', 'arômes', 'arôme naturel', 'perisa', 'perisa alami', 'ароматизатор', 'نكهة', 'نكهات', 'نكهة طبيعية'
    ],
    codes: [],
    category: 'C_musbooh',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Aroma vericilerde (Flavourings) sıvı taşıyıcı çözücü olarak bitkisel yağ/propilen glikol kullanılabileceği gibi etil alkol de kullanılabilir (Vegan logosu etil alkol taşıyıcısını dışlamaz; Helal sertifikası ile doğrulanmalıdır).'
  },
  {
    id: 'vanilla_extract_carrier',
    canonical: 'Vanilla Extract (Alcohol Extraction Check)',
    aliases: ['vanilla extract', 'pure vanilla extract', 'vanilya özütü', 'vanilya ekstraktı', 'extrait de vanille', 'vanilleextrakt', 'экстракт ванили', 'خلاصة الفانيليا'],
    codes: [],
    category: 'C_musbooh',
    vegan_compatible: true,
    vegetarian_compatible: true,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'kirmizi',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Geleneksel vanilya özütü (Vanilla Extract) ekstraksiyonunda genellikle etil alkol kullanılır (Toz vanilya veya sentetik Vanilin ise alkolsüzdür). Helal sertifikası kontrol edilmelidir.'
  },
  {
    id: 'snail_mucin_halal',
    canonical: 'Snail Secretion Filtrate (Land Snail Mucin)',
    aliases: ['snail secretion filtrate', 'snail mucin', 'salyangoz salgısı filtratı', 'salyangoz özütü', 'муцин улитки', 'خلاصة الحلزون'],
    codes: [],
    category: 'D_tartismali',
    vegan_compatible: false,
    vegetarian_compatible: false,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'kirmizi',
      GIMDES: 'kirmizi',
      JAKIM: 'kirmizi',
      MUI: 'kirmizi',
      IFANCA: 'sari'
    },
    source_id: 'BPJPH_MUI_ID',
    verification: 'ikincil_kontrol',
    template_tr: 'Kara salyangozu salgısı (Snail Mucin); Endonezya MUI, Malezya JAKIM ve GİMDES kriterlerinde kara haşaratı/yumuşakçası kapsamında kozmetik helal sertifikasyonuna uygun kabul edilmemektedir. Vegan değildir.'
  },
  {
    id: 'animal_enzymes_pepsin_lipase',
    canonical: 'Digestive & Cheese Enzymes (Pepsin / Lipase / Pancreatin / Trypsin)',
    aliases: ['pepsin', 'lipase', 'lipaz', 'pancreatin', 'pankreatin', 'trypsin', 'tripsin', 'animal enzyme', 'пепсин', 'липаза', 'بيبسين', 'ليباز'],
    codes: ['E1105'],
    category: 'C_musbooh',
    vegan_compatible: false,
    vegetarian_compatible: true,
    vegan_claim_resolves: true,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Pepsin ve lipaz gibi enzimler mikrobiyal kaynaklı olabileceği gibi domuz veya sığır midesinden/pankreasından da elde edilebilir. Helal veya Vegan sertifikası aranmalıdır.'
  },
  {
    id: 'edible_bone_phosphate_e542',
    canonical: 'Edible Bone Phosphate (E542)',
    aliases: ['bone phosphate', 'edible bone phosphate', 'kemik fosfatı', 'костный фосфат'],
    codes: ['E542'],
    category: 'C_musbooh',
    vegan_compatible: false,
    vegetarian_compatible: false,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'kirmizi',
      GIMDES: 'kirmizi',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'E542 hayvan kemiklerinden üretilen topaklanma önleyicidir. Hayvanın türü ve İslami kesim durumu belirsizdir; Vegan değildir.'
  }
];

for (const r of newHalalRules) {
  upsertHalalRule(r);
}

halalData.version = '2026-10-13-v3-comprehensive-10lang';
fs.writeFileSync(path.join(dataDir, 'halal_rules.json'), JSON.stringify(halalData, null, 2), 'utf8');

// ============================================================================
// EXPAND HIDDEN SUGARS (src/data/hidden_sugars.json) ACROSS 10 LANGUAGES
// ============================================================================
const sugarExpansions = {
  sugar: ['سكر', 'azúcar', 'gula', 'gula pasir', 'сахар', 'چینی', 'شکر'],
  glucose: ['جلوكوز', 'دكستروز', 'glucosa', 'glukosa', 'глюкоза', 'декстроза', 'گلوکوز'],
  fructose: ['فركتوز', 'fructosa', 'fruktosa', 'фруктоза', 'فرکٹوز'],
  glucose_syrup: ['شراب الجلوكوز', 'jarabe de glucosa', 'sirup glukosa', 'сироп глюкозы', 'патока'],
  glucose_fructose_syrup: ['شراب الجلوكوز والفركتوز', 'jarabe de glucosa y fructosa', 'jarabe de maíz de alta fructosa', 'сироп глюкозы-фруктозы'],
  honey: ['عسل', 'miel', 'madu', 'мед', 'شہد'],
  molasses: ['دبس', 'عسل أسود', 'melaza', 'molase', 'меласса', 'патока']
};

for (const item of sugarsData.free_sugars) {
  if (sugarExpansions[item.id]) {
    item.aliases = Array.from(new Set([...item.aliases, ...sugarExpansions[item.id]]));
  }
}

const extraSugars = [
  {
    id: 'coconut_palm_sugar',
    canonical: 'Coconut / Palm Sugar',
    aliases: ['coconut sugar', 'hindistan cevizi şekeri', 'palm sugar', 'gula aren', 'gula kelapa', 'gula melaka', 'kokosblütenzucker', 'sucre de coco', 'azúcar de coco', 'кокосовый сахар', 'سكر جوز الهند']
  },
  {
    id: 'date_carob_syrup',
    canonical: 'Date Syrup / Carob Syrup',
    aliases: ['date syrup', 'hurma şurubu', 'hurma özü', 'keçiboynuzu özü', 'carob syrup', 'dattelnsirup', 'sirop de dattes', 'دبس التمر']
  }
];
const existingSugarIds = new Set(sugarsData.free_sugars.map((s) => s.id));
for (const es of extraSugars) {
  if (!existingSugarIds.has(es.id)) {
    sugarsData.free_sugars.push(es);
  }
}

// Expand rapid carbs aliases
sugarsData.rapid_carbohydrates_non_sugar[0].aliases = Array.from(
  new Set([
    ...sugarsData.rapid_carbohydrates_non_sugar[0].aliases,
    'maltodekstrina',
    'мальтодекстрин',
    'مالتوديكسترين',
    'مالٹوڈیکسٹرین'
  ])
);

sugarsData.version = '2026-10-13-v3-comprehensive-10lang';
fs.writeFileSync(path.join(dataDir, 'hidden_sugars.json'), JSON.stringify(sugarsData, null, 2), 'utf8');

// Count total unique aliases across all dictionaries
let totalSubstanceAliases = 0;
for (const s of substancesData.substances) totalSubstanceAliases += s.aliases.length + 1;
let totalHalalAliases = 0;
for (const r of halalData.rules) totalHalalAliases += r.aliases.length + (r.codes ? r.codes.length : 0) + 1;
let totalSugarAliases = 0;
for (const sg of sugarsData.free_sugars) totalSugarAliases += sg.aliases.length;

console.log(`✅ Database expansion complete!`);
console.log(`   - Substances classes/entries: ${substancesData.substances.length} (${totalSubstanceAliases} unique INCI/E-code/10-lang aliases)`);
console.log(`   - Halal rules: ${halalData.rules.length} (${totalHalalAliases} aliases & codes)`);
console.log(`   - Free sugars: ${sugarsData.free_sugars.length} (${totalSugarAliases} aliases)`);


// ============================================================================
// PART 2 EXPANSION: HAIR DYES, NAIL/GEL CARE (EU 2025 TPO BAN), BABY CARE,
// MICROPLASTICS/PFAS & ADDITIONAL E-CODES + 10-LANGUAGE ALIASES
// ============================================================================
sourcesData.sources.EU_2024_197 = {
  id: 'EU_2024_197',
  title: 'Commission Delegated Regulation (EU) 2024/197 & Omnibus VII (TPO Ban in Cosmetics from Sept 2025)',
  jurisdiction: 'EU',
  type: 'regulation',
  url: 'https://eur-lex.europa.eu/eli/reg_del/2024/197/oj'
};
sourcesData.sources.EU_2023_2055 = {
  id: 'EU_2023_2055',
  title: 'Commission Regulation (EU) 2023/2055 (REACH Restriction on Synthetic Polymer Microparticles / Microplastics)',
  jurisdiction: 'EU',
  type: 'regulation',
  url: 'https://eur-lex.europa.eu/eli/reg/2023/2055/oj'
};
fs.writeFileSync(path.join(dataDir, 'sources.json'), JSON.stringify(sourcesData, null, 2), 'utf8');

const part2Substances = [
  {
    id: 'tpo_nail_banned_2025',
    name: 'TPO (Trimethylbenzoyl Diphenylphosphine Oxide)',
    aliases: ['trimethylbenzoyl diphenylphosphine oxide', 'tpo', 'diphenyl(2,4,6-trimethylbenzoyl)phosphine oxide'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'yasak',
    eu_detail: 'AB Omnibus VII Yönetmeliği (2024/197 bağlantı) kapsamında CMR 1B (üreme toksisitesi) sınıflandırması nedeniyle 1 Eylül 2025\'ten itibaren jel oje ve kozmetik ürünlerde YASAKLANMIŞTIR (Ek II).',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi', hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi' },
    sources: ['EU_2024_197', 'EU_1223_2009']
  },
  {
    id: 'hema_dihema_nail',
    name: 'HEMA & Di-HEMA Trimethylhexyl Dicarbamate (Gel Nail Monomers)',
    aliases: ['hema', '2-hydroxyethyl methacrylate', 'hydroxyethyl methacrylate', 'di-hema trimethylhexyl dicarbamate'],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III: Yüksek alerjik kontakt dermatit riski nedeniyle yalnızca profesyonel tırnak ürünlerinde izinlidir ("Yalnızca profesyonel kullanım içindir / Alerjik reaksiyona neden olabilir" uyarısı zorunludur).',
    severity: 'orta',
    profiles: { hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'banned_phthalates_dbp_dehp',
    name: 'Banned Phthalates (Dibutyl Phthalate DBP / DEHP / BBP / DIBP)',
    aliases: ['dibutyl phthalate', 'dbp', 'diethylhexyl phthalate', 'dehp', 'benzyl butyl phthalate', 'bbp', 'diisobutyl phthalate', 'dibp', 'ftalat'],
    domain: 'cosmetic',
    class: 'solvent',
    eu_status: 'yasak',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek II kapsamında CMR 1B (üreme toksisitesi) ve endokrin bozucu özellikleri nedeniyle kozmetiklerde YASAKLANMIŞTIR.',
    ed_tier: 'sartli_supheli',
    severity: 'yuksek',
    profiles: { hamilelik: 'kirmizi', cocuk_metabolik: 'kirmizi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'diethyl_phthalate_dep',
    name: 'Diethyl Phthalate (DEP)',
    aliases: ['diethyl phthalate', 'dietil ftalat', 'dep'],
    domain: 'cosmetic',
    class: 'solvent',
    eu_status: 'izinli',
    eu_detail: 'SCCS tarafından parfüm çözücüsü/denatüran olarak mevcut sınırlar içinde izinli bulunmuştur (Yasaklı DBP/DEHP ftalatları ile karıştırılmamalıdır).',
    severity: 'dusuk',
    profiles: { hamas_cilt: 'bilgi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'tphp_toluene_nail',
    name: 'Nail Solvents & Plasticizers: Toluene & Triphenyl Phosphate (TPHP)',
    aliases: ['toluene', 'toluen', 'triphenyl phosphate', 'tphp', 'trifenil fosfat'],
    domain: 'cosmetic',
    class: 'solvent',
    eu_status: 'kisitli',
    eu_detail: 'Toluen AB Ek III kapsamında yalnız yetişkin tırnak ürünlerinde sıkı sınırlarla (%25, çocukların erişemeyeceği uyarı ile) kısıtlıdır; TPHP ise SCCS endokrin inceleme listesindedir.',
    ed_tier: 'potansiyel_endokrin',
    severity: 'orta',
    profiles: { hamilelik: 'kirmizi', cocuk_metabolik: 'kirmizi', hassas_cilt: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'nail_polish_standard_solvents',
    name: 'Standard Nail Polish Solvents & Film Formers (Ethyl Acetate / Butyl Acetate / Nitrocellulose / Acetyl Tributyl Citrate)',
    aliases: [
      'ethyl acetate', 'etil asetat', 'butyl acetate', 'bütil asetat', 'propyl acetate',
      'nitrocellulose', 'nitroselüloz', 'acetyl tributyl citrate', 'adipic acid/neopentyl glycol/trimellitic anhydride copolymer',
      'acrylates copolymer', 'stearalkonium bentonite', 'stearalkonium hectorite', 'diacetone alcohol', 'sucrose acetate isobutyrate', 'e444'
    ],
    domain: 'cosmetic+food',
    class: 'solvent',
    eu_detail: 'Standart oje çözücüleri ve film oluşturucu polimerler.'
  },
  {
    id: 'hair_dye_sensitizers_ppd_resorcinol',
    name: 'Oxidative Hair Dye Actives (p-Phenylenediamine PPD / Toluene-2,5-Diamine / Resorcinol / Aminophenols)',
    aliases: [
      'p-phenylenediamine', 'ppd', 'para-phenylenediamine', 'toluene-2,5-diamine', 'toluene-2,5-diamine sulfate',
      'resorcinol', 'rezorsinol', '2-methylresorcinol', '4-chlororesorcinol',
      'm-aminophenol', 'p-aminophenol', '4-amino-2-hydroxytoluene', '1-naphthol', '2-amino-4-hydroxyethylaminoanisole sulfate',
      'phenyl methyl pyrazolone', 'hc blue no. 2', 'basic brown 16', 'basic red 76'
    ],
    domain: 'cosmetic',
    class: 'colorant',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III: Kalıcı saç boyalarında sıkı maksimum konsantrasyon sınırlarına ve "Ciddi alerjik reaksiyona neden olabilir / 16 yaş altında kullanılmaz" zorunlu etiket uyarısına tabidir (Resorcinol ayrıca endokrin değerlendirme listesindedir).',
    ed_tier: 'potansiyel_endokrin',
    severity: 'orta',
    profiles: { hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi', hamilelik: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'hair_bleach_peroxide_persulfates',
    name: 'Hair Oxidizers & Alkalizers (Hydrogen Peroxide / Persulfates / Ammonia / Ethanolamine)',
    aliases: [
      'hydrogen peroxide', 'hidrojen peroksit', 'potassium persulfate', 'potasyum persülfat',
      'ammonium persulfate', 'amonyum persülfat', 'sodium persulfate', 'sodyum persülfat',
      'ethanolamine', 'monoethanolamine', 'mea', 'etanolamin', 'ammonia', 'amonyak',
      'sodium metasilicate', 'sodium sulfite', 'thioglycolic acid', 'tiyoglikolik asit', 'calcium thioglycolate'
    ],
    domain: 'cosmetic',
    class: 'active',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III kapsamında saç açıcı, boya oksidanı ve tüy dökücü ürünlerde konsantrasyon ve koruyucu eldiven/göz teması uyarılarıyla izinlidir.',
    severity: 'orta',
    profiles: { hassas_cilt: 'kirmizi', astim_alerji: 'kirmizi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'boric_acid_borates_restricted',
    name: 'Boric Acid & Sodium Borate (Borax)',
    aliases: ['boric acid', 'borik asit', 'sodium borate', 'borax', 'boraks', 'disodium tetraborate', 'e284', 'e285'],
    domain: 'cosmetic+food',
    class: 'preservative',
    e_code: 'E284-E285',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III: CMR 1B sınıflandırması nedeniyle 3 yaş altı çocuk ürünlerinde kullanımı YASAKTIR; yetişkin ürünlerinde sıkı konsantrasyon sınırlarına tabidir.',
    severity: 'orta',
    profiles: { hamilelik: 'kirmizi', cocuk_metabolik: 'kirmizi' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'pfas_ptfe_fluoropolymers',
    name: 'Fluoropolymers / PFAS in Cosmetics (PTFE / Perfluorononyl Dimethicone / C9-15 Fluoroalcohol Phosphate)',
    aliases: ['ptfe', 'polytetrafluoroethylene', 'teflon', 'perfluorononyl dimethicone', 'perfluorodecalin', 'c9-15 fluoroalcohol phosphate', 'polyperfluoromethylisopropyl ether'],
    domain: 'cosmetic',
    class: 'emollient',
    eu_status: 'kisitli',
    eu_detail: 'Kalıcı florlu bileşikler (PFAS); çevresel kalıcılık ("sonsuz kimyasallar") nedeniyle AB REACH kapsamında aşamalı kısıtlama sürecindedir.',
    severity: 'orta',
    profiles: { hamilelik: 'sari' },
    sources: ['EU_1223_2009']
  },
  {
    id: 'lysozyme_e1105_egg',
    name: 'Lysozyme (E1105 - Egg White Enzyme)',
    aliases: ['e1105', 'lysozyme', 'lizozim', 'muramidase', 'yumurta akı lizozimi'],
    domain: 'cosmetic+food',
    class: 'e_additive',
    e_code: 'E1105',
    eu_status: 'izinli_alerjen',
    eu_detail: 'Tavuk yumurtası akından elde edilen doğal koruyucu enzim (E1105). Yumurta alerjisi olan bireyler için AB 1169/2011 kapsamında zorunlu alerjendir; helaldir ancak Vegan değildir.',
    severity: 'bilgi',
    profiles: { astim_alerji: 'kirmizi' },
    sources: ['EU_1169_2011', 'EU_1333_2008']
  },
  {
    id: 'extra_e_additives_permitted',
    name: 'Permitted Food Additives (Acetic Acid E260 / Carbon Dioxide E290 / Nitrogen E941 / Invertase E1103 / Triethyl Citrate E1505)',
    aliases: [
      'e260', 'acetic acid', 'asetik asit', 'e261', 'potassium acetate', 'e262', 'sodium acetate', 'sodium diacetate', 'e263', 'calcium acetate',
      'e290', 'carbon dioxide', 'karbondioksit', 'e297', 'fumaric acid', 'fumarik asit',
      'e355', 'adipic acid', 'adipik asit', 'e363', 'succinic acid', 'süksinik asit',
      'e442', 'ammonium phosphatides', 'amonyum fosfatidler',
      'e507', 'hydrochloric acid', 'e514', 'sodium sulfate', 'sodyum sülfat',
      'e579', 'ferrous gluconate', 'demir glukonat', 'e585', 'ferrous lactate', 'demir laktat',
      'e941', 'nitrogen', 'azot', 'e942', 'nitrous oxide', 'e948', 'oxygen',
      'e957', 'thaumatin', 'taumatin', 'e959', 'neohesperidin dc',
      'e1103', 'invertase', 'invertaz', 'e1201', 'pvp', 'e1202', 'pvpp',
      'e1505', 'triethyl citrate', 'trietil sitrat', 'e1518', 'triacetin', 'triasetin'
    ],
    domain: 'cosmetic+food',
    class: 'e_additive',
    e_code: 'E260-E1518',
    eu_detail: 'AB 1333/2008 kapsamında standart gıda üretiminde izinli koruyucu gazlar, asitlik düzenleyiciler ve enzimler.'
  }
];

for (const sub of part2Substances) {
  upsertSubstance(sub);
}
fs.writeFileSync(path.join(dataDir, 'substances.json'), JSON.stringify(substancesData, null, 2), 'utf8');

let totalSubAliases2 = 0;
for (const s of substancesData.substances) totalSubAliases2 += s.aliases.length + 1;
console.log(`✅ Part 2 expansion complete! Total substance classes: ${substancesData.substances.length}, Total aliases: ${totalSubAliases2}`);


// ============================================================================
// PART 3: SUBAGENT AUDIT REMEDIATION — ALL 26 REAL-WORLD PRODUCTS COVERAGE,
// 10-LANGUAGE WARNING ALIASES, COLLISION FIXES & HALAL DAIRY/MEAT/TALLOW RULES
// ============================================================================

// 1. Fix alias collisions & typos reported by Subagents 1 & 2:
//    - Remove 'ci 19140' and 'ci 15985' from cosmetic_iron_oxides_pigments so southampton_dyes is not overwritten
if (existingSubMap.has('cosmetic_iron_oxides_pigments')) {
  const pig = existingSubMap.get('cosmetic_iron_oxides_pigments');
  pig.aliases = pig.aliases.filter((a) => a !== 'ci 19140' && a !== 'ci 15985' && a !== 'yellow 5 lake' && a !== 'yellow 6 lake');
}
//    - Remove 'piroctone olamine' from chlorphenesin_ipbc_chlorhexidine so anti_dandruff_permitted is not overwritten
if (existingSubMap.has('chlorphenesin_ipbc_chlorhexidine')) {
  const chl = existingSubMap.get('chlorphenesin_ipbc_chlorhexidine');
  chl.aliases = chl.aliases.filter((a) => a !== 'piroctone olamine');
}
//    - Fix typo 'hamas_cilt' -> 'hassas_cilt' in diethyl_phthalate_dep
if (existingSubMap.has('diethyl_phthalate_dep')) {
  const dep = existingSubMap.get('diethyl_phthalate_dep');
  dep.profiles = { hassas_cilt: 'bilgi' };
}

// 2. Add 10-language aliases to existing warning/profile substances (Subagent 2 findings)
const warningAliasExpansions = {
  alcohol_denat: [
    'alcool dénaturé', 'alcool denature', 'alcohol desnaturalizado', 'alkohol denat.', 'alkohol denat',
    'этиловый спирт', ' спирт этиловый', 'денотурированный спирт', 'إيثانول', 'كحول محول', 'ایتھانول', 'الکحل'
  ],
  sls: [
    'лаурилсульфат натрия', 'لوريل كبريتات الصوديوم', 'كبريتات لوريل الصوديوم',
    'lauril sulfato de sodio', 'laurylsulfate de sodium', 'natriumlaurylsulfat', 'natrium lauril sulfat', 'سوڈیم لوریل سلفیٹ'
  ],
  parabens_permitted: [
    'méthylparabène', 'éthylparabène', 'metilparabeno', 'etilparabeno', 'метилпарабен', 'этилпарабен', 'ميثيل بارابين', 'إيثيل بارابين'
  ],
  parabens_restricted: [
    'propylparabène', 'butylparabène', 'propilparabeno', 'butilparabeno', 'пропилпарабен', 'бутилпарабен', 'بروبيل بارابين', 'بوتيل بارابين'
  ],
  retinol_retinoids: [
    'rétinol', 'palmitate de rétinyle', 'palmitato de retinilo', 'ретинол', 'ретинилпальмитат', 'ريتينول', 'ریٹینول'
  ],
  nitrites_e249_e250: [
    'нитрит натрия', 'нитрит калия', 'nitrito de sodio', 'nitrite de sodium', 'natriumnitrit',
    'natrium nitrit', 'نتريت الصوديوم', 'سوڈیم نائٹرائٹ', 'sodyum nitrit (e250)', 'koruyucu (sodyum nitrit)'
  ],
  sulfites_e220_e228: [
    'диоксид серы', 'сульфиты', 'метабисульфит натрия', 'dioxyde de soufre', 'anhydride sulfureux', 'sulfites',
    'dióxido de azufre', 'sulfitos', 'schwefeldioxid', 'sulfite', 'belerang dioksida', 'sulfit',
    'ثاني أكسيد الكبريت', 'كبريتيت', 'سلفائٹس'
  ],
  southampton_dyes: [
    'тартразин', 'понсо 4r', 'желтый солнечный закат', 'أصفر غروب الشمس', 'تارترازين',
    'tartrazina', 'amarillo ocaso', 'rojo allura', 'jaune orangé s', 'rouge allura', 'kuning fcf'
  ],
  comedogenic_esters_oils: [
    'cocos nucifera (coconut) oil', 'theobroma cacao (cocoa) seed butter', 'triticum vulgare (wheat) germ oil',
    'decyl oleate', 'desil oleat', 'cetyl esters', 'cetyl palmitate', 'setil palmitat', 'lanolin alcohol', 'eucerit',
    'кокосовое масло', 'масло какао', 'زيت جوز الهند', 'زبدة الكاكاو'
  ]
};

for (const [id, extra] of Object.entries(warningAliasExpansions)) {
  if (existingSubMap.has(id)) {
    const s = existingSubMap.get(id);
    s.aliases = Array.from(new Set([...s.aliases, ...extra]));
  }
}

// 3. Add all missing ingredients from the 26 Real-World Products Audit (Subagent 1 findings)
const part3Substances = [
  {
    id: 'cosmetic_specialty_solvents_boosters',
    name: 'Cosmetic Specialty Solvents & Penetration Enhancers (Dimethyl Isosorbide / Ethoxydiglycol / Methylpropanediol / Glycereth-26)',
    aliases: [
      'dimethyl isosorbide', 'dimetil izosorbid', 'ethoxydiglycol', 'etoksidiglikol', 'diethylene glycol monoethyl ether',
      'methylpropanediol', 'metilpropandiol', 'butoxydiglycol', 'methoxymethylbutanol', 'ethyl hexanediol',
      'glycereth-26', 'glycereth-7', 'methyl gluceth-20', 'peg-8', 'peg-12', 'peg-32', 'peg-75', 'peg-150 distearate',
      'ppg-15 stearyl ether', 'ppg-14 butyl ether', 'diisopropyl sebacate', 'diisopropyl adipate', 'dibutyl adipate',
      'dicaprylyl maleate', 'propylene glycol dicaprylate/dicaprate', 'c12-22 alkyl acrylate/hydroxyethylacrylate copolymer',
      'dodecene', 'triethoxycaprylylsilane', 'methicone', 'hydrogen dimethicone',
      'dimethicone/vinyltrimethylsiloxysilicate crosspolymer', 'nylon-611/dimethicone copolymer',
      'c30-45 alkyldimethylsilyl polypropylsilsesquioxane', 'polyhydroxystearic acid', 'stearoyl inulin',
      'lauroyl lysine', 'alumina', 'aluminum oxide', 'aluminum hydroxide', 'alüminyum hidroksit',
      'calcium aluminum borosilicate', 'calcium sodium borosilicate'
    ],
    domain: 'cosmetic',
    class: 'solvent',
    eu_detail: 'Modern serum, güneş kremi ve makyaj formüllerinde aktif taşıyıcı, emilim düzenleyici ve doku stabilize edici yardımcı bileşenler.'
  },
  {
    id: 'soap_bases_fatty_acids_isethionates',
    name: 'Soap Bases, Fatty Acids & Cleansing Salts (Sodium Lauroyl Isethionate / Sodium Palmitate / Lauric Acid / Glyceryl Oleate)',
    aliases: [
      'sodium lauroyl isethionate', 'sodium isethionate', 'sodium palmitate', 'sodyum palmitat',
      'sodium palm kernelate', 'sodyum palm kernelat', 'sodium cocoate', 'sodyum kokoat',
      'potassium stearate', 'potassium palmitate', 'potassium cocoate',
      'sodium lauroyl lactylate', 'sodyum lauroil laktilat', 'disodium stearoyl glutamate',
      'sodium xylenesulfonate', 'tea-dodecylbenzenesulfonate', 'myristyl glucoside',
      'lauric acid', 'laurik asit', 'myristic acid', 'miristik asit', 'palmitic acid', 'palmitik asit',
      'oleic acid', 'oleik asit', 'linoleic acid', 'linoleik asit', 'linolenic acid', 'arachidic acid', 'behenic acid',
      'glyceryl oleate', 'gliseril oleat', 'glyceryl caprylate', 'gliseril kaprilat', 'glyceryl dibehenate',
      'tribehenin', 'glyceryl behenate', 'sorbitan sesquioleate', 'sorbitan caprylate',
      'glycol distearate', 'glikol distearat', 'glycol stearate', 'isoceteth-20', 'trideceth-10', 'trideceth-6',
      'aluminum stearates', 'aluminum distearate', 'magnesium stearate', 'calcium stearate'
    ],
    domain: 'cosmetic',
    class: 'surfactant',
    eu_detail: 'Sabun, yüz yıkama jeli, şampuan ve kremlerde kullanılan yağ asitleri, izetiyonatlar ve emülgatör tuzları.'
  },
  {
    id: 'prebiotic_sugars_humectant_complexes',
    name: 'Prebiotic & Botanical Oligosaccharides (Fructooligosaccharides / Inulin / Rhamnose / Mannose / Tamarind Gum / Xylitylglucoside)',
    aliases: [
      'fructooligosaccharides', 'fruktooligosakkaritler', 'fos', 'inulin', 'inülin', 'alpha-glucan oligosaccharide',
      'rhamnose', 'ramnoz', 'mannose', 'mannoz', 'xylitylglucoside', 'anhydroxylitol', 'saccharide isomerate',
      'tamarindus indica seed gum', 'biosaccharide gum-1', 'maltodextrin'
    ],
    domain: 'cosmetic+food',
    class: 'humectant',
    eu_detail: 'Cilt mikrobiyomunu ve nem bariyerini destekleyen prebiyotik şeker kompleksleri ve bitkisel polisakkaritler.'
  },
  {
    id: 'shampoo_stabilizers_chelators_bromides',
    name: 'Preservative Stabilizers, Chelators & Antiseptic Quats (Magnesium Nitrate / Tetrasodium Etidronate / Cetrimonium & Myrtrimonium Bromide)',
    aliases: [
      'magnesium nitrate', 'magnezyum nitrat', 'tetrasodium etidronate', 'etidronic acid',
      'trisodium dicarboxymethyl alaninate', 'cetrimonium bromide', 'setrimonyum bromür',
      'myrtrimonium bromide', 'mirtrimonyum bromür'
    ],
    domain: 'cosmetic',
    class: 'preservative',
    eu_status: 'kisitli',
    eu_detail: 'AB Kozmetik Yönetmeliği Ek III/V kapsamında şampuan ve misel sularda kullanılan koruyucu yardımcı tuzlar ve şelatlayıcılar.'
  },
  {
    id: 'expanded_whole_foods_meats_spices_vitamins',
    name: 'Meats, Spices, Vegetables, Carbonates & Food Vitamins (E316 / E503 / B Vitamins)',
    aliases: [
      'dana eti', 'sığır eti', 'dana eti ve yağı', 'sığır eti ve yağı', 'tavuk eti', 'hindi eti', 'kuzu eti', 'kıyma',
      'beef', 'veal', 'chicken', 'turkey', 'lamb', 'mutton', 'meat', 'poultry',
      'hayvansal yağ', 'sığır yağı', 'kuyruk yağı', 'don yağı', 'tallow', 'beef tallow', 'animal fat',
      'balık', 'ton balığı', 'somon', 'hamsi', 'balık yağı', 'fish', 'fish oil', 'tuna', 'salmon',
      'sarımsak', 'kurutulmuş sarımsak', 'garlic', 'dried garlic', 'soğan', 'kurutulmuş soğan', 'onion', 'dried onion',
      'iyotlu tuz', 'iodized salt', 'baharat karışımı', 'spice mix', 'maydanoz', 'parsley', 'kimyon', 'cumin',
      'kekik', 'oregano', 'thyme', 'nane', 'mint', 'fesleğen', 'basil', 'zencefil', 'ginger', 'karanfil', 'clove',
      'muskat', 'nutmeg', 'kişniş', 'coriander', 'sumak', 'yenibahar', 'allspice', 'çörek otu', 'black cumin',
      'bitkisel yağlar', 'vegetable oils', 'tam hidrojenize palm yağı', 'tam hidrojenize palm', 'tam hidrojenize bitkisel yağ',
      'hydrogenated palm oil', 'fully hydrogenated palm oil', 'pamuk yağı', 'cottonseed oil', 'fındık yağı', 'hazelnut oil',
      'mısır yağı', 'corn oil', 'soy lecithins', 'soya lesitinleri',
      'sodyum hidrojen karbonat', 'sodium hydrogen carbonate', 'amonyum hidrojen karbonat', 'ammonium hydrogen carbonate',
      'sodyum karbonatlar', 'sodium carbonates', 'potasyum karbonatlar', 'potassium carbonates',
      'magnezyum karbonatlar', 'magnesium carbonates', 'sodyum asit pirofosfat', 'disodyum difosfat',
      'sodyum eritorbat', 'sodium erythorbate', 'e316', 'eritorbik asit', 'erythorbic acid', 'e315',
      'yağ asitlerinin poligliserol esterleri', 'poligliserol esterleri',
      'pantotenik asit', 'pantothenic acid', 'calcium pantothenate', 'vitamin b5', 'b5 vitamini',
      'b6 vitamini', 'vitamin b6', 'pyridoxine hydrochloride', 'piridoksin hidroklorür',
      'b12 vitamini', 'vitamin b12', 'cyanocobalamin', 'siyanokobalamin',
      'b1 vitamini', 'vitamin b1', 'thiamine', 'tiamin', 'folik asit', 'folic acid', 'vitamin b9',
      'biotin', 'd vitamini', 'vitamin d', 'vitamin d3', 'cholecalciferol', 'kolekalsiferol', 'demir pirofosfat',
      'karamel', 'caramel',
      'triethylene glycol', 'propylene carbonate', 'ppg-5-ceteth-20',
      'butane', 'isobutane', 'propane', 'bütan', 'izobütan', 'propan',
      'ayran tozu', 'disodyum 5-ribonükleotid', 'disodyum 5\'-ribonükleotidler',
      'dehydrated potatoes', 'kurutulmuş patates', 'buğday kepeği', 'wheat bran',
      'kurutulmuş soğan tozu', 'starter kültür', 'starter culture', 'laktik asit bakterileri',
      'meyve ve bitki konsantreleri', 'mürver ekstraktı', 'elderberry extract',
      'beyaz ve sarı balmumu', 'karnauba mum', 'karnaubaumu',
      'potasyum hidrojen karbonat', 'potassium hydrogen carbonate', 'magnezyum karbonat', 'magnesium carbonate',
      'hdi/trimethylol hexyllactone crosspolymer', 'hydrolyzed corn starch octenylsuccinate',
      'pentaerythrityl tetra-di-t-butyl hydroxyhydrocinnamate', 'sodium palmate', 'sodyum palmat',
      'hydroxypropyltrimonium hydrolyzed wheat protein', '2-oleamido-1,3-octadecanediol',
      'serine', 'serin', 'glutamic acid', 'glutamik asit', 'gelatin crosspolymer',
      'dana yağı', 'tavuk yağı', 'tavuk eti tozu', 'niasin', 'niacin'
    ],
    domain: 'cosmetic+food',
    class: 'food_base',
    eu_detail: 'Gıda ve kozmetik ürünlerindeki et, baharat, bitkisel yağ, kabartıcı karbonat, antioksidan, aerosol itici gaz, film oluşturucu ve vitamin bileşenleri.'
  }
];

for (const sub of part3Substances) {
  upsertSubstance(sub);
}
fs.writeFileSync(path.join(dataDir, 'substances.json'), JSON.stringify(substancesData, null, 2), 'utf8');

// 4. Add Halal Rules for Meats, Tallow/Sodium Tallowate, Sodium Lardate/Bacon, Dairy/Egg (Non-Vegan), and sync ALL SAFE_NON_ETHANOL 10-language aliases!
const part3HalalRules = [
  {
    id: 'pork_bacon_ham_lardate',
    canonical: 'Bacon, Ham & Sodium Lardate (Porcine Origin)',
    aliases: ['bacon', 'ham', 'jambon', 'domuz pastırması', 'sodium lardate', 'potassium lardate', 'vetчина', 'бекон', 'لحم خنزير مقدد'],
    codes: [],
    category: 'A_haram',
    vegan_compatible: false,
    vegetarian_compatible: false,
    vegan_claim_resolves: false,
    halal_claim_conflict: true,
    authority_rulings: {
      general_cautious: 'kirmizi',
      GIMDES: 'kirmizi',
      JAKIM: 'kirmizi',
      MUI: 'kirmizi',
      IFANCA: 'kirmizi'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Domuz eti (Jambon/Bacon) veya domuz yağından üretilen sabun bazı (Sodium Lardate) içerir; tüm helal standartlarına göre haramdır.'
  },
  {
    id: 'meat_poultry_tallow_slaughter_check',
    canonical: 'Meat, Poultry & Animal Fat / Tallow (Halal Slaughter Verification Required)',
    aliases: [
      'dana eti', 'sığır eti', 'dana eti ve yağı', 'sığır eti ve yağı', 'dana yağı', 'tavuk eti', 'tavuk yağı', 'tavuk eti tozu', 'hindi eti', 'kuzu eti', 'kıyma',
      'beef', 'veal', 'chicken', 'turkey', 'lamb', 'mutton', 'meat', 'poultry',
      'hayvansal yağ', 'sığır yağı', 'kuyruk yağı', 'don yağı', 'tallow', 'beef tallow', 'animal fat', 'adeps bovis',
      'sodium tallowate', 'potassium tallowate', 'hydrogenated tallow glycerides', 'sodyum tallowat', 'gelatin crosspolymer',
      'daging sapi', 'daging ayam', 'lemak hewani', 'говядина', 'курица', 'животный жир', 'لحم بقري', 'دجاج', 'دهن حيواني'
    ],
    codes: [],
    category: 'C_musbooh',
    vegan_compatible: false,
    vegetarian_compatible: false,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'sari',
      GIMDES: 'sari',
      JAKIM: 'sari',
      MUI: 'sari',
      IFANCA: 'sari'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Sığır/dana/kanatlı eti veya hayvansal don yağı (Tallow / Sodium Tallowate) içerir. İslami usullere göre (zebiha) kesilmiş hayvan kaynaklı olduğunun doğrulanması için Helal sertifikası aranmalıdır; Vegan/Vejetaryen değildir.'
  },
  {
    id: 'dairy_egg_halal_non_vegan',
    canonical: 'Milk, Dairy Derivatives & Egg (Halal Permissible, Non-Vegan)',
    aliases: [
      'milk', 'süt', 'whole milk powder', 'tam yağlı süt tozu', 'skimmed milk powder', 'yağsız süt tozu', 'milk powder', 'süt tozu',
      'magermilchpulver', 'lait écrémé en poudre', 'leche desnatada en polvo', 'susu bubuk', 'сухое молоко', 'حليب مجفف',
      'lactose', 'laktoz', 'süt şekeri', 'milk fat', 'butterfat', 'anhydrous milk fat', 'süt yağı', 'butter', 'tereyağı',
      'beurre', 'mantequilla', 'сливочное масло', 'زبدة', 'cream', 'krema', 'yogurt', 'yoğurt',
      'cheese powder', 'peynir tozu', 'peynir', 'casein', 'sodium caseinate', 'kazein',
      'egg', 'yumurta', 'egg yolk', 'yumurta sarısı', 'egg white', 'yumurta akı', 'pasteurized egg', 'albumin', 'egg albumen',
      'lysozyme', 'lizozim'
    ],
    codes: ['E1105', 'E966'],
    category: 'H_helal',
    vegan_compatible: false,
    vegetarian_compatible: true,
    vegan_claim_resolves: false,
    halal_claim_conflict: false,
    authority_rulings: {
      general_cautious: 'yesil',
      GIMDES: 'yesil',
      JAKIM: 'yesil',
      MUI: 'yesil',
      IFANCA: 'yesil'
    },
    source_id: 'OIC_SMIIC_1',
    verification: 'ikincil_kontrol',
    template_tr: 'Süt ürünleri (süt tozu, laktoz, tereyağı, kazein) ve yumurta İslami açıdan helaldir (peynir altı suyu/enzim hariç); ancak hayvansal kaynaklı olduğu için Vegan değildir.'
  }
];

for (const r of part3HalalRules) {
  upsertHalalRule(r);
}

// Add 'gelatin sapi' (Indonesian/Malay beef gelatin) & lanolin derivatives
if (existingHalalMap.has('gelatin_unspecified')) {
  const g = existingHalalMap.get('gelatin_unspecified');
  g.aliases = Array.from(new Set([...g.aliases, 'gelatin sapi', 'gelatin lembu', 'fish gelatin', 'balık jelatini']));
}
if (existingHalalMap.has('beeswax_honey_lanolin')) {
  const b = existingHalalMap.get('beeswax_honey_lanolin');
  b.aliases = Array.from(
    new Set([
      ...b.aliases,
      'lanolin alcohol', 'eucerit', 'acetylated lanolin', 'acetylated lanolin alcohol', 'hydrogenated lanolin',
      'peg-75 lanolin', 'mel', 'royal jelly', 'arı sütü', 'cera flava', 'cholesterol', 'kolesterol', 'холестерин', 'كوليسترول'
    ])
  );
}

// Sync ALL 10-language aliases of fatty alcohols, phenoxyethanol, panthenol, benzyl alcohol & polyols into safe_non_ethanol_alcohols
if (existingHalalMap.has('safe_non_ethanol_alcohols')) {
  const safeRule = existingHalalMap.get('safe_non_ethanol_alcohols');
  const idsToSync = ['cetyl_alcohol', 'cetearyl_alcohol', 'stearyl_alcohol', 'phenoxyethanol', 'panthenol', 'tocopherol', 'benzyl_alcohol', 'stevia_polyol_sweeteners'];
  const synced = new Set(safeRule.aliases.filter((a) => a !== 'cholesterol'));
  for (const sid of idsToSync) {
    if (existingSubMap.has(sid)) {
      for (const al of existingSubMap.get(sid).aliases) {
        synced.add(al);
      }
    }
  }
  // Add French/Spanish/German/Russian/Arabic/Urdu fatty alcohol & phenoxyethanol synonyms explicitly
  [
    'alcool cétylique', 'alcool cetylique', 'alcool cétéarylique', 'alcool cetearylique', 'alcool stéarylique',
    'alcool benzylique', 'cetylalkohol', 'cetearylalkohol', 'stearylalkohol', 'benzylalkohol',
    'سیٹیریل الکوحل', 'سیٹائل الکوحل', 'سٹیریل الکوحل', 'فینوکسی ایتھنول', 'بینزائل الکوحل'
  ].forEach((a) => synced.add(a));
  safeRule.aliases = Array.from(synced);
}

if (existingSubMap.has('cetearyl_alcohol')) {
  existingSubMap.get('cetearyl_alcohol').aliases.push('سیٹیریل الکوحل');
}
if (existingSubMap.has('cetyl_alcohol')) {
  existingSubMap.get('cetyl_alcohol').aliases.push('سیٹائل الکوحل');
}
if (existingSubMap.has('phenoxyethanol')) {
  existingSubMap.get('phenoxyethanol').aliases.push('فینوکسی ایتھنول');
}
fs.writeFileSync(path.join(dataDir, 'substances.json'), JSON.stringify(substancesData, null, 2), 'utf8');

fs.writeFileSync(path.join(dataDir, 'halal_rules.json'), JSON.stringify(halalData, null, 2), 'utf8');

// 5. Expand hidden_sugars.json with all 10-language sugar aliases & malt extract / grape juice concentrate
const sugarPart3Expansions = {
  invert_sugar: ['инвертный сироп', 'инвертный сахар', 'شراب السكر المحول', 'sirup gula invert'],
  corn_syrup: ['кукурузный сироп', 'شراب الذرة', 'jarabe de maíz', 'sirup jagung', 'sirop de maïs'],
  cane_sugar: ['тростниковый сахар', 'سكر القصب', 'azúcar de caña', 'gula tebu', 'گنے کی چینی'],
  beet_sugar: ['свекловичный сахар', 'سكر البنجر', 'azúcar de remolacha'],
  brown_sugar: ['коричневый сахар', 'سكر بني', 'azúcar moreno', 'gula merah', 'gula aren', 'براؤن شوگر'],
  powdered_sugar: ['сахарная пудра', 'سكر بودرة', 'azúcar glas', 'gula halus'],
  rice_syrup: ['рисовый сироп', 'شراب الأرز', 'jarabe de arroz', 'sirup beras', 'sirop de riz'],
  malt_syrup: [
    'barley malt extract', 'malt extract', 'arpa maltı ekstraktı', 'malt ekstraktı', 'ekstrak malt',
    'extrait de malt d\'orge', 'gerstenmalzextrakt', 'extracto de malta', 'солодовый экстракт', 'خلاصة الشعير'
  ],
  maple_syrup: ['кленовый сироп', 'شراب القيقب', 'jarabe de arce', 'sirup maple'],
  agave_syrup: ['сироп агавы', 'شراب الأغاف', 'jarabe de agave', 'sirup agave'],
  fruit_juice_concentrate: [
    'üzüm suyu konsantresi', 'grape juice concentrate', 'deiyonize elma suyu konsantresi',
    'meyve suyu konsantreleri', 'apple juice concentrate', 'концентрат фруктового сока',
    'مركز عصير الفاكهة', 'concentrado de jugo de frutas', 'konsentrat sari buah'
  ],
  maltose: ['мальтоза', 'مالتوز', 'maltosa', 'maltosa']
};

for (const item of sugarsData.free_sugars) {
  if (sugarPart3Expansions[item.id]) {
    item.aliases = Array.from(new Set([...item.aliases, ...sugarPart3Expansions[item.id]]));
  }
}
fs.writeFileSync(path.join(dataDir, 'hidden_sugars.json'), JSON.stringify(sugarsData, null, 2), 'utf8');

let totalSubAliases3 = 0;
for (const s of substancesData.substances) totalSubAliases3 += s.aliases.length + 1;
console.log(`✅ Part 3 Audit Remediation complete! Total substance classes: ${substancesData.substances.length}, Total aliases: ${totalSubAliases3}`);
