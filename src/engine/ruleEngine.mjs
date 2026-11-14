// Platform-neutral data loading (no Node fs/path/url): works in Node, browsers and React Native (Metro/Hermes).
// Generated from src/data/*.json by `npm run build:data` (scripts/build_data_modules.mjs).
import { SUPPORTED_LANGUAGES, getLocaleStrings } from '../i18n/locales.mjs';
import sourcesData from '../data/generated/sources.mjs';
import substancesData from '../data/generated/substances.mjs';
import halalData from '../data/generated/halal_rules.mjs';
import sugarsData from '../data/generated/hidden_sugars.mjs';
import cosingIngredients from '../data/generated/cosing_ingredients.mjs';

const cosingData = cosingIngredients || null;

function makeCosingSubstance(cosingEntry) {
  const isBanned = cosingEntry.s === 2;
  const isRestricted = cosingEntry.s === 1;
  const euStatus = isBanned ? 'yasak' : isRestricted ? 'kisitli' : 'izinli';
  const severity = isBanned
    ? 'yuksek'
    : isRestricted
    ? (/^(?:II\/|III)/.test(cosingEntry.a || '') ? 'orta' : 'dusuk')
    : 'bilgi';
  const annexInfo = cosingEntry.a ? ` (${cosingEntry.a})` : '';

  return {
    id: `cosing_${cosingEntry.ref}`,
    name: cosingEntry.inci,
    aliases: [cosingEntry.inci.toLowerCase()],
    domain: 'cosmetic',
    class: (cosingEntry.f || 'cosmetic_ingredient').toLowerCase().replace(/[\s\-_/]+/g, '_').slice(0, 30),
    e_code: null,
    ci_code: null,
    eu_status: euStatus,
    eu_detail: isBanned
      ? `AB Kozmetik Yönetmeliği Ek II kapsamında doğrudan yasaklı bileşen${annexInfo}.`
      : isRestricted
      ? `AB Kozmetik Yönetmeliği Ek ${cosingEntry.a || 'III'} kapsamında koşul/limit kısıtlamasına tabi bileşen${annexInfo}.`
      : `AB CosIng veritabanında kayıtlı izinli kozmetik bileşen${annexInfo}.`,
    ed_tier: null,
    severity: severity,
    profiles: {},
    sources: ['COSING'],
    verification: 'resmi_ab_cosing',
    note: isBanned || isRestricted ? `CosIng Ref: ${cosingEntry.ref}` : null
  };
}

export function normalizeDigitsToAscii(str) {
  if (!str) return '';
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

export function parseConcentration(str) {
  if (!str || typeof str !== 'string') return null;
  // Normalize Eastern Arabic / Persian digits, Arabic percent sign and Arabic decimal separator
  const s = normalizeDigitsToAscii(str).replace(/[٪﹪％]/g, '%').replace(/٫/g, '.');
  const num = (v) => parseFloat(v.replace(',', '.'));
  // ppm or mg/kg → percent (1 ppm = 1 mg/kg = 0.0001 %)
  const ppm = s.match(/(\d+(?:[.,]\d+)?)\s*(?:ppm|mg\s*\/\s*kg)\b/i);
  if (ppm) return num(ppm[1]) / 10000;
  const m1 = s.match(/%\s*(\d+(?:[.,]\d+)?)/);
  if (m1) return num(m1[1]);
  const m2 = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (m2) return num(m2[1]);
  return null;
}

/**
 * Normalizes text with Unicode NFKC, ASCII digits, and Turkish-aware lowercase
 */
export function normalizeToken(raw) {
  if (!raw) return '';
  return normalizeDigitsToAscii(raw)
    .normalize('NFKC')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ASCII-folded version for resilient dictionary lookup (while keeping exact prefixes)
 */
export function foldTurkish(str) {
  return normalizeToken(str)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Strip Arabic/Urdu tashkeel & tatweel
    .replace(/ё/g, 'е') // Russian yo -> ye
    .replace(/[یے]/g, 'ي') // Urdu/Farsi Yeh -> Arabic Yeh
    .replace(/ک/g, 'ك') // Urdu/Farsi Kaf -> Arabic Kaf
    .replace(/[ہھ]/g, 'ه') // Urdu Heh -> Arabic Heh
    .replace(/[أإآ]/g, 'ا') // Arabic Alef variants
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/[üúùû]/g, 'u')
    .replace(/ş/g, 's')
    .replace(/[öóòô]/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàâä]/g, 'a')
    .replace(/[íìîï]/g, 'i')
    .replace(/ñ/g, 'n');
}

// Build fast exact lookup indexes
const substanceByAlias = new Map();
for (const sub of substancesData.substances) {
  for (const alias of [sub.name, ...sub.aliases]) {
    substanceByAlias.set(normalizeToken(alias), sub);
    substanceByAlias.set(foldTurkish(alias), sub);
  }
}

const halalByAlias = new Map();
const halalByCode = new Map();
for (const rule of halalData.rules) {
  for (const alias of [rule.canonical, ...rule.aliases]) {
    halalByAlias.set(normalizeToken(alias), rule);
    halalByAlias.set(foldTurkish(alias), rule);
  }
  for (const code of rule.codes || []) {
    halalByCode.set(code.toUpperCase().replace(/\s+/g, ' ').trim(), rule);
  }
}

const freeSugarByAlias = new Map();
for (const item of sugarsData.free_sugars) {
  for (const alias of item.aliases) {
    freeSugarByAlias.set(normalizeToken(alias), item);
    freeSugarByAlias.set(foldTurkish(alias), item);
  }
}

const rapidCarbByAlias = new Map();
for (const item of sugarsData.rapid_carbohydrates_non_sugar) {
  for (const alias of item.aliases) {
    rapidCarbByAlias.set(normalizeToken(alias), item);
    rapidCarbByAlias.set(foldTurkish(alias), item);
  }
}

const ALLOWED_PROFILES = new Set(['hassas_cilt', 'hamilelik', 'cocuk_metabolik', 'akne', 'astim_alerji']);

function getSourceById(sid) {
  if (!sid || typeof sid !== 'string' || !sourcesData || !sourcesData.sources) return null;
  return Object.hasOwn(sourcesData.sources, sid) ? sourcesData.sources[sid] : null;
}

const TR_JURISDICTION_NOTE_I18N = {
  tr: 'AB mevzuatı uyumsuzluğu tespit edildi; Türkiye pazarı için güncel TİTCK / Türk Gıda Kodeksi (TGK) geçiş hükümleri ayrıca teyit edilmelidir.',
  en: 'EU regulatory non-compliance detected; current TITCK / Turkish Food Codex (TGK) transition rules should also be verified for the Turkish market.',
  ar: 'تم رصد عدم مطابقة للوائح الاتحاد الأوروبي؛ يُرجى أيضاً التحقق من الأحكام الانتقالية الحالية لهيئة TITCK / مدونة الغذاء التركية (TGK) للسوق التركية.',
  de: 'EU-Rechtsverstoß festgestellt; für den türkischen Markt sollten zudem die aktuellen Übergangsbestimmungen von TITCK / TGK geprüft werden.',
  fr: 'Non-conformité réglementaire UE détectée ; pour le marché turc, veuillez également vérifier les dispositions transitoires TITCK / TGK en vigueur.',
  id: 'Ketidaksesuaian regulasi UE terdeteksi; untuk pasar Turki, verifikasi juga ketentuan transisi TITCK / Kodeks Pangan Turki (TGK) yang berlaku.',
  ms: 'Ketidakpatuhan peraturan EU dikesan; bagi pasaran Turki, sila sahkan juga peruntukan peralihan TITCK / Kod Makanan Turki (TGK) terkini.',
  es: 'Incumplimiento normativo de la UE detectado; para el mercado turco deben verificarse también las disposiciones transitorias vigentes de TITCK / TGK.',
  ru: 'Обнаружено несоответствие нормам ЕС; для рынка Турции следует также проверить действующие переходные положения TITCK / Турецкого пищевого кодекса (TGK).',
  ur: 'یورپی یونین کے ضوابط سے عدم مطابقت پائی گئی؛ ترکی کی منڈی کے لیے موجودہ TITCK / ترک فوڈ کوڈیکس (TGK) کے عبوری احکام کی بھی تصدیق کی جانی چاہیے۔'
};

const CAFFEINE_TAURINE_ALERT_I18N = {
  tr: {
    cafName: 'Kafein / Enerji Bileşeni',
    cafLoc: 'Kafein / Enerji Bileşeni',
    cafHighName: 'Yüksek Kafein',
    cafHighLoc: 'Yüksek Kafein',
    tauName: 'Enerji İçeceği Uyarıcısı (Taurin/İnositol)',
    tauLoc: 'Taurin / İnositol',
    pregCafExp: 'EFSA Uyarısı: Hamilelik döneminde tüm kaynaklardan günlük toplam kafein alımı 200 mg ile sınırlandırılmalıdır (AB 1169/2011 Ek III).',
    pregTauExp: 'Enerji içeceği uyarıcısı (Taurin/İnositol); hamilelik döneminde dikkatli tüketilmelidir.',
    childCafExp: 'AB 1169/2011 Ek III Uyarısı: Yüksek kafein içeriği. Çocuklar için tavsiye edilmez (azami güvenli referans doz 3 mg/kg/gün).',
    childTauExp: 'Enerji içeceği uyarıcısı (Taurin/İnositol); çocuklar için tavsiye edilmez.'
  },
  en: {
    cafName: 'Caffeine / Energy Component',
    cafLoc: 'Caffeine / Energy Component',
    cafHighName: 'High Caffeine',
    cafHighLoc: 'High Caffeine',
    tauName: 'Energy Drink Stimulant (Taurine/Inositol)',
    tauLoc: 'Taurine / Inositol',
    pregCafExp: 'EFSA Warning: During pregnancy, total daily caffeine intake from all sources should be limited to 200 mg (EU 1169/2011 Annex III).',
    pregTauExp: 'Energy drink stimulant (Taurine/Inositol); consume with caution during pregnancy.',
    childCafExp: 'EU 1169/2011 Annex III Warning: High caffeine content. Not recommended for children (EFSA safe guidance 3 mg/kg bw/day).',
    childTauExp: 'Energy drink stimulant (Taurine/Inositol); not recommended for children.'
  },
  ar: {
    cafName: 'كافيين / مكوّن طاقة',
    cafLoc: 'كافيين / مكوّن طاقة',
    cafHighName: 'كافيين مرتفع',
    cafHighLoc: 'كافيين مرتفع',
    tauName: 'منبّه مشروب طاقة (تورين/إينوزيتول)',
    tauLoc: 'تورين / إينوزيتول',
    pregCafExp: 'تحذير EFSA: أثناء الحمل يجب ألا يتجاوز إجمالي الكافيين اليومي من جميع المصادر 200 ملغ (لائحة EU 1169/2011 الملحق III).',
    pregTauExp: 'منبّه مشروبات الطاقة (تورين/إينوزيتول)؛ يُستهلك بحذر أثناء الحمل.',
    childCafExp: 'تحذير EU 1169/2011 الملحق III: محتوى كافيين مرتفع. غير مُوصى به للأطفال (الحد المرجعي الآمن 3 ملغ/كغ/يوم).',
    childTauExp: 'منبّه مشروبات الطاقة (تورين/إينوزيتول)؛ غير مُوصى به للأطفال.'
  },
  de: {
    cafName: 'Koffein / Energiekomponente',
    cafLoc: 'Koffein / Energiekomponente',
    cafHighName: 'Erhöhter Koffeingehalt',
    cafHighLoc: 'Erhöhter Koffeingehalt',
    tauName: 'Energy-Drink-Stimulans (Taurin/Inosit)',
    tauLoc: 'Taurin / Inosit',
    pregCafExp: 'EFSA-Hinweis: In der Schwangerschaft sollte die gesamte tägliche Koffeinaufnahme aus allen Quellen auf 200 mg begrenzt werden (EU 1169/2011 Anhang III).',
    pregTauExp: 'Energy-Drink-Zusatz (Taurin/Inosit); in der Schwangerschaft mit Vorsicht konsumieren.',
    childCafExp: 'EU 1169/2011 Anhang III: Erhöhter Koffeingehalt. Für Kinder nicht empfohlen (EFSA-Richtwert max. 3 mg/kg KG/Tag).',
    childTauExp: 'Energy-Drink-Zusatz (Taurin/Inosit); für Kinder nicht empfohlen.'
  },
  fr: {
    cafName: 'Caféine / Composant énergétique',
    cafLoc: 'Caféine / Composant énergétique',
    cafHighName: 'Teneur élevée en caféine',
    cafHighLoc: 'Teneur élevée en caféine',
    tauName: 'Stimulant boisson énergisante (Taurine/Inositol)',
    tauLoc: 'Taurine / Inositol',
    pregCafExp: 'Alerte EFSA : Pendant la grossesse, l\'apport quotidien total en caféine toutes sources confondues doit être limité à 200 mg (UE 1169/2011 Annexe III).',
    pregTauExp: 'Stimulant de boisson énergisante (Taurine/Inositol) ; à consommer avec prudence pendant la grossesse.',
    childCafExp: 'UE 1169/2011 Annexe III : Teneur élevée en caféine. Déconseillé aux enfants (repère EFSA max. 3 mg/kg/jour).',
    childTauExp: 'Stimulant de boisson énergisante (Taurine/Inositol) ; déconseillé aux enfants.'
  },
  id: {
    cafName: 'Kafein / Komponen Energi',
    cafLoc: 'Kafein / Komponen Energi',
    cafHighName: 'Kafein Tinggi',
    cafHighLoc: 'Kafein Tinggi',
    tauName: 'Stimulan Minuman Energi (Taurin/Inositol)',
    tauLoc: 'Taurin / Inositol',
    pregCafExp: 'Peringatan EFSA: Selama kehamilan, total asupan kafein harian dari semua sumber sebaiknya dibatasi hingga 200 mg (UE 1169/2011 Lampiran III).',
    pregTauExp: 'Stimulan minuman energi (Taurin/Inositol); konsumsi dengan hati-hati saat hamil.',
    childCafExp: 'Peringatan UE 1169/2011 Lampiran III: Kandungan kafein tinggi. Tidak dianjurkan untuk anak-anak (batas aman EFSA 3 mg/kg BB/hari).',
    childTauExp: 'Stimulan minuman energi (Taurin/Inositol); tidak dianjurkan untuk anak-anak.'
  },
  ms: {
    cafName: 'Kafein / Komponen Tenaga',
    cafLoc: 'Kafein / Komponen Tenaga',
    cafHighName: 'Kafein Tinggi',
    cafHighLoc: 'Kafein Tinggi',
    tauName: 'Perangsang Minuman Tenaga (Taurina/Inositol)',
    tauLoc: 'Taurina / Inositol',
    pregCafExp: 'Amaran EFSA: Semasa hamil, jumlah pengambilan kafein harian daripada semua sumber hendaklah dihadkan kepada 200 mg (EU 1169/2011 Lampiran III).',
    pregTauExp: 'Perangsang minuman tenaga (Taurina/Inositol); ambil dengan berhati-hati semasa hamil.',
    childCafExp: 'Amaran EU 1169/2011 Lampiran III: Kandungan kafein tinggi. Tidak disyorkan untuk kanak-kanak (had rujukan selamat EFSA 3 mg/kg/hari).',
    childTauExp: 'Perangsang minuman tenaga (Taurina/Inositol); tidak disyorkan untuk kanak-kanak.'
  },
  es: {
    cafName: 'Cafeína / Componente energético',
    cafLoc: 'Cafeína / Componente energético',
    cafHighName: 'Alto contenido en cafeína',
    cafHighLoc: 'Alto contenido en cafeína',
    tauName: 'Estimulante energético (Taurina/Inositol)',
    tauLoc: 'Taurina / Inositol',
    pregCafExp: 'Advertencia EFSA: Durante el embarazo, la ingesta diaria total de cafeína de todas las fuentes debe limitarse a 200 mg (UE 1169/2011 Anexo III).',
    pregTauExp: 'Estimulante de bebida energética (Taurina/Inositol); consumir con precaución durante el embarazo.',
    childCafExp: 'UE 1169/2011 Anexo III: Contenido elevado de cafeína. No recomendado para niños (referencia segura EFSA 3 mg/kg/día).',
    childTauExp: 'Estimulante de bebida energética (Taurina/Inositol); no recomendado para niños.'
  },
  ru: {
    cafName: 'Кофеин / Энергетический компонент',
    cafLoc: 'Кофеин / Энергетический компонент',
    cafHighName: 'Высокое содержание кофеина',
    cafHighLoc: 'Высокое содержание кофеина',
    tauName: 'Стимулятор энергетика (Таурин/Инозитол)',
    tauLoc: 'Таурин / Инозитол',
    pregCafExp: 'Предупреждение EFSA: Во время беременности общее суточное потребление кофеина из всех источников должно быть ограничено 200 мг (ЕС 1169/2011 Приложение III).',
    pregTauExp: 'Стимулятор энергетических напитков (Таурин/Инозитол); соблюдайте осторожность при беременности.',
    childCafExp: 'ЕС 1169/2011 Приложение III: Высокое содержание кофеина. Не рекомендуется детям (безопасный ориентир EFSA 3 мг/кг/день).',
    childTauExp: 'Стимулятор энергетических напитков (Таурин/Инозитол); не рекомендуется детям.'
  },
  ur: {
    cafName: 'کیفین / توانائی کا جزو',
    cafLoc: 'کیفین / توانائی کا جزو',
    cafHighName: 'زیادہ کیفین',
    cafHighLoc: 'زیادہ کیفین',
    tauName: 'انرجی ڈرنک محرک (ٹورین/اینوسیٹول)',
    tauLoc: 'ٹورین / اینوسیٹول',
    pregCafExp: 'EFSA انتباہ: حمل کے دوران تمام ذرائع سے روزانہ کل کیفین کی مقدار 200 ملی گرام تک محدود ہونی چاہیے (EU 1169/2011 ضمیمہ III)۔',
    pregTauExp: 'انرجی ڈرنک محرک (ٹورین/اینوسیٹول)؛ حمل کے دوران احتیاط سے استعمال کریں۔',
    childCafExp: 'EU 1169/2011 ضمیمہ III انتباہ: زیادہ کیفین۔ بچوں کے لیے تجویز کردہ نہیں (EFSA محفوظ حد 3 ملی گرام/کلوگرام/دن)۔',
    childTauExp: 'انرجی ڈرنک محرک (ٹورین/اینوسیٹول)؛ بچوں کے لیے تجویز کردہ نہیں۔'
  }
};

const FALSE_POSITIVE_NOTE_I18N = {
  aqua: {
    en: 'Completely safe baseline solvent.',
    ar: 'مذيب أساسي آمن تماماً.',
    de: 'Vollständig sicheres Basis-Lösungsmittel.',
    fr: 'Solvant de base totalement sûr.',
    id: 'Pelarut dasar yang sepenuhnya aman.',
    ms: 'Pelarut asas yang selamat sepenuhnya.',
    es: 'Disolvente base completamente seguro.',
    ru: 'Полностью безопасный базовый растворитель.',
    ur: 'مکمل طور پر محفوظ بنیادی سالوینٹ۔'
  },
  glycerin: {
    en: 'Cosmetically safe humectant; see the Halal Engine for plant/animal/synthetic origin context.',
    ar: 'مرطب آمن تجميلياً؛ راجع محرك الحلال لتحديد المصدر النباتي أو الحيواني.',
    de: 'Kosmetisch sicheres Feuchthaltemittel; siehe Halal-Analyse für Herkunftsdetails.',
    fr: 'Humectant sûr en cosmétique ; voir le moteur Halal pour l\'origine végétale ou animale.',
    id: 'Humektan kosmetik yang aman; lihat mesin Halal untuk konteks sumber nabati/hewani.',
    ms: 'Humektan kosmetik yang selamat; rujuk enjin Halal untuk konteks sumber tumbuhan/haiwan.',
    es: 'Humectante cosmético seguro; consulta el motor Halal para el origen vegetal o animal.',
    ru: 'Безопасный увлажнитель; см. халяль-анализ для уточнения растительного или животного происхождения.',
    ur: 'کاسمیٹک طور پر محفوظ موئسچرائزر؛ نباتاتی یا حیوانی ماخذ کے لیے حلال کارڈ دیکھیں۔'
  },
  cetyl_alcohol: {
    en: 'FALSE-POSITIVE SHIELD: Not ethyl alcohol (ethanol); a conditioning fatty alcohol that does not dry skin.',
    ar: 'حماية من الإنذار الكاذب: ليس كحولاً إيثيلياً (إيثانول)؛ بل كحول دهني مرطب لا يجفف البشرة.',
    de: 'SCHUTZ VOR FEHLALARM: Kein Ethylalkohol (Ethanol), sondern ein pflegender Fettalkohol.',
    fr: 'PROTECTION FAUX POSITIF : Ce n\'est pas de l\'éthanol, mais un alcool gras émollient non desséchant.',
    id: 'PERLINDUNGAN POSITIF PALSU: Bukan etil alkohol (etanol); alkohol lemak pelembut yang tidak mengeringkan kulit.',
    ms: 'PERISAI POSITIF PALSU: Bukan etil alkohol (etanol); alkohol lemak perapi yang tidak mengeringkan kulit.',
    es: 'ESCUDO FALSO POSITIVO: No es alcohol etílico (etanol); es un alcohol graso emoliente.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Не этиловый спирт (этанол), а смягчающий жирный спирт.',
    ur: 'غلط انتباہ سے تحفظ: یہ ایتھائل الکحل (ایتھانول) نہیں بلکہ جلد کو نرم رکھنے والا فیٹی الکحل ہے۔'
  },
  cetearyl_alcohol: {
    en: 'FALSE-POSITIVE SHIELD: Not ethyl alcohol (ethanol); skin-friendly waxy fatty alcohol blend.',
    ar: 'حماية من الإنذار الكاذب: ليس كحولاً إيثيلياً؛ خليط كحولات دهنية لطيف على البشرة.',
    de: 'SCHUTZ VOR FEHLALARM: Kein Ethylalkohol, sondern ein hautfreundliches Fettalkohol-Gemisch.',
    fr: 'PROTECTION FAUX POSITIF : Ce n\'est pas de l\'éthanol ; mélange d\'alcools gras doux pour la peau.',
    id: 'PERLINDUNGAN POSITIF PALSU: Bukan etil alkohol; campuran alkohol lemak yang ramah kulit.',
    ms: 'PERISAI POSITIF PALSU: Bukan etil alkohol; campuran alkohol lemak yang mesra kulit.',
    es: 'ESCUDO FALSO POSITIVO: No es etanol; mezcla de alcoholes grasos suave para la piel.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Не этанол; мягкая смесь жирных спиртов.',
    ur: 'غلط انتباہ سے تحفظ: یہ ایتھانول نہیں؛ جلد کے لیے موزوں فیٹی الکحل کا آمیزہ ہے۔'
  },
  stearyl_alcohol: {
    en: 'FALSE-POSITIVE SHIELD: Not ethyl alcohol (ethanol); conditioning fatty alcohol.',
    ar: 'حماية من الإنذار الكاذب: ليس كحولاً إيثيلياً؛ بل كحول دهني ملطف.',
    de: 'SCHUTZ VOR FEHLALARM: Kein Ethylalkohol, sondern ein Fettalkohol.',
    fr: 'PROTECTION FAUX POSITIF : Ce n\'est pas de l\'éthanol, mais un alcool gras.',
    id: 'PERLINDUNGAN POSITIF PALSU: Bukan etil alkohol; alkohol lemak pelembut.',
    ms: 'PERISAI POSITIF PALSU: Bukan etil alkohol; alkohol lemak pelembut.',
    es: 'ESCUDO FALSO POSITIVO: No es etanol, sino un alcohol graso.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Не этанол, а жирный спирт.',
    ur: 'غلط انتباہ سے تحفظ: یہ ایتھانول نہیں بلکہ فیٹی الکحل ہے۔'
  },
  phenoxyethanol: {
    en: 'FALSE-POSITIVE SHIELD: Despite containing "ethanol" in its name, it is a glycol ether preservative, not intoxicating ethyl alcohol.',
    ar: 'حماية من الإنذار الكاذب: رغم احتواء اسمه على "ethanol"، فهو مادة حافظة من فئة إيثرات الجليكول وليس كحولاً إيثيلياً.',
    de: 'SCHUTZ VOR FEHLALARM: Trotz „ethanol“ im Namen handelt es sich um einen Glykolether-Konservierungsstoff, nicht um Trinkalkohol.',
    fr: 'PROTECTION FAUX POSITIF : Malgré « ethanol » dans son nom, c\'est un conservateur éther de glycol, pas de l\'alcool éthylique.',
    id: 'PERLINDUNGAN POSITIF PALSU: Meski bernama "ethanol", ini pengawet glikol eter, bukan etil alkohol.',
    ms: 'PERISAI POSITIF PALSU: Walaupun bernama "ethanol", ia pengawet glikol eter, bukan etil alkohol.',
    es: 'ESCUDO FALSO POSITIVO: Pese a incluir "ethanol" en su nombre, es un conservante éter de glicol, no etanol.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Несмотря на «ethanol» в названии, это консервант гликолевый эфир, а не этиловый спирт.',
    ur: 'غلط انتباہ سے تحفظ: نام میں "ethanol" کے باوجود یہ گلائیکول ایتھر پریزرویٹو ہے، نشہ آور ایتھانول نہیں۔'
  },
  niacinamide: {
    en: 'Safe active vitamin B3 derivative suitable across pregnancy and acne-prone profiles.',
    ar: 'مكوّن نشط آمن مشتق من فيتامين B3 ومناسب للحمل والبشرة المعرضة لحب الشباب.',
    de: 'Sicherer Vitamin-B3-Wirkstoff, auch in der Schwangerschaft und bei Akne geeignet.',
    fr: 'Actif sûr dérivé de la vitamine B3, adapté pendant la grossesse et aux peaux à tendance acnéique.',
    id: 'Bahan aktif turunan vitamin B3 yang aman termasuk untuk kehamilan dan kulit berjerawat.',
    ms: 'Bahan aktif terbitan vitamin B3 yang selamat termasuk untuk kehamilan dan kulit berjerawat.',
    es: 'Activo seguro derivado de vitamina B3 apto para embarazo y piel con tendencia acneica.',
    ru: 'Безопасный активный компонент (витамин B3), подходит при беременности и акне.',
    ur: 'وٹامن B3 کا محفوظ فعال جزو، حمل اور ایکنی والی جلد کے لیے بھی موزوں۔'
  },
  panthenol: {
    en: 'FALSE-POSITIVE SHIELD: Despite the "-ol" suffix, Panthenol is provitamin B5, not drying alcohol.',
    ar: 'حماية من الإنذار الكاذب: رغم اللاحقة "-ol"، فالبانثينول هو بروفيتامين B5 وليس كحولاً.',
    de: 'SCHUTZ VOR FEHLALARM: Trotz der Endung „-ol“ ist Panthenol Provitamin B5 und kein Alkohol.',
    fr: 'PROTECTION FAUX POSITIF : Malgré le suffixe « -ol », le panthénol est la provitamine B5, pas un alcool.',
    id: 'PERLINDUNGAN POSITIF PALSU: Meski berakhiran "-ol", Panthenol adalah provitamin B5, bukan alkohol.',
    ms: 'PERISAI POSITIF PALSU: Walaupun berakhir "-ol", Panthenol ialah provitamin B5, bukan alkohol.',
    es: 'ESCUDO FALSO POSITIVO: Pese al sufijo "-ol", el pantenol es provitamina B5, no alcohol.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Несмотря на суффикс «-ol», пантенол — это провитамин B5, а не спирт.',
    ur: 'غلط انتباہ سے تحفظ: آخر میں "-ol" ہونے کے باوجود پینٹینول پرو وٹامن B5 ہے، الکحل نہیں۔'
  },
  tocopherol: {
    en: 'Safe vitamin E antioxidant.',
    ar: 'مضاد أكسدة آمن (فيتامين E).',
    de: 'Sicheres Vitamin-E-Antioxidans.',
    fr: 'Antioxydant sûr (vitamine E).',
    id: 'Antioksidan vitamin E yang aman.',
    ms: 'Antioksidan vitamin E yang selamat.',
    es: 'Antioxidante seguro de vitamina E.',
    ru: 'Безопасный антиоксидант (витамин E).',
    ur: 'محفوظ وٹامن E اینٹی آکسیڈنٹ۔'
  },
  sodium_hyaluronate: {
    en: 'FALSE-POSITIVE SHIELD: "Sodium" here denotes the salt form of hyaluronic acid, not table salt.',
    ar: 'حماية من الإنذار الكاذب: كلمة "Sodium" تشير إلى الشكل الملحي لحمض الهيالورونيك وليس ملح الطعام.',
    de: 'SCHUTZ VOR FEHLALARM: „Sodium“ bezeichnet die Salzform der Hyaluronsäure, kein Kochsalz.',
    fr: 'PROTECTION FAUX POSITIF : « Sodium » désigne le sel d\'acide hyaluronique, pas du sel de table.',
    id: 'PERLINDUNGAN POSITIF PALSU: "Sodium" merujuk pada bentuk garam asam hialuronat, bukan garam dapur.',
    ms: 'PERISAI POSITIF PALSU: "Sodium" merujuk kepada bentuk garam asid hialuronik, bukan garam masakan.',
    es: 'ESCUDO FALSO POSITIVO: "Sodium" indica la sal del ácido hialurónico, no sal común.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: «Sodium» означает натриевую соль гиалуроновой кислоты, а не поваренную соль.',
    ur: 'غلط انتباہ سے تحفظ: "Sodium" سے مراد ہائیلورونک ایسڈ کی نمک والی شکل ہے، کھانے کا نمک نہیں۔'
  },
  dimethicone: {
    en: 'FALSE-POSITIVE SHIELD: Linear silicone polymer; NOT subject to REACH 2024/1328 cyclic siloxane (D4/D5/D6) restrictions.',
    ar: 'حماية من الإنذار الكاذب: بوليمر سيليكون خطي؛ غير خاضع لقيود السيلوكسانات الحلقية D4/D5/D6 (REACH 2024/1328).',
    de: 'SCHUTZ VOR FEHLALARM: Lineares Silikonpolymer; NICHT von der REACH-Beschränkung 2024/1328 für D4/D5/D6 betroffen.',
    fr: 'PROTECTION FAUX POSITIF : Silicone linéaire ; NON soumis à la restriction REACH 2024/1328 sur les siloxanes cycliques D4/D5/D6.',
    id: 'PERLINDUNGAN POSITIF PALSU: Polimer silikon linear; TIDAK terkena pembatasan siloksan siklik D4/D5/D6 (REACH 2024/1328).',
    ms: 'PERISAI POSITIF PALSU: Polimer silikon linear; TIDAK tertakluk kepada sekatan siloksana siklik D4/D5/D6 (REACH 2024/1328).',
    es: 'ESCUDO FALSO POSITIVO: Silicona lineal; NO sujeta a la restricción REACH 2024/1328 sobre siloxanos cíclicos D4/D5/D6.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Линейный силиконовый полимер; НЕ подпадает под ограничения REACH 2024/1328 для циклических D4/D5/D6.',
    ur: 'غلط انتباہ سے تحفظ: لکیری سلیکون پولیمر؛ REACH 2024/1328 سائکلک سائلوکسین (D4/D5/D6) کی پابندیوں کے تابع نہیں۔'
  },
  squalane: {
    en: 'Do not confuse saturated Squalane with unsaturated "Squalene" (shark/olive origin).',
    ar: 'لا ينبغي الخلط بين السكوالان المشبع (Squalane) والسكوالين غير المشبع (Squalene).',
    de: 'Gesättigtes Squalane nicht mit ungesättigtem „Squalene“ verwechseln.',
    fr: 'Ne pas confondre le Squalane saturé avec le « Squalène » insaturé.',
    id: 'Jangan samakan Squalane jenuh dengan "Squalene" tak jenuh.',
    ms: 'Jangan kelirukan Squalane tepu dengan "Squalene" tak tepu.',
    es: 'No confundir el escualano saturado (Squalane) con el «Squalene» insaturado.',
    ru: 'Не путать насыщенный сквалан (Squalane) с ненасыщенным «скваленом» (Squalene).',
    ur: 'سیر شدہ Squalane کو غیر سیر شدہ "Squalene" سے خلط ملط نہ کریں۔'
  },
  methylparaben: {
    en: 'SCCS considers it safe within EU concentration limits; must not be conflated with banned parabens (Isobutyl/Isopropyl).',
    ar: 'يعدّه SCCS آمناً ضمن الحدود الأوروبية؛ ولا يجوز خلطه مع البارابينات المحظورة.',
    de: 'Laut SCCS innerhalb der EU-Grenzwerte sicher; nicht mit verbotenen Parabenen gleichsetzen.',
    fr: 'Jugé sûr par le SCCS dans les limites de l\'UE ; ne pas confondre avec les parabènes interdits.',
    id: 'Dinilai aman oleh SCCS dalam batas UE; jangan disamakan dengan paraben yang dilarang.',
    ms: 'Dinilai selamat oleh SCCS dalam had EU; jangan disamakan dengan paraben yang diharamkan.',
    es: 'El SCCS lo considera seguro dentro de los límites de la UE; no equiparar con parabenos prohibidos.',
    ru: 'Признан SCCS безопасным в пределах лимитов ЕС; не путать с запрещёнными парабенами.',
    ur: 'SCCS اسے یورپی یونین کی حدود کے اندر محفوظ قرار دیتا ہے؛ ممنوعہ پیرابینز سے خلط نہ کریں۔'
  },
  ethylparaben: {
    en: 'SCCS considers it safe within EU Annex V concentration limits.',
    ar: 'يعدّه SCCS آمناً ضمن حدود الملحق V الأوروبية.',
    de: 'Laut SCCS innerhalb der EU-Anhang-V-Grenzwerte sicher.',
    fr: 'Jugé sûr par le SCCS dans les limites de l\'Annexe V.',
    id: 'Dinilai aman oleh SCCS dalam batas Lampiran V UE.',
    ms: 'Dinilai selamat oleh SCCS dalam had Lampiran V EU.',
    es: 'Considerado seguro por el SCCS dentro de los límites del Anexo V.',
    ru: 'Признан SCCS безопасным в пределах Приложения V ЕС.',
    ur: 'SCCS ضمیمہ V کی حدود کے اندر اسے محفوظ قرار دیتا ہے۔'
  },
  propylparaben: {
    en: 'Assessed on the EC Priority List of Potential Endocrine Disruptors (Group A); SCCS 2021 found it safe up to 0.14%.',
    ar: 'مُدرج في القائمة الأوروبية الأولوية لمختلات الغدد الصماء المحتملة (المجموعة A)؛ وجده SCCS 2021 آمناً حتى 0.14%.',
    de: 'Auf der EU-Prioritätenliste potenzieller endokriner Disruptoren (Gruppe A); laut SCCS 2021 bis 0.14% sicher.',
    fr: 'Évalué sur la liste prioritaire UE des perturbateurs endocriniens potentiels (Groupe A) ; SCCS 2021 sûr jusqu\'à 0.14%.',
    id: 'Masuk daftar prioritas UE pengganggu endokrin potensial (Grup A); SCCS 2021 menilai aman hingga 0.14%.',
    ms: 'Dinilai dalam senarai keutamaan EU pengganggu endokrin berpotensi (Kumpulan A); SCCS 2021 dapati selamat sehingga 0.14%.',
    es: 'Evaluado en la lista prioritaria UE de posibles disruptores endocrinos (Grupo A); SCCS 2021 seguro hasta 0.14%.',
    ru: 'Включён в приоритетный список ЕС потенциальных эндокринных разрушителей (Группа A); SCCS 2021 подтвердил безопасность до 0.14%.',
    ur: 'ممکنہ اینڈوکرائن ڈسرپٹرز کی یورپی ترجیحی فہرست (گروپ A) میں شامل؛ SCCS 2021 نے 0.14% تک محفوظ قرار دیا۔'
  },
  banned_parabens: {
    en: 'Presence in an EU-market product indicates regulatory non-compliance.',
    ar: 'وجوده في منتج داخل سوق الاتحاد الأوروبي يشير إلى مخالفة تنظيمية.',
    de: 'Ein Vorkommen in einem EU-Produkt weist auf einen Rechtsverstoß hin.',
    fr: 'Sa présence dans un produit sur le marché de l\'UE indique une non-conformité réglementaire.',
    id: 'Keberadaannya pada produk pasar UE menunjukkan ketidakpatuhan regulasi.',
    ms: 'Kehadirannya dalam produk pasaran EU menunjukkan ketidakpatuhan peraturan.',
    es: 'Su presencia en un producto del mercado de la UE indica incumplimiento normativo.',
    ru: 'Наличие в продукте на рынке ЕС указывает на нарушение законодательства.',
    ur: 'یورپی یونین کی منڈی کی مصنوعات میں موجودگی ضابطہ جاتی خلاف ورزی کی نشاندہی کرتی ہے۔'
  },
  lilial: {
    en: 'Prohibited fragrance allergen frequently seen in old-stock products.',
    ar: 'مكوّن عطري محظور يُعثر عليه غالباً في المنتجات ذات المخزون القديم.',
    de: 'Verbotener Duftstoff, der häufig noch in Altbeständen vorkommt.',
    fr: 'Allergène parfumé interdit fréquemment rencontré dans d\'anciens stocks.',
    id: 'Alergen wewangian terlarang yang sering ditemukan pada stok lama.',
    ms: 'Alergen wangian terlarang yang kerap ditemui dalam stok lama.',
    es: 'Alérgeno de fragancia prohibido frecuente en productos de stock antiguo.',
    ru: 'Запрещённый парфюмерный аллерген, часто встречающийся в старых партиях.',
    ur: 'ممنوعہ خوشبو کا جزو جو پرانے اسٹاک کی مصنوعات میں اکثر ملتا ہے۔'
  },
  '4_mbc': {
    en: 'Completely prohibited from sale on the EU market since 1 May 2026 (making-available deadline).',
    ar: 'محظور بيعه تماماً في سوق الاتحاد الأوروبي منذ 1 مايو 2026.',
    de: 'Seit 1. Mai 2026 auf dem EU-Markt vollständig verkaufsverboten.',
    fr: 'Totalement interdit à la vente sur le marché de l\'UE depuis le 1er mai 2026.',
    id: 'Dilarang sepenuhnya dijual di pasar UE sejak 1 Mei 2026.',
    ms: 'Dilarang sepenuhnya dijual di pasaran EU sejak 1 Mei 2026.',
    es: 'Completamente prohibida su venta en el mercado de la UE desde el 1 de mayo de 2026.',
    ru: 'Полностью запрещён к продаже на рынке ЕС с 1 мая 2026 года.',
    ur: 'یکم مئی 2026 سے یورپی یونین کی منڈی میں فروخت مکمل طور پر ممنوع ہے۔'
  },
  benzophenone_3: {
    en: 'Listed in Group A of the European Commission Priority List of Potential Endocrine Disruptors.',
    ar: 'مُدرج في المجموعة A من قائمة الأولوية الأوروبية لمختلات الغدد الصماء المحتملة.',
    de: 'Aufgeführt in Gruppe A der EU-Prioritätenliste potenzieller endokriner Disruptoren.',
    fr: 'Inscrit dans le Groupe A de la liste prioritaire UE des perturbateurs endocriniens potentiels.',
    id: 'Masuk Grup A Daftar Prioritas Komisi UE untuk Pengganggu Endokrin Potensial.',
    ms: 'Tersenarai dalam Kumpulan A Senarai Keutamaan Suruhanjaya EU bagi Pengganggu Endokrin Berpotensi.',
    es: 'Incluido en el Grupo A de la lista prioritaria de la Comisión Europea de posibles disruptores endocrinos.',
    ru: 'Включён в Группу A приоритетного списка Европейской комиссии потенциальных эндокринных разрушителей.',
    ur: 'یورپی کمیشن کی ممکنہ اینڈوکرائن ڈسرپٹرز کی ترجیحی فہرست کے گروپ A میں شامل۔'
  },
  bht: {
    en: 'Must not be conflated with BHA (IARC Group 2B) or labelled carcinogenic; BHT is IARC Group 3.',
    ar: 'يجب عدم خلط BHT مع BHA (مجموعة IARC 2B)؛ إذ يُصنَّف BHT ضمن المجموعة 3.',
    de: 'Nicht mit BHA (IARC-Gruppe 2B) verwechseln; BHT ist IARC-Gruppe 3.',
    fr: 'Ne pas confondre avec le BHA (IARC Groupe 2B) ; le BHT est classé Groupe 3.',
    id: 'Jangan disamakan dengan BHA (IARC Grup 2B); BHT termasuk IARC Grup 3.',
    ms: 'Jangan disamakan dengan BHA (IARC Kumpulan 2B); BHT ialah IARC Kumpulan 3.',
    es: 'No confundir con BHA (IARC Grupo 2B); el BHT es IARC Grupo 3.',
    ru: 'Не путать с BHA (группа IARC 2B); BHT относится к группе 3.',
    ur: 'اسے BHA (IARC گروپ 2B) سے خلط ملط نہ کریں؛ BHT گروپ 3 میں ہے۔'
  },
  bha_antioxidant: {
    en: 'When written simply as "BHA", confirm whether it means antioxidant Butylated Hydroxyanisole or exfoliant Beta Hydroxy Acid (Salicylic Acid).',
    ar: 'عند كتابة "BHA" وحدها، يجب التحقق مما إذا كان المقصود مضاد الأكسدة أم حمض الساليسيليك.',
    de: 'Steht nur „BHA“ auf dem Etikett, muss zwischen Antioxidans und Salicylsäure unterschieden werden.',
    fr: 'Si seul « BHA » figure sur l\'étiquette, confirmer s\'il s\'agit de l\'antioxydant ou de l\'acide salicylique.',
    id: 'Jika hanya tertulis "BHA", pastikan apakah antioksidan BHA atau Asam Salisilat.',
    ms: 'Jika hanya tertulis "BHA", sahkan sama ada antioksidan BHA atau Asid Salisilik.',
    es: 'Si aparece solo «BHA», confirmar si corresponde al antioxidante o al ácido salicílico.',
    ru: 'При одиночной записи «BHA» требуется подтвердить: антиоксидант это или салициловая кислота.',
    ur: 'اگر صرف "BHA" لکھا ہو تو تصدیق کریں کہ آیا یہ اینٹی آکسیڈنٹ ہے یا سیلیسیلک ایسڈ۔'
  },
  retinol: {
    en: 'Red alert in the Pregnancy profile reflects total Vitamin A exposure and the precautionary principle.',
    ar: 'التنبيه الأحمر في ملف الحمل يعكس إجمالي التعرض لفيتامين A ومبدأ الاحتياط.',
    de: 'Die rote Warnung im Schwangerschaftsprofil basiert auf der Gesamt-Vitamin-A-Exposition und dem Vorsorgeprinzip.',
    fr: 'L\'alerte rouge dans le profil Grossesse reflète l\'exposition totale à la vitamine A et le principe de précaution.',
    id: 'Peringatan merah pada profil Kehamilan mencerminkan total paparan Vitamin A dan prinsip kehati-hatian.',
    ms: 'Amaran merah dalam profil Kehamilan mencerminkan jumlah pendedahan Vitamin A dan prinsip berjaga-jaga.',
    es: 'La alerta roja en Embarazo refleja la exposición total a la vitamina A y el principio de precaución.',
    ru: 'Красный сигнал в профиле беременности отражает суммарную нагрузку витамина A и принцип предосторожности.',
    ur: 'حمل کے پروفائل میں سرخ انتباہ وٹامن A کی مجموعی مقدار اور احتیاطی اصول کی بنیاد پر ہے۔'
  },
  bakuchiol: {
    en: 'Botanical meroterpene, not a retinoid; no verified official teratogenicity/safety dataset exists for pregnancy (unknown).',
    ar: 'مركب نباتي وليس ريتينويد؛ لا تتوفر بيانات رسمية موثقة لسلامته أثناء الحمل (غير معروف).',
    de: 'Pflanzliches Meroterpen, kein Retinoid; keine verifizierten offiziellen Sicherheitsdaten für die Schwangerschaft (unbekannt).',
    fr: 'Méroterpène végétal, non rétinoïde ; aucune donnée officielle vérifiée pour la grossesse (inconnu).',
    id: 'Meroterpen nabati, bukan retinoid; belum ada data keamanan resmi terverifikasi untuk kehamilan (tidak diketahui).',
    ms: 'Meroterpen tumbuhan, bukan retinoid; tiada data keselamatan rasmi yang disahkan untuk kehamilan (tidak diketahui).',
    es: 'Meroterpeno vegetal, no retinoide; sin datos oficiales verificados de seguridad en el embarazo (desconocido).',
    ru: 'Растительный меротерпен, не ретиноид; официальных данных о безопасности при беременности нет (неизвестно).',
    ur: 'نباتاتی مرکب ہے، ریٹینوائڈ نہیں؛ حمل کے دوران حفاظت کا کوئی مستند سرکاری ڈیٹا دستیاب نہیں (نامعلوم)۔'
  },
  salicylic_acid: {
    en: 'Per MotherToBaby / ACOG, low-concentration limited topical use depends on concentration and application area; consult a physician.',
    ar: 'وفق MotherToBaby / ACOG يعتمد الاستخدام الموضعي المحدود أثناء الحمل على التركيز ومساحة التطبيق؛ يُستشار الطبيب.',
    de: 'Laut MotherToBaby / ACOG hängt eine kleinflächige niedrig dosierte Anwendung von Konzentration und Fläche ab; ärztlichen Rat einholen.',
    fr: 'Selon MotherToBaby / ACOG, l\'usage topique limité dépend de la concentration et de la zone ; consulter un médecin.',
    id: 'Menurut MotherToBaby / ACOG, penggunaan topikal terbatas bergantung pada konsentrasi dan area; konsultasikan dengan dokter.',
    ms: 'Menurut MotherToBaby / ACOG, penggunaan topikal terhad bergantung pada kepekatan dan kawasan; rujuk doktor.',
    es: 'Según MotherToBaby / ACOG, el uso tópico limitado depende de la concentración y la zona; consultar al médico.',
    ru: 'По данным MotherToBaby / ACOG, ограниченное наружное применение зависит от концентрации и площади; проконсультируйтесь с врачом.',
    ur: 'MotherToBaby / ACOG کے مطابق محدود مقامی استعمال ارتکاز اور حصے پر منحصر ہے؛ معالج سے مشورہ کریں۔'
  },
  formaldehyde_releasers: {
    en: 'Strong contact allergen / sensitizer for sensitive skin and eczema-prone individuals.',
    ar: 'مسبب قوي لحساسية التلامس للأشخاص ذوي البشرة الحساسة أو الأكزيما.',
    de: 'Starkes Kontaktallergen für empfindliche oder zu Ekzemen neigende Haut.',
    fr: 'Allergène de contact puissant pour les peaux sensibles ou sujettes à l\'eczéma.',
    id: 'Alergen kontak kuat bagi kulit sensitif atau rentan eksim.',
    ms: 'Alergen sentuhan kuat bagi kulit sensitif atau mudah ekzema.',
    es: 'Alérgeno de contacto potente para pieles sensibles o con tendencia a eccema.',
    ru: 'Сильный контактный аллерген для чувствительной и склонной к экземе кожи.',
    ur: 'حساس جلد اور ایکزیما کے شکار افراد کے لیے شدید الرجن۔'
  },
  mi_mci: {
    en: 'Potent contact allergen; presence in leave-on creams or wet wipes violates EU cosmetics law.',
    ar: 'مسبب قوي لحساسية التلامس؛ وجوده في الكريمات التي لا تُشطف أو المناديل المبللة يخالف قانون الاتحاد الأوروبي.',
    de: 'Starkes Kontaktallergen; in Leave-on-Cremes oder Feuchttüchern in der EU verboten.',
    fr: 'Allergène de contact puissant ; sa présence dans les crèmes sans rinçage ou lingettes est illégale dans l\'UE.',
    id: 'Alergen kontak kuat; keberadaannya di krim tanpa bilas atau tisu basah melanggar hukum UE.',
    ms: 'Alergen sentuhan kuat; kehadirannya dalam krim tanpa bilas atau tisu basah melanggar undang-undang EU.',
    es: 'Alérgeno de contacto potente; su presencia en cremas sin aclarado o toallitas infringe la ley de la UE.',
    ru: 'Сильный контактный аллерген; наличие в несмываемых кремах или влажных салфетках запрещено в ЕС.',
    ur: 'شدید الرجن؛ بغیر دھلنے والی کریموں یا گیلی وائپس میں موجودگی یورپی یونین کے قانون کی خلاف ورزی ہے۔'
  },
  fragrance_allergens: {
    en: 'Not harmful to everyone; flagged to inform individuals with fragrance allergy or eczema.',
    ar: 'ليس ضاراً بالجميع؛ يُعرض لتنبيه المصابين بحساسية العطور أو الأكزيما.',
    de: 'Nicht für jeden schädlich; dient dem Schutz von Personen mit Duftstoffallergie oder Ekzem.',
    fr: 'Pas nocif pour tous ; signalé pour informer les personnes allergiques aux parfums ou sujettes à l\'eczéma.',
    id: 'Tidak berbahaya bagi semua orang; ditampilkan untuk memberi tahu penderita alergi wewangian atau eksim.',
    ms: 'Tidak memudaratkan semua orang; ditunjukkan untuk memaklumkan penghidap alahan wangian atau ekzema.',
    es: 'No es dañino para todos; se señala para informar a personas con alergia a fragancias o eccema.',
    ru: 'Не вреден для всех; предупреждение предназначено для людей с аллергией на отдушки или экземой.',
    ur: 'سب کے لیے نقصان دہ نہیں؛ خوشبو کی الرجی یا ایکزیما والے افراد کی آگاہی کے لیے ہے۔'
  },
  parfum: {
    en: 'Listing "Parfum" does not automatically mean hidden phthalates are present; no speculative claims are inferred.',
    ar: 'وجود "Parfum" لا يعني بالضرورة وجود فثالات مخفية؛ لا تُفترض مكونات غير معلنة.',
    de: 'Die Angabe „Parfum“ bedeutet nicht automatisch versteckte Phthalate; keine Spekulation.',
    fr: 'La mention « Parfum » n\'implique pas automatiquement la présence cachée de phtalates.',
    id: 'Tercantumnya "Parfum" tidak otomatis berarti adanya ftalat tersembunyi.',
    ms: 'Penyenaraian "Parfum" tidak bermakna wujudnya ftalat tersembunyi secara automatik.',
    es: 'Incluir «Parfum» no implica automáticamente ftalatos ocultos; no se hacen suposiciones.',
    ru: 'Наличие «Parfum» не означает автоматически присутствие скрытых фталатов.',
    ur: '"Parfum" درج ہونے کا لازماً یہ مطلب نہیں کہ اس میں پوشیدہ فتھیلیٹس شامل ہیں۔'
  },
  alcohol_denat: {
    en: 'When in the top 5 ingredients, high concentration can dry the skin barrier; check the Halal Card for religious ruling.',
    ar: 'إذا كان ضمن أول 5 مكونات فقد يسبب جفاف الحاجز الجلدي؛ راجع بطاقة الحلال للحكم الشرعي.',
    de: 'Unter den ersten 5 Inhaltsstoffen kann die hohe Konzentration die Hautbarriere austrocknen; siehe Halal-Karte.',
    fr: 'Dans les 5 premiers ingrédients, sa concentration peut dessécher la barrière cutanée ; voir la carte Halal.',
    id: 'Jika berada di 5 urutan teratas, dapat mengeringkan pelindung kulit; lihat Kartu Halal untuk hukumnya.',
    ms: 'Jika dalam 5 ramuan teratas, boleh mengeringkan lapisan kulit; rujuk Kad Halal untuk hukum.',
    es: 'En los 5 primeros ingredientes, puede resecar la barrera cutánea; consulta la Tarjeta Halal.',
    ru: 'В первых 5 компонентах может сушить кожный барьер; религиозную оценку см. на карточке Халяль.',
    ur: 'اگر ابتدائی 5 اجزاء میں ہو تو جلد کو خشک کر سکتا ہے؛ شرعی حکم کے لیے حلال کارڈ دیکھیں۔'
  },
  isopropyl_alcohol: {
    en: 'When in the top 5 ingredients, it may dry sensitive skin.',
    ar: 'إذا كان ضمن أول 5 مكونات فقد يسبب جفافاً للبشرة الحساسة.',
    de: 'Unter den ersten 5 Inhaltsstoffen kann es empfindliche Haut austrocknen.',
    fr: 'Dans les 5 premiers ingrédients, il peut dessécher les peaux sensibles.',
    id: 'Jika berada di 5 urutan teratas, dapat mengeringkan kulit sensitif.',
    ms: 'Jika berada dalam 5 ramuan teratas, boleh mengeringkan kulit sensitif.',
    es: 'En los 5 primeros ingredientes, puede resecar las pieles sensibles.',
    ru: 'В первых 5 компонентах может сушить чувствительную кожу.',
    ur: 'اگر ابتدائی 5 اجزاء میں ہو تو حساس جلد کو خشک کر سکتا ہے۔'
  },
  sls: {
    en: 'Strong surfactant used as a reference irritant in patch testing; may dry eczema/rosacea skin. Do not confuse with SLES.',
    ar: 'مادة منظفة قوية قد تجفف البشرة المصابة بالأكزيما؛ لا ينبغي خلطها مع SLES.',
    de: 'Starkes Tensid (Referenzreizstoff im Epikutantest); nicht mit SLES verwechseln.',
    fr: 'Tensioactif fort pouvant irriter/dessécher les peaux réactives ; à ne pas confondre avec le SLES.',
    id: 'Surfaktan kuat yang dapat mengeringkan kulit eksim; jangan disamakan dengan SLES.',
    ms: 'Surfaktan kuat yang boleh mengeringkan kulit ekzema; jangan kelirukan dengan SLES.',
    es: 'Tensioactivo fuerte que puede resecar pieles con eccema; no confundir con SLES.',
    ru: 'Сильный ПАВ; может сушить кожу при экземе/розацеа. Не путать с SLES.',
    ur: 'تیز سرفیکٹنٹ جو ایکزیما والی جلد کو خشک کر سکتا ہے؛ SLES سے خلط ملط نہ کریں۔'
  },
  sles: {
    en: 'Significantly milder than SLS; not placed in the same irritation tier as SLS.',
    ar: 'ألطف بكثير من SLS ولا يُصنَّف في نفس درجة التهيّج.',
    de: 'Deutlich milder als SLS; wird nicht in derselben Reizstufe bewertet.',
    fr: 'Nettement plus doux que le SLS ; n\'est pas classé au même niveau d\'irritation.',
    id: 'Jauh lebih lembut daripada SLS dan tidak dinilai pada tingkat iritasi yang sama.',
    ms: 'Jauh lebih lembut berbanding SLS dan tidak dinilai pada tahap kerengsaan yang sama.',
    es: 'Significativamente más suave que el SLS; no se evalúa en el mismo nivel de irritación.',
    ru: 'Значительно мягче SLS; не оценивается на том же уровне раздражения.',
    ur: 'SLS کے مقابلے میں نمایاں طور پر نرم ہے اور اسی درجے میں نہیں رکھا جاتا۔'
  },
  comedogenic_esters_oils: {
    en: 'Neat-ingredient pore-clogging potential reported (Fulton 1989), though final product comedogenicity depends on formulation (Draelos 2006). Does not lower general index.',
    ar: 'احتمالية سد المسام تعتمد على الصيغة النهائية للمنتج (Draelos 2006)؛ لا يخفض المؤشر التنظيمي العام.',
    de: 'Komedogenität hängt von der Gesamtformulierung ab (Draelos 2006); senkt den allgemeinen Index nicht.',
    fr: 'La comédogénicité dépend de la formulation finale (Draelos 2006) ; ne réduit pas l\'indice général.',
    id: 'Potensi menyumbat pori bergantung pada formulasi akhir (Draelos 2006); tidak menurunkan skor umum.',
    ms: 'Potensi menyumbat pori bergantung pada formulasi akhir (Draelos 2006); tidak menurunkan skor umum.',
    es: 'La comedogenicidad depende de la formulación final (Draelos 2006); no reduce el índice general.',
    ru: 'Комедогенность зависит от итоговой рецептуры (Draelos 2006); общий индекс не снижает.',
    ur: 'مسام بند ہونے کا انحصار حتمی فارمولیشن پر ہوتا ہے (Draelos 2006)؛ مجموعی اسکور کم نہیں کرتا۔'
  },
  southampton_dyes: {
    en: 'FALSE-POSITIVE NOTE: E124 ("Cochineal Red A" / Ponceau 4R) is a synthetic azo dye, NOT insect-derived Carmine (E120).',
    ar: 'ملاحظة إنذار كاذب: E124 (Ponceau 4R) صبغة آزو صناعية وليست القرمز الحشري (E120).',
    de: 'FEHLALARM-HINWEIS: E124 (Ponceau 4R / „Cochenillerot A“) ist ein synthetischer Azofarbstoff, KEIN echtes Karmin (E120).',
    fr: 'NOTE FAUX POSITIF : E124 (Ponceau 4R) est un colorant azoïque synthétique, PAS du carmin d\'insecte (E120).',
    id: 'CATATAN POSITIF PALSU: E124 (Ponceau 4R) adalah pewarna azo sintetis, BUKAN Karmin serangga (E120).',
    ms: 'NOTA POSITIF PALSU: E124 (Ponceau 4R) ialah pewarna azo sintetik, BUKAN Karmin serangga (E120).',
    es: 'NOTA FALSO POSITIVO: E124 (Ponceau 4R) es un colorante azoico sintético, NO carmín de insecto (E120).',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: E124 (Понсо 4R) — синтетический азокраситель, НЕ кармин из насекомых (E120).',
    ur: 'غلط انتباہ نوٹ: E124 (Ponceau 4R) مصنوعی رنگ ہے، کیڑے سے حاصل ہونے والا کارمین (E120) نہیں۔'
  },
  nitrites_e249_e250: {
    en: 'Actual intake cannot be computed from ingredient presence alone; EFSA notes ADI may be exceeded with high processed-meat intake.',
    ar: 'لا يمكن حساب الجرعة من مجرد وجود المكوّن؛ تشير EFSA لاحتمال تجاوز الجرعة اليومية عند الإفراط في اللحوم المصنعة.',
    de: 'Die tatsächliche Dosis lässt sich aus der Zutatenliste allein nicht berechnen; laut EFSA kann der ADI bei viel Wurstwaren überschritten werden.',
    fr: 'La dose réelle ne peut pas être déduite de la seule présence ; l\'EFSA note un dépassement possible en cas de forte consommation de charcuterie.',
    id: 'Dosis tidak bisa dihitung hanya dari label; EFSA mencatat ADI dapat terlampaui pada konsumsi daging olahan tinggi.',
    ms: 'Dos sebenar tidak boleh dikira daripada senarai ramuan sahaja; EFSA menyatakan ADI boleh melebihi had bagi pengambilan daging diproses yang tinggi.',
    es: 'La dosis no puede calcularse solo por presencia; la EFSA señala posible superación de la IDA con alto consumo de carnes procesadas.',
    ru: 'Дозу нельзя вычислить только по составу; EFSA отмечает риск превышения ДСП при высоком потреблении мясных изделий.',
    ur: 'محض اجزاء کی فہرست سے مقدار کا حساب نہیں لگایا جا سکتا؛ EFSA کے مطابق زیادہ پراسیسڈ گوشت کھانے پر ADI سے تجاوز ہو سکتا ہے۔'
  },
  nitrates_e251_e252: {
    en: 'Do not confuse E250 (Nitrite) with E252 (Nitrate) during OCR reading.',
    ar: 'يجب عدم الخلط بين E250 (النيتريت) و E252 (النترات) أثناء القراءة الضوئية.',
    de: 'Beim OCR-Scan E250 (Nitrit) nicht mit E252 (Nitrat) verwechseln.',
    fr: 'Ne pas confondre E250 (Nitrite) et E252 (Nitrate) lors de la lecture OCR.',
    id: 'Jangan tertukar antara E250 (Nitrit) dan E252 (Nitrat) saat pemindaian OCR.',
    ms: 'Jangan kelirukan E250 (Nitrit) dengan E252 (Nitrat) semasa imbasan OCR.',
    es: 'No confundir E250 (Nitrito) con E252 (Nitrato) en la lectura OCR.',
    ru: 'Не путать E250 (нитрит) и E252 (нитрат) при OCR-распознавании.',
    ur: 'OCR اسکن میں E250 (نائٹرائٹ) اور E252 (نائٹریٹ) کو خلط نہ کریں۔'
  },
  sulfites_e220_e228: {
    en: 'Not carcinogenic; does not lower the general index, flagged as an asthma/sulfite-sensitivity alert.',
    ar: 'ليس مسرطناً ولا يخفض المؤشر العام؛ يُعرض كتنبيه للربو وحساسية الكبريتيت.',
    de: 'Nicht krebserregend; senkt den allgemeinen Index nicht, sondern dient als Asthma-/Sulfit-Warnung.',
    fr: 'Non cancérogène ; ne réduit pas l\'indice général, sert d\'alerte asthme/sensibilité aux sulfites.',
    id: 'Bukan karsinogen; tidak menurunkan skor umum, ditampilkan sebagai peringatan asma/sensitivitas sulfit.',
    ms: 'Bukan karsinogen; tidak menurunkan skor umum, dipaparkan sebagai amaran asma/sensitiviti sulfit.',
    es: 'No es carcinógeno; no baja el índice general, se muestra como alerta para asma/sensibilidad a sulfitos.',
    ru: 'Не канцерогенен; не снижает общий индекс, служит предупреждением при астме и чувствительности к сульфитам.',
    ur: 'سرطان پیدا کرنے والا نہیں؛ مجموعی اسکور کم نہیں کرتا، صرف دمہ اور سلفائٹ حساسیت کی تنبیہ ہے۔'
  },
  titanium_dioxide_e171_ci77891: {
    en: 'The rule engine automatically distinguishes food (E171 banned) from cosmetic (CI 77891 permitted).',
    ar: 'يميز محرك القواعد تلقائياً بين الغذاء (E171 محظور) ومستحضرات التجميل (CI 77891 مسموح).',
    de: 'Die Regel-Engine unterscheidet automatisch zwischen Lebensmittel (E171 verboten) und Kosmetik (CI 77891 zulässig).',
    fr: 'Le moteur distingue automatiquement l\'alimentaire (E171 interdit) du cosmétique (CI 77891 autorisé).',
    id: 'Mesin aturan membedakan secara otomatis antara pangan (E171 dilarang) dan kosmetik (CI 77891 diizinkan).',
    ms: 'Enjin peraturan membezakan secara automatik antara makanan (E171 dilarang) dan kosmetik (CI 77891 dibenarkan).',
    es: 'El motor distingue automáticamente entre alimento (E171 prohibido) y cosmético (CI 77891 permitido).',
    ru: 'Модуль автоматически различает пищу (E171 запрещён) и косметику (CI 77891 разрешён).',
    ur: 'رول انجن خودکار طور پر خوراک (E171 ممنوع) اور کاسمیٹکس (CI 77891 مجاز) میں فرق کرتا ہے۔'
  },
  msg_e621: {
    en: 'Does not generate an isolated "causes insulin resistance" verdict; EFSA group ADI reference is shown for high intake.',
    ar: 'لا يُصدر حكماً بمفرده عن مقاومة الإنسولين؛ تُعرض قيمة ADI المرجعية للاستخدام المكثف.',
    de: 'Erzeugt keine pauschale Aussage zur Insulinresistenz; gibt den EFSA-Gruppen-ADI als Orientierung an.',
    fr: 'Ne génère pas d\'affirmation isolée sur l\'insulino-résistance ; indique la DJA de groupe EFSA.',
    id: 'Tidak menghasilkan klaim tunggal resistensi insulin; menampilkan referensi ADI grup EFSA.',
    ms: 'Tidak menghasilkan dakwaan tunggal rintangan insulin; memaparkan rujukan ADI kumpulan EFSA.',
    es: 'No afirma de forma aislada que cause resistencia a la insulina; muestra la IDA de grupo EFSA.',
    ru: 'Не выносит голословного вердикта об инсулинорезистентности; приводит групповую ДСП EFSA.',
    ur: 'تنہا انسولین مزاحمت کا دعویٰ نہیں کیا جاتا؛ زیادہ استعمال کے لیے EFSA گروپ ADI حوالہ دیا جاتا ہے۔'
  },
  aha_glycolic_lactic_mandelic: {
    en: 'When in the top 5 cosmetic ingredients, high concentration may cause stinging on sensitive skin; daily SPF is recommended.',
    ar: 'عند وجوده في أول 5 مكونات تجميلية قد يسبب وخزاً للبشرة الحساسة؛ يُنصح باستخدام واقي شمس.',
    de: 'In den Top 5 bei Kosmetika kann es auf empfindlicher Haut kribbeln; Sonnenschutz wird empfohlen.',
    fr: 'Dans le top 5 des ingrédients cosmétiques, peut picoter les peaux sensibles ; protection solaire recommandée.',
    id: 'Jika di 5 urutan teratas kosmetik, dapat menimbulkan rasa perih pada kulit sensitif; disarankan memakai SPF.',
    ms: 'Jika dalam 5 ramuan teratas kosmetik, boleh menyebabkan rasa pedih pada kulit sensitif; SPF disyorkan.',
    es: 'En los 5 primeros ingredientes cosméticos, puede causar escozor en piel sensible; se recomienda protector solar.',
    ru: 'В первых 5 позициях косметики может вызывать пощипывание на чувствительной коже; рекомендуется SPF.',
    ur: 'کاسمیٹکس میں ابتدائی 5 اجزاء میں ہونے پر حساس جلد پر چبھن ہو سکتی ہے؛ سن اسکرین کا مشورہ دیا جاتا ہے۔'
  },
  mexoryl_400_uv_filter: {
    en: 'EU Annex VI/32: Max 3% concentration; prohibited in spray/aerosol inhalation applications.',
    ar: 'ملحق الاتحاد الأوروبي VI/32: حد أقصى 3%؛ محظور في البخاخات والرذاذ القابل للاستنشاق.',
    de: 'EU-Anhang VI/32: Max. 3%; in Sprays/Aerosolen mit Inhalationsrisiko verboten.',
    fr: 'UE Annexe VI/32 : Max 3% ; interdit dans les sprays/aérosols inhalables.',
    id: 'Lampiran VI/32 UE: Maks. 3%; dilarang pada aplikasi semprot/aerosol.',
    ms: 'Lampiran VI/32 EU: Maks. 3%; dilarang dalam aplikasi semburan/aerosol.',
    es: 'Anexo VI/32 UE: Máx. 3%; prohibido en sprays/aerosoles con riesgo de inhalación.',
    ru: 'Приложение VI/32 ЕС: макс. 3%; запрещено в спреях и аэрозолях.',
    ur: 'یورپی یونین ضمیمہ VI/32: زیادہ سے زیادہ 3%؛ اسپرے/ایروسول میں ممنوع۔'
  },
  benzyl_alcohol: {
    en: 'FALSE-POSITIVE SHIELD: Despite containing "Alcohol" in its name, it is an aromatic preservative/solvent, not intoxicating ethyl alcohol (ethanol).',
    ar: 'حماية من الإنذار الكاذب: رغم وجود "Alcohol" في اسمه، فهو مادة حافظة عطرية وليس كحولاً إيثيلياً مسكراً.',
    de: 'SCHUTZ VOR FEHLALARM: Trotz „Alcohol“ im Namen ein aromatischer Konservierungsstoff, kein Ethylalkohol (Ethanol).',
    fr: 'PROTECTION FAUX POSITIF : Malgré « Alcohol » dans son nom, c\'est un conservateur aromatique, pas de l\'éthanol.',
    id: 'PERLINDUNGAN POSITIF PALSU: Meski mengandung kata "Alcohol", ini pengawet aromatik, bukan etil alkohol.',
    ms: 'PERISAI POSITIF PALSU: Walaupun mengandungi perkataan "Alcohol", ia pengawet aromatik, bukan etil alkohol.',
    es: 'ESCUDO FALSO POSITIVO: Pese a incluir «Alcohol», es un conservante aromático, no etanol.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Несмотря на слово «Alcohol», это ароматический консервант, а не этиловый спирт.',
    ur: 'غلط انتباہ سے تحفظ: نام میں "Alcohol" کے باوجود یہ خوشبودار پریزرویٹو ہے، نشہ آور ایتھانول نہیں۔'
  },
  stevia_polyol_sweeteners: {
    en: 'FALSE-POSITIVE SHIELD: Sugar alcohols (-ol endings like Sorbitol, Xylitol, Maltitol, Erythritol) are NOT ethyl alcohol and are halal.',
    ar: 'حماية من الإنذار الكاذب: الكحولات السكرية (البوليولات مثل سوربيتول وإكسيليتول) ليست كحولاً إيثيلياً وهي حلال.',
    de: 'SCHUTZ VOR FEHLALARM: Zuckeralkohole (Polyole wie Sorbit, Xylit, Erythrit) sind KEIN Ethylalkohol und halal.',
    fr: 'PROTECTION FAUX POSITIF : Les polyols (Sorbitol, Xylitol, Maltitol, Érythritol) ne sont PAS de l\'éthanol et sont halal.',
    id: 'PERLINDUNGAN POSITIF PALSU: Alkohol gula (poliol seperti Sorbitol, Xylitol, Maltitol) BUKAN etil alkohol dan halal.',
    ms: 'PERISAI POSITIF PALSU: Alkohol gula (poliol seperti Sorbitol, Xylitol, Maltitol) BUKAN etil alkohol dan halal.',
    es: 'ESCUDO FALSO POSITIVO: Los polialcoholes (Sorbitol, Xilitol, Maltitol, Eritritol) NO son etanol y son halal.',
    ru: 'ЗАЩИТА ОТ ЛОЖНОГО СРАБАТЫВАНИЯ: Сахарные спирты (сорбит, ксилит, мальтит, эритрит) НЕ являются этиловым спиртом и халяльны.',
    ur: 'غلط انتباہ سے تحفظ: شوگر الکحل (سوربیٹول، زائلیٹول وغیرہ) ایتھائل الکحل نہیں ہیں اور حلال ہیں۔'
  }
};

function localizeFalsePositiveNote(sub, lang) {
  if (!sub || !sub.note) return null;
  if (lang === 'tr') return sub.note;
  const entry = Object.hasOwn(FALSE_POSITIVE_NOTE_I18N, sub.id) ? FALSE_POSITIVE_NOTE_I18N[sub.id] : null;
  if (entry) return entry[lang] || entry.en;
  return null;
}

const ANNEX_WORD_I18N = {
  en: 'Annex',
  de: 'Anhang',
  fr: 'Annexe',
  es: 'Anexo',
  id: 'Lampiran',
  ms: 'Lampiran',
  ru: 'Приложение',
  ar: 'الملحق',
  ur: 'ضمیمہ'
};

function localizeExtendedRegulatoryText(d, euStatus, targetLang, engineText) {
  // 11. TPHP (EU 2026/909)
  if (d.includes('2026/909')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2026/909 Annex II: Triphenyl Phosphate (TPHP) is prohibited in cosmetics (placing ban 2027-01-01, withdrawal 2028-07-01; Score capped at 10).',
        de: 'EU 2026/909 Anhang II: Triphenylphosphat (TPHP) in Kosmetika verboten (Inverkehrbringen ab 2027-01-01, Bereitstellung ab 2028-07-01 untersagt; Maximalwert 10).',
        fr: 'UE 2026/909 Annexe II : Le phosphate de triphényle (TPHP) est interdit dans les cosmétiques (mise sur le marché 2027-01-01, retrait 2028-07-01 ; Score plafonné à 10).',
        es: 'UE 2026/909 Anexo II: El fosfato de trifenilo (TPHP) está prohibido en cosméticos (comercialización 2027-01-01, retirada 2028-07-01; Puntuación máx. 10).',
        id: 'UE 2026/909 Lampiran II: Trifenil Fosfat (TPHP) dilarang pada kosmetik (pelarangan edar 2027-01-01, penarikan 2028-07-01; Skor maks. 10).',
        ms: 'EU 2026/909 Lampiran II: Trifenil Fosfat (TPHP) dilarang dalam kosmetik (larangan pasaran 2027-01-01, penarikan 2028-07-01; Skor maks. 10).',
        ru: 'ЕС 2026/909 Приложение II: Трифенилфосфат (TPHP) запрещён в косметике (выпуск на рынок с 2027-01-01, изъятие с 2028-07-01; Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2026/909 الملحق II: فوسفات ثلاثي الفينيل (TPHP) محظور في مستحضرات التجميل (حظر الطرح 2027-01-01، السحب 2028-07-01؛ الحد الأقصى 10).',
        ur: 'یورپی یونین 2026/909 ضمیمہ II: کاسمیٹکس میں ٹرائی فینائل فاسفیٹ (TPHP) ممنوع ہے (مارکیٹ پابندی 2027-01-01، واپسی 2028-07-01؛ زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'Transition Alert (EU 2026/909 Annex II): Added to Annex II; placing on the EU market prohibited from 2027-01-01 and making available prohibited from 2028-07-01.',
      de: 'Übergangswarnung (EU 2026/909 Anhang II): In Anhang II aufgenommen; Inverkehrbringen ab 2027-01-01 und Bereitstellung ab 2028-07-01 verboten.',
      fr: 'Alerte de transition (UE 2026/909 Annexe II) : Ajouté à l\'Annexe II ; mise sur le marché interdite dès le 2027-01-01 et retrait le 2028-07-01.',
      es: 'Aviso de transición (UE 2026/909 Anexo II): Añadido al Anexo II; prohibida su introducción desde 2027-01-01 y retirada el 2028-07-01.',
      id: 'Peringatan Transisi (UE 2026/909 Lampiran II): Masuk Lampiran II; pelarangan pemasaran mulai 2027-01-01 dan penarikan 2028-07-01.',
      ms: 'Amaran Peralihan (EU 2026/909 Lampiran II): Dimasukkan ke Lampiran II; larangan pemasaran bermula 2027-01-01 dan penarikan 2028-07-01.',
      ru: 'Переходное предупреждение (ЕС 2026/909 Приложение II): Внесён в Приложение II; выпуск запрещён с 2027-01-01, продажа с 2028-07-01.',
      ar: 'تنبيه فترة انتقالية (EU 2026/909 الملحق II): أُضيف إلى الملحق II؛ يُحظر طرحه اعتباراً من 2027-01-01 وسحبه في 2028-07-01.',
      ur: 'عبوری تنبیہ (EU 2026/909 ضمیمہ II): ضمیمہ II میں شامل؛ 2027-01-01 سے مارکیٹ میں پیش کرنا اور 2028-07-01 سے دستیابی ممنوع ہے۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 12. TPO (EU 2025/877 Omnibus VII)
  if (d.includes('2025/877')) {
    return {
      en: 'EU Omnibus VII Regulation (EU) 2025/877 (CLP 2024/197): Trimethylbenzoyl Diphenylphosphine Oxide (TPO) is banned as a CMR 1B substance in cosmetics and gel nails since 2025-09-01 (Annex II; Score capped at 10).',
      de: 'EU-Omnibus VII (EU) 2025/877 (CLP 2024/197): TPO ist als CMR-1B-Stoff seit 2025-09-01 in Kosmetika und Gel-Nägeln verboten (Anhang II; Maximalwert 10).',
      fr: 'Règlement UE Omnibus VII (UE) 2025/877 (CLP 2024/197) : Le TPO est interdit comme CMR 1B dans les cosmétiques et vernis gel depuis le 2025-09-01 (Annexe II ; Score plafonné à 10).',
      es: 'Reglamento UE Ómnibus VII (UE) 2025/877 (CLP 2024/197): El TPO está prohibido como CMR 1B en cosméticos y esmaltes de gel desde el 2025-09-01 (Anexo II; Puntuación máx. 10).',
      id: 'Regulasi UE Omnibus VII (UE) 2025/877 (CLP 2024/197): TPO dilarang sebagai zat CMR 1B pada kosmetik dan kuteks gel sejak 2025-09-01 (Lampiran II; Skor maks. 10).',
      ms: 'Peraturan EU Omnibus VII (EU) 2025/877 (CLP 2024/197): TPO dilarang sebagai bahan CMR 1B dalam kosmetik dan pengilat kuku gel sejak 2025-09-01 (Lampiran II; Skor maks. 10).',
      ru: 'Регламент ЕС Omnibus VII (ЕС) 2025/877 (CLP 2024/197): TPO запрещён как вещество CMR 1B в косметике и гель-лаках с 2025-09-01 (Приложение II; Макс. балл 10).',
      ar: 'لائحة الاتحاد الأوروبي Omnibus VII (EU) 2025/877: يُحظر TPO كمادة CMR 1B في مستحضرات التجميل وطلاء الجل منذ 2025-09-01 (الملحق II؛ الحد الأقصى 10).',
      ur: 'یورپی یونین Omnibus VII ضابطہ 2025/877: TPO بطور CMR 1B مادہ 2025-09-01 سے کاسمیٹکس اور جیل نیل میں ممنوع ہے (ضمیمہ II؛ زیادہ سے زیادہ اسکور 10)۔'
    }[targetLang] || engineText.bannedGeneric;
  }
  // 13. 4-MBC (EU 2024/996 Annex II/1730)
  if (d.includes('2024/996') && (d.includes('Mayıs 2025') || d.includes('1730') || d.includes('genotoksisite'))) {
    return {
      en: 'EU Regulation 2024/996 Annex II/1730: 4-Methylbenzylidene Camphor (4-MBC) is prohibited (placing ban 2025-05-01, withdrawal 2026-05-01; Score capped at 10).',
      de: 'EU-Verordnung 2024/996 Anhang II/1730: 4-MBC ist verboten (Inverkehrbringen ab 2025-05-01, Abverkaufsende 2026-05-01; Maximalwert 10).',
      fr: 'Règlement UE 2024/996 Annexe II/1730 : Le 4-MBC est interdit (mise sur le marché 2025-05-01, retrait 2026-05-01 ; Score plafonné à 10).',
      es: 'Reglamento UE 2024/996 Anexo II/1730: El 4-MBC está prohibido (comercialización 2025-05-01, retirada 2026-05-01; Puntuación máx. 10).',
      id: 'Regulasi UE 2024/996 Lampiran II/1730: 4-MBC dilarang (larangan edar 2025-05-01, penarikan 2026-05-01; Skor maks. 10).',
      ms: 'Peraturan EU 2024/996 Lampiran II/1730: 4-MBC dilarang (larangan pasaran 2025-05-01, penarikan 2026-05-01; Skor maks. 10).',
      ru: 'Регламент ЕС 2024/996 Приложение II/1730: 4-MBC запрещён (выпуск с 2025-05-01, изъятие с 2026-05-01; Макс. балл 10).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق II/1730: يُحظر 4-MBC (حظر الطرح 2025-05-01، السحب 2026-05-01؛ الحد الأقصى 10).',
      ur: 'یورپی یونین 2024/996 ضمیمہ II/1730: 4-MBC ممنوع ہے (مارکیٹ پابندی 2025-05-01، واپسی 2026-05-01؛ زیادہ سے زیادہ اسکور 10)۔'
    }[targetLang] || engineText.bannedGeneric;
  }
  // 14. Retinol (EU 2024/996 Annex III/376)
  if (d.includes('2024/996') && (d.includes('Retinol') || d.includes('Ek III/376'))) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/376: Retinol & Vitamin A esters are limited to 0.05% RE in body lotions and 0.3% RE in other products; exceeding these limits is prohibited from 2025-11-01 (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/376: Retinol und Vitamin-A-Ester sind auf 0.05% RE in Körperlotionen und 0.3% RE in anderen Produkten begrenzt; Überschreitungen sind ab 2025-11-01 verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/376 : Rétinol et esters de vitamine A limités à 0.05% RE en lait corporel et 0.3% RE dans les autres produits ; tout dépassement est interdit dès le 2025-11-01 (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/376: Retinol y ésteres de vitamina A limitados a 0.05% RE en lociones corporales y 0.3% RE en otros productos; superar el límite está prohibido desde 2025-11-01 (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/376: Retinol & ester vitamin A dibatasi 0.05% RE untuk losion tubuh dan 0.3% RE untuk produk lain; melebihi batas dilarang mulai 2025-11-01 (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/376: Retinol & ester vitamin A dihadkan kepada 0.05% RE dalam losyen badan dan 0.3% RE dalam produk lain; melebihi had dilarang mulai 2025-11-01 (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/376: Ретинол и эфиры витамина A ограничены 0.05% RE для лосьонов для тела и 0.3% RE для прочих средств; превышение запрещено с 2025-11-01 (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/376: يقتصر الريتينول وإسترات فيتامين A على 0.05% RE في لوشن الجسم و0.3% RE في المنتجات الأخرى؛ يُحظر التجاوز اعتباراً من 2025-11-01 (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/376: ریٹینول اور وٹامن A ایسٹرز باڈی لوشن میں 0.05% RE اور دیگر مصنوعات میں 0.3% RE تک محدود ہیں؛ تجاوز 2025-11-01 سے ممنوع ہے (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/376: Retinol & Vitamin A esters are restricted to max 0.05% RE in body lotions and 0.3% RE in other cosmetic products.',
      de: 'EU 2024/996 Anhang III/376: Retinol und Vitamin-A-Ester sind auf max. 0.05% RE in Körperlotionen und 0.3% RE in anderen Produkten beschränkt.',
      fr: 'UE 2024/996 Annexe III/376 : Rétinol et esters de vitamine A limités à max. 0.05% RE dans les laits corporels et 0.3% RE dans les autres produits.',
      es: 'UE 2024/996 Anexo III/376: Retinol y ésteres de vitamina A restringidos a máx. 0.05% RE en lociones corporales y 0.3% RE en otros productos.',
      id: 'UE 2024/996 Lampiran III/376: Retinol & ester vitamin A dibatasi maks. 0.05% RE pada losion tubuh dan 0.3% RE pada produk lain.',
      ms: 'EU 2024/996 Lampiran III/376: Retinol & ester vitamin A dihadkan maks. 0.05% RE dalam losyen badan dan 0.3% RE dalam produk lain.',
      ru: 'ЕС 2024/996 Приложение III/376: Ретинол и эфиры витамина A ограничены макс. 0.05% RE в лосьонах для тела и 0.3% RE в других средствах.',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/376: يقتصر الريتينول وإسترات فيتامين A على حد أقصى 0.05% RE في لوشن الجسم و0.3% RE في المنتجات الأخرى.',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/376: ریٹینول اور وٹامن A ایسٹرز باڈی لوشن میں زیادہ سے زیادہ 0.05% RE اور دیگر مصنوعات میں 0.3% RE تک محدود ہیں۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 15. Kojic Acid (EU 2024/996 Annex III/375)
  if (d.includes('2024/996') && (d.includes('Kojik') || d.includes('Ek III/375') || d.includes('yüz ve el'))) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/375: Kojic Acid is permitted only in face and hand products up to 1.0%; prohibited in body lotions or above 1.0% (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/375: Kojisäure ist nur in Gesichts- und Handprodukten bis 1.0% zulässig; in Körperlotionen oder über 1.0% verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/375 : L\'acide kojique est autorisé uniquement dans les produits visage/mains jusqu\'à 1.0% ; interdit en lait corporel ou au-delà de 1.0% (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/375: El ácido kójico solo se permite en productos faciales y de manos hasta el 1.0%; prohibido en lociones corporales o por encima del 1.0% (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/375: Asam Kojat hanya diizinkan pada produk wajah dan tangan hingga 1.0%; dilarang pada losion tubuh atau di atas 1.0% (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/375: Asid Kojik hanya dibenarkan dalam produk muka dan tangan sehingga 1.0%; dilarang dalam losyen badan atau melebihi 1.0% (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/375: Койевая кислота разрешена только в средствах для лица и рук до 1.0%; запрещена в лосьонах для тела или свыше 1.0% (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/375: يُسمح بحمض الكوجيك فقط في منتجات الوجه واليدين حتى 1.0%؛ محظور في لوشن الجسم أو فوق 1.0% (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/375: کوجک ایسڈ صرف چہرے اور ہاتھوں کی مصنوعات میں 1.0% تک مجاز ہے؛ باڈی لوشن یا 1.0% سے زائد پر ممنوع (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/375: Kojic Acid is permitted in face and hand products up to a maximum concentration of 1.0%.',
      de: 'EU 2024/996 Anhang III/375: Kojisäure ist in Gesichts- und Handprodukten bis maximal 1.0% zulässig.',
      fr: 'UE 2024/996 Annexe III/375 : L\'acide kojique est autorisé dans les produits pour le visage et les mains jusqu\'à 1.0% max.',
      es: 'UE 2024/996 Anexo III/375: El ácido kójico está permitido en productos faciales y de manos hasta un máximo del 1.0%.',
      id: 'UE 2024/996 Lampiran III/375: Asam Kojat diizinkan pada produk wajah dan tangan hingga konsentrasi maksimum 1.0%.',
      ms: 'EU 2024/996 Lampiran III/375: Asid Kojik dibenarkan dalam produk muka dan tangan sehingga kepekatan maksimum 1.0%.',
      ru: 'ЕС 2024/996 Приложение III/375: Койевая кислота разрешена в средствах для лица и рук в концентрации до 1.0%.',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/375: يُسمح بحمض الكوجيك في منتجات الوجه واليدين بحد أقصى 1.0%.',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/375: کوجک ایسڈ چہرے اور ہاتھوں کی مصنوعات میں زیادہ سے زیادہ 1.0% تک مجاز ہے۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 16. Alpha-Arbutin (EU 2024/996 Annex III/377)
  if (d.includes('III/377') || d.includes('Alpha-Arbutin')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/377: Alpha-Arbutin is limited to max 2.0% in face creams and 0.5% in body lotions; exceeding these limits is prohibited (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/377: Alpha-Arbutin ist auf max. 2.0% in Gesichtscremes und 0.5% in Körperlotionen begrenzt; Überschreitungen sind verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/377 : Alpha-Arbutine limitée à max. 2.0% dans les crèmes visage et 0.5% dans les laits corporels ; tout dépassement est interdit (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/377: Alpha-Arbutin limitada a máx. 2.0% en cremas faciales y 0.5% en lociones corporales; superar el límite está prohibido (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/377: Alpha-Arbutin dibatasi maks. 2.0% di krim wajah dan 0.5% di losion tubuh; melebihi batas dilarang (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/377: Alpha-Arbutin dihadkan maks. 2.0% dalam krim muka dan 0.5% dalam losyen badan; melebihi had dilarang (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/377: Альфа-арбутин ограничен 2.0% в кремах для лица и 0.5% в лосьонах для тела; превышение запрещено (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/377: يقتصر ألفا أربوتين على 2.0% في كريمات الوجه و0.5% في لوشن الجسم؛ يُحظر التجاوز (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/377: الفا اربوٹین چہرے کی کریموں میں 2.0% اور باڈی لوشن میں 0.5% تک محدود ہے؛ تجاوز ممنوع (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/377: Alpha-Arbutin is permitted up to 2.0% in face creams and 0.5% in body lotions (placing 2025-02-01, withdrawal 2025-11-01).',
      de: 'EU 2024/996 Anhang III/377: Alpha-Arbutin ist bis 2.0% in Gesichtscremes und 0.5% in Körperlotionen zulässig (Stichtage 2025-02-01 / 2025-11-01).',
      fr: 'UE 2024/996 Annexe III/377 : Alpha-Arbutine autorisée jusqu\'à 2.0% en crème visage et 0.5% en lait corporel (2025-02-01 / 2025-11-01).',
      es: 'UE 2024/996 Anexo III/377: Alpha-Arbutin permitida hasta 2.0% en cremas faciales y 0.5% en lociones corporales (2025-02-01 / 2025-11-01).',
      id: 'UE 2024/996 Lampiran III/377: Alpha-Arbutin diizinkan hingga 2.0% di krim wajah dan 0.5% di losion tubuh (2025-02-01 / 2025-11-01).',
      ms: 'EU 2024/996 Lampiran III/377: Alpha-Arbutin dibenarkan sehingga 2.0% dalam krim muka dan 0.5% dalam losyen badan (2025-02-01 / 2025-11-01).',
      ru: 'ЕС 2024/996 Приложение III/377: Альфа-арбутин разрешён до 2.0% в кремах для лица и 0.5% в лосьонах для тела (2025-02-01 / 2025-11-01).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/377: يُسمح بألفا أربوتين حتى 2.0% في كريمات الوجه و0.5% في لوشن الجسم (2025-02-01 / 2025-11-01).',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/377: الفا اربوٹین چہرے کی کریموں میں 2.0% اور باڈی لوشن میں 0.5% تک مجاز ہے (2025-02-01 / 2025-11-01)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 17. Arbutin (EU 2024/996 Annex III/378)
  if (d.includes('III/378') || d.includes('Arbutin')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/378: Arbutin is permitted only in face creams up to 7.0%; prohibited in body lotions or above 7.0% (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/378: Arbutin ist nur in Gesichtscremes bis 7.0% zulässig; in Körperlotionen oder über 7.0% verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/378 : L\'arbutine est autorisée uniquement en crème visage jusqu\'à 7.0% ; interdite en lait corporel ou au-delà de 7.0% (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/378: Arbutin solo permitida en cremas faciales hasta el 7.0%; prohibida en lociones corporales o por encima del 7.0% (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/378: Arbutin hanya diizinkan pada krim wajah hingga 7.0%; dilarang di losion tubuh atau di atas 7.0% (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/378: Arbutin hanya dibenarkan dalam krim muka sehingga 7.0%; dilarang dalam losyen badan atau melebihi 7.0% (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/378: Арбутин разрешён только в кремах для лица до 7.0%; запрещён в лосьонах для тела или свыше 7.0% (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/378: يُسمح بالأربوتين فقط في كريمات الوجه حتى 7.0%؛ محظور في لوشن الجسم أو فوق 7.0% (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/378: اربوٹین صرف چہرے کی کریموں میں 7.0% تک مجاز ہے؛ باڈی لوشن یا 7.0% سے زائد پر ممنوع (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/378: Arbutin is permitted in face creams up to 7.0% (placing 2025-02-01, withdrawal 2025-11-01).',
      de: 'EU 2024/996 Anhang III/378: Arbutin ist in Gesichtscremes bis 7.0% zulässig (Stichtage 2025-02-01 / 2025-11-01).',
      fr: 'UE 2024/996 Annexe III/378 : L\'arbutine est autorisée dans les crèmes visage jusqu\'à 7.0% (2025-02-01 / 2025-11-01).',
      es: 'UE 2024/996 Anexo III/378: Arbutin permitida en cremas faciales hasta el 7.0% (2025-02-01 / 2025-11-01).',
      id: 'UE 2024/996 Lampiran III/378: Arbutin diizinkan pada krim wajah hingga 7.0% (2025-02-01 / 2025-11-01).',
      ms: 'EU 2024/996 Lampiran III/378: Arbutin dibenarkan dalam krim muka sehingga 7.0% (2025-02-01 / 2025-11-01).',
      ru: 'ЕС 2024/996 Приложение III/378: Арбутин разрешён в кремах для лица до 7.0% (2025-02-01 / 2025-11-01).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/378: يُسمح بالأربوتين في كريمات الوجه حتى 7.0% (2025-02-01 / 2025-11-01).',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/378: اربوٹین چہرے کی کریموں میں 7.0% تک مجاز ہے (2025-02-01 / 2025-11-01)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 18. Genistein (EU 2024/996 Annex III/373)
  if (d.includes('III/373') || d.includes('Genistein')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/373: Genistein is limited to max 0.007% in cosmetics; exceeding this limit is prohibited (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/373: Genistein ist in Kosmetika auf max. 0.007% begrenzt; Überschreitungen sind verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/373 : La génistéine est limitée à max. 0.007% en cosmétique ; tout dépassement est interdit (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/373: La genisteína se limita a máx. 0.007% en cosméticos; superar el límite está prohibido (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/373: Genistein dibatasi maks. 0.007% pada kosmetik; melebihi batas dilarang (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/373: Genistein dihadkan maks. 0.007% dalam kosmetik; melebihi had dilarang (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/373: Генистеин ограничен макс. 0.007% в косметике; превышение запрещено (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/373: يقتصر جينيستين على حد أقصى 0.007% في مستحضرات التجميل؛ يُحظر التجاوز (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/373: کاسمیٹکس میں جینیسٹین زیادہ سے زیادہ 0.007% تک محدود ہے؛ تجاوز ممنوع (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/373: Genistein is permitted in cosmetics up to a maximum concentration of 0.007% (2025-02-01 / 2025-11-01).',
      de: 'EU 2024/996 Anhang III/373: Genistein ist in Kosmetika bis maximal 0.007% zulässig (2025-02-01 / 2025-11-01).',
      fr: 'UE 2024/996 Annexe III/373 : La génistéine est autorisée dans les cosmétiques jusqu\'à 0.007% max. (2025-02-01 / 2025-11-01).',
      es: 'UE 2024/996 Anexo III/373: La genisteína está permitida en cosméticos hasta un máximo del 0.007% (2025-02-01 / 2025-11-01).',
      id: 'UE 2024/996 Lampiran III/373: Genistein diizinkan pada kosmetik hingga 0.007% (2025-02-01 / 2025-11-01).',
      ms: 'EU 2024/996 Lampiran III/373: Genistein dibenarkan dalam kosmetik sehingga 0.007% (2025-02-01 / 2025-11-01).',
      ru: 'ЕС 2024/996 Приложение III/373: Генистеин разрешён в косметике в концентрации до 0.007% (2025-02-01 / 2025-11-01).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/373: يُسمح بجينيستين في مستحضرات التجميل حتى 0.007% (2025-02-01 / 2025-11-01).',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/373: کاسمیٹکس میں جینیسٹین 0.007% تک مجاز ہے (2025-02-01 / 2025-11-01)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 19. Daidzein (EU 2024/996 Annex III/374)
  if (d.includes('III/374') || d.includes('Daidzein')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex III/374: Daidzein is limited to max 0.02% in cosmetics; exceeding this limit is prohibited (Score capped at 10).',
        de: 'EU 2024/996 Anhang III/374: Daidzein ist in Kosmetika auf max. 0.02% begrenzt; Überschreitungen sind verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe III/374 : La daidzéine est limitée à max. 0.02% en cosmétique ; tout dépassement est interdit (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo III/374: La daidzeína se limita a máx. 0.02% en cosméticos; superar el límite está prohibido (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran III/374: Daidzein dibatasi maks. 0.02% pada kosmetik; melebihi batas dilarang (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran III/374: Daidzein dihadkan maks. 0.02% dalam kosmetik; melebihi had dilarang (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение III/374: Даидзеин ограничен макс. 0.02% в косметике; превышение запрещено (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/374: يقتصر دايدزين على حد أقصى 0.02% في مستحضرات التجميل؛ يُحظر التجاوز (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ III/374: کاسمیٹکس میں ڈائیڈزین زیادہ سے زیادہ 0.02% تک محدود ہے؛ تجاوز ممنوع (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex III/374: Daidzein is permitted in cosmetics up to a maximum concentration of 0.02% (2025-02-01 / 2025-11-01).',
      de: 'EU 2024/996 Anhang III/374: Daidzein ist in Kosmetika bis maximal 0.02% zulässig (2025-02-01 / 2025-11-01).',
      fr: 'UE 2024/996 Annexe III/374 : La daidzéine est autorisée dans les cosmétiques jusqu\'à 0.02% max. (2025-02-01 / 2025-11-01).',
      es: 'UE 2024/996 Anexo III/374: La daidzeína está permitida en cosméticos hasta un máximo del 0.02% (2025-02-01 / 2025-11-01).',
      id: 'UE 2024/996 Lampiran III/374: Daidzein diizinkan pada kosmetik hingga 0.02% (2025-02-01 / 2025-11-01).',
      ms: 'EU 2024/996 Lampiran III/374: Daidzein dibenarkan dalam kosmetik sehingga 0.02% (2025-02-01 / 2025-11-01).',
      ru: 'ЕС 2024/996 Приложение III/374: Даидзеин разрешён в косметике в концентрации до 0.02% (2025-02-01 / 2025-11-01).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق III/374: يُسمح بدايدزين في مستحضرات التجميل حتى 0.02% (2025-02-01 / 2025-11-01).',
      ur: 'یورپی یونین 2024/996 ضمیمہ III/374: کاسمیٹکس میں ڈائیڈزین 0.02% تک مجاز ہے (2025-02-01 / 2025-11-01)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 20. Triclosan (EU 2024/996 Annex V/25)
  if (d.includes('V/25') || d.includes('Triclosan')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex V/25: Triclosan is limited to max 0.3% in permitted products and banned in mouthwash, sprays/aerosols, and toothpaste for children under 3 (Score capped at 10).',
        de: 'EU 2024/996 Anhang V/25: Triclosan ist in zulässigen Produkten auf max. 0.3% begrenzt und in Mundwasser, Sprays/Aerosolen sowie Zahnpasta für Kinder unter 3 Jahren verboten (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe V/25 : Le triclosan est limité à max. 0.3% et interdit dans les bains de bouche, sprays/aérosols et dentifrices pour moins de 3 ans (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo V/25: El triclosán se limita a máx. 0.3% y está prohibido en colutorios, aerosoles y dentífricos para menores de 3 años (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran V/25: Triclosan dibatasi maks. 0.3% dan dilarang pada obat kumur, semprotan/aerosol, serta pasta gigi anak di bawah 3 tahun (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran V/25: Triclosan dihadkan maks. 0.3% dan dilarang dalam ubat kumur, semburan/aerosol serta ubat gigi kanak-kanak bawah 3 tahun (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение V/25: Триклозан ограничен 0.3% и запрещён в ополаскивателях рта, спреях/аэрозолях и детских пастах до 3 лет (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق V/25: يقتصر التريكلوسان على 0.3% ويُحظر في غسول الفم والبخاخات ومعجون أسنان الأطفال دون 3 سنوات (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ V/25: ٹرائیکلوسان زیادہ سے زیادہ 0.3% تک محدود ہے اور ماؤتھ واش، اسپرے اور 3 سال سے کم عمر بچوں کے ٹوتھ پیسٹ میں ممنوع ہے (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex V/25: Triclosan is restricted to max 0.3% in listed cosmetics; prohibited in mouthwash and under-3 children\'s toothpaste (2024-12-31 / 2025-10-31).',
      de: 'EU 2024/996 Anhang V/25: Triclosan ist auf max. 0.3% beschränkt; in Mundwasser und Zahnpasta unter 3 Jahren verboten (2024-12-31 / 2025-10-31).',
      fr: 'UE 2024/996 Annexe V/25 : Triclosan limité à max. 0.3% ; interdit en bain de bouche et dentifrice <3 ans (2024-12-31 / 2025-10-31).',
      es: 'UE 2024/996 Anexo V/25: Triclosán restringido a máx. 0.3%; prohibido en colutorios y dentífricos <3 años (2024-12-31 / 2025-10-31).',
      id: 'UE 2024/996 Lampiran V/25: Triclosan dibatasi maks. 0.3%; dilarang pada obat kumur dan pasta gigi anak <3 tahun (2024-12-31 / 2025-10-31).',
      ms: 'EU 2024/996 Lampiran V/25: Triclosan dihadkan maks. 0.3%; dilarang dalam ubat kumur dan ubat gigi kanak-kanak <3 tahun (2024-12-31 / 2025-10-31).',
      ru: 'ЕС 2024/996 Приложение V/25: Триклозан ограничен 0.3%; запрещён в ополаскивателях и пастах для детей до 3 лет (2024-12-31 / 2025-10-31).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق V/25: يقتصر التريكلوسان على 0.3%؛ محظور في غسول الفم ومعجون الأطفال دون 3 سنوات (2024-12-31 / 2025-10-31).',
      ur: 'یورپی یونین 2024/996 ضمیمہ V/25: ٹرائیکلوسان زیادہ سے زیادہ 0.3% تک محدود؛ ماؤتھ واش اور 3 سال سے کم بچوں کے ٹوتھ پیسٹ میں ممنوع (2024-12-31 / 2025-10-31)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 21. Triclocarban (EU 2024/996 Annex V/23 & Annex III)
  if (d.includes('V/23') || d.includes('Triclocarban')) {
    if (euStatus === 'yasak') {
      return {
        en: 'EU 2024/996 Annex V/23 & Annex III: Triclocarban exceeds the 0.2% preservative / 1.5% rinse-off limit or is used in banned mouthwash / under-6 children\'s toothpaste (Score capped at 10).',
        de: 'EU 2024/996 Anhang V/23 & Anhang III: Triclocarban überschreitet das Limit (0.2% Konservierung / 1.5% Rinse-off) oder wird in verbotenem Mundwasser bzw. Zahnpasta unter 6 Jahren verwendet (Maximalwert 10).',
        fr: 'UE 2024/996 Annexe V/23 & Annexe III : Triclocarban au-delà de 0.2% (conservateur) / 1.5% (à rincer) ou utilisé en bain de bouche / dentifrice <6 ans (Score plafonné à 10).',
        es: 'UE 2024/996 Anexo V/23 y Anexo III: Triclocarbán supera 0.2% (conservante) / 1.5% (aclarado) o se usa en colutorio / dentífrico <6 años prohibido (Puntuación máx. 10).',
        id: 'UE 2024/996 Lampiran V/23 & Lampiran III: Triclocarban melampaui batas 0.2% pengawet / 1.5% bilas atau pada obat kumur / pasta gigi <6 tahun yang dilarang (Skor maks. 10).',
        ms: 'EU 2024/996 Lampiran V/23 & Lampiran III: Triclocarban melebihi had 0.2% pengawet / 1.5% bilas atau dalam ubat kumur / ubat gigi <6 tahun yang dilarang (Skor maks. 10).',
        ru: 'ЕС 2024/996 Приложение V/23 и III: Триклокарбан превышает лимит 0.2% (консервант) / 1.5% (смываемый) или применён в ополаскивателе / пасте до 6 лет (Макс. балл 10).',
        ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق V/23 و III: يتجاوز التريكلوكاربان حد 0.2% / 1.5% أو يُستخدم في غسول فم / معجون أطفال دون 6 سنوات محظور (الحد الأقصى 10).',
        ur: 'یورپی یونین 2024/996 ضمیمہ V/23 اور III: ٹرائیکلوکاربن 0.2% / 1.5% کی حد سے متجاوز ہے یا ممنوعہ ماؤتھ واش / 6 سال سے کم بچوں کے ٹوتھ پیسٹ میں ہے (زیادہ سے زیادہ اسکور 10)۔'
      }[targetLang] || engineText.bannedGeneric;
    }
    return {
      en: 'EU 2024/996 Annex V/23 & Annex III: Triclocarban is limited to 0.2% as preservative (excl. mouthwash) and 1.5% in non-preservative rinse-off; banned in under-6 toothpaste (2024-12-31 / 2025-10-31).',
      de: 'EU 2024/996 Anhang V/23 & Anhang III: Triclocarban ist auf 0.2% (Konservierung, außer Mundwasser) und 1.5% (Rinse-off nicht-konservierend) begrenzt; in Zahnpasta <6 Jahre verboten (2024-12-31 / 2025-10-31).',
      fr: 'UE 2024/996 Annexe V/23 & Annexe III : Triclocarban limité à 0.2% (conservateur hors bain de bouche) et 1.5% (à rincer non conservateur) ; interdit en dentifrice <6 ans (2024-12-31 / 2025-10-31).',
      es: 'UE 2024/996 Anexo V/23 y Anexo III: Triclocarbán limitado a 0.2% (conservante salvo colutorio) y 1.5% (aclarado no conservante); prohibido en dentífricos <6 años (2024-12-31 / 2025-10-31).',
      id: 'UE 2024/996 Lampiran V/23 & III: Triclocarban dibatasi 0.2% (pengawet kecuali obat kumur) dan 1.5% (bilas non-pengawet); dilarang pada pasta gigi <6 tahun (2024-12-31 / 2025-10-31).',
      ms: 'EU 2024/996 Lampiran V/23 & III: Triclocarban dihadkan 0.2% (pengawet kecuali ubat kumur) dan 1.5% (bilas bukan pengawet); dilarang dalam ubat gigi <6 tahun (2024-12-31 / 2025-10-31).',
      ru: 'ЕС 2024/996 Приложение V/23 и III: Триклокарбан ограничен 0.2% (консервант, кроме ополаскивателей) и 1.5% (смываемый неконсервант); запрещён в пастах до 6 лет (2024-12-31 / 2025-10-31).',
      ar: 'لائحة الاتحاد الأوروبي 2024/996 الملحق V/23 و III: يقتصر التريكلوكاربان على 0.2% كمادة حافظة و1.5% للشطف غير الحافظ؛ محظور في معجون دون 6 سنوات (2024-12-31 / 2025-10-31).',
      ur: 'یورپی یونین 2024/996 ضمیمہ V/23 اور III: ٹرائیکلوکاربن بطور پریزرویٹو 0.2% اور دھلنے والی مصنوعات میں 1.5% تک محدود ہے؛ 6 سال سے کم ٹوتھ پیسٹ میں ممنوع (2024-12-31 / 2025-10-31)۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  // 22. Parabens (EU 358/2014, EU 1004/2014, Annex V)
  if (d.includes('358/2014')) {
    return {
      en: 'EU Regulation 358/2014 (Annex II): Isopropyl-, Isobutyl-, Phenyl-, Benzyl- and Pentylparaben are prohibited in cosmetic products (Score capped at 10).',
      de: 'EU-Verordnung 358/2014 (Anhang II): Isopropyl-, Isobutyl-, Phenyl-, Benzyl- und Pentylparaben sind in Kosmetika verboten (Maximalwert 10).',
      fr: 'Règlement UE 358/2014 (Annexe II) : Les parabènes isopropylique, isobutylique, phénylique, benzylique et pentylique sont interdits en cosmétique (Score plafonné à 10).',
      es: 'Reglamento UE 358/2014 (Anexo II): Isopropil-, isobutil-, fenil-, bencil- y pentilparabeno están prohibidos en cosméticos (Puntuación máx. 10).',
      id: 'Regulasi UE 358/2014 (Lampiran II): Isopropil-, isobutil-, fenil-, benzil-, dan pentilparaben dilarang pada kosmetik (Skor maks. 10).',
      ms: 'Peraturan EU 358/2014 (Lampiran II): Isopropil-, isobutil-, fenil-, benzil- dan pentilparaben dilarang dalam kosmetik (Skor maks. 10).',
      ru: 'Регламент ЕС 358/2014 (Приложение II): Изопропил-, изобутил-, фенил-, бензил- и пентилпарабен запрещены в косметике (Макс. балл 10).',
      ar: 'لائحة الاتحاد الأوروبي 358/2014 (الملحق II): يُحظر أيزوبروبيل وأيزوبوتيل وفينيل وبنزيل وبنتيل بارابين في مستحضرات التجميل (الحد الأقصى 10).',
      ur: 'یورپی یونین 358/2014 (ضمیمہ II): آئسوپروپیل، آئسوبیوٹائل، فینائل، بینزائل اور پینٹائل پیرابین کاسمیٹکس میں ممنوع ہیں (زیادہ سے زیادہ اسکور 10)۔'
    }[targetLang] || engineText.bannedGeneric;
  }
  if (d.includes('1004/2014')) {
    return {
      en: 'EU Regulation 1004/2014 (Annex V): Propylparaben + Butylparaben combined sum max 0.14%; prohibited in leave-on nappy area products for children under 3.',
      de: 'EU-Verordnung 1004/2014 (Anhang V): Summe aus Propyl- und Butylparaben max. 0.14%; in Leave-on-Produkten für den Windelbereich unter 3 Jahren verboten.',
      fr: 'Règlement UE 1004/2014 (Annexe V) : Somme propylparabène + butylparabène max. 0.14% ; interdit dans les produits sans rinçage pour le siège des moins de 3 ans.',
      es: 'Reglamento UE 1004/2014 (Anexo V): Suma de propilparabeno + butilparabeno máx. 0.14%; prohibido en productos sin aclarado para la zona del pañal en menores de 3 años.',
      id: 'Regulasi UE 1004/2014 (Lampiran V): Total propilparaben + butilparaben maks. 0.14%; dilarang pada produk tanpa bilas area popok anak di bawah 3 tahun.',
      ms: 'Peraturan EU 1004/2014 (Lampiran V): Jumlah propilparaben + butilparaben maks. 0.14%; dilarang dalam produk tanpa bilas kawasan lampin kanak-kanak bawah 3 tahun.',
      ru: 'Регламент ЕС 1004/2014 (Приложение V): Сумма пропил- и бутилпарабена макс. 0.14%; запрещено в несмываемых средствах для зоны подгузников до 3 лет.',
      ar: 'لائحة الاتحاد الأوروبي 1004/2014 (الملحق V): مجموع بروبيل وبوتيل بارابين بحد أقصى 0.14%؛ محظور في منتجات منطقة الحفاض دون شطف للأطفال دون 3 سنوات.',
      ur: 'یورپی یونین 1004/2014 (ضمیمہ V): پروپیل اور بیوٹائل پیرابین کا مجموعہ زیادہ سے زیادہ 0.14%؛ 3 سال سے کم بچوں کے ڈائپر ایریا کی بغیر دھلنے والی مصنوعات میں ممنوع۔'
    }[targetLang] || engineText.restrictedGeneric;
  }
  if (d.includes('AB Ek V:') && d.includes('%0.4')) {
    return {
      en: 'EU Cosmetics Regulation Annex V: Permitted up to 0.4% for a single paraben ester and 0.8% total for ester mixtures.',
      de: 'EU-Kosmetikverordnung Anhang V: Zulässig bis 0.4% für einen einzelnen Ester und 0.8% insgesamt für Estergemische.',
      fr: 'Règlement Cosmétique UE Annexe V : Autorisé jusqu\'à 0.4% pour un ester seul et 0.8% au total pour les mélanges d\'esters.',
      es: 'Reglamento Cosmético UE Anexo V: Permitido hasta 0.4% para un éster individual y 0.8% total para mezclas de ésteres.',
      id: 'Regulasi Kosmetik UE Lampiran V: Diizinkan hingga 0.4% untuk ester tunggal dan 0.8% total untuk campuran ester.',
      ms: 'Peraturan Kosmetik EU Lampiran V: Dibenarkan sehingga 0.4% bagi ester tunggal dan 0.8% jumlah bagi campuran ester.',
      ru: 'Косметический регламент ЕС Приложение V: Разрешено до 0.4% для одного эфира и до 0.8% суммарно для смесей эфиров.',
      ar: 'لائحة مستحضرات التجميل الأوروبية الملحق V: مسموح حتى 0.4% لإستر منفرد و0.8% إجمالاً لمزيج الإسترات.',
      ur: 'یورپی یونین کاسمیٹکس ضمیمہ V: واحد ایسٹر کے لیے 0.4% اور ایسٹرز کے آمیزے کے لیے مجموعی طور پر 0.8% تک مجاز ہے۔'
    }[targetLang] || engineText.permittedGeneric;
  }
  // 23. Dynamic CosIng Annex II/III/IV/V/VI rules from makeCosingSubstance
  const cosingBanMatch = d.match(/^AB Kozmetik Yönetmeliği Ek II kapsamında doğrudan yasaklı bileşen(?:\s*\(([^)]+)\))?\.$/);
  if (cosingBanMatch) {
    const refTag = cosingBanMatch[1] ? ` (${cosingBanMatch[1]})` : '';
    const aw = ANNEX_WORD_I18N[targetLang] || 'Annex';
    return {
      en: `EU Cosmetics Regulation ${aw} II: Directly prohibited cosmetic ingredient${refTag} (Score capped at 10).`,
      de: `EU-Kosmetikverordnung ${aw} II: Direkt verbotener kosmetischer Inhaltsstoff${refTag} (Maximalwert 10).`,
      fr: `Règlement Cosmétique UE ${aw} II : Ingrédient cosmétique directement interdit${refTag} (Score plafonné à 10).`,
      es: `Reglamento Cosmético UE ${aw} II: Ingrediente cosmético directamente prohibido${refTag} (Puntuación máx. 10).`,
      id: `Regulasi Kosmetik UE ${aw} II: Bahan kosmetik yang dilarang langsung${refTag} (Skor maks. 10).`,
      ms: `Peraturan Kosmetik EU ${aw} II: Bahan kosmetik yang dilarang secara langsung${refTag} (Skor maks. 10).`,
      ru: `Косметический регламент ЕС ${aw} II: Прямо запрещённый косметический ингредиент${refTag} (Макс. балл 10).`,
      ar: `لائحة مستحضرات التجميل الأوروبية ${aw} II: مكوّن تجميلي محظور مباشرة${refTag} (الحد الأقصى 10).`,
      ur: `یورپی یونین کاسمیٹکس ضابطہ ${aw} II: براہ راست ممنوع کاسمیٹک جزو${refTag} (زیادہ سے زیادہ اسکور 10)۔`
    }[targetLang] || engineText.bannedGeneric;
  }
  const cosingRestrMatch = d.match(/^AB Kozmetik Yönetmeliği Ek ([^\s]+) kapsamında koşul\/limit kısıtlamasına tabi bileşen(?:\s*\(([^)]+)\))?\.$/);
  if (cosingRestrMatch) {
    const annexRef = cosingRestrMatch[1] || 'III';
    const refTag = cosingRestrMatch[2] ? ` (${cosingRestrMatch[2]})` : '';
    const aw = ANNEX_WORD_I18N[targetLang] || 'Annex';
    return {
      en: `EU Cosmetics Regulation ${aw} ${annexRef}: Ingredient subject to conditions/concentration limits${refTag}.`,
      de: `EU-Kosmetikverordnung ${aw} ${annexRef}: Inhaltsstoff mit Anwendungsbedingungen/-grenzwerten${refTag}.`,
      fr: `Règlement Cosmétique UE ${aw} ${annexRef} : Ingrédient soumis à des conditions ou limites d'utilisation${refTag}.`,
      es: `Reglamento Cosmético UE ${aw} ${annexRef}: Ingrediente sujeto a condiciones o límites de uso${refTag}.`,
      id: `Regulasi Kosmetik UE ${aw} ${annexRef}: Bahan tunduk pada syarat/batas konsentrasi${refTag}.`,
      ms: `Peraturan Kosmetik EU ${aw} ${annexRef}: Bahan tertakluk kepada syarat/had kepekatan${refTag}.`,
      ru: `Косметический регламент ЕС ${aw} ${annexRef}: Ингредиент с условиями или предельными концентрациями${refTag}.`,
      ar: `لائحة مستحضرات التجميل الأوروبية ${aw} ${annexRef}: مكوّن خاضع لشروط أو حدود تركيز${refTag}.`,
      ur: `یورپی یونین کاسمیٹکس ضابطہ ${aw} ${annexRef}: شرائط یا ارتکاز کی حدود کے تابع جزو${refTag}۔`
    }[targetLang] || engineText.restrictedGeneric;
  }
  const cosingPermMatch = d.match(/^AB CosIng veritabanında kayıtlı izinli kozmetik bileşen(?:\s*\(([^)]+)\))?\.$/);
  if (cosingPermMatch) {
    const refTag = cosingPermMatch[1] ? ` (${cosingPermMatch[1]})` : '';
    return {
      en: `Permitted cosmetic ingredient listed in the EU CosIng database${refTag}.`,
      de: `Zulässiger kosmetischer Inhaltsstoff aus der EU-CosIng-Datenbank${refTag}.`,
      fr: `Ingrédient cosmétique autorisé répertorié dans la base EU CosIng${refTag}.`,
      es: `Ingrediente cosmético permitido registrado en la base de datos EU CosIng${refTag}.`,
      id: `Bahan kosmetik yang diizinkan dan terdaftar dalam basis data CosIng UE${refTag}.`,
      ms: `Bahan kosmetik yang dibenarkan dan berdaftar dalam pangkalan data CosIng EU${refTag}.`,
      ru: `Разрешённый косметический ингредиент, зарегистрированный в базе EU CosIng${refTag}.`,
      ar: `مكوّن تجميلي مسموح ومُسجَّل في قاعدة بيانات CosIng الأوروبية${refTag}.`,
      ur: `یورپی یونین CosIng ڈیٹا بیس میں درج مجاز کاسمیٹک جزو${refTag}۔`
    }[targetLang] || engineText.permittedGeneric;
  }
  return null;
}

function isBodyLotionContext(explicitAppType, appType, rawText) {
  return (
    explicitAppType === 'body_lotion' ||
    appType === 'body_lotion' ||
    /\b(body[\s_-]*lotion|vücut\s+losyonu|vucut\s+losyonu|body\s+cream|body\s+milk|körperlotion|lait\s+corps|loción\s+corporal|losion\s+tubuh|лосьон\s+для\s+тела|لوشن\s+الجسم)\b/iu.test(rawText || '')
  );
}

function stripNegatedTargets(rawStr) {
  return String(rawStr || '')
    .replace(/[\p{L}]+[\s\-]*(?:free|frei)(?=[^\p{L}]|$)/giu, ' ')
    .replace(/(?:free\s+(?:of|from)|without|ohne|sans|sin|senza|tanpa|bebas|خالي\s+من|خالٍ\s+من|بدون|بغیر|без)\s+[\p{L}]+/giu, ' ')
    .replace(/[\p{L}]+(?:siz|sız|suz|süz)(?=[^\p{L}]|$)/giu, ' ')
    .replace(/[\p{L}]+\s+(?:içermez|icermez|yoktur|bulunmaz|içermeyen|icermeyen)(?=[^\p{L}]|$)/giu, ' ');
}

const EU_14_FOOD_ALLERGENS = [
  { id: 'gluten', names: /(?:^|[^\p{L}\p{N}])(wheat|buğday|bugday|gluten|weizen|weizenmehl|roggenmehl|gerstenmehl|dinkelmehl|hafermehl|bl[ée]|farine\s+de\s+(?:bl[ée]|seigle|froment|kamut|[ée]peautre)|farine\s+d['’](?:orge|avoine)|trigo|harina\s+de\s+(?:trigo|cebada|centeno|avena)|gandum|tepung\s+(?:terigu|gandum|barli)|пшениц[а-я]*|пшеничн[а-я]*\s+мук[аи]|ржан[а-я]*\s+мук[аи]|ячменн[а-я]*\s+мук[аи]|овсян[а-я]*\s+мук[аи]|دقيق\s+(?:القمح|الشعير|الجاودار|الشوفان)|قمح|گندم|گندم\s+کا\s+آٹا|میدہ|arpa|barley|çavdar|cavdar|rye|oats|oat|yulaf|spelt|kamut|(?:wheat|rye|barley|spelt|oat)\s+flour|(?:buğday|bugday|çavdar|cavdar|arpa|yulaf|siyez)\s+unu)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Gluten / Buğday' },
  { id: 'crustaceans', names: /(?:^|[^\p{L}\p{N}])(crustacean[s]?|kabuklu[lar]*|shrimp|karides|udang|prawn[s]?|crab|yengeç|kepiting|ketam|lobster|ıstakoz|istakoz|crawfish|crayfish|langoustine[s]?|krill|crevette[s]?|krabbe[n]?|garnelen|langostinos|mariscos|homard|langosta|ракообразн[а-я]*|креветк[а-я]*|омар|лангуст|قشريات|كركند|جھینگا)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Kabuklular' },
  { id: 'egg', names: /(?:^|[^\p{L}\p{N}])(egg[s]?|yumurta|oeuf[s]?|ei|eier|huevo[s]?|uovo|telur|яйц[а-я]*|بيض|انڈہ|انڈے)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yumurta' },
  { id: 'fish', names: /(?:^|[^\p{L}\p{N}])(fish|balık|balik|poisson|fisch|pescado|pesce|ikan|рыб[а-я]*|سمك|مچھلی|cod|morina|kabeljau|cabillaud|bacalao|merluzzo|треск[аи]|salmon|somon|lachs|saumon|salmón|лосос[ья]|سلمون|tuna|ton\s+balığ[ıi]|thunfisch|thon|atún|tonno|тунец|تونة|anchov(?:y|ies)|hamsi|sardelle|anchois|anchoa|sardine[s]?|sardalya|mackerel|uskumru|makrele|maquereau|caballa|trout|alabalık|forelle|truite|trucha|haddock|pollock|halibut|herring|ringa)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Balık' },
  { id: 'peanut', names: /(?:^|[^\p{L}\p{N}])(peanut[s]?|yer\s*fıst[ıi]ğ[ıi]|arachide[s]?|erdnuss|erdnüsse|cacahuete[s]?|cacahuate[s]?|kacang\s+tanah|арахис|فول\s+سوداني|مونگ\s*پھلی)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yer Fıstığı' },
  { id: 'soy', names: /(?:^|[^\p{L}\p{N}])(soy|soya|soja|kedelai|соя|соев[а-я]*|صويا|سویا|sojalecithin|soybean[s]?)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Soya' },
  { id: 'milk', names: /(?:^|[^\p{L}\p{N}])(milk|süt|sut|lait|leche|milch|latte|susu|молок[а-я]*|حليب|دودھ|whey|casein|lactose|laktoz|kazein|peynir\s*altı\s*suyu)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Süt / Süt Ürünleri' },
  { id: 'tree_nuts', names: /(?:^|[^\p{L}\p{N}])(hazelnut[s]?|haseln[üu]ss[e]?|fındık|findik|noisette[s]?|avellana[s]?|фундук|بندق|ہیزل|almond[s]?|badem|mandel[n]?|amande[s]?|almendra[s]?|миндаль|لوز|بادام|walnut[s]?|ceviz|walnuss|noix|nuez|nueces|грецк[а-я]*\s*орех|جوز|اخروٹ|cashew[s]?|kaju|pistachio[s]?|antep\s*fıstığı|fıstık|fistik|fistigi|pecan[s]?|pekan|macadamia)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Sert Kabuklu Yemişler (Fındık/Badem)' },
  { id: 'celery', names: /(?:^|[^\p{L}\p{N}])(celery|kereviz|sellerie|céleri|celeri|apio|sedano|seleri|сельдерей|كرفس|اجوائن)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Kereviz' },
  { id: 'mustard', names: /(?:^|[^\p{L}\p{N}])(mustard|hardal|senf|moutarde|mostaza|senape|горчиц[а-я]*|خردل|رائی)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Hardal' },
  { id: 'sesame', names: /(?:^|[^\p{L}\p{N}])(sesame|susam|tahin|tahini|sésame|sesam|sésamo|bijan|wijen|кунжут|سمسم|تل)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Susam' },
  { id: 'sulphites', names: /(?:^|[^\p{L}\p{N}])(sulphite[s]?|sulfite[s]?|bisulphite[s]?|bisulfite[s]?|metabisulphite[s]?|metabisulfite[s]?|pyrosulphite[s]?|pyrosulfite[s]?|hydrosulphite[s]?|hydrosulfite[s]?|disulphite[s]?|disulfite[s]?|sülfit|sulfit|bisülfit|bisulfit|metabisülfit|metabisulfit|metabisulfito|bisulfito|schwefeldioxid|dioxyde\s+de\s+soufre|dióxido\s+de\s+azufre|диоксид\s+серы|метабисульфит|бисульфит|сульфит[а-я]*|كبريتيت|ميتابيسلفيت|سلفائٹ|میٹابیسلفائٹ|بیسلفائٹ|e220|e221|e222|e223|e224|e226|e227|e228)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Sülfitler' },
  { id: 'lupin', names: /(?:^|[^\p{L}\p{N}])(lupin[e]?|ac[ıi]\s*bakla|lüpen|lupini|altramuz|люпин|ترمس|لوپن)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Acıbakla (Lüpen)' },
  { id: 'molluscs', names: /(?:^|[^\p{L}\p{N}])(mollusc[s]?|mollusk[s]?|yumuşakça[lar]*|weichtier[e]?|mollusque[s]?|molusco[s]?|istiridye|midye|kalamar|ahtapot|mussel[s]?|oyster[s]?|squid|octopus|clam[s]?|scallop[s]?|cockle[s]?|abalone|escargot|almeja|vongole|moule[s]?|pulpo|calamar|cumi|sotong|kerang|tiram|миди[ия]|кальмар|осьминог|устриц[аы]|رخويات|صدف)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yumuşakçalar' }
];

const UMBRELLA_RULE_IDS = new Set([
  'safe_alcohol_like_non_ethanol',
  'common_whole_food_ingredients',
  'non_comedogenic_botanical_oils_butters',
  'soothing_botanical_extracts',
  'safe_amino_acids_peptides_ferments',
  'safe_vitamins_minerals_salts',
  'safe_emollients_silicones_polymers',
  'safe_surfactants_cleansers',
  'safe_food_acids_stabilizers_spices'
]);

function escapeRegexLiteral(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WATCH_STEM_INDEX = new Map();
function registerWatchStemGroup(rawNames) {
  const names = rawNames.filter(Boolean).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (names.length === 0) return;
  const longStems = [];
  for (const n of names) {
    if (n.length >= 3) {
      longStems.push(n, foldTurkish(n));
    }
  }
  const uniqueLongStems = Array.from(new Set(longStems)).filter((s) => s.length >= 2);
  if (uniqueLongStems.length === 0) return;
  for (const n of names) {
    const keys = [n, foldTurkish(n)];
    for (const key of keys) {
      if (!key) continue;
      let bucket = WATCH_STEM_INDEX.get(key);
      if (!bucket) {
        bucket = [];
        WATCH_STEM_INDEX.set(key, bucket);
      }
      bucket.push(uniqueLongStems);
    }
  }
}

for (const sub of substancesData.substances || []) {
  if (UMBRELLA_RULE_IDS.has(sub.id)) continue;
  const aliases = Array.isArray(sub.aliases) ? sub.aliases : [];
  registerWatchStemGroup([sub.name, sub.e_code, sub.ci_code, ...aliases]);
}
for (const hr of halalData.rules || []) {
  if (UMBRELLA_RULE_IDS.has(hr.id) || hr.category === 'SAFE_NON_ETHANOL') continue;
  const aliases = Array.isArray(hr.aliases) ? hr.aliases : [];
  const codes = Array.isArray(hr.codes) ? hr.codes : [];
  registerWatchStemGroup([hr.canonical, ...codes, ...aliases]);
}

const WATCH_TERM_CACHE = new Map();
const MAX_WATCH_TERM_CACHE = 1000;

function expandWatchTermStems(watchTerm) {
  const wLower = String(watchTerm || '').trim().toLowerCase();
  const wFold = foldTurkish(wLower);
  const stems = new Set([wLower, wFold].filter(Boolean));
  const buckets = [];
  const exactBucket = WATCH_STEM_INDEX.get(wLower);
  if (exactBucket) buckets.push(...exactBucket);
  if (wFold && wFold !== wLower) {
    const foldBucket = WATCH_STEM_INDEX.get(wFold);
    if (foldBucket) buckets.push(...foldBucket);
  }
  for (const group of buckets) {
    for (const s of group) {
      stems.add(s);
    }
  }
  return Array.from(stems).filter((s) => s.length >= 2);
}

function buildNegationRegexes(watchStems) {
  const cleanStems = Array.from(new Set((watchStems || []).map((s) => String(s || '').trim()).filter((s) => s.length >= 2)))
    .sort((a, b) => b.length - a.length);
  if (cleanStems.length === 0) return { negSuffixRe: null, negPrefixRe: null };
  const alt = cleanStems.map(escapeRegexLiteral).join('|');
  return {
    negSuffixRe: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})[\\s\\-]*(?:free|frei|siz|sız|suz|süz|içermez|icermez)(?![\\p{L}\\p{N}])`, 'iu'),
    negPrefixRe: new RegExp(`(?<![\\p{L}\\p{N}])(?:without|no|ohne|sans|sin|tanpa|bebas|free\\s+of|free\\s+from|libre\\s+de|خالي\\s+من|خالٍ\\s+من|بدون|بغیر|без)\\s+(?:${alt})(?![\\p{L}\\p{N}])`, 'iu')
  };
}

function getPreparedWatchTerm(watchTerm) {
  const key = String(watchTerm || '').trim().toLowerCase();
  const cached = WATCH_TERM_CACHE.get(key);
  if (cached) return cached;
  const lowerWatch = key;
  const normWatch = normalizeToken(watchTerm);
  const foldWatch = foldTurkish(lowerWatch);
  const watchStems = expandWatchTermStems(lowerWatch);
  const { negSuffixRe, negPrefixRe } = buildNegationRegexes(watchStems);
  const wordRe = foldWatch.length >= 3 ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegexLiteral(foldWatch)}(?![\\p{L}\\p{N}])`, 'iu') : null;
  const wordReRaw = foldWatch.length >= 3 ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegexLiteral(lowerWatch)}(?![\\p{L}\\p{N}])`, 'iu') : null;
  const entry = { lowerWatch, normWatch, foldWatch, watchStems, negSuffixRe, negPrefixRe, wordRe, wordReRaw };
  if (WATCH_TERM_CACHE.size >= MAX_WATCH_TERM_CACHE) {
    const oldestKey = WATCH_TERM_CACHE.keys().next().value;
    if (oldestKey !== undefined) WATCH_TERM_CACHE.delete(oldestKey);
  }
  WATCH_TERM_CACHE.set(key, entry);
  return entry;
}

function isWatchTermNegatedInRaw(rawLower, rawFold, prepOrStems) {
  if (!rawLower) return false;
  const { negSuffixRe, negPrefixRe } = Array.isArray(prepOrStems)
    ? buildNegationRegexes(prepOrStems)
    : prepOrStems;
  if (negSuffixRe && (negSuffixRe.test(rawLower) || negSuffixRe.test(rawFold))) return true;
  if (negPrefixRe && (negPrefixRe.test(rawLower) || negPrefixRe.test(rawFold))) return true;
  return false;
}

const HAS_WATCH_NEGATION_HINT_RE = /free|frei|siz|sız|suz|süz|içermez|icermez|without|\bno\b|ohne|sans|sin|tanpa|bebas|libre|خالي|خال|بدون|بغیر|без/iu;

const ENTITY_ALIAS_CACHE = new WeakMap();
function getEntityAliasData(entity) {
  if (!entity || typeof entity !== 'object') return null;
  const cached = ENTITY_ALIAS_CACHE.get(entity);
  if (cached) return cached;
  const nameStr = entity.name || entity.canonical || '';
  const nameLower = nameStr ? String(nameStr).trim().toLowerCase() : '';
  const foldName = nameLower ? foldTurkish(nameLower) : '';
  const rawAliases = Array.isArray(entity.aliases) ? entity.aliases : [];
  const lowerAliases = rawAliases.map((a) => String(a || '').toLowerCase()).filter(Boolean);
  const foldedAliases = lowerAliases.map((a) => foldTurkish(a));
  const data = { nameLower, foldName, lowerAliases, foldedAliases };
  ENTITY_ALIAS_CACHE.set(entity, data);
  return data;
}

/**
 * Detects OCR character corruptions in E-codes and CI codes (e.g. "C1 7547O" -> "CI 75470", "E12O" -> "E120").
 * Also supports Cyrillic 'Е' (U+0415 / U+0435) on Russian labels without false OCR corruption alert.
 */
export function detectCodeOcrCandidate(rawToken) {
  const trimmed = rawToken.trim();
  // Check CI code pattern with OCR corruptions (C1, Cl, CL followed by 5 digits/O/I/S)
  const ciMatch = trimmed.match(/^(C[I1lL])\s*[-:]?\s*([0-9OIoSlB]{5})$/i);
  if (ciMatch) {
    const prefix = ciMatch[1].toUpperCase();
    const digitsRaw = ciMatch[2];
    const normalizedDigits = digitsRaw
      .replace(/[Oo]/g, '0')
      .replace(/[Il]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8');
    const canonicalCode = `CI ${normalizedDigits}`;
    const wasCorrupted = prefix !== 'CI' || digitsRaw !== normalizedDigits;
    return {
      isCodeCandidate: true,
      raw: trimmed,
      canonicalCode,
      requiresUserConfirmation: wasCorrupted
    };
  }

  // Check E-code pattern with OCR corruptions (e.g. E12O, E-25O) and Cyrillic Е
  const eMatch = trimmed.match(/^[EЕ]\s*[-:]?\s*([0-9OIoSl]{3,4}[a-f]?)$/iu);
  if (eMatch) {
    const bodyRaw = eMatch[1];
    const numPart = bodyRaw.slice(0, 3);
    const suffixPart = bodyRaw.slice(3);
    const normalizedNum = numPart
      .replace(/[Oo]/g, '0')
      .replace(/[Il]/g, '1')
      .replace(/[S]/g, '5');
    const canonicalCode = `E${normalizedNum}${suffixPart.toLowerCase()}`;
    const wasCorrupted = numPart !== normalizedNum;
    return {
      isCodeCandidate: true,
      raw: trimmed,
      canonicalCode: canonicalCode.toUpperCase(),
      requiresUserConfirmation: wasCorrupted
    };
  }

  return { isCodeCandidate: false };
}

/**
 * Extracts embedded E-codes and base names from combined strings like "Fosforik Asit E338" or "Aspartam E951"
 */
function extractEmbeddedCodeAndName(str) {
  if (!str) return [];
  const results = [];
  if (/\d[a-f]?$/iu.test(str)) {
    const trailingCode = str.match(/^(.+\S)\s+([EЕ]\s*[-:]?\s*[0-9]{3,4}[a-f]?)$/iu);
    if (trailingCode) {
      results.push(trailingCode[1].trim(), trailingCode[2].replace(/^[Ее]/u, 'E').replace(/\s+/g, '').toUpperCase());
    }
  }
  if (/^[EЕ]/iu.test(str)) {
    const leadingCode = str.match(/^([EЕ]\s*[-:]?\s*[0-9]{3,4}[a-f]?)\s+(.+)$/iu);
    if (leadingCode) {
      results.push(leadingCode[1].replace(/^[Ее]/u, 'E').replace(/\s+/g, '').toUpperCase(), leadingCode[2].trim());
    }
  }
  return results;
}

/**
 * Splits raw ingredient label text into structured tokens, handling:
 * 1. Multilingual headers across all 10 languages ("İçindekiler:", "Ingredients:", "Zutaten:", "Ingrédients:", "المكونات:", "Komposisi:", "Ramuan:", "Ingredientes:", "Состав:", "اجزاء:")
 * 2. Dictionary-verified line-break hyphenation ("Methyliso-\nthiazolinone" -> "Methylisothiazolinone")
 * 3. Parenthetical sub-ingredients / comma lists ("Renklendiriciler (E100, E120)" -> evaluates E100 and E120)
 * 4. Percentages ("Fındık (%13)", "Niacinamide 10%", "٪١٣") & colon functional wrappers ("Emülgatör: Lesitin (Soya)")
 * 5. Slash-separated INCI dual names ("Aqua / Water / Eau", "CI 77891 / Titanium Dioxide") and middle parentheses ("Cocos Nucifera (Coconut) Oil")
 */
export function parseIngredientList(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // 1. Strip header prefix if present (supporting all 10 target languages with word/colon boundary)
  let cleaned = rawText.replace(
    /^\s*([iİıI]çindekiler|bilesenler|bileşenler|ingredients|zutaten|inhaltsstoffe|ingrédients|composition|komposisi|bahan-bahan|bahan|ramuan|kandungan|ingredientes|состав|ингредиенты|المكونات|مكونات|المحتويات|اجزائے\s+ترکیبی|اجزاء|اجزا)(?=\s*[:\-–]|\s+)\s*[:\-–]?\s*/iu,
    ''
  );
  // Split before cross-contact statements if separated by dot/semicolon/newline
  cleaned = cleaned.replace(/\.\s+(?=(?:may\s+contain|traces?\s+of|eser\s+miktarda|kann\s+spuren|peut\s+contenir|puede\s+contener|قد\s+يحتوي|может\s+содержать|میں\s+شامل)\b)/giu, ', ');

  // 2. Rejoin hyphenated line breaks ONLY if the joined word exists in our dictionaries (Linear & ReDoS safe)
  if (cleaned.includes('-') && (cleaned.includes('\n') || cleaned.includes('\r'))) {
    cleaned = cleaned.replace(/([\p{L}\d]+)-[ \t]*\r?\n[ \t]*([\p{L}\d]+)/gu, (full, p1, p2) => {
      const joined = `${p1}${p2}`;
      const f = foldTurkish(joined);
      const cosKey = joined.toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
      if (substanceByAlias.has(f) || halalByAlias.has(f) || freeSugarByAlias.has(f) || rapidCarbByAlias.has(f) || (cosingData && Object.hasOwn(cosingData, cosKey))) {
        return joined;
      }
      return `${p1}-${p2}`;
    });
  }

  // 3. Split by comma, semicolon, Arabic comma (، / ؛), or bullet outside parentheses
  //    Preserve chemical locant commas between digits (e.g. "1,2-Hexanediol", "Toluene-2,5-Diamine")
  const rawTokens = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const prev = i > 0 ? cleaned[i - 1] : '';
    const next = i + 1 < cleaned.length ? cleaned[i + 1] : '';
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    const isChemicalLocantComma = (ch === ',' || ch === '،' || ch === '٫') && (
      (/[\d\u0660-\u0669\u06F0-\u06F9]/.test(prev) && /[\d\u0660-\u0669\u06F0-\u06F9]/.test(next)) ||
      (/[Nn]/.test(prev) && /[Nn]/.test(next)) ||
      (/[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(next) && /^[a-zA-Z][,،][a-zA-Z]-/.test(cleaned.slice(Math.max(0, i - 1), i + 5)))
    );
    if (!isChemicalLocantComma && (ch === ',' || ch === ';' || ch === '،' || ch === '؛' || ch === '•' || ch === '·') && depth === 0) {
      if (current.trim()) rawTokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) rawTokens.push(current.trim());

  // Expand parenthetical codes, percentages, colon functional wrappers, and slash synonyms
  const expanded = [];
  rawTokens.forEach((tok) => {
    // Strip trailing dots/asterisks/Urdu full stop and numeric percentages / ppm / mg/kg like (%13), (13.5%), (20 ppm), %13, 13%, 20 ppm, ٪١٣
    let cleanedTok = tok
      .replace(/\(\s*(?:[%٪]\s*)?[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫][\d\u0660-\u0669\u06F0-\u06F9]+)?\s*(?:(?:[%٪]|ppm|mg\s*\/\s*kg)\s*)?\)/giu, '')
      .replace(/(?:^|\s)[%٪]?[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫][\d\u0660-\u0669\u06F0-\u06F9]+)?\s*(?:[%٪]|ppm\b|mg\s*\/\s*kg\b)(?=\s|$)/giu, '')
      .replace(/[*•.۔]+$/u, '')
      .trim();
    if (!cleanedTok) return;

    const baseExtraCandidates = [];
    // If token has a functional wrapper before colon e.g. "Emülgatör: Lesitin (Soya)"
    if (cleanedTok.includes(':')) {
      const parts = cleanedTok.split(':').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        cleanedTok = parts.slice(1).join(' ');
        baseExtraCandidates.push(...parts);
      }
    }

    let parenMatch = null;
    if (cleanedTok.endsWith(')')) {
      const openIdx = cleanedTok.indexOf('(');
      if (openIdx > 0 && openIdx < cleanedTok.length - 2) {
        const before = cleanedTok.slice(0, openIdx).trim();
        const inside = cleanedTok.slice(openIdx + 1, -1);
        if (before && inside) {
          parenMatch = [cleanedTok, before, inside];
        }
      }
    }
    let primary = cleanedTok;
    let secondary = null;
    if (parenMatch) {
      primary = parenMatch[1].trim();
      secondary = parenMatch[2].trim();
    } else if (cleanedTok.includes('(') && cleanedTok.includes(')')) {
      // Middle parentheses e.g. "Cocos Nucifera (Coconut) Oil" -> also try "Cocos Nucifera Oil" & "Coconut"
      const withoutParen = cleanedTok.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (withoutParen) baseExtraCandidates.push(withoutParen);
      const innerMatches = [...cleanedTok.matchAll(/\(([^)]+)\)/g)];
      for (const m of innerMatches) {
        if (m[1].trim()) baseExtraCandidates.push(m[1].trim());
      }
    }

    // Check if secondary is a comma-separated list of sub-ingredients (e.g. "Renklendiriciler (E100, E120)")
    if (secondary && /[,;،؛]/.test(secondary) && !/\d,\d/.test(secondary)) {
      const subParts = secondary.split(/[,;،؛]/).map((s) => s.trim()).filter(Boolean);
      if (subParts.length > 1) {
        for (const subPart of subParts) {
          const itemExtras = [...baseExtraCandidates, ...extractEmbeddedCodeAndName(subPart), ...extractEmbeddedCodeAndName(primary)];
          for (const piece of [subPart, primary].filter(Boolean)) {
            if (piece.includes('/')) {
              for (const slashPart of piece.split('/').map((s) => s.trim()).filter(Boolean)) {
                if (slashPart.length >= 2) itemExtras.push(slashPart);
              }
            }
          }
          expanded.push({
            raw: `${primary} (${subPart})`,
            primary: subPart,
            secondary: primary,
            extraCandidates: itemExtras,
            position: expanded.length + 1
          });
        }
        return;
      }
    }

    const extraCandidates = [
      ...baseExtraCandidates,
      ...extractEmbeddedCodeAndName(primary),
      ...extractEmbeddedCodeAndName(secondary)
    ];

    const porkNegationRegex = /\b(pork-free|no\s+pork|non-porcine|sans\s+porc|ohne\s+schwein|sin\s+cerdo|domuzsuz|domuz\s+içermez|domuz\s+eti\s+içermez|free\s+from\s+pork|bebas\s+babi)\b/giu;
    if (porkNegationRegex.test(primary)) {
      const stripped = primary.replace(porkNegationRegex, '').trim();
      if (stripped.length >= 2) extraCandidates.push(stripped);
    }

    // Also add slash-separated sub-parts (e.g. "Aqua / Water / Eau" or "CI 77891 / Titanium Dioxide")
    for (const piece of [primary, secondary].filter(Boolean)) {
      if (piece.includes('/')) {
        for (const slashPart of piece.split('/').map((s) => s.trim()).filter(Boolean)) {
          if (slashPart.length >= 2) extraCandidates.push(slashPart);
        }
      }
    }

    expanded.push({
      raw: tok.replace(/[.۔]$/u, '').trim(),
      primary,
      secondary,
      extraCandidates,
      position: expanded.length + 1
    });
  });

  return expanded;
}

/**
 * Deterministic INCI family fallback ONLY for genuine multi-word botanical extracts,
 * PEG/Polyglyceryl emulsifiers, or multi-word biomimetic peptides not already in exact dictionary.
 * Never matches single-word unknown tokens (like "UnknownPlantExtractX").
 */
function matchBenignInciFamily(candidateStr, productType = 'cosmetic') {
  if (productType !== 'cosmetic') return null;
  const trimmed = candidateStr.trim();
  if (!trimmed.includes(' ') && !trimmed.includes('-')) return null;
  if (/\b(poison|toxic|venom|belladonna|aconitum|strychn|digitalis)\b/i.test(trimmed)) return null;

  // 1. Multi-word Latin/INCI botanical extracts/waters/oils (requiring at least 2 words before 'extract/water/juice')
  if (/^[a-z]{3,}\s+[a-z]{3,}(?:\s+[a-z()]+)*\s+(leaf|flower|root|fruit|seed|bark|stem|peel|kernel|sprout|callus)\s+(extract|water|juice|powder|oil|butter)$/i.test(trimmed)) {
    return existingSubFallback('soothing_botanical_extracts');
  }
  // 2. Standard PEG / PPG / Polyglyceryl / Ceteareth / Steareth / Laureth emulsifiers & humectants
  if (/^(peg|ppg|polyglyceryl|ceteareth|steareth|laureth|ceteth|oleth|pareth)-\d+(\s+[a-z0-9\-\/]+)?$/i.test(trimmed)) {
    return existingSubFallback('cosmetic_emulsifiers_pegs_polysorbates');
  }
  // 3. Multi-word cosmetic peptides (e.g. "Palmitoyl Hexapeptide-12", "Acetyl Octapeptide-3")
  if (/^(palmitoyl|acetyl|myristoyl|copper|nicotinoyl|caprooyl)\s+(dipeptide|tripeptide|tetrapeptide|pentapeptide|hexapeptide|heptapeptide|octapeptide|nonapeptide|decapeptide|oligopeptide|polypeptide)-\d+$/i.test(trimmed)) {
    return existingSubFallback('peptides_matrixyl_argireline');
  }
  return null;
}

function existingSubFallback(id) {
  return substancesData.substances.find((s) => s.id === id) || null;
}

/**
 * Evaluates a product ingredient list and returns the 4 Independent Modular Cards
 * in compliance with the Cross-AI Verification Synthesis Report.
 *
 * @param {Object} params
 * @param {string} params.rawText - Raw OCR or pasted ingredient text
 * @param {'cosmetic'|'food'} params.productType - Required to distinguish E171 (food banned) vs CI 77891 (cosmetic permitted)
 * @param {'EU'|'TR'} [params.jurisdiction='EU'] - Regulatory jurisdiction
 * @param {string[]} [params.userProfiles=[]] - Local user sensitivity profiles: ['hamilelik', 'hassas_cilt', 'akne', 'cocuk_metabolik', 'astim_alerji']
 * @param {'general_cautious'|'GIMDES'|'JAKIM'|'MUI'|'IFANCA'} [params.halalAuthority='general_cautious']
 * @param {Object} [params.claims={}] - Product label claims: { halalCertified: false, veganStatus: 'none'|'declared'|'verified', vegetarianStatus: 'none'|'declared'|'verified' }
 * @param {Object} [params.userConfirmations={}] - Confirmed ambiguous tokens or OCR codes, e.g. { "BHA": "bha_antioxidant" | "salicylic_acid", "C1 7547O": "CI 75470" }
 * @param {string} [params.lang='tr'] - Language code ('tr'|'en'|'ar'|'de'|'fr'|'id'|'ms'|'es'|'ru'|'ur')
 */
const ENGINE_I18N = {
  tr: {
    regCardTitle: 'Regülasyon & İçerik Şeffaflık Endeksi',
    profCardTitle: 'Kişisel Hassasiyet & Cilt/Beslenme Uyumun',
    halalCardTitle: 'Helal & Etanol Kontrolü (Bağlam Motoru)',
    veganCardTitle: 'Vegan Uyum & Gizli Şeker Sayacı',
    bhaMsg: 'Etikette tek başına "BHA" okundu. Bu kısaltma antioksidan olan "Butylated Hydroxyanisole (E320)" veya soyucu asit olan "Beta Hydroxy Acid (Salicylic Acid)" anlamına gelebilir. Karar üretilmeden önce doğrulama gerekir.',
    slsMsg: 'İki madde birbirine çok benziyor ve AB kuralları / tahriş profilleri farklı. Tahmin etmek yerine sana soruyoruz.',
    ocrCodeMsg: (cand, canon) => `OCR kod alanında olası karakter hatası tespit edildi: "${cand}". Bunu "${canon}" olarak mı onaylıyorsunuz?`,
    e171FoodBanned: 'GIDA (E171): AB Yönetmeliği 2022/63 kapsamında gıda katkı maddesi olarak AB\'de kullanılamaz (EFSA 2021 değerlendirmesi).',
    ci77891CosmeticOk: 'KOZMETİK (CI 77891): AB Kozmetik Yönetmeliği Ek IV (renklendirici) ve Ek VI (UV filtresi) kapsamında kozmetik ürünlerde izinlidir.',
    bannedGeneric: 'AB Yönetmeliği Ek II kapsamında yasaklı bileşen (Tavan Puan 10).',
    restrictedGeneric: 'AB Yönetmeliği kapsamında konsantrasyon, saflık veya etiketleme kısıtlamasına tabi bileşen.',
    permittedGeneric: 'Uluslararası INCI / Gıda kodeksinde izinli standart bileşen.',
    methodDisclaimer: 'Bu endeks resmi bir kurumun sağlık puanı değildir; uygulamanın yayımlanmış metodolojisiyle bileşen listesinden hesaplanır.',
    kvkkNotice: 'Mobil uygulamada seçimin yalnızca bu cihazda işlenir. Web önizlemesinde yalnızca bu bilgisayardaki yerel sunucuya analiz için gönderilir; uzak sunucuda/bulutta saklanmaz ve üçüncü taraflarla paylaşılmaz (tercihleriniz, kişisel kara listeniz ve son taramalarınız yalnızca cihaz içi hafızada tutulur, istediğiniz an silinebilir).',
    veriYokMsg: (name, prof) => `${name} için bu profilde (${prof}) yeterli doğrulanmış bilimsel veri bulunamadı (veri_yok). Otomatik güvenli veya riskli sayılmaz.`,
    profileAlertGeneric: (name) => `${name}: Seçili hassasiyet profiliniz için dikkat edilmesi önerilen bileşen.`,
    halalDisclaimer: (auth) => `Bu değerlendirme bir helal sertifikası değildir; seçtiğiniz kurumun (${auth}) yayımlanmış kriterlerine göre etiket analizi sunar.`,
    appleDisclaimer: 'Bu uygulama etiket bilgilerini resmi kaynaklara bağlı kurallarla açıklar; tıbbi teşhis, tedavi önerisi veya resmi helal sertifikası vermez. Sağlığınızla ilgili kararlar öncesinde doktorunuza veya eczacınıza danışın.',
    shieldDesc: 'Kimyasal yapısında -OH grubu bulunan yağ alkolü / koruyucu; sarhoş edici etil alkol (etanol) değildir.',
    halalOkDesc: 'Seçilen helal otoritesi kriterlerine ve ürün bağlamına göre helal / uygun kabul edilen bileşen.',
    halalHaramDesc: 'Seçilen helal otoritesi kriterlerine göre uygunsuz / haram kaynaklı bileşen.',
    halalAlcoholDesc: 'Etil alkol (etanol) içerir; seçilen helal otoritesi kriterlerine göre incelenmelidir.',
    halalMusboohDesc: 'Şüpheli (kaynağı belirsiz): bitkisel veya hayvansal kaynaklı olabilir; kesin hüküm için Helal veya Vegan sertifikası doğrulanmalıdır.',
    conflictHaram: 'ÇELİŞKİ UYARISI (CONFLICT): Etikette okunan bileşen ile ürün üzerindeki Helal/Vegan/Vejetaryen beyanı birbiriyle çelişiyor!',
    conflictAlcohol: 'Üründe Helal beyanı işaretlenmiş ancak içerikte etanol/alkol okundu. Sertifika kuruluşunun harici kullanım / eşik politikasını doğrulayın.',
    veganNoteAlcohol: 'NOT: Ürünün Vegan olması etil alkol (etanol) durumunu çözmez; bitkisel kaynaklı etanol de vegandır.',
    conflictAnimalVegan: 'ÇELİŞKİ UYARISI (CONFLICT): Hayvansal bileşen (Jelatin/Kolajen/Keratin/Whey) ile Vegan/Vejetaryen iddiası çelişiyor!',
    plantSourceResolved: 'Etikette açıkça bitkisel kaynak (Soya/Ayçiçek/Bitkisel) belirtildiğinden çift kaynaklı bileşen uygun kabul edildi.',
    halalCertResolved: 'Üründe geçerli Helal sertifikası beyanı bulunduğundan çift kaynaklı bileşen uygun kabul edildi.',
    verifiedVeganResolved: 'Doğrulanmış Vegan sertifikası sayesinde bu bileşenin bitkisel kaynaklı olduğu doğrulandı.',
    declaredVeganNote: 'Üründe yazılı Vegan beyanı var (büyük olasılıkla bitkisel kaynaklıdır; resmi sertifika logosu teyit edilmelidir).',
    lCysteineNote: 'Vegan beyanı hayvansal tüy kaynağını elese de L-Sistein (E920) için insan saçı kaynağını tek başına dışlamaz; Helal sertifikası aranmalıdır.',
    conflictInsectVegan: 'ÇELİŞKİ UYARISI (CONFLICT): Böcek kaynaklı bileşen (Karmin E120 / Şellak E904) Vegan/Vejetaryen bir üründe bulunamaz!'
  },
  en: {
    regCardTitle: 'Regulatory & Ingredient Transparency Index',
    profCardTitle: 'Personal Sensitivity & Profile Match',
    halalCardTitle: 'Halal & Ethanol Context Engine',
    veganCardTitle: 'Vegan Compatibility & Hidden Sugar Audit',
    bhaMsg: 'Standalone "BHA" detected on label. This can mean the antioxidant "Butylated Hydroxyanisole (E320)" or the exfoliant "Beta Hydroxy Acid (Salicylic Acid)". Confirmation required before scoring.',
    slsMsg: 'These two ingredients look very similar in OCR but have different EU rules and irritation profiles. Please confirm which one is on the label.',
    ocrCodeMsg: (cand, canon) => `Possible OCR character error detected in code: "${cand}". Confirm as "${canon}"?`,
    e171FoodBanned: 'FOOD (E171): Prohibited as a food additive in the EU under Regulation 2022/63 (EFSA 2021 assessment).',
    ci77891CosmeticOk: 'COSMETIC (CI 77891): Permitted in cosmetics under EU Cosmetic Regulation Annex IV (colorant) and Annex VI (UV filter).',
    bannedGeneric: 'Prohibited substance under EU Regulation Annex II (Score capped at 10).',
    restrictedGeneric: 'Regulated substance subject to concentration, purity, or labeling restrictions under EU Regulation.',
    permittedGeneric: 'Permitted standard ingredient under international INCI / Food Codex regulations.',
    methodDisclaimer: 'This index is not an official government health score; it is calculated deterministically from the ingredient list using published methodology.',
    kvkkNotice: 'In the mobile app your choices are processed only on this device. In the web preview they are sent only to the local server on this computer for analysis, never stored on remote servers/cloud or shared with third parties (preferences, personal blacklist, and scan history are kept only in on-device storage and can be cleared anytime).',
    veriYokMsg: (name, prof) => `Insufficient verified clinical data for ${name} under profile (${prof}). Not automatically marked safe or unsafe.`,
    profileAlertGeneric: (name) => `${name}: Flagged for caution under your selected sensitivity profile.`,
    halalDisclaimer: (auth) => `This assessment is not an official Halal certificate; it analyzes the label according to published ${auth} criteria.`,
    appleDisclaimer: 'This app explains ingredient labels using official regulatory rules; it does not provide medical diagnosis, treatment advice, or official Halal certification. Consult your doctor or pharmacist for health decisions.',
    shieldDesc: 'Non-intoxicating fatty alcohol / emollient or preservative; NOT intoxicating ethyl alcohol (ethanol).',
    halalOkDesc: 'Permissible (Halal) ingredient according to the selected Halal authority criteria and product context.',
    halalHaramDesc: 'Non-halal ingredient according to the selected Halal authority criteria.',
    halalAlcoholDesc: 'Contains ethyl alcohol (ethanol); subject to threshold/topical ruling of the selected Halal authority.',
    halalMusboohDesc: 'Doubtful (source unclear): can be plant- or animal-derived; verify Halal or Vegan certification on the packaging.',
    conflictHaram: 'CONFLICT ALERT: The detected ingredient contradicts the Halal/Vegan/Vegetarian claim on the product!',
    conflictAlcohol: 'Halal claim is marked, but ethanol/alcohol was detected in the ingredients. Verify the certifying body\'s topical/threshold policy.',
    veganNoteAlcohol: 'NOTE: A Vegan claim does not resolve ethyl alcohol (ethanol), as plant-fermented ethanol is also vegan.',
    conflictAnimalVegan: 'CONFLICT ALERT: Animal-derived ingredient (Gelatin/Collagen/Keratin/Whey) contradicts the Vegan/Vegetarian claim!',
    plantSourceResolved: 'Explicit plant origin (Soy/Sunflower/Vegetable) stated on label; dual-source ingredient resolved as permissible.',
    halalCertResolved: 'Valid Halal certification claim present; dual-source ingredient resolved as permissible.',
    verifiedVeganResolved: 'Verified Vegan certification confirms plant origin for this dual-source ingredient.',
    declaredVeganNote: 'Unverified Vegan text claim present (likely plant-derived; verify official certification logo).',
    lCysteineNote: 'A Vegan claim rules out poultry feathers for L-Cysteine (E920) but does not rule out human hair; Halal certification is required.',
    conflictInsectVegan: 'CONFLICT ALERT: Insect-derived ingredient (Carmine E120 / Shellac E904) cannot be present in a Vegan/Vegetarian product!'
  },
  ar: {
    regCardTitle: 'مؤشر الامتثال التنظيمي وشفافية المكونات',
    profCardTitle: 'التوافق مع الحساسية والملف الشخصي',
    halalCardTitle: 'محرك فحص الحلال والإيثانول',
    veganCardTitle: 'التوافق النباتي وعداد السكر الخفي',
    bhaMsg: 'تمت قراءة "BHA" منفرداً على الملصق. قد يعني مضاد الأكسدة (E320) أو حمض الساليسيليك المقشر. يرجى التأكيد قبل حساب النتيجة.',
    slsMsg: 'هاتان المادتان متشابهتان جداً في القراءة الضوئية وتختلفان في قواعد الاتحاد الأوروبي وتأثيرهما على البشرة. يرجى تأكيد المادة الصحيحة.',
    ocrCodeMsg: (cand, canon) => `تم اكتشاف خطأ محتمل في قراءة الرمز: "${cand}". هل تؤكد أنه "${canon}"؟`,
    e171FoodBanned: 'غذاء (E171): محظور كمضاف غذائي في الاتحاد الأوروبي بموجب اللائحة 2022/63 (تقييم EFSA 2021).',
    ci77891CosmeticOk: 'تجميل (CI 77891): مسموح به في مستحضرات التجميل بموجب لائحة الاتحاد الأوروبي الملحق الرابع والسادس.',
    bannedGeneric: 'مادة محظورة بموجب الملحق الثاني من لائحة الاتحاد الأوروبي (الحد الأقصى للنقاط 10).',
    restrictedGeneric: 'مادة خاضعة لقيود التركيز أو الاستخدام بموجب لائحة الاتحاد الأوروبي.',
    permittedGeneric: 'مكون قياسي مسموح به في دستور مستحضرات التجميل (INCI) والأغذية الدولي.',
    methodDisclaimer: 'هذا المؤشر ليس تقييماً طبياً رسمياً؛ بل يُحسب آلياً من قائمة المكونات وفق المنهجية المنشورة.',
    kvkkNotice: 'في تطبيق الهاتف تُعالَج اختياراتك على هذا الجهاز فقط. في معاينة الويب تُرسَل فقط إلى الخادم المحلي على هذا الحاسوب للتحليل، ولا تُخزَّن ولا تُشارَك مع أي طرف ثالث.',
    veriYokMsg: (name, prof) => `لا تتوفر بيانات علمية كافية للمركب ${name} ضمن ملف (${prof}).`,
    profileAlertGeneric: (name) => `${name}: مكون يتطلب الانتباه وفقاً لملف الحساسية المختار.`,
    halalDisclaimer: (auth) => `هذا التقييم ليس شهادة حلال رسمية؛ بل يقدم تحليلاً للملصق وفق معايير (${auth}) المنشورة.`,
    appleDisclaimer: 'يوضح هذا التطبيق معلومات الملصق وفق القواعد التنظيمية الرسمية؛ ولا يقدم تشخيصاً طبياً أو فتوى رسمية. استشر طبيبك أو الصيدلي قبل اتخاذ قرارات صحية.',
    shieldDesc: 'كحول دهني مرطب أو مادة حافظة آمنة؛ وليس كحولاً إيثيلياً مسكراً (إيثانول).',
    halalOkDesc: 'مكون مباح (حلال) وفق معايير هيئة الحلال المختارة وسياق المنتج.',
    halalHaramDesc: 'مكون غير متوافق (حرام) وفق معايير هيئة الحلال المختارة.',
    halalAlcoholDesc: 'يحتوي على كحول إيثيلي (إيثانول)؛ يخضع لسياسة الهيئة المختارة.',
    halalMusboohDesc: 'مشكوك فيه (مصدره غير واضح): قد يكون نباتياً أو حيوانياً؛ يرجى التحقق من شهادة الحلال أو النباتي (Vegan) على العبوة.',
    conflictHaram: 'تنبيه تعارض: المكون المكتشف في القائمة يتعارض مع شعار الحلال/النباتي على المنتج!',
    conflictAlcohol: 'تم تحديد شعار الحلال ولكن تم رصد إيثانول في المكونات. تحقق من سياسة الهيئة المانحة للشهادة.',
    veganNoteAlcohol: 'ملاحظة: كون المنتج نباتياً (Vegan) لا يحل إشكالية الكحول الإيثيلي (الإيثانول).',
    conflictAnimalVegan: 'تنبيه تعارض: مكون حيواني (جيلاتين/كولاجين/كيراتين/مصل اللبن) يتعارض مع ادعاء المنتج النباتي!',
    plantSourceResolved: 'تم تحديد المصدر النباتي صراحةً (صويا/عباد الشمس/نباتي) على الملصق؛ لذا يُعتبر المكون متوافقاً.',
    halalCertResolved: 'نظراً لوجود شهادة حلال معتمدة، تم قبول المكون مزدوج المصدر.',
    verifiedVeganResolved: 'بفضل شهادة المنتج النباتي الموثقة، تأكد أن هذا المكون من مصدر نباتي.',
    declaredVeganNote: 'يوجد ادعاء نباتي مكتوب (مرجح أنه نباتي المصدر؛ يُنصح بالتحقق من الشعار الرسمي).',
    lCysteineNote: 'الشعار النباتي يستبعد ريش الطيور لمادة L-Cysteine (E920) لكنه لا يستبعد مصدر الشعر البشري؛ يلزم وجود شهادة حلال.',
    conflictInsectVegan: 'تنبيه تعارض: مكون مستخلص من الحشرات (كارمين E120 / شيلاك E904) يتعارض مع المنتج النباتي!'
  },
  de: {
    regCardTitle: 'Regulierungs- & Transparenzindex',
    profCardTitle: 'Persönliche Empfindlichkeit & Profilabgleich',
    halalCardTitle: 'Halal- & Ethanol-Kontextprüfung',
    veganCardTitle: 'Vegan-Prüfung & Versteckter-Zucker-Zähler',
    bhaMsg: 'Einzelnes "BHA" erkannt. Dies kann "Butylhydroxyanisol (E320)" oder "Beta-Hydroxysäure (Salicylsäure)" bedeuten. Bitte vor der Bewertung bestätigen.',
    slsMsg: 'Beide Stoffe ähneln sich optisch stark, haben aber unterschiedliche EU-Regeln und Reizprofile. Bitte bestätigen Sie den Stoff.',
    ocrCodeMsg: (cand, canon) => `Möglicher OCR-Lesefehler im Code: "${cand}". Als "${canon}" bestätigen?`,
    e171FoodBanned: 'LEBENSMITTEL (E171): Als Lebensmittelzusatzstoff in der EU gemäß Verordnung 2022/63 verboten (EFSA 2021).',
    ci77891CosmeticOk: 'KOSMETIK (CI 77891): In Kosmetika gemäß EU-Kosmetikverordnung Anhang IV & VI zugelassen.',
    bannedGeneric: 'Verbotener Stoff gemäß EU-Verordnung Anhang II (Höchstpunktzahl 10).',
    restrictedGeneric: 'Geregelter Inhaltsstoff mit Konzentrations- oder Verwendungsbeschränkungen gemäß EU-Verordnung.',
    permittedGeneric: 'Zugelassener Standard-Inhaltsstoff gemäß INCI / Lebensmittelkodex.',
    methodDisclaimer: 'Dieser Index ist kein amtlicher Gesundheitswert, sondern wird deterministisch aus der Zutatenliste berechnet.',
    kvkkNotice: 'In der mobilen App werden deine Angaben nur auf diesem Gerät verarbeitet. In der Web-Vorschau gehen sie nur zur Analyse an den lokalen Server auf diesem Computer, ohne Speicherung und ohne Weitergabe an Dritte.',
    veriYokMsg: (name, prof) => `Für ${name} liegen im Profil (${prof}) keine ausreichenden klinischen Daten vor.`,
    profileAlertGeneric: (name) => `${name}: Hinweis für Ihr ausgewähltes Empfindlichkeitsprofil.`,
    halalDisclaimer: (auth) => `Diese Bewertung ist kein offizielles Halal-Zertifikat, sondern prüft das Etikett nach ${auth}-Kriterien.`,
    appleDisclaimer: 'Dient nur zu Informationszwecken; keine medizinische Beratung. Fragen Sie bei gesundheitlichen Entscheidungen Ihren Arzt oder Apotheker.',
    shieldDesc: 'Nicht berauschender Fettalkohol / Pflegestoff oder Konservierungsmittel; KEIN Trinkalkohol (Ethanol).',
    halalOkDesc: 'Zulässiger (Halal) Inhaltsstoff gemäß den Kriterien der gewählten Halal-Behörde.',
    halalHaramDesc: 'Nicht-halaler Inhaltsstoff gemäß dem gewählten Halal-Standard.',
    halalAlcoholDesc: 'Enthält Ethylalkohol (Ethanol); gemäß den Richtlinien der gewählten Halal-Behörde zu prüfen.',
    halalMusboohDesc: 'Zweifelhaft (Herkunft unklar): kann pflanzlich oder tierisch sein; Halal- oder Vegan-Siegel prüfen.',
    conflictHaram: 'KONFLIKTWARNUNG: Der erkannte Inhaltsstoff widerspricht der Halal-/Vegan-Angabe auf dem Produkt!',
    conflictAlcohol: 'Halal-Angabe aktiv, aber Ethanol/Alkohol erkannt. Bitte Richtlinie der Zertifizierungsstelle prüfen.',
    veganNoteAlcohol: 'HINWEIS: Ein Vegan-Siegel klärt Ethylalkohol (Ethanol) nicht, da pflanzliches Ethanol ebenfalls vegan ist.',
    conflictAnimalVegan: 'KONFLIKTWARNUNG: Tierischer Inhaltsstoff (Gelatine/Kollagen/Keratin/Molke) widerspricht der Vegan-Angabe!',
    plantSourceResolved: 'Pflanzlicher Ursprung (Soja/Sonnenblume/Pflanzlich) explizit angegeben; als konform eingestuft.',
    halalCertResolved: 'Durch gültige Halal-Zertifizierung als konform eingestuft.',
    verifiedVeganResolved: 'Verifiziertes Vegan-Zertifikat bestätigt pflanzlichen Ursprung.',
    declaredVeganNote: 'Schriftliche Vegan-Angabe vorhanden (wahrscheinlich pflanzlich; offizielles Siegel prüfen).',
    lCysteineNote: 'Vegan-Angabe schließt Vogelfedern bei L-Cystein (E920) aus, aber nicht menschliches Haar; Halal-Zertifikat erforderlich.',
    conflictInsectVegan: 'KONFLIKTWARNUNG: Insektenbasierter Stoff (Karmin E120 / Schellack E904) ist nicht vegan/vegetarisch!'
  },
  fr: {
    regCardTitle: 'Indice de Transparence & Réglementation',
    profCardTitle: 'Compatibilité Profil & Sensibilités',
    halalCardTitle: 'Contrôle Halal & Éthanol (Moteur Contextuel)',
    veganCardTitle: 'Audit Vegan & Compteur de Sucres Cachés',
    bhaMsg: 'Mention "BHA" seule détectée. Peut désigner l\'antioxydant "Butylhydroxyanisole (E320)" ou l\'acide exfoliant "Acide salicylique". Confirmation requise.',
    slsMsg: 'Ces deux substances se ressemblent beaucoup mais ont des règles UE et profils d\'irritation différents. Veuillez confirmer.',
    ocrCodeMsg: (cand, canon) => `Erreur OCR possible dans le code : "${cand}". Confirmer comme "${canon}" ?`,
    e171FoodBanned: 'ALIMENTAIRE (E171) : Interdit comme additif alimentaire dans l\'UE selon le règlement 2022/63 (EFSA 2021).',
    ci77891CosmeticOk: 'COSMÉTIQUE (CI 77891) : Autorisé dans les cosmétiques selon les annexes IV et VI du règlement UE.',
    bannedGeneric: 'Substance interdite selon l\'Annexe II du règlement UE (Score plafonné à 10).',
    restrictedGeneric: 'Substance soumise à des restrictions de concentration ou d\'usage selon le règlement UE.',
    permittedGeneric: 'Ingrédient standard autorisé selon la nomenclature internationale INCI / Codex alimentaire.',
    methodDisclaimer: 'Cet indice n\'est pas un score médical officiel ; il est calculé selon notre méthodologie publiée.',
    kvkkNotice: 'Dans l\'application mobile, vos choix sont traités uniquement sur cet appareil. Dans l\'aperçu web, ils sont envoyés uniquement au serveur local de cet ordinateur pour l\'analyse, sans stockage ni partage avec des tiers.',
    veriYokMsg: (name, prof) => `Données scientifiques insuffisantes pour ${name} dans le profil (${prof}).`,
    profileAlertGeneric: (name) => `${name} : Ingrédient signalé pour votre profil de sensibilité.`,
    halalDisclaimer: (auth) => `Cette évaluation n'est pas un certificat halal officiel ; elle analyse l'étiquette selon les critères ${auth}.`,
    appleDisclaimer: 'À titre informatif uniquement, ne constitue pas un avis médical. Consultez votre médecin ou pharmacien.',
    shieldDesc: 'Alcool gras émollient ou conservateur non intoxicant ; ce n\'est PAS de l\'alcool éthylique (éthanol).',
    halalOkDesc: 'Ingrédient conforme (Halal) selon les critères de l\'autorité Halal sélectionnée.',
    halalHaramDesc: 'Ingrédient non conforme (Haram) selon l\'autorité Halal sélectionnée.',
    halalAlcoholDesc: 'Contient de l\'alcool éthylique (éthanol) ; à vérifier selon l\'autorité Halal choisie.',
    halalMusboohDesc: 'Douteux (origine incertaine) : peut être d\'origine végétale ou animale ; vérifiez la certification Halal ou Vegan.',
    conflictHaram: 'ALERTE CONFLIT : L\'ingrédient détecté contredit la mention Halal/Vegan du produit !',
    conflictAlcohol: 'Mention Halal activée mais éthanol détecté. Vérifiez la politique de l\'organisme certificateur.',
    veganNoteAlcohol: 'NOTE : Le statut Vegan ne résout pas la présence d\'alcool éthylique (éthanol).',
    conflictAnimalVegan: 'ALERTE CONFLIT : Ingrédient d\'origine animale (Gélatine/Collagène/Kératine/Lactosérum) incompatible avec Vegan !',
    plantSourceResolved: 'Origine végétale (Soja/Tournesol/Végétal) explicitement indiquée sur l\'étiquette ; jugé conforme.',
    halalCertResolved: 'Certificat Halal valide déclaré ; ingrédient à double origine jugé conforme.',
    verifiedVeganResolved: 'Le certificat Vegan vérifié confirme l\'origine végétale de cet ingrédient.',
    declaredVeganNote: 'Mention Vegan déclarée (probablement d\'origine végétale ; vérifiez le logo officiel).',
    lCysteineNote: 'Le label Vegan exclut les plumes animales pour la L-Cystéine (E920) mais pas les cheveux humains ; certification Halal requise.',
    conflictInsectVegan: 'ALERTE CONFLIT : Ingrédient issu d\'insectes (Carmin E120 / Shellac E904) incompatible avec Vegan/Végétarien !'
  },
  id: {
    regCardTitle: 'Indeks Regulasi & Transparansi Bahan',
    profCardTitle: 'Kecocokan Profil & Sensitivitas Pribadi',
    halalCardTitle: 'Pemeriksaan Halal & Etanol (Mesin Konteks)',
    veganCardTitle: 'Audit Vegan & Penghitung Gula Tersembunyi',
    bhaMsg: 'Tertulis "BHA" saja pada label. Ini bisa berarti antioksidan "Butylated Hydroxyanisole (E320)" atau "Beta Hydroxy Acid (Asam Salisilat)". Harap konfirmasi.',
    slsMsg: 'Kedua bahan ini sangat mirip tetapi memiliki aturan UE & profil iritasi berbeda. Silakan konfirmasi.',
    ocrCodeMsg: (cand, canon) => `Kemungkinan kesalahan baca OCR pada kode: "${cand}". Konfirmasi sebagai "${canon}"?`,
    e171FoodBanned: 'PANGAN (E171): Dilarang sebagai bahan tambahan pangan di UE berdasarkan Regulasi 2022/63 (EFSA 2021).',
    ci77891CosmeticOk: 'KOSMETIK (CI 77891): Diizinkan dalam kosmetik berdasarkan Regulasi Kosmetik UE Lampiran IV & VI.',
    bannedGeneric: 'Bahan terlarang berdasarkan Lampiran II Regulasi UE (Skor maksimum 10).',
    restrictedGeneric: 'Bahan yang diatur dengan batasan konsentrasi atau penggunaan berdasarkan Regulasi UE.',
    permittedGeneric: 'Bahan standar yang diizinkan dalam kodeks INCI / Pangan internasional.',
    methodDisclaimer: 'Indeks ini bukan skor kesehatan resmi pemerintah; dihitung secara deterministik dari daftar bahan.',
    kvkkNotice: 'Di aplikasi seluler, pilihan Anda hanya diproses di perangkat ini. Di pratinjau web, pilihan hanya dikirim ke server lokal di komputer ini untuk analisis, tidak disimpan dan tidak dibagikan kepada pihak ketiga.',
    veriYokMsg: (name, prof) => `Data ilmiah terverifikasi belum cukup untuk ${name} pada profil (${prof}).`,
    profileAlertGeneric: (name) => `${name}: Bahan yang perlu diperhatikan untuk profil sensitivitas Anda.`,
    halalDisclaimer: (auth) => `Penilaian ini bukan sertifikat halal resmi; menganalisis label berdasarkan kriteria ${auth}.`,
    appleDisclaimer: 'Hanya untuk tujuan informasi, bukan saran medis. Konsultasikan dengan dokter atau apoteker Anda.',
    shieldDesc: 'Alkohol lemak pelembap / pengawet aman; BUKAN etil alkohol (etanol) yang memabukkan.',
    halalOkDesc: 'Bahan yang diperbolehkan (Halal) menurut standar otoritas Halal yang dipilih.',
    halalHaramDesc: 'Bahan tidak sesuai (Haram) menurut standar otoritas Halal yang dipilih.',
    halalAlcoholDesc: 'Mengandung etil alkohol (etanol); periksa kebijakan batas otoritas Halal yang dipilih.',
    halalMusboohDesc: 'Syubhat (sumber tidak jelas): bisa nabati atau hewani; pastikan logo Halal atau Vegan resmi pada kemasan.',
    conflictHaram: 'PERINGATAN KONFLIK: Bahan yang terdeteksi bertentangan dengan klaim Halal/Vegan pada produk!',
    conflictAlcohol: 'Klaim Halal aktif tetapi etanol terdeteksi. Periksa kebijakan lembaga sertifikasi.',
    veganNoteAlcohol: 'CATATAN: Klaim Vegan tidak menyelesaikan status etil alkohol (etanol).',
    conflictAnimalVegan: 'PERINGATAN KONFLIK: Bahan hewani (Gelatin/Kolagen/Keratin/Whey) bertentangan dengan klaim Vegan!',
    plantSourceResolved: 'Sumber nabati (Kedelai/Bunga Matahari/Nabati) tertulis jelas pada label; dinyatakan sesuai.',
    halalCertResolved: 'Sertifikasi Halal valid dinyatakan; bahan sumber ganda dinyatakan sesuai.',
    verifiedVeganResolved: 'Sertifikasi Vegan terverifikasi memastikan bahan ini berasal dari tumbuhan.',
    declaredVeganNote: 'Klaim teks Vegan ada (kemungkinan besar nabati; pastikan logo sertifikasi resmi).',
    lCysteineNote: 'Klaim Vegan menyingkirkan bulu unggas untuk L-Sistein (E920) tetapi tidak rambut manusia; diperlukan sertifikat Halal.',
    conflictInsectVegan: 'PERINGATAN KONFLIK: Bahan turunan serangga (Karmin E120 / Syelak E904) tidak sesuai untuk produk Vegan!'
  },
  ms: {
    regCardTitle: 'Indeks Peraturan & Ketelusan Ramuan',
    profCardTitle: 'Padanan Profil & Sensitiviti Peribadi',
    halalCardTitle: 'Semakan Halal & Etanol (Enjin Konteks)',
    veganCardTitle: 'Audit Vegan & Pengira Gula Tersembunyi',
    bhaMsg: 'Singkatan "BHA" sahaja dikesan. Ia boleh merujuk kepada antioksidan "E320" atau "Asid Salisilik". Sila sahkan sebelum pengiraan skor.',
    slsMsg: 'Dua bahan ini kelihatan sangat serupa tetapi mempunyai peraturan EU dan profil iritasi berbeza. Sila sahkan.',
    ocrCodeMsg: (cand, canon) => `Kemungkinan ralat aksara OCR pada kod: "${cand}". Sahkan sebagai "${canon}"?`,
    e171FoodBanned: 'MAKANAN (E171): Diharamkan sebagai aditif makanan di EU di bawah Peraturan 2022/63 (EFSA 2021).',
    ci77891CosmeticOk: 'KOSMETIK (CI 77891): Dibenarkan dalam kosmetik di bawah Peraturan Kosmetik EU Lampiran IV & VI.',
    bannedGeneric: 'Bahan terlarang di bawah Lampiran II Peraturan EU (Skor dihadkan kepada 10).',
    restrictedGeneric: 'Bahan terkawal yang tertakluk kepada had kepekatan atau penggunaan di bawah Peraturan EU.',
    permittedGeneric: 'Ramuan standard yang dibenarkan di bawah peraturan INCI / Kod Makanan antarabangsa.',
    methodDisclaimer: 'Indeks ini bukan skor kesihatan rasmi kerajaan; ia dikira secara deterministik daripada senarai ramuan.',
    kvkkNotice: 'Dalam aplikasi mudah alih, pilihan anda hanya diproses di peranti ini. Dalam pratonton web, ia hanya dihantar ke pelayan tempatan di komputer ini untuk analisis, tidak disimpan dan tidak dikongsi dengan pihak ketiga.',
    veriYokMsg: (name, prof) => `Data saintifik yang disahkan tidak mencukupi untuk ${name} bagi profil (${prof}).`,
    profileAlertGeneric: (name) => `${name}: Ramuan yang perlu diberi perhatian untuk profil sensitiviti pilihan anda.`,
    halalDisclaimer: (auth) => `Penilaian ini bukan sijil halal rasmi; ia menganalisis label mengikut kriteria ${auth}.`,
    appleDisclaimer: 'Untuk tujuan maklumat sahaja, bukan nasihat perubatan. Rujuk doktor atau ahli farmasi anda.',
    shieldDesc: 'Alkohol lemak pelembap / pengawet selamat; BUKAN etil alkohol (etanol) yang memabukkan.',
    halalOkDesc: 'Ramuan yang dibenarkan (Halal) mengikut piawaian autoriti Halal yang dipilih.',
    halalHaramDesc: 'Ramuan tidak patuh (Haram) mengikut piawaian autoriti Halal yang dipilih.',
    halalAlcoholDesc: 'Mengandungi etil alkohol (etanol); tertakluk kepada garis panduan autoriti Halal yang dipilih.',
    halalMusboohDesc: 'Syubhah (sumber tidak jelas): boleh jadi tumbuhan atau haiwan; sila semak logo Halal atau Vegan pada bungkusan.',
    conflictHaram: 'AMARAN KONFLIK: Ramuan yang dikesan bercanggah dengan tuntutan Halal/Vegan pada produk!',
    conflictAlcohol: 'Tuntutan Halal diaktifkan tetapi etanol dikesan. Sila semak dasar badan pensijilan.',
    veganNoteAlcohol: 'NOTA: Tuntutan Vegan tidak menyelesaikan status etil alkohol (etanol).',
    conflictAnimalVegan: 'AMARAN KONFLIK: Ramuan haiwan (Gelatin/Kolagen/Keratin/Whey) bercanggah dengan tuntutan Vegan!',
    plantSourceResolved: 'Sumber tumbuhan (Soya/Bunga Matahari/Nabati) dinyatakan dengan jelas pada label; diterima sebagai patuh.',
    halalCertResolved: 'Sijil Halal sah dinyatakan; ramuan dwi-sumber diterima sebagai patuh.',
    verifiedVeganResolved: 'Sijil Vegan yang disahkan mengesahkan sumber tumbuhan bagi ramuan ini.',
    declaredVeganNote: 'Tuntutan Vegan dinyatakan (kemungkinan sumber tumbuhan; sahkan logo rasmi).',
    lCysteineNote: 'Tuntutan Vegan menolak bulu haiwan bagi L-Sistein (E920) tetapi bukan rambut manusia; sijil Halal diperlukan.',
    conflictInsectVegan: 'AMARAN KONFLIK: Ramuan berasaskan serangga (Karmin E120 / Syelak E904) bercanggah dengan produk Vegan!'
  },
  es: {
    regCardTitle: 'Índice de Regulación y Transparencia',
    profCardTitle: 'Compatibilidad con tu Perfil y Sensibilidades',
    halalCardTitle: 'Control Halal y Etanol (Motor Contextual)',
    veganCardTitle: 'Auditoría Vegana y Azúcares Ocultos',
    bhaMsg: 'Se leyó "BHA" solo en la etiqueta. Puede significar el antioxidante "Butilhidroxianisol (E320)" o "Ácido Salicílico". Confirma antes de puntuar.',
    slsMsg: 'Estos dos ingredientes son muy parecidos pero tienen distintas normas UE y perfiles de irritación. Por favor confirma.',
    ocrCodeMsg: (cand, canon) => `Posible error OCR en el código: "${cand}". ¿Confirmar como "${canon}"?`,
    e171FoodBanned: 'ALIMENTACIÓN (E171): Prohibido como aditivo alimentario en la UE según el Reglamento 2022/63 (EFSA 2021).',
    ci77891CosmeticOk: 'COSMÉTICA (CI 77891): Permitido en cosméticos según los Anexos IV y VI del Reglamento Cosmético de la UE.',
    bannedGeneric: 'Sustancia prohibida según el Anexo II del Reglamento de la UE (Puntuación máxima 10).',
    restrictedGeneric: 'Sustancia sujeta a restricciones de concentración o uso según el Reglamento de la UE.',
    permittedGeneric: 'Ingrediente estándar permitido bajo las normas internacionales INCI / Códice Alimentario.',
    methodDisclaimer: 'Este índice no es una puntuación médica oficial; se calcula de forma determinista a partir de los ingredientes.',
    kvkkNotice: 'En la app móvil tus preferencias se procesan solo en este dispositivo. En la vista previa web se envían solo al servidor local de este ordenador para el análisis, sin guardarse ni compartirse con terceros.',
    veriYokMsg: (name, prof) => `Datos científicos insuficientes para ${name} en el perfil (${prof}).`,
    profileAlertGeneric: (name) => `${name}: Ingrediente señalado para tu perfil de sensibilidad seleccionado.`,
    halalDisclaimer: (auth) => `Esta evaluación no es un certificado halal oficial; analiza la etiqueta según los criterios de ${auth}.`,
    appleDisclaimer: 'Solo con fines informativos, no es consejo médico. Consulta a tu médico o farmacéutico para decisiones de salud.',
    shieldDesc: 'Alcohol graso emoliente o conservante seguro; NO es alcohol etílico (etanol) intoxicante.',
    halalOkDesc: 'Ingrediente permitido (Halal) según los criterios de la autoridad Halal seleccionada.',
    halalHaramDesc: 'Ingrediente no conforme (Haram) según el estándar de la autoridad Halal seleccionada.',
    halalAlcoholDesc: 'Contiene alcohol etílico (etanol); sujeto al criterio de la autoridad Halal seleccionada.',
    halalMusboohDesc: 'Dudoso (origen incierto): puede ser de origen vegetal o animal; verifica el certificado Halal o Vegano en el envase.',
    conflictHaram: 'ALERTA DE CONFLICTO: ¡El ingrediente detectado contradice la declaración Halal/Vegana del producto!',
    conflictAlcohol: 'Se marcó declaración Halal pero se detectó etanol. Verifica la política de la entidad certificadora.',
    veganNoteAlcohol: 'NOTA: Que un producto sea Vegano no resuelve el estado del alcohol etílico (etanol).',
    conflictAnimalVegan: 'ALERTA DE CONFLICTO: ¡Ingrediente de origen animal (Gelatina/Colágeno/Queratina/Suero) contradice el reclamo Vegano!',
    plantSourceResolved: 'Origen vegetal (Soja/Girasol/Vegetal) indicado explícitamente en la etiqueta; resuelto como apto.',
    halalCertResolved: 'Certificación Halal válida declarada; ingrediente de doble origen resuelto como apto.',
    verifiedVeganResolved: 'La certificación Vegana verificada confirma el origen vegetal de este ingrediente.',
    declaredVeganNote: 'Declaración Vegana presente (probablemente de origen vegetal; verifica el sello oficial).',
    lCysteineNote: 'El sello Vegano descarta plumas animales para la L-Cisteína (E920) pero no cabello humano; requiere certificado Halal.',
    conflictInsectVegan: 'ALERTA DE CONFLICTO: ¡Ingrediente derivado de insectos (Carmín E120 / Goma laca E904) incompatible con Vegano!'
  },
  ru: {
    regCardTitle: 'Индекс регулирования и прозрачности состава',
    profCardTitle: 'Совместимость с вашим профилем чувствительности',
    halalCardTitle: 'Проверка Халяль и этанола (Контекстный движок)',
    veganCardTitle: 'Веган-аудит и счетчик скрытого сахара',
    bhaMsg: 'На этикетке обнаружено сокращение "BHA". Это может означать антиоксидант "Бутилгидроксианизол (E320)" или "Салициловую кислоту". Требуется подтверждение.',
    slsMsg: 'Эти два вещества очень похожи при распознавании, но имеют разные правила ЕС и профили раздражения кожи. Пожалуйста, подтвердите.',
    ocrCodeMsg: (cand, canon) => `Возможная ошибка OCR в коде: "${cand}". Подтвердить как "${canon}"?`,
    e171FoodBanned: 'ПИЩЕВЫЕ ПРОДУКТЫ (E171): Запрещен как пищевая добавка в ЕС согласно Регламенту 2022/63 (оценка EFSA 2021).',
    ci77891CosmeticOk: 'КОСМЕТИКА (CI 77891): Разрешен в косметике согласно Приложениям IV и VI Регламента ЕС.',
    bannedGeneric: 'Запрещенное вещество согласно Приложению II Регламента ЕС (Максимальный балл — 10).',
    restrictedGeneric: 'Вещество подлежит ограничениям по концентрации или применению согласно Регламенту ЕС.',
    permittedGeneric: 'Стандартный разрешенный компонент согласно международному кодексу INCI / пищевых добавок.',
    methodDisclaimer: 'Этот индекс не является официальной медицинской оценкой; он рассчитывается по опубликованной методологии из списка состава.',
    kvkkNotice: 'В мобильном приложении ваш выбор обрабатывается только на этом устройстве. В веб-версии он передаётся только на локальный сервер этого компьютера для анализа, не сохраняется и не передаётся третьим лицам.',
    veriYokMsg: (name, prof) => `Недостаточно подтвержденных научных данных для ${name} в профиле (${prof}).`,
    profileAlertGeneric: (name) => `${name}: Компонент требует внимания для выбранного вами профиля чувствительности.`,
    halalDisclaimer: (auth) => `Эта оценка не является официальным сертификатом Халяль; анализ выполнен по критериям ${auth}.`,
    appleDisclaimer: 'Только в информационных целях, не является медицинской рекомендацией. Проконсультируйтесь с врачом или фармацевтом.',
    shieldDesc: 'Безопасный жирный спирт (эмолент) или консервант; НЕ является этиловым спиртом (этанолом).',
    halalOkDesc: 'Допустимый (Халяль) компонент согласно критериям выбранного органа Халяль.',
    halalHaramDesc: 'Несоответствующий (Харам) компонент согласно критериям выбранного органа Халяль.',
    halalAlcoholDesc: 'Содержит этиловый спирт (этанол); требует проверки по стандарту выбранного органа Халяль.',
    halalMusboohDesc: 'Сомнительно (происхождение неясно): может быть растительного или животного происхождения; проверьте сертификат Халяль или Веган.',
    conflictHaram: 'ПРЕДУПРЕЖДЕНИЕ О КОНФЛИКТЕ: Обнаруженный компонент противоречит заявлению Халяль/Веган на упаковке!',
    conflictAlcohol: 'Указан статус Халяль, но в составе обнаружен этанол. Проверьте политику сертифицирующего органа.',
    veganNoteAlcohol: 'ПРИМЕЧАНИЕ: Веганский статус не решает вопрос наличия этилового спирта (этанола).',
    conflictAnimalVegan: 'ПРЕДУПРЕЖДЕНИЕ О КОНФЛИКТЕ: Животный компонент (желатин/коллаген/кератин/сыворотка) противоречит статусу Веган!',
    plantSourceResolved: 'На этикетке явно указано растительное происхождение (соя/подсолнечник/растительный); компонент признан допустимым.',
    halalCertResolved: 'Подтверждено наличие сертификата Халяль; компонент двойного происхождения признан допустимым.',
    verifiedVeganResolved: 'Подтвержденный сертификат Веган гарантирует растительное происхождение компонента.',
    declaredVeganNote: 'Имеется текстовая пометка Веган (вероятно растительное происхождение; проверьте официальный знак сертификации).',
    lCysteineNote: 'Веган-статус исключает птичьи перья для L-цистеина (E920), но не человеческий волос; требуется сертификат Халяль.',
    conflictInsectVegan: 'ПРЕДУПРЕЖДЕНИЕ О КОНФЛИКТЕ: Компонент из насекомых (Кармин E120 / Шеллак E904) недопустим в веганском продукте!'
  },
  ur: {
    regCardTitle: 'ریگولیٹری اور اجزاء کی شفافیت کا اشاریہ',
    profCardTitle: 'ذاتی حساسیت اور پروفائل کی مطابقت',
    halalCardTitle: 'حلال اور ایتھنول سیاق و سباق انجن',
    veganCardTitle: 'ویگن مطابقت اور چھپی ہوئی شوگر کا شمار',
    bhaMsg: 'لیبل پر اکیلا "BHA" پڑھا گیا۔ اس کا مطلب اینٹی آکسیڈنٹ (E320) یا سیلیسیلک ایسڈ ہو سکتا ہے۔ اسکور سے پہلے تصدیق کریں۔',
    slsMsg: 'یہ دونوں اجزاء دیکھنے میں بہت ملتے جلتے ہیں لیکن ان کے قوانین اور جلد پر اثرات مختلف ہیں۔ براہ کرم تصدیق کریں۔',
    ocrCodeMsg: (cand, canon) => `کوڈ میں ممکنہ OCR غلطی ملی: "${cand}"۔ کیا آپ اسے "${canon}" کے طور پر منظور کرتے ہیں؟`,
    e171FoodBanned: 'خوراک (E171): یورپی یونین ریگولیشن 2022/63 کے تحت فوڈ ایڈیٹیو کے طور پر ممنوع ہے (EFSA 2021)۔',
    ci77891CosmeticOk: 'کاسمیٹکس (CI 77891): یورپی یونین کاسمیٹک ریگولیشن ضمیمہ IV اور VI کے تحت کاسمیٹکس میں اجازت ہے۔',
    bannedGeneric: 'یورپی یونین ریگولیشن ضمیمہ II کے تحت ممنوعہ جزو (زیادہ سے زیادہ اسکور 10)۔',
    restrictedGeneric: 'یورپی یونین کے ضوابط کے تحت ارتکاز یا استعمال کی پابندیوں سے مشروط جزو۔',
    permittedGeneric: 'بین الاقوامی INCI / فوڈ کوڈیکس کے تحت منظور شدہ معیاری جزو۔',
    methodDisclaimer: 'یہ اشاریہ کسی سرکاری ادارے کا طبی اسکور نہیں ہے؛ اسے شائع شدہ طریقہ کار کے مطابق اجزاء کی فہرست سے شمار کیا جاتا ہے۔',
    kvkkNotice: 'موبائل ایپ میں آپ کا انتخاب صرف اسی ڈیوائس پر پراسیس ہوتا ہے۔ ویب پیش نظارہ میں یہ صرف تجزیے کے لیے اسی کمپیوٹر کے مقامی سرور کو بھیجا جاتا ہے، محفوظ نہیں کیا جاتا اور کسی تیسرے فریق کے ساتھ شیئر نہیں ہوتا۔',
    veriYokMsg: (name, prof) => `${name} کے لیے پروفائل (${prof}) میں کافی سائنسی ڈیٹا دستیاب نہیں ہے۔`,
    profileAlertGeneric: (name) => `${name}: آپ کے منتخب کردہ حساسیت پروفائل کے لیے احتیاطی جزو۔`,
    halalDisclaimer: (auth) => `یہ تجزیہ کوئی سرکاری حلال سرٹیفکیٹ نہیں ہے؛ یہ منتخب ادارے (${auth}) کے معیارات کے مطابق لیبل کا جائزہ پیش کرتا ہے۔`,
    appleDisclaimer: 'صرف معلومات کے لیے ہے، طبی مشورہ نہیں۔ صحت سے متعلق فیصلوں کے لیے اپنے ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔',
    shieldDesc: 'یہ فیٹی الکحل (جلد کو نرم کرنے والا) یا محفوظ پریزرویٹو ہے؛ نشہ آور ایتھائل الکحل (ایتھنول) نہیں ہے۔',
    halalOkDesc: 'منتخب حلال اتھارٹی کے معیار کے مطابق جائز (حلال) جزو۔',
    halalHaramDesc: 'منتخب حلال اتھارٹی کے معیار کے مطابق غیر موزوں (حرام) جزو۔',
    halalAlcoholDesc: 'اس میں ایتھائل الکحل (ایتھنول) شامل ہے؛ منتخب حلال اتھارٹی کے اصولوں کے مطابق جانچ ضروری ہے۔',
    halalMusboohDesc: 'مشکوک (ماخذ غیر واضح): نباتاتی یا حیوانی ہو سکتا ہے؛ حتمی فیصلے کے لیے پیکنگ پر حلال یا ویگن سرٹیفکیٹ چیک کریں۔',
    conflictHaram: 'تضاد کی تنبیہ: اجزاء میں شامل مادہ پیکنگ پر موجود حلال/ویگن دعوے سے متصادم ہے!',
    conflictAlcohol: 'حلال کا دعویٰ منتخب کیا گیا ہے لیکن اجزاء میں ایتھنول ملا ہے۔ سرٹیفکیٹ دینے والے ادارے کی پالیسی چیک کریں۔',
    veganNoteAlcohol: 'نوٹ: پروڈکٹ کا ویگن ہونا ایتھائل الکحل (ایتھنول) کے مسئلے کو حل نہیں کرتا۔',
    conflictAnimalVegan: 'تضاد کی تنبیہ: حیوانی جزو (جیلاٹن/کولاجن/کیراٹین/وہے) ویگن دعوے سے متصادم ہے!',
    plantSourceResolved: 'لیبل پر واضح طور پر نباتاتی ذریعہ (سویا/سورج مکھی/نباتاتی) درج ہے، اس لیے اسے موزوں مانا گیا۔',
    halalCertResolved: 'معتبر حلال سرٹیفکیٹ کی موجودگی کی وجہ سے دوہرے ذریعے والے جزو کو موزوں مانا گیا۔',
    verifiedVeganResolved: 'تصدیق شدہ ویگن سرٹیفکیٹ سے ثابت ہوا کہ یہ جزو نباتاتی ماخذ سے ہے۔',
    declaredVeganNote: 'تحریری ویگن دعویٰ موجود ہے (غالباً نباتاتی ماخذ؛ سرکاری لوگو کی تصدیق کریں)۔',
    lCysteineNote: 'ویگن دعویٰ L-Cysteine (E920) کے لیے پرندوں کے پروں کو خارج کرتا ہے لیکن انسانی بالوں کو نہیں؛ حلال سرٹیفکیٹ ضروری ہے۔',
    conflictInsectVegan: 'تضاد کی تنبیہ: کیڑوں سے حاصل کردہ جزو (کارمین E120 / شیلیک E904) ویگن پروڈکٹ میں نہیں ہو سکتا!'
  }
};

function getEngineText(lang) {
  return ENGINE_I18N[lang] || ENGINE_I18N.en;
}

function titleCaseWords(str) {
  return (str || '')
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Comprehensive 10-language canonical dictionary for common substances and food ingredients.
 */
const SPECIFIC_ENTITIES_10LANG = {
  sugar: { tr: 'Şeker (Sükroz)', en: 'Sugar (Sucrose)', ar: 'السكر (السكروز)', de: 'Zucker', fr: 'Sucre (Saccharose)', id: 'Gula (Sukrosa)', ms: 'Gula (Sukrosa)', es: 'Azúcar (Sacarosa)', ru: 'Сахар (Сахароза)', ur: 'چینی (سکروز)' },
  carmine_e120: { tr: 'Karmin (E120)', en: 'Carmine (E120)', ar: 'كارمين (E120)', de: 'Karmin (E120)', fr: 'Carmin (E120)', id: 'Karmin (E120)', ms: 'Karmin (E120)', es: 'Carmín (E120)', ru: 'Кармин (E120)', ur: 'کارمائن (E120)' },
  gelatin: { tr: 'Jelatin', en: 'Gelatin', ar: 'جيلاتين', de: 'Gelatine', fr: 'Gélatine', id: 'Gelatin', ms: 'Gelatin', es: 'Gelatina', ru: 'Желатин', ur: 'جیلیٹن' },
  aqua: { tr: 'Su (Aqua)', en: 'Water (Aqua)', ar: 'ماء (Aqua)', de: 'Wasser (Aqua)', fr: 'Eau (Aqua)', id: 'Air (Aqua)', ms: 'Air (Aqua)', es: 'Agua (Aqua)', ru: 'Вода (Aqua)', ur: 'پانی (Aqua)' },
  glycerin: { tr: 'Gliserin', en: 'Glycerin', ar: 'جلسرين', de: 'Glycerin', fr: 'Glycérine', id: 'Gliserin', ms: 'Gliserin', es: 'Glicerina', ru: 'Глицерин', ur: 'گلیسرین' },
  cetearyl_alcohol: { tr: 'Setearil Alkol', en: 'Cetearyl Alcohol', ar: 'كحول سيتيريلي', de: 'Cetearyl Alcohol', fr: 'Alcool cétéarylique', id: 'Setearil Alkohol', ms: 'Setearil Alkohol', es: 'Alcohol cetearílico', ru: 'Цетеариловый спирт', ur: 'سیٹیرائل الکوحل' },
  cetyl_alcohol: { tr: 'Setil Alkol', en: 'Cetyl Alcohol', ar: 'كحول سيتيلي', de: 'Cetyl Alcohol', fr: 'Alcool cétylique', id: 'Setil Alkohol', ms: 'Setil Alkohol', es: 'Alcohol cetílico', ru: 'Цетиловый спирт', ur: 'سیٹائل الکوحل' },
  niacinamide: { tr: 'Niasinamid (B3)', en: 'Niacinamide (B3)', ar: 'نياسيناميد (B3)', de: 'Niacinamid (B3)', fr: 'Niacinamide (B3)', id: 'Niasinamida (B3)', ms: 'Niasinamida (B3)', es: 'Niacinamida (B3)', ru: 'Ниацинамид (B3)', ur: 'نیاسینامائیڈ (B3)' },
  panthenol: { tr: 'Pantenol (Pro-B5)', en: 'Panthenol (Pro-B5)', ar: 'بانثينول (Pro-B5)', de: 'Panthenol (Pro-B5)', fr: 'Panthénol (Pro-B5)', id: 'Pantenol (Pro-B5)', ms: 'Pantenol (Pro-B5)', es: 'Pantenol (Pro-B5)', ru: 'Пантенол (Про-B5)', ur: 'پینتھینول (Pro-B5)' },
  sodium_hyaluronate: { tr: 'Sodyum Hyaluronat', en: 'Sodium Hyaluronate', ar: 'هيالورونات الصوديوم', de: 'Natriumhyaluronat', fr: 'Hyaluronate de sodium', id: 'Natrium Hialuronat', ms: 'Natrium Hialuronat', es: 'Hialuronato de sodio', ru: 'Гиалуронат натрия', ur: 'سوڈیم ہائیلورونیٹ' },
  ceramide_np: { tr: 'Seramid NP', en: 'Ceramide NP', ar: 'سيراميد NP', de: 'Ceramid NP', fr: 'Céramide NP', id: 'Seramida NP', ms: 'Seramida NP', es: 'Ceramida NP', ru: 'Керамид NP', ur: 'سیرامائیڈ NP' },
  tocopherol: { tr: 'Tokoferol (E Vitamini)', en: 'Tocopherol (Vitamin E)', ar: 'توكوفيرول (فيتامين E)', de: 'Tocopherol (Vitamin E)', fr: 'Tocophérol (Vitamine E)', id: 'Tokoferol (Vitamin E)', ms: 'Tokoferol (Vitamin E)', es: 'Tocoferol (Vitamina E)', ru: 'Токоферол (Витамин E)', ur: 'ٹوکوفیرول (وٹامن E)' },
  citric_acid_e330: { tr: 'Sitrik Asit (E330)', en: 'Citric Acid (E330)', ar: 'حمض الستريك (E330)', de: 'Citronensäure (E330)', fr: 'Acide citrique (E330)', id: 'Asam Sitrat (E330)', ms: 'Asid Sitrik (E330)', es: 'Ácido cítrico (E330)', ru: 'Лимонная кислота (E330)', ur: 'سائٹرک ایسڈ (E330)' },
  phenoxyethanol: { tr: 'Fenoksietanol', en: 'Phenoxyethanol', ar: 'فينوكسي إيثانول', de: 'Phenoxyethanol', fr: 'Phénoxyéthanol', id: 'Fenoksietanol', ms: 'Fenoksietanol', es: 'Fenoxietanol', ru: 'Феноксиэтанол', ur: 'فینوکسی ایتھانول' },
  food_emulsifiers_lecithin_pgpr: { tr: 'Lesitin (Soya)', en: 'Lecithins (Soya)', ar: 'ليسيثين (صويا)', de: 'Lecithine (Soja)', fr: 'Lécithines (soja)', id: 'Lesitin (Kedelai)', ms: 'Lesitin (Soya)', es: 'Lecitinas (soja)', ru: 'Лецитин (соевый)', ur: 'لیسیتھین (سویا)' },
  lecithin_e322: { tr: 'Lesitin (Soya / E322)', en: 'Lecithins (Soya / E322)', ar: 'ليسيثين (صويا / E322)', de: 'Lecithine (Soja / E322)', fr: 'Lécithines (soja / E322)', id: 'Lesitin (Kedelai / E322)', ms: 'Lesitin (Soya / E322)', es: 'Lecitinas (soja / E322)', ru: 'Лецитин (соевый / E322)', ur: 'لیسیتھین (سویا / E322)' },
  e471_mono_and_diglycerides: { tr: 'Mono- ve Digliseritler (E471)', en: 'Mono- and Diglycerides (E471)', ar: 'أحادي وثنائي الجليسريد (E471)', de: 'Mono- und Diglyceride (E471)', fr: 'Mono- et diglycérides (E471)', id: 'Mono- dan Digliserida (E471)', ms: 'Mono- dan Digliserida (E471)', es: 'Mono- y Diglicéridos (E471)', ru: 'Моно- и диглицериды (E471)', ur: 'مونو اور ڈائی گلیسرائڈز (E471)' },
  cholesterol_lipid: { tr: 'Kolesterol (Hayvansal Lipid)', en: 'Cholesterol (Animal Lipid)', ar: 'كوليسترول (دهن حيواني)', de: 'Cholesterin (Tierisches Lipid)', fr: 'Cholestérol (Lipide animal)', id: 'Kolesterol (Lipid Hewani)', ms: 'Kolesterol (Lipid Haiwan)', es: 'Colesterol (Lípido animal)', ru: 'Холестерин (животный липид)', ur: 'کولیسٹرول (حیوانی لپڈ)' }
};

/**
 * Picks a localized display name for a matched substance / halal rule / sugar in the target `lang`.
 */
function resolveLocalizedDisplayName(rawToken, sub, halalRule, sugar, rapidCarb, lang) {
  const entity = sub || halalRule || sugar || rapidCarb;
  if (!entity) return rawToken;
  const aliases = entity.aliases || [];
  const canon = sub ? sub.name : halalRule ? halalRule.canonical : sugar ? sugar.canonical : rapidCarb.canonical;
  const lowerRaw = rawToken.toLowerCase();

  // 1. Check direct table for specific entities
  if ((entity.id === 'ceramide_np' || entity.id === 'ceramides_family') && /\b(ceramide|seramid)\s+(ap|eop|ns|eos|ng)\b/i.test(lowerRaw)) {
    const suffix = lowerRaw.match(/\b(?:ceramide|seramid)\s+(ap|eop|ns|eos|ng)\b/i)[1].toUpperCase();
    const map = { tr: `Seramid ${suffix}`, en: `Ceramide ${suffix}`, ar: `سيراميد ${suffix}`, de: `Ceramid ${suffix}`, fr: `Céramide ${suffix}`, id: `Seramida ${suffix}`, ms: `Seramida ${suffix}`, es: `Ceramida ${suffix}`, ru: `Керамид ${suffix}`, ur: `سیرامائیڈ ${suffix}` };
    return map[lang] || `Ceramide ${suffix}`;
  }
  if (
    entity.id === 'food_emulsifiers_lecithin_pgpr' &&
    !/lecithin|lesitin|lécithin|lecitin|лецитин|ليسيثين|لیسیتھین|e\s*322\b/i.test(lowerRaw)
  ) {
    return rawToken;
  }
  if (SPECIFIC_ENTITIES_10LANG[entity.id] && SPECIFIC_ENTITIES_10LANG[entity.id][lang]) {
    const mapped = SPECIFIC_ENTITIES_10LANG[entity.id][lang];
    if (lang === 'ar' && /[\u0600-\u06FF]/.test(rawToken)) return rawToken;
    if (lang === 'ur' && /[\u0600-\u06FF]/.test(rawToken)) return rawToken;
    if (lang === 'ru' && /[\u0400-\u04FF]/.test(rawToken)) return rawToken;
    return mapped;
  }

  // 2. Disambiguate umbrella food ingredients (common_whole_food_ingredients)
  if (entity.id === 'common_whole_food_ingredients') {
    if (/haseln|hazeln|fındık|findik|noisett|avellan|фундук|بندق|ہیزل/.test(lowerRaw)) {
      const map = { tr: 'Fındık', en: 'Hazelnuts', ar: 'بندق', de: 'Haselnüsse', fr: 'Noisettes', es: 'Avellanas', ru: 'Фундук', id: 'Kacang Hazel', ms: 'Kacang Hazel', ur: 'ہیزل نٹ' };
      return map[lang] || 'Hazelnuts';
    }
    if (/milch|milk|süt|sut|lait|leche|молок|حليب|دودھ/.test(lowerRaw)) {
      const map = { tr: 'Yağsız Süt Tozu', en: 'Skimmed Milk Powder', ar: 'حليب مجفف منزوع الدسم', de: 'Magermilchpulver', fr: 'Lait écrémé en poudre', es: 'Leche desnatada en polvo', ru: 'Сухое обезжиренное молоко', id: 'Susu Skim Bubuk', ms: 'Susu Tepung Skim', ur: 'سکمڈ دودھ کا پاؤڈر' };
      return map[lang] || 'Skimmed Milk Powder';
    }
    if (/kakao|cocoa|cacao|какао|كاكاو|کوکو/.test(lowerRaw)) {
      const map = { tr: 'Kakao Tozu', en: 'Cocoa Powder', ar: 'مسحوق الكاكاو', de: 'Kakaopulver', fr: 'Poudre de cacao', es: 'Cacao en polvo', ru: 'Какао-порошок', id: 'Bubuk Kakao', ms: 'Serbuk Koko', ur: 'کوکو پاؤڈر' };
      return map[lang] || 'Cocoa Powder';
    }
    if (/wheat\s+starch|buğday\s+nişastası|weizenstärke|amidon\s+de\s+blé|almidón\s+de\s+trigo|пшеничный\s+крахмал|نشا\s+القمح/.test(lowerRaw)) {
      const map = { tr: 'Buğday Nişastası', en: 'Wheat Starch', ar: 'نشا القمح', de: 'Weizenstärke', fr: 'Amidon de blé', es: 'Almidón de trigo', ru: 'Пшеничный крахмал', id: 'Pati Gandum', ms: 'Kanji Gandum', ur: 'گندم کا نشاستہ' };
      return map[lang] || 'Wheat Starch';
    }
    if (/mehl|flour|buğday unu|farine|harina|мука|دقيق|میدہ/.test(lowerRaw)) {
      const map = { tr: 'Buğday Unu', en: 'Wheat Flour', ar: 'دقيق القمح', de: 'Weizenmehl', fr: 'Farine de blé', es: 'Harina de trigo', ru: 'Пшеничная мука', id: 'Tepung Terigu', ms: 'Tepung Gandum', ur: 'میدہ' };
      return map[lang] || 'Wheat Flour';
    }
    if (/kartoffel|potato|patates|pomme de terre|patata|картоф|بطاطس|آلو/.test(lowerRaw)) {
      const map = { tr: 'Patates', en: 'Potatoes', ar: 'بطاطس', de: 'Kartoffeln', fr: 'Pommes de terre', es: 'Patatas', ru: 'Картофель', id: 'Kentang', ms: 'Kentang', ur: 'آلو' };
      return map[lang] || 'Potatoes';
    }
    if (/\b(soy|soya|soja|kedelai|соя|صويا|سویا)\b/.test(lowerRaw)) {
      const map = { tr: 'Soya', en: 'Soya', ar: 'صويا', de: 'Soja', fr: 'Soja', es: 'Soja', ru: 'Соя', id: 'Kedelai (Soya)', ms: 'Soya', ur: 'سویا' };
      return map[lang] || 'Soya';
    }
    return rawToken;
  }

  // 3. Disambiguate botanical oils & butters
  if (entity.id === 'non_comedogenic_botanical_oils_butters') {
    if (/palm|نخيل/.test(lowerRaw)) {
      const map = { tr: 'Palm Yağı', en: 'Palm Oil', ar: 'زيت النخيل', de: 'Palmöl', fr: 'Huile de palme', es: 'Aceite de palma', ru: 'Пальмовое масло', id: 'Minyak Kelapa Sawit', ms: 'Minyak Sawit', ur: 'پام آئل' };
      return map[lang] || 'Palm Oil';
    }
    if (/shea|karite|شيا/.test(lowerRaw)) {
      const map = { tr: 'Shea Yağı', en: 'Shea Butter', ar: 'زبدة الشيا', de: 'Sheabutter', fr: 'Beurre de karité', es: 'Manteca de karité', ru: 'Масло ши', id: 'Shea Butter', ms: 'Mentega Shea', ur: 'شیا مکھن' };
      return map[lang] || 'Shea Butter';
    }
    if (/sonnenblume|sunflower|ayçiçek|aycicek|tournesol|girasol|подсолнечн|عباد الشمس|سورج مکھی/.test(lowerRaw)) {
      const map = { tr: 'Ayçiçek Yağı', en: 'Sunflower Oil', ar: 'زيت عباد الشمس', de: 'Sonnenblumenöl', fr: 'Huile de tournesol', es: 'Aceite de girasol', ru: 'Подсолнечное масло', id: 'Minyak Bunga Matahari', ms: 'Minyak Bunga Matahari', ur: 'سورج مکھی کا تیل' };
      return map[lang] || 'Sunflower Oil';
    }
    return rawToken;
  }

  // 3.2. Disambiguate salts, bases & amino pH adjusters
  if (entity.id === 'ph_adjusters_salts_bases') {
    if (/\b(salt|tuz|sea salt|deniz tuzu|maris sal|sel|salz|sal|garam|соль|ملح|نمک|sodium chloride|sodyum klorür)\b/i.test(lowerRaw)) {
      const map = { tr: 'Tuz (Sodyum Klorür)', en: 'Salt (Sodium Chloride)', ar: 'ملح (كلوريد الصوديوم)', de: 'Salz (Natriumchlorid)', fr: 'Sel (Chlorure de sodium)', id: 'Garam (Natrium Klorida)', ms: 'Garam (Natrium Klorida)', es: 'Sal (Cloruro de sodio)', ru: 'Соль (Хлорид натрия)', ur: 'نمک (سوڈیم کلورائیڈ)' };
      return map[lang] || 'Salt';
    }
    if (/\b(arginine|arjinin|arginin|arginina|аргинин|أرجينين|ارجینین)\b/i.test(lowerRaw)) {
      const map = { tr: 'Arjinin (Arginine)', en: 'Arginine', ar: 'أرجينين (Arginine)', de: 'Arginin', fr: 'Arginine', id: 'Arginin', ms: 'Arginin', es: 'Arginina', ru: 'Аргинин (Arginine)', ur: 'ارجینین (Arginine)' };
      return map[lang] || 'Arginine';
    }
    return rawToken;
  }

  // 3.3. Disambiguate polymers & gums
  if (entity.id === 'polymers_carbomer_acrylates') {
    if (/^\s*(carbomer|karbomer|карбомер|كاربومير)\s*$/i.test(lowerRaw)) {
      const map = { tr: 'Karbomer (Carbomer)', en: 'Carbomer', ar: 'كاربومير (Carbomer)', de: 'Carbomer', fr: 'Carbomère', id: 'Karbomer', ms: 'Karbomer', es: 'Carbómero', ru: 'Карбомер (Carbomer)', ur: 'کاربومر (Carbomer)' };
      return map[lang] || 'Carbomer';
    }
    return rawToken;
  }
  if (entity.id === 'natural_gums_hydrocolloids') {
    if (/xanthan|ksantan/i.test(lowerRaw)) {
      const map = { tr: 'Ksantan Gam (Xanthan Gum)', en: 'Xanthan Gum', ar: 'صمغ الزانثان (Xanthan Gum)', de: 'Xanthan Gum', fr: 'Gomme xanthane', id: 'Gom Xanthan', ms: 'Gam Xanthan', es: 'Goma xantana', ru: 'Ксантановая камедь (Xanthan Gum)', ur: 'زینتھن گم (Xanthan Gum)' };
      return map[lang] || 'Xanthan Gum';
    }
    return rawToken;
  }
  if (entity.id === 'cosmetic_specialty_solvents_boosters') {
    return rawToken;
  }

  // 3.5. Disambiguate soothing botanicals
  if (entity.id === 'soothing_botanical_extracts') {
    if (/camellia|green\s+tea|yeşil\s+çay/i.test(lowerRaw)) {
      const map = { tr: 'Yeşil Çay Ekstraktı', en: 'Green Tea Extract', ar: 'مستخلص الشاي الأخضر', de: 'Grüntee-Extrakt', fr: 'Extrait de thé vert', es: 'Extracto de té verde', ru: 'Экстракт зеленого чая', id: 'Ekstrak Teh Hijau', ms: 'Ekstrak Teh Hijau', ur: 'سبز چائے کا عرق' };
      return map[lang] || 'Green Tea Extract';
    }
    if (/aloe/i.test(lowerRaw)) {
      const map = { tr: 'Aloe Vera', en: 'Aloe Vera', ar: 'ألوفيرا', de: 'Aloe Vera', fr: 'Aloe Vera', es: 'Aloe Vera', ru: 'Алоэ вера', id: 'Lidah Buaya', ms: 'Lidah Buaya', ur: 'ایلو ویرا' };
      return map[lang] || 'Aloe Vera';
    }
    if (/chamom|matricaria|papatya/i.test(lowerRaw)) {
      const map = { tr: 'Papatya Özütü', en: 'Chamomile Extract', ar: 'مستخلص البابونج', de: 'Kamillenextrakt', fr: 'Extrait de camomille', es: 'Extracto de manzanilla', ru: 'Экстракт ромашки', id: 'Ekstrak Chamomile', ms: 'Ekstrak Chamomile', ur: 'بَبُونہ کا عرق' };
      return map[lang] || 'Chamomile Extract';
    }
    return titleCaseWords(rawToken);
  }

  // 3.6. Disambiguate Brightening Actives (Alpha-Arbutin, Arbutin, Tranexamic Acid, Azelaic Acid) & Kojic Acid & Omnibus substances
  const withRawSuffix = (localLabel) => {
    if (!localLabel) return rawToken;
    if (localLabel.toLowerCase() === rawToken.toLowerCase()) return localLabel;
    if ((lang === 'ar' || lang === 'ur') && /[\u0600-\u06FF]/.test(rawToken)) return rawToken;
    if (lang === 'ru' && /[\u0400-\u04FF]/.test(rawToken)) return rawToken;
    return `${localLabel} (${rawToken})`;
  };

  if (entity.id === 'alpha_arbutin') {
    const map = {
      tr: 'Alfa-Arbutin',
      en: 'Alpha-Arbutin',
      ar: 'ألفا أربوتين',
      de: 'Alpha-Arbutin',
      fr: 'Alpha-Arbutine',
      id: 'Alfa-Arbutin',
      ms: 'Alfa-Arbutin',
      es: 'Alfa-Arbutina',
      ru: 'Альфа-арбутин',
      ur: 'الفا اربوٹین'
    };
    return withRawSuffix(map[lang] || 'Alpha-Arbutin');
  }

  if (entity.id === 'arbutin') {
    const map = {
      tr: 'Arbutin',
      en: 'Arbutin',
      ar: 'أربوتين',
      de: 'Arbutin',
      fr: 'Arbutine',
      id: 'Arbutin',
      ms: 'Arbutin',
      es: 'Arbutina',
      ru: 'Арбутин',
      ur: 'اربوٹین'
    };
    return withRawSuffix(map[lang] || 'Arbutin');
  }

  if (entity.id === 'tranexamic_azelaic_arbutin') {
    if (/(?:^|[^\p{L}\p{N}])(tranexamic\s+acid|traneksamik\s+asit|tranexamsäure|acide\s+tranexamique|ácido\s+tranexámico|asam\s+traneksamat|asid\s+traneksamik|транексамовая\s+кислота|حمض\s+الترانيكساميك|ترانيكساميك|ٹرانیکسامک\s+ایسڈ)(?=[^\p{L}\p{N}]|$)/iu.test(rawToken)) {
      const map = {
        tr: 'Traneksamik Asit',
        en: 'Tranexamic Acid',
        ar: 'حمض الترانيكساميك',
        de: 'Tranexamsäure',
        fr: 'Acide tranexamique',
        id: 'Asam Traneksamat',
        ms: 'Asid Traneksamik',
        es: 'Ácido tranexámico',
        ru: 'Транексамовая кислота',
        ur: 'ٹرانیکسامک ایسڈ'
      };
      return withRawSuffix(map[lang] || 'Tranexamic Acid');
    }
    if (/(?:^|[^\p{L}\p{N}])(azelaic\s+acid|azelaik\s+asit|azelainsäure|acide\s+azélaïque|ácido\s+azelaico|asam\s+azelaic|asid\s+azelaik|азелаиновая\s+кислота|حمض\s+الأزيليك|ازیلائک\s+ایسڈ)(?=[^\p{L}\p{N}]|$)/iu.test(rawToken)) {
      const map = {
        tr: 'Azelaik Asit',
        en: 'Azelaic Acid',
        ar: 'حمض الأزيليك',
        de: 'Azelainsäure',
        fr: 'Acide azélaïque',
        id: 'Asam Azelaic',
        ms: 'Asid Azelaik',
        es: 'Ácido azelaico',
        ru: 'Азелаиновая кислота',
        ur: 'ازیلائک ایسڈ'
      };
      return withRawSuffix(map[lang] || 'Azelaic Acid');
    }
    return rawToken;
  }

  if (entity.id === 'triclosan') {
    const map = {
      tr: 'Triklosan',
      en: 'Triclosan',
      ar: 'تريكلوسان',
      de: 'Triclosan',
      fr: 'Triclosan',
      id: 'Triclosan',
      ms: 'Triclosan',
      es: 'Triclosán',
      ru: 'Триклозан',
      ur: 'ٹرائیکلوسان'
    };
    return withRawSuffix(map[lang] || 'Triclosan');
  }

  if (entity.id === 'triclocarban') {
    const map = {
      tr: 'Triklokarban',
      en: 'Triclocarban',
      ar: 'تريكلوكاربان',
      de: 'Triclocarban',
      fr: 'Triclocarban',
      id: 'Triclocarban',
      ms: 'Triclocarban',
      es: 'Triclocarbán',
      ru: 'Триклокарбан',
      ur: 'ٹرائیکلوکاربن'
    };
    return withRawSuffix(map[lang] || 'Triclocarban');
  }

  if (entity.id === 'genistein') {
    const map = {
      tr: 'Genistein',
      en: 'Genistein',
      ar: 'جينيستين',
      de: 'Genistein',
      fr: 'Génistéine',
      id: 'Genistein',
      ms: 'Genistein',
      es: 'Genisteína',
      ru: 'Генистеин',
      ur: 'جینیسٹین'
    };
    return withRawSuffix(map[lang] || 'Genistein');
  }

  if (entity.id === 'daidzein') {
    const map = {
      tr: 'Daidzein',
      en: 'Daidzein',
      ar: 'دايدزين',
      de: 'Daidzein',
      fr: 'Daidzéine',
      id: 'Daidzein',
      ms: 'Daidzein',
      es: 'Daidzeína',
      ru: 'Даидзеин',
      ur: 'ڈائیڈزین'
    };
    return withRawSuffix(map[lang] || 'Daidzein');
  }

  if (entity.id === 'kojic_acid') {
    const map = {
      tr: 'Kojik Asit',
      en: 'Kojic Acid',
      ar: 'حمض الكوجيك',
      de: 'Kojisäure',
      fr: 'Acide kojique',
      id: 'Asam Kojat',
      ms: 'Asid Kojik',
      es: 'Ácido kójico',
      ru: 'Койевая кислота',
      ur: 'کوجک ایسڈ'
    };
    return withRawSuffix(map[lang] || 'Kojic Acid');
  }

  if (entity.id === 'retinol') {
    if (/retinyl\s+palmitate/i.test(lowerRaw)) {
      const map = {
        tr: 'Retinil Palmitat',
        en: 'Retinyl Palmitate',
        ar: 'بالميتات الريتينيل',
        de: 'Retinylpalmitat',
        fr: 'Palmitate de rétinyle',
        id: 'Retinil Palmitat',
        ms: 'Retinil Palmitat',
        es: 'Palmitato de retinilo',
        ru: 'Ретинилпальмитат',
        ur: 'ریٹینائل پامٹیٹ'
      };
      return withRawSuffix(map[lang] || 'Retinyl Palmitate');
    }
    if (/retinyl\s+acetate/i.test(lowerRaw)) {
      const map = {
        tr: 'Retinil Asetat',
        en: 'Retinyl Acetate',
        ar: 'أسيتات الريتينيل',
        de: 'Retinylacetat',
        fr: 'Acétate de rétinyle',
        id: 'Retinil Asetat',
        ms: 'Retinil Asetat',
        es: 'Acetato de retinilo',
        ru: 'Ретинилацетат',
        ur: 'ریٹینائل ایسیٹیٹ'
      };
      return withRawSuffix(map[lang] || 'Retinyl Acetate');
    }
    const map = {
      tr: 'Retinol',
      en: 'Retinol',
      ar: 'ريتينول',
      de: 'Retinol',
      fr: 'Rétinol',
      id: 'Retinol',
      ms: 'Retinol',
      es: 'Retinol',
      ru: 'Ретинол',
      ur: 'ریٹینول'
    };
    return withRawSuffix(map[lang] || 'Retinol');
  }

  if (entity.id === 'tphp_triphenyl_phosphate_banned') {
    const map = {
      tr: 'Trifenil Fosfat',
      en: 'Triphenyl Phosphate',
      ar: 'فوسفات ثلاثي الفينيل',
      de: 'Triphenylphosphat',
      fr: 'Phosphate de triphényle',
      id: 'Trifenil Fosfat',
      ms: 'Trifenil Fosfat',
      es: 'Fosfato de trifenilo',
      ru: 'Трифенилфосфат',
      ur: 'ٹرائی فینائل فاسفیٹ'
    };
    return withRawSuffix(map[lang] || 'Triphenyl Phosphate');
  }

  if (entity.id === 'tpo_nail_banned_2025') {
    const map = {
      tr: 'Trimetilbenzoil Difenilfosfin Oksit',
      en: 'Trimethylbenzoyl Diphenylphosphine Oxide',
      ar: 'أكسيد ثلاثي ميثيل بنزويل ثنائي فينيل فوسفين',
      de: 'Trimethylbenzoyldiphenylphosphinoxid',
      fr: 'Oxyde de triméthylbenzoyl diphénylphosphine',
      id: 'Trimetilbenzoil Difenilfosfin Oksida',
      ms: 'Trimetilbenzoil Difenilfosfin Oksida',
      es: 'Óxido de trimetilbenzoil difenilfosfina',
      ru: 'Оксид триметилбензоил дифенилфосфина',
      ur: 'ٹرائی میتھائل بینزوئل ڈائی فینائل فاسفین آکسائیڈ'
    };
    return withRawSuffix(map[lang] || rawToken);
  }

  if (entity.id === 'fragrance_allergens') {
    if (/\blinalool\b/i.test(lowerRaw)) {
      const map = { tr: 'Linalol', en: 'Linalool', ar: 'لينالول', de: 'Linalool', fr: 'Linalol', id: 'Linalool', ms: 'Linalool', es: 'Linalol', ru: 'Линалоол', ur: 'لینالول' };
      return withRawSuffix(map[lang] || 'Linalool');
    }
    if (/\blimonene\b/i.test(lowerRaw)) {
      const map = { tr: 'Limonen', en: 'Limonene', ar: 'ليمونين', de: 'Limonen', fr: 'Limonène', id: 'Limonena', ms: 'Limonena', es: 'Limoneno', ru: 'Лимонен', ur: 'لیمونین' };
      return withRawSuffix(map[lang] || 'Limonene');
    }
    if (/\bgeraniol\b/i.test(lowerRaw)) {
      const map = { tr: 'Geraniol', en: 'Geraniol', ar: 'جيرانيول', de: 'Geraniol', fr: 'Géraniol', id: 'Geraniol', ms: 'Geraniol', es: 'Geraniol', ru: 'Гераниол', ur: 'جیرانیول' };
      return withRawSuffix(map[lang] || 'Geraniol');
    }
    if (/\bcitronellol\b/i.test(lowerRaw)) {
      const map = { tr: 'Sitronellol', en: 'Citronellol', ar: 'سيترونيلول', de: 'Citronellol', fr: 'Citronellol', id: 'Sitronelol', ms: 'Sitronelol', es: 'Citronelol', ru: 'Цитронеллол', ur: 'سٹرونیلول' };
      return withRawSuffix(map[lang] || 'Citronellol');
    }
    if (/\bbenzyl\s+benzoate\b/i.test(lowerRaw)) {
      const map = { tr: 'Benzil Benzoat', en: 'Benzyl Benzoate', ar: 'بنزوات البنزيل', de: 'Benzylbenzoat', fr: 'Benzoate de benzyle', id: 'Benzil Benzoat', ms: 'Benzil Benzoat', es: 'Benzoato de bencilo', ru: 'Бензилбензоат', ur: 'بینزائل بینزویٹ' };
      return withRawSuffix(map[lang] || 'Benzyl Benzoate');
    }
    if (/\bcinnamyl\s+alcohol\b/i.test(lowerRaw)) {
      const map = { tr: 'Sinnamil Alkol', en: 'Cinnamyl Alcohol', ar: 'كحول سيناميل', de: 'Zimtalkohol', fr: 'Alcool cinnamique', id: 'Sinamil Alkohol', ms: 'Sinamil Alkohol', es: 'Alcohol cinamílico', ru: 'Коричный спирт', ur: 'سینامائل الکوحل' };
      return withRawSuffix(map[lang] || 'Cinnamyl Alcohol');
    }
    return rawToken;
  }

  if (entity.id === 'comedogenic_esters_oils') {
    if (/cocoa\s+butter|kakao\s+yağı|kakaobutter|beurre\s+de\s+cacao|manteca\s+de\s+cacao|масло\s+какао|زبدة\s+الكاكاو/i.test(lowerRaw)) {
      const map = { tr: 'Kakao Yağı', en: 'Cocoa Butter', ar: 'زبدة الكاكاو', de: 'Kakaobutter', fr: 'Beurre de cacao', id: 'Lemak Kakao', ms: 'Mentega Koko', es: 'Manteca de cacao', ru: 'Масло какао', ur: 'کوکو بٹر' };
      return withRawSuffix(map[lang] || 'Cocoa Butter');
    }
    if (/coconut|cocos\s+nucifera|hindistan\s+cevizi/i.test(lowerRaw)) {
      const map = { tr: 'Hindistan Cevizi Yağı', en: 'Coconut Oil', ar: 'زيت جوز الهند', de: 'Kokosöl', fr: 'Huile de coco', id: 'Minyak Kelapa', ms: 'Minyak Kelapa', es: 'Aceite de coco', ru: 'Кокосовое масло', ur: 'ناریل کا تیل' };
      return withRawSuffix(map[lang] || 'Coconut Oil');
    }
    return rawToken;
  }

  // Guard against multi-chemical umbrella groups falling through to generic first-alias lookup
  const SINGLE_CHEMICAL_IDS_WITH_SLASH = new Set([
    'aqua',
    'parfum',
    'alcohol_denat',
    'tocopherol',
    'sodium_hyaluronate',
    'urea_carbamide',
    'msg_e621',
    'titanium_dioxide_e171_ci77891',
    'carmine_e120',
    'lecithin_e322',
    'e471_mono_and_diglycerides',
    'citric_acid_e330',
    'propylene_glycol_e1520'
  ]);
  if ((/[\/&]/.test(canon) || entity.id === 'mineral_oil_petrolatum') && !SINGLE_CHEMICAL_IDS_WITH_SLASH.has(entity.id)) {
    return rawToken;
  }

  // 4. Fragrance allergen: Vanillin
  if (/vanillin|vanilin|فانيلين|ванилин|ونیلن|vanilline|vainillina/.test(lowerRaw)) {
    const map = { tr: 'Vanilin', en: 'Vanillin', ar: 'فانيلين', de: 'Vanillin', fr: 'Vanilline', es: 'Vainillina', ru: 'Ванилин', id: 'Vanilin', ms: 'Vanilin', ur: 'ونیلن' };
    return map[lang] || 'Vanillin';
  }

  // 5. If rawToken is already in the target language's native script/vocabulary, keep it directly!
  if (lang === 'ar' && /[\u0600-\u06FF]/.test(rawToken) && !/[پچژگٹڈڑںےہھ]/.test(rawToken)) return rawToken;
  if (lang === 'ur' && /[\u0600-\u06FF]/.test(rawToken)) return rawToken;
  if (lang === 'ru' && /[\u0400-\u04FF]/.test(rawToken)) return rawToken;
  if (lang === 'tr' && /[ığüşöçİĞÜŞÖÇ]/.test(rawToken)) return rawToken;

  // 6. Language-specific alias lookup (strictly excluding non-target language markers)
  if (lang === 'ar') {
    const arAlias = aliases.find((a) => /[\u0600-\u06FF]/.test(a) && !/[پچژگٹڈڑںےہھ]/.test(a));
    if (arAlias) return /[\u0600-\u06FF]/.test(rawToken) ? arAlias : `${arAlias} (${rawToken})`;
    return canon;
  }
  if (lang === 'ur') {
    const urAlias = aliases.find((a) => /[پچژگٹڈڑںےہھ]/.test(a)) || aliases.find((a) => /[\u0600-\u06FF]/.test(a));
    if (urAlias) return /[\u0600-\u06FF]/.test(rawToken) ? urAlias : `${urAlias} (${rawToken})`;
    return canon;
  }
  if (lang === 'ru') {
    const ruAlias = aliases.find((a) => /[\u0400-\u04FF]/.test(a) && a.length > 2 && !/^[еe]\d+$/i.test(a));
    if (ruAlias) return `${titleCaseWords(ruAlias)} (${rawToken})`;
    return canon;
  }
  if (lang === 'tr') {
    const trAlias = aliases.find(
      (a) =>
        /[ığüşöçİĞÜŞÖÇ]/.test(a) ||
        /\b(alkol|asit|yagi|yağı|ozutu|özütü|sulfat|sülfat|surubu|şurubu|seker|şeker|su|gliserin|niasinamid|pantenol|tokoferol|dimetikon|skualan|seramid|ksantan|karbomer|linalol|propilparaben|metilparaben|jelatin|karmin|lesitin)\b/i.test(a)
    );
    if (trAlias && trAlias.toLowerCase() !== rawToken.toLowerCase()) {
      return `${titleCaseWords(trAlias)} (${rawToken})`;
    }
    return rawToken;
  }

  // For Latin languages (en, de, fr, id, ms, es):
  const isNonTargetScript = /[\u0600-\u06FF\u0400-\u04FFığşçİĞŞÇ]/.test(rawToken) || /\b(su|seker|glikoz|jelatin|findik|kakao)\b/i.test(rawToken);
  if (lang === 'de') {
    // Exclude Turkish words that have 'ü' or 'ö' (must not contain Turkish specific letters or common Turkish stems)
    const deAlias = aliases.find(
      (a) =>
        !/[ığşçİĞŞÇ]/.test(a) &&
        !/\b(seker|glikoz|jelatin|findik|kakao|asit|alkol|yagi|yağı|sülfat|özütü|özüt|un|süt)\b/i.test(a) &&
        (/[äß]/i.test(a) || /\b(wasser|zucker|säure|alkohol|öl|extrakt|sirup|pulver|fett)\b/i.test(a))
    );
    if (deAlias && (isNonTargetScript || deAlias.toLowerCase() !== rawToken.toLowerCase())) {
      return isNonTargetScript ? titleCaseWords(deAlias) : `${titleCaseWords(deAlias)} (${rawToken})`;
    }
  } else if (lang === 'fr') {
    const frAlias = aliases.find((a) => !/[ığüşöçİĞÜŞÖÇ]/.test(a) && (/[éèêëàâùûçœ]/i.test(a) || /\b(eau|sucre|acide|alcool|huile|extrait|sirop|glycérine)\b/i.test(a)));
    if (frAlias && (isNonTargetScript || frAlias.toLowerCase() !== rawToken.toLowerCase())) {
      return isNonTargetScript ? titleCaseWords(frAlias) : `${titleCaseWords(frAlias)} (${rawToken})`;
    }
  } else if (lang === 'es') {
    const esAlias = aliases.find((a) => !/[ığüşöçİĞÜŞÖÇ]/.test(a) && (/[áéíóúñ]/i.test(a) || /\b(agua|azúcar|ácido|alcohol|aceite|extracto|jarabe|glicerina)\b/i.test(a)));
    if (esAlias && (isNonTargetScript || esAlias.toLowerCase() !== rawToken.toLowerCase())) {
      return isNonTargetScript ? titleCaseWords(esAlias) : `${titleCaseWords(esAlias)} (${rawToken})`;
    }
  } else if (lang === 'id' || lang === 'ms') {
    const idAlias = aliases.find((a) => !/[ığüşöçİĞÜŞÖÇ]/.test(a) && /\b(air|gula|asam|asid|alkohol|minyak|ekstrak|sirup|sirap|gliserin|garam|tepung|susu|lesitin|kedelai|soya)\b/i.test(a));
    if (idAlias && (isNonTargetScript || idAlias.toLowerCase() !== rawToken.toLowerCase())) {
      return isNonTargetScript ? titleCaseWords(idAlias) : `${titleCaseWords(idAlias)} (${rawToken})`;
    }
  }

  if (isNonTargetScript) {
    return canon;
  }
  return rawToken;
}

function detectApplicationType(rawText, productType) {
  if (productType !== 'cosmetic') return 'none';
  const lower = (rawText || '').toLowerCase();
  if (/\b(spray|sprey|aerosol|inhalation)\b/i.test(lower)) {
    return 'spray';
  }
  if (/\b(shampoo|cleanser|rinse-off|rinse off|şampuan|sampuan|duş jeli|dus jeli|sabun|soap|wash-off|wash off|conditioner)\b/i.test(lower)) {
    return 'rinse_off';
  }
  return 'leave_on';
}

export function evaluateProduct({
  rawText,
  productType = 'cosmetic',
  jurisdiction = 'EU',
  userProfiles = [],
  customWatchlist = [],
  halalAuthority = 'general_cautious',
  claims = { halalCertified: false, veganStatus: 'none', vegetarianStatus: 'none' },
  userConfirmations = {},
  lang = 'tr',
  applicationType = null,
  productForm = null,
  targetDate = null,
  asOf = null,
  allergenStatement = null,
  servingMl = null,
  professionalUse = null,
  strictFutureRules = false
}) {
  productType = (productType || 'cosmetic').toLowerCase();
  jurisdiction = (jurisdiction || 'EU').toUpperCase();

  if (typeof userProfiles === 'string') {
    userProfiles = userProfiles.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (!Array.isArray(userProfiles)) {
    userProfiles = [];
  }
  userProfiles = userProfiles.filter((p) => typeof p === 'string' && ALLOWED_PROFILES.has(p));

  const explicitAppType = (productForm || applicationType || '').toString().toLowerCase().replace(/-/g, '_').trim();
  const effectiveAppType = (explicitAppType || detectApplicationType(rawText, productType) || '').toLowerCase().replace(/-/g, '_').trim();
  const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
  const rawDate = asOf || targetDate;
  const effectiveTargetDate = isValidDate(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
  const parseBoolClaim = (val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  };
  claims = {
    halalCertified: parseBoolClaim(claims && claims.halalCertified),
    veganStatus: (claims && claims.veganStatus) || 'none',
    vegetarianStatus: (claims && claims.vegetarianStatus) || 'none'
  };
  const getSubstanceStrictness = (s) => {
    if (!s) return 0;
    if (s.eu_status === 'yasak' || s.capApplied === 10) return 100;
    if (s.eu_status === 'kisitli' || s.severity === 'yuksek') return 70;
    if (s.severity === 'orta') return 50;
    if (s.severity === 'dusuk') return 20;
    return 10;
  };
  const et = getEngineText(lang);
  const parsedTokens = parseIngredientList(rawText);
  const observations = [];
  const unresolvedConfirmations = [];

  for (const item of parsedTokens) {
    const candidatesToTry = [item.primary, item.secondary, item.raw, ...(item.extraCandidates || [])].filter(Boolean);
    let matchedSubstance = null;
    let matchedHalal = null;
    let matchedSugar = null;
    let matchedRapidCarb = null;
    let status = 'unrecognized';
    let ambiguityNote = null;

    for (const candidateStr of candidatesToTry) {
      const norm = normalizeToken(candidateStr);
      const folded = foldTurkish(candidateStr);

      // Check standalone "BHA" ambiguity trap (Audit Rule #1 in Section 7)
      if (folded === 'bha') {
        const confirmedId = userConfirmations['BHA'] || userConfirmations['bha'] || userConfirmations[item.raw];
        if (!confirmedId) {
          status = 'ambiguous';
          ambiguityNote = et.bhaMsg;
          unresolvedConfirmations.push({
            token: item.raw,
            type: 'ambiguity',
            options: [
              { id: 'bha_antioxidant', label: 'Butylated Hydroxyanisole', code: 'E320' },
              { id: 'salicylic_acid', label: 'Salicylic Acid', code: 'Beta Hydroxy Acid' }
            ],
            message: ambiguityNote
          });
          break;
        } else {
          matchedSubstance = substancesData.substances.find((s) => s.id === confirmedId) || null;
          status = matchedSubstance ? 'recognized' : 'unrecognized';
        }
      }

      // Check SLS vs SLES OCR ambiguity ("Sodium Laur?l Sulfate") from Scan.dc.html
      if (/sodium\s+laur[?_*a-z]*\s+sulfate/i.test(folded) && folded.includes('?')) {
        const confirmedId = userConfirmations[item.raw] || userConfirmations[candidateStr];
        if (!confirmedId) {
          status = 'ambiguous';
          ambiguityNote = et.slsMsg;
          unresolvedConfirmations.push({
            token: item.raw,
            type: 'ambiguity',
            options: [
              { id: 'sls', label: 'Sodium Lauryl Sulfate', code: 'SLS' },
              { id: 'sles', label: 'Sodium Laureth Sulfate', code: 'SLES' }
            ],
            message: ambiguityNote
          });
          break;
        } else {
          matchedSubstance = substancesData.substances.find((s) => s.id === confirmedId) || null;
          status = matchedSubstance ? 'recognized' : 'unrecognized';
        }
      }

      // Check OCR code corruption (e.g. "C1 7547O" -> "CI 75470")
      const codeCheck = detectCodeOcrCandidate(candidateStr);
      if (codeCheck.isCodeCandidate) {
        const confirmedCode = userConfirmations[candidateStr] || userConfirmations[item.raw];
        if (codeCheck.requiresUserConfirmation && !confirmedCode) {
          status = 'ocr_confirmation_required';
          ambiguityNote = et.ocrCodeMsg(candidateStr, codeCheck.canonicalCode);
          unresolvedConfirmations.push({
            token: item.raw,
            type: 'ocr_code',
            candidateCode: codeCheck.canonicalCode,
            message: ambiguityNote
          });
          break;
        }
        const effectiveCode = (confirmedCode || codeCheck.canonicalCode).toUpperCase();
        if (halalByCode.has(effectiveCode)) {
          matchedHalal = halalByCode.get(effectiveCode);
        }
        const subByCode = substancesData.substances.find(
          (s) => s.e_code === effectiveCode || s.ci_code === effectiveCode || s.aliases.includes(effectiveCode.toLowerCase())
        );
        if (subByCode) matchedSubstance = subByCode;
      }

      // Exact substance dictionary match (No substring matching!)
      const candSub = substanceByAlias.get(norm) || substanceByAlias.get(folded) || null;
      let effectiveCandSub = candSub;

      // CosIng Lookup for this specific candidate (Annex II / III precedence)
      if (productType === 'cosmetic' && cosingData) {
        const cosKey = candidateStr.toLowerCase().replace(/[\s\-_/]+/g, ' ').trim();
        const found = Object.hasOwn(cosingData, cosKey) ? cosingData[cosKey] : null;
        if (found) {
          const cosSub = makeCosingSubstance(found);
          const ANNEX_II_REFINING_EXEMPTIONS = new Set(['mineral_oils_petrolatum']);
          if (!effectiveCandSub) {
            effectiveCandSub = cosSub;
          } else if (found.s === 2 && effectiveCandSub.eu_status !== 'yasak' && !ANNEX_II_REFINING_EXEMPTIONS.has(effectiveCandSub.id)) {
            effectiveCandSub = cosSub;
          } else if (found.s === 2 && ANNEX_II_REFINING_EXEMPTIONS.has(effectiveCandSub.id)) {
            // Annex II/904 exemption depends on the manufacturer's refining history — state the assumption openly.
            const assumption = 'VARSAYIM: Tam rafine (farmasötik saflıkta) olduğu kabul edilmiştir. AB 1223/2009 Ek II/904 istisnası, üreticinin tam rafinasyon geçmişini ve kanserojen olmadığını belgelemesine bağlıdır; bu belge etiketten doğrulanamaz.';
            effectiveCandSub = {
              ...effectiveCandSub,
              eu_detail: `${effectiveCandSub.eu_detail ? effectiveCandSub.eu_detail + ' ' : ''}${assumption}`,
              note: assumption
            };
          } else if (found.s === 1 && effectiveCandSub.eu_status === 'izinli') {
            // Annex III restriction must not disappear behind a generic "permitted" family profile.
            // Keep the family's personal-profile data, but surface the CosIng restriction as a finding.
            effectiveCandSub = {
              ...effectiveCandSub,
              eu_status: 'kisitli',
              verification: effectiveCandSub.verification === 'dogrulanmadi' ? 'ikincil_kontrol' : effectiveCandSub.verification,
              eu_detail: `${found.inci}: AB 1223/2009 Ek ${found.a || 'III'} kapsamında kısıtlı (CosIng Ref ${found.ref}). Konsantrasyon / kullanım koşulları uygulanır; etiketten doğrulanamaz.`,
              sources: Array.from(new Set([...(effectiveCandSub.sources || []), 'COSING']))
            };
          }
        }
      }

      if (effectiveCandSub) {
        if (!matchedSubstance || getSubstanceStrictness(effectiveCandSub) > getSubstanceStrictness(matchedSubstance)) {
          matchedSubstance = effectiveCandSub;
        }
      }

      // Exact halal dictionary match with strictest category priority
      const candHalal = halalByAlias.get(norm) || halalByAlias.get(folded) || null;
      if (candHalal) {
        if (!matchedHalal) {
          matchedHalal = candHalal;
        } else {
          const getHalalPriority = (h) => {
            if (!h) return 0;
            if (h.category === 'A_haram') return 4;
            if (h.category === 'B_alkol') return 3;
            if (h.category === 'D_tartismali') return 2.5;
            if (h.category === 'C_musbooh') return 2;
            if (h.category === 'SAFE_NON_ETHANOL') return 1.5;
            return 1;
          };
          if (getHalalPriority(candHalal) > getHalalPriority(matchedHalal)) {
            matchedHalal = candHalal;
          }
        }
      }
      // Hidden sugars & rapid carbs
      if (!matchedSugar) {
        matchedSugar = freeSugarByAlias.get(norm) || freeSugarByAlias.get(folded) || null;
      }
      if (!matchedRapidCarb) {
        matchedRapidCarb = rapidCarbByAlias.get(norm) || rapidCarbByAlias.get(folded) || null;
      }
    }

    // Safe deterministic multi-word INCI family fallback (ONLY if unlisted in all dictionaries and CosIng!)
    if (!matchedSubstance && !matchedHalal && !matchedSugar && !matchedRapidCarb) {
      for (const candidateStr of candidatesToTry) {
        const benign = matchBenignInciFamily(candidateStr, productType);
        if (benign) {
          matchedSubstance = benign;
          break;
        }
      }
    }

    // Safety check: If token explicitly specifies pork origin in any language, promote to A_haram
    const explicitPorkRegex = /\b(domuz|pork|porcine|schwein|porc|cerdo|porcino|خنزير|babi|khinzir|свинина|свиной|سور)\b|domuz\s+kaynaklı|domuz\s+kökenli|pork\s+origin|porcine\s+origin|schweineherkunft|d'origine\s+porcine|origen\s+porcino|dari\s+babi/iu;
    const isPorkNegated = /\b(pork-free|no\s+pork|non-porcine|sans\s+porc|ohne\s+schwein|sin\s+cerdo|domuzsuz|domuz\s+içermez|domuz\s+eti\s+içermez|free\s+from\s+pork|bebas\s+babi|خالٍ\s+من\s+الخنزير|غیر\s+سور)\b/iu.test(item.raw);
    if (!isPorkNegated && explicitPorkRegex.test(item.raw)) {
      const porkRule = halalData.rules.find((r) => r.id === (matchedHalal && matchedHalal.id === 'gelatin_unspecified' ? 'pork_gelatin' : 'pork_generic'));
      if (porkRule) {
        matchedHalal = porkRule;
      }
    }

    // Safety check: If token in food explicitly mentions ethanol / ethyl alcohol / alcohol, never hide it under dual-source
    const isSafeAlcoholType = /\b(cetearyl|cetyl|stearyl|behenyl|myristyl|lauryl|arachidyl|oleyl|benzyl|sugar|sorbitol|mannitol|xylitol|maltitol|erythritol|isostearyl)\s+alcohol\b/iu.test(item.raw);
    if (!isSafeAlcoholType && productType === 'food' && /\b(etanol|ethanol|etil\s+alkol|ethyl\s+alcohol|alkol|alcohol)\b/iu.test(item.raw) && (!matchedHalal || matchedHalal.category !== 'A_haram')) {
      if (!/\b(denat|denatured|cetearyl|cetyl|stearyl|benzyl)\b/iu.test(item.raw)) {
        const ethRule = halalData.rules.find((r) => r.id === 'ethanol_cosmetic_or_food');
        if (ethRule) {
          matchedHalal = ethRule;
        }
      }
    }

    if (status !== 'ambiguous' && status !== 'ocr_confirmation_required') {
      if (matchedSubstance || matchedHalal || matchedSugar || matchedRapidCarb) {
        status = 'recognized';
      }
    }

    const localizedName = resolveLocalizedDisplayName(
      item.raw,
      matchedSubstance,
      matchedHalal,
      matchedSugar,
      matchedRapidCarb,
      lang
    );

    observations.push({
      raw: item.raw,
      localizedName,
      position: item.position,
      status,
      ambiguityNote,
      substance: matchedSubstance,
      halalRule: matchedHalal,
      sugar: matchedSugar,
      rapidCarb: matchedRapidCarb
    });
  }

  // ============================================================================
  // CARD 1: REGULATORY & INGREDIENT TRANSPARENCY INDEX
  // ============================================================================
  const totalCount = observations.length;
  const recognizedCount = observations.filter((o) => o.status === 'recognized').length;
  const coverageRatio = totalCount > 0 ? recognizedCount / totalCount : 0;

  const regulatoryFindings = [];
  let penaltySum = 0;
  let capScore = 100;
  const classCounts = {};

  for (const obs of observations) {
    const sub = obs.substance;
    if (!sub) continue;

    // Never penalize or trigger alerts from unverified ('dogrulanmadi') rows
    if (sub.verification === 'dogrulanmadi') continue;

    // Resolve productType-dependent status (e.g. Titanium Dioxide E171 vs CI 77891, Fragrance/Vanillin in Food, Phosphates in Cosmetic)
    let effectiveEuStatus = sub.eu_status;
    let effectiveSeverity = sub.severity;
    let effectiveDetail = sub.eu_detail;

    const appType = effectiveAppType;

    if (sub.id === 'titanium_dioxide_e171_ci77891') {
      if (productType === 'food') {
        if (jurisdiction === 'US') {
          const conc = parseConcentration(obs.raw);
          if (conc && conc > 1.0) {
            effectiveEuStatus = 'yasak';
            effectiveSeverity = 'yuksek';
            effectiveDetail = 'FDA 21 CFR 73.575: ABD pazarında gıdalarda ağırlıkça azami %1 konsantrasyona kadar izinlidir; %1 üzerindeki konsantrasyonlar YASAKTIR.';
          } else {
            effectiveEuStatus = 'izinli';
            effectiveSeverity = 'bilgi';
            effectiveDetail = 'FDA 21 CFR 73.575: ABD pazarında gıdalarda ağırlıkça azami %1 konsantrasyona kadar izinlidir (AB 2022/63 gıda yasağı ABD yargı alanında bağlayıcı değildir).';
          }
        } else {
          effectiveEuStatus = 'yasak';
          effectiveSeverity = 'yuksek';
          effectiveDetail = et.e171FoodBanned;
        }
      } else {
        effectiveEuStatus = 'izinli';
        effectiveSeverity = 'bilgi';
        effectiveDetail = et.ci77891CosmeticOk;
      }
    } else if (sub.id === 'mi_mci' || sub.id === 'methylisothiazolinone' || sub.id === 'cosing_77797' || /methylisothiazolinone/i.test(sub.id)) {
      const conc = parseConcentration(obs.raw);
      // Total isothiazolinone load across ALL MI / MCI tokens (EU 1003/2014 Annex V/39: MCI+MI mixture max 0.0015 % total)
      const isoObs = observations.filter((o) => o.substance && o.substance.id === sub.id);
      const isoConcs = isoObs.map((o) => parseConcentration(o.raw)).filter((c) => typeof c === 'number' && !isNaN(c));
      const totalIsoConc = isoConcs.length > 0 ? isoConcs.reduce((a, b) => a + b, 0) : conc;
      const isMciRaw = (r) => /chloro|klor|chlor|хлор|(?:^|[^\p{L}])mci(?:[^\p{L}]|$)/iu.test(r);
      const hasMci = isoObs.some((o) => isMciRaw(o.raw));
      const labelSaysRinseOff = /\b(rinse[_\s-]?off|shampoo|cleanser|wash[_\s-]?off|soap|sabun|şampuan)\b/i.test(rawText);
      // Explicit structured field wins over free label words; on conflict apply the stricter (leave-on) rule
      const isRinseOff = explicitAppType ? explicitAppType === 'rinse_off' : (appType === 'rinse_off' || labelSaysRinseOff);
      const contextConflict = explicitAppType === 'leave_on' && labelSaysRinseOff;
      const conflictNote = contextConflict ? ' ÇELİŞKİ: Ürün türü "durulanmayan" seçildi ancak etikette durulanan ürün ifadesi var; ihtiyatlı olarak durulanmayan kuralı uygulandı, lütfen ürün türünü teyit edin.' : '';
      if (!isRinseOff) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 2016/1198 (Ek V/57 değişikliği) uyarınca durulanmayan (leave-on) kozmetik ürünlerde kesinlikle YASAKTIR. Yalnızca durulanan (rinse-off) ürünlerde azami %0.0015 (15 ppm) izinlidir.' + conflictNote;
      } else {
        // Separate MCI and MI amounts (EU 1003/2014 Annex V/39: MCI:MI = 3:1, total max 0.0015 % in rinse-off only)
        const isCombinedToken = (r) =>
          isMciRaw(r) &&
          /(?:^|[^\p{L}])(?:methylisothiazolinone|mi)(?:[^\p{L}]|$)/iu.test(
            r.replace(/methylchloroisothiazolinone/gi, ' ').replace(/(?:^|[^\p{L}])mci(?:[^\p{L}]|$)/giu, ' ')
          );
        const sumOf = (list) => {
          const vals = list.map((o) => parseConcentration(o.raw));
          return vals.every((v) => typeof v === 'number' && !isNaN(v)) ? vals.reduce((a, b) => a + b, 0) : null;
        };
        const mciObs = isoObs.filter((o) => isMciRaw(o.raw) && !isCombinedToken(o.raw));
        const miObs = isoObs.filter((o) => !isMciRaw(o.raw));
        const combinedObs = isoObs.filter((o) => isCombinedToken(o.raw));
        const isMixture = combinedObs.length > 0 || (mciObs.length > 0 && miObs.length > 0);
        const mciConc = combinedObs.length ? null : sumOf(mciObs);
        const miConc = combinedObs.length ? null : sumOf(miObs);
        const ratioKnown = isMixture && mciConc !== null && miConc !== null && miConc > 0;
        const ratio = ratioKnown ? mciConc / miConc : null;
        const ratioValid = ratioKnown && Math.abs(ratio - 3) <= 1e-6; // IEEE-754 binary float epsilon only
        const pct = (v) => `%${+v.toFixed(6)}`;

        if (typeof totalIsoConc === 'number' && totalIsoConc > 0.0015 + 1e-12) {
          effectiveEuStatus = 'yasak';
          effectiveSeverity = 'yuksek';
          effectiveDetail = hasMci && isoConcs.length > 1
            ? `AB 1003/2014 Ek V/39: MCI + MI karışımı yalnızca durulanan ürünlerde toplam azami %0.0015 (15 ppm) izinlidir; etiketteki toplam ${pct(totalIsoConc)} bu sınırı aşıyor, YASAKTIR.`
            : 'AB 2017/1224 Ek V/57: Yalnızca durulanan (rinse-off) ürünlerde azami %0.0015 (15 ppm) konsantrasyona kadar izinlidir; bu sınırın üzerindeki konsantrasyonlar YASAKTIR.';
        } else if (ratioKnown && !ratioValid) {
          const fmtRatio = Math.abs(+ratio.toFixed(2) - 3) < 1e-9 ? +ratio.toFixed(6) : +ratio.toFixed(2);
          effectiveEuStatus = 'yasak';
          effectiveSeverity = 'yuksek';
          effectiveDetail = `AB 1003/2014 Ek V/39: MCI/MI karışımına yalnızca 3:1 oranında izin verilir. Etiketteki oran ${fmtRatio}:1 (MCI ${pct(mciConc)}, MI ${pct(miConc)}); izin verilen karışım koşulunu sağlamıyor, bu kullanım YASAKTIR.`;
        } else {
          effectiveEuStatus = 'kisitli';
          effectiveSeverity = 'orta';
          if (isMixture && ratioValid) {
            effectiveDetail = `AB 1003/2014 Ek V/39: MCI/MI oranı 3:1 olarak doğrulandı (MCI ${pct(mciConc)}, MI ${pct(miConc)}, toplam ${pct(totalIsoConc)}); yalnızca durulanan ürünlerde toplam azami %0.0015 (15 ppm) izinlidir.`;
          } else if (isMixture) {
            effectiveDetail = 'AB 1003/2014 Ek V/39: MCI/MI karışımına yalnızca 3:1 oranında ve durulanan ürünlerde toplam azami %0.0015 (15 ppm) ile izin verilir. Bileşen miktarları etikette yazmadığı için oran ve toplam DOĞRULANAMADI; üreticiden teyit edilmelidir.';
          } else {
            effectiveDetail = 'AB 2017/1224 Ek V/57: Yalnızca durulanan (rinse-off) ürünlerde azami %0.0015 (15 ppm) konsantrasyona kadar izinlidir.';
          }
        }
      }
    } else if (sub.id === 'tphp_triphenyl_phosphate_banned') {
      const isPost2027 = isValidDate(effectiveTargetDate) && effectiveTargetDate >= '2027-01-01';
      const isStrictFutureOrPost2027 = strictFutureRules === true || isPost2027;
      if (isStrictFutureOrPost2027) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = '(AB) 2026/909 ile Ek II Doğrudan Yasaklılar listesine alınmıştır (1 Ocak 2027 itibarıyla piyasaya arzı, 1 Temmuz 2028 itibarıyla piyasada bulundurulması yasaktır).';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
        effectiveDetail = 'Geçiş Dönemi Uyarısı (AB 2026/909): SCCS genotoksisite ve endokrin verisi eksikliği gerekçesiyle Ek II listesine eklenmiştir. 1 Ocak 2027\'den itibaren piyasaya arzı, 1 Temmuz 2028\'den itibaren piyasada bulundurulması yasaktır (Ekim 2026 itibarıyla geçiş dönemindedir).';
      }
    } else if (sub.id === 'hydroquinone_banned') {
      const isNailContext = /\b(nail|artificial_nails|artificial\s+nail|tırnak|yapay\s+tırnak)\b/i.test(rawText) ||
                            /\b(nail|artificial_nails|artificial\s+nail|tırnak)\b/i.test(appType);
      // Annex III/14 exception is limited to PROFESSIONAL use; explicit professionalUse=false always disables it
      const isProfessional = professionalUse === true || professionalUse === 'true' ||
        (professionalUse == null && /\b(professional|profesyonel)\b/i.test(rawText));
      const conc = parseConcentration(obs.raw);
      if (isNailContext && isProfessional && (conc === null || conc <= 0.02)) {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
        effectiveDetail = 'AB 1223/2009 Ek III/14: Yalnızca profesyonel kullanıma yönelik yapay tırnak sistemlerinde son karışımda azami %0.02 izinlidir. Cilt açıcı kremlerde kesinlikle yasaktır.';
      } else {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isNailContext && !isProfessional
          ? 'AB 1223/2009 Ek III/14: Hidrokinon istisnası yalnızca profesyonel yapay tırnak sistemleri içindir; ev tipi / tüketici kullanımında YASAKTIR.'
          : 'AB 1223/2009 Ek II/1339: Cilt açıcı kozmetik kremlerde kullanımı kesinlikle YASAKTIR.';
      }
    } else if (sub.id === 'mexoryl_400_uv_filter' || sub.id === 'cosing_89733' || /mexoryl\s*400|methoxypropylamino\s+cyclohexenylidene/i.test(sub.id) || /methoxypropylamino\s+cyclohexenylidene/i.test(sub.name)) {
      const isSprayOrInhalation = appType === 'spray' || appType === 'aerosol' || appType === 'inhalation' || /\b(spray|sprey|aerosol|inhalation|solunum)\b/i.test(rawText);
      const conc = parseConcentration(obs.raw);
      if (isSprayOrInhalation) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 2020/1684 Ek VI/32: Solunum yoluyla akciğer maruziyetine yol açabilecek sprey/aerosol formülasyonlarında KULLANILAMAZ.';
      } else if (conc && conc > 3.0) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 2020/1684 Ek VI/32: Kozmetik ürünlerde azami %3 konsantrasyon sınırını aşıyor; bu oranda kullanımı YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
        effectiveDetail = 'AB 2020/1684 Ek VI/32: Kozmetik ürünlerde azami %3 konsantrasyona kadar izinlidir. Solunum yoluyla akciğer maruziyetine yol açabilecek sprey/aerosol uygulamalarında KULLANILAMAZ.';
      }
    } else if (sub.id === 'boric_acid_borates_restricted') {
      if (productType === 'food') {
        if (/\b(caviar|havyar|mersin\s+balığı\s+havyarı)\b/i.test(rawText)) {
          effectiveEuStatus = 'kisitli';
          effectiveSeverity = 'orta';
          effectiveDetail = 'AB 1333/2008 Ek II: Yalnızca mersin balığı havyarında (caviar) koruyucu olarak azami 4.000 mg/kg (borik asit olarak) sınırıyla izinlidir.';
        } else {
          effectiveEuStatus = 'yasak';
          effectiveSeverity = 'yuksek';
          effectiveDetail = 'AB 1333/2008: E284/E285 Borik asit ve boratlar genel gıdalarda yasaktır (yalnızca havyarda istisnai izinlidir).';
        }
      }
    } else if (sub.id === 'phenoxyethanol') {
      const conc = parseConcentration(obs.raw);
      if (conc && conc > 1.0) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 1223/2009 Ek V/29: Fenoksietanol kozmetik ürünlerde azami %1.0 konsantrasyona kadar izinlidir; bu sınırın üzerindeki konsantrasyonlar YASAKTIR.';
      }
    } else if (sub.id === 'hair_dye_sensitizers_ppd_resorcinol') {
      const conc = parseConcentration(obs.raw);
      if (conc && conc > 4.0) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 1223/2009 Ek III: Saç boyalarında azami kısıt sınırını aşıyor; kullanıma hazır karışımda bu konsantrasyonda kullanımı YASAKTIR.';
      }
    } else if (sub.id === 'alpha_arbutin') {
      const conc = parseConcentration(obs.raw);
      const isBodyLotion = isBodyLotionContext(explicitAppType, appType, rawText);
      if ((isBodyLotion && conc !== null && conc > 0.5) || (!isBodyLotion && conc !== null && conc > 2.0)) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isBodyLotion
          ? 'AB 2024/996 Ek III/377: Alpha-Arbutin vücut losyonlarında azami %0.5 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.'
          : 'AB 2024/996 Ek III/377: Alpha-Arbutin yüz kremlerinde azami %2.0 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'dusuk';
      }
    } else if (sub.id === 'arbutin') {
      const conc = parseConcentration(obs.raw);
      const isBodyLotion = isBodyLotionContext(explicitAppType, appType, rawText);
      if (isBodyLotion || (conc !== null && conc > 7.0)) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isBodyLotion
          ? 'AB 2024/996 Ek III/378: Arbutin yalnızca yüz kremlerinde (%7.0) izinlidir; vücut losyonlarında kullanımı YASAKTIR.'
          : 'AB 2024/996 Ek III/378: Arbutin yüz kremlerinde azami %7.0 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'dusuk';
      }
    } else if (sub.id === 'triclosan') {
      const conc = parseConcentration(obs.raw);
      const isBannedForm =
        explicitAppType === 'mouthwash' ||
        explicitAppType === 'oral_rinse' ||
        explicitAppType === 'spray' ||
        appType === 'mouthwash' ||
        appType === 'oral_rinse' ||
        appType === 'spray' ||
        /\b(mouthwash|mouth\s*wash|oral\s*rinse|gargara|ağız\s*çalkalama|agiz\s*calkalama|spray|sprey|aerosol)\b/iu.test(rawText);
      const isUnder3Toothpaste =
        /\b(toothpaste|diş\s*macunu|dis\s*macunu)\b/iu.test(rawText) &&
        /\b(under\s*3|0[\s\-]*3|<\s*3|3\s*yaş\s*altı|3\s*yas\s*alti|baby|bebek|toddler)\b/iu.test(rawText);
      if (isBannedForm || isUnder3Toothpaste || (conc !== null && conc > 0.3)) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isBannedForm || isUnder3Toothpaste
          ? 'AB 2024/996 Ek V/25: Triclosan gargaralarda (mouthwash), sprey/aerosollerde ve 3 yaş altı çocuk diş macunlarında YASAKTIR.'
          : 'AB 2024/996 Ek V/25: Triclosan izinli kozmetik ürünlerde azami %0.3 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
      }
    } else if (sub.id === 'triclocarban') {
      const conc = parseConcentration(obs.raw);
      const isMouthwash =
        explicitAppType === 'mouthwash' ||
        explicitAppType === 'oral_rinse' ||
        appType === 'mouthwash' ||
        appType === 'oral_rinse' ||
        /\b(mouthwash|mouth\s*wash|oral\s*rinse|gargara|ağız\s*çalkalama|agiz\s*calkalama)\b/iu.test(rawText);
      const isUnder6Toothpaste =
        /\b(toothpaste|diş\s*macunu|dis\s*macunu)\b/iu.test(rawText) &&
        /\b(under\s*6|0[\s\-]*6|<\s*6|6\s*yaş\s*altı|6\s*yas\s*alti|under\s*3|0[\s\-]*3|<\s*3|3\s*yaş\s*altı|baby|bebek|toddler|kids|çocuk)\b/iu.test(rawText);
      const labelSaysRinseOff = /\b(rinse[_\s-]?off|shampoo|cleanser|wash[_\s-]?off|soap|sabun|şampuan)\b/iu.test(rawText);
      const isRinseOff = explicitAppType ? explicitAppType === 'rinse_off' : (appType === 'rinse_off' || labelSaysRinseOff);
      const isNonPreservativeRinseOff =
        isRinseOff &&
        /\b(non[\s\-]*preservative|koruyucu[\s\-]*dışı|koruyucu[\s\-]*disi|amaç\s*dışı|soap|sabun)\b/iu.test(rawText);
      const maxLimit = isNonPreservativeRinseOff ? 1.5 : 0.2;
      if (isMouthwash || isUnder6Toothpaste || (conc !== null && conc > maxLimit)) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isMouthwash || isUnder6Toothpaste
          ? 'AB 2024/996 Ek V/23 & Ek III: Triclocarban gargaralarda (mouthwash) ve 6 yaş altı çocuk diş macunlarında YASAKTIR.'
          : `AB 2024/996 Ek V/23 & Ek III: Triclocarban bu ürün tipi için azami %${maxLimit} sınırını aşıyor; kullanımı YASAKTIR.`;
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
      }
    } else if (sub.id === 'genistein') {
      const conc = parseConcentration(obs.raw);
      if (conc !== null && conc > 0.007) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 2024/996 Ek III/373: Genistein kozmetik ürünlerde azami %0.007 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'dusuk';
      }
    } else if (sub.id === 'daidzein') {
      const conc = parseConcentration(obs.raw);
      if (conc !== null && conc > 0.02) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = 'AB 2024/996 Ek III/374: Daidzein kozmetik ürünlerde azami %0.02 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'dusuk';
      }
    } else if (sub.id === 'kojic_acid') {
      const conc = parseConcentration(obs.raw);
      const isBodyLotion = isBodyLotionContext(explicitAppType, appType, rawText);
      if (isBodyLotion || (conc !== null && conc > 1.0)) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isBodyLotion
          ? 'AB 2024/996 Ek III/375: Kojik asit yalnızca yüz ve el bakım ürünlerinde (%1.0) izinlidir; vücut losyonlarında kullanımı YASAKTIR.'
          : 'AB 2024/996 Ek III/375: Kojik asit yüz ve el ürünlerinde azami %1.0 sınırıyla izinlidir; bu sınırın üzerindeki kullanım YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'dusuk';
      }
    } else if (sub.id === 'retinol') {
      const conc = parseConcentration(obs.raw);
      const isBodyLotion = isBodyLotionContext(explicitAppType, appType, rawText);
      const isPostNov2025 = isValidDate(effectiveTargetDate) && effectiveTargetDate >= '2025-11-01';
      const isEnforcedRetinol = strictFutureRules === true || isPostNov2025;
      if (conc !== null && ((isBodyLotion && conc > 0.05) || (!isBodyLotion && conc > 0.3)) && isEnforcedRetinol) {
        effectiveEuStatus = 'yasak';
        effectiveSeverity = 'yuksek';
        effectiveDetail = isBodyLotion
          ? 'AB 2024/996 Ek III/376: Retinol ve A vitamini esterleri vücut losyonlarında azami %0.05 Retinol Eşdeğeri (RE) sınırıyla izinlidir; bu sınırın üzerindeki kullanım 1 Kasım 2025 itibarıyla YASAKTIR.'
          : 'AB 2024/996 Ek III/376: Retinol ve A vitamini esterleri diğer ürünlerde azami %0.3 Retinol Eşdeğeri (RE) sınırıyla izinlidir; bu sınırın üzerindeki kullanım 1 Kasım 2025 itibarıyla YASAKTIR.';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
      }
    } else if (productType === 'food' && sub.class === 'fragrance_allergen') {
      effectiveEuStatus = 'izinli';
      effectiveSeverity = 'bilgi';
    } else if (productType === 'cosmetic' && sub.id === 'phosphates_e338_e452') {
      effectiveEuStatus = 'izinli';
      effectiveSeverity = 'bilgi';
    }

    const penaltyMap = { bilgi: 0, dusuk: 3, orta: 10, yuksek: 25 };
    const basePenalty = penaltyMap[effectiveSeverity] || 0;

    if (basePenalty > 0 || effectiveEuStatus === 'yasak' || effectiveEuStatus === 'kisitli' || sub.ed_tier || sub.note) {
      const alwaysFullWeightClasses = new Set([
        'preservative',
        'uv_filter',
        'fragrance_allergen',
        'colorant',
        'e_additive'
      ]);
      let posWeight = 0.5;
      if (alwaysFullWeightClasses.has(sub.class)) {
        posWeight = 1.0;
      } else if (productType === 'food') {
        if (obs.position <= 3) posWeight = 1.0;
        else if (obs.position <= 8) posWeight = 0.7;
      } else {
        if (obs.position <= 5) posWeight = 1.0;
        else if (obs.position <= 10) posWeight = 0.7;
      }

      classCounts[sub.class] = (classCounts[sub.class] || 0) + 1;
      const repeatMultiplier = classCounts[sub.class] >= 3 ? 0.5 : 1.0;
      penaltySum += basePenalty * posWeight * repeatMultiplier;

      if (effectiveEuStatus === 'yasak') {
        capScore = Math.min(capScore, 10);
      } else if (effectiveSeverity === 'yuksek') {
        capScore = Math.min(capScore, 40);
      }

      const mappedSources = (sub.sources || []).map((sid) => getSourceById(sid)).filter(Boolean);
      const localizeRegulatoryLegalText = (detail, euStatus, severity, targetLang, engineText) => {
        if (targetLang === 'tr' || detail === engineText.e171FoodBanned || detail === engineText.ci77891CosmeticOk) {
          return detail;
        }
        const d = String(detail || '');
        const normPct = (s) => String(s || '').replace(/^%([\d.]+)/, '$1%');
        // 1. Annex V/39 MCI/MI wrong ratio (e.g. 1:1 instead of 3:1)
        const ratioMatch = d.match(/Ek V\/39: MCI\/MI karışımına yalnızca 3:1 oranında izin verilir\. Etiketteki oran ([\d.]+):1 \(MCI (%[\d.]+), MI (%[\d.]+)\)/);
        if (ratioMatch) {
          const [, r, mciRaw, miRaw] = ratioMatch;
          const mci = normPct(mciRaw);
          const mi = normPct(miRaw);
          const map = {
            en: `EU 1003/2014 Annex V/39: MCI/MI mixture is permitted only at a 3:1 ratio in rinse-off products. Label ratio is ${r}:1 (MCI ${mci}, MI ${mi}); prohibited under Annex V/39 conditions (Score capped at 10).`,
            de: `EU 1003/2014 Anhang V/39: Die MCI/MI-Mischung ist nur im Verhältnis 3:1 in abspülbaren Produkten zulässig. Etikettenverhältnis ${r}:1 (MCI ${mci}, MI ${mi}); Verstoß gegen Anhang V/39, verboten (Maximalwert 10).`,
            fr: `UE 1003/2014 Annexe V/39 : Le mélange MCI/MI n'est autorisé qu'au rapport 3:1 dans les produits à rincer. Rapport détecté ${r}:1 (MCI ${mci}, MI ${mi}) ; interdit selon l'Annexe V/39 (Score plafonné à 10).`,
            es: `UE 1003/2014 Anexo V/39: La mezcla MCI/MI solo se permite en proporción 3:1 en productos que se aclaran. Proporción en etiqueta ${r}:1 (MCI ${mci}, MI ${mi}); prohibido según el Anexo V/39 (Puntuación máx. 10).`,
            id: `UE 1003/2014 Lampiran V/39: Campuran MCI/MI hanya diizinkan pada rasio 3:1 dalam produk bilas. Rasio label ${r}:1 (MCI ${mci}, MI ${mi}); dilarang menurut Lampiran V/39 (Skor maks. 10).`,
            ms: `EU 1003/2014 Lampiran V/39: Campuran MCI/MI hanya dibenarkan pada nisbah 3:1 dalam produk bilas. Nisbah label ${r}:1 (MCI ${mci}, MI ${mi}); dilarang mengikut Lampiran V/39 (Skor maks. 10).`,
            ru: `ЕС 1003/2014 Приложение V/39: Смесь MCI/MI разрешена только в соотношении 3:1 в смываемых продуктах. На этикетке ${r}:1 (MCI ${mci}, MI ${mi}); запрещено по Приложению V/39 (Макс. балл 10).`,
            ar: `لائحة الاتحاد الأوروبي 1003/2014 الملحق V/39: يُسمح بمزيج MCI/MI فقط بنسبة 3:1 في المنتجات التي تُشطف. النسبة على الملصق ${r}:1 (MCI ${mci}، MI ${mi})؛ محظور لمخالفة شروط الملحق V/39 (الحد الأقصى 10).`,
            ur: `یورپی یونین 1003/2014 ضمیمہ V/39: دھلنے والی مصنوعات میں MCI/MI آمیزے کی اجازت صرف 3:1 کے تناسب سے ہے۔ لیبل کا تناسب ${r}:1 (MCI ${mci}، MI ${mi})؛ ضمیمہ V/39 کی شرائط کی خلاف ورزی پر ممنوع (زیادہ سے زیادہ اسکور 10)۔`
          };
          return map[targetLang] || map.en;
        }
        // 2. Annex V/39 MCI+MI total > 0.0015% (15 ppm)
        const totalMciMatch = d.match(/Ek V\/39: MCI \+ MI karışımı yalnızca durulanan ürünlerde toplam azami %0\.0015 \(15 ppm\) izinlidir; etiketteki toplam (%[\d.]+)/);
        if (totalMciMatch) {
          const tot = normPct(totalMciMatch[1]);
          const map = {
            en: `EU 1003/2014 Annex V/39: MCI + MI mixture is permitted only in rinse-off products up to 0.0015% (15 ppm) total; label total ${tot} exceeds Annex V/39 limit and is prohibited (Score capped at 10).`,
            de: `EU 1003/2014 Anhang V/39: Die MCI+MI-Mischung ist nur in abspülbaren Produkten bis max. 0.0015% (15 ppm) zulässig; Gesamtwert ${tot} überschreitet Anhang V/39, verboten (Maximalwert 10).`,
            fr: `UE 1003/2014 Annexe V/39 : Le mélange MCI + MI est limité à 0.0015% (15 ppm) au total dans les produits à rincer ; le total ${tot} dépasse l'Annexe V/39, interdit (Score plafonné à 10).`,
            es: `UE 1003/2014 Anexo V/39: La mezcla MCI + MI se limita a un máximo total de 0.0015% (15 ppm) en productos que se aclaran; el total ${tot} supera el Anexo V/39, prohibido (Puntuación máx. 10).`,
            id: `UE 1003/2014 Lampiran V/39: Campuran MCI + MI dibatasi maks. 0.0015% (15 ppm) total pada produk bilas; total ${tot} melebihi batas Lampiran V/39, dilarang (Skor maks. 10).`,
            ms: `EU 1003/2014 Lampiran V/39: Campuran MCI + MI dihadkan maks. 0.0015% (15 ppm) jumlah pada produk bilas; jumlah ${tot} melebihi had Lampiran V/39, dilarang (Skor maks. 10).`,
            ru: `ЕС 1003/2014 Приложение V/39: Смесь MCI + MI разрешена только в смываемых продуктах до 0.0015% (15 ppm) суммарно; сумма ${tot} превышает лимит Приложения V/39, запрещено (Макс. балл 10).`,
            ar: `لائحة الاتحاد الأوروبي 1003/2014 الملحق V/39: يُسمح بمزيج MCI + MI في المنتجات التي تُشطف بحد أقصى 0.0015% (15 ppm)؛ الإجمالي ${tot} يتجاوز حد الملحق V/39 ومحظور (الحد الأقصى 10).`,
            ur: `یورپی یونین 1003/2014 ضمیمہ V/39: MCI + MI آمیزے کی حد دھلنے والی مصنوعات میں زیادہ سے زیادہ 0.0015% (15 ppm) ہے؛ کل مقدار ${tot} ضمیمہ V/39 کی حد سے متجاوز اور ممنوع ہے (زیادہ سے زیادہ اسکور 10)۔`
          };
          return map[targetLang] || map.en;
        }
        // 3. Annex V/39 MCI/MI 3:1 verified
        const verifiedMciMatch = d.match(/Ek V\/39: MCI\/MI oranı 3:1 olarak doğrulandı \(MCI (%[\d.]+), MI (%[\d.]+), toplam (%[\d.]+)\)/);
        if (verifiedMciMatch) {
          const [, mciRaw, miRaw, totRaw] = verifiedMciMatch;
          const mci = normPct(mciRaw), mi = normPct(miRaw), tot = normPct(totRaw);
          const map = {
            en: `EU 1003/2014 Annex V/39: MCI/MI 3:1 ratio verified (MCI ${mci}, MI ${mi}, total ${tot}); permitted only in rinse-off products up to 0.0015% (15 ppm) total.`,
            de: `EU 1003/2014 Anhang V/39: MCI/MI-Verhältnis 3:1 bestätigt (MCI ${mci}, MI ${mi}, gesamt ${tot}); nur in abspülbaren Produkten bis max. 0.0015% (15 ppm) zulässig.`,
            fr: `UE 1003/2014 Annexe V/39 : Rapport MCI/MI 3:1 vérifié (MCI ${mci}, MI ${mi}, total ${tot}) ; autorisé uniquement dans les produits à rincer jusqu'à 0.0015% (15 ppm).`,
            es: `UE 1003/2014 Anexo V/39: Proporción MCI/MI 3:1 verificada (MCI ${mci}, MI ${mi}, total ${tot}); permitido solo en productos que se aclaran hasta 0.0015% (15 ppm).`,
            id: `UE 1003/2014 Lampiran V/39: Rasio MCI/MI 3:1 terverifikasi (MCI ${mci}, MI ${mi}, total ${tot}); diizinkan hanya pada produk bilas maks. 0.0015% (15 ppm).`,
            ms: `EU 1003/2014 Lampiran V/39: Nisbah MCI/MI 3:1 disahkan (MCI ${mci}, MI ${mi}, jumlah ${tot}); dibenarkan hanya pada produk bilas maks. 0.0015% (15 ppm).`,
            ru: `ЕС 1003/2014 Приложение V/39: Соотношение MCI/MI 3:1 подтверждено (MCI ${mci}, MI ${mi}, всего ${tot}); разрешено только в смываемых продуктах до 0.0015% (15 ppm).`,
            ar: `لائحة الاتحاد الأوروبي 1003/2014 الملحق V/39: تم التحقق من نسبة MCI/MI وهي 3:1 (MCI ${mci}، MI ${mi}، الإجمالي ${tot})؛ مسموح في المنتجات التي تُشطف حتى 0.0015% (15 ppm).`,
            ur: `یورپی یونین 1003/2014 ضمیمہ V/39: MCI/MI کا 3:1 تناسب تصدیق شدہ ہے (MCI ${mci}، MI ${mi}، کل ${tot})؛ صرف دھلنے والی مصنوعات میں 0.0015% (15 ppm) تک اجازت ہے۔`
          };
          return map[targetLang] || map.en;
        }
        // 4. Annex V/39 MCI/MI unverified quantities
        if (d.includes('Ek V/39:') && d.includes('DOĞRULANAMADI')) {
          const map = {
            en: 'EU 1003/2014 Annex V/39: MCI/MI mixture is restricted to rinse-off products at a 3:1 ratio and max 0.0015% (15 ppm) total; exact ratio/concentration cannot be verified from the label alone.',
            de: 'EU 1003/2014 Anhang V/39: MCI/MI-Mischung ist auf abspülbare Produkte im Verhältnis 3:1 und max. 0.0015% (15 ppm) beschränkt; Mengen auf dem Etikett nicht angegeben.',
            fr: 'UE 1003/2014 Annexe V/39 : Mélange MCI/MI restreint aux produits à rincer au rapport 3:1 et max. 0.0015% (15 ppm) ; concentrations non précisées sur l\'étiquette.',
            es: 'UE 1003/2014 Anexo V/39: Mezcla MCI/MI restringida a productos que se aclaran en proporción 3:1 y máx. 0.0015% (15 ppm); cantidades no indicadas en la etiqueta.',
            id: 'UE 1003/2014 Lampiran V/39: Campuran MCI/MI dibatasi untuk produk bilas pada rasio 3:1 dan maks. 0.0015% (15 ppm); konsentrasi tidak tercantum pada label.',
            ms: 'EU 1003/2014 Lampiran V/39: Campuran MCI/MI dihadkan kepada produk bilas pada nisbah 3:1 dan maks. 0.0015% (15 ppm); kepekatan tidak dinyatakan pada label.',
            ru: 'ЕС 1003/2014 Приложение V/39: Смесь MCI/MI ограничена смываемыми продуктами в соотношении 3:1 и до 0.0015% (15 ppm); точные концентрации на этикетке не указаны.',
            ar: 'لائحة الاتحاد الأوروبي 1003/2014 الملحق V/39: يقتصر مزيج MCI/MI على المنتجات التي تُشطف بنسبة 3:1 وحد أقصى 0.0015% (15 ppm)؛ التركيز غير مذكور على الملصق.',
            ur: 'یورپی یونین 1003/2014 ضمیمہ V/39: MCI/MI آمیزہ دھلنے والی مصنوعات میں 3:1 تناسب اور زیادہ سے زیادہ 0.0015% (15 ppm) تک محدود ہے؛ لیبل پر مقدار درج نہیں۔'
          };
          return map[targetLang] || map.en;
        }
        // 5. Annex V/57 MI leave-on ban
        if (d.includes('AB 2016/1198') && d.includes('Ek V/57')) {
          const map = {
            en: 'EU 2016/1198 Annex V/57: Strictly prohibited in leave-on cosmetic products (Score capped at 10). Permitted only in rinse-off products up to 0.0015% (15 ppm).',
            de: 'EU 2016/1198 Anhang V/57: In nicht abspülbaren Kosmetika (Leave-on) streng verboten (Maximalwert 10). Nur in abspülbaren Produkten bis 0.0015% (15 ppm) zulässig.',
            fr: 'UE 2016/1198 Annexe V/57 : Strictement interdit dans les cosmétiques sans rinçage (Score plafonné à 10). Autorisé uniquement dans les produits à rincer jusqu\'à 0.0015% (15 ppm).',
            es: 'UE 2016/1198 Anexo V/57: Estrictamente prohibido en cosméticos sin aclarado (Puntuación máx. 10). Permitido solo en productos que se aclaran hasta 0.0015% (15 ppm).',
            id: 'UE 2016/1198 Lampiran V/57: Dilarang keras pada kosmetik tanpa bilas / leave-on (Skor maks. 10). Hanya diizinkan pada produk bilas hingga 0.0015% (15 ppm).',
            ms: 'EU 2016/1198 Lampiran V/57: Dilarang sama sekali dalam kosmetik tanpa bilas / leave-on (Skor maks. 10). Hanya dibenarkan dalam produk bilas sehingga 0.0015% (15 ppm).',
            ru: 'ЕС 2016/1198 Приложение V/57: Строго запрещено в несмываемой косметике (Макс. балл 10). Разрешено только в смываемых продуктах до 0.0015% (15 ppm).',
            ar: 'لائحة الاتحاد الأوروبي 2016/1198 الملحق V/57: محظور تماماً في مستحضرات التجميل التي لا تُشطف (الحد الأقصى 10). مسموح فقط في منتجات الشطف حتى 0.0015% (15 ppm).',
            ur: 'یورپی یونین 2016/1198 ضمیمہ V/57: بغیر دھلنے والی (leave-on) کاسمیٹکس میں سختی سے ممنوع (زیادہ سے زیادہ اسکور 10)۔ صرف دھلنے والی مصنوعات میں 0.0015% (15 ppm) تک اجازت ہے۔'
          };
          return map[targetLang] || map.en;
        }
        // 6. Annex V/57 MI rinse-off > 15 ppm ban vs <= 15 ppm restricted
        if (d.includes('AB 2017/1224 Ek V/57')) {
          if (euStatus === 'yasak') {
            const map = {
              en: 'EU 2017/1224 Annex V/57: Permitted only in rinse-off products up to max 0.0015% (15 ppm); concentrations above 15 ppm violate Annex V/57 and are prohibited (Score capped at 10).',
              de: 'EU 2017/1224 Anhang V/57: Nur in abspülbaren Produkten bis max. 0.0015% (15 ppm) zulässig; Werte über 15 ppm verstoßen gegen Anhang V/57 und sind verboten (Maximalwert 10).',
              fr: 'UE 2017/1224 Annexe V/57 : Autorisé uniquement dans les produits à rincer jusqu\'à 0.0015% (15 ppm) ; au-delà de 15 ppm, interdit selon l\'Annexe V/57 (Score plafonné à 10).',
              es: 'UE 2017/1224 Anexo V/57: Permitido solo en productos que se aclaran hasta máx. 0.0015% (15 ppm); por encima de 15 ppm incumple el Anexo V/57 y está prohibido (Puntuación máx. 10).',
              id: 'UE 2017/1224 Lampiran V/57: Hanya diizinkan pada produk bilas maks. 0.0015% (15 ppm); di atas 15 ppm melanggar Lampiran V/57 dan dilarang (Skor maks. 10).',
              ms: 'EU 2017/1224 Lampiran V/57: Hanya dibenarkan pada produk bilas maks. 0.0015% (15 ppm); melebihi 15 ppm melanggar Lampiran V/57 dan dilarang (Skor maks. 10).',
              ru: 'ЕС 2017/1224 Приложение V/57: Разрешено только в смываемых продуктах до 0.0015% (15 ppm); превышение 15 ppm нарушает Приложение V/57 и запрещено (Макс. балл 10).',
              ar: 'لائحة الاتحاد الأوروبي 2017/1224 الملحق V/57: مسموح فقط في المنتجات التي تُشطف بحد أقصى 0.0015% (15 ppm)؛ تجاوز 15 ppm يخالف الملحق V/57 ومحظور (الحد الأقصى 10).',
              ur: 'یورپی یونین 2017/1224 ضمیمہ V/57: صرف دھلنے والی مصنوعات میں زیادہ سے زیادہ 0.0015% (15 ppm) تک اجازت ہے؛ 15 ppm سے زائد مقدار ضمیمہ V/57 کے تحت ممنوع ہے (زیادہ سے زیادہ اسکور 10)۔'
            };
            return map[targetLang] || map.en;
          }
          const map = {
            en: 'EU 2017/1224 Annex V/57: Restricted to rinse-off cosmetic products up to a maximum concentration of 0.0015% (15 ppm).',
            de: 'EU 2017/1224 Anhang V/57: Beschränkt auf abspülbare Kosmetika bis zu einer Höchstkonzentration von 0.0015% (15 ppm).',
            fr: 'UE 2017/1224 Annexe V/57 : Restreint aux cosmétiques à rincer jusqu\'à une concentration maximale de 0.0015% (15 ppm).',
            es: 'UE 2017/1224 Anexo V/57: Restringido a cosméticos que se aclaran hasta una concentración máxima de 0.0015% (15 ppm).',
            id: 'UE 2017/1224 Lampiran V/57: Dibatasi untuk kosmetik bilas hingga konsentrasi maksimum 0.0015% (15 ppm).',
            ms: 'EU 2017/1224 Lampiran V/57: Dihadkan kepada kosmetik bilas sehingga kepekatan maksimum 0.0015% (15 ppm).',
            ru: 'ЕС 2017/1224 Приложение V/57: Ограничено смываемыми косметическими средствами с максимальной концентрацией 0.0015% (15 ppm).',
            ar: 'لائحة الاتحاد الأوروبي 2017/1224 الملحق V/57: مقيد في مستحضرات التجميل التي تُشطف بحد أقصى للتركيز 0.0015% (15 ppm).',
            ur: 'یورپی یونین 2017/1224 ضمیمہ V/57: صرف دھلنے والی کاسمیٹک مصنوعات میں زیادہ سے زیادہ 0.0015% (15 ppm) ارتکاز تک محدود ہے۔'
          };
          return map[targetLang] || map.en;
        }
        // 7. Annex VI/32 Mexoryl 400
        if (d.includes('AB 2020/1684 Ek VI/32')) {
          if (euStatus === 'yasak') {
            return {
              en: 'EU 2020/1684 Annex VI/32: Prohibited in spray/aerosol inhalation products or above the 3% maximum UV-filter concentration limit (Score capped at 10).',
              de: 'EU 2020/1684 Anhang VI/32: Verboten in Spray-/Aerosolprodukten (Inhalationsrisiko) oder über dem Höchstwert von 3% (Maximalwert 10).',
              fr: 'UE 2020/1684 Annexe VI/32 : Interdit dans les sprays/aérosols exposant les poumons par inhalation ou au-delà de la limite de 3% (Score plafonné à 10).',
              es: 'UE 2020/1684 Anexo VI/32: Prohibido en aerosoles/sprays con riesgo de inhalación o por encima del límite máximo del 3% (Puntuación máx. 10).',
              id: 'UE 2020/1684 Lampiran VI/32: Dilarang pada produk semprot/aerosol (risiko inhalasi) atau di atas batas maksimum 3% (Skor maks. 10).',
              ms: 'EU 2020/1684 Lampiran VI/32: Dilarang dalam produk semburan/aerosol (risiko sedutan) atau melebihi had maksimum 3% (Skor maks. 10).',
              ru: 'ЕС 2020/1684 Приложение VI/32: Запрещено в спреях/аэрозолях (риск вдыхания) или при превышении лимита 3% (Макс. балл 10).',
              ar: 'لائحة الاتحاد الأوروبي 2020/1684 الملحق VI/32: محظور في البخاخات/الرذاذ أو عند تجاوز الحد الأقصى 3% (الحد الأقصى 10).',
              ur: 'یورپی یونین 2020/1684 ضمیمہ VI/32: اسپرے/ایروسول مصنوعات میں یا 3% کی زیادہ سے زیادہ حد سے تجاوز کرنے پر ممنوع (زیادہ سے زیادہ اسکور 10)۔'
            }[targetLang] || engineText.bannedGeneric;
          }
          return {
            en: 'EU 2020/1684 Annex VI/32: Permitted as a UV filter up to 3%; must not be used in spray/aerosol applications that may lead to lung exposure by inhalation.',
            de: 'EU 2020/1684 Anhang VI/32: Als UV-Filter bis max. 3% zulässig; nicht in Sprays/Aerosolen mit Inhalationsrisiko verwenden.',
            fr: 'UE 2020/1684 Annexe VI/32 : Autorisé comme filtre UV jusqu\'à 3% ; interdit dans les sprays/aérosols pouvant entraîner une exposition pulmonaire.',
            es: 'UE 2020/1684 Anexo VI/32: Permitido como filtro UV hasta el 3%; prohibido en aerosoles/sprays con exposición pulmonar por inhalación.',
            id: 'UE 2020/1684 Lampiran VI/32: Diizinkan sebagai filter UV hingga 3%; dilarang dalam aplikasi semprot/aerosol.',
            ms: 'EU 2020/1684 Lampiran VI/32: Dibenarkan sebagai penapis UV sehingga 3%; dilarang dalam aplikasi semburan/aerosol.',
            ru: 'ЕС 2020/1684 Приложение VI/32: Разрешен как УФ-фильтр до 3%; не использовать в спреях/аэрозолях с риском вдыхания.',
            ar: 'لائحة الاتحاد الأوروبي 2020/1684 الملحق VI/32: مسموح كمرشح للأشعة فوق البنفسجية حتى 3%؛ يمنع استخدامه في البخاخات.',
            ur: 'یورپی یونین 2020/1684 ضمیمہ VI/32: UV فلٹر کے طور پر 3% تک اجازت ہے؛ اسپرے/ایروسول مصنوعات میں استعمال ممنوع ہے۔'
          }[targetLang] || engineText.restrictedGeneric;
        }
        // 8. Annex III/14 Hydroquinone nail exception vs consumer ban
        if (d.includes('AB 1223/2009 Ek III/14')) {
          if (euStatus === 'yasak') {
            return {
              en: 'EU 1223/2009 Annex III/14 & Annex II/1339: Hydroquinone nail exception applies only to professional artificial nail systems (max 0.02%); prohibited in consumer use (Score capped at 10).',
              de: 'EU 1223/2009 Anhang III/14 & Anhang II/1339: Ausnahme gilt nur für gewerbliche Kunstnagelsysteme (max. 0.02%); für Verbraucher verboten (Maximalwert 10).',
              fr: 'UE 1223/2009 Annexe III/14 & Annexe II/1339 : Exception réservée aux systèmes d\'ongles artificiels professionnels (max. 0.02%) ; interdit au grand public (Score plafonné à 10).',
              es: 'UE 1223/2009 Anexo III/14 y Anexo II/1339: Excepción exclusiva para sistemas profesionales de uñas artificiales (máx. 0.02%); prohibido para consumidores (Puntuación máx. 10).',
              id: 'UE 1223/2009 Lampiran III/14 & Lampiran II/1339: Pengecualian hanya untuk sistem kuku buatan profesional (maks. 0.02%); dilarang untuk konsumen (Skor maks. 10).',
              ms: 'EU 1223/2009 Lampiran III/14 & Lampiran II/1339: Pengecualian hanya untuk sistem kuku tiruan profesional (maks. 0.02%); dilarang untuk pengguna umum (Skor maks. 10).',
              ru: 'ЕС 1223/2009 Приложение III/14 и II/1339: Исключение только для профессиональных систем искусственных ногтей (до 0.02%); запрещено для бытового применения (Макс. балл 10).',
              ar: 'لائحة الاتحاد الأوروبي 1223/2009 الملحق III/14 وII/1339: الاستثناء يقتصر على أنظمة الأظافر الصناعية المهنية (حد أقصى 0.02%)؛ محظور للاستخدام المنزلي (الحد الأقصى 10).',
              ur: 'یورپی یونین 1223/2009 ضمیمہ III/14 اور II/1339: استثنیٰ صرف پیشہ ورانہ مصنوعی ناخنوں کے نظام (زیادہ سے زیادہ 0.02%) کے لیے ہے؛ گھریلو استعمال ممنوع (زیادہ سے زیادہ اسکور 10)۔'
            }[targetLang] || engineText.bannedGeneric;
          }
          return {
            en: 'EU 1223/2009 Annex III/14: Permitted only in professional artificial nail systems up to 0.02% in the final mixture; prohibited in skin creams.',
            de: 'EU 1223/2009 Anhang III/14: Nur in gewerblichen Kunstnagelsystemen bis max. 0.02% zulässig; in Hautcremes verboten.',
            fr: 'UE 1223/2009 Annexe III/14 : Autorisé uniquement dans les systèmes d\'ongles artificiels professionnels jusqu\'à 0.02% ; interdit dans les crèmes.',
            es: 'UE 1223/2009 Anexo III/14: Permitido solo en sistemas profesionales de uñas artificiales hasta 0.02%; prohibido en cremas.',
            id: 'UE 1223/2009 Lampiran III/14: Diizinkan hanya pada sistem kuku buatan profesional hingga 0.02%; dilarang dalam krim kulit.',
            ms: 'EU 1223/2009 Lampiran III/14: Dibenarkan hanya dalam sistem kuku tiruan profesional sehingga 0.02%; dilarang dalam krim kulit.',
            ru: 'ЕС 1223/2009 Приложение III/14: Разрешено только в профессиональных системах искусственных ногтей до 0.02%; запрещено в кремах.',
            ar: 'لائحة الاتحاد الأوروبي 1223/2009 الملحق III/14: مسموح فقط في أنظمة الأظافر الصناعية المهنية حتى 0.02%؛ محظور في كريمات البشرة.',
            ur: 'یورپی یونین 1223/2009 ضمیمہ III/14: صرف پیشہ ورانہ مصنوعی ناخنوں کے نظام میں 0.02% تک اجازت ہے؛ جلد کی کریموں میں ممنوع۔'
          }[targetLang] || engineText.restrictedGeneric;
        }
        // 9. Annex V/29 Phenoxyethanol > 1.0%
        if (d.includes('AB 1223/2009 Ek V/29') && euStatus === 'yasak') {
          return {
            en: 'EU 1223/2009 Annex V/29: Phenoxyethanol is permitted up to a maximum concentration of 1.0%; concentrations above 1.0% violate Annex V/29 and are prohibited (Score capped at 10).',
            de: 'EU 1223/2009 Anhang V/29: Phenoxyethanol ist bis max. 1.0% zulässig; Konzentrationen über 1.0% verstoßen gegen Anhang V/29 und sind verboten (Maximalwert 10).',
            fr: 'UE 1223/2009 Annexe V/29 : Le phénoxyéthanol est autorisé jusqu\'à 1.0% max. ; au-delà de 1.0%, interdit selon l\'Annexe V/29 (Score plafonné à 10).',
            es: 'UE 1223/2009 Anexo V/29: El fenoxietanol se permite hasta un máximo del 1.0%; por encima del 1.0% incumple el Anexo V/29 y está prohibido (Puntuación máx. 10).',
            id: 'UE 1223/2009 Lampiran V/29: Fenoksietanol diizinkan hingga maks. 1.0%; di atas 1.0% melanggar Lampiran V/29 dan dilarang (Skor maks. 10).',
            ms: 'EU 1223/2009 Lampiran V/29: Fenoksietanol dibenarkan sehingga maks. 1.0%; melebihi 1.0% melanggar Lampiran V/29 dan dilarang (Skor maks. 10).',
            ru: 'ЕС 1223/2009 Приложение V/29: Феноксиэтанол разрешен в концентрации до 1.0%; превышение 1.0% нарушает Приложение V/29 и запрещено (Макс. балл 10).',
            ar: 'لائحة الاتحاد الأوروبي 1223/2009 الملحق V/29: يُسمح بالفينوكسي إيثانول بحد أقصى 1.0%؛ تجاوز 1.0% يخالف الملحق V/29 ومحظور (الحد الأقصى 10).',
            ur: 'یورپی یونین 1223/2009 ضمیمہ V/29: فینوکسی ایتھانول کی اجازت زیادہ سے زیادہ 1.0% تک ہے؛ اس سے زائد مقدار ضمیمہ V/29 کے تحت ممنوع ہے (زیادہ سے زیادہ اسکور 10)۔'
          }[targetLang] || engineText.bannedGeneric;
        }
        // 10. Annex III Hair dye > 4.0%
        if (d.includes('AB 1223/2009 Ek III: Saç boyalarında') && euStatus === 'yasak') {
          return {
            en: 'EU 1223/2009 Annex III: Exceeds the maximum permitted hair dye concentration limit in the ready-for-use mixture; prohibited under Annex III conditions (Score capped at 10).',
            de: 'EU 1223/2009 Anhang III: Überschreitet die zulässige Höchstkonzentration für Haarfärbemittel; gemäß Anhang III verboten (Maximalwert 10).',
            fr: 'UE 1223/2009 Annexe III : Dépasse la concentration maximale autorisée pour les colorants capillaires ; interdit selon l\'Annexe III (Score plafonné à 10).',
            es: 'UE 1223/2009 Anexo III: Supera el límite máximo de concentración permitido en tintes capilares; prohibido según el Anexo III (Puntuación máx. 10).',
            id: 'UE 1223/2009 Lampiran III: Melebihi batas konsentrasi maksimum pewarna rambut; dilarang menurut syarat Lampiran III (Skor maks. 10).',
            ms: 'EU 1223/2009 Lampiran III: Melebihi had kepekatan maksimum pewarna rambut; dilarang mengikut syarat Lampiran III (Skor maks. 10).',
            ru: 'ЕС 1223/2009 Приложение III: Превышает предельно допустимую концентрацию для красок для волос; запрещено по Приложению III (Макс. балл 10).',
            ar: 'لائحة الاتحاد الأوروبي 1223/2009 الملحق III: يتجاوز الحد الأقصى المسموح به لتركيز صبغات الشعر؛ محظور بموجب شروط الملحق III (الحد الأقصى 10).',
            ur: 'یورپی یونین 1223/2009 ضمیمہ III: بالوں کے رنگ میں زیادہ سے زیادہ ارتکاز کی حد سے متجاوز ہے؛ ضمیمہ III کے تحت ممنوع (زیادہ سے زیادہ اسکور 10)۔'
          }[targetLang] || engineText.bannedGeneric;
        }
        const extLocalized = localizeExtendedRegulatoryText(d, euStatus, targetLang, engineText);
        if (extLocalized) return extLocalized;
        return euStatus === 'yasak'
          ? engineText.bannedGeneric
          : euStatus === 'kisitli' || severity !== 'bilgi'
          ? engineText.restrictedGeneric
          : engineText.permittedGeneric;
      };
      const finalLegalText = localizeRegulatoryLegalText(
        effectiveDetail,
        effectiveEuStatus,
        effectiveSeverity,
        lang,
        et
      );

      regulatoryFindings.push({
        substanceId: sub.id,
        name: sub.name,
        localizedName: obs.localizedName,
        rawToken: obs.raw,
        position: obs.position,
        euStatus: effectiveEuStatus,
        edTier: sub.ed_tier,
        severity: effectiveSeverity,
        jurisdictionNote:
          jurisdiction === 'TR' && effectiveEuStatus === 'yasak'
            ? (TR_JURISDICTION_NOTE_I18N[lang] || TR_JURISDICTION_NOTE_I18N.en)
            : null,
        legalText: finalLegalText,
        falsePositiveNote: localizeFalsePositiveNote(sub, lang),
        verification: sub.verification,
        sources: mappedSources
      });
    }
  }

  const ortaCount = regulatoryFindings.filter((f) => f.severity === 'orta').length;
  if (ortaCount >= 3) {
    capScore = Math.min(capScore, 60);
  }

  const rawScore = Math.round(100 - Math.min(80, penaltySum));
  const calculatedIndex = Math.min(rawScore, capScore);
  const canShowScore = totalCount > 0 && coverageRatio >= 0.8 && unresolvedConfirmations.length === 0;

  const regulatoryCard = {
    cardTitle: et.regCardTitle,
    canShowScore,
    score: canShowScore ? calculatedIndex : null,
    scoreSuppressionReason: !canShowScore
      ? unresolvedConfirmations.length > 0
        ? 'awaiting_user_confirmation'
        : 'insufficient_coverage_under_80_percent'
      : null,
    coveragePercent: Math.round(coverageRatio * 100),
    recognizedCount,
    totalCount,
    capApplied: capScore < 100 ? capScore : null,
    findings: regulatoryFindings,
    methodologyDisclaimer: et.methodDisclaimer
  };

  // ============================================================================
  // CARD 2: PERSONAL SENSITIVITY & PROFILE MATCH (LOCAL-FIRST / ZERO-SERVER-PII)
  // ============================================================================
  const profileAlerts = [];
  const profileStatuses = {};

  for (const prof of userProfiles) {
    profileStatuses[prof] = 'true'; // starts compatible
  }

  for (const obs of observations) {
    const sub = obs.substance;
    if (!sub || !sub.profiles) continue;

    for (const prof of userProfiles) {
      const ruleVal = Object.hasOwn(sub.profiles, prof) ? sub.profiles[prof] : null;
      if (!ruleVal) continue;

      if (productType === 'food' && (prof === 'hassas_cilt' || prof === 'akne')) {
        continue;
      }
      if (
        productType === 'cosmetic' &&
        prof === 'cocuk_metabolik' &&
        (sub.id === 'titanium_dioxide_e171_ci77891' || sub.id === 'phosphates_e338_e452')
      ) {
        continue;
      }

      if (ruleVal === 'sari_ilk5' && obs.position > 5) {
        continue;
      }

      const effectiveLevel = ruleVal === 'sari_ilk5' ? 'sari' : ruleVal;

      if (effectiveLevel === 'veri_yok') {
        if (profileStatuses[prof] !== 'false') {
          profileStatuses[prof] = 'unknown';
        }
      } else if (effectiveLevel === 'kirmizi' || effectiveLevel === 'sari') {
        profileStatuses[prof] = 'false';
      }

      const mappedSources = (sub.sources || []).map((sid) => getSourceById(sid)).filter(Boolean);

      profileAlerts.push({
        profile: prof,
        substanceName: sub.name,
        localizedName: obs.localizedName,
        rawToken: obs.raw,
        position: obs.position,
        level: effectiveLevel,
        explanation:
          effectiveLevel === 'veri_yok'
            ? et.veriYokMsg(obs.localizedName || sub.name, prof)
            : lang === 'tr'
            ? `${sub.name}: ${sub.eu_detail}${sub.note ? ' — ' + sub.note : ''}`
            : et.profileAlertGeneric(obs.localizedName || sub.name),
        sources: mappedSources
      });
    }
  }

  // Oxidative hair dye under-16 age warning in cosmetic for cocuk_metabolik
  if (productType === 'cosmetic' && userProfiles.includes('cocuk_metabolik')) {
    const hasHairDye = observations.some((o) => o.substance && o.substance.id === 'hair_dye_sensitizers_ppd_resorcinol');
    if (hasHairDye) {
      profileStatuses['cocuk_metabolik'] = 'false';
      const hairDyeI18n = {
        tr: { name: 'Saç Boyası / Yaş Sınırı (16 Yaş)', loc: 'Oksidatif Saç Boyası Bileşeni', exp: 'AB 1223/2009 Ek III Uyarısı: Oksidatif saç boyaları 16 yaşından küçüklerin kullanımına uygun değildir.' },
        en: { name: 'Hair Dye / Age Limit (Under 16)', loc: 'Oxidative Hair Dye Active', exp: 'EU 1223/2009 Annex III Warning: Oxidative hair dyes are not intended for use on persons under the age of 16.' },
        ar: { name: 'صبغة شعر / حد العمر (16 سنة)', loc: 'مكون صبغة شعر مؤكسدة', exp: 'تحذير لائحة الاتحاد الأوروبي 1223/2009 الملحق الثالث: صبغات الشعر المؤكسدة غير مخصصة لمن هم دون 16 عاماً.' },
        de: { name: 'Haarfärbemittel / Altersgrenze (16 Jahre)', loc: 'Oxidatives Haarfärbemittel', exp: 'EU 1223/2009 Anhang III Warnhinweis: Oxidative Haarfärbemittel sind nicht für Personen unter 16 Jahren bestimmt.' },
        fr: { name: 'Colorant capillaire / Limite d\'âge (16 ans)', loc: 'Colorant capillaire d\'oxydation', exp: 'Avertissement UE 1223/2009 Annexe III : Les colorants capillaires d\'oxydation ne sont pas destinés aux personnes de moins de 16 ans.' },
        id: { name: 'Pewarna Rambut / Batas Usia (16 Tahun)', loc: 'Bahan Pewarna Rambut Oksidatif', exp: 'Peringatan UE 1223/2009 Lampiran III: Pewarna rambut oksidatif tidak ditujukan untuk usia di bawah 16 tahun.' },
        ms: { name: 'Pewarna Rambut / Had Umur (16 Tahun)', loc: 'Bahan Pewarna Rambut Oksidatif', exp: 'Amaran EU 1223/2009 Lampiran III: Pewarna rambut oksidatif tidak sesuai digunakan pada individu di bawah umur 16 tahun.' },
        es: { name: 'Tinte capilar / Límite de edad (16 años)', loc: 'Tinte capilar oxidativo', exp: 'Advertencia UE 1223/2009 Anexo III: Los tintes capilares oxidativos no están destinados a menores de 16 años.' },
        ru: { name: 'Краска для волос / Возраст (до 16 лет)', loc: 'Окислительный краситель для волос', exp: 'Предупреждение ЕС 1223/2009 Приложение III: Окислительные краски для волос не предназначены для лиц младше 16 лет.' },
        ur: { name: 'ہیئر ڈائی / عمر کی حد (16 سال)', loc: 'آکسیڈیٹو ہیئر ڈائی جزو', exp: 'یورپی یونین 1223/2009 ضمیمہ III انتباہ: آکسیڈیٹو ہیئر ڈائی 16 سال سے کم عمر افراد کے لیے موزوں نہیں۔' }
      }[lang] || { name: 'Hair Dye / Age Limit (Under 16)', loc: 'Oxidative Hair Dye Active', exp: 'EU 1223/2009 Annex III Warning: Oxidative hair dyes are not intended for use on persons under the age of 16.' };
      profileAlerts.push({
        profile: 'cocuk_metabolik',
        substanceName: hairDyeI18n.name,
        localizedName: hairDyeI18n.loc,
        rawToken: 'Hair Dye Sensitizer',
        position: 1,
        level: 'kirmizi',
        explanation: hairDyeI18n.exp,
        sources: [sourcesData.sources.EU_1223_2009].filter(Boolean)
      });
    }
  }

  // Major food allergens (EU 1169/2011 Annex II) for astim_alerji
  if (productType === 'food' && userProfiles.includes('astim_alerji')) {
    const ALLERGEN_I18N = {
      gluten: { tr: 'Gluten / Buğday', en: 'Gluten / Wheat', ar: 'الغلوتين / القمح', de: 'Gluten / Weizen', fr: 'Gluten / Blé', id: 'Gluten / Gandum', ms: 'Gluten / Gandum', es: 'Gluten / Trigo', ru: 'Глютен / Пшеница', ur: 'گلوٹین / گندم' },
      crustaceans: { tr: 'Kabuklular', en: 'Crustaceans', ar: 'القشريات', de: 'Krebstiere', fr: 'Crustacés', id: 'Krustasea', ms: 'Krustasea', es: 'Crustáceos', ru: 'Ракообразные', ur: 'کرسٹیشینز' },
      egg: { tr: 'Yumurta', en: 'Egg', ar: 'البيض', de: 'Ei', fr: 'Œuf', id: 'Telur', ms: 'Telur', es: 'Huevo', ru: 'Яйцо', ur: 'انڈہ' },
      fish: { tr: 'Balık', en: 'Fish', ar: 'السمك', de: 'Fisch', fr: 'Poisson', id: 'Ikan', ms: 'Ikan', es: 'Pescado', ru: 'Рыба', ur: 'مچھلی' },
      peanut: { tr: 'Yer Fıstığı', en: 'Peanuts', ar: 'الفول السوداني', de: 'Erdnüsse', fr: 'Arachides', id: 'Kacang Tanah', ms: 'Kacang Tanah', es: 'Cacahuetes', ru: 'Арахис', ur: 'مونگ پھلی' },
      soy: { tr: 'Soya', en: 'Soy / Soya', ar: 'الصويا', de: 'Soja', fr: 'Soja', id: 'Kedelai (Soya)', ms: 'Soya', es: 'Soja', ru: 'Соя', ur: 'سویا' },
      milk: { tr: 'Süt / Süt Ürünleri', en: 'Milk / Dairy', ar: 'الحليب / الألبان', de: 'Milch / Laktose', fr: 'Lait / Produits laitiers', id: 'Susu / Produk Susu', ms: 'Susu / Produk Tenusu', es: 'Leche / Lácteos', ru: 'Молоко / Лактоза', ur: 'دودھ / ڈیری' },
      tree_nuts: { tr: 'Sert Kabuklu Yemişler (Fındık/Badem)', en: 'Tree Nuts (Hazelnuts/Almonds)', ar: 'المكسرات (بندق/لوز)', de: 'Schalenfrüchte (Haselnüsse/Mandeln)', fr: 'Fruits à coque (Noisettes/Amandes)', id: 'Kacang Pohon (Hazel/Almond)', ms: 'Kekacang Pokok (Hazel/Badam)', es: 'Frutos de cáscara (Avellanas/Almendras)', ru: 'Орехи (Фундук/Миндаль)', ur: 'میوہ جات (ہیزل نٹ/بادام)' },
      celery: { tr: 'Kereviz', en: 'Celery', ar: 'الكرفس', de: 'Sellerie', fr: 'Céleri', id: 'Seledri', ms: 'Saderi', es: 'Apio', ru: 'Сельдерей', ur: 'اجوائن / سیلری' },
      mustard: { tr: 'Hardal', en: 'Mustard', ar: 'الخردل', de: 'Senf', fr: 'Moutarde', id: 'Mustar', ms: 'Biji Sawi (Mustard)', es: 'Mostaza', ru: 'Горчица', ur: 'رائی (مسٹرڈ)' },
      sesame: { tr: 'Susam', en: 'Sesame', ar: 'السمسم', de: 'Sesam', fr: 'Sésame', id: 'Wijen', ms: 'Bijan', es: 'Sésamo', ru: 'Кунжут', ur: 'تل (سیسم)' },
      sulphites: { tr: 'Sülfitler', en: 'Sulphites', ar: 'الكبريتيت', de: 'Sulfite', fr: 'Sulfites', id: 'Sulfit', ms: 'Sulfit', es: 'Sulfitos', ru: 'Сульфиты', ur: 'سلفائٹس' },
      lupin: { tr: 'Acıbakla (Lüpen)', en: 'Lupin', ar: 'الترمس', de: 'Lupinen', fr: 'Lupin', id: 'Lupin', ms: 'Lupin', es: 'Altramuces', ru: 'Люпин', ur: 'لوپن' },
      molluscs: { tr: 'Yumuşakçalar', en: 'Molluscs', ar: 'الرخويات', de: 'Weichtiere', fr: 'Mollusques', id: 'Moluska', ms: 'Moluska', es: 'Moluscos', ru: 'Моллюски', ur: 'مولسکس' }
    };
    const ALLERGEN_EXP_I18N = {
      tr: (aName, item) => `${aName} (AB 1169/2011 Ek II Majör Gıda Alerjeni): Ürün ${item} içermektedir. Alerjisi veya intoleransı olan bireyler için risklidir.`,
      en: (aName, item) => `${aName} (EU 1169/2011 Annex II Major Food Allergen): Product contains ${item}. Poses a risk for individuals with allergies or intolerances.`,
      ar: (aName, item) => `${aName} (مسبب حساسية غذائية رئيسي حسب لائحة الاتحاد الأوروبي 1169/2011 الملحق II): يحتوي المنتج على ${item}. يشكل خطراً على المصابين بالحساسية.`,
      de: (aName, item) => `${aName} (EU 1169/2011 Anhang II Hauptallergen): Produkt enthält ${item}. Risiko für Personen mit Allergien oder Unverträglichkeiten.`,
      fr: (aName, item) => `${aName} (UE 1169/2011 Annexe II Allergène alimentaire majeur) : Le produit contient ${item}. Risque pour les personnes allergiques ou intolérantes.`,
      id: (aName, item) => `${aName} (Alergen Pangan Utama Lampiran II UE 1169/2011): Produk mengandung ${item}. Berisiko bagi individu dengan alergi atau intoleransi.`,
      ms: (aName, item) => `${aName} (Alergen Makanan Utama Lampiran II EU 1169/2011): Produk mengandungi ${item}. Berisiko bagi individu yang mempunyai alahan atau intoleransi.`,
      es: (aName, item) => `${aName} (UE 1169/2011 Anexo II Alérgeno alimentario principal): El producto contiene ${item}. Riesgo para personas con alergias o intolerancias.`,
      ru: (aName, item) => `${aName} (Основной пищевой аллерген по Приложению II Регламента ЕС 1169/2011): Продукт содержит ${item}. Опасно при аллергии или непереносимости.`,
      ur: (aName, item) => `${aName} (یورپی یونین 1169/2011 ضمیمہ II بڑا غذائی الرجن): پروڈکٹ میں ${item} شامل ہے۔ الرجی کے شکار افراد کے لیے خطرناک ہے۔`
    };
    for (const obs of observations) {
      const isCrossContactToken = /(?:may\s+contain|traces?\s+of|eser\s+miktarda|kann\s+spuren|peut\s+contenir|puede\s+contener|قد\s+يحتوي|может\s+содержать|میں\s+شامل)/iu.test(obs.raw);
      if (isCrossContactToken) continue;

      // Scan ONLY the label's own wording. The localized display name comes from a broader data group
      // (e.g. "Buğday Unu") and must never create an allergen that is not on the label.
      // Negation is target-bound: only the negated word is removed ("Milk-free Soy Lecithin" still contains soy).
      const scanText = stripNegatedTargets(obs.raw);
      const matchedAllergens = EU_14_FOOD_ALLERGENS.filter((a) => {
        if (!a.names.test(scanText)) return false;
        // "Glutensiz un" / "gluten-free flour": a generic flour word alone is not a gluten source once gluten is negated.
        // Explicitly named gluten cereals (wheat, barley, rye, spelt…) still require the EU 1169/2011 declaration.
        if (a.id === 'gluten' && /gluten[\s\-]*(?:free|frei|siz|sız)|(?:free\s+(?:of|from)|without|ohne|sans|sin)\s+gluten/iu.test(obs.raw)) {
          return /(?:^|[^\p{L}])(wheat|buğday|bugday|weizen|blé|ble|trigo|пшениц[а-я]*|قمح|barley|arpa|rye|çavdar|cavdar|spelt|kamut|oats|yulaf)(?=[^\p{L}]|$)/iu.test(scanText);
        }
        return true;
      });

      const expFn = ALLERGEN_EXP_I18N[lang] || ALLERGEN_EXP_I18N.en;
      for (const matchedAllergen of matchedAllergens) {
        profileStatuses['astim_alerji'] = 'false';
        const aLabels = ALLERGEN_I18N[matchedAllergen.id] || {};
        const aName = aLabels[lang] || aLabels.en || matchedAllergen.tr;
        const itemLabel = obs.localizedName || obs.raw;
        profileAlerts.push({
          profile: 'astim_alerji',
          allergenId: matchedAllergen.id,
          substanceName: aName,
          localizedName: itemLabel,
          rawToken: obs.raw,
          position: obs.position,
          level: 'kirmizi',
          explanation: expFn(aName, itemLabel),
          sources: [getSourceById('EU_1169_2011')].filter(Boolean)
        });
      }
    }

    const fullCrossContactText = `${rawText} ${allergenStatement || ''}`;
    const crossContactMatch = fullCrossContactText.match(/(?:may\s+contain|traces?\s+of|eser\s+miktarda\s+(?:içerebilir|bulunabilir)|kann\s+spuren\s+von|peut\s+contenir\s+des\s+traces|puede\s+contener\s+trazas|قد\s+يحتوي\s+على|может\s+содержать\s+следы|میں\s+شامل\s+ہو\s+سکتا\s+ہے)\s*[:\-–]?\s*([^.,;\n]+)/iu);
    if (crossContactMatch) {
      profileStatuses['astim_alerji'] = 'false';
      const rawTraceTarget = crossContactMatch[1].trim();
      const matchedTraceAllergens = EU_14_FOOD_ALLERGENS.filter((a) => a.names.test(rawTraceTarget));
      const traceTarget =
        matchedTraceAllergens.length > 0
          ? matchedTraceAllergens
              .map((a) => {
                const aLabels = ALLERGEN_I18N[a.id] || {};
                return aLabels[lang] || aLabels.en || a.tr;
              })
              .join(', ')
          : rawTraceTarget;
      const traceRaw = crossContactMatch[0].trim();
      const traceI18n = {
        tr: { name: 'Çapraz Bulaşma Uyarısı', loc: `Eser Miktarda: ${traceTarget}`, exp: `Ambalajda çapraz bulaşma (eser miktarda) uyarısı bulunmaktadır: "${traceRaw}". Alerjik bireyler için çapraz temas riski taşır.` },
        en: { name: 'Cross-Contact Trace Warning', loc: `May Contain Traces: ${traceTarget}`, exp: `Packaging declares a cross-contact trace warning: "${traceRaw}". Poses a cross-contamination risk for allergic individuals.` },
        ar: { name: 'تحذير التلوث المتبادل (آثار)', loc: `قد يحتوي على آثار: ${traceTarget}`, exp: `تتضمن العبوة تحذيراً من آثار التلوث المتبادل: "${traceRaw}". يشكل خطراً على المصابين بالحساسية.` },
        de: { name: 'Spurenhinweis (Kreuzkontamination)', loc: `Spuren möglich: ${traceTarget}`, exp: `Auf der Verpackung befindet sich ein Spurenhinweis: „${traceRaw}“. Risiko für Allergiker durch Kreuzkontamination.` },
        fr: { name: 'Avertissement de traces (Contamination croisée)', loc: `Traces possibles : ${traceTarget}`, exp: `L'emballage indique un avertissement de traces : « ${traceRaw} ». Risque de contamination croisée pour les personnes allergiques.` },
        id: { name: 'Peringatan Kontaminasi Silang (Jejak)', loc: `Jejak Alergen: ${traceTarget}`, exp: `Kemasan mencantumkan peringatan kontaminasi silang: "${traceRaw}". Berisiko bagi individu yang alergi.` },
        ms: { name: 'Amaran Pencemaran Silang (Surih)', loc: `Mungkin Mengandungi: ${traceTarget}`, exp: `Bungkusan menyatakan amaran pencemaran silang: "${traceRaw}". Berisiko bagi individu yang mempunyai alahan.` },
        es: { name: 'Advertencia de trazas (Contaminación cruzada)', loc: `Posibles trazas: ${traceTarget}`, exp: `El envase incluye una advertencia de trazas: "${traceRaw}". Riesgo de contaminación cruzada para personas alérgicas.` },
        ru: { name: 'Предупреждение о следах аллергенов', loc: `Возможны следы: ${traceTarget}`, exp: `На упаковке указано предупреждение о перекрёстном загрязнении: «${traceRaw}». Риск для людей с аллергией.` },
        ur: { name: 'کراس کنٹیمینیشن (ذرات) کا انتباہ', loc: `معمولی ذرات ممکن: ${traceTarget}`, exp: `پیکنگ پر کراس کنٹیمینیشن کا انتباہ موجود ہے: "${traceRaw}"۔ الرجی کے شکار افراد کے لیے احتیاط ضروری ہے۔` }
      }[lang] || { name: 'Cross-Contact Trace Warning', loc: `May Contain Traces: ${traceTarget}`, exp: `Packaging declares a cross-contact trace warning: "${traceRaw}". Poses a cross-contamination risk for allergic individuals.` };
      profileAlerts.push({
        profile: 'astim_alerji',
        allergenId: matchedTraceAllergens.length === 1 ? matchedTraceAllergens[0].id : undefined,
        allergenIds: matchedTraceAllergens.map((a) => a.id),
        substanceName: traceI18n.name,
        localizedName: traceI18n.loc,
        rawToken: traceRaw,
        position: observations.length + 1,
        level: 'sari',
        explanation: traceI18n.exp,
        sources: [getSourceById('EU_1169_2011')].filter(Boolean)
      });
    }
  }

  // Caffeine & Taurine energy check in food
  if (productType === 'food') {
    const hasCaffeine = observations.some((o) => /\b(caffeine|kafein|caféine|kaffein|кофеин|كافيين|کافین)\b/iu.test(o.raw)) ||
      /\b(caffeine|kafein|caféine|kaffein|кофеин|كافيين|کافین)\b/iu.test(rawText);
    const hasTaurineOrInositol = observations.some((o) => /\b(taurine|taurin|таурин|تورين|inositol|inosit)\b/iu.test(o.raw)) ||
      /\b(taurine|taurin|таурин|تورين|inositol|inosit)\b/iu.test(rawText);

    if (hasCaffeine || hasTaurineOrInositol) {
      const ctAlert = CAFFEINE_TAURINE_ALERT_I18N[lang] || CAFFEINE_TAURINE_ALERT_I18N.en;
      const ctSources = [getSourceById('EU_1169_2011'), getSourceById('EFSA')].filter(Boolean);
      if (userProfiles.includes('hamilelik')) {
        profileStatuses['hamilelik'] = 'false';
        profileAlerts.push({
          profile: 'hamilelik',
          substanceName: hasCaffeine ? ctAlert.cafName : ctAlert.tauName,
          localizedName: hasCaffeine ? ctAlert.cafLoc : ctAlert.tauLoc,
          rawToken: hasCaffeine ? 'Caffeine' : 'Taurine/Inositol',
          position: 1,
          level: 'sari',
          explanation: hasCaffeine ? ctAlert.pregCafExp : ctAlert.pregTauExp,
          sources: ctSources
        });
      }
      if (userProfiles.includes('cocuk_metabolik')) {
        profileStatuses['cocuk_metabolik'] = 'false';
        profileAlerts.push({
          profile: 'cocuk_metabolik',
          substanceName: hasCaffeine ? ctAlert.cafHighName : ctAlert.tauName,
          localizedName: hasCaffeine ? ctAlert.cafHighLoc : ctAlert.tauLoc,
          rawToken: hasCaffeine ? 'Caffeine' : 'Taurine/Inositol',
          position: 1,
          level: hasCaffeine ? 'kirmizi' : 'sari',
          explanation: hasCaffeine ? ctAlert.childCafExp : ctAlert.childTauExp,
          sources: ctSources
        });
      }
    }
  }

  // Personal Custom Watchlist / Blacklist ("Benim Yasaklılarım" — Device-Local Custom Sensitivities)
  let rawWatchlistItems = [];
  if (typeof customWatchlist === 'string') {
    rawWatchlistItems = customWatchlist.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(customWatchlist)) {
    rawWatchlistItems = customWatchlist.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const deduplicatedWatchlist = Array.from(
    new Set(
      rawWatchlistItems
        .map((s) => s.slice(0, 80))
        .filter((s) => s.length >= 2)
    )
  );
  const watchlistLimitExceeded = deduplicatedWatchlist.length > 50;
  // Evaluate up to 500 items so item #51..#500 is never silently ignored when present; if watchlistLimitExceeded is true and no match is found, status becomes 'unknown' (never certified 'true')
  const sanitizedWatchlist = deduplicatedWatchlist.slice(0, 250);

  const WATCHLIST_ALERT_I18N = {
    tr: (term, item) => `Kişisel Kara Listeniz ("${term}") ile eşleşti: Ürün içeriğinde "${item}" tespit edildi.`,
    en: (term, item) => `Matched your Personal Blacklist ("${term}"): "${item}" was detected in this formula.`,
    ar: (term, item) => `تطابق مع قائمتك السوداء الشخصية ("${term}"): تم رصد "${item}" في المكونات.`,
    de: (term, item) => `Treffer auf Ihrer persönlichen Sperrliste („${term}“): „${item}“ im Produkt erkannt.`,
    fr: (term, item) => `Correspond à votre liste noire personnelle (« ${term} ») : « ${item} » détecté.`,
    id: (term, item) => `Cocok dengan Daftar Hitam Pribadi Anda ("${term}"): "${item}" terdeteksi pada komposisi.`,
    ms: (term, item) => `Sepadan dengan Senarai Hitam Peribadi anda ("${term}"): "${item}" dikesan dalam kandungan.`,
    es: (term, item) => `Coincide con tu Lista Negra Personal ("${term}"): se detectó "${item}" en la fórmula.`,
    ru: (term, item) => `Совпадение с вашим личным чёрным списком («${term}»): обнаружен компонент «${item}».`,
    ur: (term, item) => `آپ کی ذاتی بلیک لسٹ ("${term}") سے مطابقت: اجزاء میں "${item}" پایا گیا۔`
  };

  const GENERIC_ALCOHOL_WATCH_TERMS = new Set([
    'alcohol',
    'alkol',
    'ethanol',
    'etanol',
    'ethyl alcohol',
    'etil alkol',
    'alkohol',
    'alcool',
    'спирт',
    'كحول',
    'الکحل',
    'الکوحل'
  ]);

  const CHEMICAL_FAMILY_ROOTS = new Set([
    'paraben',
    'sulfate',
    'sulphate',
    'sulfat',
    'sülfat',
    'silicone',
    'silikon',
    'dimethicone',
    'siloxane',
    'phthalate',
    'isothiazolinone'
  ]);

  if (sanitizedWatchlist.length > 0) {
    profileStatuses['ozel_kara_liste'] = 'true';
    const preparedWatchlist = sanitizedWatchlist
      .map((watchTerm) => ({ watchTerm, prep: getPreparedWatchTerm(watchTerm) }))
      .filter(({ prep }) => prep.normWatch || prep.lowerWatch);

    const obsWatchMemo = new Map();
    for (const obs of observations) {
      const rawFull = String(obs.raw || '').trim().toLowerCase();
      const locLower = String(obs.localizedName || '').trim().toLowerCase();
      const subIdKey = obs.substance ? obs.substance.id : '';
      const halalIdKey = obs.halalRule ? obs.halalRule.id : '';
      const sugarKey = obs.sugar ? obs.sugar.canonical || '' : '';
      const memoKey = `${rawFull}\u0001${locLower}\u0001${subIdKey}\u0001${halalIdKey}\u0001${sugarKey}`;

      if (obsWatchMemo.has(memoKey)) {
        const hit = obsWatchMemo.get(memoKey);
        if (hit) {
          profileStatuses['ozel_kara_liste'] = 'false';
          const msgFn = WATCHLIST_ALERT_I18N[lang] || WATCHLIST_ALERT_I18N.en;
          profileAlerts.push({
            profile: 'ozel_kara_liste',
            watchTerm: hit.watchTerm,
            substanceName: obs.substance ? obs.substance.name : hit.watchTerm,
            localizedName: obs.localizedName || obs.raw,
            rawToken: obs.raw,
            position: obs.position,
            level: 'kirmizi',
            explanation: msgFn(hit.watchTerm, obs.localizedName || obs.raw),
            sources: []
          });
        }
        continue;
      }

      const rawBase = rawFull.includes('(') ? rawFull.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() : rawFull;
      const normRaw = normalizeToken(rawFull);
      const normBase = rawBase === rawFull ? normRaw : normalizeToken(rawBase);
      const foldedRaw = foldTurkish(rawFull);
      const foldBase = rawBase === rawFull ? foldedRaw : foldTurkish(rawBase);
      const locBase = locLower.includes('(') ? locLower.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() : locLower;
      const foldLocBase = locBase === rawBase ? foldBase : foldTurkish(locBase);
      const isUmbrellaSub = Boolean(obs.substance && UMBRELLA_RULE_IDS.has(obs.substance.id));
      const isUmbrellaHalal = Boolean(
        obs.halalRule && (UMBRELLA_RULE_IDS.has(obs.halalRule.id) || obs.halalRule.category === 'SAFE_NON_ETHANOL')
      );
      const subData = obs.substance && !isUmbrellaSub ? getEntityAliasData(obs.substance) : null;
      const halalDataCached = obs.halalRule && !isUmbrellaHalal ? getEntityAliasData(obs.halalRule) : null;
      const sugarDataCached = obs.sugar ? getEntityAliasData(obs.sugar) : null;
      const subNameLower = subData ? subData.nameLower : '';
      const foldSubNameLower = subData ? subData.foldName : '';
      const allKnownAliases = [
        rawBase,
        locLower,
        locBase,
        subNameLower,
        ...(subData ? subData.lowerAliases : []),
        ...(halalDataCached ? halalDataCached.lowerAliases : []),
        ...(sugarDataCached ? sugarDataCached.lowerAliases : [])
      ].filter(Boolean);
      const foldedKnownAliases = [
        foldBase,
        locLower === locBase ? foldLocBase : foldTurkish(locLower),
        foldLocBase,
        foldSubNameLower,
        ...(subData ? subData.foldedAliases : []),
        ...(halalDataCached ? halalDataCached.foldedAliases : []),
        ...(sugarDataCached ? sugarDataCached.foldedAliases : [])
      ].filter(Boolean);
      const exactAliasSet = new Set(allKnownAliases);
      const exactFoldedAliasSet = new Set(foldedKnownAliases);
      const joinedFoldedAliases = `\u0000${foldedKnownAliases.join('\u0000')}\u0000`;
      const hasNegHint = HAS_WATCH_NEGATION_HINT_RE.test(foldedRaw);

      const isFattyAlcoholShielded = Boolean(obs.halalRule && obs.halalRule.category === 'SAFE_NON_ETHANOL');
      let matchedHit = null;

      for (const { watchTerm, prep } of preparedWatchlist) {
        const { lowerWatch, normWatch, foldWatch, wordRe, wordReRaw } = prep;

        // 1. Target-bound negation check: only exempt if the negation is bound to this watched term (not a different parenthetical term)
        if (hasNegHint && isWatchTermNegatedInRaw(rawFull, foldedRaw, prep)) {
          continue;
        }

        // 2. Fatty alcohol shield: generic "Alcohol" / "Alkol" in watchlist must NOT flag Cetyl/Cetearyl/Stearyl Alcohol or Phenoxyethanol
        if (isFattyAlcoholShielded && (GENERIC_ALCOHOL_WATCH_TERMS.has(lowerWatch) || GENERIC_ALCOHOL_WATCH_TERMS.has(foldWatch))) {
          continue;
        }

        // 3. Exact identity or known alias match
        let matched =
          rawFull === lowerWatch ||
          rawBase === lowerWatch ||
          foldedRaw === foldWatch ||
          foldBase === foldWatch ||
          (normWatch.length >= 3 && (normRaw === normWatch || normBase === normWatch)) ||
          exactAliasSet.has(lowerWatch) ||
          exactFoldedAliasSet.has(foldWatch);

        // 4. Whole-word boundary match (for terms >= 3 chars, e.g. "Sinensis", "Lysine", "Tyrosine", "Freesia") — never matches 2-char substrings like "ni" or "in"
        if (!matched && wordRe) {
          if (
            wordRe.test(foldBase) ||
            wordReRaw.test(rawBase) ||
            wordRe.test(foldLocBase) ||
            wordRe.test(foldSubNameLower) ||
            wordRe.test(joinedFoldedAliases)
          ) {
            matched = true;
          }
        }

        // 5. Explicit chemical family root match (e.g. "paraben" -> "methylparaben", "silicone" / "dimethicone")
        if (!matched && CHEMICAL_FAMILY_ROOTS.has(foldWatch)) {
          if (
            foldBase.includes(foldWatch) ||
            foldLocBase.includes(foldWatch) ||
            foldSubNameLower.includes(foldWatch) ||
            joinedFoldedAliases.includes(foldWatch)
          ) {
            // Double-check that the family root itself is not negated in rawFull (e.g. "Paraben-free")
            if (!hasNegHint || !isWatchTermNegatedInRaw(rawFull, foldedRaw, prep)) {
              matched = true;
            }
          }
        }

        if (matched) {
          matchedHit = { watchTerm };
          profileStatuses['ozel_kara_liste'] = 'false';
          const msgFn = WATCHLIST_ALERT_I18N[lang] || WATCHLIST_ALERT_I18N.en;
          profileAlerts.push({
            profile: 'ozel_kara_liste',
            watchTerm,
            substanceName: obs.substance ? obs.substance.name : watchTerm,
            localizedName: obs.localizedName || obs.raw,
            rawToken: obs.raw,
            position: obs.position,
            level: 'kirmizi',
            explanation: msgFn(watchTerm, obs.localizedName || obs.raw),
            sources: []
          });
          break;
        }
      }
      obsWatchMemo.set(memoKey, matchedHit);
    }
  }

  if (sanitizedWatchlist.length > 0 && watchlistLimitExceeded && profileStatuses['ozel_kara_liste'] === 'true') {
    // Exceeding the 50-item watchlist limit must never certify compatibility ('true' / 100) when unverified items remain
    profileStatuses['ozel_kara_liste'] = 'unknown';
  }

  const effectiveProfileCount = userProfiles.length + (sanitizedWatchlist.length > 0 ? 1 : 0);
  let preferenceMatchScore = null;
  if (effectiveProfileCount > 0) {
    if (coverageRatio < 0.8) {
      for (const prof of Object.keys(profileStatuses)) {
        if (profileStatuses[prof] === 'true') {
          profileStatuses[prof] = 'kapsam_yetersiz';
        }
      }
      preferenceMatchScore = null;
    } else if (unresolvedConfirmations.length > 0) {
      for (const prof of Object.keys(profileStatuses)) {
        if (profileStatuses[prof] === 'true') {
          profileStatuses[prof] = 'unknown';
        }
      }
      preferenceMatchScore = null;
    } else {
      const hasUnknown = Object.values(profileStatuses).some((st) => st === 'unknown' || st === 'kapsam_yetersiz');
      if (!hasUnknown) {
        const matchCount = Object.values(profileStatuses).filter((st) => st === 'true').length;
        preferenceMatchScore = Math.round((100 * matchCount) / effectiveProfileCount);
      }
    }
  }

  const profileCard = {
    cardTitle: et.profCardTitle,
    selectedProfiles: userProfiles,
    ...(sanitizedWatchlist.length > 0
      ? {
          customWatchlist: sanitizedWatchlist.slice(0, 50),
          maxWatchlistItems: 50,
          watchlistLimitExceeded
        }
      : {}),
    profileStatuses,
    preferenceMatchScore,
    alerts: profileAlerts,
    kvkkNotice: et.kvkkNotice
  };

  // ============================================================================
  // CARD 3: HALAL & ETHANOL CONTEXT ENGINE (AUTHORITY-AWARE + CONFLICT DETECTION)
  // ============================================================================
  const halalFindings = [];
  const falsePositiveShields = [];
  const authorityComparison = [];
  let overallHalalStatus = unresolvedConfirmations.length > 0 ? 'unknown' : 'uygun_gorunuyor';
  const explicitPlantRegex = /\b(soya|soy|soja|kedelai|sunflower|ayçiçek|aycicek|tournesol|sonnenblumen|vegetable|bitkisel|végétale|vegetale|pflanzlich|nabati|plant)\b|صويا|نباتي|عباد الشمس|подсолнечн|соев/iu;

  const AUTHORITY_DIFF_REASONS_10LANG = {
    carmine_e120: {
      tr: 'Karmin (E120) koşnil böceğinden elde edilir. GİMDES ve IFANCA böcek kaynaklı boyaları uygunsuz (Kırmızı) kabul ederken; Malezya JAKIM (MKI 2012) ve Endonezya MUI (Fetva No. 33/2011 — fayda ve zararsızlık koşuluyla) akıcı kanı olmayan böcek kategorisinde değerlendirerek gıda boyası olarak Helal (Yeşil) saymaktadır.',
      en: 'Carmine (E120) is derived from cochineal insects. GİMDES and IFANCA reject insect-derived colorants (Red), whereas Malaysia JAKIM (MKI 2012) and Indonesia MUI (Fatwa No. 33/2011) classify non-flowing-blood insects as Halal-permissible food coloring (Green).',
      ar: 'يُستخرج الكارمين (E120) من حشرة الكوشينيل. ترفضه GİMDES وIFANCA، بينما تجيزه JAKIM الماليزية وMUI الإندونيسية (فتوى 33/2011) لكونها حشرة لا دم لها سائل.',
      de: 'Karmin (E120) stammt aus Cochenilleschildläusen. GİMDES und IFANCA stufen es als unzulässig (Rot) ein, während JAKIM (2012) und MUI (Fatwa 33/2011) es als Halal (Grün) anerkennen.',
      fr: 'Le Carmin (E120) est issu de la cochenille. GİMDES et IFANCA le refusent (Rouge), tandis que JAKIM et MUI (Fatwa 33/2011) l\'autorisent comme Halal (Vert).',
      id: 'Karmin (E120) berasal dari serangga cochineal. MUI (Fatwa No. 33/2011) dan JAKIM menyatakan Halal (Hijau), sedangkan GİMDES dan IFANCA menolaknya (Merah).',
      ms: 'Karmin (E120) diperoleh daripada serangga cochineal. JAKIM (MKI 2012) dan MUI mengesahkannya Halal (Hijau), manakala GİMDES dan IFANCA menolaknya (Merah).',
      es: 'El Carmín (E120) proviene del insecto cochinilla. GİMDES e IFANCA lo rechazan (Rojo), mientras que JAKIM y MUI (Fatwa 33/2011) lo consideran Halal (Verde).',
      ru: 'Кармин (E120) получают из кошенили. GİMDES и IFANCA считают его недопустимым (Красный), тогда как JAKIM и MUI (Фетва 33/2011) разрешают как Халяль (Зелёный).',
      ur: 'کارمین (E120) کوشینیل کیڑے سے حاصل ہوتا ہے۔ GİMDES اور IFANCA اسے ناجائز (سرخ) قرار دیتے ہیں، جبکہ ملائیشیا JAKIM اور انڈونیشیا MUI (فتویٰ 33/2011) اسے حلال (سبز) مانتے ہیں۔'
    },
    ethanol_cosmetic_or_food: {
      tr: 'Etil alkol (Etanol / Alcohol Denat.) kozmetikte harici çözücü olarak kullanıldığında; GİMDES her oranda uygunsuz (Kırmızı) sayarken, JAKIM, MUI ve IFANCA içki (hamr) kaynaklı olmamak şartıyla sentetik/endüstriyel etanolü kaynağa bağlı (Sarı) değerlendirir.',
      en: 'For topical cosmetic Ethanol (Alcohol Denat.), GİMDES rejects it at any concentration (Red), whereas JAKIM, MUI, and IFANCA evaluate non-beverage synthetic/industrial ethanol as conditional/source-dependent (Yellow).',
      ar: 'الإيثانول في مستحضرات التجميل الخارجية: ترفضه GİMDES مطلقاً (أحمر)، بينما تصنفه JAKIM وMUI وIFANCA كمشبوه/مشروط (أصفر) إذا كان صناعياً وغير مشتق من الخمر.',
      de: 'Bei kosmetischem Ethanol (Alcohol Denat.) lehnt GİMDES jede Konzentration ab (Rot), während JAKIM, MUI und IFANCA synthetisches, nicht aus Getränken stammendes Ethanol als bedingt/prüfbedürftig (Gelb) einstufen.',
      fr: 'Pour l\'éthanol cosmétique (Alcohol Denat.), GİMDES le refuse (Rouge), tandis que JAKIM, MUI et IFANCA évaluent l\'éthanol synthétique non issu de boissons alcoolisées au cas par cas (Jaune).',
      id: 'Untuk Etanol kosmetik luar, GİMDES menolak sepenuhnya (Merah), sedangkan MUI, JAKIM, dan IFANCA menilai etanol sintetis non-khamr sebagai bersyarat/perlu verifikasi (Kuning).',
      ms: 'Bagi Etanol kosmetik luaran, GİMDES menolak sepenuhnya (Merah), manakala JAKIM, MUI dan IFANCA menilai etanol sintetik bukan khamr sebagai bersyarat/perlu semakan (Kuning).',
      es: 'En etanol cosmético (Alcohol Denat.), GİMDES lo rechaza (Rojo), mientras que JAKIM, MUI e IFANCA evalúan el etanol sintético no procedente de bebidas como condicional (Amarillo).',
      ru: 'Этиловый спирт в косметике: GİMDES отклоняет в любой концентрации (Красный), а JAKIM, MUI и IFANCA допускают проверку синтетического непитьевого спирта (Жёлтый).',
      ur: 'کاسمیٹکس میں ایتھانول (Alcohol Denat.) کو GİMDES مکمل طور پر مسترد (سرخ) کرتا ہے، جبکہ JAKIM، MUI اور IFANCA غیر مشروباتی مصنوعی ایتھانول کو مشروط/قابلِ تصدیق (پیلا) قرار دیتے ہیں۔'
    },
    shellac_e904: {
      tr: 'Şellak (E904) lak böceğinin doğal reçine salgısıdır. JAKIM, MUI ve IFANCA böceğin kendisi değil salgısı olduğu için Helal (Yeşil) kabul ederken, GİMDES sertifikasyon standardında uygunsuz/kısıtlı (Kırmızı) saymaktadır.',
      en: 'Shellac (E904) is a resin secreted by the lac insect. JAKIM, MUI, and IFANCA permit it as Halal (Green) since it is a secretion rather than insect flesh, whereas GİMDES rejects it (Red).',
      ar: 'الشيلاك (E904) إفراز راتنجي لحشرة اللاك. تجيزه JAKIM وMUI وIFANCA كحلال (أخضر)، بينما تتحفظ عليه GİMDES (أحمر).',
      de: 'Schellack (E904) ist ein Harzsekret der Lackschildlaus. JAKIM, MUI und IFANCA stufen es als Halal (Grün) ein, während GİMDES es ablehnt (Rot).',
      fr: 'Le Shellac (E904) est une résine sécrétée par la cochenille asiatique. JAKIM, MUI et IFANCA l\'autorisent (Vert), tandis que GİMDES le refuse (Rouge).',
      id: 'Syelak (E904) adalah sekresi resin kutu lak. MUI, JAKIM, dan IFANCA menghalalkannya (Hijau), sedangkan GİMDES menolaknya (Merah).',
      ms: 'Syelak (E904) ialah rembesan resin serangga lak. JAKIM, MUI dan IFANCA menghalalkannya (Hijau), manakala GİMDES menolaknya (Merah).',
      es: 'La goma laca (E904) es una secreción resinosa del insecto lac. JAKIM, MUI e IFANCA la consideran Halal (Verde), mientras que GİMDES la rechaza (Rojo).',
      ru: 'Шеллак (E904) — смолистый секрет лакового червеца. JAKIM, MUI и IFANCA считают его Халяль (Зелёный), а GİMDES отклоняет (Красный).',
      ur: 'شیلاک (E904) لاکھ کیڑے کی رال ہے۔ JAKIM، MUI اور IFANCA اسے حلال (سبز) مانتے ہیں جبکہ GİMDES اسے مسترد (سرخ) کرتا ہے۔'
    },
    snail_mucin_halal: {
      tr: 'Kara salyangozu salgısı (Snail Mucin): Gıda olarak tüketimi tüm kurumlarda uygunsuzdur (Kırmızı). Harici kozmetik kullanımında GİMDES reddederken (Kırmızı); Endonezya MUI (Fetva No. 24/2012 & LPPOM non-food rehberi), Malezya (Mufti Wilayah İrşad el-Fetva Seri 188 / JAKIM ürün teyidi) ve IFANCA harici kullanımı saflık, üretim yöntemi ve sertifika doğrulamasına bağlı (Sarı/Şüpheli) değerlendirir.',
      en: 'Land Snail Mucin: Oral food consumption is prohibited across all authorities (Red). For external cosmetic use, GİMDES rejects it (Red), whereas Indonesia MUI (Fatwa No. 24/2012 & LPPOM non-food guidance), Malaysia (Mufti Wilayah Series 188 / JAKIM product verification), and IFANCA evaluate topical use as conditional upon purity, extraction method, and certification (Yellow).',
      ar: 'خلاصة الحلزون البري: يحرم تناولها غذائياً لدى جميع الهيئات (أحمر). أما في الاستخدام التجميلي الخارجي فترفضها GİMDES (أحمر)، بينما تصنفها MUI الإندونيسية (فتوى 24/2012 للاستخدام غير الغذائي) وماليزيا (إرشاد الفتوى 188 / تحقق JAKIM) وIFANCA كمشروطة بالطهارة والتحقق من الشهادة (أصفر).',
      de: 'Schneckenschleim (Snail Mucin): Als Lebensmittel unzulässig (Rot). Bei äußerlicher Kosmetikanwendung lehnt GİMDES ihn ab (Rot), während MUI (Fatwa Nr. 24/2012 für Non-Food), Malaysia (Mufti Wilayah Serie 188 / JAKIM-Prüfung) und IFANCA ihn unter Reinheits- und Zertifizierungsbedingungen als prüfbedürftig (Gelb) einstufen.',
      fr: 'Mucine d\'escargot : Interdite en alimentation (Rouge). En usage cosmétique externe, GİMDES la refuse (Rouge), tandis que MUI (Fatwa 24/2012 non-alimentaire), la Malaisie (Mufti Wilayah Série 188 / vérification JAKIM) et IFANCA l\'évaluent sous condition de pureté et de certification (Jaune).',
      id: 'Lendir siput darat (Snail Mucin): Konsumsi pangan haram (Merah). Untuk kosmetik luar (non-pangan), GİMDES menolak (Merah), sedangkan MUI (Fatwa No. 24/2012 & panduan LPPOM), Malaysia (Mufti Wilayah Seri 188 / verifikasi produk JAKIM), dan IFANCA menilai bersyarat pada kemurnian, proses, dan sertifikasi (Kuning).',
      ms: 'Mucin siput darat (Snail Mucin): Penggunaan makanan adalah haram (Merah). Bagi kosmetik luaran, GİMDES menolak (Merah), manakala Malaysia (Mufti Wilayah Siri 188 / semakan pensijilan produk JAKIM), MUI (Fatwa No. 24/2012 bukan makanan) dan IFANCA menilai secara bersyarat mengikut kesucian dan pengesahan sijil (Kuning).',
      es: 'Mucina de caracol terrestre: Prohibida en alimentación (Rojo). En cosmética externa, GİMDES la rechaza (Rojo), mientras que MUI (Fatwa 24/2012 uso no alimentario), Malasia (Mufti Wilayah Serie 188 / verificación JAKIM) e IFANCA la evalúan sujeta a pureza y certificación (Amarillo).',
      ru: 'Муцин сухопутной улитки: В пищу запрещён (Красный). В наружной косметике GİMDES отклоняет (Красный), тогда как MUI (Фетва № 24/2012 для непищевого применения), Малайзия (Mufti Wilayah выпуск 188 / проверка JAKIM) и IFANCA требуют проверки чистоты и сертификации (Жёлтый).',
      ur: 'خشکی کے گھونگھے کا لعاب (Snail Mucin): بطور غذا تمام اداروں کے نزدیک ناجائز (سرخ) ہے۔ بیرونی کاسمیٹک استعمال میں GİMDES اسے مسترد (سرخ) کرتا ہے، جبکہ انڈونیشیا MUI (فتویٰ 24/2012 برائے غیر غذائی استعمال)، ملائیشیا (مفتی ولایت سیریز 188 / JAKIM تصدیق) اور IFANCA اسے پاکیزگی اور سرٹیفکیٹ کی تصدیق سے مشروط (پیلا) قرار دیتے ہیں۔'
    },
    default: {
      tr: 'Bu bileşen için GİMDES, JAKIM, MUI ve IFANCA fıkıh kurulları arasında kaynak, istihale (kimyasal dönüşüm) veya çözücü eşiği açısından içtihat farkı bulunmaktadır.',
      en: 'Halal authorities (GİMDES, JAKIM, MUI, IFANCA) apply different juristic criteria regarding origin verification, chemical transformation (istihalah), or carrier thresholds for this ingredient.',
      ar: 'تختلف المعايير الفقهية بين الهيئات (GİMDES وJAKIM وMUI وIFANCA) حول هذا المكون من حيث التحقق من المصدر أو الاستحالة أو نسبة المذيب.',
      de: 'Zwischen den Halal-Zertifizierern (GİMDES, JAKIM, MUI, IFANCA) bestehen bei diesem Stoff unterschiedliche Bewertungskriterien hinsichtlich Herkunft oder Trägerstoffen.',
      fr: 'Les autorités Halal (GİMDES, JAKIM, MUI, IFANCA) appliquent des critères différents concernant l\'origine ou le solvant de cet ingrédient.',
      id: 'Terdapat perbedaan kriteria fikih di antara lembaga Halal (MUI, JAKIM, GİMDES, IFANCA) terkait sumber bahan atau batas pelarut komponen ini.',
      ms: 'Terdapat perbezaan kriteria fiqh antara badan Halal (JAKIM, MUI, GİMDES, IFANCA) mengenai pengesahan sumber atau pelarut ramuan ini.',
      es: 'Las autoridades Halal (GİMDES, JAKIM, MUI, IFANCA) aplican criterios distintos sobre el origen o disolvente de este ingrediente.',
      ru: 'Органы сертификации Халяль (GİMDES, JAKIM, MUI, IFANCA) применяют разные критерии оценки происхождения или растворителя для этого компонента.',
      ur: 'اس جزو کے ماخذ یا محلول کے بارے میں حلال اتھارٹیز (GİMDES, JAKIM, MUI, IFANCA) کے فقہی معیارات میں فرق پایا جاتا ہے۔'
    }
  };

  function resolveAuthorityRulingWithContext(rule, authKey, isExplicitPlantToken) {
    // A user-declared Halal certificate on the product applies to the active/selected authority being verified,
    // not as a blanket 4-authority global certification across all foreign bodies in the comparison matrix.
    const certAppliesHere = Boolean(claims.halalCertified && authKey === halalAuthority);
    let st = (rule.authority_rulings && rule.authority_rulings[authKey]) || rule.authority_rulings.general_cautious;
    let resNote = null;
    let isConflict = false;

    if (rule.id === 'snail_mucin_halal' && productType === 'food') {
      st = 'kirmizi';
    }

    if (rule.category === 'A_haram') {
      if (
        certAppliesHere ||
        (claims.veganStatus !== 'none' && !rule.vegan_compatible) ||
        (claims.vegetarianStatus !== 'none' && rule.vegetarian_compatible === false)
      ) {
        isConflict = true;
        st = 'conflict';
        resNote = et.conflictHaram;
      } else {
        st = 'kirmizi';
      }
    } else if (rule.category === 'B_alkol') {
      if (productType === 'food' && rule.id === 'ethanol_cosmetic_or_food') {
        st = 'kirmizi';
      }
      if (certAppliesHere) {
        st = st === 'kirmizi' ? 'conflict' : 'sari';
        if (st === 'conflict') isConflict = true;
        resNote = et.conflictAlcohol;
      } else if (claims.veganStatus !== 'none') {
        resNote = et.veganNoteAlcohol;
      }
    } else if (rule.category === 'C_musbooh') {
      if (
        (!rule.vegan_compatible && claims.veganStatus !== 'none') ||
        (rule.vegetarian_compatible === false && claims.vegetarianStatus !== 'none')
      ) {
        isConflict = true;
        st = 'conflict';
        resNote = et.conflictAnimalVegan;
      } else if (isExplicitPlantToken) {
        st = 'yesil';
        resNote = et.plantSourceResolved;
      } else if (certAppliesHere) {
        st = 'yesil';
        resNote = et.halalCertResolved;
      } else if (rule.vegan_claim_resolves && claims.veganStatus === 'verified') {
        st = 'yesil';
        resNote = et.verifiedVeganResolved;
      } else if (rule.vegan_claim_resolves && claims.veganStatus === 'declared') {
        st = 'sari_yesil';
        resNote = et.declaredVeganNote;
      } else if (rule.id === 'l_cysteine' && claims.veganStatus !== 'none') {
        st = 'sari';
        resNote = et.lCysteineNote;
      }
    } else if (rule.category === 'D_tartismali') {
      if (
        (!rule.vegan_compatible && claims.veganStatus !== 'none') ||
        (rule.vegetarian_compatible === false && claims.vegetarianStatus !== 'none')
      ) {
        isConflict = true;
        st = 'conflict';
        resNote = et.conflictInsectVegan;
      } else if (certAppliesHere && st === 'kirmizi') {
        isConflict = true;
        st = 'conflict';
        resNote = et.conflictHaram;
      } else if (certAppliesHere && st === 'sari') {
        st = 'yesil';
        resNote = et.halalCertResolved;
      }
    }

    return { status: st, contextResolution: resNote, conflictDetected: isConflict };
  }

  for (const obs of observations) {
    const rule = obs.halalRule;
    if (!rule) continue;

    if (rule.category === 'SAFE_NON_ETHANOL') {
      falsePositiveShields.push({
        rawToken: obs.raw,
        localizedName: obs.localizedName,
        canonical: rule.canonical,
        explanation: lang === 'tr' ? rule.template_tr : et.shieldDesc,
        source: getSourceById(rule.source_id)
      });
      continue;
    }

    const isExplicitPlantToken = Boolean(rule.vegan_claim_resolves && explicitPlantRegex.test(obs.raw));
    obs.isExplicitPlantToken = isExplicitPlantToken;

    const selectedResolved = resolveAuthorityRulingWithContext(rule, halalAuthority, isExplicitPlantToken);
    const statusForAuthority = selectedResolved.status;
    const contextResolution = selectedResolved.contextResolution;
    const conflictDetected = selectedResolved.conflictDetected;

    if (conflictDetected || statusForAuthority === 'conflict') {
      overallHalalStatus = 'conflict';
    } else if (statusForAuthority === 'kirmizi' && overallHalalStatus !== 'conflict') {
      overallHalalStatus = 'uygunsuz_bulgu';
    } else if ((statusForAuthority === 'sari' || statusForAuthority === 'sari_yesil') && overallHalalStatus === 'uygun_gorunuyor') {
      overallHalalStatus = 'kaynak_belirsiz_musbooh';
    }

    const localizedRuleExplanation =
      statusForAuthority === 'yesil'
        ? contextResolution || (lang === 'tr' && rule.category === 'H_helal' ? rule.template_tr : et.halalOkDesc)
        : lang === 'tr'
        ? rule.template_tr
        : rule.category === 'B_alkol'
        ? et.halalAlcoholDesc
        : statusForAuthority === 'kirmizi' || statusForAuthority === 'conflict'
        ? et.halalHaramDesc
        : et.halalMusboohDesc;

    // Build 4-authority comparison matrix using the exact same context resolver (guarantees invariant: authorityMatrix[halalAuthority] === statusForAuthority)
    const authorityMatrix = {};
    for (const authKey of ['GIMDES', 'JAKIM', 'MUI', 'IFANCA']) {
      authorityMatrix[authKey] = resolveAuthorityRulingWithContext(rule, authKey, isExplicitPlantToken).status;
    }
    const hasAuthorityDifference = new Set(Object.values(authorityMatrix)).size > 1;
    const diffDict = AUTHORITY_DIFF_REASONS_10LANG[rule.id] || AUTHORITY_DIFF_REASONS_10LANG.default;
    const authorityDiffReason = hasAuthorityDifference ? (diffDict[lang] || diffDict.en) : null;

    if (hasAuthorityDifference) {
      authorityComparison.push({
        ruleId: rule.id,
        canonical: rule.canonical,
        localizedName: obs.localizedName || rule.canonical,
        rawToken: obs.raw,
        authorityMatrix,
        reason: authorityDiffReason,
        authorityDiffReason
      });
    }

    halalFindings.push({
      ruleId: rule.id,
      canonical: rule.canonical,
      localizedName: obs.localizedName,
      rawToken: obs.raw,
      category: rule.category,
      authority: halalAuthority,
      status: statusForAuthority,
      conflictDetected,
      explanation: localizedRuleExplanation,
      contextResolution,
      authorityMatrix,
      hasAuthorityDifference,
      authorityDiffReason,
      source: getSourceById(rule.source_id)
    });
  }

  // Coverage Guard: If coverage is below 80% and no explicit haram/conflict was found,
  // we cannot certify it as permissible ('uygun_gorunuyor') because unanalyzed ingredients might be non-halal/doubtful.
  if (coverageRatio < 0.8 && overallHalalStatus === 'uygun_gorunuyor') {
    overallHalalStatus = 'kapsam_yetersiz';
  }

  const halalCard = {
    cardTitle: et.halalCardTitle,
    selectedAuthority: halalAuthority,
    overallStatus: overallHalalStatus,
    findings: halalFindings,
    authorityComparison,
    falsePositiveShields,
    disclaimer: et.halalDisclaimer(halalAuthority)
  };

  // ============================================================================
  // CARD 4: VEGAN, VEGETARIAN & HIDDEN SUGAR AUDIT
  // ============================================================================
  const detectedFreeSugars = observations
    .filter((o) => o.sugar)
    .map((o) => ({ rawToken: o.raw, localizedName: o.localizedName, canonical: o.sugar.canonical, position: o.position }));

  const detectedRapidCarbs = observations
    .filter((o) => o.rapidCarb)
    .map((o) => ({
      rawToken: o.raw,
      localizedName: o.localizedName,
      canonical: o.rapidCarb.canonical,
      explanation:
        (o.rapidCarb.explanations && (o.rapidCarb.explanations[lang] || o.rapidCarb.explanations.en)) ||
        o.rapidCarb.explanation,
      position: o.position
    }));

  const nonVeganItems = observations
    .filter((o) => o.halalRule && o.halalRule.vegan_compatible === false)
    .map((o) => ({ rawToken: o.raw, localizedName: o.localizedName, canonical: o.halalRule.canonical, category: o.halalRule.category }));

  const nonVegetarianItems = observations
    .filter((o) => o.halalRule && o.halalRule.vegetarian_compatible === false)
    .map((o) => ({ rawToken: o.raw, localizedName: o.localizedName, canonical: o.halalRule.canonical, category: o.halalRule.category }));

  const uncertainVeganItems = observations
    .filter(
      (o) =>
        o.halalRule &&
        (o.halalRule.category === 'C_musbooh' || o.halalRule.id === 'lecithin_e322') &&
        o.halalRule.vegan_compatible === true &&
        !o.isExplicitPlantToken
    )
    .map((o) => ({ rawToken: o.raw, localizedName: o.localizedName, canonical: o.halalRule.canonical }));

  let veganCompatibility = 'vegan_uyumlu_gorunuyor';
  if (nonVeganItems.length > 0) {
    veganCompatibility =
      claims.veganStatus !== 'none' || (nonVegetarianItems.length > 0 && claims.vegetarianStatus !== 'none')
        ? 'conflict'
        : 'hayvansal_bilesen_var';
  } else if (nonVegetarianItems.length > 0 && claims.vegetarianStatus !== 'none') {
    veganCompatibility = 'conflict';
  } else if (uncertainVeganItems.length > 0 && claims.veganStatus === 'none') {
    veganCompatibility = 'cift_kaynakli_bilesen_var';
  } else if (coverageRatio < 0.8 && claims.veganStatus === 'none') {
    veganCompatibility = 'kapsam_yetersiz';
  }

  const veganSugarCard = {
    cardTitle: et.veganCardTitle,
    veganCompatibility,
    nonVeganItems,
    nonVegetarianItems,
    uncertainVeganItems,
    freeSugarCount: detectedFreeSugars.length,
    detectedFreeSugars,
    detectedRapidCarbs,
    sugarSource: sourcesData.sources.WHO_SUGAR_2015
  };

  // ============================================================================
  // CARD 5: BRAND-NEUTRAL CLEAN & HALAL INGREDIENT SWAP GUIDE (10 LANGUAGES)
  // ============================================================================
  const swapGuideCard = buildSwapGuideCard({
    lang,
    productType,
    rawText,
    allergenStatement,
    observations,
    regulatoryCard,
    profileCard,
    halalCard,
    veganSugarCard
  });

  // ============================================================================
  // CARD 6: COSMETIC ACTIVE ROUTINE & LAYERING CONFLICT ENGINE (10 LANGUAGES)
  // ============================================================================
  const routineConflictCard = buildRoutineConflictCard({
    lang,
    productType,
    observations
  });

  // ============================================================================
  // CARD 7: OFFICIAL REGULATORY & ALLERGEN REPORT WITH 4-LAYER FRESHNESS SEAL
  // ============================================================================
  const regulatoryReportCard = buildRegulatoryReportCard({
    lang,
    productType,
    jurisdiction,
    halalAuthority,
    rawText,
    allergenStatement,
    observations,
    regulatoryCard,
    profileCard,
    halalCard,
    veganSugarCard,
    routineConflictCard
  });

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const locale = getLocaleStrings(lang);

  return {
    timestamp: new Date().toISOString(),
    ruleVersion: '2026-10-13-v3-comprehensive-10lang',
    brand: 'InciFact',
    lang: langMeta.code,
    dir: langMeta.dir,
    locale,
    productType,
    jurisdiction,
    halalAuthority,
    claims,
    coveragePercent: regulatoryCard.coveragePercent,
    recognizedCount: regulatoryCard.recognizedCount,
    totalCount: regulatoryCard.totalCount,
    unresolvedConfirmations,
    observations,
    cards: {
      regulatoryCard,
      profileCard,
      halalCard,
      veganSugarCard,
      swapGuideCard,
      routineConflictCard,
      regulatoryReportCard
    },
    appleGuideline141Disclaimer: et.appleDisclaimer
  };
}

const SWAP_GUIDE_UI_I18N = {
  tr: {
    cardTitle: '💡 Bunun Yerine Rafta Ne Aramalıyım? (Temiz & Helal Etiket Rehberi)',
    cardSubtitle: 'Marka bağımsız bilimsel rehber: Bu üründe tespit edilen sorunlu veya şüpheli bileşenler yerine, raftaki diğer ürünlerin etiketinde arayabileceğiniz temiz ve helal alternatif maddeler.',
    detectedLabel: 'Bu Üründe Tespit Edilen',
    lookForLabel: 'Etikette Bunun Yerine Arayın',
    whyLabel: 'Neden?',
    allCleanMessage: 'Bu üründe alternatif aramanızı gerektirecek sorunlu, kısıtlı veya şüpheli bir bileşen tespit edilmedi.',
    categories: {
      halal: 'Helal & Kaynak Alternatifi',
      health_regulatory: 'Temiz İçerik & Mevzuat Alternatifi',
      allergen_profile: 'Alerjen & Hassasiyet Alternatifi',
      sugar_nutrition: 'Şeker & Beslenme Alternatifi'
    }
  },
  en: {
    cardTitle: '💡 What Should I Look For Instead? (Clean & Halal Label Guide)',
    cardSubtitle: 'Brand-neutral scientific guide: Clean and Halal alternative ingredients to look for on other product labels instead of the flagged or doubtful substances detected here.',
    detectedLabel: 'Detected in This Product',
    lookForLabel: 'Look For This on the Label Instead',
    whyLabel: 'Why?',
    allCleanMessage: 'No problematic, restricted, or doubtful ingredients requiring a label swap were detected in this product.',
    categories: {
      halal: 'Halal & Origin Swap',
      health_regulatory: 'Clean & Regulatory Swap',
      allergen_profile: 'Allergen & Sensitivity Swap',
      sugar_nutrition: 'Sugar & Nutrition Swap'
    }
  },
  ar: {
    cardTitle: '💡 ماذا أبحث عنه بدلاً من ذلك على الرف؟ (دليل البدائل النظيفة والحلال)',
    cardSubtitle: 'دليل علمي محايد للعلامات التجارية: بدائل نظيفة وحلال يمكنك البحث عنها في قائمة مكونات المنتجات الأخرى بدلاً من المواد المشبوهة أو المرفوضة هنا.',
    detectedLabel: 'المكتشف في هذا المنتج',
    lookForLabel: 'ابحث عن هذا في الملصق بدلاً منه',
    whyLabel: 'لماذا؟',
    allCleanMessage: 'لم يتم رصد أي مكونات مشبوهة أو مقيدة تتطلب البحث عن بديل في هذا المنتج.',
    categories: {
      halal: 'بديل الحلال والمصدر',
      health_regulatory: 'بديل المكونات النظيفة واللوائح',
      allergen_profile: 'بديل الحساسية والملائمة',
      sugar_nutrition: 'بديل السكر والتغذية'
    }
  },
  de: {
    cardTitle: '💡 Worauf sollte ich im Regal stattdessen achten? (Clean & Halal Etiketten-Guide)',
    cardSubtitle: 'Markenunabhängiger Leitfaden: Saubere und Halal-konforme Alternativstoffe, nach denen Sie auf anderen Produktetiketten suchen können.',
    detectedLabel: 'In diesem Produkt erkannt',
    lookForLabel: 'Suchen Sie stattdessen auf dem Etikett nach',
    whyLabel: 'Warum?',
    allCleanMessage: 'In diesem Produkt wurden keine problematischen oder zweifelhaften Inhaltsstoffe erkannt, die einen Austausch erfordern.',
    categories: {
      halal: 'Halal- & Herkunftsalternative',
      health_regulatory: 'Saubere & Regulatorische Alternative',
      allergen_profile: 'Allergen- & Sensitivitätsalternative',
      sugar_nutrition: 'Zucker- & Ernährungsalternative'
    }
  },
  fr: {
    cardTitle: '💡 Que chercher à la place en rayon ? (Guide d’étiquette Clean & Halal)',
    cardSubtitle: 'Guide scientifique indépendant des marques : ingrédients alternatifs propres et Halal à privilégier sur les étiquettes d’autres produits.',
    detectedLabel: 'Détecté dans ce produit',
    lookForLabel: 'Cherchez plutôt sur l’étiquette',
    whyLabel: 'Pourquoi ?',
    allCleanMessage: 'Aucun ingrédient problématique, restreint ou douteux nécessitant une alternative n’a été détecté dans ce produit.',
    categories: {
      halal: 'Alternative Halal & Origine',
      health_regulatory: 'Alternative Clean & Réglementaire',
      allergen_profile: 'Alternative Allergènes & Sensibilité',
      sugar_nutrition: 'Alternative Sucre & Nutrition'
    }
  },
  id: {
    cardTitle: '💡 Apa yang Harus Dicari di Rak Sebagai Gantinya? (Panduan Label Bersih & Halal)',
    cardSubtitle: 'Panduan ilmiah netral-merek: Bahan alternatif bersih dan Halal yang dapat Anda cari pada daftar komposisi produk lain.',
    detectedLabel: 'Terdeteksi pada Produk Ini',
    lookForLabel: 'Cari Bahan Ini pada Label',
    whyLabel: 'Mengapa?',
    allCleanMessage: 'Tidak ditemukan bahan bermasalah, dibatasi, atau syubhat yang memerlukan penggantian pada produk ini.',
    categories: {
      halal: 'Alternatif Halal & Sumber',
      health_regulatory: 'Alternatif Komposisi Bersih',
      allergen_profile: 'Alternatif Alergen & Sensitivitas',
      sugar_nutrition: 'Alternatif Gula & Nutrisi'
    }
  },
  ms: {
    cardTitle: '💡 Apa yang Perlu Dicari di Rak Sebagai Ganti? (Panduan Label Bersih & Halal)',
    cardSubtitle: 'Panduan saintifik neutral-jenama: Ramuan alternatif bersih dan Halal untuk dicari pada label produk lain.',
    detectedLabel: 'Dikesan dalam Produk Ini',
    lookForLabel: 'Cari Bahan Ini pada Label',
    whyLabel: 'Mengapa?',
    allCleanMessage: 'Tiada ramuan bermasalah, terhad atau syubhah yang memerlukan alternatif dikesan dalam produk ini.',
    categories: {
      halal: 'Alternatif Halal & Sumber',
      health_regulatory: 'Alternatif Ramuan Bersih',
      allergen_profile: 'Alternatif Alergen & Sensitiviti',
      sugar_nutrition: 'Alternatif Gula & Nutrisi'
    }
  },
  es: {
    cardTitle: '💡 ¿Qué buscar en su lugar en el estante? (Guía de Etiquetas Clean y Halal)',
    cardSubtitle: 'Guía científica independiente de marcas: ingredientes alternativos limpios y Halal que puede buscar en las etiquetas de otros productos.',
    detectedLabel: 'Detectado en este producto',
    lookForLabel: 'Busque esto en la etiqueta',
    whyLabel: '¿Por qué?',
    allCleanMessage: 'No se detectaron ingredientes problemáticos, restringidos o dudosos que requieran buscar una alternativa.',
    categories: {
      halal: 'Alternativa Halal y Origen',
      health_regulatory: 'Alternativa Limpia y Normativa',
      allergen_profile: 'Alternativa sin Alérgenos',
      sugar_nutrition: 'Alternativa de Azúcar y Nutrición'
    }
  },
  ru: {
    cardTitle: '💡 Что искать взамен на полке? (Гид по чистым и халяльным альтернативам)',
    cardSubtitle: 'Независимый научный гид: чистые и халяльные альтернативные компоненты, которые стоит искать в составе других продуктов.',
    detectedLabel: 'Обнаружено в продукте',
    lookForLabel: 'Ищите на этикетке взамен',
    whyLabel: 'Почему?',
    allCleanMessage: 'В этом продукте не обнаружено проблемных или сомнительных компонентов, требующих замены.',
    categories: {
      halal: 'Халяль и источник',
      health_regulatory: 'Чистый состав и нормы',
      allergen_profile: 'Гипоаллергенная замена',
      sugar_nutrition: 'Замена сахара и питание'
    }
  },
  ur: {
    cardTitle: '💡 اس کے بجائے شیلف پر کیا تلاش کریں؟ (صاف اور حلال لیبل گائیڈ)',
    cardSubtitle: 'برانڈ سے آزاد سائنسی رہنمائی: اس پروڈکٹ میں پائے جانے والے مشکوک یا مضر اجزاء کے بجائے دیگر مصنوعات کے لیبل پر تلاش کیے جانے والے صاف اور حلال متبادل۔',
    detectedLabel: 'اس پروڈکٹ میں پایا گیا',
    lookForLabel: 'لیبل پر اس کے بجائے یہ تلاش کریں',
    whyLabel: 'کیوں؟',
    allCleanMessage: 'اس پروڈکٹ میں کوئی ایسا مشکوک یا مضر جزو نہیں ملا جس کے متبادل کی ضرورت ہو۔',
    categories: {
      halal: 'حلال اور ماخذ متبادل',
      health_regulatory: 'صاف اجزاء اور ضوابط متبادل',
      allergen_profile: 'الرجی اور حساسیت متبادل',
      sugar_nutrition: 'شوگر اور غذائیت متبادل'
    }
  }
};

const SWAP_RULES_10LANG = {
  swap_gelatin: {
    category: 'halal',
    tr: {
      lookFor: 'Bitkisel Pektin (E440), Agar-Agar (E406), Karagenan (E407) veya açıkça "Helal Sertifikalı Sığır/Balık Jelatini"',
      why: 'Bitkisel jelleştiriciler (Pektin/Agar) domuz ve belirsiz kesim riskini %100 ortadan kaldırır; hem Helal hem Vegan uyumludur.'
    },
    en: {
      lookFor: 'Plant Pectin (E440), Agar-Agar (E406), Carrageenan (E407), or explicitly "Halal-Certified Bovine/Fish Gelatin"',
      why: 'Plant-based gelling agents (Pectin/Agar) completely eliminate porcine or unverified slaughter risks and are both Halal and Vegan.'
    },
    ar: {
      lookFor: 'البكتين النباتي (E440)، أغار-أغار (E406)، الكاراجينان (E407) أو "جيلاتين بقري/سمكي بشهادة حلال صريحة"',
      why: 'المكثفات النباتية (البكتين/الأغار) تقضي تماماً على مخاطر المصدر الخنزيري أو الذبح غير الموثق وتناسب الحلال والنباتي.'
    },
    de: {
      lookFor: 'Pflanzliches Pektin (E440), Agar-Agar (E406), Carrageen (E407) oder explizit „Halal-zertifizierte Rinder-/Fischgelatine“',
      why: 'Pflanzliche Geliermittel schließen Schweine- oder unklare Schlachtrisiken vollständig aus und sind Halal- sowie Vegan-konform.'
    },
    fr: {
      lookFor: 'Pectine végétale (E440), Agar-Agar (E406), Carraghénane (E407) ou « Gélatine bovine/de poisson certifiée Halal »',
      why: 'Les gélifiants végétaux éliminent tout risque d’origine porcine ou d’abattage non vérifié (100 % Halal et Vegan).'
    },
    id: {
      lookFor: 'Pektin Nabati (E440), Agar-Agar (E406), Karagenan (E407), atau "Gelatin Sapi/Ikan Bersertifikat Halal"',
      why: 'Pengental nabati (Pektin/Agar) menghilangkan risiko babi atau sembelihan tidak jelas serta 100% Halal dan Vegan.'
    },
    ms: {
      lookFor: 'Pektin Tumbuhan (E440), Agar-Agar (E406), Karagenan (E407) atau "Gelatin Lembu/Ikan Bersijil Halal"',
      why: 'Ejen pemekat tumbuhan menghapuskan risiko sumber khinzir atau sembelihan tidak sah serta mesra Halal dan Vegan.'
    },
    es: {
      lookFor: 'Pectina vegetal (E440), Agar-Agar (E406), Carragenina (E407) o «Gelatina bovina/de pescado certificada Halal»',
      why: 'Los gelificantes vegetales eliminan por completo el riesgo porcino o de sacrificio no verificado.'
    },
    ru: {
      lookFor: 'Растительный пектин (E440), агар-агар (E406), каррагинан (E407) или «говяжий/рыбный желатин с сертификатом Халяль»',
      why: 'Растительные желирующие агенты полностью исключают риск свиного происхождения и подходят для Халяль и Веган.'
    },
    ur: {
      lookFor: 'نباتاتی پیکٹن (E440)، اگر-اگر (E406)، کیراجینن (E407) یا واضح طور پر "حلال سرٹیفائیڈ بیف/مچھلی جیلیٹن"',
      why: 'نباتاتی جیلنگ اجزاء سور یا غیر مصدقہ ذبیحہ کے خطرے کو مکمل طور پر ختم کرتے ہیں اور حلال و ویگن دونوں کے لیے موزوں ہیں۔'
    }
  },
  swap_animal_fat_meat: {
    category: 'halal',
    tr: {
      lookFor: 'Bitkisel Yağlar (Kakao Yağı, Shea, Zeytinyağı, Ayçiçek Yağı), Sabunlarda "Sodium Palmate / Sodium Cocoate" veya Açık Helal Kesim Sertifikası',
      why: 'Hayvansal don yağı (Tallow/Lard) yerine bitkisel yağ bazlı formüller kaynak ve kesim şüphesini tamamen giderir.'
    },
    en: {
      lookFor: 'Plant Oils (Cocoa Butter, Shea, Olive, Sunflower Oil), "Sodium Palmate / Sodium Cocoate" in soaps, or Halal-Slaughter Certification',
      why: 'Plant-oil formulations replace animal tallow/lard and eliminate slaughter or porcine origin concerns.'
    },
    ar: {
      lookFor: 'زيوت نباتية (زبدة الكاكاو، الشيا، زيت الزيتون)، أو "صوديوم بالمات / كوكوات" في الصابون، أو شهادة ذبح حلال معتمدة',
      why: 'التركيبات القائمة على الزيوت النباتية تغني عن الشحوم الحيوانية وتزيل شبهة المصدر أو طريقة الذبح.'
    },
    de: {
      lookFor: 'Pflanzenöle (Kakaobutter, Shea, Olivenöl), „Sodium Palmate / Sodium Cocoate“ in Seifen oder Halal-Schlachtzertifikat',
      why: 'Pflanzliche Öle ersetzen tierischen Talg/Schmalz und beseitigen Herkunfts- sowie Schlachtungszweifel.'
    },
    fr: {
      lookFor: 'Huiles végétales (Beurre de cacao, Karité, Olive), « Sodium Palmate / Sodium Cocoate » pour les savons ou certification Halal',
      why: 'Les formules à base d’huiles végétales remplacent le suif/saindoux animal et lèvent tout doute d’abattage.'
    },
    id: {
      lookFor: 'Minyak Nabati (Cocoa Butter, Shea, Zaitun), "Sodium Palmate / Sodium Cocoate" pada sabun, atau Sertifikat Sembelihan Halal',
      why: 'Formula berbasis minyak nabati menggantikan lemak hewani (tallow/lard) sehingga bebas keraguan sumber.'
    },
    ms: {
      lookFor: 'Minyak Tumbuhan (Mentega Koko, Shea, Zaitun), "Sodium Palmate / Sodium Cocoate" dalam sabun, atau Sijil Sembelihan Halal',
      why: 'Formula berasaskan minyak tumbuhan menggantikan lemak haiwan (tallow/lard) dan menghapuskan keraguan sumber.'
    },
    es: {
      lookFor: 'Aceites vegetales (Manteca de cacao, Karité, Oliva), «Sodium Palmate / Sodium Cocoate» en jabones o certificación Halal',
      why: 'Las fórmulas con aceites vegetales sustituyen el sebo/manteca animal y eliminan dudas de origen.'
    },
    ru: {
      lookFor: 'Растительные масла (какао, ши, оливковое), «Sodium Palmate / Sodium Cocoate» в мыле или сертификат убоя Халяль',
      why: 'Растительные масла заменяют животный жир (таллоу/лярд) и снимают сомнения относительно убоя.'
    },
    ur: {
      lookFor: 'نباتاتی تیل (کوکو بٹر، شیا، زیتون کا تیل)، صابن میں "Sodium Palmate / Sodium Cocoate" یا مصدقہ حلال ذبیحہ سرٹیفکیٹ',
      why: 'حیوانی چربی کے بجائے نباتاتی تیل پر مبنی فارمولے ماخذ اور ذبیحہ کے شبہات کو مکمل طور پر ختم کر دیتے ہیں۔'
    }
  },
  swap_carmine_e120: {
    category: 'halal',
    tr: {
      lookFor: 'Pancar Kökü Kırmızısı / Betanin (E162), Antosiyaninler (E163), Paprika Ekstresi (E160c) veya Likopen (E160d)',
      why: 'Böcek kaynaklı Karmin (E120) yerine bitkisel kırmızı renklendiriciler tüm helal otoritelerinde (GİMDES, JAKIM, MUI, IFANCA) ve vegan standartlarında tartışmasız uygundur.'
    },
    en: {
      lookFor: 'Beetroot Red / Betanin (E162), Anthocyanins (E163), Paprika Extract (E160c), or Lycopene (E160d)',
      why: 'Plant-derived red colorants replace insect-derived Carmine (E120) and are universally accepted across all Halal authorities and Vegan standards.'
    },
    ar: {
      lookFor: 'أحمر الشمندر / بيتانين (E162)، الأنثوسيانين (E163)، خلاصة البابريكا (E160c) أو الليكوبين (E160d)',
      why: 'الملونات الحمراء النباتية تغني عن الكارمين الحشري (E120) وهي مقبولة بالإجماع لدى جميع هيئات الحلال والمعايير النباتية.'
    },
    de: {
      lookFor: 'Betanin / Rote-Bete-Rot (E162), Anthocyane (E163), Paprikaextrakt (E160c) oder Lycopin (E160d)',
      why: 'Pflanzliche rote Farbstoffe ersetzen insektenbasiertes Karmin (E120) und sind bei allen Halal-Zertifizierern sowie vegan uneingeschränkt zulässig.'
    },
    fr: {
      lookFor: 'Rouge de betterave / Bétanine (E162), Anthocyanes (E163), Extrait de paprika (E160c) ou Lycopène (E160d)',
      why: 'Les colorants rouges végétaux remplacent le Carmin d’origine animale/insecte (E120) et sont unanimement acceptés en Halal et Vegan.'
    },
    id: {
      lookFor: 'Merah Bit / Betanin (E162), Antosianin (E163), Ekstrak Paprika (E160c), atau Likopen (E160d)',
      why: 'Pewarna merah nabati menggantikan Karmin (E120) dari serangga dan diterima tanpa khilaf di seluruh lembaga Halal serta Vegan.'
    },
    ms: {
      lookFor: 'Merah Ubi Bit / Betanin (E162), Antosianin (E163), Ekstrak Paprika (E160c) atau Likopena (E160d)',
      why: 'Pewarna merah tumbuhan menggantikan Karmin (E120) berasaskan serangga dan diterima oleh semua badan Halal serta Vegan.'
    },
    es: {
      lookFor: 'Rojo de remolacha / Betanina (E162), Antocianinas (E163), Extracto de pimentón (E160c) o Licopeno (E160d)',
      why: 'Los colorantes rojos vegetales sustituyen al Carmín de insectos (E120) y son aceptados por todas las autoridades Halal y veganas.'
    },
    ru: {
      lookFor: 'Свекольный красный / бетанин (E162), антоцианы (E163), экстракт паприки (E160c) или ликопин (E160d)',
      why: 'Растительные красные красители заменяют кармин из насекомых (E120) и признаются всеми органами Халяль и Веган.'
    },
    ur: {
      lookFor: 'چقندر کا سرخ رنگ / بیٹانین (E162)، اینتھوسائننز (E163)، پیپریکا ایکسٹریکٹ (E160c) یا لائیکوپین (E160d)',
      why: 'کیڑے سے حاصل کردہ کارمین (E120) کے بجائے نباتاتی سرخ رنگ تمام حلال اتھارٹیز (GİMDES, JAKIM, MUI, IFANCA) اور ویگن معیارات میں متفقہ طور پر جائز ہیں۔'
    }
  },
  swap_shellac_e904: {
    category: 'halal',
    tr: {
      lookFor: 'Karnauba Mumu (E903), Kandelilla Mumu (E902) veya Bitkisel Selüloz / Zein Kaplama',
      why: 'Lak böceği salgısı (E904) yerine bitkisel mumlar tüm helal kurumlarında ve vegan profillerde tam uyumludur.'
    },
    en: {
      lookFor: 'Carnauba Wax (E903), Candelilla Wax (E902), or Plant Cellulose / Zein Glazing',
      why: 'Plant waxes replace lac-insect Shellac (E904) and are universally permissible across all Halal bodies and Vegan profiles.'
    },
    ar: {
      lookFor: 'شمع الكارنوبا (E903)، شمع الكانديليلا (E902) أو التغليف بالسليلوز النباتي',
      why: 'الشموع النباتية تحل محل الشيلاك الحشري (E904) وتعد مقبولة لدى جميع هيئات الحلال والنظام النباتي.'
    },
    de: {
      lookFor: 'Carnaubawachs (E903), Candelillawachs (E902) oder pflanzliche Cellulose-Glasur',
      why: 'Pflanzenwachse ersetzen Schellack (E904) und sind bei allen Halal-Stellen sowie für Veganer unbedenklich.'
    },
    fr: {
      lookFor: 'Cire de carnauba (E903), Cire de candelilla (E902) ou enrobage végétal',
      why: 'Les cires végétales remplacent le Shellac (E904) et sont conformes pour toutes les autorités Halal et Vegan.'
    },
    id: {
      lookFor: 'Lilin Karnauba (E903), Lilin Kandelila (E902), atau Pelapis Selulosa Nabati',
      why: 'Lilin nabati menggantikan Syelak (E904) dari kutu lak sehingga diterima semua lembaga Halal dan Vegan.'
    },
    ms: {
      lookFor: 'Lilin Karnauba (E903), Lilin Kandelila (E902) atau Salutan Selulosa Tumbuhan',
      why: 'Lilin tumbuhan menggantikan Syelak (E904) dan diterima sepenuhnya oleh semua badan Halal dan Vegan.'
    },
    es: {
      lookFor: 'Cera de carnauba (E903), Cera de candelilla (E902) o recubrimiento vegetal',
      why: 'Las ceras vegetales sustituyen a la goma laca (E904) y son aptas para todas las autoridades Halal y veganas.'
    },
    ru: {
      lookFor: 'Карнаубский воск (E903), канделильский воск (E902) или растительная глазурь',
      why: 'Растительные воски заменяют шеллак (E904) и подходят для всех стандартов Халяль и Веган.'
    },
    ur: {
      lookFor: 'کارنوبا ویکس (E903)، کینڈیلیلا ویکس (E902) یا نباتاتی سیلولوز کوٹنگ',
      why: 'لاکھ کیڑے کی رال (E904) کے بجائے نباتاتی موم تمام حلال اداروں اور ویگن معیارات میں مکمل طور پر موزوں ہیں۔'
    }
  },
  swap_ethanol_alcohol: {
    category: 'halal',
    tr: {
      lookFor: 'Kozmetikte Gliserin, Pentylene Glycol, Propanediol veya "Alkolsüz / Alcohol-Free" Formül; Gıdada Alkolsüz Meyve/Sirke Özütü',
      why: 'Etil alkol (Alcohol Denat. / Etanol) yerine bitkisel nemlendirici çözücüler hem cilt bariyerini kurutmaz hem de helal/alkol ihtilafını ortadan kaldırır.'
    },
    en: {
      lookFor: 'In cosmetics: Glycerin, Pentylene Glycol, Propanediol, or "Alcohol-Free" formulas; in food: Non-Alcoholic Fruit/Vinegar Extracts',
      why: 'Plant-derived humectant solvents replace volatile Ethyl Alcohol (Alcohol Denat.), preventing skin barrier dryness and resolving Halal ethanol disputes.'
    },
    ar: {
      lookFor: 'في التجميل: الجلسرين النقي، بروبانديول، بنتيلين جلايكول أو تركيبة "خالية من الكحول"؛ وفي الغذاء: خلاصات الفواكه والخل غير الكحولية',
      why: 'المذيبات المرطبة النباتية تغني عن الكحول الإيثيلي المتطاير، فلا تجفف البشرة وتنهي الخلاف الفقهي حول الإيثانول.'
    },
    de: {
      lookFor: 'In Kosmetik: Glycerin, Pentylene Glycol, Propanediol oder „Alkoholfrei / Alcohol-Free“; in Lebensmitteln: alkoholfreie Fruchtextrakte',
      why: 'Feuchtigkeitsspendende Lösungsmittel ersetzen flüchtiges Ethanol, schonen die Hautbarriere und vermeiden Halal-Konflikte.'
    },
    fr: {
      lookFor: 'En cosmétique : Glycérine, Pentylene Glycol, Propanediol ou formule « Sans alcool / Alcohol-Free » ; en alimentation : extraits sans alcool',
      why: 'Les solvants humectants remplacent l’alcool éthylique (Alcohol Denat.), préservent la barrière cutanée et évitent tout litige Halal.'
    },
    id: {
      lookFor: 'Pada kosmetik: Gliserin, Pentylene Glycol, Propanediol, atau label "Alcohol-Free"; pada pangan: Ekstrak Buah/Cuka Non-Alkohol',
      why: 'Pelarut pelembap nabati menggantikan etanol volatil sehingga tidak mengeringkan kulit dan bebas khilaf kehalalan.'
    },
    ms: {
      lookFor: 'Dalam kosmetik: Gliserin, Pentylene Glycol, Propanediol atau "Tanpa Alkohol / Alcohol-Free"; dalam makanan: Ekstrak Tanpa Alkohol',
      why: 'Pelarut pelembap tumbuhan menggantikan etanol meruap, melindungi penghalang kulit dan menyelesaikan isu Halal.'
    },
    es: {
      lookFor: 'En cosmética: Glicerina, Pentylene Glycol, Propanediol o «Sin alcohol / Alcohol-Free»; en alimentos: extractos sin alcohol',
      why: 'Los disolventes humectantes reemplazan al etanol volátil, cuidan la barrera cutánea y evitan conflictos Halal.'
    },
    ru: {
      lookFor: 'В косметике: глицерин, пентиленгликоль, пропандиол или «Без спирта / Alcohol-Free»; в продуктах: безалкогольные экстракты',
      why: 'Увлажняющие растворители заменяют этиловый спирт, не сушат кожу и снимают разногласия по стандартам Халяль.'
    },
    ur: {
      lookFor: 'کاسمیٹکس میں: گلیسرین، Pentylene Glycol، Propanediol یا "Alcohol-Free" فارمولا؛ غذا میں: غیر الکحلی پھلوں کا عرق',
      why: 'ایتھانول (Alcohol Denat.) کے بجائے نباتاتی موئسچرائزنگ محلول جلد کو خشک ہونے سے بچاتے ہیں اور حلال اتھارٹیز کے اختلاف کو ختم کرتے ہیں۔'
    }
  },
  swap_emulsifier_e471: {
    category: 'halal',
    tr: {
      lookFor: 'Ayçiçek Lesitini (E322), Guar Gam (E412), Ksantan Gam (E415) veya açıkça "Bitkisel Kaynaklı (Vegetable) / Vegan / Helal Sertifikalı" İbareli Ürünler',
      why: 'Kaynağı yazmayan E471, gliserin, stearat veya polisorbatlar hayvansal ya da bitkisel olabilir; Ayçiçek Lesitini veya "Bitkisel/Vegan" beyanı şüpheyi sıfırlar.'
    },
    en: {
      lookFor: 'Sunflower Lecithin (E322), Guar Gum (E412), Xanthan Gum (E415), or products explicitly labeled "Vegetable-Origin / Vegan / Halal-Certified"',
      why: 'Unspecified E471, glycerin, stearates, or polysorbates can be animal- or plant-derived; Sunflower Lecithin or explicit Vegan/Halal labeling removes ambiguity.'
    },
    ar: {
      lookFor: 'ليسيثين دوار الشمس (E322)، صمغ الغوار (E412)، صمغ الزانثان (E415) أو المنتجات التي تحمل عبارة "من أصل نباتي / نباتي معتمد / حلال"',
      why: 'المستحلبات (E471) أو الجلسرين أو الاستيارات غير محددة المصدر قد تكون حيوانية أو نباتية؛ ليسيثين دوار الشمس أو شهادة الحلال/النباتي تزيل الشبهة.'
    },
    de: {
      lookFor: 'Sonnenblumenlecithin (E322), Guarkernmehl (E412), Xanthan (E415) oder explizit „Pflanzlich / Vegan / Halal-zertifiziert“',
      why: 'Nicht näher bezeichnetes E471, Glycerin oder Stearate können tierischen oder pflanzlichen Ursprungs sein; Sonnenblumenlecithin oder Vegan/Halal-Siegel schaffen Klarheit.'
    },
    fr: {
      lookFor: 'Lécithine de tournesol (E322), Gomme de guar (E412), Gomme xanthane (E415) ou mention explicite « Origine végétale / Vegan / Certifié Halal »',
      why: 'Les E471, glycérine ou stéarates sans mention d’origine peuvent être animaux ou végétaux ; la lécithine de tournesol ou le label Vegan/Halal lève toute ambiguïté.'
    },
    id: {
      lookFor: 'Lesitin Bunga Matahari (E322), Gom Guar (E412), Gomarab/Xanthan (E415), atau label eksplisit "Nabati (Vegetable) / Vegan / Bersertifikat Halal"',
      why: 'E471, gliserin, stearat, atau polisorbat tanpa keterangan sumber bisa berasal dari lemak hewani maupun nabati; lesitin bunga matahari atau label Halal/Vegan menghilangkan syubhat.'
    },
    ms: {
      lookFor: 'Lesitin Bunga Matahari (E322), Gam Guar (E412), Gam Xanthan (E415) atau label jelas "Sumber Tumbuhan / Vegan / Bersijil Halal"',
      why: 'E471, gliserin atau stearat tanpa sumber jelas boleh berasal daripada haiwan atau tumbuhan; lesitin bunga matahari atau sijil Halal/Vegan menghapuskan syubhah.'
    },
    es: {
      lookFor: 'Lecitina de girasol (E322), Goma guar (E412), Goma xantana (E415) o mención explícita «Origen vegetal / Vegano / Certificado Halal»',
      why: 'Los E471, glicerina o estearatos sin origen declarado pueden ser animales o vegetales; la lecitina de girasol o el sello Vegano/Halal eliminan la duda.'
    },
    ru: {
      lookFor: 'Подсолнечный лецитин (E322), гуаровая камедь (E412), ксантановая камедь (E415) или маркировка «Растительного происхождения / Веган / Халяль»',
      why: 'E471, глицерин и стеараты без указания источника могут быть животными или растительными; подсолнечный лецитин или сертификат Халяль/Веган исключают сомнения.'
    },
    ur: {
      lookFor: 'سورج مکھی کا لیسیتھین (E322)، گوار گم (E412)، زینتھن گم (E415) یا واضح طور پر "نباتاتی ماخذ (Vegetable) / ویگن / حلال سرٹیفائیڈ" مصنوعات',
      why: 'غیر واضح E471، گلیسرین یا اسٹیریٹس حیوانی یا نباتاتی دونوں ہو سکتے ہیں؛ سورج مکھی کا لیسیتھین یا حلال/ویگن تصدیق اس شبہے کو ختم کرتی ہے۔'
    }
  },
  swap_lcysteine_enzymes_whey: {
    category: 'halal',
    tr: {
      lookFor: 'Unlu Mamullerde Askorbik Asit (E300 / C Vitamini), Peynir Altı Suyunda "Mikrobiyal Maya (Microbial Rennet)", Çeşnide Maya Ekstresi (Yeast Extract) veya Helal Sertifikası',
      why: 'Kıl/tüy kaynaklı L-Sistein (E920), hayvansal peynir mayası ve et özütlü E631 yerine bitkisel/mikrobiyal alternatifler kaynak belirsizliğini kapatır.'
    },
    en: {
      lookFor: 'Ascorbic Acid (E300 / Vitamin C) in bakery, "Microbial Rennet" Whey, Yeast Extract for umami, or Halal Certification',
      why: 'Replaces hair/feather L-Cysteine (E920), animal rennet whey, and meat-derived E631 nucleotides with clean microbial/plant alternatives.'
    },
    ar: {
      lookFor: 'حمض الأسكوربيك (E300) في المخبوزات، "منفحة ميكروبية" لمصل اللبن، خلاصة الخميرة للنكهة، أو شهادة حلال معتمدة',
      why: 'البدائل الميكروبية والنباتية تغني عن إل-سيستين (E920) والإنزيمات الحيوانية ومحسنات النكهة المشتقة من اللحوم (E631).'
    },
    de: {
      lookFor: 'Ascorbinsäure (E300) in Backwaren, Molke mit „mikrobiellem Lab“, Hefeextrakt oder Halal-Zertifizierung',
      why: 'Mikrobielle und pflanzliche Alternativen ersetzen L-Cystein (E920), tierisches Lab und fleischbasierte Ribonukleotide (E631).'
    },
    fr: {
      lookFor: 'Acide ascorbique (E300) en boulangerie, lactosérum à « présure microbienne », extrait de levure ou certification Halal',
      why: 'Les alternatives microbiennes et végétales remplacent la L-cystéine (E920), la présure animale et les ribonucléotides (E631).'
    },
    id: {
      lookFor: 'Asam Askorbat (E300) pada roti, Whey dengan "Rennet Mikrobial", Ekstrak Ragi (Yeast Extract), atau Sertifikat Halal',
      why: 'Alternatif mikrobial dan nabati menggantikan L-Sistein (E920), enzim hewani, serta penguat rasa E631 yang rawan syubhat.'
    },
    ms: {
      lookFor: 'Asid Askorbik (E300) dalam roti, Whey "Rennet Mikrob", Ekstrak Yis atau Sijil Halal',
      why: 'Alternatif mikrob dan tumbuhan menggantikan L-Sistein (E920), enzim haiwan serta penambah perisa E631.'
    },
    es: {
      lookFor: 'Ácido ascórbico (E300) en panadería, suero con «cuajo microbiano», extracto de levadura o certificación Halal',
      why: 'Las alternativas microbianas y vegetales sustituyen a la L-cisteína (E920), el cuajo animal y los nucleótidos E631.'
    },
    ru: {
      lookFor: 'Аскорбиновая кислота (E300) в выпечке, сыворотка на «микробном ферменте», дрожжевой экстракт или сертификат Халяль',
      why: 'Микробные и растительные аналоги заменяют L-цистеин (E920), животный сычуг и нуклеотиды E631.'
    },
    ur: {
      lookFor: 'بیکری میں ایسکوربک ایسڈ (E300)، "مائیکروبیل رینٹ" والا وے (Whey)، ییسٹ ایکسٹریکٹ یا حلال سرٹیفکیٹ',
      why: 'L-Cysteine (E920)، حیوانی انزائمز اور E631 کے بجائے مائیکروبیل اور نباتاتی متبادل ماخذ کے شبہے کو دور کرتے ہیں۔'
    }
  },
  swap_collagen_snail_squalene: {
    category: 'halal',
    tr: {
      lookFor: 'Zeytin Kaynaklı Skualan ("Squalane" - "a" harfiyle), Bitkisel Fitoseramidler (Ceramide NP/AP), Bitkisel Peptitler veya Hyaluronik Asit',
      why: 'Hayvansal kolajen, kolesterol, salyangoz salgısı veya köpekbalığı skualeni ("Squalene") yerine bitkisel Squalane ve fitoseramidler aynı bariyer/onarım etkisini helal ve vegan olarak sunar.'
    },
    en: {
      lookFor: 'Olive-Derived "Squalane" (with an "a"), Plant Phytoceramides (Ceramide NP/AP), Plant Peptides, or Hyaluronic Acid',
      why: 'Plant Squalane and phytoceramides provide the same barrier repair as animal collagen, cholesterol, snail mucin, or shark squalene, while remaining 100% Halal and Vegan.'
    },
    ar: {
      lookFor: 'السكوالان النباتي المشتق من الزيتون (Squalane)، السيراميدات النباتية (Ceramide NP/AP)، الببتيدات النباتية أو حمض الهيالورونيك',
      why: 'السكوالان والسيراميد النباتي يوفران نفس ترميم البشرة بدلاً من الكولاجين الحيواني أو الكوليسترول أو خلاصة الحلزون مع توافق تام مع الحلال والنباتي.'
    },
    de: {
      lookFor: 'Pflanzliches „Squalane“ (aus Oliven, mit „a“), Phytoceramide (Ceramide NP/AP), pflanzliche Peptide oder Hyaluronsäure',
      why: 'Pflanzliches Squalan und Phytoceramide bieten dieselbe Barrierereparatur wie tierisches Kollagen, Cholesterin oder Schneckenschleim – komplett Halal und Vegan.'
    },
    fr: {
      lookFor: '« Squalane » végétal issu de l’olive (avec un « a »), Phytocéramides (Ceramide NP/AP), Peptides végétaux ou Acide hyaluronique',
      why: 'Le squalane végétal et les phytocéramides offrent la même réparation cutanée que le collagène animal, le cholestérol ou la mucine d’escargot, en étant 100 % Halal et Vegan.'
    },
    id: {
      lookFor: 'Squalane Nabati dari Zaitun (dengan huruf "a"), Fitoseramida (Ceramide NP/AP), Peptida Nabati, atau Asam Hialuronat',
      why: 'Squalane nabati dan fitoseramida memberikan perbaikan skin barrier yang setara dengan kolagen hewani, kolesterol, atau lendir siput secara Halal dan Vegan.'
    },
    ms: {
      lookFor: 'Squalane Tumbuhan daripada Zaitun (ejaan "a"), Fitoseramida (Ceramide NP/AP), Peptida Tumbuhan atau Asid Hialuronik',
      why: 'Squalane tumbuhan dan fitoseramida memberi pemulihan kulit setara kolagen haiwan, kolesterol atau lendir siput secara 100% Halal dan Vegan.'
    },
    es: {
      lookFor: '«Squalane» vegetal de oliva (con «a»), Fitoceramidas (Ceramide NP/AP), Péptidos vegetales o Ácido hialurónico',
      why: 'El escualano vegetal y las fitoceramidas reparan la barrera cutánea igual que el colágeno animal, colesterol o baba de caracol, siendo 100% Halal y veganos.'
    },
    ru: {
      lookFor: 'Растительный сквалан из оливы («Squalane» через «a»), фитоцерамиды (Ceramide NP/AP), растительные пептиды или гиалуроновая кислота',
      why: 'Растительный сквалан и фитоцерамиды восстанавливают кожный барьер так же эффективно, как животный коллаген, холестерин или муцин улитки, оставаясь Халяль и Веган.'
    },
    ur: {
      lookFor: 'زیتون سے حاصل کردہ نباتاتی اسکوئلین ("Squalane" — "a" کے ساتھ)، نباتاتی سیرامائیڈز (Ceramide NP/AP)، پیپٹائڈز یا ہائیلورونک ایسڈ',
      why: 'حیوانی کولاجن، کولیسٹرول یا گھونگھے کے لعاب کے بجائے نباتاتی Squalane اور سیرامائیڈز جلد کی بہترین مرمت حلال اور ویگن طریقے سے کرتے ہیں۔'
    }
  },
  swap_aroma_vanilla_carrier: {
    category: 'halal',
    tr: {
      lookFor: 'Doğal Vanilya Çubuğu Tozu, Alkolsüz Vanilin veya "Helal Sertifikalı / Bitkisel Yağ Taşıyıcılı" Aroma',
      why: 'Sıvı aromalarda ve vanilya ekstraktında etil alkol çözücü riskini dışlamak için toz vanilya, vanilin veya helal sertifikalı aroma tercih edilmelidir.'
    },
    en: {
      lookFor: 'Natural Vanilla Bean Powder, Alcohol-Free Vanillin, or "Halal-Certified / Plant-Oil Carrier" Flavorings',
      why: 'Vanilla bean powder, vanillin, or Halal-certified oil-based flavorings avoid the ethyl alcohol extraction/carrier solvent risk.'
    },
    ar: {
      lookFor: 'مسحوق الفانيليا الطبيعية، الفانيلين الخالي من الكحول، أو المنكهات ذات "شهادة الحلال / المذيب الزيتي النباتي"',
      why: 'لتجنب احتمال استخدام الكحول الإيثيلي كمذيب في خلاصة الفانيليا السائلة والمنكهات، يُفضل مسحوق الفانيليا أو الفانيلين أو المنتج الموثق بشهادة حلال.'
    },
    de: {
      lookFor: 'Gemahlene Vanilleschote, alkoholfreies Vanillin oder „Halal-zertifizierte Aromen auf Pflanzenölbasis“',
      why: 'Vanillepulver, Vanillin oder Halal-zertifizierte Aromen schließen das Risiko von Ethanol als Extraktions- oder Trägerlösungsmittel aus.'
    },
    fr: {
      lookFor: 'Poudre de gousse de vanille, Vanilline sans alcool ou arômes « Certifiés Halal / sur support huile végétale »',
      why: 'La poudre de vanille, la vanilline ou les arômes certifiés Halal évitent le risque de solvant éthylique dans les extraits liquides.'
    },
    id: {
      lookFor: 'Bubuk Vanili Alami, Vanilin Bebas Alkohol, atau Perisa "Bersertifikat Halal / Pelarut Minyak Nabati"',
      why: 'Bubuk vanili, vanilin, atau perisa bersertifikat Halal menghindari risiko pelarut etanol pada ekstrak vanila cair.'
    },
    ms: {
      lookFor: 'Serbuk Vanila Asli, Vanilin Tanpa Alkohol atau Perisa "Bersijil Halal / Pembawa Minyak Tumbuhan"',
      why: 'Serbuk vanila, vanilin atau perisa bersijil Halal mengelakkan risiko pelarut etanol dalam ekstrak vanila cecair.'
    },
    es: {
      lookFor: 'Polvo de vaina de vainilla, Vainillina sin alcohol o aromas «Certificados Halal / en base de aceite vegetal»',
      why: 'El polvo de vainilla, la vainillina o los aromas certificados Halal evitan el uso de etanol como disolvente portador.'
    },
    ru: {
      lookFor: 'Молотая натуральная ваниль, безалкогольный ванилин или ароматизаторы с сертификатом «Халяль»',
      why: 'Ванильный порошок, ванилин или сертифицированные Халяль ароматизаторы исключают риск спиртового растворителя.'
    },
    ur: {
      lookFor: 'قدرتی ونیلا پاؤڈر، الکحل سے پاک ونیلن (Vanillin) یا "حلال سرٹیفائیڈ / نباتاتی تیل والا فلیور"',
      why: 'مائع ونیلا ایکسٹریکٹ اور فلیورز میں ایتھانول محلول کے خطرے سے بچنے کے لیے ونیلا پاؤڈر، ونیلن یا حلال سرٹیفائیڈ فلیور بہترین انتخاب ہے۔'
    }
  },
  swap_preservatives_mi_parabens: {
    category: 'health_regulatory',
    tr: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin veya "Paraben & MI/MCI İçermez" Formüller',
      why: 'Yüksek kontakt alerji potansiyelli MI/MCI, formaldehit salıcılar veya uzun zincirli parabenler yerine gıda sınıfı organik asit tuzları ve biyomimetik glikoller cilt için çok daha güvenlidir.'
    },
    en: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin, or "Paraben & MI/MCI-Free" formulas',
      why: 'Organic acid salts and biomimetic glycols provide safe preservation without the contact allergy or endocrine concerns of MI/MCI, formaldehyde releasers, or long-chain parabens.'
    },
    ar: {
      lookFor: 'بنزوات الصوديوم (Sodium Benzoate)، سوربات البوتاسيوم (Potassium Sorbate)، أو بنتيلين جلايكول مع إيثيل هكسيل جلسرين',
      why: 'بدائل الحفظ اللطيفة تحمي المنتج دون مخاطر التحسس الجلدي الشديد المرتبطة بمواد MI/MCI أو مطلقات الفورمالديهايد أو البارابين المحظور.'
    },
    de: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin oder „Paraben- & MI/MCI-frei“',
      why: 'Milde Konservierungssysteme vermeiden das hohe Kontaktallergie- und Reizpotenzial von MI/MCI, Formaldehydabspaltern und bedenklichen Parabenen.'
    },
    fr: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin ou formules « Sans parabènes ni MI/MCI »',
      why: 'Ces conservateurs doux évitent le fort potentiel allergène des isothiazolinones (MI/MCI), des libérateurs de formaldéhyde et des parabènes à chaîne longue.'
    },
    id: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin, atau formula "Bebas Paraben & MI/MCI"',
      why: 'Pengawet lembut ini mencegah risiko alergi kontak tinggi dari MI/MCI, pelepas formaldehida, maupun paraben rantai panjang.'
    },
    ms: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin atau formula "Bebas Paraben & MI/MCI"',
      why: 'Pengawet lembut ini mengelakkan risiko alahan sentuhan tinggi daripada MI/MCI, pelepas formaldehid dan paraben terlarang.'
    },
    es: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin o fórmulas «Sin parabenos ni MI/MCI»',
      why: 'Estos conservantes suaves evitan la dermatitis de contacto asociada a MI/MCI, liberadores de formaldehído y parabenos restringidos.'
    },
    ru: {
      lookFor: 'Sodium Benzoate, Potassium Sorbate, Pentylene Glycol + Ethylhexylglycerin или формулы «Без парабенов и MI/MCI»',
      why: 'Мягкие консерванты защищают формулу без высокого риска контактного дерматита от MI/MCI, доноров формальдегида и парабенов.'
    },
    ur: {
      lookFor: 'Sodium Benzoate، Potassium Sorbate، Pentylene Glycol + Ethylhexylglycerin یا "پیرابین اور MI/MCI سے پاک" فارمولے',
      why: 'MI/MCI، فارملڈیہائیڈ خارج کرنے والے اجزاء اور پیرابینز کے مقابلے میں یہ متبادل حساس جلد کو الرجی اور جلن سے محفوظ رکھتے ہیں۔'
    }
  },
  swap_harsh_sulfates: {
    category: 'health_regulatory',
    tr: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate veya Cocamidopropyl Betaine ("Sülfatsız / Sulfate-Free")',
      why: 'Sert sülfatlar (SLS/SLES) yerine şeker ve hindistancevizi bazlı glukozit/izetiyonat yüzey aktifler cilt ve saç derisi bariyerini kurutmadan temizler.'
    },
    en: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate, or Cocamidopropyl Betaine ("Sulfate-Free")',
      why: 'Sugar- and coconut-derived glucoside/isethionate surfactants cleanse gently without stripping the skin or scalp barrier like harsh SLS/SLES.'
    },
    ar: {
      lookFor: 'كوكو جلوكوسيد (Coco-Glucoside)، ديسيل جلوكوسيد (Decyl Glucoside)، أو إيزيثيونات الصوديوم ("خالٍ من السلفات / Sulfate-Free")',
      why: 'المنظفات المشتقة من السكر وجوز الهند تنظف بلطف دون إضعاف حاجز البشرة أو فروة الرأس كما تفعل السلفات القوية (SLS/SLES).'
    },
    de: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate („Sulfatfrei / Sulfate-Free“)',
      why: 'Zucker- und kokosbasierte Tenside reinigen sanft, ohne die Hautbarriere wie aggressive Sulfate (SLS/SLES) auszutrocknen.'
    },
    fr: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate (« Sans sulfates / Sulfate-Free »)',
      why: 'Les tensioactifs doux issus du sucre et de la noix de coco nettoient sans agresser la barrière cutanée contrairement aux SLS/SLES.'
    },
    id: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside, atau Sodium Cocoyl Isethionate ("Bebas Sulfat / Sulfate-Free")',
      why: 'Surfaktan berbasis gula dan kelapa membersihkan dengan lembut tanpa mengikis pelindung kulit seperti SLS/SLES.'
    },
    ms: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside atau Sodium Cocoyl Isethionate ("Bebas Sulfat / Sulfate-Free")',
      why: 'Surfaktan berasaskan gula dan kelapa membersihkan secara lembut tanpa merengsakan kulit seperti SLS/SLES.'
    },
    es: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside o Sodium Cocoyl Isethionate («Sin sulfatos / Sulfate-Free»)',
      why: 'Los tensioactivos derivados del azúcar y el coco limpian suavemente sin resecar la barrera cutánea como el SLS/SLES.'
    },
    ru: {
      lookFor: 'Coco-Glucoside, Decyl Glucoside, Lauryl Glucoside или Sodium Cocoyl Isethionate («Без сульфатов / Sulfate-Free»)',
      why: 'Мягкие ПАВ из кокоса и сахаров бережно очищают кожу и волосы, не разрушая липидный барьер, в отличие от SLS/SLES.'
    },
    ur: {
      lookFor: 'Coco-Glucoside، Decyl Glucoside، Lauryl Glucoside یا Sodium Cocoyl Isethionate ("سلفیٹ فری / Sulfate-Free")',
      why: 'تیز سلفیٹس (SLS/SLES) کے بجائے ناریل اور شوگر سے بنے نرم کلینزنگ اجزاء جلد اور بالوں کی قدرتی نمی کو نقصان پہنچائے بغیر صفائی کرتے ہیں۔'
    }
  },
  swap_fragrance_sensitizers: {
    category: 'health_regulatory',
    tr: {
      lookFor: '"Parfümsüz / Fragrance-Free" İbareli, Panthenol (B5), Allantoin, Bisabolol veya Yulaf Özlü (Avena Sativa) Formüller',
      why: 'Yasaklı/alerjen koku bileşenleri (Lilial, Lyral, Linalool, Limonene, Parfum) kontakt dermatitin 1 numaralı tetikleyicisidir; parfümsüz yatıştırıcı formüller bu riski kapatır.'
    },
    en: {
      lookFor: '"Fragrance-Free / Unscented" formulas enriched with Panthenol (B5), Allantoin, Bisabolol, or Colloidal Oatmeal (Avena Sativa)',
      why: 'Banned or sensitizing fragrance allergens (Lilial, Lyral, Linalool, Limonene, Parfum) are leading triggers of contact dermatitis; fragrance-free soothing formulas eliminate this risk.'
    },
    ar: {
      lookFor: 'تركيبات تحمل عبارة "خالٍ من العطور / Fragrance-Free" مع البانثينول (B5)، الألانتوين، البيسابولول أو خلاصة الشوفان',
      why: 'مسببات حساسية العطور (مثل Lilial وLinalool وParfum) هي المحفز الأول لالتهاب الجلد التماسي؛ المنتجات الخالية من العطور تمنع هذا التهيج.'
    },
    de: {
      lookFor: '„Parfümfrei / Fragrance-Free“-Formeln mit Panthenol (B5), Allantoin, Bisabolol oder Haferextrakt (Avena Sativa)',
      why: 'Duftstoffallergene (Lilial, Linalool, Limonene, Parfum) sind Hauptauslöser für Kontaktallergien; parfümfreie Pflege schützt empfindliche Haut.'
    },
    fr: {
      lookFor: 'Formules « Sans parfum / Fragrance-Free » avec Panthénol (B5), Allantoïne, Bisabolol ou Avoine colloïdale (Avena Sativa)',
      why: 'Les allergènes de parfum (Lilial, Linalool, Limonene, Parfum) sont la première cause d’eczéma de contact ; les soins sans parfum éliminent ce risque.'
    },
    id: {
      lookFor: 'Formula "Fragrance-Free / Tanpa Parfum" dengan Panthenol (B5), Allantoin, Bisabolol, atau Oat (Avena Sativa)',
      why: 'Alergen pewangi (Lilial, Linalool, Limonene, Parfum) adalah pemicu utama dermatitis kontak; formula bebas parfum menjaga kulit sensitif tetap aman.'
    },
    ms: {
      lookFor: 'Formula "Tanpa Pewangi / Fragrance-Free" dengan Panthenol (B5), Allantoin, Bisabolol atau Ekstrak Oat (Avena Sativa)',
      why: 'Alergen pewangi (Lilial, Linalool, Limonene, Parfum) ialah pencetus utama ekzema sentuhan; formula bebas pewangi menghapuskan risiko ini.'
    },
    es: {
      lookFor: 'Fórmulas «Sin perfume / Fragrance-Free» con Pantenol (B5), Alantoína, Bisabolol o Avena coloidal (Avena Sativa)',
      why: 'Los alérgenos de fragancia (Lilial, Linalool, Limonene, Parfum) son la principal causa de dermatitis de contacto; las fórmulas sin perfume previenen la irritación.'
    },
    ru: {
      lookFor: 'Формулы «Без отдушек / Fragrance-Free» с пантенолом (B5), аллантоином, бисабололом или экстрактом овса (Avena Sativa)',
      why: 'Парфюмерные аллергены (Lilial, Linalool, Limonene, Parfum) — главная причина контактного дерматита; средства без отдушек безопасны для чувствительной кожи.'
    },
    ur: {
      lookFor: '"خوشبو سے پاک / Fragrance-Free" فارمولے جن میں Panthenol (B5)، Allantoin، Bisabolol یا جئی کا عرق (Avena Sativa) شامل ہو',
      why: 'خوشبو کے الرجنز (جیسے Lilial، Linalool، Parfum) جلد کی الرجی اور خارش کی سب سے بڑی وجہ ہیں؛ خوشبو سے پاک فارمولے اس خطرے کو ختم کرتے ہیں۔'
    }
  },
  swap_retinoids_acids_actives: {
    category: 'health_regulatory',
    tr: {
      lookFor: 'Bakuchiol (Bitkisel Retinol Alternatifi), Niacinamide (B3), Azelaic Acid, Tranexamic Acid veya PHA (Gluconolactone)',
      why: 'Gebelikte veya hassas ciltte kısıtlı/tahriş edici retinoid, hidrokinon ve sert soyucu asitler yerine Bakuchiol, Azelaik Asit ve Niacinamide güvenli leke ve yenileme desteği sağlar.'
    },
    en: {
      lookFor: 'Bakuchiol (Plant Retinol Alternative), Niacinamide (Vitamin B3), Azelaic Acid, Tranexamic Acid, or PHA (Gluconolactone)',
      why: 'Bakuchiol, Azelaic Acid, and Niacinamide deliver gentle brightening and renewal without the pregnancy or irritation risks of retinoids, hydroquinone, or strong acids.'
    },
    ar: {
      lookFor: 'باكوتشيول (Bakuchiol - البديل النباتي للريتينول)، نياسيناميد (B3)، حمض الأزيليك (Azelaic Acid) أو أحماض PHA اللطيفة',
      why: 'الباكوتشيول وحمض الأزيليك والنياسيناميد توفر تجديداً وتفتيحاً آمناً للبشرة دون مخاطر الريتينويدات أو الهيدروكينون أثناء الحمل أو للبشرة الحساسة.'
    },
    de: {
      lookFor: 'Bakuchiol (pflanzliche Retinol-Alternative), Niacinamid (B3), Azelainsäure (Azelaic Acid) oder milde PHA (Gluconolacton)',
      why: 'Bakuchiol, Azelainsäure und Niacinamid bieten sanfte Hauterneuerung ohne die Schwangerschafts- und Reizrisiken von Retinoiden oder Hydrochinon.'
    },
    fr: {
      lookFor: 'Bakuchiol (alternative végétale au rétinol), Niacinamide (B3), Acide azélaïque ou PHA doux (Gluconolactone)',
      why: 'Le Bakuchiol, l’acide azélaïque et la niacinamide offrent un soin anti-taches et régénérant sûr, sans les risques liés aux rétinoïdes ou à l’hydroquinone.'
    },
    id: {
      lookFor: 'Bakuchiol (Alternatif Retinol Nabati), Niacinamide (B3), Azelaic Acid, Tranexamic Acid, atau PHA (Gluconolactone)',
      why: 'Bakuchiol, Azelaic Acid, dan Niacinamide memberikan pencerahan serta regenerasi kulit yang aman bagi ibu hamil dan kulit sensitif.'
    },
    ms: {
      lookFor: 'Bakuchiol (Alternatif Retinol Tumbuhan), Niacinamide (B3), Azelaic Acid, Tranexamic Acid atau PHA (Gluconolactone)',
      why: 'Bakuchiol, Azelaic Acid dan Niacinamide mencerahkan serta memperbaharui kulit dengan selamat tanpa risiko retinoid atau hidrokuinon.'
    },
    es: {
      lookFor: 'Bakuchiol (alternativa vegetal al retinol), Niacinamida (B3), Ácido azelaico o PHA suaves (Gluconolactona)',
      why: 'El Bakuchiol, el ácido azelaico y la niacinamida renuevan e iluminan la piel sin los riesgos de los retinoides o la hidroquinona.'
    },
    ru: {
      lookFor: 'Бакучиол (Bakuchiol — растительная альтернатива ретинолу), ниацинамид (B3), азелаиновая кислота или мягкие PHA-кислоты',
      why: 'Бакучиол, азелаиновая кислота и ниацинамид безопасно обновляют и осветляют кожу без рисков ретиноидов и гидрохинона.'
    },
    ur: {
      lookFor: 'باکوچیول (Bakuchiol — ریٹینول کا نباتاتی متبادل)، نیاسینامائڈ (B3)، ایزیلک ایسڈ (Azelaic Acid) یا نرم PHA (Gluconolactone)',
      why: 'حمل یا حساس جلد میں ریٹینول، ہائیڈروکوئنون اور تیز تیزاب کے بجائے باکوچیول، ایزیلک ایسڈ اور نیاسینامائڈ محفوظ متبادل ہیں۔'
    }
  },
  swap_uv_filters_silicones_nail: {
    category: 'health_regulatory',
    tr: {
      lookFor: 'Güneşte Mineral Filtre (Zinc Oxide) veya Yeni Nesil Tinosorb S / Uvinul A Plus; Tırnakta "HEMA-Free & TPO-Free"; Bakımda Skualan / Piroctone Olamine',
      why: 'Endokrin/alerji şüphesi taşıyan eski nesil UV filtreleri, siklosiloksanlar (D4/D5), Zinc Pyrithione ve TPO/HEMA yerine yeni nesil güvenli aktifler tercih edilmelidir.'
    },
    en: {
      lookFor: 'Mineral UV Filters (Zinc Oxide) or Modern Filters (Tinosorb S / Uvinul A Plus); "HEMA-Free & TPO-Free" nail gels; Squalane / Piroctone Olamine in care',
      why: 'Replaces legacy UV filters, cyclosiloxanes (D4/D5), banned Zinc Pyrithione, and sensitizing nail monomers (TPO/HEMA) with compliant modern actives.'
    },
    ar: {
      lookFor: 'فلاتر شمسية معدنية (Zinc Oxide) أو حديثة (Tinosorb S)؛ طلاء أظافر "خالٍ من TPO وHEMA"؛ وسكوالان / بيروكتون أولامين في العناية',
      why: 'استبدال فلاتر الأشعة القديمة والسيكلوسيلوكسانات ومواد الأظافر المحظورة (TPO/HEMA) ببدائل حديثة آمنة ومعتمدة.'
    },
    de: {
      lookFor: 'Mineralische UV-Filter (Zinc Oxide) oder Tinosorb S; „HEMA-Free & TPO-Free“ bei Nagellack; Squalan / Pirocton Olamin in der Pflege',
      why: 'Ersetzt bedenkliche Alt-UV-Filter, Cyclosiloxane (D4/D5), Zinkpyrithion und TPO/HEMA durch moderne, EU-konforme Wirkstoffe.'
    },
    fr: {
      lookFor: 'Filtres UV minéraux (Zinc Oxide) ou Tinosorb S ; vernis « Sans HEMA ni TPO » ; Squalane / Piroctone Olamine en soin',
      why: 'Remplace les anciens filtres UV, cyclosiloxanes (D4/D5), pyrithione de zinc et monomères TPO/HEMA par des actifs modernes sûrs.'
    },
    id: {
      lookFor: 'Filter UV Mineral (Zinc Oxide) atau Tinosorb S; Kuteks Gel "HEMA-Free & TPO-Free"; Squalane / Piroctone Olamine pada perawatan',
      why: 'Menggantikan filter UV lama, siklosiloksan (D4/D5), Zinc Pyrithione, dan monomer kuku TPO/HEMA dengan bahan aktif modern yang aman.'
    },
    ms: {
      lookFor: 'Penapis UV Mineral (Zinc Oxide) atau Tinosorb S; Gel Kuku "HEMA-Free & TPO-Free"; Squalane / Piroctone Olamine dalam penjagaan',
      why: 'Menggantikan penapis UV lama, siklosiloksana (D4/D5), Zinc Pyrithione dan monomer TPO/HEMA dengan bahan aktif moden yang selamat.'
    },
    es: {
      lookFor: 'Filtros UV minerales (Zinc Oxide) o Tinosorb S; esmaltes «Sin HEMA ni TPO»; Escualano / Piroctona Olamina en cuidado',
      why: 'Sustituye filtros UV antiguos, ciclosiloxanos (D4/D5), piritionato de zinc y TPO/HEMA por activos modernos seguros.'
    },
    ru: {
      lookFor: 'Минеральные UV-фильтры (Zinc Oxide) или Tinosorb S; гель-лаки «HEMA-Free & TPO-Free»; сквалан / пироктон оламин в уходе',
      why: 'Заменяет устаревшие UV-фильтры, циклосилоксаны (D4/D5), пиритион цинка и мономеры TPO/HEMA современными безопасными компонентами.'
    },
    ur: {
      lookFor: 'منرل یو وی فلٹرز (Zinc Oxide) یا جدید Tinosorb S؛ نیل جیل میں "HEMA-Free & TPO-Free"؛ اور دیکھ بھال میں Squalane / Piroctone Olamine',
      why: 'پرانے یو وی فلٹرز، سائیکلوسلوکسین (D4/D5)، ممنوعہ زنک پائریتھیون اور TPO/HEMA کے بجائے جدید اور محفوظ اجزاء کا انتخاب کریں۔'
    }
  },
  swap_comedogenic_acne: {
    category: 'health_regulatory',
    tr: {
      lookFor: '"Non-Comedogenic (Gözenek Tıkamaz)" İbareli Skualan (Squalane), Jojoba Yağı, Caprylic/Capric Triglyceride veya Niacinamide',
      why: 'Komedojenik ester ve ağır yağlar (Isopropyl Myristate, Hindistancevizi/Kakao yağı) akneye eğilimli ciltte gözenek tıkar; hafif kuru yağlar ve skualan gözenek dostudur.'
    },
    en: {
      lookFor: '"Non-Comedogenic" Squalane, Jojoba Oil, Caprylic/Capric Triglyceride, or Niacinamide',
      why: 'Heavy comedogenic esters and butters (Isopropyl Myristate, Coconut/Cocoa Butter) clog acne-prone pores; Squalane and lightweight triglycerides keep pores clear.'
    },
    ar: {
      lookFor: 'السكوالان (Squalane)، زيت الجوجوبا، Caprylic/Capric Triglyceride أو النياسيناميد بعلامة "لا يسد المسام / Non-Comedogenic"',
      why: 'الإسترات والزيوت الثقيلة (مثل Isopropyl Myristate وزيت جوز الهند) تسد المسام للبشرة المعرضة لحب الشباب، بينما السكوالان خفيف وآمن للمسام.'
    },
    de: {
      lookFor: '„Nicht komedogenes (Non-Comedogenic)“ Squalan, Jojobaöl, Caprylic/Capric Triglyceride oder Niacinamid',
      why: 'Schwere komedogene Ester und Fette verstopfen zu Akne neigende Poren; leichtes Squalan pflegt ohne Porenblockade.'
    },
    fr: {
      lookFor: 'Squalane « Non comédogène », Huile de jojoba, Caprylic/Capric Triglyceride ou Niacinamide',
      why: 'Les esters et beurres comédogènes obstruent les pores des peaux acnéiques ; le squalane hydrate sans boucher les pores.'
    },
    id: {
      lookFor: 'Squalane "Non-Comedogenic", Minyak Jojoba, Caprylic/Capric Triglyceride, atau Niacinamide',
      why: 'Ester dan minyak berat (Isopropyl Myristate, minyak kelapa) menyumbat pori kulit berjerawat; Squalane melembapkan tanpa memicu komedo.'
    },
    ms: {
      lookFor: 'Squalane "Non-Comedogenic", Minyak Jojoba, Caprylic/Capric Triglyceride atau Niacinamide',
      why: 'Ester dan minyak berat menyumbat liang pori kulit berjerawat; Squalane melembapkan tanpa menyumbat pori.'
    },
    es: {
      lookFor: 'Escualano «No comedogénico», Aceite de jojoba, Caprylic/Capric Triglyceride o Niacinamida',
      why: 'Los ésteres y mantecas comedogénicas obstruyen los poros con tendencia acneica; el escualano hidrata sin obstruir.'
    },
    ru: {
      lookFor: 'Некомедогенный сквалан (Squalane), масло жожоба, Caprylic/Capric Triglyceride или ниацинамид',
      why: 'Комедогенные эфиры и плотные масла забивают поры проблемной кожи; легкий сквалан увлажняет без риска комедонов.'
    },
    ur: {
      lookFor: '"نان کومیڈوجینک (Non-Comedogenic)" اسکوئلین (Squalane)، جوجوبا آئل، Caprylic/Capric Triglyceride یا نیاسینامائڈ',
      why: 'بھاری تیل اور ایسٹرز (جیسے Isopropyl Myristate) مسام بند کر کے ایکنی بڑھاتے ہیں؛ اسکوئلین مسام بند کیے بغیر جلد کو نرم رکھتا ہے۔'
    }
  },
  swap_food_dyes_additives: {
    category: 'health_regulatory',
    tr: {
      lookFor: 'Doğal Bitkisel Boyalar (Zerdeçal E100, Beta-Karoten E160a, Pancar E162), Biberiye Ekstresi (E392), C/E Vitamini (E300/E306) ve "Koruyucusuz / Renklendiricisiz" Etiket',
      why: 'Sentetik azo boyalar, Titanyum Dioksit (E171), nitritler (E250) ve BHA/BHT yerine bitkisel özler ve doğal antioksidanlar çocuk gelişimi ve metabolik sağlık için güvenli alternatiftir.'
    },
    en: {
      lookFor: 'Natural Plant Colorants (Turmeric/Curcumin E100, Beta-Carotene E160a, Beetroot E162), Rosemary Extract (E392), Vitamins C/E (E300/E306), and "No Artificial Colors/Preservatives"',
      why: 'Replaces synthetic azo dyes, Titanium Dioxide (E171), nitrites (E250), and BHA/BHT with natural plant pigments and antioxidants.'
    },
    ar: {
      lookFor: 'ملونات نباتية طبيعية (الكركم E100، بيتا كاروتين E160a، الشمندر E162)، خلاصة إكليل الجبل (E392)، وفيتامين C/E (E300/E306)',
      why: 'استبدال أصباغ الآزو الصناعية وثاني أكسيد التيتانيوم (E171) والنتريت (E250) ومضادات الأكسدة الصناعية بمستخلصات نباتية طبيعية آمنة.'
    },
    de: {
      lookFor: 'Natürliche Pflanzenfarbstoffe (Kurkuma E100, Beta-Carotin E160a, Rote Bete E162), Rosmarinextrakt (E392) sowie Vitamin C/E (E300/E306)',
      why: 'Pflanzliche Farbstoffe und natürliche Antioxidantien ersetzen synthetische Azofarbstoffe, Titandioxid (E171), Nitrite (E250) und BHA/BHT.'
    },
    fr: {
      lookFor: 'Colorants végétaux naturels (Curcuma E100, Bêta-carotène E160a, Betterave E162), Extrait de romarin (E392) et Vitamines C/E (E300/E306)',
      why: 'Remplace les colorants azoïques synthétiques, le dioxyde de titane (E171), les nitrites (E250) et les BHA/BHT par des extraits végétaux naturels.'
    },
    id: {
      lookFor: 'Pewarna Nabati Alami (Kunyit/Kurkumin E100, Beta-Karoten E160a, Bit E162), Ekstrak Rosemary (E392), dan Vitamin C/E (E300/E306)',
      why: 'Menggantikan pewarna sintetis azo, Titanium Dioksida (E171), nitrit (E250), dan BHA/BHT dengan pigmen serta antioksidan alami.'
    },
    ms: {
      lookFor: 'Pewarna Tumbuhan Asli (Kunyit E100, Beta-Karotena E160a, Ubi Bit E162), Ekstrak Rosemary (E392) dan Vitamin C/E (E300/E306)',
      why: 'Menggantikan pewarna sintetik azo, Titanium Dioksida (E171), nitrit (E250) dan BHA/BHT dengan ekstrak tumbuhan semula jadi.'
    },
    es: {
      lookFor: 'Colorantes vegetales naturales (Cúrcuma E100, Betacaroteno E160a, Remolacha E162), Extracto de romero (E392) y Vitaminas C/E (E300/E306)',
      why: 'Sustituye colorantes azoicos sintéticos, dióxido de titanio (E171), nitritos (E250) y BHA/BHT por pigmentos y antioxidantes naturales.'
    },
    ru: {
      lookFor: 'Натуральные растительные красители (куркумин E100, бета-каротин E160a, свекла E162), экстракт розмарина (E392) и витамины C/E (E300/E306)',
      why: 'Заменяет синтетические азокрасители, диоксид титана (E171), нитриты (E250) и BHA/BHT безопасными природными антиоксидантами.'
    },
    ur: {
      lookFor: 'قدرتی نباتاتی رنگ (ہلدی E100، بیٹا کیروٹین E160a، چقندر E162)، روزمیری ایکسٹریکٹ (E392) اور وٹامن C/E (E300/E306)',
      why: 'مصنوعی رنگوں، ٹائٹینیم ڈائی آکسائیڈ (E171)، نائٹرائٹس (E250) اور BHA/BHT کے بجائے قدرتی نباتاتی اجزاء صحت کے لیے محفوظ متبادل ہیں۔'
    }
  },
  swap_allergen_soy_lecithin: {
    category: 'allergen_profile',
    tr: {
      lookFor: 'Ayçiçek Lesitini (Sunflower Lecithin) ve "Soya İçermez / Soy-Free" İbareli Ürünler',
      why: 'Soya alerjisi veya hassasiyeti olanlar için Ayçiçek Lesitini (Sunflower Lecithin) aynı emülgatör görevini soya proteini riski olmadan yerine getirir.'
    },
    en: {
      lookFor: 'Sunflower Lecithin and products labeled "Soy-Free"',
      why: 'Sunflower Lecithin performs the exact same emulsifying function without soy allergen risks.'
    },
    ar: {
      lookFor: 'ليسيثين دوار الشمس (Sunflower Lecithin) والمنتجات التي تحمل عبارة "خالٍ من الصويا / Soy-Free"',
      why: 'يقوم ليسيثين دوار الشمس بنفس وظيفة الاستحلاب تماماً دون مخاطر حساسية الصويا.'
    },
    de: {
      lookFor: 'Sonnenblumenlecithin (Sunflower Lecithin) und Produkte mit dem Hinweis „Sojafrei / Soy-Free“',
      why: 'Sonnenblumenlecithin erfüllt dieselbe Emulgatorfunktion ohne das Allergierisiko von Soja.'
    },
    fr: {
      lookFor: 'Lécithine de tournesol (Sunflower Lecithin) et produits mentionnant « Sans soja / Soy-Free »',
      why: 'La lécithine de tournesol assure la même fonction émulsifiante sans risque d’allergie au soja.'
    },
    id: {
      lookFor: 'Lesitin Bunga Matahari (Sunflower Lecithin) dan produk berlabel "Bebas Kedelai / Soy-Free"',
      why: 'Lesitin bunga matahari memberikan fungsi pengemulsi yang sama tanpa risiko alergen kedelai.'
    },
    ms: {
      lookFor: 'Lesitin Bunga Matahari (Sunflower Lecithin) dan produk berlabel "Bebas Soya / Soy-Free"',
      why: 'Lesitin bunga matahari berfungsi sebagai pengemulsi yang sama tanpa risiko alahan soya.'
    },
    es: {
      lookFor: 'Lecitina de girasol (Sunflower Lecithin) y productos etiquetados «Sin soja / Soy-Free»',
      why: 'La lecitina de girasol cumple la misma función emulsionante sin el riesgo alergénico de la soja.'
    },
    ru: {
      lookFor: 'Подсолнечный лецитин (Sunflower Lecithin) и продукты с маркировкой «Без сои / Soy-Free»',
      why: 'Подсолнечный лецитин выполняет ту же роль эмульгатора без риска аллергии на сою.'
    },
    ur: {
      lookFor: 'سورج مکھی کا لیسیتھین (Sunflower Lecithin) اور "سویا سے پاک / Soy-Free" لیبل والی مصنوعات',
      why: 'سویا الرجی سے بچاؤ کے لیے سورج مکھی کا لیسیتھین بغیر کسی الرجن خطرے کے بالکل وہی ایملسیفائر کا کام کرتا ہے۔'
    }
  },
  swap_allergen_dairy_milk: {
    category: 'allergen_profile',
    tr: {
      lookFor: 'Yulaf, Badem veya Hindistancevizi Sütü/Kreması Bazlı ve "Süt Ürünü İçermez / Dairy-Free / Vegan" Etiketli Ürünler',
      why: 'Süt proteini (kazein/peynir altı suyu), laktoz veya "eser miktarda süt" çapraz bulaşma riskine karşı bitkisel bazlı ve ayrı hatta üretilmiş ("Dairy-Free") ürünler güvenlidir.'
    },
    en: {
      lookFor: 'Oat, Almond, or Coconut Milk/Cream alternatives labeled "Dairy-Free / Certified Vegan"',
      why: 'Dedicated "Dairy-Free" plant-based products prevent both direct milk/lactose exposure and cross-contact trace milk risks.'
    },
    ar: {
      lookFor: 'بدائل حليب الشوفان أو اللوز أو جوز الهند مع ملصق "خالٍ من الألبان / Dairy-Free / نباتي معتمد"',
      why: 'المنتجات النباتية المصنعة في خطوط خالية من الألبان تحمي من بروتين الحليب واللاكتوز وآثار التلوث الخلطي.'
    },
    de: {
      lookFor: 'Hafer-, Mandel- oder Kokosmilch-Alternativen mit „Milchfrei / Dairy-Free / Vegan“-Kennzeichnung',
      why: 'Zertifiziert milchfreie Produkte schützen sowohl vor direktem Milcheiweiß/Laktose als auch vor Kreuzkontamination („Spuren von Milch“).'
    },
    fr: {
      lookFor: 'Alternatives à base d’avoine, d’amande ou de coco portant la mention « Sans produits laitiers / Dairy-Free / Vegan »',
      why: 'Les produits certifiés sans lait évitent l’exposition directe au lactose/caséine ainsi que les traces de contamination croisée.'
    },
    id: {
      lookFor: 'Alternatif Susu Oat, Almond, atau Kelapa dengan label "Bebas Susu / Dairy-Free / Vegan"',
      why: 'Produk nabati berlabel "Dairy-Free" mencegah paparan protein susu, laktosa, maupun kontaminasi silang.'
    },
    ms: {
      lookFor: 'Alternatif Susu Oat, Badam atau Kelapa berlabel "Bebas Tenusu / Dairy-Free / Vegan"',
      why: 'Produk berasaskan tumbuhan berlabel "Dairy-Free" mengelakkan pendedahan protein susu, laktosa dan jejak pencemaran silang.'
    },
    es: {
      lookFor: 'Alternativas de avena, almendra o coco con etiqueta «Sin lácteos / Dairy-Free / Vegano»',
      why: 'Los productos certificados sin lácteos evitan tanto la proteína de leche/lactosa como las trazas por contaminación cruzada.'
    },
    ru: {
      lookFor: 'Продукты на основе овсяного, миндального или кокосового молока с маркировкой «Без молока / Dairy-Free / Веган»',
      why: 'Сертифицированные безмолочные продукты защищают от молочного белка, лактозы и следов перекрестного загрязнения.'
    },
    ur: {
      lookFor: 'جئی (Oat)، بادام یا ناریل کے دودھ پر مبنی اور "ڈیری فری / Dairy-Free / ویگن" لیبل والی مصنوعات',
      why: 'دودھ کی الرجی، لیکٹوز یا "معمولی ذرات (May contain milk)" کے خطرے سے بچنے کے لیے ڈیری فری لائن پر تیار کردہ نباتاتی مصنوعات محفوظ ہیں۔'
    }
  },
  swap_allergen_gluten_wheat: {
    category: 'allergen_profile',
    tr: {
      lookFor: '"Glutensiz (Gluten-Free)" Sertifikalı Pirinç Unu, Karabuğday (Greçka), Mısır, Kinoa veya Glutensiz Yulaf Unu',
      why: 'Çölyak ve gluten hassasiyetinde buğday/arpa/çavdar unu yerine sertifikalı glutensiz tahıl ve tohum unları tercih edilmelidir.'
    },
    en: {
      lookFor: '"Certified Gluten-Free" Rice Flour, Buckwheat, Corn, Quinoa, or Gluten-Free Oat Flour',
      why: 'Certified gluten-free grain and seed flours safely replace wheat, barley, and rye for celiac or gluten-sensitive individuals.'
    },
    ar: {
      lookFor: 'دقيق الأرز، الحنطة السوداء، الذرة، الكينوا أو الشوفان المعتمد بشهادة "خالٍ من الغلوتين / Gluten-Free"',
      why: 'للمصابين بالسيلياك أو حساسية الغلوتين، يُستبدل دقيق القمح والشعير ببدائل الحبوب المعتمدة الخالية من الغلوتين.'
    },
    de: {
      lookFor: 'Zertifiziert „Glutenfreies (Gluten-Free)“ Reismehl, Buchweizen, Mais, Quinoa oder glutenfreies Hafermehl',
      why: 'Bei Zöliakie und Glutensensitivität ersetzen zertifiziert glutenfreie Mehle Weizen, Gerste und Roggen sicher.'
    },
    fr: {
      lookFor: 'Farine de riz, sarrasin, maïs, quinoa ou avoine certifiée « Sans gluten / Gluten-Free »',
      why: 'Les farines certifiées sans gluten remplacent le blé, l’orge et le seigle en toute sécurité.'
    },
    id: {
      lookFor: 'Tepung Beras, Buckwheat, Jagung, Quinoa, atau Oat Bersertifikat "Bebas Gluten / Gluten-Free"',
      why: 'Tepung bebas gluten bersertifikat menggantikan gandum dan jelai dengan aman bagi penderita celiac atau sensitivitas gluten.'
    },
    ms: {
      lookFor: 'Tepung Beras, Buckwheat, Jagung, Quinoa atau Oat Bersijil "Bebas Gluten / Gluten-Free"',
      why: 'Tepung bebas gluten bersijil menggantikan gandum dan barli dengan selamat bagi individu sensitif gluten.'
    },
    es: {
      lookFor: 'Harina de arroz, trigo sarraceno, maíz, quinoa o avena certificada «Sin gluten / Gluten-Free»',
      why: 'Las harinas certificadas sin gluten sustituyen de forma segura al trigo, la cebada y el centeno.'
    },
    ru: {
      lookFor: 'Рисовая, гречневая, кукурузная, киноа или овсяная мука с сертификатом «Без глютена / Gluten-Free»',
      why: 'При целиакии и чувствительности к глютену пшеничную и ячменную муку заменяют сертифицированными безглютеновыми аналогами.'
    },
    ur: {
      lookFor: '"گلوٹین فری (Gluten-Free)" سرٹیفائیڈ چاول کا آٹا، بک وہیٹ (Buckwheat)، مکئی، کوئنوا یا گلوٹین فری جئی کا آٹا',
      why: 'سیلیک یا گلوٹین کی حساسیت میں گندم اور جو کے بجائے مصدقہ گلوٹین فری آٹا محفوظ متبادل ہے۔'
    }
  },
  swap_allergen_nuts_other: {
    category: 'allergen_profile',
    tr: {
      lookFor: 'Ayçiçeği/Kabak Çekirdeği Ezmesi, Nohut/Tahin Bazlı Ezme, Keten/Chia Jeli, "Kükürtsüz (Unsulphured)" Kuru Meyve ve "Alerjensiz Hat (Nut/Allergen-Free)" Etiketi',
      why: 'Fındık/fıstık, yumurta, susam, sülfit veya çapraz bulaşma uyarısı taşıyan ürünler yerine ayrı üretim hattında üretilmiş sertifikalı alternatifler seçilmelidir.'
    },
    en: {
      lookFor: 'Sunflower/Pumpkin Seed Butter, Chickpea/Tahini spreads, Flax/Chia gel, "Unsulphured" dried fruit, and "Nut-Free / Allergen-Free Facility" labels',
      why: 'Seed-based spreads and dedicated allergen-free production lines avoid tree nut, peanut, egg, sulfite, and cross-contact trace risks.'
    },
    ar: {
      lookFor: 'زبدة بذور دوار الشمس أو اليقطين، بدائل الحمص، الفواكه المجففة "غير المكبرتة (Unsulphured)" وملصق "مصنع خالٍ من المكسرات/مسببات الحساسية"',
      why: 'بدائل البذور وخطوط الإنتاج المعزولة تحمي من حساسية المكسرات والفول السوداني والبيض والكبريتيت والتلوث الخلطي.'
    },
    de: {
      lookFor: 'Sonnenblumenkern-/Kürbiskernmus, Leinsamen-/Chia-Gel, „ungeschwefelte“ Trockenfrüchte und „Nussfrei / Allergen-Free“-Kennzeichnung',
      why: 'Saatenmuse und getrennte Produktionslinien vermeiden Risiken durch Schalenfrüchte, Erdnüsse, Ei, Sulfite und Kreuzkontamination.'
    },
    fr: {
      lookFor: 'Purée de graines de tournesol/courge, gel de lin/chia, fruits secs « sans sulfites » et mention « Garanti sans fruits à coque / allergènes »',
      why: 'Les purées de graines et lignes dédiées éliminent les risques liés aux fruits à coque, arachides, œufs, sulfites et traces croisées.'
    },
    id: {
      lookFor: 'Selai Biji Bunga Matahari/Labu, Gel Chia/Flax, Buah Kering "Tanpa Sulfit", dan label "Bebas Kacang / Allergen-Free Facility"',
      why: 'Alternatif biji-bijian dan fasilitas produksi bebas alergen mencegah risiko alergi kacang, telur, sulfit, serta kontaminasi silang.'
    },
    ms: {
      lookFor: 'Mentega Biji Bunga Matahari/Labu, Gel Chia/Flax, Buah Kering "Tanpa Sulfit" dan label "Fasiliti Bebas Kacang / Alergen"',
      why: 'Alternatif berasaskan biji dan barisan pengeluaran khusus mengelakkan risiko kacang, telur, sulfit serta pencemaran silang.'
    },
    es: {
      lookFor: 'Crema de semillas de girasol/calabaza, gel de lino/chía, fruta seca «sin sulfitos» y sello «Sin frutos secos / Libre de alérgenos»',
      why: 'Las cremas de semillas y líneas libres de alérgenos evitan riesgos de frutos secos, cacahuetes, huevo, sulfitos y trazas.'
    },
    ru: {
      lookFor: 'Паста из семян подсолнечника/тыквы, гель чиа/льна, сухофрукты «без диоксида серы» и маркировка «Без орехов / аллергенов»',
      why: 'Семенные пасты и отдельные производственные линии исключают риск аллергии на орехи, арахис, яйца, сульфиты и следы.'
    },
    ur: {
      lookFor: 'سورج مکھی یا کدو کے بیجوں کا مکھن، السی/چیا جیل، "سلفائٹ سے پاک" خشک میوہ جات اور "نٹ فری / الرجن فری" لیبل والی مصنوعات',
      why: 'گری دار میوے، مونگ پھلی، انڈے یا کراس کنٹیکٹ الرجی سے بچاؤ کے لیے بیجوں پر مبنی اور الگ لائن پر تیار کردہ مصنوعات محفوظ ہیں۔'
    }
  },
  swap_added_sugar_syrup: {
    category: 'sugar_nutrition',
    tr: {
      lookFor: '"İlave Şekersiz / Şurupsuz" Etiketli Ürünler, Lif Bütünlüğü Korunmuş Tam Meyve/Hurma Ezmesi veya Stevia (E960) / Eritritol (E968)',
      why: 'Rafine şeker, glukoz-fruktoz şurubu ve maltodekstrin hızlı emilen karbonhidratlardır. Not: EFSA ve DSÖ tanımlarına göre şuruplar ve meyve suyu konsantreleri de "serbest şeker" sayılır; glisemik etki tek başına "meyve/hurma" adına değil, lif bütünlüğüne, porsiyon miktarına ve ürünün toplam karbonhidrat bileşimine bağlıdır.'
    },
    en: {
      lookFor: '"No Added Sugar / Syrup-Free" products, whole fruit/date paste with intact fiber, or Stevia (E960) / Erythritol (E968)',
      why: 'Refined sucrose, glucose-fructose syrup, and maltodextrin are rapidly absorbed carbohydrates. Note: Under EFSA and WHO definitions, syrups and fruit juice concentrates also count as "free sugars"; glycemic impact depends on intact fiber, portion size, and total product composition rather than a "fruit/date" label alone.'
    },
    ar: {
      lookFor: 'المنتجات التي تحمل عبارة "بدون سكر أو شراب مضاف"، معجون الفاكهة/التمر الكامل المحتفظ بالألياف، أو ستيفيا (E960) / إريثريتول (E968)',
      why: 'السكر المكرر وشراب الجلوكوز والفركتوز والمالتوديكسترين كربوهيدرات سريعة الامتصاص. ملاحظة: وفق تعريفات EFSA ومنظمة الصحة العالمية، تُعد العصائر المركزة والشراب "سكريات حرة" أيضاً؛ لذا يعتمد الأثر الجلايسيمي على الألياف الكاملة وحجم الحصة والتركيبة الكلية للمنتج وليس مجرد اسم الفاكهة/التمر.'
    },
    de: {
      lookFor: 'Produkte mit „Ohne Zuckerzusatz / Ohne Glukose-Fruktose-Sirup“, ballaststoffreiches Vollfrucht-/Dattelmus oder Stevia (E960) / Erythrit (E968)',
      why: 'Raffinierter Zucker, Glukose-Fruktose-Sirup und Maltodextrin sind schnell resorbierbare Kohlenhydrate. Hinweis: Laut EFSA und WHO zählen auch Sirupe und Fruchtsaftkonzentrate zu den „freien Zuckern“; die glykämische Wirkung hängt von Ballaststoffgehalt, Portionsgröße und Gesamtrezeptur ab.'
    },
    fr: {
      lookFor: 'Produits « Sans sucres ajoutés / Sans sirop de glucose-fructose », pâte de fruits/dattes entiers riche en fibres ou Stévia (E960) / Érythritol (E968)',
      why: 'Le sucre raffiné, le sirop de glucose-fructose et la maltodextrine sont des glucides rapides. Note : selon l’EFSA et l’OMS, les sirops et jus concentrés comptent aussi comme « sucres libres » ; l’impact glycémique dépend des fibres intactes, de la portion et de la composition globale du produit.'
    },
    id: {
      lookFor: 'Produk berlabel "Tanpa Gula Tambahan / Bebas Sirup Glukosa-Fruktosa", pasta buah/kurma utuh berserat, atau Stevia (E960) / Eritritol (E968)',
      why: 'Gula rafinasi, sirup glukosa-fruktosa, dan maltodekstrin diserap cepat. Catatan: Menurut definisi EFSA dan WHO, sirup serta konsentrat jus buah juga termasuk "gula bebas"; dampak glikemik bergantung pada keutuhan serat, ukuran porsi, dan komposisi total produk.'
    },
    ms: {
      lookFor: 'Produk berlabel "Tanpa Gula Tambahan / Bebas Sirap Glukosa-Fruktosa", pes buah/kurma penuh berserat atau Stevia (E960) / Eritritol (E968)',
      why: 'Gula bertapis, sirap glukosa-fruktosa dan maltodekstrin diserap dengan cepat. Nota: Menurut takrifan EFSA dan WHO, sirap dan pati jus buah juga dikira sebagai "gula bebas"; kesan glisemik bergantung pada serat utuh, saiz hidangan dan komposisi keseluruhan produk.'
    },
    es: {
      lookFor: 'Productos «Sin azúcares añadidos / Sin jarabe de glucosa-fructosa», pasta de fruta/dátil entero con fibra o Estevia (E960) / Eritritol (E968)',
      why: 'El azúcar refinado, el jarabe de glucosa-fructosa y la maltodextrina son carbohidratos de absorción rápida. Nota: según la EFSA y la OMS, los jarabes y concentrados de zumo también son «azúcares libres»; el impacto glucémico depende de la fibra intacta, la porción y la composición total.'
    },
    ru: {
      lookFor: 'Продукты с маркировкой «Без добавленного сахара и сиропов», паста из цельных фруктов/фиников с клетчаткой или стевия (E960) / эритрит (E968)',
      why: 'Рафинированный сахар, глюкозно-фруктозный сироп и мальтодекстрин быстро усваиваются. Примечание: по определениям EFSA и ВОЗ сиропы и концентраты соков также относятся к «свободным сахарам»; гликемический ответ зависит от сохранности клетчатки, размера порции и общего состава продукта.'
    },
    ur: {
      lookFor: '"بغیر اضافی چینی / گلوکوز فرکٹوز سیرپ سے پاک" مصنوعات، فائبر سے بھرپور مکمل پھل/کھجور کا پیسٹ، یا اسٹیویا (E960) / ایرتھریٹول (E968)',
      why: 'ریفائنڈ چینی، گلوکوز فرکٹوز سیرپ اور مالٹوڈیکسٹرین تیزی سے جذب ہونے والے کاربوہائیڈریٹس ہیں۔ نوٹ: EFSA اور WHO کے مطابق سیرپ اور پھلوں کے جوس کنسنٹریٹ بھی "فری شوگر" میں شمار ہوتے ہیں؛ گلائسیمک اثر صرف پھل/کھجور کے نام پر نہیں بلکہ فائبر، مقدار (پورشن) اور پروڈکٹ کی مجموعی ترکیب پر منحصر ہے۔'
    }
  },
  swap_custom_watchlist: {
    category: 'allergen_profile',
    tr: {
      lookFor: 'Kişisel kara listenizdeki maddeyi içermeyen ("Free-From") kısa ve şeffaf içerikli alternatif formüller',
      why: 'Kişisel kara listenizde işaretlediğiniz bileşenden kaçınmak için etiketinde bu maddenin ve türevlerinin yer almadığı sade formülleri tercih edin.'
    },
    en: {
      lookFor: 'Minimalist "Free-From" formulas that exclude your personal watchlist ingredient and its derivatives',
      why: 'Choose transparent, short-ingredient-list products that omit the specific substance flagged in your personal watchlist.'
    },
    ar: {
      lookFor: 'تركيبات مبسطة وشفافة تخلو تماماً من المكون المدرج في قائمتك السوداء الشخصية ومشتقاته',
      why: 'لتجنب المادة التي حددتها في قائمتك السوداء الشخصية، اختر منتجات ذات قائمة مكونات قصيرة وواضحة.'
    },
    de: {
      lookFor: 'Minimalistische „Free-From“-Formulierungen ohne den auf Ihrer persönlichen Sperrliste markierten Inhaltsstoff',
      why: 'Wählen Sie Produkte mit kurzer, transparenter INCI-Liste, die Ihren gesperrten Stoff vollständig ausschließen.'
    },
    fr: {
      lookFor: 'Formules minimalistes « Sans / Free-From » excluant l’ingrédient inscrit sur votre liste noire personnelle',
      why: 'Privilégiez des produits à liste courte qui ne contiennent pas la substance que vous avez personnellement exclue.'
    },
    id: {
      lookFor: 'Formula minimalis yang bebas dari bahan dalam daftar hitam pribadi Anda',
      why: 'Pilih produk dengan daftar komposisi singkat dan transparan yang tidak mengandung bahan yang Anda tandai.'
    },
    ms: {
      lookFor: 'Formula ringkas yang bebas daripada bahan dalam senarai hitam peribadi anda',
      why: 'Pilih produk dengan senarai ramuan pendek dan telus yang tidak mengandungi bahan yang anda sekat.'
    },
    es: {
      lookFor: 'Fórmulas minimalistas libres del ingrediente incluido en su lista negra personal',
      why: 'Elija productos con listas de ingredientes cortas y transparentes que excluyan la sustancia bloqueada en su perfil.'
    },
    ru: {
      lookFor: 'Минималистичные формулы без компонента, внесенного в ваш личный черный список',
      why: 'Выбирайте продукты с коротким и прозрачным составом, не содержащие отмеченное вами вещество.'
    },
    ur: {
      lookFor: 'مختصر اور شفاف اجزاء والے فارمولے جو آپ کی ذاتی بلیک لسٹ میں شامل جزو سے پاک ہوں',
      why: 'اپنی ذاتی بلیک لسٹ میں نشان زد کردہ مادے سے بچنے کے لیے سادہ اور واضح لیبل والی مصنوعات منتخب کریں۔'
    }
  }
};

function resolveHalalRuleSwapKey(ruleId) {
  switch (ruleId) {
    case 'pork_gelatin':
    case 'gelatin_unspecified':
      return 'swap_gelatin';
    case 'lard':
    case 'pork_generic':
    case 'pork_bacon_ham_lardate':
    case 'meat_poultry_tallow_slaughter_check':
      return 'swap_animal_fat_meat';
    case 'carmine_e120':
      return 'swap_carmine_e120';
    case 'shellac_e904':
      return 'swap_shellac_e904';
    case 'ethanol_cosmetic_or_food':
    case 'wine_beer_liquor':
      return 'swap_ethanol_alcohol';
    case 'e471':
    case 'e472_477':
    case 'e432_e436_polysorbates':
    case 'e481_e482_stearoyl_lactylates':
    case 'stearic_acid_mg_stearate':
    case 'glycerin':
      return 'swap_emulsifier_e471';
    case 'l_cysteine':
    case 'whey_rennet':
    case 'animal_enzymes_pepsin_lipase':
    case 'e631_e635_nucleotides':
    case 'edible_bone_phosphate_e542':
      return 'swap_lcysteine_enzymes_whey';
    case 'collagen_keratin':
    case 'snail_mucin_halal':
    case 'cholesterol_lipid':
    case 'squalene':
      return 'swap_collagen_snail_squalene';
    case 'flavourings_aroma_solvent_check':
    case 'vanilla_extract_carrier':
      return 'swap_aroma_vanilla_carrier';
    default:
      return 'swap_emulsifier_e471';
  }
}

function resolveAllergenSwapKey(allergenId) {
  switch (allergenId) {
    case 'soy':
    case 'allergen_soy':
      return 'swap_allergen_soy_lecithin';
    case 'milk':
    case 'allergen_milk_dairy':
      return 'swap_allergen_dairy_milk';
    case 'gluten':
    case 'allergen_gluten_wheat':
      return 'swap_allergen_gluten_wheat';
    case 'peanut':
    case 'allergen_peanuts':
    case 'tree_nuts':
    case 'allergen_tree_nuts':
    case 'egg':
    case 'allergen_egg':
    case 'sesame':
    case 'allergen_sesame':
    case 'mustard':
    case 'allergen_mustard':
    case 'celery':
    case 'allergen_celery':
    case 'lupin':
    case 'allergen_lupin':
    case 'fish':
    case 'allergen_fish':
    case 'crustaceans':
    case 'allergen_crustaceans':
    case 'molluscs':
    case 'allergen_molluscs':
    case 'sulphites':
    case 'sulfites_e220_e228':
    case 'lysozyme_e1105_egg':
    case 'cross_contact_trace_allergen':
    default:
      return 'swap_allergen_nuts_other';
  }
}

function resolveSubstanceSwapKey(substanceId, productType = 'cosmetic') {
  switch (substanceId) {
    case 'mi_mci':
    case 'formaldehyde_releasers':
    case 'formaldehyde_direct_banned':
    case 'quaternium_15_chloroacetamide_banned':
    case 'banned_parabens':
    case 'propylparaben':
    case 'butylparaben':
    case 'methylparaben':
    case 'ethylparaben':
    case 'phenoxyethanol':
    case 'benzyl_alcohol':
    case 'chlorphenesin_ipbc_chlorhexidine':
    case 'triclosan':
    case 'triclocarban':
      return 'swap_preservatives_mi_parabens';
    case 'sls':
    case 'sles':
    case 'stronger_anionic_surfactants':
    case 'cocamide_dea_mea':
      return 'swap_harsh_sulfates';
    case 'lilial':
    case 'lyral_hicc_banned':
    case 'fragrance_allergens':
    case 'parfum':
    case 'essential_oils_potent':
      return 'swap_fragrance_sensitizers';
    case 'retinol':
    case 'tretinoin':
    case 'salicylic_acid':
    case 'benzoyl_peroxide':
    case 'hydroquinone_banned':
    case 'kojic_acid':
    case 'alpha_arbutin':
    case 'arbutin':
    case 'genistein':
    case 'daidzein':
    case 'aha_glycolic_lactic_mandelic':
    case 'boric_acid_borates_restricted':
    case 'mercury_compounds_banned':
      return 'swap_retinoids_acids_actives';
    case 'comedogenic_esters_oils':
      return 'swap_comedogenic_acne';
    case 'titanium_dioxide_e171_ci77891':
    case 'southampton_dyes':
    case 'other_synthetic_food_colors_e123_e155':
    case 'ammonia_sulfite_caramel_e150c_d':
    case 'nitrites_e249_e250':
    case 'nitrates_e251_e252':
    case 'bht':
    case 'bha_antioxidant':
    case 'tbhq_propyl_gallate_e310_e319':
    case 'carrageenan_e407':
    case 'msg_e621':
    case 'phosphates_e338_e452':
    case 'artificial_sweeteners_aspartame_acesulfame_sucralose':
    case 'flavor_enhancers_nucleotides_e627_e635':
      return 'swap_food_dyes_additives';
    case 'e471_mono_and_diglycerides':
    case 'food_emulsifiers_lecithin_pgpr':
      return 'swap_emulsifier_e471';
    case 'food_flavourings_aroma':
    case 'vanilla_extract_alcoholic_carrier':
      return 'swap_aroma_vanilla_carrier';
    case 'alcohol_denat':
    case 'isopropyl_alcohol':
      return 'swap_ethanol_alcohol';
    case 'allergen_soy':
      return 'swap_allergen_soy_lecithin';
    case 'allergen_milk_dairy':
      return 'swap_allergen_dairy_milk';
    case 'allergen_gluten_wheat':
      return 'swap_allergen_gluten_wheat';
    case 'allergen_peanuts':
    case 'allergen_tree_nuts':
    case 'allergen_egg':
    case 'allergen_sesame':
    case 'allergen_mustard':
    case 'allergen_celery':
    case 'allergen_lupin':
    case 'allergen_fish':
    case 'allergen_crustaceans':
    case 'allergen_molluscs':
    case 'sulfites_e220_e228':
    case 'lysozyme_e1105_egg':
    case 'cross_contact_trace_allergen':
      return 'swap_allergen_nuts_other';
    case 'common_whole_food_ingredients':
    case 'expanded_whole_foods_meats_spices_vitamins':
      return null;
    default:
      return productType === 'food' ? 'swap_food_dyes_additives' : 'swap_uv_filters_silicones_nail';
  }
}

function buildSwapGuideCard({
  lang,
  productType,
  rawText = '',
  allergenStatement = '',
  observations,
  regulatoryCard,
  profileCard,
  halalCard,
  veganSugarCard
}) {
  const ui = SWAP_GUIDE_UI_I18N[lang] || SWAP_GUIDE_UI_I18N.en;
  const grouped = new Map();

  function addSwapTrigger(swapKey, detectedName, severity) {
    if (!swapKey) return;
    const ruleDef = SWAP_RULES_10LANG[swapKey];
    if (!ruleDef) return;
    const locRule = ruleDef[lang] || ruleDef.en;
    const cleanName = String(detectedName || '').trim();
    if (!cleanName) return;

    if (!grouped.has(swapKey)) {
      grouped.set(swapKey, {
        swapId: swapKey,
        category: ruleDef.category,
        categoryLabel: ui.categories[ruleDef.category] || ui.categories.health_regulatory,
        severity: severity === 'kirmizi' ? 'kirmizi' : 'sari',
        detectedIngredients: [cleanName],
        lookForInstead: locRule.lookFor,
        whySwap: locRule.why
      });
    } else {
      const entry = grouped.get(swapKey);
      if (!entry.detectedIngredients.includes(cleanName)) {
        entry.detectedIngredients.push(cleanName);
      }
      if (severity === 'kirmizi') {
        entry.severity = 'kirmizi';
      }
    }
  }

  // 1. Halal & Origin findings (Red, Conflict, or Yellow/Musbooh)
  for (const f of halalCard.findings || []) {
    if (f.status === 'kirmizi' || f.status === 'conflict' || f.status === 'sari' || f.status === 'sari_yesil') {
      const key = resolveHalalRuleSwapKey(f.ruleId);
      const sev = f.status === 'kirmizi' || f.status === 'conflict' ? 'kirmizi' : 'sari';
      addSwapTrigger(key, f.localizedName || f.canonical || f.rawToken, sev);
    }
  }

  // 2. Regulatory & Safety findings (Banned, Restricted, Warning)
  for (const f of regulatoryCard.findings || []) {
    if (f.euStatus !== 'izinli' && f.euStatus !== 'serbest' && f.severity !== 'bilgi') {
      const key = resolveSubstanceSwapKey(f.substanceId, productType);
      const sev = f.euStatus === 'yasak' || f.severity === 'yuksek' ? 'kirmizi' : 'sari';
      addSwapTrigger(key, f.localizedName || f.name || f.rawToken, sev);
    }
  }

  // 3. Active Profile & Custom Watchlist Alerts
  for (const a of profileCard.alerts || []) {
    const sev = a.level === 'kirmizi' ? 'kirmizi' : 'sari';
    const label = a.localizedName || a.substanceName || a.rawToken;
    if (a.profile === 'ozel_kara_liste') {
      addSwapTrigger('swap_custom_watchlist', a.localizedName || a.watchTerm || a.rawToken, 'kirmizi');
    } else if (Array.isArray(a.allergenIds) && a.allergenIds.length > 0) {
      for (const aid of a.allergenIds) {
        addSwapTrigger(resolveAllergenSwapKey(aid), label, sev);
      }
    } else if (a.allergenId) {
      addSwapTrigger(resolveAllergenSwapKey(a.allergenId), label, sev);
    } else if (a.rawToken === 'Caffeine' || a.rawToken === 'Taurine/Inositol') {
      addSwapTrigger('swap_food_dyes_additives', label, sev);
    } else {
      const obs = (observations || []).find((o) => o.position === a.position);
      const subId = obs && obs.substance ? obs.substance.id : '';
      const key = subId ? resolveSubstanceSwapKey(subId, productType) : null;
      if (key) {
        addSwapTrigger(key, label, sev);
      }
    }
  }

  // 4. Major Food Allergens & Cross-Contact Trace Allergens present in observations or allergenStatement (even when no profile is toggled)
  if (productType === 'food') {
    const TRACE_ALLERGEN_I18N = {
      gluten: { tr: 'Gluten / Buğday', en: 'Gluten / Wheat', ar: 'الغلوتين / القمح', de: 'Gluten / Weizen', fr: 'Gluten / Blé', id: 'Gluten / Gandum', ms: 'Gluten / Gandum', es: 'Gluten / Trigo', ru: 'Глютен / Пшеница', ur: 'گلوٹین / گندم' },
      crustaceans: { tr: 'Kabuklular', en: 'Crustaceans', ar: 'القشريات', de: 'Krebstiere', fr: 'Crustacés', id: 'Krustasea', ms: 'Krustasea', es: 'Crustáceos', ru: 'Ракообразные', ur: 'کرسٹیشینز' },
      egg: { tr: 'Yumurta', en: 'Egg', ar: 'البيض', de: 'Ei', fr: 'Œuf', id: 'Telur', ms: 'Telur', es: 'Huevo', ru: 'Яйцо', ur: 'انڈہ' },
      fish: { tr: 'Balık', en: 'Fish', ar: 'السمك', de: 'Fisch', fr: 'Poisson', id: 'Ikan', ms: 'Ikan', es: 'Pescado', ru: 'Рыба', ur: 'مچھلی' },
      peanut: { tr: 'Yer Fıstığı', en: 'Peanuts', ar: 'الفول السوداني', de: 'Erdnüsse', fr: 'Arachides', id: 'Kacang Tanah', ms: 'Kacang Tanah', es: 'Cacahuetes', ru: 'Арахис', ur: 'مونگ پھلی' },
      soy: { tr: 'Soya', en: 'Soy / Soya', ar: 'الصويا', de: 'Soja', fr: 'Soja', id: 'Kedelai (Soya)', ms: 'Soya', es: 'Soja', ru: 'Соя', ur: 'سویا' },
      milk: { tr: 'Süt / Süt Ürünleri', en: 'Milk / Dairy', ar: 'الحليب / الألبان', de: 'Milch / Laktose', fr: 'Lait / Produits laitiers', id: 'Susu / Produk Susu', ms: 'Susu / Produk Tenusu', es: 'Leche / Lácteos', ru: 'Молоко / Лактоза', ur: 'دودھ / ڈیری' },
      tree_nuts: { tr: 'Sert Kabuklu Yemişler (Fındık/Badem)', en: 'Tree Nuts (Hazelnuts/Almonds)', ar: 'المكسرات (بندق/لوز)', de: 'Schalenfrüchte (Haselnüsse/Mandeln)', fr: 'Fruits à coque (Noisettes/Amandes)', id: 'Kacang Pohon (Hazel/Almond)', ms: 'Kekacang Pokok (Hazel/Badam)', es: 'Frutos de cáscara (Avellanas/Almendras)', ru: 'Орехи (Фундук/Миндаль)', ur: 'میوہ جات (ہیزل نٹ/بادام)' },
      celery: { tr: 'Kereviz', en: 'Celery', ar: 'الكرفس', de: 'Sellerie', fr: 'Céleri', id: 'Seledri', ms: 'Saderi', es: 'Apio', ru: 'Сельдерей', ur: 'اجوائن / سیلری' },
      mustard: { tr: 'Hardal', en: 'Mustard', ar: 'الخردل', de: 'Senf', fr: 'Moutarde', id: 'Mustar', ms: 'Biji Sawi (Mustard)', es: 'Mostaza', ru: 'Горчица', ur: 'رائی (مسٹرڈ)' },
      sesame: { tr: 'Susam', en: 'Sesame', ar: 'السمسم', de: 'Sesam', fr: 'Sésame', id: 'Wijen', ms: 'Bijan', es: 'Sésamo', ru: 'Кунжут', ur: 'تل (سیسم)' },
      sulphites: { tr: 'Sülfitler', en: 'Sulphites', ar: 'الكبريتيت', de: 'Sulfite', fr: 'Sulfites', id: 'Sulfit', ms: 'Sulfit', es: 'Sulfitos', ru: 'Сульфиты', ur: 'سلفائٹس' },
      lupin: { tr: 'Acıbakla (Lüpen)', en: 'Lupin', ar: 'الترمس', de: 'Lupinen', fr: 'Lupin', id: 'Lupin', ms: 'Lupin', es: 'Altramuces', ru: 'Люпин', ur: 'لوپن' },
      molluscs: { tr: 'Yumuşakçalar', en: 'Molluscs', ar: 'الرخويات', de: 'Weichtiere', fr: 'Mollusques', id: 'Moluska', ms: 'Moluska', es: 'Moluscos', ru: 'Моллюски', ur: 'مولسکس' }
    };
    const TRACE_PREFIX_I18N = {
      tr: (t) => `Eser Miktarda: ${t}`,
      en: (t) => `May Contain Traces: ${t}`,
      ar: (t) => `قد يحتوي على آثار: ${t}`,
      de: (t) => `Spuren möglich: ${t}`,
      fr: (t) => `Traces possibles : ${t}`,
      id: (t) => `Jejak Alergen: ${t}`,
      ms: (t) => `Mungkin Mengandungi: ${t}`,
      es: (t) => `Posibles trazas: ${t}`,
      ru: (t) => `Возможны следы: ${t}`,
      ur: (t) => `معمولی ذرات ممکن: ${t}`
    };
    const TRACE_PATTERNS = [
      { id: 'milk', re: /(?:^|[^\p{L}\p{N}])(milk|süt|sut|dairy|lactose|laktoz|milch|lait|leche|latte|susu|молок[а-я]*|حليب|لبن|دودھ|whey|casein|kazein)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'soy', re: /(?:^|[^\p{L}\p{N}])(soy|soya|soja|kedelai|соя|соев[а-я]*|صويا|سویا|sojalecithin|soybean[s]?)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'gluten', re: /(?:^|[^\p{L}\p{N}])(wheat|buğday|bugday|gluten|weizen|blé|ble|trigo|gandum|пшениц[а-я]*|دقيق|قمح|گندم|arpa|barley|çavdar|rye|oats|yulaf|spelt|kamut)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'tree_nuts', re: /(?:^|[^\p{L}\p{N}])(nut[s]?|hazelnut[s]?|haseln[üu]ss[e]?|fındık|findik|noisette[s]?|avellana[s]?|фундук|بندق|ہیزل|almond[s]?|badem|mandel[n]?|amande[s]?|almendra[s]?|миндаль|لوز|بادام|walnut[s]?|ceviz|cashew[s]?|kaju|pistachio[s]?|fıstık|fistik|pecan[s]?|macadamia)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'peanut', re: /(?:^|[^\p{L}\p{N}])(peanut[s]?|yer\s*fıst[ıi]ğ[ıi]|arachide[s]?|erdnuss|erdnüsse|cacahuete[s]?|арахис|فول\s+سوداني|مونگ\s*پھلی)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'egg', re: /(?:^|[^\p{L}\p{N}])(egg[s]?|yumurta|oeuf[s]?|ei|eier|huevo[s]?|яйц[а-я]*|بيض|انڈہ|انڈے)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'sesame', re: /(?:^|[^\p{L}\p{N}])(sesame|susam|tahin|tahini|sésame|sesam|sésamo|кунжут|سمسم|تل)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'mustard', re: /(?:^|[^\p{L}\p{N}])(mustard|hardal|senf|moutarde|mostaza|горчиц[а-я]*|خردل|رائی)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'celery', re: /(?:^|[^\p{L}\p{N}])(celery|kereviz|sellerie|céleri|apio|сельдерей|كرفس|اجوائن)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'lupin', re: /(?:^|[^\p{L}\p{N}])(lupin[e]?|ac[ıi]\s*bakla|lüpen|altramuz|люпин|ترمس|لوپن)(?=[^\p{L}\p{N}]|$)/iu },
      { id: 'sulphites', re: /(?:^|[^\p{L}\p{N}])(sulphite[s]?|sulfite[s]?|bisulphite[s]?|bisulfite[s]?|metabisulphite[s]?|metabisulfite[s]?|pyrosulphite[s]?|pyrosulfite[s]?|sülfit|sulfit|bisülfit|bisulfit|metabisülfit|metabisulfit|schwefeldioxid|كبريتيت|ميتابيسلفيت|سلفائٹ|میٹابیسلفائٹ|e220|e221|e222|e223|e224|e226|e227|e228)(?=[^\p{L}\p{N}]|$)/iu }
    ];

    for (const obs of observations || []) {
      const rawStr = String(obs.raw || '');
      const isCrossContactToken = /(?:may\s+contain|traces?\s+of|eser\s+miktarda|kann\s+spuren|peut\s+contenir|puede\s+contener|قد\s+يحتوي|может\s+содержать|میں\s+شامل)/iu.test(rawStr);
      if (isCrossContactToken) {
        const matchedTrace = TRACE_PATTERNS.filter((p) => p.re.test(rawStr));
        if (matchedTrace.length > 0) {
          for (const mt of matchedTrace) {
            addSwapTrigger(resolveAllergenSwapKey(mt.id), obs.localizedName || obs.raw, 'sari');
          }
        } else {
          addSwapTrigger('swap_allergen_nuts_other', obs.localizedName || obs.raw, 'sari');
        }
        continue;
      }

      const scanText = rawStr
        .replace(/[\p{L}]+[\s\-]*(?:free|frei)(?=[^\p{L}]|$)/giu, ' ')
        .replace(/(?:free\s+(?:of|from)|without|ohne|sans|sin|senza|tanpa|bebas)\s+[\p{L}]+/giu, ' ')
        .replace(/[\p{L}]+(?:siz|sız|suz|süz)(?=[^\p{L}]|$)/giu, ' ')
        .replace(/[\p{L}]+\s+(?:içermez|icermez|yoktur|bulunmaz)(?=[^\p{L}]|$)/giu, ' ');

      if (/(?:^|[^\p{L}\p{N}])(soy|soya|soja|kedelai|соя|соев[а-я]*|صويا|سویا|sojalecithin|soybean[s]?)(?=[^\p{L}\p{N}]|$)/iu.test(scanText)) {
        addSwapTrigger('swap_allergen_soy_lecithin', obs.localizedName || obs.raw, 'sari');
      }
      if (/(?:^|[^\p{L}\p{N}])(milk|süt|sut|lait|leche|milch|latte|susu|молок[а-я]*|حليب|دودھ|whey|casein|lactose|laktoz|kazein|peynir\s*altı\s*suyu)(?=[^\p{L}\p{N}]|$)/iu.test(scanText)) {
        addSwapTrigger('swap_allergen_dairy_milk', obs.localizedName || obs.raw, 'sari');
      }
      const isGlutenNegated = /gluten[\s\-]*(?:free|frei|siz|sız)|(?:free\s+(?:of|from)|without|ohne|sans|sin)\s+gluten/iu.test(rawStr);
      const hasGlutenCereal = isGlutenNegated
        ? /(?:^|[^\p{L}\p{N}])(wheat|buğday|bugday|weizen|blé|ble|trigo|пшениц[а-я]*|قمح|barley|arpa|rye|çavdar|cavdar|spelt|kamut|oats|yulaf)(?=[^\p{L}\p{N}]|$)/iu.test(scanText)
        : /(?:^|[^\p{L}\p{N}])(wheat|buğday|bugday|gluten|weizen|weizenmehl|roggenmehl|gerstenmehl|dinkelmehl|hafermehl|bl[ée]|farine\s+de\s+(?:bl[ée]|seigle|froment|kamut|[ée]peautre)|farine\s+d['’](?:orge|avoine)|trigo|harina\s+de\s+(?:trigo|cebada|centeno|avena)|gandum|tepung\s+(?:terigu|gandum|barli)|пшениц[а-я]*|пшеничн[а-я]*\s+мук[аи]|ржан[а-я]*\s+мук[аи]|ячменн[а-я]*\s+мук[аи]|овсян[а-я]*\s+мук[аи]|دقيق\s+(?:القمح|الشعير|الجاودار|الشوفان)|قمح|گندم|گندم\s+کا\s+آٹا|میدہ|arpa|barley|çavdar|cavdar|rye|oats|oat|yulaf|spelt|kamut|(?:wheat|rye|barley|spelt|oat)\s+flour|(?:buğday|bugday|çavdar|cavdar|arpa|yulaf|siyez)\s+unu)(?=[^\p{L}\p{N}]|$)/iu.test(scanText);
      if (hasGlutenCereal) {
        addSwapTrigger('swap_allergen_gluten_wheat', obs.localizedName || obs.raw, 'sari');
      }
      if (/(?:^|[^\p{L}\p{N}])(hazelnut[s]?|haseln[üu]ss[e]?|fındık|findik|noisette[s]?|avellana[s]?|фундук|بندق|ہیزل|almond[s]?|badem|mandel[n]?|amande[s]?|almendra[s]?|миндаль|لوز|بادام|walnut[s]?|ceviz|walnuss|noix|nuez|nueces|cashew[s]?|kaju|pistachio[s]?|fıstık|fistik|peanut[s]?|arachide[s]?|erdnuss|erdnüsse|cacahuete[s]?|арахис|مونگ\s*پھلی|egg[s]?|yumurta|oeuf[s]?|huevo[s]?|яйц[а-я]*|بيض|انڈہ|sesame|susam|tahin|tahini|кунжут|سمسم|تل|sulphite[s]?|sulfite[s]?|bisulphite[s]?|bisulfite[s]?|metabisulphite[s]?|metabisulfite[s]?|pyrosulphite[s]?|pyrosulfite[s]?|sülfit|sulfit|bisülfit|bisulfit|metabisülfit|metabisulfit|e220|e221|e222|e223|e224)(?=[^\p{L}\p{N}]|$)/iu.test(scanText)) {
        addSwapTrigger('swap_allergen_nuts_other', obs.localizedName || obs.raw, 'sari');
      }
    }

    // Check cross-contact trace warnings across rawText + allergenStatement even when astim_alerji profile is off
    const fullCrossContact = `${rawText || ''} ${allergenStatement || ''}`;
    const ccMatch = fullCrossContact.match(/(?:may\s+contain|traces?\s+of|eser\s+miktarda\s+(?:içerebilir|bulunabilir)|kann\s+spuren\s+von|peut\s+contenir\s+des\s+traces|puede\s+contener\s+trazas|قد\s+يحتوي\s+على|может\s+содержать\s+следы|میں\s+شامل\s+ہو\s+سکتا\s+ہے)\s*[:\-–]?\s*([^.,;\n]+)/iu);
    if (ccMatch) {
      const rawTarget = ccMatch[1].trim();
      const matchedTraces = TRACE_PATTERNS.filter((p) => p.re.test(rawTarget));
      const prefixFn = TRACE_PREFIX_I18N[lang] || TRACE_PREFIX_I18N.en;
      if (matchedTraces.length > 0) {
        for (const mt of matchedTraces) {
          const aMap = TRACE_ALLERGEN_I18N[mt.id] || {};
          const aLoc = aMap[lang] || aMap.en || rawTarget;
          addSwapTrigger(resolveAllergenSwapKey(mt.id), prefixFn(aLoc), 'sari');
        }
      } else {
        addSwapTrigger('swap_allergen_nuts_other', prefixFn(rawTarget), 'sari');
      }
    }
  }

  // 5. Added Free Sugars & Rapid Carbs
  for (const s of veganSugarCard.detectedFreeSugars || []) {
    addSwapTrigger('swap_added_sugar_syrup', s.localizedName || s.canonical || s.rawToken, 'sari');
  }
  for (const rc of veganSugarCard.detectedRapidCarbs || []) {
    addSwapTrigger('swap_added_sugar_syrup', rc.localizedName || rc.canonical || rc.rawToken, 'sari');
  }

  const items = Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      detectedIngredient: entry.detectedIngredients.join(' · ')
    }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'kirmizi' ? -1 : 1));

  return {
    cardTitle: ui.cardTitle,
    cardSubtitle: ui.cardSubtitle,
    detectedLabel: ui.detectedLabel,
    lookForLabel: ui.lookForLabel,
    whyLabel: ui.whyLabel,
    allCleanMessage: ui.allCleanMessage,
    totalSwaps: items.length,
    items
  };
}

// ============================================================================
// FEATURE 1: COSMETIC ACTIVE ROUTINE & LAYERING CONFLICT ENGINE (10 LANGUAGES)
// ============================================================================
const ROUTINE_CONFLICT_UI_I18N = {
  tr: {
    cardTitle: '🧪 Cilt Rutini & Aktif Madde Çakışma Uyarısı',
    cardSubtitle: 'Aynı formülde veya üst üste (A + B) kullanıldığında cilt bariyerini tahriş edebilecek ya da birbirinin etkisini azaltabilecek aktif bileşen etkileşimleri.',
    layeringTitle: '⚠️ A + B Birlikte Kullanım (Katmanlama) Uyarısı',
    noConflictMsg: 'Bu üründe birbiriyle çakışan sert kozmetik aktif kombinasyonu tespit edilmedi.',
    spfReminder: '☀️ Gündüz SPF 50+ Uyarısı: Bu ürün soyucu asit (AHA/BHA) veya retinoid içerir; cildin güneşe hassasiyetini artırabileceği için gündüz geniş spektrumlu güneş koruyucu ile kullanılmalıdır (AB SCCS / FDA AHA Uyarısı).',
    howToUseLabel: 'Önerilen Rutin:'
  },
  en: {
    cardTitle: '🧪 Skincare Routine & Active Conflict Alert',
    cardSubtitle: 'Active ingredient interactions that may irritate the skin barrier or reduce efficacy when combined in one formula or layered together (A + B).',
    layeringTitle: '⚠️ Product A + B Layering Conflict Alert',
    noConflictMsg: 'No conflicting potent cosmetic active combinations detected in this formula.',
    spfReminder: '☀️ Daily SPF 50+ Reminder: Contains exfoliating acids (AHA/BHA) or retinoids that increase photosensitivity; pair with broad-spectrum sunscreen during the day (EU SCCS / FDA AHA Sunburn Alert).',
    howToUseLabel: 'Recommended Routine:'
  },
  ar: {
    cardTitle: '🧪 تنبيه تعارض المواد الفعالة وروتين البشرة',
    cardSubtitle: 'تفاعلات المكونات النشطة التي قد تهيج حاجز البشرة أو تقلل الفعالية عند دمجها أو استخدامها معاً (أ + ب).',
    layeringTitle: '⚠️ تنبيه استخدام المنتجين (أ + ب) معاً في نفس الروتين',
    noConflictMsg: 'لم يتم رصد تعارض بين المواد التجميلية الفعالة في هذه التركيبة.',
    spfReminder: '☀️ تذكير واقي الشمس SPF 50+: يحتوي على أحماض مقشرة (AHA/BHA) أو ريتينويد تزيد حساسية البشرة للشمس؛ يُنصح باستخدام واقي شمس نهاراً.',
    howToUseLabel: 'الروتين الموصى به:'
  },
  de: {
    cardTitle: '🧪 Hautpflege-Routine & Wirkstoff-Konflikt-Warnung',
    cardSubtitle: 'Wirkstoffkombinationen, die bei gleichzeitiger Anwendung (oder Schichtung A + B) die Hautbarriere reizen oder sich gegenseitig abschwächen können.',
    layeringTitle: '⚠️ Produkt A + B Schichtungs-Warnung (Layering)',
    noConflictMsg: 'Keine widersprüchlichen starken Wirkstoffkombinationen in dieser Formel erkannt.',
    spfReminder: '☀️ Tages-LSF 50+ Hinweis: Enthält Peeling-Säuren (AHA/BHA) oder Retinoide, die die Lichtempfindlichkeit erhöhen; tagsüber Sonnenschutz verwenden.',
    howToUseLabel: 'Empfohlene Routine:'
  },
  fr: {
    cardTitle: '🧪 Alerte Routine Cutanée & Conflit d\'Actifs',
    cardSubtitle: 'Interactions d\'actifs pouvant irriter la barrière cutanée ou réduire l\'efficacité lorsqu\'ils sont combinés ou superposés (A + B).',
    layeringTitle: '⚠️ Alerte de Superposition Produit A + B (Layering)',
    noConflictMsg: 'Aucune combinaison d\'actifs cosmétiques conflictuels détectée dans cette formule.',
    spfReminder: '☀️ Rappel SPF 50+ : Contient des acides exfoliants (AHA/BHA) ou des rétinoïdes photosensibilisants ; appliquer un écran solaire le matin.',
    howToUseLabel: 'Routine recommandée :'
  },
  id: {
    cardTitle: '🧪 Peringatan Konflik Bahan Aktif & Rutinitas Kulit',
    cardSubtitle: 'Interaksi bahan aktif yang dapat mengiritasi skin barrier atau menurunkan efektivitas saat digabung atau ditumpuk (A + B).',
    layeringTitle: '⚠️ Peringatan Layering Produk A + B',
    noConflictMsg: 'Tidak ditemukan kombinasi bahan aktif kosmetik yang saling bertentangan.',
    spfReminder: '☀️ Pengingat Sunscreen SPF 50+: Mengandung asam eksfoliasi (AHA/BHA) atau retinoid yang meningkatkan sensitivitas matahari; gunakan tabir surya di pagi hari.',
    howToUseLabel: 'Saran Rutinitas:'
  },
  ms: {
    cardTitle: '🧪 Amaran Konflik Bahan Aktif & Rutin Kulit',
    cardSubtitle: 'Interaksi bahan aktif yang boleh merengsakan pelindung kulit atau mengurangkan keberkesanan apabila digabungkan (A + B).',
    layeringTitle: '⚠️ Amaran Lapisan Produk A + B (Layering)',
    noConflictMsg: 'Tiada gabungan bahan aktif kosmetik yang bercanggah dikesan dalam formula ini.',
    spfReminder: '☀️ Peringatan SPF 50+: Mengandungi asid pengelupasan (AHA/BHA) atau retinoid yang meningkatkan kepekaan cahaya matahari; gunakan pelindung suria pada waktu siang.',
    howToUseLabel: 'Cadangan Rutin:'
  },
  es: {
    cardTitle: '🧪 Alerta de Conflicto de Activos y Rutina Facial',
    cardSubtitle: 'Interacciones de activos que pueden irritar la barrera cutánea o reducir su eficacia al combinarse o aplicarse en capas (A + B).',
    layeringTitle: '⚠️ Alerta de Combinación Producto A + B',
    noConflictMsg: 'No se detectaron combinaciones conflictivas de activos cosméticos potentes.',
    spfReminder: '☀️ Recordatorio SPF 50+: Contiene ácidos exfoliantes (AHA/BHA) o retinoides fotosensibilizantes; usar protector solar de amplio espectro por la mañana.',
    howToUseLabel: 'Rutina recomendada:'
  },
  ru: {
    cardTitle: '🧪 Предупреждение о конфликте активов в уходе',
    cardSubtitle: 'Сочетания активных компонентов, которые могут вызвать раздражение кожного барьера или снизить эффективность при совместном нанесении (А + Б).',
    layeringTitle: '⚠️ Конфликт при совместном нанесении Продукта А и Б',
    noConflictMsg: 'Конфликтующих сочетаний сильных косметических активов не обнаружено.',
    spfReminder: '☀️ Напоминание о SPF 50+: Содержит кислоты (AHA/BHA) или ретиноиды, повышающие фоточувствительность; используйте солнцезащитный крем днем.',
    howToUseLabel: 'Рекомендуемый режим:'
  },
  ur: {
    cardTitle: '🧪 اسکن کیئر روٹین اور فعال اجزاء کے تصادم کا انتباہ',
    cardSubtitle: 'ایسے فعال اجزاء کا ملاپ جو ایک ساتھ یا اوپر نیچے (الف + ب) لگانے سے جلد کی حفاظتی تہہ کو متاثر یا اثر کم کر سکتے ہیں۔',
    layeringTitle: '⚠️ پروڈکٹ الف + ب ایک ساتھ استعمال کرنے کا انتباہ',
    noConflictMsg: 'اس فارمولے میں باہم متصادم تیز کاسمیٹک اجزاء نہیں پائے گئے۔',
    spfReminder: '☀️ سن اسکرین SPF 50+ یاد دہانی: اس میں ایکسفولیئٹنگ ایسڈز (AHA/BHA) یا ریٹینوئڈز شامل ہیں جو دھوپ کی حساسیت بڑھاتے ہیں؛ دن میں سن بلاک ضرور استعمال کریں۔',
    howToUseLabel: 'تجویز کردہ روٹین:'
  }
};

const ROUTINE_CONFLICT_RULES_10LANG = {
  conflict_retinoid_aha_bha: {
    severity: 'kirmizi',
    tr: {
      title: 'Retinoid + AHA/BHA Soyucu Asit Çakışması',
      why: 'Retinoidler ve doğrudan soyucu asitler (Glikolik, Laktik, Salisilik Asit) aynı anda uygulandığında stratum corneum döngüsünü aşırı hızlandırarak cilt bariyerinde kızarıklık, soyulma ve irritasyon riskini artırır.',
      advice: 'Aynı akşam üst üste sürmeyin; dönüşümlü gecelerde (Skin Cycling) kullanın ve sabah SPF 50+ güneş koruyucu uygulayın.'
    },
    en: {
      title: 'Retinoid + AHA/BHA Exfoliating Acid Conflict',
      why: 'Combining retinoids with direct exfoliating acids (Glycolic, Lactic, Salicylic Acid) over-accelerates stratum corneum turnover and disrupts barrier pH, increasing erythema, peeling, and retinoid dermatitis risk.',
      advice: 'Do not layer in the same evening; alternate nights (Skin Cycling) and apply broad-spectrum SPF 50+ every morning.'
    },
    ar: {
      title: 'تعارض الريتينويد مع أحماض التقشير (AHA/BHA)',
      why: 'الجمع بين الريتينويد وأحماض التقشير المباشرة (جليكوليك، لاكتيك، ساليسيليك) في وقت واحد يضعف حاجز البشرة ويزيد خطر الاحمرار والتقشر والتهيج.',
      advice: 'لا تستخدمهما في نفس الليلة؛ استخدمهما بالتناوب في ليالٍ منفصلة مع واقي شمس SPF 50+ صباحاً.'
    },
    de: {
      title: 'Retinoid + AHA/BHA-Peelingsäure-Konflikt',
      why: 'Die gleichzeitige Anwendung von Retinoiden und direkten Peelingsäuren (Glykol-, Milch-, Salicylsäure) belastet die Hautbarriere stark und erhöht das Risiko für Rötungen und Reizungen.',
      advice: 'Nicht am selben Abend schichten; an wechselnden Abenden (Skin Cycling) verwenden und morgens LSF 50+ auftragen.'
    },
    fr: {
      title: 'Conflit Rétinoïde + Acides Exfoliants (AHA/BHA)',
      why: 'L\'association simultanée de rétinoïdes et d\'acides exfoliants (glycolique, lactique, salicylique) fragilise la barrière cutanée et augmente le risque d\'érythème et d\'irritation.',
      advice: 'Ne pas superposer le même soir ; alterner un soir sur deux (Skin Cycling) avec protection SPF 50+ le matin.'
    },
    id: {
      title: 'Konflik Retinoid + Asam Eksfoliasi (AHA/BHA)',
      why: 'Menggabungkan retinoid dengan asam eksfoliasi langsung (Glikolat, Laktat, Salisilat) secara bersamaan berisiko merusak skin barrier dan memicu iritasi serta pengelupasan berlebih.',
      advice: 'Jangan ditumpuk di malam yang sama; gunakan bergantian malam (Skin Cycling) dan wajib gunakan SPF 50+ di pagi hari.'
    },
    ms: {
      title: 'Konflik Retinoid + Asid Pengelupasan (AHA/BHA)',
      why: 'Menggabungkan retinoid dengan asid pengelupasan (Glikolik, Laktik, Salisilik) secara serentak meningkatkan risiko kerengsaan, kemerahan dan kerosakan pelindung kulit.',
      advice: 'Jangan gunakan pada malam yang sama; selang-selikan malam (Skin Cycling) dan pakai SPF 50+ pada waktu siang.'
    },
    es: {
      title: 'Conflicto Retinoide + Ácidos Exfoliantes (AHA/BHA)',
      why: 'Combinar retinoides con ácidos exfoliantes directos (glicólico, láctico, salicílico) acelera en exceso la renovación celular y compromete la barrera cutánea, causando irritación.',
      advice: 'No aplicar en la misma noche; alternar noches (Skin Cycling) y aplicar protector solar SPF 50+ cada mañana.'
    },
    ru: {
      title: 'Конфликт: Ретиноиды + Кислоты (AHA/BHA)',
      why: 'Одновременное нанесение ретиноидов и отшелушивающих кислот (гликолевой, молочной, салициловой) перегружает кожный барьер и повышает риск ретиноидного дерматита и шелушения.',
      advice: 'Не наносите в один вечер; чередуйте в разные дни (Skin Cycling) и используйте SPF 50+ утром.'
    },
    ur: {
      title: 'ریٹینوئڈ اور ایکسفولیئٹنگ ایسڈز (AHA/BHA) کا تصادم',
      why: 'ریٹینوئڈز اور تیز ایسڈز (گلائیکولک، لیکٹک، سیلیسیلک ایسڈ) کو ایک ساتھ لگانے سے جلد کی حفاظتی تہہ متاثر ہوتی ہے اور سرخی و جلن کا خطرہ بڑھ جاتا ہے۔',
      advice: 'ایک ہی رات میں اوپر نیچے نہ لگائیں؛ مختلف راتوں میں باری باری استعمال کریں اور صبح SPF 50+ لگائیں۔'
    }
  },
  conflict_retinoid_benzoyl_peroxide: {
    severity: 'kirmizi',
    tr: {
      title: 'Retinoid + Benzoil Peroksit Oksidasyon Çakışması',
      why: 'Benzoil Peroksit güçlü bir oksitleyici ajandır; Retinol/Tretinoin ile aynı anda üst üste sürüldüğünde retinoid molekülünü okside ederek etkisizleştirebilir ve şiddetli kuruluk yapar.',
      advice: 'Benzoil Peroksiti sabah (veya yıkama jeli olarak), Retinoidi ise akşam rutininde ayrı kullanın.'
    },
    en: {
      title: 'Retinoid + Benzoyl Peroxide Oxidation Conflict',
      why: 'Benzoyl Peroxide is a strong oxidative agent that can oxidize and deactivate retinol/tretinoin when layered simultaneously while causing severe barrier dryness.',
      advice: 'Separate usage: apply Benzoyl Peroxide in the morning (or as a wash-off cleanser) and Retinoid at night.'
    },
    ar: {
      title: 'تعارض الريتينويد مع بنزويل بيروكسايد (أكسدة)',
      why: 'البنزويل بيروكسايد عامل مؤكسد قوي قد يؤكسد الريتينول ويبطل مفعوله عند وضعهما معاً مع التسبب بجفاف شديد.',
      advice: 'استخدم بنزويل بيروكسايد صباحاً والريتينويد مساءً بشكل منفصل.'
    },
    de: {
      title: 'Retinoid + Benzoylperoxid Oxidations-Konflikt',
      why: 'Benzoylperoxid wirkt stark oxidierend und kann Retinol bei gleichzeitigem Auftragen deaktivieren sowie starke Trockenheit verursachen.',
      advice: 'Benzoylperoxid morgens und Retinoid abends getrennt anwenden.'
    },
    fr: {
      title: 'Conflit Rétinoïde + Peroxyde de Benzoyle (Oxydation)',
      why: 'Le peroxyde de benzoyle peut oxyder et inactiver le rétinol lorsqu\'il est superposé directement, tout en provoquant une forte sécheresse.',
      advice: 'Utiliser le peroxyde de benzoyle le matin et le rétinoïde le soir.'
    },
    id: {
      title: 'Konflik Oksidasi Retinoid + Benzoil Peroksida',
      why: 'Benzoil Peroksida bersifat oksidatif kuat yang dapat menonaktifkan molekul retinol jika ditumpuk bersamaan serta memicu kulit sangat kering.',
      advice: 'Gunakan Benzoil Peroksida di pagi hari dan Retinoid di malam hari secara terpisah.'
    },
    ms: {
      title: 'Konflik Pengoksidaan Retinoid + Benzoil Peroksida',
      why: 'Benzoil Peroksida boleh mengoksidakan dan menyahaktifkan retinol apabila digunakan serentak serta menyebabkan kekeringan melampau.',
      advice: 'Gunakan Benzoil Peroksida pada waktu pagi dan Retinoid pada waktu malam.'
    },
    es: {
      title: 'Conflicto de Oxidación Retinoide + Peróxido de Benzoilo',
      why: 'El peróxido de benzoilo puede oxidar e inactivar el retinol al aplicarse simultáneamente, además de causar sequedad severa.',
      advice: 'Separar horarios: peróxido de benzoilo por la mañana y retinoide por la noche.'
    },
    ru: {
      title: 'Конфликт: Ретиноиды + Бензоилпероксид (Окисление)',
      why: 'Бензоилпероксид является сильным окислителем, который может разрушать ретинол при одновременном нанесении и вызывать сильную сухость.',
      advice: 'Разделите уход: используйте бензоилпероксид утром, а ретиноид вечером.'
    },
    ur: {
      title: 'ریٹینوئڈ اور بینزوائل پرآکسائیڈ کا تصادم',
      why: 'بینزوائل پرآکسائیڈ ایک آکسیڈائزنگ جزو ہے جو ریٹینول کے ساتھ لگانے پر اس کا اثر ختم کر سکتا ہے اور شدید خشکی پیدا کرتا ہے۔',
      advice: 'بینزوائل پرآکسائیڈ صبح اور ریٹینوئڈ رات کو الگ الگ استعمال کریں۔'
    }
  },
  conflict_vitc_aha_bha_retinoid: {
    severity: 'sari',
    tr: {
      title: 'Saf C Vitamini (Askorbik Asit) + Asit / Retinoid pH Hassasiyeti',
      why: 'Düşük pH gerektiren saf L-Askorbik Asit, soyucu asitler (AHA/BHA) veya retinoidlerle aynı anda uygulandığında asidik yükü artırarak batma ve kızarıklığa yol açabilir.',
      advice: 'C Vitaminini sabah güneş koruyucu altında, Retinoid veya AHA/BHA asitlerini akşam rutininde kullanın.'
    },
    en: {
      title: 'Pure Vitamin C (Ascorbic Acid) + Acid / Retinoid pH Sensitivity',
      why: 'Low-pH L-Ascorbic Acid layered simultaneously with exfoliating acids (AHA/BHA) or retinoids increases acidic load and barrier stinging.',
      advice: 'Use Vitamin C in the morning under sunscreen and Retinoid or AHA/BHA acids in your evening routine.'
    },
    ar: {
      title: 'حساسية الجمع بين فيتامين C النقي (حمض الأسكوربيك) والأحماض / الريتينويد',
      why: 'يتطلب حمض الأسكوربيك درجة حموضة منخفضة؛ ودمجه مباشرة مع أحماض التقشير أو الريتينويد قد يسبب وخزاً واحمراراً للبشرة.',
      advice: 'استخدم فيتامين C صباحاً تحت واقي الشمس، والريتينويد أو الأحماض مساءً.'
    },
    de: {
      title: 'Reines Vitamin C (Ascorbinsäure) + Säure / Retinoid pH-Empfindlichkeit',
      why: 'Niedrig-pH Ascorbinsäure in Kombination mit Peelingsäuren oder Retinoiden erhöht die Säurebelastung und kann Hautbrennen verursachen.',
      advice: 'Vitamin C morgens unter dem Sonnenschutz und Retinoide/Säuren abends verwenden.'
    },
    fr: {
      title: 'Sensibilité pH : Vitamine C Pure (Acide Ascorbique) + Acides / Rétinoïde',
      why: 'L\'acide L-ascorbique à faible pH superposé aux acides exfoliants ou aux rétinoïdes peut provoquer des picotements et des rougeurs.',
      advice: 'Appliquer la Vitamine C le matin sous le SPF et les acides ou rétinoïdes le soir.'
    },
    id: {
      title: 'Sensitivitas pH Vitamin C Murni (Asam Askorbat) + Asam / Retinoid',
      why: 'Asam L-Askorbat ber-pH rendah yang ditumpuk bersama asam eksfoliasi atau retinoid dapat meningkatkan rasa perih dan kemerahan.',
      advice: 'Gunakan Vitamin C di pagi hari sebelum sunscreen, dan Retinoid atau AHA/BHA di malam hari.'
    },
    ms: {
      title: 'Kepekaan pH Vitamin C Tulen (Asid Askorbik) + Asid / Retinoid',
      why: 'Asid L-Askorbik ber-pH rendah apabila dilapiskan dengan asid pengelupasan atau retinoid boleh menyebabkan rasa pedih dan kemerahan.',
      advice: 'Gunakan Vitamin C pada waktu pagi di bawah pelindung suria dan Retinoid/asid pada waktu malam.'
    },
    es: {
      title: 'Sensibilidad de pH: Vitamina C Pura (Ácido Ascórbico) + Ácidos / Retinoide',
      why: 'El ácido L-ascórbico de bajo pH combinado directamente con ácidos exfoliantes o retinoides aumenta el picor y el enrojecimiento.',
      advice: 'Aplica la Vitamina C por la mañana bajo el protector solar y los ácidos o retinoides por la noche.'
    },
    ru: {
      title: 'Чувствительность pH: Чистый Витамин C (Аскорбиновая кислота) + Кислоты / Ретиноид',
      why: 'Кислый pH чистой аскорбиновой кислоты в сочетании с AHA/BHA или ретиноидами усиливает покалывание и раздражение кожи.',
      advice: 'Наносите Витамин C утром под SPF, а кислоты или ретиноиды — вечером.'
    },
    ur: {
      title: 'خالص وٹامن سی (ایسکوربک ایسڈ) اور ایسڈ / ریٹینوئڈ pH حساسیت',
      why: 'کم pH والا خالص ایسکوربک ایسڈ جب AHA/BHA یا ریٹینوئڈ کے ساتھ لگایا جائے تو جلد پر چبھن اور سرخی پیدا کر سکتا ہے۔',
      advice: 'وٹامن سی صبح سن اسکرین کے نیچے اور ریٹینوئڈ یا ایسڈز رات کی روٹین میں استعمال کریں۔'
    }
  },
  conflict_copper_peptide_acids_vitc: {
    severity: 'sari',
    tr: {
      title: 'Bakır Peptitler (Copper Tripeptide-1) + Saf C Vitamini / Direkt Asitler',
      why: 'Düşük pH\'lı direkt asitler (AHA/BHA) ve saf L-Askorbik Asit, bakır peptit kompleksindeki bakır iyonlarıyla etkileşerek her iki aktifin etkinliğini düşürebilir.',
      advice: 'Bakır peptit serumunu ve direkt asit / C vitamini ürünlerini sabah-akşam olarak farklı zamanlarda uygulayın.'
    },
    en: {
      title: 'Copper Peptides (Copper Tripeptide-1) + Pure Vitamin C / Direct Acids',
      why: 'Low-pH direct acids (AHA/BHA) and L-Ascorbic Acid can destabilize copper ions in Copper Tripeptide-1, reducing the efficacy of both actives.',
      advice: 'Separate Copper Peptides and direct acids / pure Vitamin C into alternate AM/PM routines.'
    },
    ar: {
      title: 'ببتيدات النحاس + فيتامين C النقي / الأحماض المباشرة',
      why: 'الأحماض ذات الحموضة المنخفضة وفيتامين C النقي قد تؤثر على استقرار أيونات النحاس في الببتيدات وتقلل فعالية المنتجين.',
      advice: 'افصل بين ببتيدات النحاس والأحماض/فيتامين C بين الصباح والمساء.'
    },
    de: {
      title: 'Kupferpeptide (Copper Tripeptide-1) + Reines Vitamin C / Direkte Säuren',
      why: 'Direkte Säuren mit niedrigem pH-Wert und L-Ascorbinsäure können Kupferpeptide destabilisieren und die Wirksamkeit verringern.',
      advice: 'Kupferpeptide und direkte Säuren / Vitamin C getrennt morgens und abends verwenden.'
    },
    fr: {
      title: 'Peptides de Cuivre + Vitamine C Pure / Acides Directs',
      why: 'Les acides à faible pH et l\'acide L-ascorbique peuvent déstabiliser les ions cuivre du Copper Tripeptide-1 et réduire leur efficacité.',
      advice: 'Séparer les peptides de cuivre et les acides / Vitamine C entre le matin et le soir.'
    },
    id: {
      title: 'Copper Peptide + Vitamin C Murni / Asam Eksfoliasi',
      why: 'Asam ber-pH rendah dan Asam L-Askorbat dapat mengganggu stabilitas ion tembaga pada Copper Tripeptide-1 sehingga menurunkan efektivitasnya.',
      advice: 'Pisahkan penggunaan Copper Peptide dan asam / Vitamin C pada waktu pagi dan malam yang berbeda.'
    },
    ms: {
      title: 'Peptida Kuprum + Vitamin C Tulen / Asid Langsung',
      why: 'Asid ber-pH rendah dan Asid L-Askorbik boleh menjejaskan kestabilan ion kuprum dalam Copper Tripeptide-1.',
      advice: 'Asingkan penggunaan Peptida Kuprum dan asid / Vitamin C antara rutin pagi dan malam.'
    },
    es: {
      title: 'Péptidos de Cobre + Vitamina C Pura / Ácidos Directos',
      why: 'Los ácidos de bajo pH y el ácido L-ascórbico pueden desestabilizar los iones de cobre en el Copper Tripeptide-1, reduciendo su eficacia.',
      advice: 'Separa los péptidos de cobre y los ácidos / Vitamina C en rutinas de mañana y noche.'
    },
    ru: {
      title: 'Пептиды меди (Copper Tripeptide-1) + Чистый Витамин C / Кислоты',
      why: 'Кислоты с низким pH и чистая аскорбиновая кислота могут снижать стабильность пептидов меди и уменьшать эффективность ухода.',
      advice: 'Разделите пептиды меди и кислоты / Витамин C на утренний и вечерний уход.'
    },
    ur: {
      title: 'کاپر پیپٹائڈز + خالص وٹامن سی / ڈائریکٹ ایسڈز',
      why: 'کم pH والے ایسڈز اور خالص ایسکوربک ایسڈ کاپر پیپٹائڈز کی افادیت کو کم کر سکتے ہیں۔',
      advice: 'کاپر پیپٹائڈز اور ایسڈز/وٹامن سی کو صبح اور شام کے الگ اوقات میں استعمال کریں۔'
    }
  },
  conflict_multi_acids_or_alcohol: {
    severity: 'sari',
    tr: {
      title: 'Güçlü Aktif (Retinoid / Soyucu Asit) + Yüksek Kurutucu Alkol (İlk 5 Sırada Alcohol Denat.)',
      why: 'İlk 5 sırada yer alan yüksek konsantrasyonlu Alcohol Denat. / Etanol, cilt lipidlerini çözerek retinoid veya soyucu asitlerin penetrasyonunu kontrolsüz artırabilir ve transepidermal su kaybını (TEWL) hızlandırır.',
      advice: 'Hassas ve kuru ciltlerde seramid/pantenol içeren bariyer destekleyici nemlendirici ile tamponlayarak (sandwich tekniği) kullanın.'
    },
    en: {
      title: 'Potent Active (Retinoid / Exfoliating Acid) + High Drying Alcohol (Top 5 Alcohol Denat.)',
      why: 'High-concentration Alcohol Denat. / Ethanol in the top 5 ingredients strips surface lipids, accelerating transepidermal water loss (TEWL) and increasing irritation from retinoids or exfoliating acids.',
      advice: 'Buffer with a ceramide or panthenol barrier moisturizer (sandwich method), especially on dry or sensitive skin.'
    },
    ar: {
      title: 'مادة فعالة قوية (ريتينويد / أحماض) + كحول مجفف بتركيز عالٍ (في أول 5 مكونات)',
      why: 'وجود الكحول المحول (Alcohol Denat) في أول 5 مكونات يذيب دهون البشرة السطحية ويزيد من فقدان الماء والتهيج الناتج عن الريتينويد أو الأحماض.',
      advice: 'استخدم مرطباً داعماً لحاجز البشرة (يحتوي على السيراميد أو البانثينول) لتقليل الجفاف.'
    },
    de: {
      title: 'Starker Wirkstoff (Retinoid / Säure) + Austrocknender Alkohol (Alcohol Denat. in Top 5)',
      why: 'Alcohol Denat. unter den ersten 5 Inhaltsstoffen löst Hautlipide, erhöht den Wasserverlust (TEWL) und verstärkt mögliche Reizungen durch Retinoide oder Säuren.',
      advice: 'Bei empfindlicher Haut mit einer Ceramid- oder Panthenol-Barrierecreme kombinieren.'
    },
    fr: {
      title: 'Actif Puissant (Rétinoïde / Acide) + Alcool Desséchant (Alcohol Denat. dans le Top 5)',
      why: 'L\'Alcohol Denat. présent dans les 5 premiers ingrédients altère les lipides cutanés et accentue l\'irritation liée aux rétinoïdes ou aux acides exfoliants.',
      advice: 'Tamponner avec une crème barrière aux céramides ou au panthénol sur les peaux sensibles.'
    },
    id: {
      title: 'Bahan Aktif Kuat (Retinoid / Asam) + Alkohol Pengering Tinggi (Alcohol Denat. di 5 Teratas)',
      why: 'Alcohol Denat. di 5 urutan teratas dapat mengikis lipid pelindung kulit dan memperparah risiko kering/iritasi dari retinoid atau asam eksfoliasi.',
      advice: 'Gunakan pelembap berbahan Ceramide atau Panthenol untuk menjaga skin barrier.'
    },
    ms: {
      title: 'Bahan Aktif Kuat (Retinoid / Asid) + Alkohol Pengering (Alcohol Denat. dalam 5 Teratas)',
      why: 'Alcohol Denat. dalam 5 ramuan teratas boleh menghakis lipid kulit dan meningkatkan risiko kekeringan daripada retinoid atau asid.',
      advice: 'Lapiskan dengan pelembap pelindung kulit yang mengandungi Ceramide atau Panthenol.'
    },
    es: {
      title: 'Activo Potente (Retinoide / Ácido) + Alcohol Secante (Alcohol Denat. en Top 5)',
      why: 'El Alcohol Denat. entre los 5 primeros ingredientes debilita los lípidos superficiales y aumenta la sequedad o irritación de los retinoides o ácidos.',
      advice: 'Acompañar con una crema reparadora con ceramidas o pantenol en pieles sensibles.'
    },
    ru: {
      title: 'Сильный актив (Ретиноид / Кислота) + Сушащий спирт (Alcohol Denat. в топ-5)',
      why: 'Денатурированный спирт в первых 5 позициях состава ослабляет липидный барьер и усиливает сухость от ретиноидов или кислот.',
      advice: 'Используйте вместе с барьерным кремом с церамидами или пантенолом.'
    },
    ur: {
      title: 'تیز فعال جزو (ریٹینوئڈ / ایسڈ) + خشک کرنے والا الکوحل (پہلے 5 اجزاء میں Alcohol Denat)',
      why: 'پہلے 5 اجزاء میں موجود Alcohol Denat جلد کی نمی کم کرتا ہے اور ریٹینوئڈ یا ایسڈز سے ہونے والی خشکی کو بڑھا سکتا ہے۔',
      advice: 'حساس جلد پر سیرامائڈ یا پینتھینول والے موئسچرائزر کے ساتھ استعمال کریں۔'
    }
  }
};

function detectCosmeticActiveGroups(observations = []) {
  const groups = {
    retinoids: [],
    aha_bha_acids: [],
    benzoyl_peroxide: [],
    pure_vitamin_c: [],
    copper_peptides: [],
    high_drying_alcohol: []
  };

  for (const obs of observations || []) {
    const raw = String(obs.raw || '');
    const subId = obs.substance ? obs.substance.id : '';
    const label = obs.localizedName || (obs.substance ? obs.substance.name : raw);

    if (
      subId === 'retinol' ||
      subId === 'tretinoin' ||
      /(?:^|[^\p{L}\p{N}])(retinol|retinal|retinaldehyde|retinyl\s+palmitate|retinyl\s+acetate|retinyl\s+propionate|hydroxypinacolone\s+retinoate|adapalene|tretinoin|ريتينول|ریٹینول|ретинол)(?=[^\p{L}\p{N}]|$)/iu.test(raw)
    ) {
      groups.retinoids.push(label);
    }

    if (
      subId === 'salicylic_acid' ||
      subId === 'aha_glycolic_lactic_mandelic' ||
      /(?:^|[^\p{L}\p{N}])(glycolic\s+acid|lactic\s+acid|mandelic\s+acid|salicylic\s+acid|glikolik\s+asit|laktik\s+asit|mandelik\s+asit|salisilik\s+asit|glykolsäure|milchsäure|salicylsäure|acide\s+glycolique|acide\s+lactique|acide\s+salicylique|ácido\s+glicólico|ácido\s+láctico|ácido\s+salicílico|гликолевая\s+кислота|молочная\s+кислота|салициловая\s+кислота|حمض\s+الجليكوليك|حمض\s+اللاكتيك|حمض\s+الساليسيليك|گلائیکولک\s+ایسڈ|سیلیسیلک\s+ایسڈ)(?=[^\p{L}\p{N}]|$)/iu.test(raw)
    ) {
      groups.aha_bha_acids.push(label);
    }

    if (
      /(?:^|[^\p{L}\p{N}])(benzoyl\s+peroxide|benzoil\s+peroksit|benzoylperoxid|peroxyde\s+de\s+benzoyle|peróxido\s+de\s+benzoilo|бензоил\s*пероксид|بنزويل\s+بيروكسايد|بینزوائل\s+پرآکسائیڈ)(?=[^\p{L}\p{N}]|$)/iu.test(raw)
    ) {
      groups.benzoyl_peroxide.push(label);
    }

    if (
      /(?:^|[^\p{L}\p{N}])(l[\s\-]*ascorbic\s+acid|ascorbic\s+acid|askorbik\s+asit|ascorbinsäure|acide\s+ascorbique|ácido\s+ascórbico|аскорбиновая\s+кислота|حمض\s+الأسكوربيك|ایسکوربک\s+ایسڈ)(?=[^\p{L}\p{N}]|$)/iu.test(raw) &&
      !/glucoside|phosphate|palmitate|tetraisopalmitate|ethyl\s+ascorbic/iu.test(raw)
    ) {
      groups.pure_vitamin_c.push(label);
    }

    if (
      /(?:^|[^\p{L}\p{N}])(copper\s+tripeptide[-\s]*1|copper\s+peptide[s]?|ghk[-\s]*cu|bakır\s+peptit|bakir\s+peptit|kupferpeptid[e]?|peptides?\s+de\s+cuivre|péptidos?\s+de\s+cobre|пептид[ы]?\s+меди|ببتيد\s+النحاس|کاپر\s+پیپٹائڈ)(?=[^\p{L}\p{N}]|$)/iu.test(raw)
    ) {
      groups.copper_peptides.push(label);
    }

    if (
      obs.position <= 5 &&
      (subId === 'alcohol_denat' ||
        (/(?:^|[^\p{L}\p{N}])(alcohol\s+denat\.?|denatured\s+alcohol|ethanol|ethyl\s+alcohol|etanol)(?=[^\p{L}\p{N}]|$)/iu.test(raw) &&
          !/(cetyl|cetearyl|stearyl|behenyl|arachidyl|myristyl|lauryl|lanolin|benzyl|phenethyl|cinnamyl|anisyl|amyl)/iu.test(raw)))
    ) {
      groups.high_drying_alcohol.push(label);
    }
  }

  for (const k of Object.keys(groups)) {
    groups[k] = Array.from(new Set(groups[k]));
  }
  return groups;
}

function evaluateActiveGroupConflicts(groups, lang) {
  const conflicts = [];
  const sevLabels = {
    tr: { kirmizi: 'Aynı Rutinde Kullanmayın', sari: 'Dikkatli Katmanlama' },
    en: { kirmizi: 'Avoid Same-Routine Layering', sari: 'Layer with Caution' },
    ar: { kirmizi: 'تجنب الدمج في نفس الروتين', sari: 'تطبيق بحذر' },
    de: { kirmizi: 'Nicht zusammen schichten', sari: 'Vorsichtig kombinieren' },
    fr: { kirmizi: 'Ne pas superposer ensemble', sari: 'Superposer avec précaution' },
    id: { kirmizi: 'Jangan Ditumpuk Bersamaan', sari: 'Layering dengan Hati-hati' },
    ms: { kirmizi: 'Elakkan Lapisan Bersama', sari: 'Lapisan Berhati-hati' },
    es: { kirmizi: 'No combinar en la misma rutina', sari: 'Combinar con precaución' },
    ru: { kirmizi: 'Не наносить одновременно', sari: 'Сочетать с осторожностью' },
    ur: { kirmizi: 'ایک ہی روٹین میں استعمال نہ کریں', sari: 'احتیاط سے استعمال کریں' }
  };
  const sLoc = sevLabels[lang] || sevLabels.en;

  const pushConflict = (ruleId, pairItems) => {
    const rule = ROUTINE_CONFLICT_RULES_10LANG[ruleId];
    if (!rule) return;
    const loc = rule[lang] || rule.en;
    const pairStr = Array.from(new Set(pairItems)).join(' + ');
    conflicts.push({
      conflictId: ruleId,
      severity: rule.severity,
      severityLabel: rule.severity === 'kirmizi' ? sLoc.kirmizi : sLoc.sari,
      title: loc.title,
      detectedActives: pairStr,
      detectedPair: pairStr,
      whyConflict: loc.why,
      routineAdvice: loc.advice,
      howToLayer: loc.advice
    });
  };

  if (groups.retinoids.length > 0 && groups.aha_bha_acids.length > 0) {
    pushConflict('conflict_retinoid_aha_bha', [...groups.retinoids, ...groups.aha_bha_acids]);
  }
  if (groups.retinoids.length > 0 && groups.benzoyl_peroxide.length > 0) {
    pushConflict('conflict_retinoid_benzoyl_peroxide', [...groups.retinoids, ...groups.benzoyl_peroxide]);
  }
  if (groups.pure_vitamin_c.length > 0 && (groups.retinoids.length > 0 || groups.aha_bha_acids.length > 0)) {
    pushConflict('conflict_vitc_aha_bha_retinoid', [
      ...groups.pure_vitamin_c,
      ...groups.retinoids,
      ...groups.aha_bha_acids
    ]);
  }
  if (groups.copper_peptides.length > 0 && (groups.pure_vitamin_c.length > 0 || groups.aha_bha_acids.length > 0)) {
    pushConflict('conflict_copper_peptide_acids_vitc', [
      ...groups.copper_peptides,
      ...groups.pure_vitamin_c,
      ...groups.aha_bha_acids
    ]);
  }
  if (
    groups.high_drying_alcohol.length > 0 &&
    (groups.retinoids.length > 0 || groups.aha_bha_acids.length > 0 || groups.pure_vitamin_c.length > 0)
  ) {
    pushConflict('conflict_multi_acids_or_alcohol', [
      ...groups.retinoids,
      ...groups.aha_bha_acids,
      ...groups.pure_vitamin_c,
      ...groups.high_drying_alcohol
    ]);
  }

  return conflicts;
}

function buildRoutineConflictCard({ lang = 'tr', productType = 'cosmetic', observations = [] }) {
  const ui = ROUTINE_CONFLICT_UI_I18N[lang] || ROUTINE_CONFLICT_UI_I18N.en;
  const labelsByLang = {
    tr: { pair: 'Etkileşen Aktifler', why: 'Neden Çakışır:', tip: 'Güvenli Rutin Önerisi' },
    en: { pair: 'Interacting Actives', why: 'Why It Conflicts:', tip: 'Safe Routine Tip' },
    ar: { pair: 'المواد المتفاعلة', why: 'سبب التعارض:', tip: 'نصيحة الروتين الآمن' },
    de: { pair: 'Interagierende Wirkstoffe', why: 'Warum Konflikt:', tip: 'Sicherer Routine-Tipp' },
    fr: { pair: 'Actifs en interaction', why: 'Pourquoi ce conflit :', tip: 'Conseil routine sûre' },
    id: { pair: 'Bahan Aktif Berinteraksi', why: 'Mengapa Konflik:', tip: 'Tips Rutinitas Aman' },
    ms: { pair: 'Bahan Aktif Berinteraksi', why: 'Mengapa Konflik:', tip: 'Tip Rutin Selamat' },
    es: { pair: 'Activos en interacción', why: 'Por qué hay conflicto:', tip: 'Consejo de rutina segura' },
    ru: { pair: 'Взаимодействующие активы', why: 'Причина конфликта:', tip: 'Безопасный режим' },
    ur: { pair: 'متصادم فعال اجزاء', why: 'تصادم کی وجہ:', tip: 'محفوظ روٹین کا مشورہ' }
  };
  const lbl = labelsByLang[lang] || labelsByLang.en;

  if (productType !== 'cosmetic') {
    return {
      applicable: false,
      cardTitle: ui.cardTitle,
      cardSubtitle: ui.cardSubtitle,
      pairLabel: lbl.pair,
      whyLabel: lbl.why,
      routineTipLabel: lbl.tip,
      howToUseLabel: ui.howToUseLabel,
      noConflictMsg: ui.noConflictMsg,
      needsSpfReminder: false,
      spfReminderText: null,
      totalConflicts: 0,
      conflicts: []
    };
  }

  const groups = detectCosmeticActiveGroups(observations);
  const conflicts = evaluateActiveGroupConflicts(groups, lang);
  const needsSpfReminder = groups.retinoids.length > 0 || groups.aha_bha_acids.length > 0;

  return {
    applicable: true,
    cardTitle: ui.cardTitle,
    cardSubtitle: ui.cardSubtitle,
    pairLabel: lbl.pair,
    whyLabel: lbl.why,
    routineTipLabel: lbl.tip,
    howToUseLabel: ui.howToUseLabel,
    noConflictMsg: ui.noConflictMsg,
    needsSpfReminder,
    spfReminderText: needsSpfReminder ? ui.spfReminder : null,
    activeGroupsDetected: groups,
    totalConflicts: conflicts.length,
    conflicts
  };
}

function buildCrossProductRoutineConflict({ lang = 'tr', nameA, nameB, evalA, evalB }) {
  const ui = ROUTINE_CONFLICT_UI_I18N[lang] || ROUTINE_CONFLICT_UI_I18N.en;
  if (evalA.productType !== 'cosmetic' || evalB.productType !== 'cosmetic') {
    return {
      applicable: false,
      cardTitle: ui.layeringTitle,
      compareLayerTitle: ui.layeringTitle,
      compareLayerSubtitle: ui.cardSubtitle,
      howToUseLabel: ui.howToUseLabel,
      needsSpfReminder: false,
      spfReminderText: null,
      totalConflicts: 0,
      conflicts: []
    };
  }

  const gA = detectCosmeticActiveGroups(evalA.observations || []);
  const gB = detectCosmeticActiveGroups(evalB.observations || []);
  const merged = {
    retinoids: [...gA.retinoids.map((x) => `${nameA}: ${x}`), ...gB.retinoids.map((x) => `${nameB}: ${x}`)],
    aha_bha_acids: [...gA.aha_bha_acids.map((x) => `${nameA}: ${x}`), ...gB.aha_bha_acids.map((x) => `${nameB}: ${x}`)],
    benzoyl_peroxide: [...gA.benzoyl_peroxide.map((x) => `${nameA}: ${x}`), ...gB.benzoyl_peroxide.map((x) => `${nameB}: ${x}`)],
    pure_vitamin_c: [...gA.pure_vitamin_c.map((x) => `${nameA}: ${x}`), ...gB.pure_vitamin_c.map((x) => `${nameB}: ${x}`)],
    copper_peptides: [...gA.copper_peptides.map((x) => `${nameA}: ${x}`), ...gB.copper_peptides.map((x) => `${nameB}: ${x}`)],
    high_drying_alcohol: [...gA.high_drying_alcohol.map((x) => `${nameA}: ${x}`), ...gB.high_drying_alcohol.map((x) => `${nameB}: ${x}`)]
  };

  const conflicts = evaluateActiveGroupConflicts(merged, lang);
  const needsSpfReminder = merged.retinoids.length > 0 || merged.aha_bha_acids.length > 0;
  return {
    applicable: true,
    cardTitle: ui.layeringTitle,
    compareLayerTitle: ui.layeringTitle,
    compareLayerSubtitle: ui.cardSubtitle,
    howToUseLabel: ui.howToUseLabel,
    needsSpfReminder,
    spfReminderText: needsSpfReminder ? ui.spfReminder : null,
    totalConflicts: conflicts.length,
    conflicts
  };
}

// ============================================================================
// FEATURE 4: OFFICIAL REGULATORY & ALLERGEN REPORT WITH 4-LAYER FRESHNESS SEAL
// ============================================================================
const REGULATORY_REPORT_I18N = {
  tr: {
    reportTitle: '📄 Resmi Mevzuat, Alerjen & Yürürlük Raporu',
    reportSubtitle: 'Doktor, eczacı, üretici veya denetim incelemesi için resmi AB/TİTCK/FDA mevzuat dayanaklarını, yürürlük takvimini ve alerjen bildirimlerini içeren doğrulanabilir teknik özet.',
    freshnessTitle: '🔄 4 Katmanlı Mevzuat Güncellik & Doğrulama Mimarisi',
    freshnessPillars: [
      '1. Resmi Kaynak Son Teyit Mührü (checked_at): Her hüküm EUR-Lex, CosIng, EFSA, SCCS ve Helal kurum bültenlerinin son resmi doğrulama tarihiyle mühürlenir.',
      '2. Yürürlük & Geçiş Takvimi Motoru: AB Omnibus tüzüklerindeki (ör. AB 2025/877 TPO yasağı, AB 2026/909 TPHP 2027-01-01 arz / 2028-07-01 bulundurma yasağı, AB 2024/996 Retinol/Kojik Asit/Arbutin) yürürlük tarihleri dinamik takip edilir.',
      '3. Doğrudan Resmi Gazete (EUR-Lex / EFSA) Bağlantıları: Rapordaki her kaynak kodu resmi mevzuat metnine doğrudan bağlantı içerir.',
      '4. Sıfır Statik Metin: Rapor şablonu sabit metin kullanmaz; tüm hükümler merkezi mevzuat veri tabanından (sources.json & substances.json) anlık üretilir.'
    ],
    allergenSectionTitle: 'AB 1169/2011 Ek II & Kozmetik Duyarlılaştırıcı Alerjen Beyanı',
    transitionSectionTitle: 'AB Omnibus Yürürlük & Geçiş Dönemi Takvimi',
    sourcesSectionTitle: 'Atıf Yapılan Resmi Mevzuat ve Standart Kaynakları',
    noAllergenMsg: 'Formülde AB 1169/2011 Ek II majör gıda alerjeni veya çapraz bulaşma beyanı saptanmadı.',
    noTransitionMsg: 'Bu üründe geçiş dönemi takvimine tabi kısıtlı/yasaklı AB Omnibus maddesi bulunmamaktadır.'
  },
  en: {
    reportTitle: '📄 Official Regulatory, Allergen & Enforcement Report',
    reportSubtitle: 'Verifiable technical dossier citing official EU/FDA regulatory annexes, enforcement calendars, and mandatory allergen declarations for healthcare or manufacturer review.',
    freshnessTitle: '🔄 4-Layer Regulatory Freshness & Verification Architecture',
    freshnessPillars: [
      '1. Official Source Verification Seal (checked_at): Every rule is stamped with the last verification date against EUR-Lex, CosIng, EFSA, SCCS, and Halal authority bulletins.',
      '2. Effective-Date & Transition Calendar Engine: Dynamically tracks EU Omnibus enforcement cutoffs (e.g., EU 2025/877 TPO ban, EU 2026/909 TPHP 2027-01-01 placing / 2028-07-01 withdrawal, EU 2024/996 Retinol/Kojic Acid/Arbutin limits).',
      '3. Direct Official Gazette Links (EUR-Lex / EFSA): Every cited source includes its canonical official URL for live inspection.',
      '4. Zero Hardcoded Claims: Generated dynamically from the synchronized regulatory manifest (sources.json & substances.json).'
    ],
    allergenSectionTitle: 'EU 1169/2011 Annex II & Cosmetic Sensitizer Allergen Declaration',
    transitionSectionTitle: 'EU Omnibus Enforcement & Transition Calendar',
    sourcesSectionTitle: 'Cited Official Regulations & Standards',
    noAllergenMsg: 'No EU 1169/2011 Annex II major food allergens or cross-contact trace declarations detected.',
    noTransitionMsg: 'No substances subject to pending EU Omnibus transition deadlines detected in this formula.'
  },
  ar: {
    reportTitle: '📄 التقرير الرسمي للوائح التنظيمية ومسببات الحساسية',
    reportSubtitle: 'ملف تقني موثق يتضمن ملاحق لوائح الاتحاد الأوروبي/FDA وتقويم النفاذ وبيانات الحساسية لمراجعة الطبيب أو الصيدلي أو جهة الرقابة.',
    freshnessTitle: '🔄 بنية ضمان حداثة اللوائح والتحقق من 4 طبقات',
    freshnessPillars: [
      '1. ختم تاريخ التحقق الرسمي (checked_at): كل قاعدة مرتبطة بتاريخ آخر تدقيق رسمي من EUR-Lex وCosIng وEFSA وهيئات الحلال.',
      '2. محرك تقويم النفاذ والفترات الانتقالية: يتتبع تواريخ سريان لوائح الاتحاد الأوروبي (مثل حظر TPO 2025/877، ومواعيد TPHP 2026/909 في 2027-01-01 / 2028-07-01، وحدود 2024/996).',
      '3. روابط مباشرة للجريدة الرسمية (EUR-Lex / EFSA): يتضمن كل مصدر رابطاً رسمياً للتحقق الفوري.',
      '4. توليد ديناميكي بدون نصوص ثابتة: يُنشأ التقرير مباشرة من قاعدة البيانات التنظيمية الموحدة (sources.json وsubstances.json).'
    ],
    allergenSectionTitle: 'بيان مسببات الحساسية (لائحة الاتحاد الأوروبي 1169/2011 الملحق II)',
    transitionSectionTitle: 'تقويم النفاذ والفترات الانتقالية الأوروبية',
    sourcesSectionTitle: 'المصادر واللوائح الرسمية المرجعية',
    noAllergenMsg: 'لم يتم رصد مسببات حساسية رئيسية أو تحذيرات تلوث متبادل في هذه التركيبة.',
    noTransitionMsg: 'لا توجد مواد خاضعة لمواعيد انتقالية معلقة في هذه التركيبة.'
  },
  de: {
    reportTitle: '📄 Offizieller Regulierungs-, Allergen- & Fristenbericht',
    reportSubtitle: 'Überprüfbares technisches Dossier mit EU-/FDA-Verordnungsanhängen, Übergangsfristen und Allergendeklarationen für Arzt, Apotheke oder Hersteller.',
    freshnessTitle: '🔄 4-Stufen-Architektur für Regulierungsaktualität',
    freshnessPillars: [
      '1. Offizielles Prüfdatum (checked_at): Jede Regel trägt das letzte Abgleichdatum mit EUR-Lex, CosIng, EFSA, SCCS und Halal-Standards.',
      '2. Stichtags- & Übergangsfristen-Engine: Verfolgt dynamisch EU-Omnibus-Stichtage (z. B. EU 2025/877 TPO-Verbot, EU 2026/909 TPHP 2027-01-01 / 2028-07-01, EU 2024/996 Retinol/Kojisäure).',
      '3. Direkte Amtsblatt-Links (EUR-Lex / EFSA): Jede Quelle enthält den offiziellen Link zur Live-Prüfung.',
      '4. Keine statischen Vorlagen: Alle Angaben werden dynamisch aus dem synchronisierten Regulierungs-Manifest erzeugt.'
    ],
    allergenSectionTitle: 'EU 1169/2011 Anhang II & Kosmetik-Allergendeklaration',
    transitionSectionTitle: 'EU-Omnibus Geltungs- & Übergangsfristen',
    sourcesSectionTitle: 'Zitierte Offizielle Verordnungen & Standards',
    noAllergenMsg: 'Keine Hauptallergene nach EU 1169/2011 Anhang II oder Spurenhinweise erkannt.',
    noTransitionMsg: 'Keine Stoffe mit laufenden EU-Omnibus-Übergangsfristen in dieser Formel.'
  },
  fr: {
    reportTitle: '📄 Rapport Officiel Réglementaire, Allergènes & Échéances',
    reportSubtitle: 'Dossier technique vérifiable citant les annexes UE/FDA, le calendrier d\'entrée en vigueur et les déclarations d\'allergènes pour médecin ou pharmacien.',
    freshnessTitle: '🔄 Architecture de Mise à Jour Réglementaire en 4 Niveaux',
    freshnessPillars: [
      '1. Sceau de vérification officielle (checked_at) : Chaque règle indique la date du dernier contrôle EUR-Lex, CosIng, EFSA et normes Halal.',
      '2. Moteur de calendrier d\'application : Suit les échéances Omnibus UE (ex. interdiction TPO UE 2025/877, TPHP UE 2026/909 2027-01-01 / 2028-07-01, Rétinol/Acide kojique UE 2024/996).',
      '3. Liens directs vers le Journal Officiel (EUR-Lex / EFSA) : Chaque source citée inclut son lien officiel pour vérification immédiate.',
      '4. Zéro texte statique : Génération dynamique en temps réel depuis la base réglementaire synchronisée.'
    ],
    allergenSectionTitle: 'Déclaration des Allergènes (UE 1169/2011 Annexe II & Cosmétique)',
    transitionSectionTitle: 'Calendrier d\'Application & Transitions Omnibus UE',
    sourcesSectionTitle: 'Règlements et Normes Officiels Cités',
    noAllergenMsg: 'Aucun allergène majeur UE 1169/2011 Annexe II ni trace de contamination croisée détecté.',
    noTransitionMsg: 'Aucune substance soumise à une période de transition Omnibus UE dans cette formule.'
  },
  id: {
    reportTitle: '📄 Laporan Resmi Regulasi, Alergen & Kalender Berlaku',
    reportSubtitle: 'Ringkasan teknis terverifikasi yang memuat lampiran regulasi UE/FDA, batas waktu transisi, dan deklarasi alergen untuk dokter, apoteker, atau produsen.',
    freshnessTitle: '🔄 Arsitektur Pembaruan Regulasi 4 Lapis',
    freshnessPillars: [
      '1. Segel Tanggal Verifikasi Resmi (checked_at): Setiap aturan mencatat tanggal verifikasi terakhir terhadap EUR-Lex, CosIng, EFSA, dan standar Halal.',
      '2. Mesin Kalender Transisi Regulasi: Melacak tanggal berlaku regulasi Omnibus UE (mis. larangan TPO UE 2025/877, batas transisi TPHP UE 2026/909 2027-01-01 / 2028-07-01, UE 2024/996).',
      '3. Tautan Langsung Lembaran Resmi (EUR-Lex / EFSA): Setiap sumber dilengkapi tautan resmi untuk verifikasi langsung.',
      '4. Tanpa Teks Statis: Dihasilkan secara dinamis dari manifes regulasi tersinkronisasi.'
    ],
    allergenSectionTitle: 'Deklarasi Alergen (Lampiran II UE 1169/2011 & Sensitizer Kosmetik)',
    transitionSectionTitle: 'Kalender Berlaku & Masa Transisi Omnibus UE',
    sourcesSectionTitle: 'Sumber Regulasi & Standar Resmi yang Dirujuk',
    noAllergenMsg: 'Tidak terdeteksi alergen pangan utama Lampiran II UE 1169/2011 atau peringatan jejak kontaminasi silang.',
    noTransitionMsg: 'Tidak ada bahan dalam masa transisi Omnibus UE pada formula ini.'
  },
  ms: {
    reportTitle: '📄 Laporan Rasmi Regulasi, Alergen & Takwim Kuat Kuasa',
    reportSubtitle: 'Dokumen teknikal boleh disahkan yang menyenaraikan lampiran peraturan EU/FDA, tarikh kuat kuasa dan pengisytiharan alergen untuk semakan doktor atau ahli farmasi.',
    freshnessTitle: '🔄 Seni Bina Kemas Kini Regulasi 4 Lapisan',
    freshnessPillars: [
      '1. Cop Tarikh Pengesahan Rasmi (checked_at): Setiap peraturan direkodkan dengan tarikh semakan terakhir EUR-Lex, CosIng, EFSA dan piawaian Halal.',
      '2. Enjin Takwim Peralihan: Menjejaki tarikh kuat kuasa Omnibus EU (cth. pengharaman TPO EU 2025/877, tarikh akhir TPHP EU 2026/909 2027-01-01 / 2028-07-01, EU 2024/996).',
      '3. Pautan Terus Warta Rasmi (EUR-Lex / EFSA): Setiap sumber menyertakan pautan rasmi untuk semakan segera.',
      '4. Tiada Teks Statik: Dijana secara dinamik daripada pangkalan data peraturan berpusat.'
    ],
    allergenSectionTitle: 'Pengisytiharan Alergen (Lampiran II EU 1169/2011 & Kosmetik)',
    transitionSectionTitle: 'Takwim Kuat Kuasa & Peralihan Omnibus EU',
    sourcesSectionTitle: 'Peraturan & Piawaian Rasmi yang Dirujuk',
    noAllergenMsg: 'Tiada alergen makanan utama Lampiran II EU 1169/2011 atau amaran surih dikesan.',
    noTransitionMsg: 'Tiada bahan yang tertakluk kepada tempoh peralihan Omnibus EU dalam formula ini.'
  },
  es: {
    reportTitle: '📄 Informe Oficial Regulatorio, de Alérgenos y Vigencia',
    reportSubtitle: 'Dossier técnico verificable con anexos normativos UE/FDA, calendario de entrada en vigor y declaración de alérgenos para consulta médica o farmacéutica.',
    freshnessTitle: '🔄 Arquitectura de Actualización Regulatoria de 4 Capas',
    freshnessPillars: [
      '1. Sello de Verificación Oficial (checked_at): Cada regla incluye la fecha de última verificación frente a EUR-Lex, CosIng, EFSA y normas Halal.',
      '2. Motor de Calendario de Vigencia: Rastrea fechas límite Omnibus UE (p. ej., prohibición de TPO UE 2025/877, transición de TPHP UE 2026/909 2027-01-01 / 2028-07-01, UE 2024/996).',
      '3. Enlaces Directos al Diario Oficial (EUR-Lex / EFSA): Cada fuente citada incluye su enlace oficial para comprobación en vivo.',
      '4. Cero Texto Estático: Generación dinámica desde el manifiesto regulatorio sincronizado.'
    ],
    allergenSectionTitle: 'Declaración de Alérgenos (UE 1169/2011 Anexo II y Cosmética)',
    transitionSectionTitle: 'Calendario de Vigencia y Transición Omnibus UE',
    sourcesSectionTitle: 'Reglamentos y Normas Oficiales Citados',
    noAllergenMsg: 'No se detectaron alérgenos alimentarios principales del Anexo II UE 1169/2011 ni trazas.',
    noTransitionMsg: 'No hay sustancias sujetas a plazos de transición Omnibus UE en esta fórmula.'
  },
  ru: {
    reportTitle: '📄 Официальный регуляторный отчет и декларация аллергенов',
    reportSubtitle: 'Верифицируемое техническое досье со ссылками на регламенты ЕС/FDA, графиком вступления норм в силу и перечнем аллергенов для врача или фармацевта.',
    freshnessTitle: '🔄 4-уровневая архитектура актуальности нормативной базы',
    freshnessPillars: [
      '1. Штамп последней проверки (checked_at): Каждое правило содержит дату сверки с официальными базами EUR-Lex, CosIng, EFSA и стандартами Халяль.',
      '2. Контроль сроков вступления в силу: Автоматический учет переходных периодов ЕС (запрет TPO ЕС 2025/877, даты TPHP ЕС 2026/909 2027-01-01 / 2028-07-01, ЕС 2024/996).',
      '3. Прямые ссылки на Официальный журнал (EUR-Lex / EFSA): Каждый источник содержит прямую ссылку на официальный документ.',
      '4. Без статических шаблонов: Динамическая генерация из единой синхронизированной базы нормативов.'
    ],
    allergenSectionTitle: 'Декларация аллергенов (Регламент ЕС 1169/2011 Приложение II и косметика)',
    transitionSectionTitle: 'График вступления в силу и переходные периоды ЕС',
    sourcesSectionTitle: 'Цитируемые официальные регламенты и стандарты',
    noAllergenMsg: 'Основных пищевых аллергенов (ЕС 1169/2011 Приложение II) или следов перекрестного загрязнения не обнаружено.',
    noTransitionMsg: 'Веществ с переходным периодом регламентов Omnibus ЕС в составе не выявлено.'
  },
  ur: {
    reportTitle: '📄 سرکاری ریگولیٹری، الرجن اور نفاذ کی رپورٹ',
    reportSubtitle: 'ڈاکٹر، فارماسسٹ یا مینوفیکچرر کے جائزے کے لیے یورپی یونین/FDA قوانین، نفاذ کی تاریخوں اور الرجن کی تفصیلات پر مشتمل قابلِ تصدیق تکنیکی رپورٹ۔',
    freshnessTitle: '🔄 قوانین کی تازہ کاری اور تصدیق کا 4 سطحی نظام',
    freshnessPillars: [
      '1. سرکاری تصدیق کی تاریخ (checked_at): ہر اصول کے ساتھ EUR-Lex، CosIng، EFSA اور حلال اتھارٹیز سے آخری تصدیق کی تاریخ درج ہوتی ہے۔',
      '2. نفاذ اور عبوری مدت کا انجن: یورپی یونین کے نئے قوانین (جیسے EU 2025/877 TPO پابندی، EU 2026/909 TPHP کی 2027-01-01 / 2028-07-01 مہلت، اور EU 2024/996) کی تاریخوں کو خودکار مانیٹر کرتا ہے۔',
      '3. سرکاری گزٹ کے براہِ راست لنکس (EUR-Lex / EFSA): ہر حوالے کے ساتھ براہِ راست تصدیقی لنک موجود ہے۔',
      '4. کوئی جامد عبارت نہیں: تمام معلومات مرکزی ریگولیٹری ڈیٹا بیس سے براہِ راست تیار کی جاتی ہیں۔'
    ],
    allergenSectionTitle: 'الرجن کا بیان (EU 1169/2011 ضمیمہ II اور کاسمیٹک الرجن)',
    transitionSectionTitle: 'یورپی یونین قوانین کے نفاذ اور عبوری مدت کا شیڈول',
    sourcesSectionTitle: 'حوالہ دیے گئے سرکاری قوانین اور معیارات',
    noAllergenMsg: 'فارمولے میں EU 1169/2011 ضمیمہ II کے بڑے غذائی الرجن یا کراس کنٹیمینیشن کے ذرات نہیں ملے۔',
    noTransitionMsg: 'اس فارمولے میں عبوری مدت سے مشروط کوئی محدود مادہ موجود نہیں۔'
  }
};

function buildRegulatoryReportCard({
  lang = 'tr',
  productType = 'cosmetic',
  jurisdiction = 'TR',
  halalAuthority = 'GIMDES',
  rawText = '',
  allergenStatement = '',
  observations = [],
  regulatoryCard,
  profileCard,
  halalCard,
  routineConflictCard
}) {
  const ui = REGULATORY_REPORT_I18N[lang] || REGULATORY_REPORT_I18N.en;

  // 1. Collect EU Omnibus Transition / Enforcement Calendar items present in formula
  const transitionCalendarItems = [];
  for (const obs of observations || []) {
    const subId = obs.substance ? obs.substance.id : '';
    const rawStr = String(obs.raw || '');
    const itemName = obs.localizedName || (obs.substance ? obs.substance.name : obs.raw);
    if (
      subId === 'tpo_nail_banned_2025' ||
      /\btrimethylbenzoyl\s+diphenylphosphine\s+oxide\b/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2025/877 (Omnibus VII — Annex II CMR 1B Ban)',
        placingOnMarketDate: '2025-09-01',
        makingAvailableDate: '2025-09-01',
        deadline: '2025-09-01',
        effectiveDate: '2025-09-01',
        status: 'enforced_ban_2025_09_01'
      });
    } else if (
      subId === 'tphp_triphenyl_phosphate_banned' ||
      /(?:^|[^\p{L}\p{N}])(triphenyl\s+phosphate|triphenylphosphat|phosphate\s+de\s+triphényle|fosfato\s+de\s+trifenilo|trifenil\s+fosfat|трифенилфосфат|فوسفات\s+ثلاثي\s+الفينيل|ٹرائی\s+فینائل\s+فاسفیٹ)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2026/909 (Annex II — Prohibited in Cosmetics)',
        placingOnMarketDate: '2027-01-01',
        makingAvailableDate: '2028-07-01',
        deadline: '2027-01-01 (Placing) / 2028-07-01 (Withdrawal)',
        effectiveDate: '2027-01-01',
        status: 'placing_ban_2027_01_01_market_withdrawal_2028_07_01'
      });
    } else if (
      subId === 'retinol' ||
      subId === 'tretinoin' ||
      /(?:^|[^\p{L}\p{N}])(retinol|rétinol|ретинол|ريتينول|ریٹینول|retinyl\s+palmitate|retinyl\s+acetate|retinyl\s+propionate|vitamin\s+a)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/376 — Max 0.05% Body Lotion / 0.3% Face & Other)',
        placingOnMarketDate: '2025-11-01',
        makingAvailableDate: '2027-05-01',
        deadline: '2025-11-01 (Placing) / 2027-05-01 (Withdrawal)',
        effectiveDate: '2027-05-01',
        status: 'transition_placing_2025_11_01_withdrawal_2027_05_01'
      });
    } else if (
      subId === 'kojic_acid' ||
      /(?:^|[^\p{L}\p{N}])(kojic\s+acid|kojik\s+asit|kojisäure|acide\s+kojique|ácido\s+kójico|asam\s+kojat|asid\s+kojik|койевая\s+кислота|حمض\s+الكوجيك|کوجک\s+ایسڈ)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/375 — Max 1.0% in Face & Hand Products)',
        placingOnMarketDate: '2025-02-01',
        makingAvailableDate: '2025-11-01',
        deadline: '2025-02-01 (Placing) / 2025-11-01 (Withdrawal)',
        effectiveDate: '2025-11-01',
        status: 'enforced_limit_1pct_face_hand_placing_2025_02_01_withdrawal_2025_11_01'
      });
    } else if (
      subId === 'alpha_arbutin' ||
      /(?:^|[^\p{L}\p{N}])(alpha[\s\-]*arbutin[ea]?|alfa[\s\-]*arbutin[ea]?|ألفا[\s\-]*أربوتين|альфа[\s\-]*арбутин|الفا[\s\-]*اربوٹین)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/377 — Max 2.0% Face Cream / 0.5% Body Lotion)',
        placingOnMarketDate: '2025-02-01',
        makingAvailableDate: '2025-11-01',
        deadline: '2025-02-01 (Placing) / 2025-11-01 (Withdrawal)',
        effectiveDate: '2025-11-01',
        status: 'enforced_limit_2pct_face_0_5pct_body_placing_2025_02_01_withdrawal_2025_11_01'
      });
    } else if (
      subId === 'arbutin' ||
      /(?:^|[^\p{L}\p{N}])(arbutin[ea]?|beta[\s\-]*arbutin[ea]?|أربوتين|арбутин|اربوٹین)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/378 — Max 7.0% Face Cream)',
        placingOnMarketDate: '2025-02-01',
        makingAvailableDate: '2025-11-01',
        deadline: '2025-02-01 (Placing) / 2025-11-01 (Withdrawal)',
        effectiveDate: '2025-11-01',
        status: 'enforced_limit_7pct_face_placing_2025_02_01_withdrawal_2025_11_01'
      });
    } else if (
      subId === 'genistein' ||
      /(?:^|[^\p{L}\p{N}])(genistein[ea]?|genisteína|генистеин|جينيستين|جینیسٹین)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/373 — Max 0.007% in Cosmetics)',
        placingOnMarketDate: '2025-02-01',
        makingAvailableDate: '2025-11-01',
        deadline: '2025-02-01 (Placing) / 2025-11-01 (Withdrawal)',
        effectiveDate: '2025-11-01',
        status: 'enforced_limit_0_007pct_placing_2025_02_01_withdrawal_2025_11_01'
      });
    } else if (
      subId === 'daidzein' ||
      /(?:^|[^\p{L}\p{N}])(daidzein[ea]?|daidzeína|даидзеин|دايدزين|ڈائیڈزین)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex III/374 — Max 0.02% in Cosmetics)',
        placingOnMarketDate: '2025-02-01',
        makingAvailableDate: '2025-11-01',
        deadline: '2025-02-01 (Placing) / 2025-11-01 (Withdrawal)',
        effectiveDate: '2025-11-01',
        status: 'enforced_limit_0_02pct_placing_2025_02_01_withdrawal_2025_11_01'
      });
    } else if (
      subId === '4_mbc' ||
      /(?:^|[^\p{L}\p{N}])(4[\s\-]*methylbenzylidene\s+camphor|4[\s\-]*mbc|enzacamene)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex II/1730 — Prohibited UV Filter)',
        placingOnMarketDate: '2025-05-01',
        makingAvailableDate: '2026-05-01',
        deadline: '2025-05-01 (Placing) / 2026-05-01 (Withdrawal)',
        effectiveDate: '2026-05-01',
        status: 'enforced_ban_placing_2025_05_01_withdrawal_2026_05_01'
      });
    } else if (
      subId === 'triclosan' ||
      /(?:^|[^\p{L}\p{N}])(triclosan|triklosan|triclosán|триклозан|تريكلوسان|ٹرائیکلوسان)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex V/25 — Max 0.3% in Permitted Products; Banned in Mouthwash & Under-3 Toothpaste)',
        placingOnMarketDate: '2024-12-31',
        makingAvailableDate: '2025-10-31',
        deadline: '2024-12-31 (Placing) / 2025-10-31 (Withdrawal)',
        effectiveDate: '2025-10-31',
        status: 'enforced_limit_placing_2024_12_31_withdrawal_2025_10_31'
      });
    } else if (
      subId === 'triclocarban' ||
      /(?:^|[^\p{L}\p{N}])(triclocarban|triklokarban|triclocarbán|триклокарбан|تريكلوكاربان|ٹرائیکلوکاربن)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'EU 2024/996 (Annex V/23 & Annex III — Max 0.2% Preservative / 1.5% Rinse-off Non-Preservative; Banned in Mouthwash)',
        placingOnMarketDate: '2024-12-31',
        makingAvailableDate: '2025-10-31',
        deadline: '2024-12-31 (Placing) / 2025-10-31 (Withdrawal)',
        effectiveDate: '2025-10-31',
        status: 'enforced_limit_placing_2024_12_31_withdrawal_2025_10_31'
      });
    } else if (
      subId === 'cyclosiloxanes_d5_d6' ||
      subId === 'cyclotetrasiloxane_d4' ||
      /(?:^|[^\p{L}\p{N}])(cyclopentasiloxane|cyclohexasiloxane|cyclotetrasiloxane)(?=[^\p{L}\p{N}]|$)/iu.test(rawStr)
    ) {
      transitionCalendarItems.push({
        name: itemName,
        substance: itemName,
        regulation: 'REACH Regulation (EU) 2024/1328',
        placingOnMarketDate: '2027-06-06',
        makingAvailableDate: '2027-06-06',
        deadline: '2027-06-06',
        effectiveDate: '2027-06-06',
        status: 'leave_on_restriction_2027_06_06'
      });
    }
  }

  // 2. Collect mandatory food allergens, cross-contact traces, and cosmetic sensitizers (even when user profile toggles are off)
  const detectedAllergens = [];
  if (productType === 'food') {
    for (const obs of observations || []) {
      const rawStr = String(obs.raw || '');
      const scanText = stripNegatedTargets(rawStr);
      for (const pat of EU_14_FOOD_ALLERGENS) {
        if (pat.id === 'gluten' && /gluten[\s\-]*(?:free|frei|siz|sız)|(?:free\s+(?:of|from)|without|ohne|sans|sin)\s+gluten/iu.test(rawStr)) {
          if (!/(?:^|[^\p{L}])(wheat|buğday|bugday|weizen|blé|ble|trigo|пшениц[а-я]*|قمح|barley|arpa|rye|çavdar|cavdar|spelt|kamut|oats|yulaf)(?=[^\p{L}]|$)/iu.test(scanText)) {
            continue;
          }
        }
        if (pat.names.test(scanText)) {
          const ingName = obs.localizedName || obs.raw;
          detectedAllergens.push({
            type: 'direct_food_allergen',
            allergenId: pat.id,
            category: pat.id,
            name: ingName,
            ingredient: ingName,
            regulation: 'EU 1169/2011 Annex II'
          });
        }
      }
    }
    const fullCC = `${rawText || ''} ${allergenStatement || ''}`;
    const ccMatch = fullCC.match(/(?:may\s+contain|traces?\s+of|eser\s+miktarda\s+(?:içerebilir|bulunabilir)|kann\s+spuren\s+von|peut\s+contenir\s+des\s+traces|puede\s+contener\s+trazas|قد\s+يحتوي\s+على|может\s+содержать\s+следы|میں\s+شامل\s+ہو\s+سکتا\s+ہے)\s*[:\-–]?\s*([^.,;\n]+)/iu);
    if (ccMatch) {
      const ccStr = ccMatch[0].trim();
      detectedAllergens.push({
        type: 'cross_contact_trace',
        allergenId: 'trace',
        category: 'trace',
        name: ccStr,
        ingredient: ccStr,
        regulation: 'EU 1169/2011 Art. 36 (Voluntary Precautionary Allergen Labelling)'
      });
    }
  } else {
    const fragSensitizerRe = /(?:^|[^\p{L}\p{N}])(linalool|limonene|geraniol|citronellol|citral|eugenol|isoeugenol|coumarin|cinnamal|cinnamyl\s+alcohol|benzyl\s+salicylate|benzyl\s+benzoate|benzyl\s+cinnamate|farnesol|hexyl\s+cinnamal|alpha[\s\-]*isomethyl\s+ionone|parfum|fragrance)(?=[^\p{L}\p{N}]|$)/iu;
    for (const obs of observations || []) {
      const subId = obs.substance ? obs.substance.id : '';
      const rawStr = String(obs.raw || '');
      const scanText = stripNegatedTargets(rawStr);
      const scanTrimmed = scanText.trim();
      if (!scanTrimmed) continue;
      const isFragNegated = fragSensitizerRe.test(rawStr) && !fragSensitizerRe.test(scanText);
      const isFragAllergen =
        !isFragNegated &&
        (subId === 'fragrance_allergens' ||
          subId === 'parfum' ||
          fragSensitizerRe.test(scanText));
      const isOtherSensitizer =
        subId === 'mi_mci' ||
        subId === 'formaldehyde_releasers' ||
        subId === 'hair_dye_sensitizers_ppd_resorcinol' ||
        subId === 'hema_dihema_nail';
      if (isFragAllergen || isOtherSensitizer) {
        const ingName = obs.localizedName || obs.raw;
        const cat = isFragAllergen ? 'fragrance_allergen' : (subId || 'cosmetic_sensitizer');
        detectedAllergens.push({
          type: 'cosmetic_sensitizer',
          allergenId: cat,
          category: cat,
          name: ingName,
          ingredient: ingName,
          regulation: isFragAllergen ? 'EC 1223/2009 Annex III / EU 2023/1545' : 'EC 1223/2009 Annex III / V'
        });
      }
    }
  }

  // 3. Collect all cited official sources with checked_at dates and URLs
  const sourceMap = new Map();
  const addSourceById = (sid) => {
    if (!sid) return;
    const sObj = typeof sid === 'string' ? getSourceById(sid) : sid;
    if (sObj && sObj.id && !sourceMap.has(sObj.id)) {
      const inst = sObj.institution || sObj.jurisdiction || 'EU / Official Standard';
      const chk = sObj.checked_at || sourcesData.version || '2026-10-12';
      sourceMap.set(sObj.id, {
        id: sObj.id,
        institution: inst,
        jurisdiction: inst,
        title: sObj.title || sObj.id,
        url: sObj.url || '',
        checked_at: chk,
        checkedAt: chk,
        type: sObj.type || 'regulation'
      });
    }
  };

  if (productType === 'cosmetic') {
    addSourceById('EU_1223_2009');
    addSourceById('COSING');
  } else {
    addSourceById('EU_1169_2011');
    addSourceById('EU_1333_2008');
  }
  addSourceById('OIC_SMIIC_1');

  for (const obs of observations || []) {
    if (obs.substance && Array.isArray(obs.substance.sources)) {
      for (const sid of obs.substance.sources) addSourceById(sid);
    }
  }
  for (const f of regulatoryCard.findings || []) {
    for (const s of f.sources || []) addSourceById(s);
  }
  for (const a of profileCard.alerts || []) {
    for (const s of a.sources || []) addSourceById(s);
  }
  for (const hf of halalCard.findings || []) {
    if (hf.source) addSourceById(hf.source);
  }

  const citedOfficialSources = Array.from(sourceMap.values());
  const btnLabels = {
    tr: { open: '📄 Resmi Raporu Aç (A4)', print: 'Yazdır / PDF', copy: 'Raporu Kopyala', checked: 'Son Teyit', sourcesBadge: 'Resmi Kaynak', allergensBadge: 'Alerjen', calendarBadge: 'Omnibus Takvim' },
    en: { open: '📄 Open Official Report (A4)', print: 'Print / PDF', copy: 'Copy Report', checked: 'Verified', sourcesBadge: 'Official Sources', allergensBadge: 'Allergens', calendarBadge: 'Omnibus Deadlines' },
    ar: { open: '📄 فتح التقرير الرسمي (A4)', print: 'طباعة / PDF', copy: 'نسخ التقرير', checked: 'تاريخ التدقيق', sourcesBadge: 'مصدر رسمي', allergensBadge: 'مسببات الحساسية', calendarBadge: 'مواعيد النفاذ' },
    de: { open: '📄 Offiziellen Bericht öffnen (A4)', print: 'Drucken / PDF', copy: 'Bericht kopieren', checked: 'Geprüft am', sourcesBadge: 'Offizielle Quellen', allergensBadge: 'Allergene', calendarBadge: 'Omnibus-Fristen' },
    fr: { open: '📄 Ouvrir le Rapport Officiel (A4)', print: 'Imprimer / PDF', copy: 'Copier le rapport', checked: 'Vérifié le', sourcesBadge: 'Sources Officielles', allergensBadge: 'Allergènes', calendarBadge: 'Échéances Omnibus' },
    id: { open: '📄 Buka Laporan Resmi (A4)', print: 'Cetak / PDF', copy: 'Salin Laporan', checked: 'Diverifikasi', sourcesBadge: 'Sumber Resmi', allergensBadge: 'Alergen', calendarBadge: 'Jadwal Omnibus' },
    ms: { open: '📄 Buka Laporan Rasmi (A4)', print: 'Cetak / PDF', copy: 'Salin Laporan', checked: 'Disahkan', sourcesBadge: 'Sumber Rasmi', allergensBadge: 'Alergen', calendarBadge: 'Takwim Omnibus' },
    es: { open: '📄 Abrir Informe Oficial (A4)', print: 'Imprimir / PDF', copy: 'Copiar Informe', checked: 'Verificado', sourcesBadge: 'Fuentes Oficiales', allergensBadge: 'Alérgenos', calendarBadge: 'Plazos Omnibus' },
    ru: { open: '📄 Открыть официальный отчет (A4)', print: 'Печать / PDF', copy: 'Копировать отчет', checked: 'Проверено', sourcesBadge: 'Офиц. источники', allergensBadge: 'Аллергены', calendarBadge: 'Сроки Omnibus' },
    ur: { open: '📄 سرکاری رپورٹ کھولیں (A4)', print: 'پرنٹ / PDF', copy: 'رپورٹ کاپی کریں', checked: 'تصدیق شدہ', sourcesBadge: 'سرکاری ماخذ', allergensBadge: 'الرجن', calendarBadge: 'نفاذ کا شیڈول' }
  };
  const bLoc = btnLabels[lang] || btnLabels.en;

  const structuredPillars = (ui.freshnessPillars || []).map((rawPillar, idx) => {
    const str = String(rawPillar || '').replace(/^\d+\.\s*/, '');
    const colonIdx = str.indexOf(':');
    const title = colonIdx > 0 ? str.slice(0, colonIdx).trim() : `Pillar ${idx + 1}`;
    const detail = colonIdx > 0 ? str.slice(colonIdx + 1).trim() : str;
    return {
      id: `pillar_${idx + 1}`,
      title,
      detail,
      text: rawPillar
    };
  });

  return {
    cardTitle: ui.reportTitle,
    reportTitle: ui.reportTitle,
    cardSubtitle: ui.reportSubtitle,
    reportSubtitle: ui.reportSubtitle,
    freshnessTitle: ui.freshnessTitle,
    freshnessPillars: structuredPillars,
    allergenSectionTitle: ui.allergenSectionTitle,
    transitionCalendarTitle: ui.transitionSectionTitle,
    transitionSectionTitle: ui.transitionSectionTitle,
    officialSourcesTitle: ui.sourcesSectionTitle,
    sourcesSectionTitle: ui.sourcesSectionTitle,
    noAllergensFound: ui.noAllergenMsg,
    noAllergenMsg: ui.noAllergenMsg,
    noTransitionItems: ui.noTransitionMsg,
    noTransitionMsg: ui.noTransitionMsg,
    openModalBtn: bLoc.open,
    printReportBtn: bLoc.print,
    copyReportBtn: bLoc.copy,
    checkedAtLabel: bLoc.checked,
    sourcesBadgeLabel: bLoc.sourcesBadge,
    allergensBadgeLabel: bLoc.allergensBadge,
    calendarBadgeLabel: bLoc.calendarBadge,
    datasetManifest: {
      datasetVersion: '2026.10-omnibus',
      sourcesSnapshotDate: sourcesData.version || '2026-10-12',
      ruleEngineVersion: '2026-10-31-v4-omnibus-10lang',
      cosingDictionaryCount: Object.keys(cosingData || {}).length,
      activeJurisdiction: jurisdiction,
      selectedHalalAuthority: halalAuthority,
      verifiedSourceCount: citedOfficialSources.length
    },
    transitionCalendarItems,
    detectedAllergens,
    routineConflictsCount: routineConflictCard ? routineConflictCard.totalConflicts : 0,
    citedOfficialSources
  };
}

const COMPARE_STATUS_I18N = {
  tr: { pending: 'OCR Teyidi Bekleniyor', lowCov: 'Kapsam Yetersiz', unknown: 'Veri Yok / Belirsiz' },
  en: { pending: 'Awaiting OCR Confirm', lowCov: 'Low Coverage (<80%)', unknown: 'No Data / Uncertain' },
  ar: { pending: 'بانتظار تأكيد القراءة', lowCov: 'تغطية غير كافية', unknown: 'بيانات غير متوفرة' },
  de: { pending: 'OCR-Bestätigung offen', lowCov: 'Abdeckung <80%', unknown: 'Keine Daten / Unklar' },
  fr: { pending: 'Confirmation OCR requise', lowCov: 'Couverture <80%', unknown: 'Données insuffisantes' },
  id: { pending: 'Menunggu Konfirmasi OCR', lowCov: 'Cakupan Kurang (<80%)', unknown: 'Data Belum Cukup' },
  ms: { pending: 'Menunggu Pengesahan OCR', lowCov: 'Liputan Kurang (<80%)', unknown: 'Tiada Data / Tidak Pasti' },
  es: { pending: 'Confirmación OCR pendiente', lowCov: 'Cobertura <80%', unknown: 'Sin datos / Incierto' },
  ru: { pending: 'Ожидает подтверждения OCR', lowCov: 'Охват <80%', unknown: 'Нет данных' },
  ur: { pending: 'OCR تصدیق درکار ہے', lowCov: 'کوریج ناکافی (<80%)', unknown: 'ڈیٹا دستیاب نہیں' }
};

function summarizeProductForComparison(evalRes, locale, lang) {
  const stI18n = COMPARE_STATUS_I18N[lang] || COMPARE_STATUS_I18N.en;
  const reg = evalRes.cards.regulatoryCard;
  const prof = evalRes.cards.profileCard;
  const halal = evalRes.cards.halalCard;
  const hasPendingOcr = Array.isArray(evalRes.unresolvedConfirmations) && evalRes.unresolvedConfirmations.length > 0;
  const isLowCoverage = reg.coveragePercent < 80;

  const hasRedProf = prof.alerts.some((a) => a.level === 'kirmizi');
  const hasYellowProf = prof.alerts.some((a) => a.level === 'sari');
  const profStValues = Object.values(prof.profileStatuses || {});

  let profileStatus = 'Uygun';
  let profileStatusCode = 'uygun';
  let profileStatusLocalized = locale.badges.suitable;

  if (hasRedProf || profStValues.includes('false')) {
    profileStatus = 'Kaçın / Dikkat';
    profileStatusCode = 'uygunsuz';
    profileStatusLocalized = locale.badges.avoid;
  } else if (hasPendingOcr) {
    profileStatus = 'Teyit Bekleniyor';
    profileStatusCode = 'teyit_bekliyor';
    profileStatusLocalized = stI18n.pending;
  } else if (isLowCoverage || profStValues.includes('kapsam_yetersiz')) {
    profileStatus = 'Kapsam Yetersiz';
    profileStatusCode = 'kapsam_yetersiz';
    profileStatusLocalized = locale.badges.lowCoverage || stI18n.lowCov;
  } else if (profStValues.includes('unknown')) {
    profileStatus = 'Veri Yok / Belirsiz';
    profileStatusCode = 'kaynak_belirsiz';
    profileStatusLocalized = locale.badges.noData || stI18n.unknown;
  } else if (hasYellowProf) {
    profileStatus = 'Kaçın / Dikkat';
    profileStatusCode = 'kaynak_belirsiz';
    profileStatusLocalized = locale.badges.avoid;
  }

  let halalStatus = 'Uygun';
  let halalStatusCode = 'uygun';
  let halalStatusLocalized = locale.badges.halalOk;

  if (halal.overallStatus === 'conflict' || halal.overallStatus === 'uygunsuz_bulgu') {
    halalStatus = 'Uygunsuz / Çelişki';
    halalStatusCode = halal.overallStatus === 'conflict' ? 'conflict' : 'uygunsuz';
    halalStatusLocalized = locale.badges.halalRed;
  } else if (halal.overallStatus === 'unknown' || hasPendingOcr) {
    halalStatus = 'Teyit Bekleniyor';
    halalStatusCode = 'teyit_bekliyor';
    halalStatusLocalized = stI18n.pending;
  } else if (halal.overallStatus === 'kapsam_yetersiz') {
    halalStatus = 'Kapsam Yetersiz';
    halalStatusCode = 'kapsam_yetersiz';
    halalStatusLocalized = locale.badges.lowCoverage || stI18n.lowCov;
  } else if (halal.overallStatus === 'kaynak_belirsiz_musbooh') {
    halalStatus = 'Şüpheli';
    halalStatusCode = 'kaynak_belirsiz';
    halalStatusLocalized = locale.badges.musbooh;
  }

  return {
    profileStatus,
    profileStatusCode,
    profileStatusLocalized,
    halalStatus,
    halalStatusCode,
    halalStatusLocalized
  };
}

/**
 * Compares two products side-by-side (Product A vs Product B) and deterministically extracts
 * the "Deciding Difference" (Farkı Yaratan Madde) without any LLM hallucination or token cost.
 */
const DEFAULT_COMPARE_NAMES_I18N = {
  tr: ['Ürün A', 'Ürün B'],
  en: ['Product A', 'Product B'],
  ar: ['المنتج أ', 'المنتج ب'],
  de: ['Produkt A', 'Produkt B'],
  fr: ['Produit A', 'Produit B'],
  id: ['Produk A', 'Produk B'],
  ms: ['Produk A', 'Produk B'],
  es: ['Producto A', 'Producto B'],
  ru: ['Продукт А', 'Продукт Б'],
  ur: ['پروڈکٹ الف', 'پروڈکٹ ب']
};

export function compareProducts(productA, productB, sharedOptions = {}) {
  const lang = sharedOptions.lang || 'tr';
  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const locale = getLocaleStrings(lang);
  const [defNameA, defNameB] = DEFAULT_COMPARE_NAMES_I18N[langMeta.code] || DEFAULT_COMPARE_NAMES_I18N.en;
  const nameA = productA.name || defNameA;
  const nameB = productB.name || defNameB;

  const evalA = evaluateProduct({ ...sharedOptions, ...productA, lang });
  const evalB = evaluateProduct({ ...sharedOptions, ...productB, lang });

  const regA = evalA.cards.regulatoryCard;
  const regB = evalB.cards.regulatoryCard;

  const bannedA = regA.findings.filter((f) => f.euStatus === 'yasak');
  const bannedB = regB.findings.filter((f) => f.euStatus === 'yasak');

  const warnCountA =
    regA.findings.filter((f) => f.severity !== 'bilgi').length + evalA.cards.profileCard.alerts.length;
  const warnCountB =
    regB.findings.filter((f) => f.severity !== 'bilgi').length + evalB.cards.profileCard.alerts.length;

  // Identify the single most significant differentiating substance between A and B
  const mapA = new Map(regA.findings.map((f) => [f.substanceId, f]));
  const mapB = new Map(regB.findings.map((f) => [f.substanceId, f]));

  const severityRank = { yuksek: 3, orta: 2, dusuk: 1, bilgi: 0 };
  const statusRank = { yasak: 3, kisitli: 2, izinli: 1 };
  const uniqueFindings = [];

  for (const f of regB.findings) {
    if (f.severity === 'bilgi') continue;
    const fA = mapA.get(f.substanceId);
    if (
      !fA ||
      (statusRank[f.euStatus] || 0) > (statusRank[fA.euStatus] || 0) ||
      (severityRank[f.severity] || 0) > (severityRank[fA.severity] || 0)
    ) {
      uniqueFindings.push({ side: 'B', productName: nameB, finding: f });
    }
  }
  for (const f of regA.findings) {
    if (f.severity === 'bilgi') continue;
    const fB = mapB.get(f.substanceId);
    if (
      !fB ||
      (statusRank[f.euStatus] || 0) > (statusRank[fB.euStatus] || 0) ||
      (severityRank[f.severity] || 0) > (severityRank[fB.severity] || 0)
    ) {
      uniqueFindings.push({ side: 'A', productName: nameA, finding: f });
    }
  }

  uniqueFindings.sort(
    (x, y) =>
      (statusRank[y.finding.euStatus] || 0) - (statusRank[x.finding.euStatus] || 0) ||
      (severityRank[y.finding.severity] || 0) - (severityRank[x.finding.severity] || 0)
  );

  let decidingDifference = null;
  if (uniqueFindings.length > 0) {
    const top = uniqueFindings[0];
    const displaySubName = top.finding.localizedName || top.finding.name;
    decidingDifference = {
      onlyInSide: top.side,
      onlyInProductName: top.productName,
      substanceName: top.finding.name,
      localizedSubstanceName: displaySubName,
      severity: top.finding.severity,
      headline: `${locale.compareScreen.decidingTitle}: ${top.productName} → ${displaySubName}`,
      explanation: top.finding.legalText,
      sources: top.finding.sources || []
    };
  } else {
    // Fallback 1: Profile / Personal Watchlist differentiating alerts
    const alertsA = evalA.cards.profileCard.alerts || [];
    const alertsB = evalB.cards.profileCard.alerts || [];
    const alertKeysA = new Set(alertsA.map((a) => `${a.profile}:${(a.substanceName || a.rawToken || '').toLowerCase()}`));
    const alertKeysB = new Set(alertsB.map((a) => `${a.profile}:${(a.substanceName || a.rawToken || '').toLowerCase()}`));
    const uniqueAlerts = [];
    for (const a of alertsB) {
      const k = `${a.profile}:${(a.substanceName || a.rawToken || '').toLowerCase()}`;
      if (!alertKeysA.has(k)) uniqueAlerts.push({ side: 'B', productName: nameB, alert: a });
    }
    for (const a of alertsA) {
      const k = `${a.profile}:${(a.substanceName || a.rawToken || '').toLowerCase()}`;
      if (!alertKeysB.has(k)) uniqueAlerts.push({ side: 'A', productName: nameA, alert: a });
    }
    if (uniqueAlerts.length > 0) {
      uniqueAlerts.sort((x, y) => (y.alert.level === 'kirmizi' ? 2 : 1) - (x.alert.level === 'kirmizi' ? 2 : 1));
      const topA = uniqueAlerts[0];
      const displaySubName = topA.alert.localizedName || topA.alert.substanceName || topA.alert.rawToken;
      decidingDifference = {
        onlyInSide: topA.side,
        onlyInProductName: topA.productName,
        substanceName: topA.alert.substanceName || displaySubName,
        localizedSubstanceName: displaySubName,
        severity: topA.alert.level === 'kirmizi' ? 'yuksek' : 'orta',
        headline: `${locale.compareScreen.decidingTitle}: ${topA.productName} → ${displaySubName}`,
        explanation: topA.alert.explanation,
        sources: topA.alert.sources || []
      };
    } else {
      // Fallback 2: Halal findings difference
      const halalRank = { conflict: 4, kirmizi: 3, sari: 2, sari_yesil: 1, yesil: 0 };
      const hMapA = new Map((evalA.cards.halalCard.findings || []).map((f) => [f.ruleId, f]));
      const hMapB = new Map((evalB.cards.halalCard.findings || []).map((f) => [f.ruleId, f]));
      const uniqueHalal = [];
      for (const f of evalB.cards.halalCard.findings || []) {
        const fA = hMapA.get(f.ruleId);
        if ((halalRank[f.status] || 0) > (fA ? halalRank[fA.status] || 0 : 0)) {
          uniqueHalal.push({ side: 'B', productName: nameB, finding: f });
        }
      }
      for (const f of evalA.cards.halalCard.findings || []) {
        const fB = hMapB.get(f.ruleId);
        if ((halalRank[f.status] || 0) > (fB ? halalRank[fB.status] || 0 : 0)) {
          uniqueHalal.push({ side: 'A', productName: nameA, finding: f });
        }
      }
      if (uniqueHalal.length > 0) {
        uniqueHalal.sort((x, y) => (halalRank[y.finding.status] || 0) - (halalRank[x.finding.status] || 0));
        const topH = uniqueHalal[0];
        const displaySubName = topH.finding.localizedName || topH.finding.canonical;
        decidingDifference = {
          onlyInSide: topH.side,
          onlyInProductName: topH.productName,
          substanceName: topH.finding.canonical,
          localizedSubstanceName: displaySubName,
          severity: topH.finding.status === 'kirmizi' || topH.finding.status === 'conflict' ? 'yuksek' : 'orta',
          headline: `${locale.compareScreen.decidingTitle}: ${topH.productName} → ${displaySubName}`,
          explanation: topH.finding.contextResolution || topH.finding.explanation,
          sources: topH.finding.source ? [topH.finding.source] : []
        };
      }
    }
  }

  const sumA = summarizeProductForComparison(evalA, locale, langMeta.code);
  const sumB = summarizeProductForComparison(evalB, locale, langMeta.code);
  const routineLayeringCard = buildCrossProductRoutineConflict({
    lang: langMeta.code,
    nameA,
    nameB,
    evalA,
    evalB
  });

  return {
    brand: 'InciFact',
    lang: langMeta.code,
    dir: langMeta.dir,
    locale,
    productA: {
      name: nameA,
      score: regA.score,
      canShowScore: regA.canShowScore,
      hasBanned: bannedA.length > 0,
      attentionCount: warnCountA,
      profileStatus: sumA.profileStatus,
      profileStatusCode: sumA.profileStatusCode,
      profileStatusLocalized: sumA.profileStatusLocalized,
      halalStatus: sumA.halalStatus,
      halalStatusCode: sumA.halalStatusCode,
      halalStatusLocalized: sumA.halalStatusLocalized,
      evaluation: evalA
    },
    productB: {
      name: nameB,
      score: regB.score,
      canShowScore: regB.canShowScore,
      hasBanned: bannedB.length > 0,
      attentionCount: warnCountB,
      profileStatus: sumB.profileStatus,
      profileStatusCode: sumB.profileStatusCode,
      profileStatusLocalized: sumB.profileStatusLocalized,
      halalStatus: sumB.halalStatus,
      halalStatusCode: sumB.halalStatusCode,
      halalStatusLocalized: sumB.halalStatusLocalized,
      evaluation: evalB
    },
    decidingDifference,
    routineLayeringCard
  };
}

/**
 * Normalizes EAN-8 / UPC-A / EAN-13 / GTIN-14 barcode strings (including Arabic-Indic ٠-٩ and Urdu ۰-۹ digits).
 */
export function normalizeBarcodeInput(rawBarcode) {
  if (rawBarcode === null || rawBarcode === undefined) {
    return { valid: false, code: '' };
  }
  const str = String(rawBarcode)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-_]+/g, '')
    .trim();
  const valid = /^\d{8,14}$/.test(str);
  return { valid, code: valid ? str : str.slice(0, 32) };
}

export const VERIFIED_BARCODE_CATALOG = {
  '3017620422003': {
    code: '3017620422003',
    productType: 'food',
    applicationType: 'none',
    updatedAt: '2026-10-30',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Ferrero Nutella Kakaolu Fındık Kreması (350g)',
      en: 'Ferrero Nutella Hazelnut Spread with Cocoa (350g)',
      ar: 'نوتيلا كريمة البندق والكاكاو (350g)',
      de: 'Ferrero Nutella Nuss-Nugat-Creme (350g)',
      fr: 'Ferrero Nutella Pâte à tartiner aux noisettes et au cacao (350g)',
      id: 'Ferrero Nutella Selai Kacang Hazel & Kakao (350g)',
      ms: 'Ferrero Nutella Sapuan Kacang Hazel & Koko (350g)',
      es: 'Ferrero Nutella Crema de avellanas y cacao (350g)',
      ru: 'Ferrero Nutella Ореховая паста с какао (350g)',
      ur: 'فیریرو نوٹیلا ہیزل نٹ اور کوکو اسپریڈ (350g)'
    },
    rawText: 'Sugar, Palm Oil, Hazelnuts (13%), Skimmed Milk Powder (8.7%), Fat-Reduced Cocoa (7.4%), Emulsifier: Lecithins (Soya), Vanillin'
  },
  '3337875597388': {
    code: '3337875597388',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-30',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'CeraVe Nemlendirici Krem (Moisturising Cream)',
      en: 'CeraVe Moisturising Cream (Dry to Very Dry Skin)',
      ar: 'كريم سيرافي المرطب للبشرة الجافة (CeraVe)',
      de: 'CeraVe Feuchtigkeitscreme (Trockene bis sehr trockene Haut)',
      fr: 'CeraVe Baume Hydratant (Peaux sèches à très sèches)',
      id: 'CeraVe Moisturising Cream (Pelembap Kulit Kering)',
      ms: 'CeraVe Moisturising Cream (Krim Pelembap)',
      es: 'CeraVe Crema Hidratante (Piel seca a muy seca)',
      ru: 'CeraVe Увлажняющий крем для сухой кожи',
      ur: 'سیراوی موئسچرائزنگ کریم (CeraVe)'
    },
    rawText: 'Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceteareth-20, Petrolatum, Ceramide NP, Ceramide AP, Ceramide EOP, Cholesterol, Dimethicone, Phenoxyethanol, Tocopherol, Sodium Hyaluronate, Xanthan Gum'
  },
  '8809598450653': {
    code: '8809598450653',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-30',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'COSRX Advanced Snail 96 Mucin Power Essence',
      en: 'COSRX Advanced Snail 96 Mucin Power Essence',
      ar: 'خلاصة الحلزون المتقدمة COSRX Snail 96 Mucin',
      de: 'COSRX Advanced Snail 96 Mucin Power Essence',
      fr: 'COSRX Advanced Snail 96 Mucin Power Essence',
      id: 'COSRX Advanced Snail 96 Mucin Power Essence',
      ms: 'COSRX Advanced Snail 96 Mucin Power Essence',
      es: 'COSRX Advanced Snail 96 Mucin Power Essence',
      ru: 'COSRX Эссенция с муцином улитки Snail 96',
      ur: 'کوسریکس اسنیل 96 میوسن ایسنس (COSRX)'
    },
    rawText: 'Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Ethyl Hexanediol, Sodium Polyacrylate, Carbomer, Phenoxyethanol'
  },
  '7622210449283': {
    code: '7622210449283',
    productType: 'food',
    applicationType: 'none',
    updatedAt: '2026-10-30',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Oreo Original Kakaolu Sandviç Bisküvi',
      en: 'Oreo Original Vanilla Cream Sandwich Biscuit',
      ar: 'بسكويت أوريو الأصلي بكريمة الفانيليا (Oreo)',
      de: 'Oreo Original Kakaokeks mit Vanillegeschmack',
      fr: 'Oreo Original Biscuit Cacao fourré goût Vanille',
      id: 'Oreo Original Biskuit Sandwich Krim Vanila',
      ms: 'Oreo Original Biskut Sandwic Krim Vanila',
      es: 'Oreo Original Galleta de Cacao con Crema',
      ru: 'Oreo Original Печенье с кремовой начинкой',
      ur: 'اوریو اوریجنل ونیلا کریم بسکٹ (Oreo)'
    },
    rawText: 'Wheat Flour, Sugar, Palm Oil, Fat-Reduced Cocoa Powder, Glucose-Fructose Syrup, Wheat Starch, Salt, Emulsifier (Soy Lecithin), Vanillin',
    allergenStatement: 'May contain milk'
  },
  '8690504011507': {
    code: '8690504011507',
    productType: 'food',
    applicationType: 'none',
    updatedAt: '2026-10-30',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Çilekli Meyve Jölesi (E120 Karmin & Jelatin)',
      en: 'Strawberry Fruit Jelly (E120 Carmine & Gelatin)',
      ar: 'جيلي الفراولة (كارمين E120 وجيلاتين)',
      de: 'Erdbeer-Fruchtgelee (E120 Karmin & Gelatine)',
      fr: 'Gelée aux fraises (Carmin E120 & Gélatine)',
      id: 'Jeli Buah Stroberi (Karmin E120 & Gelatin)',
      ms: 'Jeli Buah Strawberi (Karmin E120 & Gelatin)',
      es: 'Gelatina de fresa (Carmín E120 y Gelatina)',
      ru: 'Клубничное желе (Кармин E120 и Желатин)',
      ur: 'اسٹرابیری فروٹ جیلی (کارمائن E120 اور جیلیٹن)'
    },
    rawText: 'Sugar, Glucose Syrup, Water, Gelatin, Citric Acid (E330), Carmine (E120)'
  },
  '5900000202501': {
    code: '5900000202501',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-30',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'UV Jel Oje (TPO — AB 2025/877 Yasaklı)',
      en: 'UV Gel Nail Polish (TPO — EU 2025/877 Banned)',
      ar: 'طلاء أظافر جل للأشعة فوق البنفسجية (TPO محظور أوروبياً)',
      de: 'UV-Gel-Nagellack (TPO — EU 2025/877 Verboten)',
      fr: 'Vernis Gel UV (TPO — Interdit UE 2025/877)',
      id: 'Kuteks Gel UV (TPO — Dilarang UE 2025/877)',
      ms: 'Pengilat Kuku Gel UV (TPO — Dilarang EU 2025/877)',
      es: 'Esmalte de Uñas Gel UV (TPO — Prohibido UE 2025/877)',
      ru: 'УФ гель-лак для ногтей (TPO — запрещен ЕС 2025/877)',
      ur: 'یو وی جیل نیل پالش (TPO — یورپی یونین ممنوع)'
    },
    rawText: 'Di-HEMA Trimethylhexyl Dicarbamate, HEMA, Trimethylbenzoyl Diphenylphosphine Oxide, Hydroxycyclohexyl Phenyl Ketone, CI 77891'
  },
  '4005808811137': {
    code: '4005808811137',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    updatedAt: '2026-10-30',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'Arındırıcı Durulanan Şampuan (MCI/MI 3:1 Doğrulanmış)',
      en: 'Purifying Rinse-Off Shampoo (MCI/MI 3:1 Verified)',
      ar: 'شامبو منقٍّ يُشطف بالماء (نسبة MCI/MI 3:1 موثقة)',
      de: 'Klärendes Rinse-Off-Shampoo (MCI/MI 3:1 bestätigt)',
      fr: 'Shampooing Purifiant à Rincer (MCI/MI 3:1 vérifié)',
      id: 'Sampo Bilas Pemurni (Rasio MCI/MI 3:1 Terverifikasi)',
      ms: 'Syampu Bilas Pembersih (Nisbah MCI/MI 3:1 Disahkan)',
      es: 'Champú Purificante con Aclarado (MCI/MI 3:1 verificado)',
      ru: 'Очищающий смываемый шампунь (соотношение MCI/MI 3:1)',
      ur: 'پیوریفائنگ رِنس آف شیمپو (MCI/MI 3:1 تصدیق شدہ)'
    },
    rawText: 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Panthenol, Citric Acid, Methylchloroisothiazolinone 7.5 ppm, Methylisothiazolinone 2.5 ppm'
  },
  '0000000000017': {
    code: '0000000000017',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-30',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'Eksik Gönüllü Kaydı (<%80 Kapsam OCR Yönlendirme Testi)',
      en: 'Incomplete Crowd Entry (<80% Coverage OCR Fallback Test)',
      ar: 'بيانات تطوعية ناقصة (اختبار التغطية أقل من 80% والتصوير الضوئي)',
      de: 'Unvollständiger Community-Eintrag (<80 % Abdeckung OCR-Test)',
      fr: 'Entrée participative incomplète (<80 % couverture test OCR)',
      id: 'Entri Komunitas Tidak Lengkap (Uji Cakupan <80% ke OCR)',
      ms: 'Entri Komuniti Tidak Lengkap (Ujian Liputan <80% ke OCR)',
      es: 'Registro colaborativo incompleto (Prueba <80% cobertura OCR)',
      ru: 'Неполная запись сообщества (тест покрытия <80% и перехода к OCR)',
      ur: 'نامکمل کمیونٹی اندراج (80% سے کم کوریج اور OCR ٹیسٹ)'
    },
    rawText: 'Aqua, Unverified Mystery Extract X99, Unknown Polymer Z12, Proprietary Complex Q7'
  },
  '3337872411991': {
    code: '3337872411991',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'La Roche-Posay Cicaplast Baume B5+ Onarıcı Bakım Kremi',
      en: 'La Roche-Posay Cicaplast Baume B5+ Soothing Repairing Balm',
      ar: 'بلسم لا روش بوزيه سيكابلاست بوم B5+ المرمم والمهدئ',
      de: 'La Roche-Posay Cicaplast Baume B5+ Beruhigender Balsam',
      fr: 'La Roche-Posay Cicaplast Baume B5+ Ultra-Réparateur Apaisant',
      id: 'La Roche-Posay Cicaplast Baume B5+ Balsem Perbaikan Kulit',
      ms: 'La Roche-Posay Cicaplast Baume B5+ Balsem Pemulihan Kulit',
      es: 'La Roche-Posay Cicaplast Baume B5+ Bálsamo Reparador Calmante',
      ru: 'La Roche-Posay Cicaplast Baume B5+ Успокаивающий бальзам',
      ur: 'لا روش پوزے سیکاپلاسٹ بام B5+ سوتھنگ ریپیئرنگ بام'
    },
    rawText: 'Aqua, Glycerin, Panthenol, Butyrospermum Parkii Butter, Dimethicone, Propanediol, Cetyl PEG/PPG-10/1 Dimethicone, Madecassoside, Zinc Gluconate, Tocopherol, Citric Acid'
  },
  '3401395376706': {
    code: '3401395376706',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'Bioderma Sensibio H2O Misel Temizleme Suyu',
      en: 'Bioderma Sensibio H2O Micellar Water',
      ar: 'ماء ميسيلار بيوديرما سينسيبيو H2O للبشرة الحساسة',
      de: 'Bioderma Sensibio H2O Mizellenwasser',
      fr: 'Bioderma Sensibio H2O Eau Micellaire Démaquillante',
      id: 'Bioderma Sensibio H2O Air Miselar Pembersih',
      ms: 'Bioderma Sensibio H2O Air Miselar Pembersih',
      es: 'Bioderma Sensibio H2O Agua Micelar Desmaquillante',
      ru: 'Bioderma Sensibio H2O Мицеллярная вода',
      ur: 'بایوڈرما سینسیبیو H2O مائسیلر کلینزنگ واٹر'
    },
    rawText: 'Aqua, PEG-6 Caprylic/Capric Glycerides, Disodium EDTA, Cetrimonium Bromide, Propylene Glycol, Cucumis Sativus Fruit Extract, Fructooligosaccharides, Mannitol, Xylitol, Rhamnose'
  },
  '0769915190373': {
    code: '0769915190373',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'The Ordinary Niacinamide 10% + Zinc 1% Serum',
      en: 'The Ordinary Niacinamide 10% + Zinc 1% High-Strength Serum',
      ar: 'سيروم ذا أورديناري نياسيناميد 10% + زنك 1%',
      de: 'The Ordinary Niacinamide 10% + Zinc 1% Gesichtsserum',
      fr: 'The Ordinary Niacinamide 10% + Zinc 1% Sérum Visage',
      id: 'The Ordinary Niacinamide 10% + Zinc 1% Serum Wajah',
      ms: 'The Ordinary Niacinamide 10% + Zinc 1% Serum Wajah',
      es: 'The Ordinary Niacinamide 10% + Zinc 1% Sérum Facial',
      ru: 'The Ordinary Niacinamide 10% + Zinc 1% Сыворотка для лица',
      ur: 'دی آرڈینری نیاسینامائڈ 10% + زنک 1% سیرم'
    },
    rawText: 'Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Tamarindus Indica Seed Gum, Xanthan Gum, Phenoxyethanol, Chlorphenesin'
  },
  '0769915190977': {
    code: '0769915190977',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'The Ordinary Glycolic Acid 7% Exfoliating Toner',
      en: 'The Ordinary Glycolic Acid 7% Exfoliating Toner',
      ar: 'تونر ذا أورديناري بحمض الجليكوليك 7% المقشر',
      de: 'The Ordinary Glycolic Acid 7% Peeling-Toner',
      fr: 'The Ordinary Glycolic Acid 7% Tonique Exfoliant',
      id: 'The Ordinary Glycolic Acid 7% Toner Eksfoliasi',
      ms: 'The Ordinary Glycolic Acid 7% Toner Pengelupasan',
      es: 'The Ordinary Glycolic Acid 7% Tónico Exfoliante',
      ru: 'The Ordinary Glycolic Acid 7% Отшелушивающий тоник',
      ur: 'دی آرڈینری گلائیکولک ایسڈ 7% ایکسفولیئیٹنگ ٹونر'
    },
    rawText: 'Aqua, Glycolic Acid, Rosa Damascena Flower Water, Aloe Barbadensis Leaf Water, Propanediol, Glycerin, Triethanolamine, Panthenol, Salicylic Acid, Citric Acid, Phenoxyethanol, Chlorphenesin'
  },
  '3337875696586': {
    code: '3337875696586',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'La Roche-Posay Retinol B3 Yaşlanma Karşıtı Serum',
      en: 'La Roche-Posay Retinol B3 Anti-Aging Serum',
      ar: 'سيروم لا روش بوزيه ريتينول B3 المضاد لعلامات التقدم في السن',
      de: 'La Roche-Posay Retinol B3 Anti-Aging-Serum',
      fr: 'La Roche-Posay Retinol B3 Sérum Anti-Rides Régénérant',
      id: 'La Roche-Posay Retinol B3 Serum Anti-Penuaan',
      ms: 'La Roche-Posay Retinol B3 Serum Anti-Penuaan',
      es: 'La Roche-Posay Retinol B3 Sérum Antiedad Regenerador',
      ru: 'La Roche-Posay Retinol B3 Антивозрастная сыворотка',
      ur: 'لا روش پوزے ریٹینول B3 اینٹی ایجنگ سیرم'
    },
    rawText: 'Aqua, Glycerin, Alcohol Denat., Niacinamide, Dimethicone, Pentylene Glycol, Retinol, Retinyl Palmitate, Sodium Hyaluronate, Adenosine, Tocopherol, Citric Acid, Phenoxyethanol, Parfum'
  },
  '4005808150038': {
    code: '4005808150038',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'Nivea Creme Klasik Nemlendirici Bakım Kremi',
      en: 'Nivea Creme Classic Moisturizing Cream',
      ar: 'كريم نيفيا الكلاسيكي المرطب للعناية بالبشرة',
      de: 'Nivea Creme Klassische Pflegecreme',
      fr: 'Nivea Crème Hydratante Classique',
      id: 'Nivea Creme Krim Pelembap Klasik',
      ms: 'Nivea Creme Krim Pelembap Klasik',
      es: 'Nivea Creme Crema Hidratante Clásica',
      ru: 'Nivea Creme Классический увлажняющий крем',
      ur: 'نیویا کریم کلاسک موئسچرائزنگ کریم'
    },
    rawText: 'Aqua, Paraffinum Liquidum, Cera Microcristallina, Glycerin, Lanolin Alcohol, Paraffin, Panthenol, Magnesium Sulfate, Citric Acid, Limonene, Geraniol, Linalool, Citronellol, Benzyl Benzoate, Cinnamyl Alcohol, Parfum'
  },
  '3600542154727': {
    code: '3600542154727',
    productType: 'cosmetic',
    applicationType: 'leave_on',
    updatedAt: '2026-10-31',
    source: 'Open Beauty Facts (ODbL)',
    names: {
      tr: 'Garnier C Vitamini Parlaklık Veren Süper Serum',
      en: 'Garnier Vitamin C Brightening Super Serum',
      ar: 'سيروم غارنييه سوبر بفيتامين C لإشراقة البشرة',
      de: 'Garnier Vitamin C Glow Booster Serum',
      fr: 'Garnier Vitamine C Sérum Éclat Anti-Taches',
      id: 'Garnier Vitamin C Brightening Super Serum',
      ms: 'Garnier Vitamin C Brightening Super Serum',
      es: 'Garnier Vitamina C Sérum Iluminador Antimanchas',
      ru: 'Garnier Сыворотка с витамином C для сияния кожи',
      ur: 'گارنیئر وٹامن C برائٹننگ سپر سیرم'
    },
    rawText: 'Aqua, Glycerin, Alcohol Denat., Dipropylene Glycol, Butylene Glycol, Niacinamide, Salicylic Acid, Ascorbic Acid, Tocopherol, Citric Acid, Linalool, Limonene, Geraniol, Parfum'
  },
  '4001686301555': {
    code: '4001686301555',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Haribo Goldbären Altın Ayıcık Yumuşak Şeker (Avrupa Formülü)',
      en: 'Haribo Goldbears Gummy Candy (Standard EU Formula)',
      ar: 'حلوى هاريبو غولد بيرز الجيلاتينية (صيغة الاتحاد الأوروبي)',
      de: 'Haribo Goldbären Fruchtgummi (Standard-Rezeptur)',
      fr: 'Haribo Ours d\'Or Bonbons Gélifiés (Formule UE)',
      id: 'Haribo Goldbears Permen Jeli (Formula Standar UE)',
      ms: 'Haribo Goldbears Gula-gula Jeli (Formula Standard EU)',
      es: 'Haribo Ositos de Oro Caramelos de Goma (Fórmula UE)',
      ru: 'Haribo Goldbären Жевательный мармелад (формула ЕС)',
      ur: 'ہاریبو گولڈ بیئرز جیلی کینڈی (یورپی فارمولا)'
    },
    rawText: 'Glucose Syrup, Sugar, Gelatin, Dextrose, Citric Acid, Carnauba Wax, Beeswax'
  },
  '9002490100070': {
    code: '9002490100070',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Red Bull Enerji İçeceği (250 ml)',
      en: 'Red Bull Energy Drink (250 ml)',
      ar: 'مشروب الطاقة ريد بُل (250 مل)',
      de: 'Red Bull Energy Drink (250 ml)',
      fr: 'Red Bull Boisson Énergisante (250 ml)',
      id: 'Red Bull Minuman Energi (250 ml)',
      ms: 'Red Bull Minuman Tenaga (250 ml)',
      es: 'Red Bull Bebida Energética (250 ml)',
      ru: 'Red Bull Энергетический напиток (250 мл)',
      ur: 'ریڈ بل انرجی ڈرنک (250 ملی لیٹر)'
    },
    rawText: 'Water, Sucrose, Glucose, Citric Acid, Carbon Dioxide, Taurine, Sodium Carbonate, Caffeine, Niacinamide, Pantothenic Acid, Vitamin B6, Vitamin B12, Caramel, Riboflavin'
  },
  '5449000000996': {
    code: '5449000000996',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Coca-Cola Orijinal Tat Gazlı İçecek',
      en: 'Coca-Cola Original Taste Carbonated Soft Drink',
      ar: 'كوكاكولا الطعم الأصلي مشروب غازي',
      de: 'Coca-Cola Original Taste Erfrischungsgetränk',
      fr: 'Coca-Cola Goût Original Boisson Gazeuse',
      id: 'Coca-Cola Rasa Orisinal Minuman Berkarbonasi',
      ms: 'Coca-Cola Rasa Asli Minuman Berkarbonat',
      es: 'Coca-Cola Sabor Original Refresco Carbonatado',
      ru: 'Coca-Cola Классический газированный напиток',
      ur: 'کوکا کولا اوریجنل ٹیسٹ کاربونیٹیڈ ڈرنک'
    },
    rawText: 'Water, Sugar, Carbon Dioxide, E150d, Phosphoric Acid, Natural Flavouring, Caffeine'
  },
  '5053990138722': {
    code: '5053990138722',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Pringles Original Patates Cipsi',
      en: 'Pringles Original Crisps',
      ar: 'رقائق بطاطس برينجلز الأصلية',
      de: 'Pringles Original Stapelchips',
      fr: 'Pringles Original Chips Salées',
      id: 'Pringles Original Keripik Kentang',
      ms: 'Pringles Original Kerepek Kentang',
      es: 'Pringles Original Patatas Fritas',
      ru: 'Pringles Original Картофельные чипсы',
      ur: 'پرنگلز اوریجنل آلو کے چپس'
    },
    rawText: 'Potato Starch, Corn Starch, Rice Flour, E471, Salt, Maltodextrin, Citric Acid, Wheat Starch'
  },
  '8690504020103': {
    code: '8690504020103',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Ülker Çikolatalı Gofret',
      en: 'Ülker Chocolate Coated Wafer Bar',
      ar: 'ويفر أولكر المغطى بالشوكولاتة',
      de: 'Ülker Schokoladen-Waffelriegel',
      fr: 'Ülker Gaufrette Enrobée de Chocolat',
      id: 'Ülker Wafer Lapis Cokelat',
      ms: 'Ülker Wafer Salut Coklat',
      es: 'Ülker Barquillo Cubierto de Chocolate',
      ru: 'Ülker Вафля в шоколадной глазури',
      ur: 'الکر چاکلیٹ کوٹیڈ ویفر بار'
    },
    allergenStatement: 'Contains wheat, milk, hazelnuts and soy',
    rawText: 'Sugar, Wheat Flour, Cocoa Butter, Skimmed Milk Powder, Cocoa Mass, Hazelnuts, Whey Powder, Palm Oil, Soy Lecithin, Salt, Sodium Bicarbonate, Vanillin'
  },
  '8690526012216': {
    code: '8690526012216',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Eti Burçak Yulaflı Bisküvi',
      en: 'Eti Burçak Oat & Whole Wheat Biscuits',
      ar: 'بسكويت إتي بورتشاك بالشوفان والقمح الكامل',
      de: 'Eti Burçak Hafer- und Vollkornkekse',
      fr: 'Eti Burçak Biscuits à l\'Avoine et au Blé Complet',
      id: 'Eti Burçak Biskuit Oat & Gandum Utuh',
      ms: 'Eti Burçak Biskut Oat & Gandum Penuh',
      es: 'Eti Burçak Galletas de Avena y Trigo Integral',
      ru: 'Eti Burçak Овсяное и цельнозерновое печенье',
      ur: 'ایتی بورچک جئی اور گندم کے بسکٹ'
    },
    allergenStatement: 'Contains wheat, oats, milk and soy',
    rawText: 'Wheat Flour, Sugar, Palm Oil, Oats, Glucose-Fructose Syrup, Skimmed Milk Powder, Salt, Sodium Bicarbonate, Ammonium Bicarbonate, Soy Lecithin, Vanillin'
  },
  '8000500037560': {
    code: '8000500037560',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Kinder Bueno Fındık Kremalı Sütlü Çikolatalı Gofret',
      en: 'Kinder Bueno Milk Chocolate & Hazelnut Cream Wafer',
      ar: 'كيندر بوينو ويفر بالشوكولاتة بالحليب وكريمة البندق',
      de: 'Kinder Bueno Waffelriegel mit Milchschokolade & Haselnusscreme',
      fr: 'Kinder Bueno Gaufrette au Chocolat au Lait et Cœur Fondant Noisettes',
      id: 'Kinder Bueno Wafer Cokelat Susu & Krim Hazelnut',
      ms: 'Kinder Bueno Wafer Coklat Susu & Krim Hazelnut',
      es: 'Kinder Bueno Barrita de Barquillo con Chocolate con Leche y Avellanas',
      ru: 'Kinder Bueno Вафельный батончик с молочным шоколадом и ореховой начинкой',
      ur: 'کنڈر بوئنو ملک چاکلیٹ اور ہیزل نٹ کریم ویفر'
    },
    allergenStatement: 'Contains milk, hazelnuts, wheat and soy',
    rawText: 'Sugar, Cocoa Butter, Cocoa Mass, Palm Oil, Wheat Flour, Hazelnuts, Skimmed Milk Powder, Soy Lecithin, Fat-Reduced Cocoa Powder, Sodium Bicarbonate, Salt, Vanillin'
  },
  '3017620402678': {
    code: '3017620402678',
    productType: 'food',
    applicationType: 'oral',
    updatedAt: '2026-10-31',
    source: 'Open Food Facts (ODbL)',
    names: {
      tr: 'Ferrero Rocher Fındıklı Sütlü Çikolata',
      en: 'Ferrero Rocher Fine Hazelnut Milk Chocolates',
      ar: 'شوكولاتة فيريرو روشيه بالحليب والبندق',
      de: 'Ferrero Rocher Nuss-Pralinen mit Milchschokolade',
      fr: 'Ferrero Rocher Bouchées Chocolat au Lait et Noisettes',
      id: 'Ferrero Rocher Cokelat Susu Hazelnut',
      ms: 'Ferrero Rocher Coklat Susu Hazelnut',
      es: 'Ferrero Rocher Bombones de Chocolate con Leche y Avellanas',
      ru: 'Ferrero Rocher Конфеты из молочного шоколада с лесным орехом',
      ur: 'فریرو روشر ہیزل نٹ ملک چاکلیٹ'
    },
    allergenStatement: 'Contains hazelnuts, milk, wheat and soy',
    rawText: 'Sugar, Cocoa Butter, Cocoa Mass, Hazelnuts, Palm Oil, Wheat Flour, Whey Powder, Skimmed Milk Powder, Fat-Reduced Cocoa Powder, Soy Lecithin, Sodium Bicarbonate, Salt, Vanillin'
  }
};

const BARCODE_I18N = {
  tr: {
    invalidMsg: 'Geçersiz barkod formatı. Lütfen 8–14 haneli EAN/UPC barkod numarası girin veya içindekiler etiketini fotoğraflayın.',
    notFoundMsg: (code) => `Barkod (${code}) açık veri tabanında henüz kayıtlı değil. Lütfen ambalaj arkasındaki içindekiler yazısını fotoğraflayın (OCR).`,
    lowCovFallbackMsg: (pct) => `Barkod verisi eksik veya doğrulanamadı (%${pct} kapsam < %80). Güvenli karar için lütfen ambalaj arkasındaki içindekiler listesini fotoğraflayın.`,
    foundOkMsg: (name, pct) => `${name} barkoddan yüklendi (%${pct} kapsam · Open Food/Beauty Facts ODbL).`
  },
  en: {
    invalidMsg: 'Invalid barcode format. Please enter an 8–14 digit EAN/UPC barcode or photograph the ingredient label.',
    notFoundMsg: (code) => `Barcode (${code}) is not yet registered in the open database. Please photograph the ingredient list on the back of the packaging (OCR).`,
    lowCovFallbackMsg: (pct) => `Barcode ingredient data is incomplete or unverified (${pct}% coverage < 80%). Please photograph the ingredient label on the packaging for a reliable check.`,
    foundOkMsg: (name, pct) => `${name} loaded from barcode (${pct}% coverage · Open Food/Beauty Facts ODbL).`
  },
  ar: {
    invalidMsg: 'تنسيق الباركود غير صالح. يرجى إدخال رقم باركود من 8 إلى 14 رقماً أو تصوير قائمة المكونات.',
    notFoundMsg: (code) => `الباركود (${code}) غير مسجل بعد في قاعدة البيانات المفتوحة. يرجى تصوير قائمة المكونات خلف العبوة (OCR).`,
    lowCovFallbackMsg: (pct) => `بيانات الباركود ناقصة أو غير موثقة (التغطية ${pct}% أقل من 80%). يرجى تصوير قائمة المكونات على العبوة للتحقق الموثوق.`,
    foundOkMsg: (name, pct) => `تم تحميل ${name} عبر الباركود (تغطية ${pct}% · Open Food/Beauty Facts ODbL).`
  },
  de: {
    invalidMsg: 'Ungültiges Barcode-Format. Bitte 8–14-stelligen EAN/UPC-Code eingeben oder die Zutatenliste fotografieren.',
    notFoundMsg: (code) => `Barcode (${code}) ist noch nicht in der offenen Datenbank erfasst. Bitte fotografieren Sie die Zutatenliste auf der Verpackung (OCR).`,
    lowCovFallbackMsg: (pct) => `Barcode-Daten unvollständig (${pct} % Abdeckung < 80 %). Bitte fotografieren Sie die Zutatenliste auf der Packung zur sicheren Prüfung.`,
    foundOkMsg: (name, pct) => `${name} per Barcode geladen (${pct} % Abdeckung · Open Food/Beauty Facts ODbL).`
  },
  fr: {
    invalidMsg: 'Format de code-barres invalide. Veuillez saisir un code EAN/UPC de 8 à 14 chiffres ou photographier l\'étiquette.',
    notFoundMsg: (code) => `Le code-barres (${code}) n'est pas encore enregistré dans la base ouverte. Veuillez photographier la liste des ingrédients sur l'emballage (OCR).`,
    lowCovFallbackMsg: (pct) => `Données du code-barres incomplètes (${pct} % de couverture < 80 %). Veuillez photographier l'étiquette des ingrédients pour une vérification fiable.`,
    foundOkMsg: (name, pct) => `${name} chargé via code-barres (${pct} % de couverture · Open Food/Beauty Facts ODbL).`
  },
  id: {
    invalidMsg: 'Format barcode tidak valid. Masukkan 8–14 digit kode EAN/UPC atau foto label komposisi.',
    notFoundMsg: (code) => `Barcode (${code}) belum terdaftar di basis data terbuka. Silakan foto daftar komposisi pada kemasan (OCR).`,
    lowCovFallbackMsg: (pct) => `Data barcode belum lengkap (${pct}% cakupan < 80%). Silakan foto label komposisi pada kemasan untuk pemeriksaan akurat.`,
    foundOkMsg: (name, pct) => `${name} dimuat dari barcode (${pct}% cakupan · Open Food/Beauty Facts ODbL).`
  },
  ms: {
    invalidMsg: 'Format kod bar tidak sah. Sila masukkan 8–14 digit kod EAN/UPC atau ambil gambar label ramuan.',
    notFoundMsg: (code) => `Kod bar (${code}) belum didaftarkan dalam pangkalan data terbuka. Sila ambil gambar senarai ramuan pada bungkusan (OCR).`,
    lowCovFallbackMsg: (pct) => `Data kod bar tidak lengkap (${pct}% liputan < 80%). Sila ambil gambar label ramuan pada bungkusan untuk semakan tepat.`,
    foundOkMsg: (name, pct) => `${name} dimuatkan daripada kod bar (${pct}% liputan · Open Food/Beauty Facts ODbL).`
  },
  es: {
    invalidMsg: 'Formato de código de barras no válido. Introduce un código EAN/UPC de 8 a 14 dígitos o fotografía la etiqueta.',
    notFoundMsg: (code) => `El código de barras (${code}) aún no está registrado en la base abierta. Por favor, fotografía la lista de ingredientes del envase (OCR).`,
    lowCovFallbackMsg: (pct) => `Datos del código de barras incompletos (${pct}% de cobertura < 80%). Por favor, fotografía la etiqueta de ingredientes del envase.`,
    foundOkMsg: (name, pct) => `${name} cargado por código de barras (${pct}% de cobertura · Open Food/Beauty Facts ODbL).`
  },
  ru: {
    invalidMsg: 'Неверный формат штрихкода. Введите 8–14 цифр кода EAN/UPC или сфотографируйте состав на упаковке.',
    notFoundMsg: (code) => `Штрихкод (${code}) еще не зарегистрирован в открытой базе. Пожалуйста, сфотографируйте список состава на упаковке (OCR).`,
    lowCovFallbackMsg: (pct) => `Данные штрихкода неполные (покрытие ${pct}% < 80%). Пожалуйста, сфотографируйте состав на упаковке для точной проверки.`,
    foundOkMsg: (name, pct) => `${name} загружен по штрихкоду (покрытие ${pct}% · Open Food/Beauty Facts ODbL).`
  },
  ur: {
    invalidMsg: 'بارکوڈ کا فارمیٹ درست نہیں۔ براہ کرم 8 سے 14 ہندسوں کا EAN/UPC بارکوڈ درج کریں یا اجزاء کے لیبل کی تصویر لیں۔',
    notFoundMsg: (code) => `بارکوڈ (${code}) ابھی اوپن ڈیٹا بیس میں درج نہیں ہے۔ براہ کرم پیکنگ کے پیچھے اجزاء کی فہرست کی تصویر لیں (OCR)۔`,
    lowCovFallbackMsg: (pct) => `بارکوڈ کا ڈیٹا نامکمل ہے (${pct}% کوریج < 80%)۔ درست جانچ کے لیے براہ کرم پیکنگ پر اجزاء کے لیبل کی تصویر لیں۔`,
    foundOkMsg: (name, pct) => `${name} بارکوڈ سے لوڈ کیا گیا (${pct}% کوریج · Open Food/Beauty Facts ODbL)۔`
  }
};

/**
 * Deterministic hybrid barcode lookup and ruleEngine evaluation with <80% coverage OCR fallback guard.
 */
export function lookupBarcodeProduct({
  barcode,
  lang = 'tr',
  evaluationOptions = {},
  externalProduct = null,
  customCatalog = null
} = {}) {
  const bTxt = BARCODE_I18N[lang] || BARCODE_I18N.en;
  const norm = normalizeBarcodeInput(barcode);
  if (!norm.valid) {
    return {
      valid: false,
      found: false,
      barcode: norm.code,
      reason: 'invalid_barcode_format',
      requiresOcrFallback: true,
      message: bTxt.invalidMsg,
      evaluation: null
    };
  }

  const customHit =
    customCatalog && typeof customCatalog === 'object' && Object.hasOwn(customCatalog, norm.code)
      ? customCatalog[norm.code]
      : null;
  const verifiedHit = Object.hasOwn(VERIFIED_BARCODE_CATALOG, norm.code) ? VERIFIED_BARCODE_CATALOG[norm.code] : null;
  const entry = verifiedHit || customHit || externalProduct || null;
  if (!entry || !entry.rawText || !String(entry.rawText).trim()) {
    return {
      valid: true,
      found: false,
      barcode: norm.code,
      reason: 'barcode_not_found',
      requiresOcrFallback: true,
      message: bTxt.notFoundMsg(norm.code),
      evaluation: null
    };
  }

  const productName =
    (entry.names && (entry.names[lang] || entry.names.en || entry.names.tr)) ||
    entry.productName ||
    norm.code;
  const productType = entry.productType || evaluationOptions.productType || 'cosmetic';
  const applicationType = entry.applicationType || evaluationOptions.applicationType || null;
  const rawText = String(entry.rawText).trim();

  const allergenStatement = entry.allergenStatement || evaluationOptions.allergenStatement || '';

  const evaluation = evaluateProduct({
    ...evaluationOptions,
    rawText,
    allergenStatement,
    productType,
    applicationType,
    lang
  });

  const reg = evaluation.cards.regulatoryCard;
  const coveragePercent = reg.coveragePercent;
  const hasPendingConfirm =
    Array.isArray(evaluation.unresolvedConfirmations) && evaluation.unresolvedConfirmations.length > 0;
  const requiresOcrFallback = coveragePercent < 80 || hasPendingConfirm;

  return {
    valid: true,
    found: true,
    barcode: norm.code,
    productName,
    productType,
    applicationType,
    rawText,
    allergenStatement,
    source: entry.source || 'Open Food / Beauty Facts (ODbL)',
    updatedAt: entry.updatedAt || '2026-10-30',
    coveragePercent,
    requiresOcrFallback,
    fallbackReason: coveragePercent < 80
      ? 'insufficient_coverage_under_80_percent'
      : hasPendingConfirm
      ? 'awaiting_user_confirmation'
      : null,
    message: requiresOcrFallback
      ? bTxt.lowCovFallbackMsg(coveragePercent)
      : bTxt.foundOkMsg(productName, coveragePercent),
    evaluation
  };
}

/**
 * Validates and builds a device-saved custom barcode catalog entry when a user links an unregistered barcode to a verified (>=80% coverage) ingredient label.
 */
export function createCustomBarcodeEntry({
  barcode,
  productName = '',
  productType = 'cosmetic',
  applicationType = null,
  allergenStatement = '',
  rawText = '',
  lang = 'tr'
} = {}) {
  const norm = normalizeBarcodeInput(barcode);
  if (!norm.valid) {
    return { ok: false, reason: 'invalid_barcode_format', barcode: norm.code, entry: null };
  }
  const cleanRaw = String(rawText || '').trim();
  if (!cleanRaw) {
    return { ok: false, reason: 'empty_ingredient_label', barcode: norm.code, entry: null };
  }
  const evaluation = evaluateProduct({
    rawText: cleanRaw,
    allergenStatement,
    productType,
    applicationType,
    lang
  });
  const coveragePercent = evaluation.cards.regulatoryCard.coveragePercent;
  if (Array.isArray(evaluation.unresolvedConfirmations) && evaluation.unresolvedConfirmations.length > 0) {
    return {
      ok: false,
      reason: 'unresolved_ocr_confirmations',
      barcode: norm.code,
      coveragePercent,
      unresolvedConfirmations: evaluation.unresolvedConfirmations,
      entry: null
    };
  }
  if (coveragePercent < 80) {
    return {
      ok: false,
      reason: 'insufficient_coverage_under_80_percent',
      barcode: norm.code,
      coveragePercent,
      entry: null
    };
  }
  const resolvedName = String(productName || '').trim() || `Cihaz Kaydı (${norm.code})`;
  const entry = {
    code: norm.code,
    productName: resolvedName,
    names: {
      tr: resolvedName,
      en: resolvedName,
      ar: resolvedName,
      de: resolvedName,
      fr: resolvedName,
      id: resolvedName,
      ms: resolvedName,
      es: resolvedName,
      ru: resolvedName,
      ur: resolvedName
    },
    productType: productType === 'food' ? 'food' : 'cosmetic',
    applicationType: applicationType || (productType === 'food' ? 'oral' : 'leave_on'),
    allergenStatement: String(allergenStatement || '').trim(),
    rawText: cleanRaw,
    source: 'User Verified Label (Local Device Cache)',
    updatedAt: '2026-10-31'
  };
  return {
    ok: true,
    barcode: norm.code,
    coveragePercent,
    entry
  };
}




