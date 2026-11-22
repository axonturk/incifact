/**
 * InciFact — Zero-Dependency Pure-JS 1D Barcode Scanline Decoder (EAN-13, UPC-A, EAN-8)
 * 100% platform-neutral ES module (zero Node built-ins, zero external CDN/WASM).
 * Designed as an offline Safari/Firefox compatibility fallback alongside BarcodeDetector.
 * Supports: forward/upside-down, 90-degree vertical barcodes, 1px-module EAN-8 (>=67px),
 * uneven shadow lighting (adaptive local mean fallback), 3-row/3-col noise averaging, and inverted contrast.
 */

const L_PATTERNS = Object.freeze([
  [3, 2, 1, 1], // 0: 0001101
  [2, 2, 2, 1], // 1: 0011001
  [2, 1, 2, 2], // 2: 0010011
  [1, 4, 1, 1], // 3: 0111101
  [1, 1, 3, 2], // 4: 0100011
  [1, 2, 3, 1], // 5: 0110001
  [1, 1, 1, 4], // 6: 0101111
  [1, 3, 1, 2], // 7: 0111011
  [1, 2, 1, 3], // 8: 0110111
  [3, 1, 1, 2]  // 9: 0001011
]);

const G_PATTERNS = Object.freeze([
  [1, 1, 2, 3], // 0: 0100111
  [1, 2, 2, 2], // 1: 0110011
  [2, 2, 1, 2], // 2: 0011011
  [1, 1, 4, 1], // 3: 0100001
  [2, 3, 1, 1], // 4: 0011101
  [1, 3, 2, 1], // 5: 0111001
  [4, 1, 1, 1], // 6: 0000101
  [2, 1, 3, 1], // 7: 0010001
  [3, 1, 2, 1], // 8: 0001001
  [2, 1, 1, 3]  // 9: 0010111
]);

const R_PATTERNS = L_PATTERNS; // In normalized S/B width form, R is identical width sequence to L (B3,S2,B1,S1)

const EAN13_PARITY_MAP = Object.freeze({
  LLLLLL: '0',
  LLGLGG: '1',
  LLGGLG: '2',
  LLGGGL: '3',
  LGLLGG: '4',
  LGGLLG: '5',
  LGGGLL: '6',
  LGLGLG: '7',
  LGLGGL: '8',
  LGGLGL: '9'
});

const MIN_EAN_MODULES = 67; // EAN-8 = 3 + 28 + 5 + 28 + 3 = 67 modules

/**
 * Self-contained GS1 Mod-10 check digit validation (avoids circular module imports).
 */
