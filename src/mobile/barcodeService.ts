/**
 * InciFact — Hybrid Barcode & Open Food / Beauty Facts Service (React Native / Expo SDK 52)
 * Implements:
 * 1. Built-in deterministic barcode catalog + 7-day on-device LRU cache (AsyncStorage)
 * 2. Direct client-side Open Food Facts / Open Beauty Facts REST API lookup (protects server IP rate limits)
 * 3. <80% coverage safety guard (automatically directs incomplete volunteer entries to OCR label photo flow)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeBarcodeInput,
  isValidGs1CheckDigit,
  lookupBarcodeProduct,
  createCustomBarcodeEntry,
  VERIFIED_BARCODE_CATALOG
} from '../engine/ruleEngine.mjs';
import { safeParseBoundedJson } from './secureStorage';

export interface BarcodeLookupResult {
  valid: boolean;
  found: boolean;
  barcode: string;
  reason?: string;
  productName?: string;
  productType?: 'cosmetic' | 'food';
  applicationType?: string | null;
  allergenStatement?: string;
  rawText?: string;
  source?: string;
  updatedAt?: string;
  coveragePercent?: number;
  nutritionPer100g?: Record<string, any> | null;
  requiresOcrFallback: boolean;
  fallbackReason?: string | null;
  message: string;
  evaluation: any;
}

interface CachedBarcodeEntry {
  barcode: string;
  productName: string;
  productType: 'cosmetic' | 'food';
  applicationType?: string | null;
  allergenStatement?: string;
  rawText: string;
  nutritionPer100g?: Record<string, any> | null;
  source: string;
  updatedAt: string;
  cachedAt: number;
}

export const BARCODE_CACHE_KEY = 'incifact_barcode_cache_v1';
export const CUSTOM_BARCODES_STORAGE_KEY = 'incifact_custom_barcodes_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_NEGATIVE_CACHE = 200;
const negativeBarcodeCache = new Map<string, number>();
const MAX_BARCODE_RESPONSE_BYTES = 512 * 1024; // 512 KB
const MAX_CUSTOM_ENTRIES = 500;
const MAX_REMOTE_INGREDIENTS_LEN = 8192;
const MAX_PRODUCT_NAME_LEN = 200;
const OFF_FIELDS_QUERY =
  'fields=product_name,product_name_tr,product_name_en,product_name_de,product_name_fr,product_name_es,product_name_ar,product_name_id,product_name_ms,product_name_ru,product_name_ur,brands,ingredients_text,ingredients_text_tr,ingredients_text_en,ingredients_text_de,ingredients_text_fr,ingredients_text_es,ingredients_text_ar,ingredients_text_id,ingredients_text_ms,ingredients_text_ru,ingredients_text_ur,ingredients_text_with_allergens,allergens,allergens_from_ingredients,traces,traces_from_ingredients,categories_tags,nutriments,last_modified_t';

const ALLOWED_OPEN_FACTS_HOSTS = new Set(['world.openfoodfacts.org', 'world.openbeautyfacts.org']);

const BEVERAGE_EXACT_TAG_RE =
  /(?:^|:)(?:beverages?|drinks?|soft-drinks?|sodas?|carbonated-drinks?|energy-drinks?|sports-drinks?|juices?|fruit-juices?|nectars?|waters?|mineral-waters?|spring-waters?|natural-mineral-waters?|sparkling-waters?|still-waters?|drinking-waters?|teas?|iced-teas?|coffees?|milks?|drinking-milks?|plant-milks?|plant-based-beverages?|dairy-drinks?|milk-drinks?|chocolate-milks?|flavou?red-milks?|oat-milks?|soy-milks?|almond-milks?|rice-milks?|cereal-milks?|oat-based-drinks?|fermented-milk-drinks?|drinking-yoghurts?|drinking-yogurts?|kefirs?|ayrans?|smoothies?|lemonades?|colas?|boissons?|eaux|eaux-minerales|getr[äa]nke|getraenke|wasser|mineralwasser|bebidas?|aguas?|i[çc]ecekler|مشروبات|напитки)$/i;

const SOLID_NON_BEVERAGE_TAG_RE =
  /(?:^|:)(?:chocolates?|milk-chocolates?|dark-chocolates?|white-chocolates?|chocolate-bars?|chocolate-spreads?|milk-powders?|cocoa-powders?|powdered-milks?|breads?|milk-breads?|biscuits?|cookies?|wafers?|cakes?|candies|candy|confectioneries?|ice-creams?|ice-creams-and-sorbets|desserts?|dairy-desserts?|frozen-desserts?|yogurts?|yoghurts?|cheeses?|cream-cheeses?|butters?|spreads?|condensed-milks?|evaporated-milks?|breakfast-cereals?|cereal-bars?|snacks?|sweet-snacks?|salty-snacks?|jams?|preserves?|sauces?|soups?|oils?|flours?|pastas?|meats?|whipped-creams?|sour-creams?|pastries|pastry|margarines?)$|(?:milk-chocolate|milk-powder|milk-bread|condensed-milk|evaporated-milk|ice-cream|cream-cheese|whipped-cream|sour-cream|chocolate-bar|cereal-bar)/i;

const PLAIN_WATER_TAG_RE =
  /(?:^|:)(?:waters?|mineral-waters?|spring-waters?|natural-mineral-waters?|sparkling-waters?|still-waters?|drinking-waters?|eaux|eaux-minerales|wasser|mineralwasser|aguas?|su)$/i;

const FLAVORED_OR_SWEET_DRINK_TAG_RE =
  /(?:flavou?red|sweetened|sugar|soda|cola|juice|nectar|syrup|tonic|lemonade|energy|vitamin|tea|coffee|milk|coconut|aloe|infused|aromatis|squash|cordial|soft-drink|carbonated-drink)/i;

const FATS_OILS_NUTS_TAG_RE =
  /(?:^|:)(?:olive-oils?|extra-virgin-olive-oils?|virgin-olive-oils?|rapeseed-oils?|canola-oils?|walnut-oils?|sunflower-oils?|vegetable-oils?|cooking-oils?|plant-oils?|fats|margarines?|butters?|nuts|tree-nuts|seeds)$/i;

const ELIGIBLE_FVL_OIL_TAG_RE =
  /(?:^|:)(?:olive-oils?|extra-virgin-olive-oils?|virgin-olive-oils?|rapeseed-oils?|canola-oils?|walnut-oils?)$/i;

export function extractNutritionPer100g(p: any, isFood: boolean): Record<string, any> | null {
  if (!isFood || !p || !p.nutriments || typeof p.nutriments !== 'object') return null;
  const n = p.nutriments;
  const num = (k: string): number | undefined => {
    const val = n[k];
    if (val === null || val === undefined || val === '') return undefined;
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  const energyKcal = num('energy-kcal_100g');
  // Open Food Facts stores standard kJ under `energy-kj_100g` or `energy_100g`
  const energyKj = num('energy-kj_100g') ?? num('energy_100g');
  const totalFatG = num('fat_100g');
  const sugarsG = num('sugars_100g');
  const saturatedFatG = num('saturated-fat_100g');
  const saltG = num('salt_100g');
  const sodiumG = num('sodium_100g');
  const fiberG = num('fiber_100g');
  const proteinG = num('proteins_100g');
  const fvlPct =
    num('fruits-vegetables-legumes-estimate-from-ingredients_100g') ??
    num('fruits-vegetables-nuts-estimate-from-ingredients_100g');

  if (
    energyKcal === undefined &&
    energyKj === undefined &&
    sugarsG === undefined &&
    saturatedFatG === undefined &&
    saltG === undefined &&
    sodiumG === undefined
  ) {
    return null;
  }

  const tagsArr: string[] = Array.isArray(p.categories_tags)
    ? p.categories_tags.filter((t: any): t is string => typeof t === 'string').map((t: string) => t.toLowerCase().trim())
    : [];
  const hasSolidFoodTag = tagsArr.some((t) => !BEVERAGE_EXACT_TAG_RE.test(t) && SOLID_NON_BEVERAGE_TAG_RE.test(t));
  const isBeverage = !hasSolidFoodTag && tagsArr.some((t) => BEVERAGE_EXACT_TAG_RE.test(t));

  const hasPlainWaterTag = isBeverage && tagsArr.some((t) => PLAIN_WATER_TAG_RE.test(t));
  const hasFlavoredDrinkTag = tagsArr.some((t) => FLAVORED_OR_SWEET_DRINK_TAG_RE.test(t));
  const hasExplicitZeroEnergy = (energyKj !== undefined || energyKcal !== undefined) && (energyKj ?? 0) === 0 && (energyKcal ?? 0) === 0;
  const isWater = hasPlainWaterTag && !hasFlavoredDrinkTag && hasExplicitZeroEnergy && sugarsG === 0;

  const isFatsOilsNuts = !isBeverage && totalFatG !== undefined && tagsArr.some((t) => FATS_OILS_NUTS_TAG_RE.test(t));
  const isEligibleFvlOil = isFatsOilsNuts && tagsArr.some((t) => ELIGIBLE_FVL_OIL_TAG_RE.test(t));

  const out: Record<string, any> = {};
  if (energyKcal !== undefined) out.energyKcal = energyKcal;
  if (energyKj !== undefined) out.energyKj = energyKj;
  if (totalFatG !== undefined) out.totalFatG = totalFatG;
  if (sugarsG !== undefined) out.sugarsG = sugarsG;
  if (saturatedFatG !== undefined) out.saturatedFatG = saturatedFatG;
  if (saltG !== undefined) out.saltG = saltG;
  else if (sodiumG !== undefined) out.sodiumMg = sodiumG * 1000;
  if (fiberG !== undefined) out.fiberG = fiberG;
  if (proteinG !== undefined) out.proteinG = proteinG;
  if (fvlPct !== undefined) out.fruitVegLegumePct = fvlPct;
  else if (isEligibleFvlOil) out.fruitVegLegumePct = 100;
  if (isBeverage) out.isBeverage = true;
  if (isWater) out.isWater = true;
  if (isFatsOilsNuts) out.category = 'fats_oils_nuts';
  return out;
}

function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).byteLength;
  }
  return text.length * 2;
}

// Strict cosmetic taxonomy regex — NEVER matches food cream tags (ice-creams, cream-cheeses, whipped-creams, sour-creams)
const COSMETIC_TAG_REGEX =
  /(?:^|:)(?:cosmetics?|beauty|personal-care|skin-care|skincare|face-care|body-care|hand-care|lip-care|eye-care|hair-care|hair-styling|make-up|makeup|shampoos?|conditioners?|body-washes?|shower-gels?|liquid-soaps?|bar-soaps?|facial-cleansers?|cleansers?|micellar-waters?|toners?|moisturizers?|moisturisers?|(?:face|facial|hand|body|eye|day|night|sun|moisturizing|moisturising|hydrating|anti-aging|shaving|cleansing|barrier|skin)-creams?|sunscreens?|sun-care|deodorants?|antiperspirants?|perfumes?|fragrances?|nail-polishes?|toothpastes?|mouthwashes?|facial-serums?|face-serums?|hair-serums?|serums?|body-lotions?|face-lotions?|hand-lotions?|lotions?|lip-balms?)$/i;

const FOOD_TAXONOMY_GUARD_RE =
  /(?:^|:)(?:foods?|plant-based-foods|dairies|dairy|ice-creams?|cream-cheeses?|whipped-creams?|sour-creams?|heavy-creams?|dairy-creams?|creams?|cheeses?|yogurts?|yoghurts?|chocolates?|milk-chocolates?|snacks?|biscuits?|cookies?|beverages?|drinks?|cereals?|spreads?|desserts?|confectioneries?|sauces?|meals?|meats?|fruits?|vegetables?|oils?|breads?|pastas?|candies|sweets|milks?)$/i;

export function resolveOpenFactsProductType(
  p: Record<string, any> | null | undefined,
  defaultType: 'cosmetic' | 'food'
): 'cosmetic' | 'food' {
  const tags: string[] = Array.isArray(p?.categories_tags)
    ? p.categories_tags.filter((tag: any): tag is string => typeof tag === 'string').map((tag: string) => tag.toLowerCase().trim())
    : [];
  const hasUnambiguousCosmeticTag = tags.some((tag) => COSMETIC_TAG_REGEX.test(tag));
  if (defaultType === 'food') {
    const hasFoodTag = tags.some((tag) => FOOD_TAXONOMY_GUARD_RE.test(tag));
    return hasUnambiguousCosmeticTag && !hasFoodTag ? 'cosmetic' : 'food';
  }
  return hasUnambiguousCosmeticTag ? 'cosmetic' : defaultType;
}

function extractIngredientsText(p: Record<string, any>, lang: string): string {
  const candidates = [
    p[`ingredients_text_${lang}`],
    p.ingredients_text_en,
    p.ingredients_text,
    p.ingredients_text_with_allergens,
    p.ingredients_text_fr,
    p.ingredients_text_de,
    p.ingredients_text_tr,
    p.ingredients_text_es,
    p.ingredients_text_ar,
    p.ingredients_text_id,
    p.ingredients_text_ms,
    p.ingredients_text_ru,
    p.ingredients_text_ur
  ];
  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim().length > 0) {
      return cand.trim().slice(0, MAX_REMOTE_INGREDIENTS_LEN);
    }
  }
  for (const key of Object.keys(p)) {
    if (key.startsWith('ingredients_text_') && typeof p[key] === 'string' && p[key].trim().length > 0) {
      return p[key].trim().slice(0, MAX_REMOTE_INGREDIENTS_LEN);
    }
  }
  if (Array.isArray(p.ingredients)) {
    const joined = p.ingredients
      .map((x: any) => (x && typeof x.text === 'string' ? x.text.trim() : ''))
      .filter(Boolean)
      .join(', ');
    if (joined.length > 0) return joined.slice(0, MAX_REMOTE_INGREDIENTS_LEN);
  }
  return '';
}

function extractProductDisplayName(p: Record<string, any>, lang: string): string {
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : '';
  const rawName =
    (typeof lang === 'string' && Object.hasOwn(p, `product_name_${lang}`) ? p[`product_name_${lang}`] : '') ||
    p.product_name_en ||
    p.product_name ||
    '';
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const combined =
    brand && name && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} — ${name}` : name || brand;
  return combined.slice(0, MAX_PRODUCT_NAME_LEN);
}

interface OpenFactsEndpoint {
  url: string;
  source: string;
  defaultType: 'cosmetic' | 'food';
}

interface OpenFactsFetchHit {
  partialProductName: string;
  externalProduct: CachedBarcodeEntry | null;
}

async function readBoundedResponseText(resp: Response): Promise<string | null> {
  const reader = resp.body && typeof (resp.body as any).getReader === 'function' ? (resp.body as any).getReader() : null;
  if (reader) {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength || value.length || 0;
          if (totalBytes > MAX_BARCODE_RESPONSE_BYTES) {
            await reader.cancel().catch(() => {});
            chunks.length = 0;
            return null;
          }
          chunks.push(value);
        }
      }
    } catch {
      await reader.cancel().catch(() => {});
      return null;
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(merged);
    }
    let out = '';
    for (let i = 0; i < merged.length; i++) out += String.fromCharCode(merged[i]);
    return out;
  }

  const rawBody = await resp.text();
  if (typeof rawBody !== 'string' || rawBody.length === 0) return null;
  if (getUtf8ByteLength(rawBody) > MAX_BARCODE_RESPONSE_BYTES) return null;
  return rawBody;
}

async function fetchOpenFactsEndpoint(
  ep: OpenFactsEndpoint,
  barcode: string,
  lang: string,
  timeoutMs: number
): Promise<OpenFactsFetchHit | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(ep.url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'InciFact-App/1.2.1 (privacy@incifact.app)'
      },
      signal: controller ? controller.signal : undefined
    });
    if (!resp || !resp.ok) return null;

    // Verify final URL after any HTTP redirect remains strictly on allowlisted HTTPS Open Facts hosts
    if (resp.redirected && (!resp.url || typeof resp.url !== 'string')) {
      return null;
    }
    if (typeof resp.url === 'string' && resp.url.length > 0) {
      let finalUrl: URL;
      try {
        finalUrl = new URL(resp.url);
      } catch {
        return null;
      }
      if (
        finalUrl.protocol !== 'https:' ||
        finalUrl.port !== '' ||
        finalUrl.username !== '' ||
        finalUrl.password !== '' ||
        !ALLOWED_OPEN_FACTS_HOSTS.has(finalUrl.hostname.toLowerCase())
      ) {
        return null;
      }
    }

    const contentLengthRaw =
      resp.headers && typeof resp.headers.get === 'function' ? resp.headers.get('content-length') : null;
    if (contentLengthRaw && Number(contentLengthRaw) > MAX_BARCODE_RESPONSE_BYTES) {
      return null;
    }

    const rawBody = await readBoundedResponseText(resp);
    if (!rawBody) return null;

    const json = safeParseBoundedJson<any>(rawBody);
    if (!json || json.status !== 1 || !json.product || typeof json.product !== 'object') return null;

    const p = json.product;
    const prodName = extractProductDisplayName(p, lang);
    const ingText = extractIngredientsText(p, lang);
    if (ingText.length === 0) {
      return prodName ? { partialProductName: prodName, externalProduct: null } : null;
    }

    const resolvedType: 'cosmetic' | 'food' = resolveOpenFactsProductType(p, ep.defaultType);
    const nutritionPer100g = extractNutritionPer100g(p, resolvedType === 'food');

    const modifiedTs =
      typeof p.last_modified_t === 'number' && Number.isFinite(p.last_modified_t) && p.last_modified_t > 0
        ? new Date(p.last_modified_t * 1000).toISOString().slice(0, 10)
        : '';

    return {
      partialProductName: prodName,
      externalProduct: {
        barcode,
        productName: prodName || barcode,
        productType: resolvedType,
        allergenStatement: String(p.allergens_from_ingredients || p.allergens || p.traces_from_ingredients || p.traces || '')
          .trim()
          .slice(0, 1024),
        rawText: ingText,
        nutritionPer100g,
        source: ep.source,
        updatedAt: modifiedTs,
        cachedAt: Date.now()
      }
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function lookupBarcodeOnDevice(
  rawBarcode: string,
  lang: string = 'tr',
  evaluationOptions: Record<string, any> = {},
  serviceOptions: { enableLiveLookup?: boolean } = {}
): Promise<BarcodeLookupResult> {
  const norm = normalizeBarcodeInput(rawBarcode);
  if (!norm.valid) {
    return lookupBarcodeProduct({ barcode: rawBarcode, lang, evaluationOptions });
  }

  // 1. Check built-in deterministic catalog first (0 ms)
  if (Object.hasOwn(VERIFIED_BARCODE_CATALOG, norm.code)) {
    return lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
  }

  // 2. Check permanent device-saved user custom barcodes (never subject to 7-day cache TTL expiry)
  try {
    const rawCustom = await AsyncStorage.getItem(CUSTOM_BARCODES_STORAGE_KEY);
    const parsedCustom = safeParseBoundedJson<CachedBarcodeEntry[]>(rawCustom);
    if (Array.isArray(parsedCustom)) {
      const customHit = parsedCustom.find((c) => c && c.barcode === norm.code && typeof c.rawText === 'string' && c.rawText.trim());
      if (customHit) {
        return lookupBarcodeProduct({
          barcode: norm.code,
          lang,
          evaluationOptions,
          externalProduct: customHit
        });
      }
    }
  } catch {
    // Ignore storage read errors and continue
  }

  // 3. Check 7-day on-device AsyncStorage remote response cache
  try {
    const rawCache = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
    const parsed = safeParseBoundedJson<CachedBarcodeEntry[]>(rawCache);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      const hit = parsed.find((c) => c && c.barcode === norm.code && now - (c.cachedAt || 0) < CACHE_TTL_MS);
      if (hit && hit.rawText) {
        return lookupBarcodeProduct({
          barcode: norm.code,
          lang,
          evaluationOptions,
          externalProduct: hit
        });
      }
    }
  } catch {
    // Ignore storage read errors and proceed
  }

  // 4. GS1 check-digit validation guard before any remote network request
  const isSynthetic200 = norm.code.length === 13 && /^2\d{2}/.test(norm.code);
  if (!isSynthetic200 && [8, 12, 13, 14].includes(norm.code.length) && !isValidGs1CheckDigit(norm.code)) {
    const invalidRes = lookupBarcodeProduct({ barcode: 'invalid', lang, evaluationOptions });
    return {
      ...invalidRes,
      valid: false,
      found: false,
      barcode: norm.code,
      reason: 'invalid_check_digit',
      requiresOcrFallback: true
    };
  }

  // 5. Negative cache guard (10 min bounded LRU) to avoid repeating remote 404 lookups
  const negTs = negativeBarcodeCache.get(norm.code);
  if (typeof negTs === 'number' && Date.now() - negTs < NEGATIVE_CACHE_TTL_MS) {
    return lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
  }

  // 6. Optional client-side Open Beauty / Open Food Facts lookup (disabled cleanly in 100% offline mode)
  const allowLiveLookup = serviceOptions.enableLiveLookup !== false && evaluationOptions.enableLiveLookup !== false;
  if (!allowLiveLookup) {
    return lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
  }

  const obfEp: OpenFactsEndpoint = {
    url: `https://world.openbeautyfacts.org/api/v2/product/${norm.code}.json?${OFF_FIELDS_QUERY}`,
    source: 'Open Beauty Facts (ODbL)',
    defaultType: 'cosmetic'
  };
  const offEp: OpenFactsEndpoint = {
    url: `https://world.openfoodfacts.org/api/v2/product/${norm.code}.json?${OFF_FIELDS_QUERY}`,
    source: 'Open Food Facts (ODbL)',
    defaultType: 'food'
  };
  const primaryEndpoints = evaluationOptions.productType === 'cosmetic' ? [obfEp, offEp] : [offEp, obfEp];

  let partialProductName = '';
  let matchedProduct: CachedBarcodeEntry | null = null;

  const primaryResults = await Promise.allSettled(
    primaryEndpoints.map((ep) => fetchOpenFactsEndpoint(ep, norm.code, lang, 3800))
  );
  for (const res of primaryResults) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    if (res.value.partialProductName && !partialProductName) {
      partialProductName = res.value.partialProductName;
    }
    if (!matchedProduct && res.value.externalProduct) {
      matchedProduct = res.value.externalProduct;
    }
  }

  if (matchedProduct) {
    const evaluated: BarcodeLookupResult = lookupBarcodeProduct({
      barcode: norm.code,
      lang,
      evaluationOptions,
      externalProduct: matchedProduct
    });
    // Never cache incomplete (<80% coverage / pending OCR) OFF/OBF entries
    if (
      !evaluated.requiresOcrFallback &&
      typeof evaluated.coveragePercent === 'number' &&
      evaluated.coveragePercent >= 80
    ) {
      // Persist in 7-day LRU cache (max 50 entries)
      try {
        const existingRaw = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
        const existing = safeParseBoundedJson<CachedBarcodeEntry[]>(existingRaw) || [];
        const now = Date.now();
        const filtered = Array.isArray(existing)
          ? existing.filter((c) => c && c.barcode !== norm.code && now - (c.cachedAt || 0) < CACHE_TTL_MS)
          : [];
        await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify([matchedProduct, ...filtered].slice(0, 50)));
      } catch {
        // Ignore cache write errors
      }
    }
    return evaluated;
  }

  const fallback = lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
  if (negativeBarcodeCache.size >= MAX_NEGATIVE_CACHE) {
    const oldestKey = negativeBarcodeCache.keys().next().value;
    if (oldestKey !== undefined) negativeBarcodeCache.delete(oldestKey);
  }
  negativeBarcodeCache.set(norm.code, Date.now());
  if (partialProductName && !fallback.productName) {
    return {
      ...fallback,
      productName: partialProductName
    };
  }
  return fallback;
}

export async function saveCustomBarcodeOnDevice(params: {
  barcode: string;
  productName?: string;
  productType: 'cosmetic' | 'food';
  applicationType?: string | null;
  allergenStatement?: string;
  rawText: string;
  lang?: string;
}): Promise<{ ok: boolean; barcode: string; coveragePercent?: number; reason?: string }> {
  const built = createCustomBarcodeEntry(params);
  if (!built || !built.ok || !built.entry) {
    return {
      ok: false,
      barcode: built ? built.barcode : String(params.barcode || ''),
      coveragePercent: built ? built.coveragePercent : undefined,
      reason: built ? built.reason : 'unknown_error'
    };
  }
  const entry = built.entry;
  negativeBarcodeCache.delete(entry.code);
  const customRecord: CachedBarcodeEntry = {
    barcode: entry.code,
    productName: entry.productName,
    productType: entry.productType,
    applicationType: entry.applicationType,
    allergenStatement: entry.allergenStatement,
    rawText: entry.rawText,
    source: entry.source,
    updatedAt: entry.updatedAt,
    cachedAt: Date.now()
  };
  try {
    const existingRaw = await AsyncStorage.getItem(CUSTOM_BARCODES_STORAGE_KEY);
    const existing = safeParseBoundedJson<CachedBarcodeEntry[]>(existingRaw) || [];
    const filtered = Array.isArray(existing)
      ? existing.filter((c) => c && c.barcode !== entry.code)
      : [];
    await AsyncStorage.setItem(CUSTOM_BARCODES_STORAGE_KEY, JSON.stringify([customRecord, ...filtered].slice(0, MAX_CUSTOM_ENTRIES)));
  } catch {
    // Ignore storage write errors
  }
  return {
    ok: true,
    barcode: entry.code,
    coveragePercent: built.coveragePercent
  };
}

