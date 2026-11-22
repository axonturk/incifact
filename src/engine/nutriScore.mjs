/**
 * InciFact — Official Nutri-Score Updated Algorithm 2023 (General Foods, Fats/Oils/Nuts & Beverages, Grades A–E)
 * 100% platform-neutral ES module (zero Node built-ins, zero external requests, zero hallucination).
 * Reference: Santé publique France / International Nutri-Score Scientific Committee (2023 update).
 */

const FOOD_ENERGY_KJ_STEPS = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];
const SAT_FAT_G_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Official Santé publique France 2023 15-point solid food sugar scale
const FOOD_SUGARS_G_STEPS = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];
const SALT_G_STEPS = [
  0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
  2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0
];
const FIBER_G_STEPS = [3.0, 4.1, 5.2, 6.3, 7.4];
const FOOD_PROTEIN_G_STEPS = [2.4, 4.8, 7.2, 9.6, 12.0, 14.4, 17.0];

// Official 2023 Fats, Oils, Nuts & Seeds scales
const FATS_ENERGY_SAT_KJ_STEPS = [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200];
const FATS_SAT_RATIO_STEPS = [10, 16, 22, 28, 34, 40, 46, 52, 58, 64];

const BEV_ENERGY_KJ_STEPS = [30, 90, 150, 210, 240, 270, 300, 330, 360, 390];
const BEV_SUGARS_G_STEPS = [0.5, 2.0, 3.5, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0];
const BEV_PROTEIN_G_STEPS = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0];

const GRADE_COLORS = Object.freeze({
  A: '#038141',
  B: '#85BB2F',
  C: '#FECB02',
  D: '#EE8100',
  E: '#E63E11'
});

