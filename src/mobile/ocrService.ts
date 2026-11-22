/**
 * InciFact — On-Device Camera & Photo OCR Service (expo-image-picker + Native Vision / ML Kit bridge)
 * Zero-Cloud-Token Cost: Extracts raw ingredient text from product packaging photos locally on device.
 */
import { extractSmartLabelContext } from '../engine/ruleEngine.mjs';

export interface OcrCaptureResult {
  cancelled: boolean;
  imageUri?: string;
  extractedText?: string;
  detectedLanguageHint?: string;
  detectedProductType?: 'cosmetic' | 'food' | null;
  detectedApplicationType?: 'leave_on' | 'rinse_off' | 'spray' | null;
  detectedBarcode?: string | null;
  detectedVeganClaim?: 'declared' | null;
  detectedNutritionPer100g?: Record<string, any> | null;
  confidence?: number | null;
  error?: string;
}

/**
 * Cleans raw camera OCR output before passing to InciFact's deterministic parseIngredientList():
 * - Joins broken lines inside INCI blocks
 * - Preserves hyphenated line breaks so ruleEngine's dictionary-verified hyphenation resolver can inspect them
 * - Strips barcode / net weight noise ("e 50 ml", "1.7 FL. OZ.", "Made in France")
 */
export function cleanRawOcrBlock(ocrLines: unknown): string {
  if (!Array.isArray(ocrLines) || ocrLines.length === 0) return '';
  const filtered = ocrLines
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      // Ignore standalone weight/volume/origin lines and standalone EAN/UPC barcode digit lines
      if (/^(\d{8,14}|\d+\s*(ml|g|oz|fl\.?\s*oz)|made\s+in\s+[a-z]+|www\.[a-z0-9.-]+)$/i.test(line)) {
        return false;
      }
      return true;
    });

  return extractSmartLabelContext(filtered).ingredientText;
}