export function isValidGs1Mod10(digits) {
  const clean = String(digits || '').trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(clean)) return false;
  let sum = 0;
  let weight = 3;
  for (let i = clean.length - 2; i >= 0; i--) {
    sum += Number(clean[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(clean[clean.length - 1]);
}

function otsuThreshold(row) {
  const hist = new Uint32Array(256);
  const len = row.length;
  for (let i = 0; i < len; i++) {
    const v = row[i] < 0 ? 0 : row[i] > 255 ? 255 : row[i] | 0;
    hist[v]++;
  }
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumBg = 0;
  let weightBg = 0;
  let maxBetween = -1;
  let bestT = 128;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (weightBg === 0) continue;
    const weightFg = len - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const between = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (between > maxBetween) {
      maxBetween = between;
      bestT = t;
    }
  }
  return bestT;
}

function rowToAlternatingRuns(row, threshold) {
  const len = row.length;
  if (len < MIN_EAN_MODULES) return null;
  const firstIsBar = row[0] < threshold;
  const runs = [];
  const colors = [];
  let curColor = firstIsBar ? 1 : 0;
  let count = 1;
  for (let i = 1; i < len; i++) {
    const bit = row[i] < threshold ? 1 : 0;
    if (bit === curColor) {
      count++;
    } else {
      runs.push(count);
      colors.push(curColor);
      curColor = bit;
      count = 1;
    }
  }
  runs.push(count);
  colors.push(curColor);
  return { runs, colors };
}

function rowToAdaptiveRuns(row, bias = 4) {
  const len = row.length;
  if (len < MIN_EAN_MODULES) return null;
  const prefix = new Uint32Array(len + 1);
  for (let i = 0; i < len; i++) {
    prefix[i + 1] = prefix[i] + row[i];
  }
  const radius = Math.max(8, Math.min(96, Math.floor(len / 12)));
  const runs = [];
  const colors = [];
  let curColor = -1;
  let count = 0;
  for (let i = 0; i < len; i++) {
    const lo = i > radius ? i - radius : 0;
    const hi = i + radius < len ? i + radius : len - 1;
    const localMean = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
    const bit = row[i] < localMean - bias ? 1 : 0;
    if (curColor === -1) {
      curColor = bit;
      count = 1;
    } else if (bit === curColor) {
      count++;
    } else {
      runs.push(count);
      colors.push(curColor);
      curColor = bit;
      count = 1;
    }
  }
  if (curColor !== -1) {
    runs.push(count);
    colors.push(curColor);
  }
  return { runs, colors };
}

function isUniformGuard(runs, start, count) {
  let sum = 0;
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < count; i++) {
    const r = runs[start + i];
    if (!r || r <= 0) return null;
    sum += r;
    if (r < min) min = r;
    if (r > max) max = r;
  }
  const avg = sum / count;
  if (avg < 0.7 || max / min > 2.6) return null;
  return avg;
}

function matchDigitPattern(w0, w1, w2, w3, patterns) {
  const sum = w0 + w1 + w2 + w3;
  if (sum <= 0) return null;
  const scale = 7 / sum;
  const n0 = w0 * scale;
  const n1 = w1 * scale;
  const n2 = w2 * scale;
  const n3 = w3 * scale;
  let bestDigit = -1;
  let bestErr = Infinity;
  for (let d = 0; d < 10; d++) {
    const p = patterns[d];
    const d0 = Math.abs(n0 - p[0]);
    const d1 = Math.abs(n1 - p[1]);
    const d2 = Math.abs(n2 - p[2]);
    const d3 = Math.abs(n3 - p[3]);
    if (d0 > 0.7 || d1 > 0.7 || d2 > 0.7 || d3 > 0.7) continue;
    const err = d0 + d1 + d2 + d3;
    if (err < bestErr) {
      bestErr = err;
      bestDigit = d;
    }
  }
  return bestDigit >= 0 && bestErr < 1.35 ? { digit: bestDigit, err: bestErr } : null;
}