const NUTRISCORE_I18N = Object.freeze({
  tr: {
    cardTitle: '📊 100 g Besin Profili & Nutri-Score 2023 (A–E)',
    missingHint: '100 g/ml besin tablosu verisi (enerji, şeker, doymuş yağ, tuz) girildiğinde resmi Nutri-Score A–E hesaplanır. Eksik veride tahmin üretilmez.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Sade su (0 kcal, şekersiz, tatlandırıcısız): İçecek kuralında tek A sınıfı.',
    sweetenerPenalty: 'Yapay/kalorisiz tatlandırıcı tespit edildi (+4 N ceza puanı).',
    proteinCapNote: 'N ≥ 11 ve meyve/sebze/baklagil <%80 olduğundan protein puanı sınırlandı.',
    proteinCapFatsNote: 'Yağ/kuruyemiş kategorisinde N ≥ 7 olduğundan protein puanı sınırlandı.',
    fatsCategoryNote: '2023 Yağ, Sıvı Yağ ve Kuruyemiş ölçeği uygulandı (doymuş yağ enerjisi ve doymuş/toplam yağ oranı).',
    sugarsLbl: 'Şeker',
    satFatLbl: 'Doymuş Yağ',
    saltLbl: 'Tuz',
    levels: { low: 'Düşük', medium: 'Orta', high: 'Yüksek' }
  },
  en: {
    cardTitle: '📊 Per-100g Nutrition & Nutri-Score 2023 (A–E)',
    missingHint: 'Enter per-100g/ml nutrition values (energy, sugars, saturated fat, salt) to compute official Nutri-Score A–E. Never estimated when missing.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Plain water (0 kcal, zero sugars/sweeteners): sole Grade A under 2023 beverage rules.',
    sweetenerPenalty: 'Non-nutritive sweetener penalty applied (+4 N points).',
    proteinCapNote: 'Protein points capped because N ≥ 11 and fruit/veg/legumes < 80%.',
    proteinCapFatsNote: 'Protein points capped because N ≥ 7 under the 2023 fats/oils/nuts scale.',
    fatsCategoryNote: '2023 Fats, Oils, Nuts & Seeds scoring applied (energy from saturates & saturated/total fat ratio).',
    sugarsLbl: 'Sugars',
    satFatLbl: 'Sat. Fat',
    saltLbl: 'Salt',
    levels: { low: 'Low', medium: 'Moderate', high: 'High' }
  },
  ar: {
    cardTitle: '📊 القيم الغذائية لكل 100غ و Nutri-Score 2023 (A–E)',
    missingHint: 'أدخل قيم 100 غ/مل (الطاقة، السكر، الدهون المشبعة، الملح) لحساب Nutri-Score الرسمي بدقة دون تخمين.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'ماء نقي (0 سعرة، بدون سكر أو محليات): الفئة الوحيدة الحاصلة على A في المشروبات.',
    sweetenerPenalty: 'تطبيق خصم المحليات غير الغذائية (+4 نقاط N).',
    proteinCapNote: 'تم تحديد نقاط البروتين لأن N ≥ 11 ونسبة الفاكهة/الخضار < 80%.',
    proteinCapFatsNote: 'تم تحديد نقاط البروتين لأن N ≥ 7 في فئة الزيوت والدهون والمكسرات.',
    fatsCategoryNote: 'تم تطبيق مقياس الزيوت والدهون والمكسرات 2023 (طاقة الدهون المشبعة ونسبتها لإجمالي الدهون).',
    sugarsLbl: 'السكر',
    satFatLbl: 'دهون مشبعة',
    saltLbl: 'ملح',
    levels: { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }
  },
  de: {
    cardTitle: '📊 Nährwerte pro 100 g & Nutri-Score 2023 (A–E)',
    missingHint: 'Nährwerte je 100 g/ml (Energie, Zucker, gesättigte Fettsäuren, Salz) eingeben. Ohne Daten keine Schätzung.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Reines Wasser: einzige Klasse A bei Getränken (2023).',
    sweetenerPenalty: 'Süßstoff-Zuschlag bei Getränken (+4 N-Punkte).',
    proteinCapNote: 'Proteinpunkte begrenzt (N ≥ 11 und Obst/Gemüse < 80%).',
    proteinCapFatsNote: 'Proteinpunkte in der Kategorie Fette/Öle/Nüsse begrenzt (N ≥ 7).',
    fatsCategoryNote: '2023-Skala für Fette, Öle, Nüsse & Samen angewendet (Energie aus gesättigten Fettsäuren & Verhältnis).',
    sugarsLbl: 'Zucker',
    satFatLbl: 'Ges. Fett',
    saltLbl: 'Salz',
    levels: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }
  },
  fr: {
    cardTitle: '📊 Valeurs pour 100 g & Nutri-Score 2023 (A–E)',
    missingHint: 'Saisissez les valeurs pour 100 g/ml (énergie, sucres, acides gras saturés, sel). Aucune estimation sans données.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Eau pure : seule catégorie A pour les boissons (algorithme 2023).',
    sweetenerPenalty: 'Malus édulcorants appliqué (+4 points N).',
    proteinCapNote: 'Points protéines plafonnés (N ≥ 11 et fruits/légumes < 80 %).',
    proteinCapFatsNote: 'Points protéines plafonnés pour matières grasses/huiles/noix (N ≥ 7).',
    fatsCategoryNote: 'Barème 2023 Matières grasses, huiles et noix appliqué (énergie des saturés et ratio saturés/lipides).',
    sugarsLbl: 'Sucres',
    satFatLbl: 'Gras saturés',
    saltLbl: 'Sel',
    levels: { low: 'Faible', medium: 'Modéré', high: 'Élevé' }
  },
  id: {
    cardTitle: '📊 Gizi per 100 g & Nutri-Score 2023 (A–E)',
    missingHint: 'Masukkan data gizi per 100 g/ml (energi, gula, lemak jenuh, garam) untuk menghitung Nutri-Score resmi tanpa menebak.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Air putih murni: satu-satunya peringkat A untuk kategori minuman (2023).',
    sweetenerPenalty: 'Penalti pemanis non-gizi pada minuman (+4 poin N).',
    proteinCapNote: 'Poin protein dibatasi karena N ≥ 11 dan buah/sayur < 80%.',
    proteinCapFatsNote: 'Poin protein dibatasi karena N ≥ 7 pada kategori lemak/minyak/kacang.',
    fatsCategoryNote: 'Skala Lemak, Minyak & Kacang 2023 diterapkan (energi lemak jenuh & rasio lemak jenuh/total).',
    sugarsLbl: 'Gula',
    satFatLbl: 'Lemak Jenuh',
    saltLbl: 'Garam',
    levels: { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }
  },
  ms: {
    cardTitle: '📊 Pemakanan 100 g & Nutri-Score 2023 (A–E)',
    missingHint: 'Masukkan nilai 100 g/ml (tenaga, gula, lemak tepu, garam) untuk pengiraan Nutri-Score rasmi tanpa tekaan.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Air kosong tulen: satu-satunya gred A bagi minuman (2023).',
    sweetenerPenalty: 'Penalti pemanis tanpa zat dikenakan (+4 mata N).',
    proteinCapNote: 'Mata protein dihadkan kerana N ≥ 11 dan buah/sayur < 80%.',
    proteinCapFatsNote: 'Mata protein dihadkan kerana N ≥ 7 bagi kategori lemak/minyak/kekacang.',
    fatsCategoryNote: 'Skala Lemak, Minyak & Kekacang 2023 digunakan (tenaga lemak tepu & nisbah lemak tepu/jumlah).',
    sugarsLbl: 'Gula',
    satFatLbl: 'Lemak Tepu',
    saltLbl: 'Garam',
    levels: { low: 'Rendah', medium: 'Sederhana', high: 'Tinggi' }
  },
  es: {
    cardTitle: '📊 Nutrición por 100 g y Nutri-Score 2023 (A–E)',
    missingHint: 'Introduce los valores por 100 g/ml (energía, azúcares, grasas saturadas, sal) para calcular el Nutri-Score sin estimaciones.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Agua natural: única categoría A en bebidas (algoritmo 2023).',
    sweetenerPenalty: 'Penalización por edulcorantes en bebidas (+4 puntos N).',
    proteinCapNote: 'Puntos de proteína limitados (N ≥ 11 y fruta/verdura < 80%).',
    proteinCapFatsNote: 'Puntos de proteína limitados en grasas/aceites/frutos secos (N ≥ 7).',
    fatsCategoryNote: 'Baremo 2023 de grasas, aceites y frutos secos aplicado (energía de saturadas y ratio saturadas/total).',
    sugarsLbl: 'Azúcares',
    satFatLbl: 'Grasas sat.',
    saltLbl: 'Sal',
    levels: { low: 'Bajo', medium: 'Moderado', high: 'Alto' }
  },
  ru: {
    cardTitle: '📊 Питательность на 100 г и Nutri-Score 2023 (A–E)',
    missingHint: 'Укажите значения на 100 г/мл (энергия, сахар, насыщ. жиры, соль) для точного расчёта без догадок.',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'Чистая вода: единственная категория A среди напитков (2023).',
    sweetenerPenalty: 'Штраф за некалорийные подсластители (+4 балла N).',
    proteinCapNote: 'Баллы за белок ограничены (N ≥ 11 и овощи/фрукты < 80%).',
    proteinCapFatsNote: 'Баллы за белок ограничены для категории жиров/масел/орехов (N ≥ 7).',
    fatsCategoryNote: 'Применена шкала 2023 для жиров, масел и орехов (энергия насыщ. жиров и их доля).',
    sugarsLbl: 'Сахар',
    satFatLbl: 'Насыщ. жиры',
    saltLbl: 'Соль',
    levels: { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
  },
  ur: {
    cardTitle: '📊 فی 100 گرام غذائیت اور Nutri-Score 2023 (A–E)',
    missingHint: 'درست Nutri-Score حساب کے لیے فی 100 گرام/ملی لیٹر (توانائی، شکر، سیر شدہ چکنائی، نمک) درج کریں؛ بغیر ڈیٹا قیاس نہیں کیا جاتا۔',
    gradeLabel: (g) => `Nutri-Score ${g}`,
    waterNote: 'سادہ پانی: 2023 مشروبات کے اصولوں میں واحد A درجہ۔',
    sweetenerPenalty: 'مشروبات میں مصنوعی مٹھاس جرمانہ لاگو (+4 N پوائنٹس)۔',
    proteinCapNote: 'پروٹین پوائنٹس محدود ہیں کیونکہ N ≥ 11 اور پھل/سبزیاں < 80%۔',
    proteinCapFatsNote: 'تیل، چکنائی اور میوہ جات کے زمرے میں N ≥ 7 ہونے پر پروٹین پوائنٹس محدود ہیں۔',
    fatsCategoryNote: '2023 تیل، چکنائی اور میوہ جات کا پیمانہ لاگو کیا گیا (سیر شدہ چکنائی کی توانائی اور تناسب)۔',
    sugarsLbl: 'شکر',
    satFatLbl: 'سیر شدہ چکنائی',
    saltLbl: 'نمک',
    levels: { low: 'کم', medium: 'درمیانہ', high: 'زیادہ' }
  }
});

