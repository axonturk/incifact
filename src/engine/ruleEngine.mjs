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
  const severity = isBanned ? 'yuksek' : isRestricted ? 'orta' : 'bilgi';
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
      ? `AB Kozmetik Yönetmeliği Ek III kapsamında kısıtlamaya tabi bileşen${annexInfo}.`
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
  const trailingCode = str.match(/^(.+?)\s+([EЕ]\s*[-:]?\s*[0-9]{3,4}[a-f]?)$/iu);
  if (trailingCode) {
    results.push(trailingCode[1].trim(), trailingCode[2].replace(/^[Ее]/u, 'E').replace(/\s+/g, '').toUpperCase());
  }
  const leadingCode = str.match(/^([EЕ]\s*[-:]?\s*[0-9]{3,4}[a-f]?)\s+(.+?)$/iu);
  if (leadingCode) {
    results.push(leadingCode[1].replace(/^[Ее]/u, 'E').replace(/\s+/g, '').toUpperCase(), leadingCode[2].trim());
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
      if (substanceByAlias.has(f) || halalByAlias.has(f) || freeSugarByAlias.has(f) || rapidCarbByAlias.has(f) || (cosingData && cosingData[cosKey])) {
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
      .replace(/\(\s*[%٪]?\s*[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫][\d\u0660-\u0669\u06F0-\u06F9]+)?\s*(?:[%٪]|ppm|mg\s*\/\s*kg)?\s*\)/giu, '')
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

    const parenMatch = cleanedTok.match(/^(.+?)\s*\((.+?)\)$/);
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
        const found = cosingData[cosKey];
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
    let effectiveDetail =
      lang === 'tr'
        ? sub.eu_detail
        : effectiveEuStatus === 'yasak'
        ? et.bannedGeneric
        : effectiveSeverity !== 'bilgi'
        ? et.restrictedGeneric
        : et.permittedGeneric;

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
        effectiveDetail = '(AB) 2026/909 ile Ek II Doğrudan Yasaklılar listesine alınmıştır (1 Ocak 2027 itibarıyla piyasaya arzı yasaktır).';
      } else {
        effectiveEuStatus = 'kisitli';
        effectiveSeverity = 'orta';
        effectiveDetail = 'Geçiş Dönemi Uyarısı (AB 2026/909): SCCS genotoksisite ve endokrin verisi eksikliği gerekçesiyle Ek II listesine eklenmiştir. 1 Ocak 2027\'den itibaren piyasaya arzı yasaktır (Ekim 2026 itibarıyla geçiş dönemindedir).';
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

      const mappedSources = (sub.sources || []).map((sid) => sourcesData.sources[sid]).filter(Boolean);
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
            ? 'AB mevzuatı uyumsuzluğu tespit edildi; Türkiye pazarı için güncel TİTCK / Türk Gıda Kodeksi (TGK) geçiş hükümleri ayrıca teyit edilmelidir.'
            : null,
        legalText: finalLegalText,
        falsePositiveNote: lang === 'tr' ? sub.note : null,
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
      const ruleVal = sub.profiles[prof];
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

      const mappedSources = (sub.sources || []).map((sid) => sourcesData.sources[sid]).filter(Boolean);

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
    const MAJOR_FOOD_ALLERGENS = [
      { id: 'gluten', names: /(?:^|[^\p{L}\p{N}])(wheat|buğday|gluten|flour|un|weizen|farine|trigo|пшениц[а-я]*|دقيق|قمح|arpa|barley|çavdar|rye|oats|yulaf|spelt|kamut)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Gluten / Buğday' },
      { id: 'crustaceans', names: /(?:^|[^\p{L}\p{N}])(crustacean[s]?|kabuklu[lar]*|shrimp|karides|prawn[s]?|crab|yengeç|lobster|ıstakoz|istakoz|crevette[s]?|krabbe[n]?|garnelen|langostinos|mariscos|ракообразн[а-я]*|креветк[а-я]*|قشريات|جھینگا)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Kabuklular' },
      { id: 'egg', names: /(?:^|[^\p{L}\p{N}])(egg[s]?|yumurta|oeuf[s]?|ei|eier|huevo[s]?|uovo|яйц[а-я]*|بيض|انڈہ|انڈے)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yumurta' },
      { id: 'fish', names: /(?:^|[^\p{L}\p{N}])(fish|balık|balik|poisson|fisch|pescado|pesce|рыб[а-я]*|سمك|مچھلی)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Balık' },
      { id: 'peanut', names: /(?:^|[^\p{L}\p{N}])(peanut[s]?|yer\s*fıst[ıi]ğ[ıi]|arachide[s]?|erdnuss|erdnüsse|cacahuete[s]?|cacahuate[s]?|арахис|فول\s+سوداني|مونگ\s*پھلی)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yer Fıstığı' },
      { id: 'soy', names: /(?:^|[^\p{L}\p{N}])(soy|soya|soja|соя|соев[а-я]*|صويا|سویا|sojalecithin|soybean[s]?)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Soya' },
      { id: 'milk', names: /(?:^|[^\p{L}\p{N}])(milk|süt|sut|lait|leche|milch|latte|молок[а-я]*|حليب|دودھ|whey|casein|lactose|laktoz|kazein|peynir\s*altı\s*suyu)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Süt / Süt Ürünleri' },
      { id: 'tree_nuts', names: /(?:^|[^\p{L}\p{N}])(hazelnut[s]?|haseln[üu]ss[e]?|fındık|findik|noisette[s]?|avellana[s]?|фундук|بندق|ہیزل|almond[s]?|badem|mandel[n]?|amande[s]?|almendra[s]?|миндаль|لوز|بادام|walnut[s]?|ceviz|walnuss|noix|nuez|nueces|грецк[а-я]*\s*орех|جوز|اخروٹ|cashew[s]?|kaju|pistachio[s]?|antep\s*fıstığı|fıstık|fistik|fistigi|pecan[s]?|pekan|macadamia)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Sert Kabuklu Yemişler (Fındık/Badem)' },
      { id: 'celery', names: /(?:^|[^\p{L}\p{N}])(celery|kereviz|sellerie|céleri|celeri|apio|sedano|сельдерей|كرفس|اجوائن)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Kereviz' },
      { id: 'mustard', names: /(?:^|[^\p{L}\p{N}])(mustard|hardal|senf|moutarde|mostaza|senape|горчиц[а-я]*|خردل|رائی)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Hardal' },
      { id: 'sesame', names: /(?:^|[^\p{L}\p{N}])(sesame|susam|tahin|tahini|sésame|sesam|sésamo|кунжут|سمسم|تل)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Susam' },
      { id: 'sulphites', names: /(?:^|[^\p{L}\p{N}])(sulphite[s]?|sulfite[s]?|sülfit|sulfit|schwefeldioxid|dioxyde\s+de\s+soufre|dióxido\s+de\s+azufre|диоксид\s+серы|كبريتيت|سلفائٹ|e220|e221|e222|e223|e224|e226|e227|e228)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Sülfitler' },
      { id: 'lupin', names: /(?:^|[^\p{L}\p{N}])(lupin[e]?|ac[ıi]\s*bakla|lüpen|lupini|altramuz|люпин|ترمس|لوپن)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Acıbakla (Lüpen)' },
      { id: 'molluscs', names: /(?:^|[^\p{L}\p{N}])(mollusc[s]?|mollusk[s]?|yumuşakça[lar]*|weichtier[e]?|mollusque[s]?|molusco[s]?|istiridye|midye|kalamar|ahtapot|mussel[s]?|oyster[s]?|squid|octopus|moule[s]?|pulpo|calamar|миди[ия]|кальмар|осьминог|رخويات|صدف)(?=[^\p{L}\p{N}]|$)/iu, tr: 'Yumuşakçalar' }
    ];

    for (const obs of observations) {
      const isCrossContactToken = /(?:may\s+contain|traces?\s+of|eser\s+miktarda|kann\s+spuren|peut\s+contenir|puede\s+contener|قد\s+يحتوي|может\s+содержать|میں\s+شامل)/iu.test(obs.raw);
      if (isCrossContactToken) continue;

      // Scan ONLY the label's own wording. The localized display name comes from a broader data group
      // (e.g. "Buğday Unu") and must never create an allergen that is not on the label.
      // Negation is target-bound: only the negated word is removed ("Milk-free Soy Lecithin" still contains soy).
      const scanText = obs.raw
        .replace(/[\p{L}]+[\s\-]*(?:free|frei)(?=[^\p{L}]|$)/giu, ' ')
        .replace(/(?:free\s+(?:of|from)|without|ohne|sans|sin|senza|tanpa|bebas)\s+[\p{L}]+/giu, ' ')
        .replace(/[\p{L}]+(?:siz|sız|suz|süz)(?=[^\p{L}]|$)/giu, ' ')
        .replace(/[\p{L}]+\s+(?:içermez|icermez|yoktur|bulunmaz)(?=[^\p{L}]|$)/giu, ' ');
      const matchedAllergens = MAJOR_FOOD_ALLERGENS.filter((a) => {
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
          substanceName: aName,
          localizedName: itemLabel,
          rawToken: obs.raw,
          position: obs.position,
          level: 'kirmizi',
          explanation: expFn(aName, itemLabel),
          sources: [sourcesData.sources.EU_1169_2011].filter(Boolean)
        });
      }
    }

    const fullCrossContactText = `${rawText} ${allergenStatement || ''}`;
    const crossContactMatch = fullCrossContactText.match(/(?:may\s+contain|traces?\s+of|eser\s+miktarda\s+(?:içerebilir|bulunabilir)|kann\s+spuren\s+von|peut\s+contenir\s+des\s+traces|puede\s+contener\s+trazas|قد\s+يحتوي\s+على|может\s+содержать\s+следы|میں\s+شامل\s+ہو\s+سکتا\s+ہے)\s*[:\-–]?\s*([^.,;\n]+)/iu);
    if (crossContactMatch) {
      profileStatuses['astim_alerji'] = 'false';
      const rawTraceTarget = crossContactMatch[1].trim();
      const matchedTraceAllergens = MAJOR_FOOD_ALLERGENS.filter((a) => a.names.test(rawTraceTarget));
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
        substanceName: traceI18n.name,
        localizedName: traceI18n.loc,
        rawToken: traceRaw,
        position: observations.length + 1,
        level: 'sari',
        explanation: traceI18n.exp,
        sources: [sourcesData.sources.EU_1169_2011].filter(Boolean)
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
      if (userProfiles.includes('hamilelik')) {
        profileStatuses['hamilelik'] = 'false';
        profileAlerts.push({
          profile: 'hamilelik',
          substanceName: hasCaffeine ? 'Kafein / Enerji Bileşeni' : 'Enerji İçeceği Uyarıcısı (Taurin/İnositol)',
          localizedName: hasCaffeine ? 'Kafein / Enerji Bileşeni' : 'Taurin / İnositol',
          rawToken: hasCaffeine ? 'Caffeine' : 'Taurine/Inositol',
          position: 1,
          level: 'sari',
          explanation: hasCaffeine
            ? 'EFSA Uyarısı: Hamilelik döneminde tüm kaynaklardan günlük toplam kafein alımı 200 mg ile sınırlandırılmalıdır (AB 1169/2011 Ek III).'
            : 'Enerji içeceği uyarıcısı (Taurin/İnositol); hamilelik döneminde dikkatli tüketilmelidir.',
          sources: [sourcesData.sources.EU_1169_2011, sourcesData.sources.EFSA].filter(Boolean)
        });
      }
      if (userProfiles.includes('cocuk_metabolik')) {
        profileStatuses['cocuk_metabolik'] = 'false';
        profileAlerts.push({
          profile: 'cocuk_metabolik',
          substanceName: hasCaffeine ? 'Yüksek Kafein' : 'Enerji İçeceği Uyarıcısı (Taurin/İnositol)',
          localizedName: hasCaffeine ? 'Yüksek Kafein' : 'Taurin / İnositol',
          rawToken: hasCaffeine ? 'Caffeine' : 'Taurine/Inositol',
          position: 1,
          level: hasCaffeine ? 'kirmizi' : 'sari',
          explanation: hasCaffeine
            ? 'AB 1169/2011 Ek III Uyarısı: Yüksek kafein içeriği. Çocuklar için tavsiye edilmez (azami güvenli referans doz 3 mg/kg/gün).'
            : 'Enerji içeceği uyarıcısı (Taurin/İnositol); çocuklar için tavsiye edilmez.',
          sources: [sourcesData.sources.EU_1169_2011, sourcesData.sources.EFSA].filter(Boolean)
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

  function escapeRegexLiteral(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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

  function expandWatchTermStems(watchTerm) {
    const wLower = String(watchTerm || '').trim().toLowerCase();
    const wFold = foldTurkish(wLower);
    const stems = new Set([wLower, wFold].filter(Boolean));
    // Expand known synonyms if the watch term matches a specific single-substance entry (not an umbrella class)
    for (const sub of substancesData.substances || []) {
      if (UMBRELLA_RULE_IDS.has(sub.id)) continue;
      const aliases = Array.isArray(sub.aliases) ? sub.aliases : [];
      const names = [sub.name, sub.e_code, sub.ci_code, ...aliases].filter(Boolean).map((x) => x.toLowerCase());
      if (names.some((n) => n === wLower || foldTurkish(n) === wFold)) {
        for (const n of names) {
          if (n.length >= 3 || n === wLower || foldTurkish(n) === wFold) {
            stems.add(n);
            stems.add(foldTurkish(n));
          }
        }
      }
    }
    for (const hr of halalData.rules || []) {
      if (UMBRELLA_RULE_IDS.has(hr.id) || hr.category === 'SAFE_NON_ETHANOL') continue;
      const aliases = Array.isArray(hr.aliases) ? hr.aliases : [];
      const codes = Array.isArray(hr.codes) ? hr.codes : [];
      const names = [hr.canonical, ...codes, ...aliases].filter(Boolean).map((x) => x.toLowerCase());
      if (names.some((n) => n === wLower || foldTurkish(n) === wFold)) {
        for (const n of names) {
          if (n.length >= 3 || n === wLower || foldTurkish(n) === wFold) {
            stems.add(n);
            stems.add(foldTurkish(n));
          }
        }
      }
    }
    return Array.from(stems).filter((s) => s.length >= 2);
  }

  function isWatchTermNegatedInRaw(rawStr, watchStems) {
    const rawLower = String(rawStr || '').trim().toLowerCase();
    const rawFold = foldTurkish(rawLower);
    for (const stem of watchStems) {
      const esc = escapeRegexLiteral(stem);
      // Suffix negation bound directly to the watched stem (e.g. "Niacinamide-free", "Parfümsüz", "Paraben-free")
      const suffixRe = new RegExp(`(?<![\\p{L}\\p{N}])${esc}[\\s\\-]*(?:free|frei|siz|sız|suz|süz|içermez|icermez)(?![\\p{L}\\p{N}])`, 'iu');
      if (suffixRe.test(rawLower) || suffixRe.test(rawFold)) return true;
      // Prefix negation bound directly to the watched stem (e.g. "without Parfum", "ohne Parfum", "sans parfum", "sin perfume", "بدون عطر")
      const prefixRe = new RegExp(`(?<![\\p{L}\\p{N}])(?:without|no|ohne|sans|sin|tanpa|bebas|free\\s+of|free\\s+from|libre\\s+de|خالي\\s+من|خالٍ\\s+من|بدون|بغیر|без)\\s+${esc}(?![\\p{L}\\p{N}])`, 'iu');
      if (prefixRe.test(rawLower) || prefixRe.test(rawFold)) return true;
    }
    return false;
  }

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
    for (const obs of observations) {
      const rawFull = String(obs.raw || '').trim().toLowerCase();
      const rawBase = rawFull.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const normRaw = normalizeToken(obs.raw || '');
      const normBase = normalizeToken(rawBase);
      const foldedRaw = foldTurkish(obs.raw || '');
      const foldBase = foldTurkish(rawBase);
      const locLower = String(obs.localizedName || '').trim().toLowerCase();
      const locBase = locLower.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const isUmbrellaSub = Boolean(obs.substance && UMBRELLA_RULE_IDS.has(obs.substance.id));
      const isUmbrellaHalal = Boolean(
        obs.halalRule && (UMBRELLA_RULE_IDS.has(obs.halalRule.id) || obs.halalRule.category === 'SAFE_NON_ETHANOL')
      );
      const subNameLower = obs.substance && !isUmbrellaSub ? String(obs.substance.name || '').trim().toLowerCase() : '';
      const subAliases =
        obs.substance && !isUmbrellaSub && Array.isArray(obs.substance.aliases)
          ? obs.substance.aliases.map((a) => a.toLowerCase())
          : [];
      const halalAliases =
        obs.halalRule && !isUmbrellaHalal && Array.isArray(obs.halalRule.aliases)
          ? obs.halalRule.aliases.map((a) => a.toLowerCase())
          : [];
      const sugarAliases = obs.sugar && Array.isArray(obs.sugar.aliases) ? obs.sugar.aliases.map((a) => a.toLowerCase()) : [];
      const allKnownAliases = [rawBase, locLower, locBase, subNameLower, ...subAliases, ...halalAliases, ...sugarAliases].filter(Boolean);

      const isFattyAlcoholShielded = Boolean(obs.halalRule && obs.halalRule.category === 'SAFE_NON_ETHANOL');

      for (const watchTerm of sanitizedWatchlist) {
        const lowerWatch = watchTerm.trim().toLowerCase();
        const normWatch = normalizeToken(watchTerm);
        const foldWatch = foldTurkish(lowerWatch);
        if (!normWatch && !lowerWatch) continue;

        // 1. Target-bound negation check: only exempt if the negation is bound to this watched term (not a different parenthetical term)
        const watchStems = expandWatchTermStems(watchTerm);
        if (isWatchTermNegatedInRaw(obs.raw || '', watchStems)) {
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
          allKnownAliases.some((al) => al === lowerWatch || foldTurkish(al) === foldWatch);

        // 4. Whole-word boundary match (for terms >= 3 chars, e.g. "Sinensis", "Lysine", "Tyrosine", "Freesia") — never matches 2-char substrings like "ni" or "in"
        if (!matched && foldWatch.length >= 3) {
          const wordRe = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegexLiteral(foldWatch)}(?![\\p{L}\\p{N}])`, 'iu');
          const wordReRaw = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegexLiteral(lowerWatch)}(?![\\p{L}\\p{N}])`, 'iu');
          if (
            wordRe.test(foldBase) ||
            wordReRaw.test(rawBase) ||
            wordRe.test(foldTurkish(locBase)) ||
            wordRe.test(foldTurkish(subNameLower)) ||
            allKnownAliases.some((al) => wordRe.test(foldTurkish(al)))
          ) {
            matched = true;
          }
        }

        // 5. Explicit chemical family root match (e.g. "paraben" -> "methylparaben", "silicone" / "dimethicone")
        if (!matched && CHEMICAL_FAMILY_ROOTS.has(foldWatch)) {
          if (
            foldBase.includes(foldWatch) ||
            foldTurkish(locBase).includes(foldWatch) ||
            foldTurkish(subNameLower).includes(foldWatch) ||
            allKnownAliases.some((al) => foldTurkish(al).includes(foldWatch))
          ) {
            // Double-check that the family root itself is not negated in rawFull (e.g. "Paraben-free")
            if (!isWatchTermNegatedInRaw(obs.raw || '', [foldWatch, lowerWatch])) {
              matched = true;
            }
          }
        }

        if (matched) {
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
        source: sourcesData.sources[rule.source_id]
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
      source: sourcesData.sources[rule.source_id]
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
      explanation: o.rapidCarb.explanation,
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
      veganSugarCard
    },
    appleGuideline141Disclaimer: et.appleDisclaimer
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
    decidingDifference
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
  externalProduct = null
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

  const entry = VERIFIED_BARCODE_CATALOG[norm.code] || externalProduct || null;
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

  const evaluation = evaluateProduct({
    ...evaluationOptions,
    rawText,
    allergenStatement: entry.allergenStatement || evaluationOptions.allergenStatement || '',
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



