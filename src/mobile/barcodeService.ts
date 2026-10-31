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
  lookupBarcodeProduct,
  createCustomBarcodeEntry,
  VERIFIED_BARCODE_CATALOG
} from '../engine/ruleEngine.mjs';

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
  source: string;
  updatedAt: string;
  cachedAt: number;
}

const BARCODE_CACHE_KEY = 'incifact_barcode_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function lookupBarcodeOnDevice(
  rawBarcode: string,
  lang: string = 'tr',
  evaluationOptions: Record<string, any> = {}
): Promise<BarcodeLookupResult> {
  const norm = normalizeBarcodeInput(rawBarcode);
  if (!norm.valid) {
    return lookupBarcodeProduct({ barcode: rawBarcode, lang, evaluationOptions });
  }

  // 1. Check built-in deterministic catalog first (0 ms)
  if ((VERIFIED_BARCODE_CATALOG as Record<string, any>)[norm.code]) {
    return lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
  }

  // 2. Check 7-day on-device AsyncStorage LRU cache
  try {
    const rawCache = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
    if (rawCache) {
      const parsed: CachedBarcodeEntry[] = JSON.parse(rawCache);
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
    }
  } catch {
    // Ignore storage read errors and proceed
  }

  // 3. Direct client-side Open Food Facts / Open Beauty Facts query
  const endpoints = [
    { url: `https://world.openfoodfacts.org/api/v2/product/${norm.code}.json`, source: 'Open Food Facts (ODbL)', defaultType: 'food' as const },
    { url: `https://world.openbeautyfacts.org/api/v2/product/${norm.code}.json`, source: 'Open Beauty Facts (ODbL)', defaultType: 'cosmetic' as const }
  ];

  for (const ep of endpoints) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const resp = await fetch(ep.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'InciFact-App/1.0 (https://github.com/axonturk/incifact)'
        },
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (!resp.ok) continue;
      const json: any = await resp.json();
      if (json && json.status === 1 && json.product) {
        const p = json.product;
        const ingText =
          p[`ingredients_text_${lang}`] ||
          p.ingredients_text_en ||
          p.ingredients_text ||
          '';
        if (typeof ingText === 'string' && ingText.trim().length > 0) {
          const prodName =
            p[`product_name_${lang}`] ||
            p.product_name_en ||
            p.product_name ||
            norm.code;
          const externalProduct: CachedBarcodeEntry = {
            barcode: norm.code,
            productName: String(prodName).trim(),
            productType: ep.defaultType,
            allergenStatement: String(p.allergens_from_ingredients || p.allergens || p.traces_from_ingredients || p.traces || '').trim(),
            rawText: String(ingText).trim(),
            source: ep.source,
            updatedAt: new Date().toISOString().slice(0, 10),
            cachedAt: Date.now()
          };
          // Persist in 7-day LRU cache (max 50 entries)
          try {
            const existingRaw = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
            const existing: CachedBarcodeEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
            const now = Date.now();
            const filtered = Array.isArray(existing)
              ? existing.filter((c) => c && c.barcode !== norm.code && now - (c.cachedAt || 0) < CACHE_TTL_MS)
              : [];
            await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify([externalProduct, ...filtered].slice(0, 50)));
          } catch {
            // Ignore cache write errors
          }
          return lookupBarcodeProduct({
            barcode: norm.code,
            lang,
            evaluationOptions,
            externalProduct
          });
        }
      }
    } catch {
      // Offline or timed out; continue to fallback
    }
  }

  return lookupBarcodeProduct({ barcode: norm.code, lang, evaluationOptions });
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
  const cachedRecord: CachedBarcodeEntry = {
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
    const existingRaw = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
    const existing: CachedBarcodeEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    const now = Date.now();
    const filtered = Array.isArray(existing)
      ? existing.filter((c) => c && c.barcode !== entry.code && now - (c.cachedAt || 0) < CACHE_TTL_MS)
      : [];
    await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify([cachedRecord, ...filtered].slice(0, 50)));
  } catch {
    // Ignore storage write errors
  }
  return {
    ok: true,
    barcode: entry.code,
    coveragePercent: built.coveragePercent
  };
}