function tryDecodeEanAt(runs, colors, startIdx) {
  // Try EAN-13 (59 runs) and EAN-8 (43 runs) anchored at a bar run index
  if (colors[startIdx] !== 1) return null;

  // Attempt EAN-13 first
  if (startIdx + 59 <= runs.length) {
    const leftAvg = isUniformGuard(runs, startIdx, 3);
    if (leftAvg !== null) {
      const midIdx = startIdx + 27;
      const rightGuardIdx = startIdx + 56;
      const midAvg = isUniformGuard(runs, midIdx, 5);
      const rightAvg = isUniformGuard(runs, rightGuardIdx, 3);
      if (midAvg !== null && rightAvg !== null) {
        const modAvg = (leftAvg + midAvg + rightAvg) / 3;
        if (Math.max(leftAvg, midAvg, rightAvg) / Math.min(leftAvg, midAvg, rightAvg) <= 2.2 && modAvg >= 0.8) {
          let parityStr = '';
          let leftDigits = '';
          let ok = true;
          for (let i = 0; i < 6; i++) {
            const p = startIdx + 3 + i * 4;
            const mL = matchDigitPattern(runs[p], runs[p + 1], runs[p + 2], runs[p + 3], L_PATTERNS);
            const mG = matchDigitPattern(runs[p], runs[p + 1], runs[p + 2], runs[p + 3], G_PATTERNS);
            if (!mL && !mG) {
              ok = false;
              break;
            }
            if (mL && (!mG || mL.err <= mG.err)) {
              parityStr += 'L';
              leftDigits += String(mL.digit);
            } else {
              parityStr += 'G';
              leftDigits += String(mG.digit);
            }
          }
          if (ok && Object.hasOwn(EAN13_PARITY_MAP, parityStr)) {
            const firstDigit = EAN13_PARITY_MAP[parityStr];
            let rightDigits = '';
            for (let i = 0; i < 6; i++) {
              const p = midIdx + 5 + i * 4;
              const mR = matchDigitPattern(runs[p], runs[p + 1], runs[p + 2], runs[p + 3], R_PATTERNS);
              if (!mR) {
                ok = false;
                break;
              }
              rightDigits += String(mR.digit);
            }
            if (ok) {
              const code = firstDigit + leftDigits + rightDigits;
              if (isValidGs1Mod10(code)) {
                return { code, format: firstDigit === '0' ? 'upc_a' : 'ean_13' };
              }
            }
          }
        }
      }
    }
  }

  // Attempt EAN-8 (43 runs)
  if (startIdx + 43 <= runs.length) {
    const leftAvg = isUniformGuard(runs, startIdx, 3);
    if (leftAvg !== null) {
      const midIdx = startIdx + 19;
      const rightGuardIdx = startIdx + 40;
      const midAvg = isUniformGuard(runs, midIdx, 5);
      const rightAvg = isUniformGuard(runs, rightGuardIdx, 3);
      if (midAvg !== null && rightAvg !== null) {
        if (Math.max(leftAvg, midAvg, rightAvg) / Math.min(leftAvg, midAvg, rightAvg) <= 2.2) {
          let digits = '';
          let ok = true;
          for (let i = 0; i < 4; i++) {
            const p = startIdx + 3 + i * 4;
            const mL = matchDigitPattern(runs[p], runs[p + 1], runs[p + 2], runs[p + 3], L_PATTERNS);
            if (!mL) {
              ok = false;
              break;
            }
            digits += String(mL.digit);
          }
          if (ok) {
            for (let i = 0; i < 4; i++) {
              const p = midIdx + 5 + i * 4;
              const mR = matchDigitPattern(runs[p], runs[p + 1], runs[p + 2], runs[p + 3], R_PATTERNS);
              if (!mR) {
                ok = false;
                break;
              }
              digits += String(mR.digit);
            }
          }
          if (ok && isValidGs1Mod10(digits)) {
            return { code: digits, format: 'ean_8' };
          }
        }
      }
    }
  }

  return null;
}

function scanRunsForEan(parsed) {
  if (!parsed) return null;
  const { runs, colors } = parsed;
  for (let i = 0; i < runs.length - 42; i++) {
    if (colors[i] !== 1) continue;
    // Check quiet zone before start guard (either start of row or white space >= 2x first bar)
    if (i > 0 && runs[i - 1] < runs[i] * 2) continue;
    const hit = tryDecodeEanAt(runs, colors, i);
    if (hit) return hit;
  }
  return null;
}

function decodeSingleDirection(row, precomputedOtsu = null) {
  // Pass 1: Global Otsu thresholding with small tolerance offsets
  const baseT = precomputedOtsu !== null ? precomputedOtsu : otsuThreshold(row);
  const offsets = [0, -14, 14];
  for (let o = 0; o < offsets.length; o++) {
    const t = Math.max(12, Math.min(244, baseT + offsets[o]));
    const hit = scanRunsForEan(rowToAlternatingRuns(row, t));
    if (hit) return hit;
  }

  // Pass 2: Local adaptive mean thresholding fallback (handles uneven shadow / lighting gradients)
  const biases = [4, 0, -4];
  for (let b = 0; b < biases.length; b++) {
    const hit = scanRunsForEan(rowToAdaptiveRuns(row, biases[b]));
    if (hit) return hit;
  }
  return null;
}