function scoreAboveThresholds(value, thresholds) {
  let pts = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value > thresholds[i]) pts++;
    else break;
  }
  return pts;
}

function scoreAtOrAboveThresholds(value, thresholds) {
  let pts = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) pts++;
    else break;
  }
  return pts;
}

function toFiniteNonNeg(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function buildTrafficLight(sugarsG, saturatedFatG, saltG, isBeverage, txt) {
  // Official UK FSA Front-of-Pack Traffic Light thresholds (drinks vs solid foods)
  const sLow = isBeverage ? 2.5 : 5.0;
  const sHigh = isBeverage ? 11.25 : 22.5;
  const fLow = isBeverage ? 0.75 : 1.5;
  const fHigh = isBeverage ? 2.5 : 5.0;
  const naLow = 0.3;
  const naHigh = isBeverage ? 0.75 : 1.5;

  const rate = (val, low, high) => {
    if (val <= low) return { level: 'low', color: 'yesil', label: txt.levels.low };
    if (val <= high) return { level: 'medium', color: 'sari', label: txt.levels.medium };
    return { level: 'high', color: 'kirmizi', label: txt.levels.high };
  };

  return {
    sugars: { value: Number(sugarsG.toFixed(2)), unit: 'g', title: txt.sugarsLbl, ...rate(sugarsG, sLow, sHigh) },
    saturatedFat: { value: Number(saturatedFatG.toFixed(2)), unit: 'g', title: txt.satFatLbl, ...rate(saturatedFatG, fLow, fHigh) },
    salt: { value: Number(saltG.toFixed(2)), unit: 'g', title: txt.saltLbl, ...rate(saltG, naLow, naHigh) }
  };
}

/**
 * Evaluates official updated Nutri-Score (2023) A–E classification from per-100g/ml nutrition data.
 * Supports General Foods, Beverages, and Fats/Oils/Nuts/Seeds.
 * Enforces Zero-Hallucination: returns `grade: null` and `available: false` when required data is missing.
 */
export function evaluateNutriScore(nutritionPer100g, options = {}) {
  const lang = options && Object.hasOwn(NUTRISCORE_I18N, options.lang) ? options.lang : 'en';
  const txt = NUTRISCORE_I18N[lang];
  const source = (options && options.source) || null;
  const raw = nutritionPer100g && typeof nutritionPer100g === 'object' ? nutritionPer100g : null;

  if (!raw) {
    return {
      available: false,
      isComplete: false,
      cardTitle: txt.cardTitle,
      grade: null,
      gradeColor: null,
      score: null,
      category: 'general_food',
      negativePoints: null,
      positivePoints: null,
      trafficLights: null,
      missingFields: ['energy', 'sugarsG', 'saturatedFatG', 'saltG'],
      notes: [txt.missingHint],
      source
    };
  }

  const kjRaw = toFiniteNonNeg(raw.energyKj);
  const kcalRaw = toFiniteNonNeg(raw.energyKcal);
  const energyKj = kjRaw !== null ? kjRaw : kcalRaw !== null ? kcalRaw * 4.184 : null;
  const sugarsG = toFiniteNonNeg(raw.sugarsG);
  const saturatedFatG = toFiniteNonNeg(raw.saturatedFatG);
  const totalFatG = toFiniteNonNeg(raw.totalFatG) ?? toFiniteNonNeg(raw.fatG);
  const saltRaw = toFiniteNonNeg(raw.saltG);
  const sodiumMgRaw = toFiniteNonNeg(raw.sodiumMg);
  const saltG = saltRaw !== null ? saltRaw : sodiumMgRaw !== null ? (sodiumMgRaw * 2.5) / 1000 : null;

  const isBeverage = Boolean(
    raw.isBeverage ||
      options.isBeverage ||
      raw.isWater ||
      options.isWater ||
      raw.category === 'beverage' ||
      options.category === 'beverage'
  );
  const isFatsOilsNuts =
    !isBeverage &&
    Boolean(
      raw.category === 'fats_oils_nuts' ||
        options.category === 'fats_oils_nuts' ||
        raw.isFatOilNut ||
        options.isFatOilNut
    );

  const missingFields = [];
  if (!isFatsOilsNuts && energyKj === null) missingFields.push('energy');
  if (sugarsG === null) missingFields.push('sugarsG');
  if (saturatedFatG === null) missingFields.push('saturatedFatG');
  if (saltG === null) missingFields.push('saltG');
  if (isFatsOilsNuts && saturatedFatG !== null && saturatedFatG > 0 && (totalFatG === null || totalFatG <= 0)) {
    missingFields.push('totalFatG');
  }

  const resolvedCategory = isBeverage ? 'beverage' : isFatsOilsNuts ? 'fats_oils_nuts' : 'general_food';

  if (missingFields.length > 0) {
    return {
      available: false,
      isComplete: false,
      cardTitle: txt.cardTitle,
      grade: null,
      gradeColor: null,
      score: null,
      category: resolvedCategory,
      negativePoints: null,
      positivePoints: null,
      trafficLights: null,
      missingFields,
      notes: [txt.missingHint],
      source
    };
  }

  const fiberG = toFiniteNonNeg(raw.fiberG) ?? 0;
  const proteinG = toFiniteNonNeg(raw.proteinG) ?? 0;
  const explicitFvl = toFiniteNonNeg(raw.fruitVegLegumePct);
  const fvlPct = Math.min(100, explicitFvl ?? 0);
  const hasNns = Boolean(raw.hasNonNutritiveSweetener || options.hasNonNutritiveSweetener);
  const trafficLights = buildTrafficLight(sugarsG, saturatedFatG, saltG, isBeverage, txt);
  const notes = [];

  if (isBeverage) {
    // Only explicit plain water with 0 energy, 0 sugars, 0 sat fat, 0 salt and zero sweeteners earns Grade A.
    const isPlainWater =
      Boolean(raw.isWater || options.isWater) &&
      energyKj === 0 &&
      sugarsG === 0 &&
      saturatedFatG === 0 &&
      saltG === 0 &&
      !hasNns;

    if (isPlainWater) {
      notes.push(txt.waterNote);
      return {
        available: true,
        isComplete: true,
        cardTitle: txt.cardTitle,
        grade: 'A',
        gradeLabel: txt.gradeLabel('A'),
        gradeColor: GRADE_COLORS.A,
        score: -10,
        category: 'beverage',
        negativePoints: 0,
        positivePoints: 0,
        breakdown: { energyPts: 0, satFatPts: 0, sugarsPts: 0, saltPts: 0, sweetenerPts: 0, fiberPts: 0, proteinPts: 0, fvlPts: 0 },
        trafficLights,
        missingFields: [],
        notes,
        source
      };
    }

    const energyPts = scoreAboveThresholds(energyKj, BEV_ENERGY_KJ_STEPS);
    const satFatPts = scoreAboveThresholds(saturatedFatG, SAT_FAT_G_STEPS);
    const sugarsPts = scoreAboveThresholds(sugarsG, BEV_SUGARS_G_STEPS);
    const saltPts = scoreAboveThresholds(saltG, SALT_G_STEPS);
    const sweetenerPts = hasNns ? 4 : 0;
    if (hasNns) notes.push(txt.sweetenerPenalty);

    const nPts = energyPts + satFatPts + sugarsPts + saltPts + sweetenerPts;
    const fiberPts = scoreAboveThresholds(fiberG, FIBER_G_STEPS);
    const proteinPts = scoreAboveThresholds(proteinG, BEV_PROTEIN_G_STEPS);
    const fvlPts = fvlPct > 80 ? 6 : fvlPct > 60 ? 4 : fvlPct > 40 ? 2 : 0;
    const pPts = fiberPts + proteinPts + fvlPts;
    const score = nPts - pPts;

    // 2023 beverage grade cut-offs: only plain water receives A; unsweetened tea/coffee/other beverages B..E
    const grade = score <= 2 ? 'B' : score <= 6 ? 'C' : score <= 9 ? 'D' : 'E';

    return {
      available: true,
      isComplete: true,
      cardTitle: txt.cardTitle,
      grade,
      gradeLabel: txt.gradeLabel(grade),
      gradeColor: GRADE_COLORS[grade],
      score,
      category: 'beverage',
      negativePoints: nPts,
      positivePoints: pPts,
      breakdown: { energyPts, satFatPts, sugarsPts, saltPts, sweetenerPts, fiberPts, proteinPts, fvlPts },
      trafficLights,
      missingFields: [],
      notes,
      source
    };
  }

  if (isFatsOilsNuts) {
    // Official 2023 Fats, Oils, Nuts & Seeds scoring
    const energySatKj = saturatedFatG * 37;
    const energyPts = scoreAboveThresholds(energySatKj, FATS_ENERGY_SAT_KJ_STEPS);
    const satRatioPct =
      totalFatG !== null && totalFatG > 0 ? Math.min(100, (saturatedFatG / totalFatG) * 100) : 0;
    const satFatPts = saturatedFatG > 0 ? scoreAtOrAboveThresholds(satRatioPct, FATS_SAT_RATIO_STEPS) : 0;
    const sugarsPts = scoreAboveThresholds(sugarsG, FOOD_SUGARS_G_STEPS);
    const saltPts = scoreAboveThresholds(saltG, SALT_G_STEPS);
    const nPts = energyPts + satFatPts + sugarsPts + saltPts;

    const fiberPts = scoreAboveThresholds(fiberG, FIBER_G_STEPS);
    const rawProteinPts = scoreAboveThresholds(proteinG, FOOD_PROTEIN_G_STEPS);
    const isEligibleOil = Boolean(raw.isEligibleOil || options.isEligibleOil);
    const effectiveFvlPct = explicitFvl !== null ? fvlPct : isEligibleOil ? 100 : 0;
    const fvlPts = effectiveFvlPct > 80 ? 5 : effectiveFvlPct > 60 ? 2 : effectiveFvlPct > 40 ? 1 : 0;

    let proteinPts = rawProteinPts;
    if (nPts >= 7) {
      proteinPts = 0;
      if (rawProteinPts > 0) notes.push(txt.proteinCapFatsNote);
    }
    notes.push(txt.fatsCategoryNote);

    const pPts = fiberPts + proteinPts + fvlPts;
    const score = nPts - pPts;
    const grade = score <= -6 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';

    return {
      available: true,
      isComplete: true,
      cardTitle: txt.cardTitle,
      grade,
      gradeLabel: txt.gradeLabel(grade),
      gradeColor: GRADE_COLORS[grade],
      score,
      category: 'fats_oils_nuts',
      negativePoints: nPts,
      positivePoints: pPts,
      breakdown: {
        energyPts,
        energySatKj: Number(energySatKj.toFixed(1)),
        satFatPts,
        satRatioPct: Number(satRatioPct.toFixed(1)),
        sugarsPts,
        saltPts,
        sweetenerPts: 0,
        fiberPts,
        proteinPts,
        fvlPts
      },
      trafficLights,
      missingFields: [],
      notes,
      source
    };
  }

  // General solid food 2023 updated scoring
  const energyPts = scoreAboveThresholds(energyKj, FOOD_ENERGY_KJ_STEPS);
  const satFatPts = scoreAboveThresholds(saturatedFatG, SAT_FAT_G_STEPS);
  const sugarsPts = scoreAboveThresholds(sugarsG, FOOD_SUGARS_G_STEPS);
  const saltPts = scoreAboveThresholds(saltG, SALT_G_STEPS);
  const nPts = energyPts + satFatPts + sugarsPts + saltPts;

  const fiberPts = scoreAboveThresholds(fiberG, FIBER_G_STEPS);
  const rawProteinPts = scoreAboveThresholds(proteinG, FOOD_PROTEIN_G_STEPS);
  const fvlPts = fvlPct > 80 ? 5 : fvlPct > 60 ? 2 : fvlPct > 40 ? 1 : 0;

  let proteinPts = rawProteinPts;
  if (nPts >= 11 && fvlPts < 5) {
    proteinPts = 0;
    if (rawProteinPts > 0) notes.push(txt.proteinCapNote);
  }
  const pPts = fiberPts + proteinPts + fvlPts;
  const score = nPts - pPts;

  const grade = score <= 0 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';

  return {
    available: true,
    isComplete: true,
    cardTitle: txt.cardTitle,
    grade,
    gradeLabel: txt.gradeLabel(grade),
    gradeColor: GRADE_COLORS[grade],
    score,
    category: 'general_food',
    negativePoints: nPts,
    positivePoints: pPts,
    breakdown: { energyPts, satFatPts, sugarsPts, saltPts, sweetenerPts: 0, fiberPts, proteinPts, fvlPts },
    trafficLights,
    missingFields: [],
    notes,
    source
  };
}
