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
  // ppm → percent (1 ppm = 0.0001 %)
  const ppm = s.match(/(\d+(?:[.,]\d+)?)\s*ppm\b/i);
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
    // Strip trailing dots/asterisks/Urdu full stop and numeric percentages like (%13), (13.5%), %13, 13%, ٪١٣
    let cleanedTok = tok
      .replace(/\(\s*[%٪]?\s*[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫][\d\u0660-\u0669\u06F0-\u06F9]+)?\s*[%٪]?\s*\)/gu, '')
      .replace(/(?:^|\s)[%٪]?[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫][\d\u0660-\u0669\u06F0-\u06F9]+)?[%٪](?=\s|$)/gu, '')
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
    kvkkNotice: 'Mobil uygulamada seçimin yalnızca bu cihazda işlenir. Web önizlemesinde yalnızca bu bilgisayardaki yerel sunucuya analiz için gönderilir; kaydedilmez, üçüncü taraflarla paylaşılmaz.',
    veriYokMsg: (name, prof) => `${name} için bu profilde (${prof}) yeterli doğrulanmış bilimsel veri bulunamadı (veri_yok). Otomatik güvenli veya riskli sayılmaz.`,
    profileAlertGeneric: (name) => `${name}: Seçili hassasiyet profiliniz için dikkat edilmesi önerilen bileşen.`,
    halalDisclaimer: (auth) => `Bu değerlendirme bir helal sertifikası değildir; seçtiğiniz kurumun (${auth}) yayımlanmış kriterlerine göre etiket analizi sunar.`,
    appleDisclaimer: 'Bu uygulama etiket bilgilerini resmi kaynaklara bağlı kurallarla açıklar; tıbbi teşhis, tedavi önerisi veya resmi helal sertifikası vermez. Sağlığınızla ilgili kararlar öncesinde doktorunuza veya eczacınıza danışın.',
    shieldDesc: 'Kimyasal yapısında -OH grubu bulunan yağ alkolü / koruyucu; sarhoş edici etil alkol (etanol) değildir.',
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
    kvkkNotice: 'In the mobile app your choices are processed only on this device. In the web preview they are sent only to the local server on this computer for analysis, never stored or shared with third parties.',
    veriYokMsg: (name, prof) => `Insufficient verified clinical data for ${name} under profile (${prof}). Not automatically marked safe or unsafe.`,
    profileAlertGeneric: (name) => `${name}: Flagged for caution under your selected sensitivity profile.`,
    halalDisclaimer: (auth) => `This assessment is not an official Halal certificate; it analyzes the label according to published ${auth} criteria.`,
    appleDisclaimer: 'This app explains ingredient labels using official regulatory rules; it does not provide medical diagnosis, treatment advice, or official Halal certification. Consult your doctor or pharmacist for health decisions.',
    shieldDesc: 'Non-intoxicating fatty alcohol / emollient or preservative; NOT intoxicating ethyl alcohol (ethanol).',
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
    if (/mehl|flour|buğday unu|farine|harina|мука|دقيق|میدہ/.test(lowerRaw)) {
      const map = { tr: 'Buğday Unu', en: 'Wheat Flour', ar: 'دقيق القمح', de: 'Weizenmehl', fr: 'Farine de blé', es: 'Harina de trigo', ru: 'Пшеничная мука', id: 'Tepung Terigu', ms: 'Tepung Gandum', ur: 'میدہ' };
      return map[lang] || 'Wheat Flour';
    }
    if (/kartoffel|potato|patates|pomme de terre|patata|картоф|بطاطس|آلو/.test(lowerRaw)) {
      const map = { tr: 'Patates', en: 'Potatoes', ar: 'بطاطس', de: 'Kartoffeln', fr: 'Pommes de terre', es: 'Patatas', ru: 'Картофель', id: 'Kentang', ms: 'Kentang', ur: 'آلو' };
      return map[lang] || 'Potatoes';
    }
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
      const hasMci = isoObs.some((o) => /chloro|klor|chlor/i.test(o.raw));
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
        const isMciRaw = (r) => /chloro|klor|chlor/i.test(r);
        const isCombinedToken = (r) => isMciRaw(r) && /(?:^|[^a-z])(?:methylisothiazolinone|mi)(?:[^a-z]|$)/i.test(r.replace(/methylchloroisothiazolinone/gi, ' '));
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
        legalText: effectiveDetail,
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
      profileAlerts.push({
        profile: 'cocuk_metabolik',
        substanceName: 'Saç Boyası / Yaş Sınırı (16 Yaş)',
        localizedName: 'Oksidatif Saç Boyası Bileşeni',
        rawToken: 'Hair Dye Sensitizer',
        position: 1,
        level: 'kirmizi',
        explanation: 'AB 1223/2009 Ek III Uyarısı: Oksidatif saç boyaları 16 yaşından küçüklerin kullanımına uygun değildir.',
        sources: [sourcesData.sources.EU_1223_2009].filter(Boolean)
      });
    }
  }

  // Major food allergens (EU 1169/2011 Annex II) for astim_alerji
  if (productType === 'food' && userProfiles.includes('astim_alerji')) {
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

      for (const matchedAllergen of matchedAllergens) {
        profileStatuses['astim_alerji'] = 'false';
        profileAlerts.push({
          profile: 'astim_alerji',
          substanceName: matchedAllergen.tr,
          localizedName: obs.localizedName || obs.raw,
          rawToken: obs.raw,
          position: obs.position,
          level: 'kirmizi',
          explanation: `${matchedAllergen.tr} (AB 1169/2011 Ek II Majör Gıda Alerjeni): Ürün ${obs.localizedName || obs.raw} içermektedir. Alerjisi veya intoleransı olan bireyler için risklidir.`,
          sources: [sourcesData.sources.EU_1169_2011].filter(Boolean)
        });
      }
    }

    const fullCrossContactText = `${rawText} ${allergenStatement || ''}`;
    const crossContactMatch = fullCrossContactText.match(/(?:may\s+contain|traces?\s+of|eser\s+miktarda\s+(?:içerebilir|bulunabilir)|kann\s+spuren\s+von|peut\s+contenir\s+des\s+traces|puede\s+contener\s+trazas|قد\s+يحتوي\s+على|может\s+содержать\s+следы|میں\s+شامل\s+ہو\s+سکتا\s+ہے)\s*[:\-–]?\s*([^.,;\n]+)/iu);
    if (crossContactMatch) {
      profileStatuses['astim_alerji'] = 'false';
      profileAlerts.push({
        profile: 'astim_alerji',
        substanceName: 'Çapraz Bulaşma Uyarısı',
        localizedName: `Eser Miktarda: ${crossContactMatch[1].trim()}`,
        rawToken: crossContactMatch[0].trim(),
        position: observations.length + 1,
        level: 'sari',
        explanation: `Ambalajda çapraz bulaşma (eser miktarda) uyarısı bulunmaktadır: "${crossContactMatch[0].trim()}". Alerjik bireyler için çapraz temas riski taşır.`,
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

  let preferenceMatchScore = null;
  if (userProfiles.length > 0 && unresolvedConfirmations.length === 0) {
    if (coverageRatio < 0.8) {
      for (const prof of userProfiles) {
        if (profileStatuses[prof] === 'true') {
          profileStatuses[prof] = 'kapsam_yetersiz';
        }
      }
      preferenceMatchScore = null;
    } else {
      const hasUnknown = Object.values(profileStatuses).some((st) => st === 'unknown');
      if (!hasUnknown) {
        const matchCount = Object.values(profileStatuses).filter((st) => st === 'true').length;
        preferenceMatchScore = Math.round((100 * matchCount) / userProfiles.length);
      }
    }
  }

  const profileCard = {
    cardTitle: et.profCardTitle,
    selectedProfiles: userProfiles,
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
  let overallHalalStatus = unresolvedConfirmations.length > 0 ? 'unknown' : 'uygun_gorunuyor';
  const explicitPlantRegex = /\b(soya|soy|soja|kedelai|sunflower|ayçiçek|aycicek|tournesol|sonnenblumen|vegetable|bitkisel|végétale|vegetale|pflanzlich|nabati|plant)\b|صويا|نباتي|عباد الشمس|подсолнечн|соев/iu;

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

    let statusForAuthority = rule.authority_rulings[halalAuthority] || rule.authority_rulings.general_cautious;
    let contextResolution = null;
    let conflictDetected = false;
    const isExplicitPlantToken = rule.vegan_claim_resolves && explicitPlantRegex.test(obs.raw);
    obs.isExplicitPlantToken = isExplicitPlantToken;

    if (rule.category === 'A_haram') {
      if (
        claims.halalCertified ||
        (claims.veganStatus !== 'none' && !rule.vegan_compatible) ||
        (claims.vegetarianStatus !== 'none' && rule.vegetarian_compatible === false)
      ) {
        conflictDetected = true;
        statusForAuthority = 'conflict';
        contextResolution = et.conflictHaram;
      } else {
        statusForAuthority = 'kirmizi';
      }
    } else if (rule.category === 'B_alkol') {
      if (productType === 'food' && rule.id === 'ethanol_cosmetic_or_food') {
        statusForAuthority = 'kirmizi';
      }
      if (claims.halalCertified) {
        statusForAuthority = productType === 'food' && rule.id === 'ethanol_cosmetic_or_food' ? 'conflict' : 'sari';
        if (statusForAuthority === 'conflict') conflictDetected = true;
        contextResolution = et.conflictAlcohol;
      } else if (claims.veganStatus !== 'none') {
        contextResolution = et.veganNoteAlcohol;
      }
    } else if (rule.category === 'C_musbooh') {
      if (
        (!rule.vegan_compatible && claims.veganStatus !== 'none') ||
        (rule.vegetarian_compatible === false && claims.vegetarianStatus !== 'none')
      ) {
        conflictDetected = true;
        statusForAuthority = 'conflict';
        contextResolution = et.conflictAnimalVegan;
      } else if (isExplicitPlantToken) {
        statusForAuthority = 'yesil';
        contextResolution = et.plantSourceResolved;
      } else if (claims.halalCertified) {
        statusForAuthority = 'yesil';
        contextResolution = et.halalCertResolved;
      } else if (rule.vegan_claim_resolves && claims.veganStatus === 'verified') {
        statusForAuthority = 'yesil';
        contextResolution = et.verifiedVeganResolved;
      } else if (rule.vegan_claim_resolves && claims.veganStatus === 'declared') {
        statusForAuthority = 'sari_yesil';
        contextResolution = et.declaredVeganNote;
      } else if (rule.id === 'l_cysteine' && claims.veganStatus !== 'none') {
        statusForAuthority = 'sari';
        contextResolution = et.lCysteineNote;
      }
    } else if (rule.category === 'D_tartismali') {
      if (
        (!rule.vegan_compatible && claims.veganStatus !== 'none') ||
        (rule.vegetarian_compatible === false && claims.vegetarianStatus !== 'none')
      ) {
        conflictDetected = true;
        statusForAuthority = 'conflict';
        contextResolution = et.conflictInsectVegan;
      }
    }

    if (conflictDetected || statusForAuthority === 'conflict') {
      overallHalalStatus = 'conflict';
    } else if (statusForAuthority === 'kirmizi' && overallHalalStatus !== 'conflict') {
      overallHalalStatus = 'uygunsuz_bulgu';
    } else if ((statusForAuthority === 'sari' || statusForAuthority === 'sari_yesil') && overallHalalStatus === 'uygun_gorunuyor') {
      overallHalalStatus = 'kaynak_belirsiz_musbooh';
    }

    const localizedRuleExplanation =
      lang === 'tr'
        ? rule.template_tr
        : rule.category === 'B_alkol'
        ? et.halalAlcoholDesc
        : statusForAuthority === 'kirmizi' || statusForAuthority === 'conflict'
        ? et.halalHaramDesc
        : et.halalMusboohDesc;

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

/**
 * Compares two products side-by-side (Product A vs Product B) and deterministically extracts
 * the "Deciding Difference" (Farkı Yaratan Madde) without any LLM hallucination or token cost.
 */
export function compareProducts(productA, productB, sharedOptions = {}) {
  const lang = sharedOptions.lang || 'tr';
  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const locale = getLocaleStrings(lang);

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

  const profConflictA = evalA.cards.profileCard.alerts.some((a) => a.level === 'kirmizi' || a.level === 'sari');
  const profConflictB = evalB.cards.profileCard.alerts.some((a) => a.level === 'kirmizi' || a.level === 'sari');

  // Identify the single most significant differentiating substance between A and B
  const idsA = new Set(regA.findings.map((f) => f.substanceId));
  const idsB = new Set(regB.findings.map((f) => f.substanceId));

  const severityRank = { yuksek: 3, orta: 2, dusuk: 1, bilgi: 0 };
  const uniqueFindings = [];

  for (const f of regB.findings) {
    if (!idsA.has(f.substanceId) && f.severity !== 'bilgi') {
      uniqueFindings.push({ side: 'B', productName: productB.name || 'Ürün B', finding: f });
    }
  }
  for (const f of regA.findings) {
    if (!idsB.has(f.substanceId) && f.severity !== 'bilgi') {
      uniqueFindings.push({ side: 'A', productName: productA.name || 'Ürün A', finding: f });
    }
  }

  uniqueFindings.sort(
    (x, y) => (severityRank[y.finding.severity] || 0) - (severityRank[x.finding.severity] || 0)
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
  }

  return {
    brand: 'InciFact',
    lang: langMeta.code,
    dir: langMeta.dir,
    locale,
    productA: {
      name: productA.name || 'Ürün A',
      score: regA.score,
      canShowScore: regA.canShowScore,
      hasBanned: bannedA.length > 0,
      attentionCount: warnCountA,
      profileStatus: profConflictA ? 'Kaçın / Dikkat' : 'Uygun',
      profileStatusLocalized: profConflictA ? locale.badges.avoid : locale.badges.suitable,
      halalStatus:
        evalA.cards.halalCard.overallStatus === 'uygun_gorunuyor'
          ? 'Uygun'
          : evalA.cards.halalCard.overallStatus === 'kaynak_belirsiz_musbooh'
          ? 'Şüpheli'
          : evalA.cards.halalCard.overallStatus === 'kapsam_yetersiz'
          ? 'Kapsam Yetersiz'
          : 'Uygunsuz / Çelişki',
      halalStatusLocalized:
        evalA.cards.halalCard.overallStatus === 'uygun_gorunuyor'
          ? locale.badges.halalOk
          : evalA.cards.halalCard.overallStatus === 'kaynak_belirsiz_musbooh'
          ? locale.badges.musbooh
          : evalA.cards.halalCard.overallStatus === 'kapsam_yetersiz'
          ? (locale.badges.lowCoverage || 'Kapsam Yetersiz')
          : locale.badges.halalRed,
      evaluation: evalA
    },
    productB: {
      name: productB.name || 'Ürün B',
      score: regB.score,
      canShowScore: regB.canShowScore,
      hasBanned: bannedB.length > 0,
      attentionCount: warnCountB,
      profileStatus: profConflictB ? 'Kaçın / Dikkat' : 'Uygun',
      profileStatusLocalized: profConflictB ? locale.badges.avoid : locale.badges.suitable,
      halalStatus:
        evalB.cards.halalCard.overallStatus === 'uygun_gorunuyor'
          ? 'Uygun'
          : evalB.cards.halalCard.overallStatus === 'kaynak_belirsiz_musbooh'
          ? 'Şüpheli'
          : evalB.cards.halalCard.overallStatus === 'kapsam_yetersiz'
          ? 'Kapsam Yetersiz'
          : 'Uygunsuz / Çelişki',
      halalStatusLocalized:
        evalB.cards.halalCard.overallStatus === 'uygun_gorunuyor'
          ? locale.badges.halalOk
          : evalB.cards.halalCard.overallStatus === 'kaynak_belirsiz_musbooh'
          ? locale.badges.musbooh
          : evalB.cards.halalCard.overallStatus === 'kapsam_yetersiz'
          ? (locale.badges.lowCoverage || 'Kapsam Yetersiz')
          : locale.badges.halalRed,
      evaluation: evalB
    },
    decidingDifference
  };
}