async function cleanupTempCacheImage(imageUri: string): Promise<void> {
  if (!imageUri) return;
  try {
    const FileSystem = await import('expo-file-system').catch(() => null);
    const cacheDir = typeof FileSystem?.cacheDirectory === 'string' ? FileSystem.cacheDirectory : '';
    if (cacheDir && imageUri.startsWith(cacheDir) && typeof FileSystem?.deleteAsync === 'function') {
      await FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors for temporary OCR cache files
  }
}

/**
 * Launches the device camera or photo library via Expo ImagePicker and runs on-device text recognition.
 * Prefers Apple Vision (`InciFactVisionOcr`) on iOS and ML Kit (`MlkitOcr`) on Android.
 * Returns NO_NATIVE_OCR unless a native bridge is linked (or explicit dev-only mock flag is enabled).
 */
export async function captureAndRecognizeLabel(
  mode: 'camera' | 'gallery' = 'camera',
  options?: { allowsEditing?: boolean; lang?: string }
): Promise<OcrCaptureResult> {
  try {
    // Dynamic import so the module also compiles in environments without native Expo binaries linked
    const ImagePicker = await import('expo-image-picker').catch(() => null);

    if (ImagePicker) {
      const perm =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm || perm.granted !== true) {
        return {
          cancelled: true,
          error: 'PERMISSION_DENIED'
        };
      }

      const allowCrop = Boolean(options?.allowsEditing);
      const pickerResult =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.95,
              allowsEditing: allowCrop
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.95,
              allowsEditing: allowCrop
            });

      const firstAsset =
        pickerResult && !pickerResult.canceled && Array.isArray(pickerResult.assets) ? pickerResult.assets[0] : null;
      const imageUri = firstAsset && typeof firstAsset.uri === 'string' ? firstAsset.uri.trim() : '';
      if (!imageUri) {
        return { cancelled: true };
      }

      try {
        // Attempt native Vision / ML Kit OCR if linked in custom dev/release client via NativeModules (Metro-safe)
        const rn = await import('react-native').catch(() => null);
        const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;
        const nativeModules = (rn as any)?.NativeModules;
        const isIos = (rn as any)?.Platform?.OS === 'ios';
        const nativeOcrModule =
          (isIos
            ? nativeModules?.InciFactVisionOcr || nativeModules?.MlkitOcr
            : nativeModules?.MlkitOcr || nativeModules?.InciFactVisionOcr) ||
          (isDevRuntime ? (globalThis as any).__INCIFACT_NATIVE_OCR__ : null);
        const langHint = typeof options?.lang === 'string' ? options.lang.trim().toLowerCase() : 'en';
        const hasLangMethod = nativeOcrModule && typeof nativeOcrModule.detectFromUriWithLang === 'function';
        const hasBaseMethod = nativeOcrModule && typeof nativeOcrModule.detectFromUri === 'function';
        if (hasLangMethod || hasBaseMethod) {
          let rawBlocks: any;
          try {
            rawBlocks = hasLangMethod
              ? await nativeOcrModule.detectFromUriWithLang(imageUri, langHint)
              : await nativeOcrModule.detectFromUri(imageUri);
          } catch (ocrErr: any) {
            const errCode = String(ocrErr?.code || '');
            const errMsg = String(ocrErr?.message || '');
            if (errCode === 'OCR_SCRIPT_MODEL_MISSING' || /OCR_SCRIPT_MODEL_MISSING/i.test(errMsg)) {
              return {
                cancelled: false,
                imageUri,
                extractedText: '',
                error: 'OCR_SCRIPT_MODEL_MISSING'
              };
            }
            throw ocrErr;
          }
          const blocks = Array.isArray(rawBlocks) ? rawBlocks.slice(0, 250) : [];
          const lines: string[] = blocks
            .map((b: any) => (b && typeof b.text === 'string' ? b.text.slice(0, 512) : typeof b === 'string' ? b.slice(0, 512) : ''))
            .filter((s: string) => s.length > 0);
          const joinedChars = lines.join('\n');
          const boundedLines = joinedChars.length > 16384 ? joinedChars.slice(0, 16384).split('\n') : lines;
          const confidenceScores: number[] = blocks
            .map((b: any) => b?.confidence)
            .filter((v: any): v is number => typeof v === 'number' && Number.isFinite(v));
          const measuredConfidence =
            confidenceScores.length > 0
              ? confidenceScores.reduce((acc, v) => acc + v, 0) / confidenceScores.length
              : null;
          const smart = extractSmartLabelContext(boundedLines);
          if (!smart.ingredientText) {
            return {
              cancelled: false,
              imageUri,
              extractedText: '',
              detectedProductType: smart.detectedProductType,
              detectedApplicationType: smart.detectedApplicationType,
              detectedBarcode: smart.detectedBarcode,
              detectedVeganClaim: smart.detectedVeganClaim,
              detectedNutritionPer100g: smart.detectedNutritionPer100g,
              confidence: measuredConfidence,
              error: 'EMPTY_OCR_TEXT'
            };
          }
          return {
            cancelled: false,
            imageUri,
            extractedText: smart.ingredientText,
            detectedProductType: smart.detectedProductType,
            detectedApplicationType: smart.detectedApplicationType,
            detectedBarcode: smart.detectedBarcode,
            detectedVeganClaim: smart.detectedVeganClaim,
            detectedNutritionPer100g: smart.detectedNutritionPer100g,
            confidence: measuredConfidence
          };
        }

        // If native OCR is not linked in this runtime (e.g. Expo Go or Simulator without custom dev client):
        // Avoid fake OCR illusion! Do NOT pretend we read the user's packaging.
        if (typeof __DEV__ !== 'undefined' && __DEV__ && (globalThis as any).__INCIFACT_FORCE_MOCK_OCR__) {
          return {
            cancelled: false,
            imageUri,
            extractedText:
              'Ingredients: Aqua / Water / Eau, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Cetyl Alcohol, Niacinamide, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Sodium Hyaluronate, Panthenol, Tocopherol, Phenoxyethanol, Ethylhexylglycerin',
            confidence: 0.92
          };
        }

        return {
          cancelled: false,
          imageUri,
          extractedText: '',
          error: 'NO_NATIVE_OCR'
        };
      } finally {
        await cleanupTempCacheImage(imageUri);
      }
    }

    return {
      cancelled: false,
      extractedText: '',
      error: 'IMAGE_PICKER_UNAVAILABLE'
    };
  } catch (err: any) {
    return {
      cancelled: false,
      error: err?.message || 'OCR capture failed'
    };
  }
}
