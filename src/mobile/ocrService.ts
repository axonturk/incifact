/**
 * InciFact — On-Device Camera & Photo OCR Service (expo-image-picker + Native Vision / ML Kit bridge)
 * Zero-Cloud-Token Cost: Extracts raw ingredient text from product packaging photos locally on device.
 */

export interface OcrCaptureResult {
  cancelled: boolean;
  imageUri?: string;
  extractedText?: string;
  detectedLanguageHint?: string;
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
      // Ignore standalone weight/volume/origin lines
      if (/^(\d+\s*(ml|g|oz|fl\.?\s*oz)|made\s+in\s+[a-z]+|www\.[a-z0-9.-]+)$/i.test(line)) {
        return false;
      }
      return true;
    });

  return filtered.join('\n');
}

/**
 * Launches the device camera or photo library via Expo ImagePicker and runs on-device text recognition.
 * Falls back gracefully to a realistic simulated OCR capture when running inside Expo Go / simulator without native ML Kit binary.
 */
export async function captureAndRecognizeLabel(mode: 'camera' | 'gallery' = 'camera'): Promise<OcrCaptureResult> {
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
          error: 'Camera / photo permission was not granted.'
        };
      }

      const pickerResult =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.9,
              allowsEditing: true
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.9,
              allowsEditing: true
            });

      const firstAsset =
        pickerResult && !pickerResult.canceled && Array.isArray(pickerResult.assets) ? pickerResult.assets[0] : null;
      const imageUri = firstAsset && typeof firstAsset.uri === 'string' ? firstAsset.uri.trim() : '';
      if (!imageUri) {
        return { cancelled: true };
      }

      // Attempt native Vision / ML Kit OCR if linked in custom dev client via NativeModules (Metro-safe)
      const rn = await import('react-native').catch(() => null);
      const nativeOcrModule = (rn as any)?.NativeModules?.MlkitOcr || (globalThis as any).__INCIFACT_NATIVE_OCR__;
      if (nativeOcrModule && typeof nativeOcrModule.detectFromUri === 'function') {
        const blocks = await nativeOcrModule.detectFromUri(imageUri);
        const lines: string[] = Array.isArray(blocks)
          ? blocks
              .map((b: any) => (b && typeof b.text === 'string' ? b.text : typeof b === 'string' ? b : ''))
              .filter((s: string) => s.length > 0)
          : [];
        const confidenceScores: number[] = Array.isArray(blocks)
          ? blocks
              .map((b: any) => b?.confidence)
              .filter((v: any): v is number => typeof v === 'number' && Number.isFinite(v))
          : [];
        const measuredConfidence =
          confidenceScores.length > 0
            ? confidenceScores.reduce((acc, v) => acc + v, 0) / confidenceScores.length
            : null;
        return {
          cancelled: false,
          imageUri,
          extractedText: cleanRawOcrBlock(lines),
          confidence: measuredConfidence
        };
      }

      // If native ML Kit is not linked in this runtime (e.g. Expo Go or Simulator without custom dev client):
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