function reverseRow(row) {
  const len = row.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = row[len - 1 - i];
  return out;
}

function invertRow(row) {
  const len = row.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const v = row[i] < 0 ? 0 : row[i] > 255 ? 255 : row[i] | 0;
    out[i] = 255 - v;
  }
  return out;
}

/**
 * Decodes an EAN-13, UPC-A or EAN-8 barcode from a single grayscale luminance array (`0..255` per pixel).
 * Automatically attempts forward, upside-down reversed, and inverted contrast (light bars on dark bg) scan directions.
 */
export function decode1dBarcodeFromScanline(lumaRow) {
  if (!lumaRow || lumaRow.length < MIN_EAN_MODULES) return null;

  const baseT = otsuThreshold(lumaRow);
  const forward = decodeSingleDirection(lumaRow, baseT);
  if (forward) return forward;

  const reversed = reverseRow(lumaRow);
  const back = decodeSingleDirection(reversed, baseT);
  if (back) return back;

  // Inverted contrast support (white/light bars printed on dark packaging)
  const inverted = invertRow(lumaRow);
  const invBaseT = 255 - baseT;
  const invFwd = decodeSingleDirection(inverted, invBaseT);
  if (invFwd) return invFwd;

  const invRev = reverseRow(inverted);
  return decodeSingleDirection(invRev, invBaseT);
}

/**
 * Scans horizontal bands (with 3-row vertical averaging) and 90-degree vertical columns (with 3-col averaging)
 * across an RGBA canvas buffer and returns `{ code, format }` or `null`.
 */
export function decode1dBarcodeFromRgba(rgba, width, height) {
  if (!rgba || !width || !height || width < 10 || height < 10) return null;
  if (width < MIN_EAN_MODULES && height < MIN_EAN_MODULES) return null;
  if (rgba.length < width * height * 4) return null;

  const lumaAt = (x, y) => {
    const idx = (y * width + x) * 4;
    return (77 * rgba[idx] + 150 * rgba[idx + 1] + 29 * rgba[idx + 2]) >> 8;
  };

  // 1. Horizontal bands with 3-row vertical averaging to suppress camera sensor noise
  if (width >= MIN_EAN_MODULES) {
    const bandFractions = [0.5, 0.42, 0.58, 0.34, 0.66, 0.24, 0.76];
    const row = new Uint8Array(width);

    for (let b = 0; b < bandFractions.length; b++) {
      const y = Math.max(0, Math.min(height - 1, Math.floor(height * bandFractions[b])));
      const yPrev = y > 0 ? y - 1 : y;
      const yNext = y + 1 < height ? y + 1 : y;
      for (let x = 0; x < width; x++) {
        row[x] = ((lumaAt(x, yPrev) + lumaAt(x, y) + lumaAt(x, yNext)) / 3) | 0;
      }
      const hit = decode1dBarcodeFromScanline(row);
      if (hit) return hit;
    }
  }

  // 2. 90-degree vertical column scan fallback with 3-column horizontal averaging
  if (height >= MIN_EAN_MODULES) {
    const colFractions = [0.5, 0.42, 0.58, 0.34, 0.66];
    const col = new Uint8Array(height);

    for (let c = 0; c < colFractions.length; c++) {
      const x = Math.max(0, Math.min(width - 1, Math.floor(width * colFractions[c])));
      const xPrev = x > 0 ? x - 1 : x;
      const xNext = x + 1 < width ? x + 1 : x;
      for (let y = 0; y < height; y++) {
        col[y] = ((lumaAt(xPrev, y) + lumaAt(x, y) + lumaAt(xNext, y)) / 3) | 0;
      }
      const hit = decode1dBarcodeFromScanline(col);
      if (hit) return hit;
    }
  }

  return null;
}
