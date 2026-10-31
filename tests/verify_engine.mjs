import assert from 'node:assert/strict';
import {
  evaluateProduct,
  compareProducts,
  parseIngredientList,
  normalizeBarcodeInput,
  lookupBarcodeProduct,
  createCustomBarcodeEntry,
  VERIFIED_BARCODE_CATALOG
} from '../src/engine/ruleEngine.mjs';

console.log('======================================================================');
console.log('🧪 ÇAPRAZ-AI DOĞRULAMA KURAL MOTORU TEST PAKETİ (58 KABUL KRİTERİ)');
console.log('======================================================================\n');

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ [BAŞARILI] ${name}`);
  } catch (err) {
    console.error(`❌ [HATA] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Cetearyl Alcohol & Phenoxyethanol -> False-Positive Shield (NOT Ethanol!)
runTest('1. Yağ Alkolü (Cetearyl Alcohol) ve Phenoxyethanol yanlışlıkla Etil Alkol/Haram sayılmamalı', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Phenoxyethanol, Niacinamide',
    productType: 'cosmetic',
    halalAuthority: 'GIMDES'
  });
  assert.equal(res.cards.halalCard.findings.filter((f) => f.category === 'B_alkol').length, 0);
  assert.equal(res.cards.halalCard.falsePositiveShields.length, 3); // Cetearyl Alcohol, Cetyl Alcohol, Phenoxyethanol
  assert.equal(res.cards.regulatoryCard.score, 100);
});

// 2. Standalone "BHA" -> Ambiguity detection (No decision until confirmed)
runTest('2. Tek başına "BHA" okunduğunda (Butylated Hydroxyanisole vs Salicylic Acid) karar üretmeyip doğrulama istemeli', () => {
  const resUnconfirmed = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol, BHA',
    productType: 'cosmetic'
  });
  assert.equal(resUnconfirmed.unresolvedConfirmations.length, 1);
  assert.equal(resUnconfirmed.cards.regulatoryCard.canShowScore, false);
  assert.equal(resUnconfirmed.cards.regulatoryCard.score, null);
  assert.equal(resUnconfirmed.cards.regulatoryCard.scoreSuppressionReason, 'awaiting_user_confirmation');

  // Now confirm BHA as Salicylic Acid
  const resConfirmed = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol, BHA',
    productType: 'cosmetic',
    userConfirmations: { BHA: 'salicylic_acid' }
  });
  assert.equal(resConfirmed.unresolvedConfirmations.length, 0);
  assert.equal(resConfirmed.cards.regulatoryCard.canShowScore, true);
  assert.ok(resConfirmed.cards.regulatoryCard.score > 90);
});

// 3. OCR Code Corruption "C1 7547O" -> Candidate CI 75470 requiring confirmation
runTest('3. OCR kod hatası ("C1 7547O") otomatik hüküm vermemeli, CI 75470 adayı olarak onay istemeli', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Aqua, Glycerin, Panthenol, Tocopherol, C1 7547O',
    productType: 'cosmetic'
  });
  assert.equal(res.unresolvedConfirmations.length, 1);
  assert.equal(res.unresolvedConfirmations[0].candidateCode, 'CI 75470');
  assert.equal(res.cards.regulatoryCard.score, null);
});

// 4. Pork Gelatin + Verified Vegan Claim -> CONFLICT!
runTest('4. "Pork Gelatin" veya "Gelatin" ile "Vegan" sertifikası bir arada gelirse ÇELİŞKİ (CONFLICT) vermeli', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Sugar, Water, Pork Gelatin, Citric Acid',
    productType: 'food',
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
  });
  assert.equal(res.cards.halalCard.overallStatus, 'conflict');
  assert.equal(res.cards.veganSugarCard.veganCompatibility, 'conflict');
});

// 5. E120 (Carmine) Authority Switch (GIMDES = kirmizi vs JAKIM / MUI = yesil)
runTest('5. Karmin (E120) otorite seçimine göre GİMDES\'te Kırmızı, JAKIM ve MUI\'de Yeşil dönmeli', () => {
  const resGimdes = evaluateProduct({
    rawText: 'İçindekiler: Sugar, Water, Citric Acid, Carmine (E120)',
    productType: 'food',
    halalAuthority: 'GIMDES'
  });
  const resMui = evaluateProduct({
    rawText: 'İçindekiler: Sugar, Water, Citric Acid, Carmine (E120)',
    productType: 'food',
    halalAuthority: 'MUI'
  });
  assert.equal(resGimdes.cards.halalCard.findings[0].status, 'kirmizi');
  assert.equal(resMui.cards.halalCard.findings[0].status, 'yesil');
});

// 6. E124 (Ponceau 4R / Cochineal Red A) False-Positive Trap
runTest('6. E124 (Cochineal Red A / Ponceau 4R) böcek kaynaklı Karmin (E120) sanılmamalı, ama Çocuk profilinde Southampton uyarısı vermeli', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Water, Sugar, Citric Acid, Cochineal Red A',
    productType: 'food',
    userProfiles: ['cocuk_metabolik'],
    halalAuthority: 'GIMDES'
  });
  // Should NOT trigger Carmine E120 in Halal card
  assert.equal(res.cards.halalCard.findings.length, 0);
  // Should trigger Red in child_metabolic profile (Southampton 6)
  assert.equal(res.cards.profileCard.profileStatuses.cocuk_metabolik, 'false');
  assert.equal(res.cards.profileCard.alerts[0].level, 'kirmizi');
});

// 7. E471 + Verified Vegan Claim -> Resolves C_musbooh to Green, while Ethanol + Vegan stays unresolved!
runTest('7. Doğrulanmış Vegan logosu E471\'i Yeşil yapmalı ama Etil Alkolü (Ethanol) ÇÖZMEMELİ', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Water, Sugar, Mono- and diglycerides of fatty acids (E471), Ethanol',
    productType: 'food',
    halalAuthority: 'GIMDES',
    claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
  });
  const e471Finding = res.cards.halalCard.findings.find((f) => f.ruleId === 'e471');
  const ethanolFinding = res.cards.halalCard.findings.find((f) => f.ruleId === 'ethanol_cosmetic_or_food');
  assert.equal(e471Finding.status, 'yesil');
  assert.equal(ethanolFinding.status, 'kirmizi');
});

// 8. Titanium Dioxide (E171 vs CI 77891) Product-Type Switch
runTest('8. Titanium Dioxide Gıdada (E171) AB Yasaklı (Tavan Skor 10) iken Kozmetikte (CI 77891) İzinli olmalı', () => {
  const resFood = evaluateProduct({
    rawText: 'İçindekiler: Sugar, Water, Citric Acid, Titanium Dioxide',
    productType: 'food'
  });
  const resCosmetic = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Cetyl Alcohol, Titanium Dioxide',
    productType: 'cosmetic'
  });
  assert.equal(resFood.cards.regulatoryCard.score, 10);
  assert.equal(resFood.cards.regulatoryCard.capApplied, 10);
  assert.equal(resCosmetic.cards.regulatoryCard.score, 100);
});

// 9. Paraben Differentiation (Methylparaben = Permitted vs Isobutylparaben = Banned Cap 10)
runTest('9. Methylparaben izinli/düşük etki alırken Isobutylparaben AB Yasaklı (Tavan Skor 10) almalı', () => {
  const resMethyl = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol, Methylparaben',
    productType: 'cosmetic'
  });
  const resIsobutyl = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol, Isobutylparaben',
    productType: 'cosmetic'
  });
  assert.ok(resMethyl.cards.regulatoryCard.score >= 95);
  assert.equal(resIsobutyl.cards.regulatoryCard.score, 10);
});

// 10. Bakuchiol in Pregnancy -> 'veri_yok' (unknown preference match, NOT false red or false green)
runTest('10. Bakuchiol hamilelik profilinde "veri_yok" (unknown) dönmeli ve tercih eşleşme puanını null yapmalı', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Squalane, Niacinamide, Bakuchiol',
    productType: 'cosmetic',
    userProfiles: ['hamilelik']
  });
  assert.equal(res.cards.profileCard.profileStatuses.hamilelik, 'unknown');
  assert.equal(res.cards.profileCard.preferenceMatchScore, null);
  assert.equal(res.cards.regulatoryCard.score, 100);
});

// 11. Position-Conditional Rule: Alcohol Denat. in Top 5 vs Position 8
runTest('11. Alcohol Denat. ilk 5 sıradaysa Hassas Cilt uyarısı vermeli, 7. sıradaysa vermemeli', () => {
  const resTop5 = evaluateProduct({
    rawText: 'Ingredients: Aqua, Alcohol Denat., Glycerin, Niacinamide, Panthenol',
    productType: 'cosmetic',
    userProfiles: ['hassas_cilt']
  });
  const resPos7 = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol, Squalane, Cetyl Alcohol, Alcohol Denat.',
    productType: 'cosmetic',
    userProfiles: ['hassas_cilt']
  });
  assert.equal(resTop5.cards.profileCard.profileStatuses.hassas_cilt, 'false');
  assert.equal(resPos7.cards.profileCard.profileStatuses.hassas_cilt, 'true');
});

// 12. Line-Break Hyphenation Normalization ("Methyliso-\nthiazolinone")
runTest('12. Satır sonu tire bölünmesi ("Methyliso-\\nthiazolinone") sözlük kontrolüyle birleştirilmeli', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol, Methyliso-\nthiazolinone',
    productType: 'cosmetic',
    userProfiles: ['hassas_cilt']
  });
  assert.equal(res.cards.profileCard.profileStatuses.hassas_cilt, 'false');
  assert.equal(res.cards.profileCard.alerts[0].substanceName, 'Methylisothiazolinone (MI) & MCI/MI');
});

// 13. Coverage < 80% Score Suppression
runTest('13. Tanınan bileşen kapsamı %80 altındaysa sayısal skor gizlenmeli (null)', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, UnknownPlantExtractX, UnknownPeptideY, UnknownPolymerZ',
    productType: 'cosmetic'
  });
  assert.equal(res.cards.regulatoryCard.coveragePercent, 25);
  assert.equal(res.cards.regulatoryCard.canShowScore, false);
  assert.equal(res.cards.regulatoryCard.score, null);
});

// 14. Hidden Sugars vs Maltodextrin (Rapid Carb) Separation
runTest('14. Gizli şekerler (Glikoz-fruktoz şurubu, Dekstroz) ile Maltodekstrin ayrı sınıflandırılmalı', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Su, Glikoz-fruktoz şurubu, Dekstroz, Maltodekstrin, Sitrik Asit',
    productType: 'food'
  });
  assert.equal(res.cards.veganSugarCard.freeSugarCount, 2);
  assert.equal(res.cards.veganSugarCard.detectedRapidCarbs.length, 1);
  assert.equal(res.cards.veganSugarCard.detectedRapidCarbs[0].canonical, 'Maltodextrin');
});

// 15. Comedogenic Esters (Isopropyl Myristate) -> Does NOT reduce Regulatory Score, only alerts 'akne' profile
runTest('15. Komedojenik yağ/esterler (Isopropyl Myristate) genel regülasyon skorunu düşürmemeli, yalnız Akne profilini uyarmalı', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol, Isopropyl Myristate',
    productType: 'cosmetic',
    userProfiles: ['akne']
  });
  assert.equal(res.cards.regulatoryCard.score, 100);
  assert.equal(res.cards.profileCard.profileStatuses.akne, 'false');
});

// 16. skorlama.json Exact Benchmark: Isopropyl Myristate (0) + Propylparaben (10) + Linalool (3) = 87
runTest('16. skorlama.json referans testi: Isopropyl Myristate (0) + Propylparaben (10) + Linalool (3) -> Skor tam 87 olmalı', () => {
  const res = evaluateProduct({
    rawText:
      'Ingredients: Aqua, Isopropyl Myristate, Glycerin, Cetyl Alcohol, Cetearyl Alcohol, Stearyl Alcohol, Dimethicone, Squalane, Niacinamide, Panthenol, Tocopherol, Sodium Hyaluronate, Ceramide NP, Propylparaben, Xanthan Gum, Carbomer, Citric Acid, Linalool',
    productType: 'cosmetic',
    userProfiles: ['akne', 'hassas_cilt']
  });
  assert.equal(res.cards.regulatoryCard.score, 87);
  assert.equal(res.cards.regulatoryCard.capApplied, null);
});

// 17. Sulfites (E220) -> General score 100 (1_bilgi), Asthma/Allergy profile Red
runTest('17. Sülfitler (E220) genel regülasyon skorunu düşürmemeli (100), Astım/Alerji profilinde Kırmızı vermeli', () => {
  const res = evaluateProduct({
    rawText: 'İçindekiler: Su, Sitrik Asit, Sodyum Klorür, E220',
    productType: 'food',
    userProfiles: ['astim_alerji']
  });
  assert.equal(res.cards.regulatoryCard.score, 100);
  assert.equal(res.cards.profileCard.profileStatuses.astim_alerji, 'false');
  assert.equal(res.cards.profileCard.alerts[0].level, 'kirmizi');
});

// 18. Side-by-Side Comparison (compareProducts) -> Identifies Deciding Difference automatically
runTest('18. Yan Yana Karşılaştırma (compareProducts) iki ürün arasındaki farkı yaratan maddeyi otomatik bulmalı', () => {
  const comp = compareProducts(
    {
      name: 'Temizleme jeli A',
      productType: 'cosmetic',
      rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Panthenol, Niacinamide, Sodium Hyaluronate'
    },
    {
      name: 'Temizleme jeli B',
      productType: 'cosmetic',
      rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Panthenol, Niacinamide, Methylisothiazolinone'
    },
    { userProfiles: ['hassas_cilt'] }
  );
  assert.equal(comp.brand, 'InciFact');
  assert.ok(comp.productA.score > comp.productB.score);
  assert.equal(comp.productA.profileStatus, 'Uygun');
  assert.equal(comp.productB.profileStatus, 'Kaçın / Dikkat');
  assert.ok(comp.decidingDifference);
  assert.equal(comp.decidingDifference.onlyInSide, 'B');
  assert.ok(comp.decidingDifference.substanceName.includes('Methylisothiazolinone'));
});

// 19. "Sodium Laur?l Sulfate" OCR Ambiguity -> Asks SLS vs SLES confirmation
runTest('19. "Sodium Laur?l Sulfate" OCR belirsizliğinde tahmin yürütmeyip SLS vs SLES onayı istemeli', () => {
  const res = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Sodium Laur?l Sulfate, Panthenol',
    productType: 'cosmetic'
  });
  assert.equal(res.unresolvedConfirmations.length, 1);
  assert.equal(res.unresolvedConfirmations[0].options.length, 2);
  assert.equal(res.unresolvedConfirmations[0].options[0].id, 'sls');
  assert.equal(res.unresolvedConfirmations[0].options[1].id, 'sles');
});

// 20. 10-Language Localization & RTL (Arabic 'ar' and Urdu 'ur') Verification
runTest('20. 10 Hedef Pazar Dili (TR, EN, AR, DE, FR, ID, MS, ES, RU, UR) ve RTL (Arapça/Urduca) eksiksiz çalışmalı', () => {
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  for (const lang of langs) {
    const res = evaluateProduct({
      rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol',
      productType: 'cosmetic',
      lang
    });
    assert.equal(res.lang, lang);
    assert.equal(res.dir, lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr');
    assert.ok(res.locale && res.locale.tabs && res.locale.tabs.compare);
    assert.ok(res.locale.badges && res.locale.badges.banned);
  }
});

// 21. Multilingual Label Parsing Across Languages (AR, DE, FR, ID, RU, UR)
runTest('21. Arapça (،), Almanca, Fransızca, Endonezce, Rusça ve Urduca etiketler %100 tanınmalı', () => {
  const arRes = evaluateProduct({
    rawText: 'المكونات: ماء، جلسرين، كحول سيتيريلي، نياسيناميد، بانثينول، فينوكسي إيثانول',
    productType: 'cosmetic',
    lang: 'ar'
  });
  assert.equal(arRes.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(arRes.cards.regulatoryCard.score, 100);

  const deRes = evaluateProduct({
    rawText: 'Zutaten: Wasser, Zucker, Glukosesirup, Zitronensäure, Pektin',
    productType: 'food',
    lang: 'de'
  });
  assert.equal(deRes.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(deRes.cards.veganSugarCard.freeSugarCount, 2);

  const idRes = evaluateProduct({
    rawText: 'Komposisi: Air, Gula, Tepung Terigu, Minyak Kelapa Sawit, Lesitin Kedelai, Garam',
    productType: 'food',
    lang: 'id'
  });
  assert.equal(idRes.cards.regulatoryCard.coveragePercent, 100);
});

// 22. Real-World Product Labels (CeraVe, Nutella % percentages, COSRX Snail Mucin, Gel Nail TPO 2025 EU Ban)
runTest('22. Gerçek Dünya Ürünleri (CeraVe, Nutella %13 Fındık, COSRX Salyangoz Özütü, Jel Oje TPO 2025 Yasağı) tam kapsamla çözümlenmeli', () => {
  // Nutella style label with percentages and colon wrapper
  const nutella = evaluateProduct({
    rawText: 'İçindekiler: Şeker, Palm Yağı, Fındık (%13), Yağsız Süt Tozu (%8.7), Yağı Azaltılmış Kakao (%7.4), Emülgatör: Lesitin (Soya), Vanilin',
    productType: 'food'
  });
  assert.equal(nutella.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(nutella.cards.veganSugarCard.freeSugarCount, 1);

  // COSRX Snail Mucin Halal check (GIMDES: kirmizi/uygunsuz_bulgu; MUI cosmetic: sari/kaynak_belirsiz_musbooh per Fatwa MUI 24/2012; MUI food: kirmizi)
  const cosrxGimdes = evaluateProduct({
    rawText: 'Ingredients: Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Polyacrylate, Phenoxyethanol, Sodium Hyaluronate, Allantoin, Panthenol, Arginine, Aqua',
    productType: 'cosmetic',
    halalAuthority: 'GIMDES'
  });
  assert.equal(cosrxGimdes.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(cosrxGimdes.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  const cosrxMuiCosmetic = evaluateProduct({
    rawText: 'Ingredients: Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Polyacrylate, Phenoxyethanol, Sodium Hyaluronate, Allantoin, Panthenol, Arginine, Aqua',
    productType: 'cosmetic',
    halalAuthority: 'MUI'
  });
  assert.equal(cosrxMuiCosmetic.cards.halalCard.overallStatus, 'kaynak_belirsiz_musbooh');

  const snailFoodMui = evaluateProduct({
    rawText: 'Ingredients: Water, Sugar, Snail Secretion Filtrate, Citric Acid, Pectin',
    productType: 'food',
    halalAuthority: 'MUI'
  });
  assert.equal(snailFoodMui.cards.halalCard.overallStatus, 'uygunsuz_bulgu');

  // Gel Nail Polish with TPO (Sept 2025 EU Omnibus VII Ban -> Score Capped at 10)
  const gelNail = evaluateProduct({
    rawText: 'Ingredients: Acrylates Copolymer, HEMA, Trimethylbenzoyl Diphenylphosphine Oxide, Butyl Acetate, Ethyl Acetate, Nitrocellulose',
    productType: 'cosmetic'
  });
  assert.equal(gelNail.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(gelNail.cards.regulatoryCard.score, 10);
});

// 23. Independent 3-Subagent Audit Suite: 26 Real-World Products + Parenthetical Multi-E-Code + Cyrillic/Urdu/Cross-Domain
runTest('23. Bağımsız 3-Alt-Ajan Denetimi: 26 Gerçek Ürün (%95+ Kapsam), Çoklu Parantez (E100, E120), Kiril/Urduca ve Çapraz Alan İzolasyonu', () => {
  // A. Parenthetical multi-E-code ("Renklendiriciler (E100, E120)") must detect BOTH E100 and E120 Carmine!
  const haribo = evaluateProduct({
    rawText: 'İçindekiler: Glikoz Şurubu, Şeker, Sığır Jelatini, Dekstroz, Sitrik Asit, Meyve ve Bitki Konsantreleri, Renklendiriciler (E100, E120), Parlatıcılar (Karnaubaumu E903, Balmumu E901)',
    productType: 'food',
    halalAuthority: 'GIMDES'
  });
  assert.ok(haribo.cards.regulatoryCard.coveragePercent >= 90);
  assert.ok(haribo.cards.halalCard.findings.some((f) => f.ruleId === 'carmine_e120' && f.status === 'kirmizi'));

  // B. Coca-Cola Zero style parenthetical multi-sweeteners ("Tatlandırıcılar (Aspartam E951, Asesülfam K E950)")
  const colaZero = evaluateProduct({
    rawText: 'İçindekiler: Su, Karbondioksit, Renklendirici (Karamel E150d), Asitlik Düzenleyiciler (Fosforik Asit E338, Sodyum Sitrat E331), Tatlandırıcılar (Aspartam E951, Asesülfam K E950), Kafein, Doğal Aroma Vericiler',
    productType: 'food',
    userProfiles: ['cocuk_metabolik']
  });
  assert.equal(colaZero.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(colaZero.cards.regulatoryCard.canShowScore, true);

  // C. Russian Cyrillic E-code ("Е250", "Е621") and "Ингредиенты:" header + "ё" normalization
  const ruProd = evaluateProduct({
    rawText: 'Ингредиенты: Вода, Сахар, Мальтодекстрин, Лимонная кислота, Лецитин, Кармин, Е250, Е621',
    productType: 'food',
    lang: 'ru',
    halalAuthority: 'GIMDES'
  });
  assert.equal(ruProd.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(ruProd.unresolvedConfirmations.length, 0);

  // D. Urdu header ("اجزائے ترکیبی:") + Urdu full stop ("۔") + Arabic/Eastern-Arabic numerals ("٪١٣")
  const urProd = evaluateProduct({
    rawText: 'اجزائے ترکیبی: پانی، گلیسرین (٪١٣)، نیاسینامائڈ، پینتھینول، سیٹیریل الکوحل، فینوکسی ایتھنول۔',
    productType: 'cosmetic',
    lang: 'ur'
  });
  assert.equal(urProd.cards.regulatoryCard.coveragePercent, 100);
  assert.equal(urProd.dir, 'rtl');

  // E. Cross-domain isolation: Vanillin in Food should NOT trigger skin-only ('hassas_cilt') alert or fragrance penalty
  const nutellaSkinCheck = evaluateProduct({
    rawText: 'İçindekiler: Şeker, Palm Yağı, Fındık (%13), Yağsız Süt Tozu (%8.7), Yağı Azaltılmış Kakao (%7.4), Emülgatör: Lesitin (Soya), Vanilin',
    productType: 'food',
    userProfiles: ['hassas_cilt', 'akne'],
    halalAuthority: 'GIMDES'
  });
  assert.equal(nutellaSkinCheck.cards.regulatoryCard.score, 100);
  assert.equal(nutellaSkinCheck.cards.profileCard.alerts.length, 0);
  // Explicit "(Soya)" resolves Lecithin to green!
  const lecFinding = nutellaSkinCheck.cards.halalCard.findings.find((f) => f.ruleId === 'lecithin_e322');
  assert.equal(lecFinding.status, 'yesil');
  assert.equal(nutellaSkinCheck.cards.veganSugarCard.uncertainVeganItems.length, 0);

  // F. Vegetarian claim conflict when Gelatin is present
  const vegConflict = evaluateProduct({
    rawText: 'İçindekiler: Su, Şeker, Sığır Jelatini, Sitrik Asit',
    productType: 'food',
    claims: { halalCertified: false, veganStatus: 'none', vegetarianStatus: 'verified' }
  });
  assert.equal(vegConflict.cards.halalCard.overallStatus, 'conflict');
  assert.equal(vegConflict.cards.veganSugarCard.veganCompatibility, 'conflict');
});

// 24. P0-1: Parantez İçi Domuz / Alkol Kaynağı Asla Helal Sayılmamalı (Logo İle ÇELİŞKİ Vermeli)
runTest('24. Parantez içi "Domuz/Pork/Schwein" ve "Alkol" kaynağı asla yeşil olmamalı, logo varsa ÇELİŞKİ vermeli', () => {
  // Test A: Sugar, Gelatin (Pork) with halal Certified -> MUST BE CONFLICT
  const res1 = evaluateProduct({
    rawText: 'Sugar, Gelatin (Pork)',
    productType: 'food',
    claims: { halalCertified: true }
  });
  assert.equal(res1.cards.halalCard.overallStatus, 'conflict', 'Gelatin (Pork) with halal cert must be conflict');
  assert.notEqual(res1.cards.halalCard.findings[0].status, 'yesil', 'Pork gelatin must NEVER be green');

  // Test B: Şeker, Jelatin (Domuz) without logo -> MUST BE Kırmızı (Haram)
  const res2 = evaluateProduct({
    rawText: 'Şeker, Jelatin (Domuz)',
    productType: 'food',
    claims: { halalCertified: false }
  });
  assert.equal(res2.cards.halalCard.overallStatus, 'uygunsuz_bulgu', 'Jelatin (Domuz) must be haram');
  assert.equal(res2.cards.halalCard.findings[0].status, 'kirmizi', 'Jelatin (Domuz) finding must be kirmizi');

  // Test C: Zucker, Gelatine (Schwein) with logo -> MUST BE CONFLICT
  const res3 = evaluateProduct({
    rawText: 'Zucker, Gelatine (Schwein)',
    productType: 'food',
    claims: { halalCertified: true }
  });
  assert.equal(res3.cards.halalCard.overallStatus, 'conflict', 'Gelatine (Schwein) with logo must be conflict');

  // Test D: Sugar, E471 (domuz kaynaklı) with logo -> MUST BE CONFLICT
  const res4 = evaluateProduct({
    rawText: 'Sugar, E471 (domuz kaynaklı)',
    productType: 'food',
    claims: { halalCertified: true }
  });
  assert.equal(res4.cards.halalCard.overallStatus, 'conflict', 'E471 (domuz) with logo must be conflict');

  // Test E: Water, Glycerin (Ethanol) in food -> Ethanol finding must be kirmizi in food!
  const res5 = evaluateProduct({
    rawText: 'Water, Glycerin (Ethanol)',
    productType: 'food',
    claims: { halalCertified: false }
  });
  assert.equal(res5.cards.halalCard.overallStatus, 'uygunsuz_bulgu', 'Ethanol in food must trigger haram warning');
});

// 25. P0-3: ReDoS ve Doğrusal Girdi Performansı (50.000 Karakter Testi)
runTest('25. ReDoS Koruması: 50.000 karakterlik tek girdi kilitlenmeden <50ms içinde tamamlanmalı', () => {
  const bigInputNoHyphen = 'a'.repeat(50000);
  const t0 = Date.now();
  const parsed1 = parseIngredientList(bigInputNoHyphen);
  const elapsed1 = Date.now() - t0;
  assert.ok(elapsed1 < 100, `No-hyphen parse must take <100ms, took ${elapsed1}ms`);

  const bigInputWithHyphens = ('Aqua, Methyliso-\nthiazolinone, ').repeat(500);
  const t1 = Date.now();
  const parsed2 = parseIngredientList(bigInputWithHyphens);
  const elapsed2 = Date.now() - t1;
  assert.ok(elapsed2 < 200, `Hyphenated parse must take <200ms, took ${elapsed2}ms`);
});

// 26. P1: Helal Kartı Kapsam Kuralı (Coverage < %80 İse "Uygun Görünüyor" Denemez)
runTest('26. Kapsam <%80 olduğunda Helal Kartı "uygun_gorunuyor" değil "kapsam_yetersiz" dönmeli, ancak Haram varsa haram uyarısı korunmalı', () => {
  // Test A: Sadece 1 madde tanınıyor, 3 madde bilinmiyor (Kapsam %25). Haram madde yok.
  const resLowCov = evaluateProduct({
    rawText: 'Ingredients: Aqua, UnknownBotanical1, UnknownBotanical2, UnknownPolymer3',
    productType: 'cosmetic',
    halalAuthority: 'GIMDES'
  });
  assert.equal(resLowCov.cards.regulatoryCard.coveragePercent, 25);
  assert.equal(resLowCov.cards.regulatoryCard.canShowScore, false);
  assert.equal(resLowCov.cards.halalCard.overallStatus, 'kapsam_yetersiz', 'Kapsam <%80 iken asla uygun_gorunuyor denmemeli');

  // Test B: Kapsam düşük (%25) ama içinde açık domuz jelatini var!
  const resLowCovHaram = evaluateProduct({
    rawText: 'İçindekiler: Şeker, BilinmeyenBitki1, BilinmeyenBitki2, Domuz Jelatini',
    productType: 'food',
    claims: { halalCertified: false }
  });
  assert.equal(resLowCovHaram.cards.halalCard.overallStatus, 'uygunsuz_bulgu', 'Kapsam düşük olsa bile haram madde uyarısı gizlenmemeli');

  // Test C: Kapsam düşük (%25), helal logolu ama domuz jelatini var -> CONFLICT!
  const resLowCovConflict = evaluateProduct({
    rawText: 'İçindekiler: Şeker, BilinmeyenBitki1, BilinmeyenBitki2, Domuz Jelatini',
    productType: 'food',
    claims: { halalCertified: true }
  });
  assert.equal(resLowCovConflict.cards.halalCard.overallStatus, 'conflict', 'Kapsam düşük olsa bile logo çelişkisi bildirilmeli');
});

// 27. P1: AB Yasaklı Madde (Ek II / capApplied=10) Kapsam <%80 Olsa Bile Tespit Edilmeli
runTest('27. AB Ek II Yasaklı Madde (Lilial / TPO) kapsam <%80 olsa bile capApplied=10 ile yakalanmalı', () => {
  // Test A: 1 tanınan yasaklı (Lilial), 3 bilinmeyen madde (Kapsam %25)
  const resBannedLowCov = evaluateProduct({
    rawText: 'Ingredients: Butylphenyl Methylpropional, UnknownExtractA, UnknownExtractB, UnknownExtractC',
    productType: 'cosmetic'
  });
  assert.equal(resBannedLowCov.cards.regulatoryCard.coveragePercent, 25);
  assert.equal(resBannedLowCov.cards.regulatoryCard.canShowScore, false, 'Kapsam <%80 olduğu için sayısal skor null olmalı');
  assert.equal(resBannedLowCov.cards.regulatoryCard.capApplied, 10, 'Yasaklı madde varlığı capApplied=10 olarak kaydedilmeli');
  assert.equal(resBannedLowCov.cards.regulatoryCard.findings.length, 1);
  assert.equal(resBannedLowCov.cards.regulatoryCard.findings[0].euStatus, 'yasak');
});

// 28. P2: Genişletilmiş Toksik Maddeler (Hidrokinon, Cıva, Formaldehit Ek II Yasağı)
runTest('28. Ek II Yasaklı Madde Genişletmesi: Hidrokinon, Cıva ve Formaldehit AB Yasaklı (Skor Tavanı 10) olarak yakalanmalı', () => {
  // Test A: Hydroquinone (Cilt beyazlatıcı toksik madde)
  const resHq = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Hydroquinone, Cetyl Alcohol, Tocopherol',
    productType: 'cosmetic'
  });
  assert.equal(resHq.cards.regulatoryCard.capApplied, 10);
  assert.ok(resHq.cards.regulatoryCard.score <= 10);
  const hqFinding = resHq.cards.regulatoryCard.findings.find((f) => f.substanceId === 'hydroquinone_banned');
  assert.ok(hqFinding);
  assert.equal(hqFinding.euStatus, 'yasak');

  // Test B: Mercury / Cıva
  const resHg = evaluateProduct({
    rawText: 'Ingredients: Aqua, Cıva, Glycerin, Niacinamide',
    productType: 'cosmetic'
  });
  assert.equal(resHg.cards.regulatoryCard.capApplied, 10);
  const hgFinding = resHg.cards.regulatoryCard.findings.find((f) => f.substanceId === 'mercury_compounds_banned');
  assert.ok(hgFinding);
  assert.equal(hgFinding.euStatus, 'yasak');

  // Test C: Formaldehyde
  const resFa = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Formaldehyde, Panthenol',
    productType: 'cosmetic'
  });
  assert.equal(resFa.cards.regulatoryCard.capApplied, 10);
  const faFinding = resFa.cards.regulatoryCard.findings.find((f) => f.substanceId === 'formaldehyde_direct_banned');
  assert.ok(faFinding);
  assert.equal(faFinding.euStatus, 'yasak');
});

// 29. P2: Alkollü İçecek Terimleri (Mirin, Sake, Rom, Likör, Viski) Gıdada Doğrudan Haram
runTest('29. Gıdada alkollü içecekler (Mirin, Sake, Rom, Likör, Viski) A_haram kategorisinde olmalı ve helal logoluysa ÇELİŞKİ vermeli', () => {
  // Test A: Soya Sosu & Mirin (Japon mutfağı sosu)
  const resMirin = evaluateProduct({
    rawText: 'İçindekiler: Su, Soya Fasulyesi, Buğday, Tuz, Mirin',
    productType: 'food',
    halalAuthority: 'JAKIM'
  });
  assert.equal(resMirin.cards.halalCard.overallStatus, 'uygunsuz_bulgu');
  assert.equal(resMirin.cards.halalCard.findings[0].category, 'A_haram');
  assert.equal(resMirin.cards.halalCard.findings[0].status, 'kirmizi');

  // Test B: Çikolata & Rom (Rum truffles) ile Helal Beyanı -> CONFLICT!
  const resRum = evaluateProduct({
    rawText: 'İçindekiler: Şeker, Kakao Yağı, Süt Tozu, Rom, Lesitin (Soya)',
    productType: 'food',
    claims: { halalCertified: true },
    halalAuthority: 'GIMDES'
  });
  assert.equal(resRum.cards.halalCard.overallStatus, 'conflict', 'Helal logolu üründe Rom tespit edilirse CONFLICT vermeli');

  // Test C: Sake (Japon pirinç şarabı)
  const resSake = evaluateProduct({
    rawText: 'Ingredients: Rice, Water, Sake, Koji',
    productType: 'food',
    halalAuthority: 'MUI'
  });
  assert.equal(resSake.cards.halalCard.findings[0].status, 'kirmizi');
});

// 30. Triphenyl Phosphate (TPHP - 2026/909 geçiş takvimi) ve Borik Asit (2019/831 Ek II Yasağı)
runTest('30. TPHP (AB 2026/909) geçiş dönemi ve 2027 yürürlük takvimi; Borik Asit (AB 2019/831) Ek II Doğrudan Yasaklı', () => {
  // Test A1: Triphenyl Phosphate (TPHP) - 2026 yılı geçiş dönemi kontrolü (Geçiş uyarısı vermeli, erken fiili yasak vermemeli)
  const resTphpTransition = evaluateProduct({
    rawText: 'Ingredients: Ethyl Acetate, Butyl Acetate, Nitrocellulose, Triphenyl Phosphate',
    productType: 'cosmetic'
  });
  const tphpFindingTrans = resTphpTransition.cards.regulatoryCard.findings.find((f) => f.substanceId === 'tphp_triphenyl_phosphate_banned');
  assert.ok(tphpFindingTrans, 'TPHP finding must be detected');
  assert.equal(tphpFindingTrans.euStatus, 'kisitli', '2026 yılında geçiş dönemi kısıtlı uyarısı verilmeli');

  // Test A2: Triphenyl Phosphate (TPHP) - 1 Ocak 2027 yürürlük tarihi sonrası veya strictFutureRules ile Ek II Yasaklı (Tavan Skor 10)
  const resTphpBanned = evaluateProduct({
    rawText: 'Ingredients: Ethyl Acetate, Butyl Acetate, Nitrocellulose, Triphenyl Phosphate',
    productType: 'cosmetic',
    targetDate: '2027-01-01'
  });
  assert.equal(resTphpBanned.cards.regulatoryCard.capApplied, 10, 'TPHP 2027 yürürlük tarihiyle tavan skor 10 uygulamalı');
  const tphpFindingBanned = resTphpBanned.cards.regulatoryCard.findings.find((f) => f.substanceId === 'tphp_triphenyl_phosphate_banned');
  assert.equal(tphpFindingBanned.euStatus, 'yasak');

  // Test B: Boric Acid / Borax (2019/831) - Kozmetikte doğrudan Ek II Yasaklı (Tavan Skor 10)
  const resBor = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Boric Acid, Carbomer',
    productType: 'cosmetic'
  });
  assert.equal(resBor.cards.regulatoryCard.capApplied, 10, 'Boric Acid must apply score cap 10');
  const borFinding = resBor.cards.regulatoryCard.findings.find((f) => f.substanceId === 'boric_acid_borates_restricted');
  assert.ok(borFinding, 'Boric Acid finding must be detected');
  assert.equal(borFinding.euStatus, 'yasak');
});

// 31. CosIng 30.609 Bileşen Temel Sözlüğü & Ek II/III Güvenlik Ağı Entegrasyonu
runTest('31. 30.609 AB CosIng bileşeni temel sözlük olarak tanınmalı ve Ek II yasaklıları yakalanmalı', () => {
  // Test A: Nadir botanik CosIng bileşenleri tanınmalı ve kapsamı %100 yapmalı
  const resCosSafe = evaluateProduct({
    rawText: 'Ingredients: Aqua, Euphrasia Officinalis Powder, Sambucus Nigra Flower Powder, Cryptocarya Massoy Bark Extract',
    productType: 'cosmetic'
  });
  assert.equal(resCosSafe.cards.regulatoryCard.coveragePercent, 100, 'Tüm CosIng bileşenleri tanınmalı');
  assert.equal(resCosSafe.cards.regulatoryCard.canShowScore, true, 'Kapsam %100 olduğu için skor gösterilmeli');
  assert.ok(resCosSafe.cards.regulatoryCard.score >= 80, 'Zararsız CosIng bileşenleri skoru haksız düşürmemeli');

  // Test B: CosIng Ek II doğrudan yasaklı bileşen (1,2,4-Benzenetriacetate) yakalanmalı
  const resCosBanned = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, 1,2,4-Benzenetriacetate, Cetearyl Alcohol',
    productType: 'cosmetic'
  });
  assert.equal(resCosBanned.cards.regulatoryCard.capApplied, 10, 'CosIng Ek II yasaklısı Tavan Skor 10 uygulamalı');
  assert.ok(resCosBanned.cards.regulatoryCard.score <= 10, 'Skor 10 veya altında olmalı');
  const bannedFinding = resCosBanned.cards.regulatoryCard.findings.find((f) => f.euStatus === 'yasak');
  assert.ok(bannedFinding, 'Ek II yasaklı bulgu üretilmeli');
  assert.ok(bannedFinding.substanceId.startsWith('cosing_'), 'CosIng id taşımalı');

  // Test C: Gıda ürününde kozmetik CosIng bileşenleri sahte tanıma yapmamalı
  const resFood = evaluateProduct({
    rawText: 'İçindekiler: Şeker, Euphrasia Officinalis Powder, BilinmeyenKatkiX',
    productType: 'food'
  });
  assert.equal(resFood.cards.regulatoryCard.coveragePercent, 33, 'Gıdada kozmetik CosIng uygulanmamalı');
});

// 32. Bağımsız Denetim P1: Aqua (Yasaklı Madde) ve Aqua / Yasaklı Madde Eşleştirmesi Atlanmamalı
runTest('32. Parantez veya slaş içindeki Ek II Yasaklı madde (Aqua (4-METHOXYTOLUENE-2,5-DIAMINE HCL)) Tavan Skor 10 uygulamalı', () => {
  const resParen = evaluateProduct({
    rawText: 'Aqua (4-METHOXYTOLUENE-2,5-DIAMINE HCL)',
    productType: 'cosmetic'
  });
  assert.equal(resParen.cards.regulatoryCard.capApplied, 10, 'Parantez içi Ek II yasaklı tavan 10 vermeli');
  assert.equal(resParen.cards.regulatoryCard.score, 10);

  const resSlash = evaluateProduct({
    rawText: 'Aqua / 4-METHOXYTOLUENE-2,5-DIAMINE HCL',
    productType: 'cosmetic'
  });
  assert.equal(resSlash.cards.regulatoryCard.capApplied, 10, 'Slaş sonrası Ek II yasaklı tavan 10 vermeli');
  assert.equal(resSlash.cards.regulatoryCard.score, 10);
});

// 33. Bağımsız Denetim P1: Nutella Majör Gıda Alerjenleri (AB 1169/2011 Ek II Süt, Fındık, Soya) Astım/Alerji Uyarısı Üretmeli
runTest('33. Nutella ve benzeri gıdalarda majör alerjenler (Süt, Fındık, Soya) Astım/Alerji profilinde kırmızı uyarı üretmeli', () => {
  const resNutella = evaluateProduct({
    rawText: 'İçindekiler: Şeker, Palm Yağı, Fındık (%13), Yağsız Süt Tozu (%8.7), Yağı Azaltılmış Kakao (%7.4), Emülgatör: Lesitin (Soya), Vanilin',
    productType: 'food',
    userProfiles: ['astim_alerji']
  });
  assert.equal(resNutella.cards.profileCard.profileStatuses.astim_alerji, 'false', 'Alerji profili uygun olmamalı');
  assert.ok(resNutella.cards.profileCard.alerts.length >= 3, 'En az 3 alerjen uyarısı üretilmeli');
});

// 34. Bağımsız Denetim P1: Oreo Çapraz Bulaşma ("May contain milk" / Eser Miktarda) Astım/Alerji Uyarısı Üretmeli
runTest('34. Oreo ve çapraz bulaşma ("May contain milk") Astım/Alerji profilinde uyarı üretmeli', () => {
  const resOreo = evaluateProduct({
    rawText: 'Ingredients: Sugar, Wheat Flour, Palm Oil, Cocoa Powder, Glucose-Fructose Syrup. May contain milk.',
    productType: 'food',
    userProfiles: ['astim_alerji']
  });
  assert.equal(resOreo.cards.profileCard.profileStatuses.astim_alerji, 'false');
  assert.ok(resOreo.cards.profileCard.alerts.some(a => a.level === 'sari'), 'Çapraz bulaşma sarı uyarısı bulunmalı');
});

// 35. Bağımsız Denetim P1: Methylisothiazolinone (MI / MCI) Durulanmayan Üründe (Leave-on) Yasak, Durulanan Üründe (Rinse-off) Kısıtlı Olmalı
runTest('35. MI/MCI durulanmayan (leave-on) üründe kesinlikle yasak (tavan 10), durulanan (rinse-off) üründe kısıtlı olmalı', () => {
  const resLeaveOn = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Methylisothiazolinone',
    productType: 'cosmetic',
    applicationType: 'leave_on'
  });
  assert.equal(resLeaveOn.cards.regulatoryCard.capApplied, 10, 'Leave-on MI tavan 10 olmalı');
  assert.equal(resLeaveOn.cards.regulatoryCard.score, 10);

  const resRinseOff = evaluateProduct({
    rawText: 'Ingredients: Aqua, Sodium Laureth Sulfate, Methylisothiazolinone',
    productType: 'cosmetic',
    applicationType: 'rinse_off'
  });
  assert.equal(resRinseOff.cards.regulatoryCard.capApplied, null, 'Rinse-off MI tavan 10 olmamalı');
  assert.equal(resRinseOff.cards.regulatoryCard.score, 90);
});

// 36. Bağımsız Denetim P1: TPO Jel Tırnak Cilası Çok Dilli Güvenlik (Fransızca, İspanyolca, Rusça) Yasaklanmalı
runTest('36. TPO Jel Tırnak Cilası Fransızca, İspanyolca ve Rusça etiketlerde de Ek II Yasaklı (Tavan Skor 10) olarak yakalanmalı', () => {
  const resFR = evaluateProduct({
    rawText: 'Ingrédients: Acrylates, Oxyde de triméthylbenzoyl diphénylphosphine',
    productType: 'cosmetic'
  });
  assert.equal(resFR.cards.regulatoryCard.capApplied, 10, 'Fransızca TPO tavan 10 olmalı');

  const resES = evaluateProduct({
    rawText: 'Ingredientes: Acrilatos, Óxido de trimetilbenzoil difenilfosfina',
    productType: 'cosmetic'
  });
  assert.equal(resES.cards.regulatoryCard.capApplied, 10, 'İspanyolca TPO tavan 10 olmalı');

  const resRU = evaluateProduct({
    rawText: 'Состав: Акрилаты, Оксид триметилбензоил дифенилфосфина',
    productType: 'cosmetic'
  });
  assert.equal(resRU.cards.regulatoryCard.capApplied, 10, 'Rusça TPO tavan 10 olmalı');
});

// 37. Bağımsız Denetim P1: Enerji İçeceği (Kafein + Taurin) Hamilelik (EFSA 200mg) ve Çocuk Uyarıları Üretmeli
runTest('37. Enerji içeceği (Kafein + Taurin) hamilelik ve çocuk metabolik profillerinde uyarı üretmeli', () => {
  const resEnergy = evaluateProduct({
    rawText: 'Ingredients: Carbonated Water, Sugar, Taurine, Caffeine, Inositol',
    productType: 'food',
    userProfiles: ['hamilelik', 'cocuk_metabolik']
  });
  assert.equal(resEnergy.cards.profileCard.profileStatuses.hamilelik, 'false');
  assert.equal(resEnergy.cards.profileCard.profileStatuses.cocuk_metabolik, 'false');
  assert.ok(resEnergy.cards.profileCard.alerts.length >= 2);
});

// 38. Bağımsız Denetim P1: E471 Kimyasal Kimliği Doğru Gösterilmeli ("Mono- ve Digliseritler", Lesitin DEĞİL)
runTest('38. E471 doğru adlandırılmalı ("Mono- ve Digliseritler (E471)"), Lesitin olarak gösterilmemeli', () => {
  const resE471 = evaluateProduct({
    rawText: 'İçindekiler: Buğday Unu, Su, E471, Maya, Tuz',
    productType: 'food',
    lang: 'tr'
  });
  const e471Obs = resE471.observations.find((o) => o.raw === 'E471');
  assert.ok(e471Obs);
  assert.equal(e471Obs.localizedName, 'Mono- ve Digliseritler (E471)');
});

// 39. Bağımsız Denetim P1/P2: Gıda Yağ Alkolü Kalkanı, Domuz Negasyonu, N,N- Kimyasal Ayrıştırma ve ABD Yargı Alanı
runTest('39. Gıdada Cetearyl Alcohol haram olmamalı, Gelatin (pork-free) domuz sayılmamalı, N,N- bölünmemeli, US E171 tavan 10 almamalı', () => {
  // A. Food Cetearyl Alcohol -> NO alcohol finding
  const resFoodAlc = evaluateProduct({
    rawText: 'Ingredients: Water, Cetearyl Alcohol, Sugar',
    productType: 'food'
  });
  assert.equal(resFoodAlc.cards.halalCard.findings.length, 0, 'Cetearyl Alcohol gıdada etanol sayılmamalı');

  // B. Pork-free gelatin -> NOT haram
  const resPorkFree = evaluateProduct({
    rawText: 'Ingredients: Sugar, Gelatin (pork-free), Citric Acid',
    productType: 'food'
  });
  assert.notEqual(resPorkFree.cards.halalCard.overallStatus, 'uygunsuz_bulgu');
  assert.equal(resPorkFree.cards.halalCard.findings[0].status, 'sari');

  // C. N,N- locant preserving
  const locantTokens = parseIngredientList('Aqua, N,N-DIETHYLTOLUENE-2,5-DIAMINE HCL, Glycerin');
  assert.equal(locantTokens.length, 3);
  assert.equal(locantTokens[1].raw, 'N,N-DIETHYLTOLUENE-2,5-DIAMINE HCL');

  // D. US jurisdiction for E171 -> No EU 10 cap
  const resUsE171 = evaluateProduct({
    rawText: 'Ingredients: Sugar, Wheat Flour, Palm Oil, Titanium Dioxide',
    productType: 'food',
    jurisdiction: 'US'
  });
  assert.equal(resUsE171.cards.regulatoryCard.capApplied, null, 'ABD pazarında E171 tavan 10 almamalı (FDA 21 CFR 73.575)');

  // E. Low coverage (<80%) propagates uncertainty across all cards
  const resLowCov = evaluateProduct({
    rawText: 'Aqua, UnknownA, UnknownB, UnknownC',
    productType: 'cosmetic',
    userProfiles: ['hamilelik']
  });
  assert.equal(resLowCov.cards.regulatoryCard.score, null);
  assert.equal(resLowCov.cards.profileCard.preferenceMatchScore, null);
  assert.equal(resLowCov.cards.profileCard.profileStatuses.hamilelik, 'kapsam_yetersiz');
  assert.equal(resLowCov.cards.veganSugarCard.veganCompatibility, 'kapsam_yetersiz');
});

// 40. Kişisel Özel Hassasiyet / Kara Liste (customWatchlist) Deterministik Eşleşme ve Negasyon Koruması
runTest('40. Kişisel Özel Kara Liste (customWatchlist) seçili maddeyi "ozel_kara_liste" kırmızı uyarı olarak yakalamalı, negasyonu (free/siz) muaf tutmalı', () => {
  const resMatch = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['Niacinamide', 'Parfum']
  });
  assert.equal(resMatch.cards.profileCard.profileStatuses.ozel_kara_liste, 'false');
  const wlAlert = resMatch.cards.profileCard.alerts.find((a) => a.profile === 'ozel_kara_liste');
  assert.ok(wlAlert, 'Kişisel kara liste uyarısı üretilmeli');
  assert.equal(wlAlert.level, 'kirmizi');

  // Negation ("Niacinamide-free") should NOT trigger personal watchlist false alarm
  const resNegated = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol, Niacinamide-free',
    productType: 'cosmetic',
    customWatchlist: ['Niacinamide']
  });
  assert.equal(resNegated.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');
});

// 41. 4 Otorite Karşılaştırma Matrisi (authorityComparison: GİMDES, JAKIM, MUI, IFANCA) ve Fıkhi Fark Açıklaması
runTest('41. Otoriteler arası görüş ayrılığı olan maddelerde (Karmin E120, Etil Alkol, Şellak) 4 otorite matrisi ve 10 dilde fıkhi açıklama dönmeli', () => {
  const resCarmine = evaluateProduct({
    rawText: 'İçindekiler: Sugar, Water, Citric Acid, Carmine (E120)',
    productType: 'food',
    halalAuthority: 'GIMDES',
    lang: 'tr'
  });
  assert.ok(Array.isArray(resCarmine.cards.halalCard.authorityComparison));
  assert.equal(resCarmine.cards.halalCard.authorityComparison.length, 1);
  const comp = resCarmine.cards.halalCard.authorityComparison[0];
  assert.equal(comp.ruleId, 'carmine_e120');
  assert.equal(comp.authorityMatrix.GIMDES, 'kirmizi');
  assert.equal(comp.authorityMatrix.IFANCA, 'kirmizi');
  assert.equal(comp.authorityMatrix.JAKIM, 'yesil');
  assert.equal(comp.authorityMatrix.MUI, 'yesil');
  assert.ok(comp.authorityDiffReason && comp.authorityDiffReason.includes('GİMDES'));
});

// 42. Hedefe Bağlı Negasyon (Target-Bound Negation): Sinensis, Lysine, Tyrosine, Freesia ve Parantez İçi Farklı Negasyon
runTest('42. Hedefe bağlı negasyon: Camellia Sinensis, Lysine, Tyrosine, Freesia ve "Phenoxyethanol (Paraben-free)" kara listeden kaçmamalı', () => {
  // A. "sin" or "free" inside botanical/amino names must NOT trigger negation
  const resBotanicals = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Camellia Sinensis Leaf Extract, Citrus Sinensis Peel Oil, Lysine, Tyrosine, Freesia Refracta Extract',
    productType: 'cosmetic',
    customWatchlist: ['Camellia Sinensis', 'Lysine', 'Tyrosine', 'Freesia']
  });
  assert.equal(resBotanicals.cards.profileCard.profileStatuses.ozel_kara_liste, 'false');
  assert.equal(resBotanicals.cards.profileCard.preferenceMatchScore, 0);
  const botAlerts = resBotanicals.cards.profileCard.alerts.filter((a) => a.profile === 'ozel_kara_liste');
  assert.ok(botAlerts.length >= 4, 'Tüm botanik ve amino asit kara liste maddeleri yakalanmalı');

  // B. Parenthetical negation of a DIFFERENT substance ("Phenoxyethanol (Paraben-free)") must NOT exempt Phenoxyethanol!
  const resCrossNeg = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Phenoxyethanol (Paraben-free), Parfum (alcohol-free), Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['Phenoxyethanol', 'Parfum']
  });
  assert.equal(resCrossNeg.cards.profileCard.profileStatuses.ozel_kara_liste, 'false');
  assert.equal(resCrossNeg.cards.profileCard.preferenceMatchScore, 0);
  const crossAlerts = resCrossNeg.cards.profileCard.alerts.filter((a) => a.profile === 'ozel_kara_liste');
  assert.equal(crossAlerts.length, 2, 'Phenoxyethanol ve Parfum farklı madde negasyonu nedeniyle muaf tutulmamalı');
});

// 43. Yağ Alkolü Koruması (Fatty Alcohol Guard) ve Kısa Hece ("ni", "in") Yanlış Pozitif Koruması
runTest('43. Kara listedeki genel "Alcohol" Cetyl/Cetearyl Alcohol ü yakalamamalı; 2 harfli "ni"/"in" Niacinamide/Glycerin i yakalamamalı', () => {
  // A. Generic 'Alcohol' in watchlist on CeraVe (Cetyl Alcohol, Cetearyl Alcohol) -> SAFE ('true')
  const resFattySafe = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['Alcohol']
  });
  assert.equal(resFattySafe.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');

  // B. Generic 'Alcohol' in watchlist on Alcohol Denat. -> FLAGGED ('false')
  const resEthanolFlagged = evaluateProduct({
    rawText: 'Ingredients: Aqua, Alcohol Denat., Glycerin, Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['Alcohol']
  });
  assert.equal(resEthanolFlagged.cards.profileCard.profileStatuses.ozel_kara_liste, 'false');

  // C. Specific 'Cetyl Alcohol' in watchlist -> FLAGGED ('false')
  const resSpecificFatty = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Cetyl Alcohol, Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['Cetyl Alcohol']
  });
  assert.equal(resSpecificFatty.cards.profileCard.profileStatuses.ozel_kara_liste, 'false');

  // D. 2-char terms ('ni', 'in') must NOT substring-match Niacinamide or Glycerin
  const resShortTerms = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol',
    productType: 'cosmetic',
    customWatchlist: ['ni', 'in']
  });
  assert.equal(resShortTerms.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');
});

// 44. 51. Kara Liste Maddesi Koruması ve OCR Bekleyen Üründe Kara Liste Belirsizlik ("unknown") Yayılımı
runTest('44. 51. kara liste maddesi sessizce atlanmamalı ve OCR onayı bekleyen üründe kara liste "true" yerine "unknown" dönmeli', () => {
  // A. 51st item is Niacinamide -> must still be caught and watchlistLimitExceeded must be true
  const list51 = Array.from({ length: 50 }, (_, i) => `DummyIngredient${i + 1}`).concat(['Niacinamide']);
  const res51 = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol',
    productType: 'cosmetic',
    customWatchlist: list51
  });
  assert.equal(res51.cards.profileCard.watchlistLimitExceeded, true);
  assert.equal(res51.cards.profileCard.profileStatuses.ozel_kara_liste, 'false', '51. sıradaki Niacinamide sessizce güvenli sayılmamalı');

  // B. Pending OCR confirmation ('Sodium Laur?l Sulfate') with watchlist ['SLS'] -> ozel_kara_liste must be 'unknown', NOT 'true'
  const resOcrWatch = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Sodium Laur?l Sulfate, Panthenol, Tocopherol',
    productType: 'cosmetic',
    customWatchlist: ['SLS']
  });
  assert.ok(resOcrWatch.unresolvedConfirmations.length > 0);
  assert.equal(resOcrWatch.cards.profileCard.profileStatuses.ozel_kara_liste, 'unknown');
  assert.equal(resOcrWatch.cards.profileCard.preferenceMatchScore, null);
});

// 45. 4-Otorite Matrisi Değişmezi (authorityMatrix[halalAuthority] === status)
runTest('45. Tüm otorite, ürün tipi ve sertifika kombinasyonlarında authorityMatrix[selectedAuthority] === finding.status değişmezi korunmalı', () => {
  const authorities = ['GIMDES', 'JAKIM', 'MUI', 'IFANCA'];
  for (const auth of authorities) {
    // Case 1: Ethanol in cosmetic with halalCertified: true
    const rEth = evaluateProduct({
      rawText: 'Ingredients: Aqua, Glycerin, Alcohol Denat., Panthenol, Tocopherol',
      productType: 'cosmetic',
      halalAuthority: auth,
      claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' }
    });
    const fEth = rEth.cards.halalCard.findings.find((f) => f.ruleId === 'ethanol_cosmetic_or_food');
    assert.ok(fEth);
    assert.equal(fEth.authorityMatrix[auth], fEth.status, `Ethanol + halalCertified invariant failed for ${auth}`);

    // Case 2: L-Cysteine (E920) in food with verified vegan claim
    const rCys = evaluateProduct({
      rawText: 'Ingredients: Wheat Flour, Water, Salt, Yeast, E920',
      productType: 'food',
      halalAuthority: auth,
      claims: { halalCertified: false, veganStatus: 'verified', vegetarianStatus: 'none' }
    });
    const fCys = rCys.cards.halalCard.findings.find((f) => f.ruleId === 'l_cysteine');
    assert.ok(fCys);
    assert.equal(fCys.authorityMatrix[auth], fCys.status, `E920 + verifiedVegan invariant failed for ${auth}`);
  }
});

// 46. Karşılaştırma Motoru (compareProducts): Konsantrasyon Farkı (MI 20 ppm vs 10 ppm), Kara Liste Farkı ve Durum Kodları
runTest('46. compareProducts: Aynı maddenin farklı konsantrasyonunu (MI 20 ppm vs 10 ppm) ve kişisel kara liste farkını decidingDifference olarak yakalamalı', () => {
  // A. MI 20 ppm in Rinse-off Shampoo (Score 10, Banned >15 ppm) vs MI 10 ppm in Rinse-off Shampoo (Score 90, Restricted <=15 ppm)
  const compMi = compareProducts(
    { name: 'Yüz Yıkama Jeli A (20 ppm)', rawText: 'Shampoo: Aqua, Glycerin, Panthenol, Tocopherol, Methylisothiazolinone (20 ppm)', productType: 'cosmetic' },
    { name: 'Yüz Yıkama Jeli B (10 ppm)', rawText: 'Shampoo: Aqua, Glycerin, Panthenol, Tocopherol, Methylisothiazolinone (10 ppm)', productType: 'cosmetic' },
    { lang: 'tr' }
  );
  assert.equal(compMi.productA.score, 10);
  assert.equal(compMi.productB.score, 90);
  assert.ok(compMi.decidingDifference, 'MI 20 ppm vs 10 ppm karşılaştırmasında decidingDifference boş olmamalı');
  assert.ok(compMi.decidingDifference.headline.includes('Yüz Yıkama Jeli A'));

  // B. Same regulatory score (100 vs 100), but Product B contains a personal watchlist item ('Niacinamide')
  const compWatch = compareProducts(
    { name: 'Temiz Krem A', rawText: 'Aqua, Glycerin (Bitkisel), Panthenol, Tocopherol, Ceramide NP', productType: 'cosmetic' },
    { name: 'Niacinamide Krem B', rawText: 'Aqua, Glycerin (Bitkisel), Panthenol, Tocopherol, Niacinamide', productType: 'cosmetic' },
    { customWatchlist: ['Niacinamide'], lang: 'tr' }
  );
  assert.equal(compWatch.productA.profileStatusCode, 'uygun');
  assert.equal(compWatch.productB.profileStatusCode, 'uygunsuz');
  assert.ok(compWatch.decidingDifference, 'Kişisel kara liste farkında decidingDifference üretilmeli');

  // C. Clean halal product has halalStatusCode === 'uygun'
  assert.equal(compWatch.productA.halalStatusCode, 'uygun');
});

// 47. Parantezsiz ppm / mg/kg Yazımı ve MI / MCI Kısaltması Tanıma + Karşılaştırma (8. Denetim P1)
runTest('47. Parantezsiz "Methylisothiazolinone 20 ppm", "MI 20 ppm" ve "MI 10 ppm" %100 tanınmalı, durulanan üründe 10 vs 90 puan ve decidingDifference üretmeli', () => {
  const r20 = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, Citric Acid, Methylisothiazolinone 20 ppm',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(r20.coveragePercent, 100);
  assert.equal(r20.cards.regulatoryCard.score, 10);

  const r10 = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, Citric Acid, Methylisothiazolinone 10 ppm',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(r10.coveragePercent, 100);
  assert.equal(r10.cards.regulatoryCard.score, 90);

  const compUnparen = compareProducts(
    { name: 'Şampuan A (20 ppm)', rawText: 'Shampoo: Aqua, Glycerin, Panthenol, Citric Acid, MI 20 ppm', productType: 'cosmetic' },
    { name: 'Şampuan B (10 ppm)', rawText: 'Shampoo: Aqua, Glycerin, Panthenol, Citric Acid, MI 10 ppm', productType: 'cosmetic' },
    { lang: 'tr' }
  );
  assert.equal(compUnparen.productA.score, 10);
  assert.equal(compUnparen.productB.score, 90);
  assert.ok(compUnparen.decidingDifference, 'Parantezsiz MI 20 ppm vs MI 10 ppm karşılaştırmasında decidingDifference üretilmeli');
});

// 48. 10 Dilde Yeşil (Helal) Bulgularda "Doubtful / Şüpheli" Açıklama Çelişkisi Olmaması (8. Denetim P1)
runTest('48. 10 dilin tamamında status === "yesil" olan helal bulguları asla "Doubtful / Şüpheli" açıklaması taşımamalı', () => {
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  const forbiddenRegex = /doubtful|şüpheli|zweifelhaft|douteux|syubhat|syubhah|dudoso|сомнительно|مشكوك|مشکوک/i;
  for (const lang of langs) {
    // Carmine (E120) under JAKIM is 'yesil', and E471 with halalCertified:true is 'yesil'
    const res = evaluateProduct({
      rawText: 'Ingredients: Water, Sugar, Citric Acid, Carmine (E120), E471',
      productType: 'food',
      halalAuthority: 'JAKIM',
      claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' },
      lang
    });
    const greenFindings = res.cards.halalCard.findings.filter((f) => f.status === 'yesil');
    assert.ok(greenFindings.length >= 2);
    for (const gf of greenFindings) {
      assert.ok(
        !forbiddenRegex.test(gf.explanation),
        `Dil=${lang}, kural=${gf.ruleId} yeşil olduğu halde şüpheli açıklama döndü: "${gf.explanation}"`
      );
    }
  }
});

// 49. Helal Sertifikasının Yalnız Seçili Otoriteyi Çözmesi ve D_tartismali Çelişki/Çözüm Tutarlılığı (8. Denetim P2)
runTest('49. Helal sertifikası yalnız seçili otoriteyi yeşile çevirmeli; GİMDES te E120+sertifika conflict, MUI de kozmetik salyangoz+sertifika yesil olmalı', () => {
  // A. E471 with MUI selected + halalCertified: true -> MUI is 'yesil', while GIMDES/JAKIM/IFANCA remain 'sari' in authorityMatrix
  const rE471 = evaluateProduct({
    rawText: 'Ingredients: Water, Sugar, E471',
    productType: 'food',
    halalAuthority: 'MUI',
    claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' }
  });
  const fE471 = rE471.cards.halalCard.findings.find((f) => f.ruleId === 'e471');
  assert.equal(fE471.status, 'yesil');
  assert.equal(fE471.authorityMatrix.MUI, 'yesil');
  assert.equal(fE471.authorityMatrix.GIMDES, 'sari');
  assert.equal(fE471.authorityMatrix.JAKIM, 'sari');

  // B. Carmine (E120) under GIMDES with halalCertified: true -> 'conflict'
  const rCarmine = evaluateProduct({
    rawText: 'Ingredients: Water, Sugar, Carmine (E120)',
    productType: 'food',
    halalAuthority: 'GIMDES',
    claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' }
  });
  assert.equal(rCarmine.cards.halalCard.overallStatus, 'conflict');

  // C. Cosmetic Snail Mucin under MUI with halalCertified: true -> 'yesil'
  const rSnailMui = evaluateProduct({
    rawText: 'Ingredients: Aqua, Snail Secretion Filtrate, Butylene Glycol, Panthenol, Allantoin',
    productType: 'cosmetic',
    halalAuthority: 'MUI',
    claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' }
  });
  const fSnail = rSnailMui.cards.halalCard.findings.find((f) => f.ruleId === 'snail_mucin_halal');
  assert.equal(fSnail.status, 'yesil');
  assert.equal(rSnailMui.cards.halalCard.overallStatus, 'uygun_gorunuyor');
});

// 50. "without Parfum" Negasyonu ve >50 Kara Liste Sınır Aşımında "unknown" Belirsizlik Koruması (8. Denetim P2)
runTest('50. "without Parfum" negasyonu yakalanmalı ve >50 kara liste sınır aşımında eşleşme yoksa "unknown" dönmeli', () => {
  const rWithout = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Panthenol, without Parfum, Niacinamide',
    productType: 'cosmetic',
    customWatchlist: ['Parfum']
  });
  assert.equal(rWithout.cards.profileCard.profileStatuses.ozel_kara_liste, 'true');

  // >250 dummy items + Niacinamide at index 250 -> watchlistLimitExceeded: true, must NOT certify 'true' or score 100
  const list251 = Array.from({ length: 250 }, (_, i) => `UnmatchedCustomTerm${i + 1}`).concat(['Niacinamide']);
  const r251 = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Niacinamide, Panthenol, Citric Acid',
    productType: 'cosmetic',
    customWatchlist: list251
  });
  assert.equal(r251.cards.profileCard.watchlistLimitExceeded, true);
  assert.equal(r251.cards.profileCard.profileStatuses.ozel_kara_liste, 'unknown');
  assert.equal(r251.cards.profileCard.preferenceMatchScore, null);
});

// 51. MCI Kısaltmasıyla 3:1 Karışım Oranı Kontrolü (9. Denetim P1)
runTest('51. MCI kısaltmasıyla "MCI 5 ppm, MI 5 ppm" (1:1) yasaklı (10 puan) ve "MCI 7.5 ppm, MI 2.5 ppm" (3:1) doğrulanmış izinli (80 puan) olmalı', () => {
  const rBadPpm = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, MCI 5 ppm, MI 5 ppm',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(rBadPpm.cards.regulatoryCard.score, 10);
  assert.equal(rBadPpm.cards.regulatoryCard.capApplied, 10);
  const fBad = rBadPpm.cards.regulatoryCard.findings.find((f) => f.substanceId === 'mi_mci');
  assert.ok(fBad && /1:1/.test(fBad.legalText));

  const rBadMgKg = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, MCI 5 mg/kg, MI 5 mg/kg',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(rBadMgKg.cards.regulatoryCard.score, 10);
  assert.equal(rBadMgKg.cards.regulatoryCard.capApplied, 10);

  const rBadPct = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, MCI 0.0005%, MI 0.0005%',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(rBadPct.cards.regulatoryCard.score, 10);
  assert.equal(rBadPct.cards.regulatoryCard.capApplied, 10);

  const rGood3to1 = evaluateProduct({
    rawText: 'Aqua, Glycerin, Panthenol, MCI 7.5 ppm, MI 2.5 ppm',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    lang: 'tr'
  });
  assert.equal(rGood3to1.cards.regulatoryCard.score, 80);
  assert.equal(rGood3to1.cards.regulatoryCard.capApplied, null);
  const fGood = rGood3to1.cards.regulatoryCard.findings.find((f) => f.substanceId === 'mi_mci');
  assert.ok(fGood && /3:1 olarak doğrulandı/.test(fGood.legalText));
});

// 52. B_alkol + Sertifika GİMDES Conflict Davranışı ve 10 Dilde compareProducts Yasal Açıklama Yerelleştirmesi (9. Denetim P2)
runTest('52. Kozmetik Alcohol Denat. + sertifika GİMDES te conflict dönmeli (diğer 3 otorite sari kalmalı); compareProducts 10 dilde Türkçe legalText sızdırmamalı', () => {
  const rEthGimdes = evaluateProduct({
    rawText: 'Ingredients: Aqua, Glycerin, Alcohol Denat., Panthenol, Tocopherol',
    productType: 'cosmetic',
    halalAuthority: 'GIMDES',
    claims: { halalCertified: true, veganStatus: 'none', vegetarianStatus: 'none' }
  });
  assert.equal(rEthGimdes.cards.halalCard.overallStatus, 'conflict');
  const fEth = rEthGimdes.cards.halalCard.findings.find((f) => f.ruleId === 'ethanol_cosmetic_or_food');
  assert.equal(fEth.status, 'conflict');
  assert.equal(fEth.authorityMatrix.GIMDES, 'conflict');
  assert.equal(fEth.authorityMatrix.JAKIM, 'sari');
  assert.equal(fEth.authorityMatrix.MUI, 'sari');
  assert.equal(fEth.authorityMatrix.IFANCA, 'sari');
  assert.equal(fEth.hasAuthorityDifference, true);

  const nonTrLangs = ['en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  const trLeakRegex = /AB 2016\/1198|durulanmayan|YASAKTIR|kısıtlamasına tabi|Ek III|kozmetik ürünlerde/i;
  for (const lang of nonTrLangs) {
    const comp = compareProducts(
      { name: 'Product A', rawText: 'Aqua, Glycerin, Panthenol, Tocopherol, Methylisothiazolinone', productType: 'cosmetic' },
      { name: 'Product B', rawText: 'Aqua, Glycerin, Panthenol, Tocopherol, Citric Acid', productType: 'cosmetic' },
      { lang }
    );
    assert.ok(comp.decidingDifference && comp.decidingDifference.explanation);
    assert.ok(
      !trLeakRegex.test(comp.decidingDifference.explanation),
      `Dil=${lang} compareProducts decidingDifference.explanation içinde Türkçe sızıntı: "${comp.decidingDifference.explanation}"`
    );
  }
});

// 53. 10 Dilde Ek/Koşul Doğruluğu (Annex V/39 3:1 vs 1:1, Annex V/57 15 ppm, Annex VI/32 %3) (10. Denetim P2)
runTest('53. Türkçe dışındaki 9 dilde Ek V/39 (MCI/MI 1:1 vs 3:1), Ek V/57 (MI >15 ppm) ve Ek VI/32 ihlalleri yanlışlıkla Ek II dememeli, doğru Ek ve oranı korumalı', () => {
  const nonTrLangs = ['en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  const wrongAnnex2Regex = /Annex II\b|Anhang II\b|Annexe II\b|Anexo II\b|Lampiran II\b|Приложению II\b|الملحق الثاني|ضمیمہ II\b/;

  for (const lang of nonTrLangs) {
    // 1) MCI 5 ppm + MI 5 ppm (1:1 in rinse_off) vs MCI 7.5 ppm + MI 2.5 ppm (3:1 in rinse_off)
    const compMci = compareProducts(
      {
        name: 'Product A',
        rawText: 'Aqua, Glycerin, Panthenol, Tocopherol, MCI 5 ppm, MI 5 ppm',
        productType: 'cosmetic',
        applicationType: 'rinse_off'
      },
      {
        name: 'Product B',
        rawText: 'Aqua, Glycerin, Panthenol, Tocopherol, MCI 7.5 ppm, MI 2.5 ppm',
        productType: 'cosmetic',
        applicationType: 'rinse_off'
      },
      { lang }
    );
    assert.ok(compMci.decidingDifference && compMci.decidingDifference.explanation);
    const expMci = compMci.decidingDifference.explanation;
    assert.ok(
      /V\/39/.test(expMci) && /3:1/.test(expMci) && /1:1/.test(expMci),
      `Dil=${lang} MCI/MI 1:1 ihlalinde V/39, 3:1 ve 1:1 korunmalı: "${expMci}"`
    );
    assert.ok(
      !wrongAnnex2Regex.test(expMci),
      `Dil=${lang} MCI/MI Ek V/39 ihlali yanlışlıkla Annex II olarak raporlanmamalı: "${expMci}"`
    );

    // 2) MI 20 ppm in rinse_off (>15 ppm Annex V/57 violation)
    const evalMi20 = evaluateProduct({
      rawText: 'Aqua, Glycerin, Panthenol, Tocopherol, Citric Acid, MI 20 ppm',
      productType: 'cosmetic',
      applicationType: 'rinse_off',
      lang
    });
    const fMi20 = evalMi20.cards.regulatoryCard.findings.find((f) => f.substanceId === 'mi_mci');
    assert.ok(fMi20 && /V\/57/.test(fMi20.legalText) && /15 ppm/.test(fMi20.legalText));
    assert.ok(!wrongAnnex2Regex.test(fMi20.legalText));
  }
});

// 54. Hibrit Barkod Okuyucu (EAN / Open Food & Beauty Facts) ve <%80 Kapsam OCR Yönlendirme Sigortası
runTest('54. Hibrit Barkod Okuyucu: EAN-13 (Arapça/Urduca rakamlar dahil), 10 dilde ürün adı, <%80 kapsamda requiresOcrFallback=true ve bilinmeyen barkod koruması', () => {
  // 1) Arapça ve Urduca rakamlarla barkod normalizasyonu
  assert.deepEqual(normalizeBarcodeInput('٣٠١٧٦٢٠٤٢٢٠٠٣'), { valid: true, code: '3017620422003' });
  assert.deepEqual(normalizeBarcodeInput('۳۳۳۷۸۷۵۵۹۷۳۸۸'), { valid: true, code: '3337875597388' });
  assert.equal(normalizeBarcodeInput('abc-123').valid, false);

  // 2) 10 dilde Nutella (3017620422003) ve CeraVe (3337875597388) %100 kapsamla çözümlenmeli
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  const wrongFlourRegex = /buğday unu|wheat flour|weizenmehl|farine de blé|harina de trigo|пшеничная мука|دقيق القمح|میدہ/i;
  for (const lang of langs) {
    const nutella = lookupBarcodeProduct({
      barcode: '3017620422003',
      lang,
      evaluationOptions: { userProfiles: ['astim_alerji'] }
    });
    assert.equal(nutella.valid, true);
    assert.equal(nutella.found, true);
    assert.equal(nutella.productType, 'food');
    assert.equal(nutella.coveragePercent, 100);
    assert.equal(nutella.requiresOcrFallback, false);
    assert.ok(nutella.productName && nutella.productName.length > 3);

    const sugarObs = nutella.evaluation.observations.find((o) => o.raw === 'Sugar');
    assert.ok(sugarObs && sugarObs.status === 'recognized' && sugarObs.sugar && sugarObs.sugar.id === 'sugar');

    const lecObs = nutella.evaluation.observations.find((o) => /lecithins/i.test(o.raw));
    assert.ok(lecObs && lecObs.substance && lecObs.substance.id === 'food_emulsifiers_lecithin_pgpr');
    assert.ok(lecObs.halalRule && lecObs.halalRule.id === 'lecithin_e322');
    assert.ok(
      !wrongFlourRegex.test(lecObs.localizedName),
      `Dil=${lang} Lecithins (Soya) yanlışlıkla un olarak adlandırıldı: "${lecObs.localizedName}"`
    );

    const soyAlert = nutella.evaluation.cards.profileCard.alerts.find((a) => /lecithins/i.test(a.rawToken));
    assert.ok(soyAlert, `Dil=${lang} Soya alerjen uyarısı bulunmalı`);
    assert.ok(
      !wrongFlourRegex.test(soyAlert.explanation),
      `Dil=${lang} Soya alerjen uyarısında yanlış un adı geçti: "${soyAlert.explanation}"`
    );

    const oreo = lookupBarcodeProduct({
      barcode: '7622210449283',
      lang,
      evaluationOptions: { userProfiles: ['astim_alerji'] }
    });
    const traceAlert = oreo.evaluation.cards.profileCard.alerts.find((a) => a.level === 'sari');
    assert.ok(traceAlert, `Dil=${lang} Oreo eser miktar uyarısı bulunmalı`);
    if (lang !== 'en') {
      assert.ok(
        !/: milk$/i.test(traceAlert.localizedName),
        `Dil=${lang} Oreo eser miktar uyarısında "milk" çevrilmemiş: "${traceAlert.localizedName}"`
      );
    }
  }

  const cerave = lookupBarcodeProduct({ barcode: '3337875597388', lang: 'tr' });
  assert.equal(cerave.found, true);
  assert.equal(cerave.evaluation.cards.regulatoryCard.score, 100);
  assert.equal(cerave.requiresOcrFallback, false);
  const cerNP = cerave.evaluation.observations.find((o) => o.raw === 'Ceramide NP');
  const cerAP = cerave.evaluation.observations.find((o) => o.raw === 'Ceramide AP');
  const cerEOP = cerave.evaluation.observations.find((o) => o.raw === 'Ceramide EOP');
  assert.equal(cerNP.substance.id, 'ceramide_np');
  assert.equal(cerAP.substance.id, 'ceramides_family');
  assert.equal(cerEOP.substance.id, 'ceramides_family');
  assert.equal(cerNP.localizedName, 'Seramid NP');
  assert.equal(cerAP.localizedName, 'Seramid AP');
  assert.equal(cerEOP.localizedName, 'Seramid EOP');

  // 3) <%80 kapsamlı gönüllü kaydı (0000000000017) requiresOcrFallback = true dönmeli
  const lowCov = lookupBarcodeProduct({ barcode: '0000000000017', lang: 'en' });
  assert.equal(lowCov.found, true);
  assert.ok(lowCov.coveragePercent < 80);
  assert.equal(lowCov.requiresOcrFallback, true);
  assert.equal(lowCov.fallbackReason, 'insufficient_coverage_under_80_percent');
  assert.equal(lowCov.evaluation.cards.regulatoryCard.score, null);

  // 4) Kayıtsız barkod (9999999999999) found=false ve requiresOcrFallback=true dönmeli
  const missing = lookupBarcodeProduct({ barcode: '9999999999999', lang: 'tr' });
  assert.equal(missing.valid, true);
  assert.equal(missing.found, false);
  assert.equal(missing.reason, 'barcode_not_found');
  assert.equal(missing.requiresOcrFallback, true);
});

// ============================================================================
// TEST 55: Marka Bağımsız "Bunun Yerine Rafta Ne Aramalıyım?" (Temiz & Helal Etiket Rehberi - 10 Dil)
// ============================================================================
runTest('55. Marka bağımsız Temiz & Helal Etiket Rehberi (swapGuideCard) 10 dilde deterministik alternatif üretmeli', () => {
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  for (const lang of langs) {
    // 1) Helal + Katkı + Şeker içeren ürün (Carmine E120 + Gelatin + E471 + Glucose-Fructose Syrup)
    const gummy = evaluateProduct({
      rawText: 'Glucose-Fructose Syrup, Sugar, Gelatin, Mono- and Diglycerides of Fatty Acids (E471), Carmine (E120), Citric Acid',
      productType: 'food',
      halalAuthority: 'GIMDES',
      lang
    });
    const sg = gummy.cards.swapGuideCard;
    assert.ok(sg && Array.isArray(sg.items), `Dil=${lang} swapGuideCard mevcut olmalı`);
    assert.ok(sg.items.some((x) => x.swapId === 'swap_carmine_e120' && x.severity === 'kirmizi'), `Dil=${lang} E120 alternatifi (E162/E163) üretilmeli`);
    assert.ok(sg.items.some((x) => x.swapId === 'swap_gelatin'), `Dil=${lang} Jelatin alternatifi (Pektin E440 / Agar E406) üretilmeli`);
    assert.ok(sg.items.some((x) => x.swapId === 'swap_emulsifier_e471'), `Dil=${lang} E471 alternatifi (E322 / Bitkisel) üretilmeli`);
    assert.ok(sg.items.some((x) => x.swapId === 'swap_added_sugar_syrup'), `Dil=${lang} Şeker/Şurup alternatifi üretilmeli`);
    const sugarSwap = sg.items.find((x) => x.swapId === 'swap_added_sugar_syrup');
    assert.ok(/EFSA/i.test(sugarSwap.whySwap), `Dil=${lang} şeker alternatifi açıklaması EFSA serbest şeker nüansını içermeli`);
    for (const item of sg.items) {
      assert.ok(item.lookForInstead && item.lookForInstead.length > 10, `Dil=${lang} lookForInstead boş olmamalı`);
      assert.ok(item.whySwap && item.whySwap.length > 10, `Dil=${lang} whySwap boş olmamalı`);
      assert.ok(item.detectedIngredient && item.detectedIngredient.length > 1, `Dil=${lang} detectedIngredient boş olmamalı`);
    }

    // 2) Barkod (Nutella 3017620422003) -> Soya Lesitini için Ayçiçek Lesitini (Sunflower Lecithin) önermeli
    const nutella = lookupBarcodeProduct({ barcode: '3017620422003', lang });
    const nutSg = nutella.evaluation.cards.swapGuideCard;
    assert.ok(nutSg.items.some((x) => x.swapId === 'swap_allergen_soy_lecithin'), `Dil=${lang} Nutella soya lesitini için ayçiçek lesitini önermeli`);
    assert.ok(nutSg.items.some((x) => x.swapId === 'swap_added_sugar_syrup'), `Dil=${lang} Nutella ilave şeker alternatifi önermeli`);
    assert.ok(!nutSg.items.some((x) => x.swapId === 'swap_uv_filters_silicones_nail'), `Dil=${lang} gıdada kozmetik alternatifi çıkmamalı`);

    // 3) Barkod (Oreo 7622210449283) -> allergenStatement taşımalı, süt çapraz teması + soya + buğday + şeker önermeli (profil kapalıyken ve açıkken)
    const oreo = lookupBarcodeProduct({ barcode: '7622210449283', lang });
    assert.equal(oreo.allergenStatement, 'May contain milk', `Dil=${lang} Oreo allergenStatement korunmalı`);
    const oreoSg = oreo.evaluation.cards.swapGuideCard;
    assert.ok(oreoSg.items.some((x) => x.swapId === 'swap_allergen_dairy_milk'), `Dil=${lang} Oreo süt alternatifi (swap_allergen_dairy_milk) üretmeli`);
    assert.ok(oreoSg.items.some((x) => x.swapId === 'swap_allergen_soy_lecithin'), `Dil=${lang} Oreo soya lesitini alternatifi üretmeli`);
    assert.ok(oreoSg.items.some((x) => x.swapId === 'swap_allergen_gluten_wheat'), `Dil=${lang} Oreo buğday/gluten alternatifi üretmeli`);
    assert.ok(oreoSg.items.some((x) => x.swapId === 'swap_added_sugar_syrup'), `Dil=${lang} Oreo birleşik şeker alternatifi üretmeli`);
    assert.ok(!oreoSg.items.some((x) => x.swapId === 'swap_uv_filters_silicones_nail'), `Dil=${lang} Oreo'da kozmetik alternatifi (Zinc Oxide/Tinosorb) çıkmamalı`);

    // Alerji profili (astim_alerji) açıkken yeniden değerlendirmede 4 profil uyarısı (3 kırmızı + 1 sarı süt izi) ve doğru gıda alternatifleri üretilmeli
    const oreoWithAllergy = evaluateProduct({
      rawText: oreo.rawText,
      productType: oreo.productType,
      allergenStatement: oreo.allergenStatement,
      userProfiles: ['astim_alerji'],
      lang
    });
    const alerts = oreoWithAllergy.cards.profileCard.alerts;
    assert.equal(alerts.length, 4, `Dil=${lang} Oreo astim_alerji profilinde 4 uyarı (3 kırmızı + 1 sarı süt izi) üretmeli`);
    assert.equal(alerts.filter((a) => a.level === 'kirmizi').length, 3);
    assert.equal(alerts.filter((a) => a.level === 'sari').length, 1);
    const oreoAllergySg = oreoWithAllergy.cards.swapGuideCard;
    assert.ok(oreoAllergySg.items.some((x) => x.swapId === 'swap_allergen_dairy_milk'), `Dil=${lang} alerji profili açık Oreo süt alternatifi üretmeli`);
    assert.ok(oreoAllergySg.items.some((x) => x.swapId === 'swap_allergen_soy_lecithin'), `Dil=${lang} alerji profili açık Oreo soya alternatifi üretmeli`);
    assert.ok(oreoAllergySg.items.some((x) => x.swapId === 'swap_allergen_gluten_wheat'), `Dil=${lang} alerji profili açık Oreo gluten alternatifi üretmeli`);
    assert.ok(!oreoAllergySg.items.some((x) => x.swapId === 'swap_uv_filters_silicones_nail'), `Dil=${lang} alerji profili açık Oreo'da kozmetik alternatifi çıkmamalı`);
    assert.ok(!oreoAllergySg.items.some((x) => x.swapId === 'swap_allergen_nuts_other'), `Dil=${lang} süt izi uyarısı kuruyemiş/susam alternatifine düşmemeli`);

    // 4) Tamamen temiz/uyumlu ürün (Aqua, Panthenol, Niacinamide) -> 0 swap ve allCleanMessage
    const clean = evaluateProduct({
      rawText: 'Aqua, Panthenol, Niacinamide, Sodium Hyaluronate',
      productType: 'cosmetic',
      lang
    });
    assert.equal(clean.cards.swapGuideCard.totalSwaps, 0, `Dil=${lang} temiz üründe 0 alternatif olmalı`);
    assert.equal(clean.cards.swapGuideCard.items.length, 0);
    assert.ok(clean.cards.swapGuideCard.allCleanMessage.length > 15);
  }
});

// ============================================================================
// TEST 56: Kozmetik "Birlikte Kullanım / Cilt Rutini Çakışma Uyarısı" (routineConflictCard & compareProducts.routineLayeringCard - 10 Dil)
// ============================================================================
runTest('56. Kozmetik Cilt Rutini Çakışma Uyarısı (routineConflictCard ve compareProducts.routineLayeringCard) 10 dilde aktif çakışmaları ve SPF uyarısını tespit etmeli', () => {
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  for (const lang of langs) {
    // 1) Tek formülde Retinol + Glycolic Acid + Alcohol Denat. (Top-5) -> conflict_retinoid_aha_bha (kirmizi) + conflict_multi_acids_or_alcohol (sari) + needsSpfReminder=true
    const retAcid = evaluateProduct({
      rawText: 'Aqua, Alcohol Denat., Glycolic Acid, Glycerin, Retinol, Panthenol',
      productType: 'cosmetic',
      lang
    });
    const rc = retAcid.cards.routineConflictCard;
    assert.ok(rc && rc.applicable === true, `Dil=${lang} kozmetik üründe routineConflictCard applicable=true olmalı`);
    assert.equal(rc.needsSpfReminder, true, `Dil=${lang} Retinol + AHA/BHA içeren üründe needsSpfReminder=true olmalı`);
    assert.ok(rc.spfReminderText && rc.spfReminderText.length > 15);
    assert.ok(
      rc.conflicts.some((c) => c.conflictId === 'conflict_retinoid_aha_bha' && c.severity === 'kirmizi'),
      `Dil=${lang} Retinol + Glycolic Acid çakışması (conflict_retinoid_aha_bha) tespit edilmeli`
    );
    assert.ok(
      rc.conflicts.some((c) => c.conflictId === 'conflict_multi_acids_or_alcohol' && c.severity === 'sari'),
      `Dil=${lang} Top-5 Alcohol Denat. + Aktif çakışması (conflict_multi_acids_or_alcohol) tespit edilmeli`
    );

    // 2) Retinol + Benzoyl Peroxide -> conflict_retinoid_benzoyl_peroxide (kirmizi)
    const retBpo = evaluateProduct({
      rawText: 'Aqua, Glycerin, Benzoyl Peroxide, Retinol, Panthenol',
      productType: 'cosmetic',
      lang
    });
    assert.ok(
      retBpo.cards.routineConflictCard.conflicts.some(
        (c) => c.conflictId === 'conflict_retinoid_benzoyl_peroxide' && c.severity === 'kirmizi'
      ),
      `Dil=${lang} Retinol + Benzoyl Peroxide çakışması tespit edilmeli`
    );

    // 3) Copper Tripeptide-1 + Ascorbic Acid -> conflict_copper_peptide_acids_vitc (sari)
    const copperVitC = evaluateProduct({
      rawText: 'Aqua, Glycerin, Copper Tripeptide-1, Ascorbic Acid, Panthenol',
      productType: 'cosmetic',
      lang
    });
    assert.ok(
      copperVitC.cards.routineConflictCard.conflicts.some(
        (c) => c.conflictId === 'conflict_copper_peptide_acids_vitc' && c.severity === 'sari'
      ),
      `Dil=${lang} Bakır Peptit + Saf C Vitamini çakışması tespit edilmeli`
    );

    // 4) İki ayrı kozmetik ürün karşılaştırıldığında (Ürün A: The Ordinary Glycolic Acid 7% vs Ürün B: La Roche-Posay Retinol B3) -> routineLayeringCard
    const compLayer = compareProducts(
      {
        name: 'The Ordinary Glycolic Acid 7%',
        rawText: 'Aqua, Glycolic Acid, Salicylic Acid, Glycerin, Panthenol',
        productType: 'cosmetic'
      },
      {
        name: 'La Roche-Posay Retinol B3 Serum',
        rawText: 'Aqua, Glycerin, Niacinamide, Retinol, Retinyl Palmitate, Tocopherol',
        productType: 'cosmetic'
      },
      { lang }
    );
    assert.ok(compLayer.routineLayeringCard && compLayer.routineLayeringCard.applicable === true);
    assert.ok(
      compLayer.routineLayeringCard.conflicts.some((c) => c.conflictId === 'conflict_retinoid_aha_bha'),
      `Dil=${lang} A ve B ürünleri arasında Retinoid + AHA/BHA katmanlama çakışması tespit edilmeli`
    );
    assert.equal(compLayer.routineLayeringCard.needsSpfReminder, true);

    // 5) Gıda ürününde routineConflictCard applicable=false olmalı
    const foodEval = evaluateProduct({
      rawText: 'Sugar, Cocoa Butter, Skimmed Milk Powder',
      productType: 'food',
      lang
    });
    assert.equal(foodEval.cards.routineConflictCard.applicable, false);
  }
});

// ============================================================================
// TEST 57: Genişletilmiş Barkod Kataloğu (22 Ürün · 10 Dil) ve Cihaza Özel Barkod Kaydı (createCustomBarcodeEntry & customCatalog)
// ============================================================================
runTest('57. Genişletilmiş Barkod Kataloğu (21 tam kapsamlı ürün + 1 <%80 test kaydı = 22 barkod) 10 dilde çalışmalı ve özel barkod kaydı doğrulanmalı', () => {
  const allCodes = Object.keys(VERIFIED_BARCODE_CATALOG);
  assert.ok(allCodes.length >= 22, `Katalogda en az 22 doğrulanmış barkod olmalı (bulunan: ${allCodes.length})`);

  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  for (const code of allCodes) {
    for (const lang of langs) {
      const res = lookupBarcodeProduct({ barcode: code, lang });
      assert.equal(res.valid, true, `Barkod=${code} Dil=${lang} valid=true olmalı`);
      assert.equal(res.found, true, `Barkod=${code} Dil=${lang} found=true olmalı`);
      assert.ok(res.productName && res.productName.length > 2, `Barkod=${code} Dil=${lang} yerelleştirilmiş ad dönmeli`);
      if (code === '0000000000017') {
        assert.ok(res.coveragePercent < 80);
        assert.equal(res.requiresOcrFallback, true);
      } else {
        assert.equal(res.coveragePercent, 100, `Barkod=${code} Dil=${lang} %100 tanınma kapsamına sahip olmalı (bulunan: ${res.coveragePercent})`);
        assert.equal(res.requiresOcrFallback, false, `Barkod=${code} Dil=${lang} requiresOcrFallback=false olmalı`);
      }
    }
  }

  // Özel Barkod Kaydı (createCustomBarcodeEntry + lookupBarcodeProduct customCatalog)
  const customCode = '8699999888877';
  const builtOk = createCustomBarcodeEntry({
    barcode: customCode,
    productName: 'Özel Bebek Şampuanı',
    productType: 'cosmetic',
    applicationType: 'rinse_off',
    rawText: 'Aqua, Glycerin, Panthenol, Coco-Glucoside, Citric Acid',
    lang: 'tr'
  });
  assert.equal(builtOk.ok, true);
  assert.equal(builtOk.coveragePercent, 100);
  const customCatalog = { [customCode]: builtOk.entry };
  const customLookup = lookupBarcodeProduct({ barcode: customCode, lang: 'tr', customCatalog });
  assert.equal(customLookup.found, true);
  assert.equal(customLookup.productName, 'Özel Bebek Şampuanı');
  assert.equal(customLookup.coveragePercent, 100);
  assert.equal(customLookup.requiresOcrFallback, false);

  // <%80 kapsamlı etiketle özel barkod kaydı reddedilmeli
  const builtLow = createCustomBarcodeEntry({
    barcode: '8699999888866',
    productName: 'Bilinmeyen Karışım',
    productType: 'cosmetic',
    rawText: 'Aqua, Mystery Substance X1, Mystery Substance X2, Mystery Substance X3',
    lang: 'tr'
  });
  assert.equal(builtLow.ok, false);
  assert.equal(builtLow.reason, 'insufficient_coverage_under_80_percent');
});

// ============================================================================
// TEST 58: Resmi Mevzuat & Alerjen Raporu (regulatoryReportCard & 4 Katmanlı Güncellik Mimarisi - 10 Dil)
// ============================================================================
runTest('58. Resmi Mevzuat & Alerjen Raporu (regulatoryReportCard) 10 dilde 4 katmanlı güncellik mührü, Omnibus geçiş takvimi, alerjen listesi ve resmi URL kaynaklarını üretmeli', () => {
  const langs = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];
  for (const lang of langs) {
    // 1) Kozmetik (TPO + TPHP + Retinol + Linalool + Limonene) -> Omnibus takvimi + koku alerjenleri + resmi kaynaklar
    const cosEval = evaluateProduct({
      rawText: 'Aqua, Glycerin, Trimethylbenzoyl Diphenylphosphine Oxide, Triphenyl Phosphate, Retinol, Linalool, Limonene',
      productType: 'cosmetic',
      jurisdiction: 'EU',
      halalAuthority: 'GIMDES',
      lang
    });
    const rr = cosEval.cards.regulatoryReportCard;
    assert.ok(rr, `Dil=${lang} regulatoryReportCard mevcut olmalı`);
    assert.equal(rr.datasetManifest.datasetVersion, '2026.10-omnibus');
    assert.equal(rr.datasetManifest.cosingDictionaryCount, 30609);
    assert.equal(rr.datasetManifest.activeJurisdiction, 'EU');
    assert.equal(rr.datasetManifest.selectedHalalAuthority, 'GIMDES');
    assert.equal(rr.freshnessPillars.length, 4, `Dil=${lang} 4 katmanlı güncellik mimarisi bulunmalı`);
    for (const p of rr.freshnessPillars) {
      assert.ok(p.title && !/^Pillar\s+\d+/i.test(p.title), `Dil=${lang} pillar başlığı İngilizce fallback ('Pillar N') olmamalı: ${p.title}`);
      assert.ok(p.detail && p.detail.length > 10, `Dil=${lang} pillar açıklaması dolu olmalı`);
    }
    assert.ok(rr.sourcesBadgeLabel && rr.allergensBadgeLabel && rr.calendarBadgeLabel, `Dil=${lang} rozet etiketleri mevcut olmalı`);
    if (lang !== 'tr') {
      assert.notEqual(rr.sourcesBadgeLabel, 'Resmi Kaynak', `Dil=${lang} sourcesBadgeLabel Türkçe sızdırmamalı`);
      assert.notEqual(rr.allergensBadgeLabel, 'Alerjen', `Dil=${lang} allergensBadgeLabel Türkçe sızdırmamalı`);
      assert.notEqual(rr.calendarBadgeLabel, 'Omnibus Takvim', `Dil=${lang} calendarBadgeLabel Türkçe sızdırmamalı`);
    }
    assert.ok(
      rr.transitionCalendarItems.some((t) => /2025-09-01/.test(t.deadline) && /2025\/877/.test(t.regulation)),
      `Dil=${lang} TPO için EU 2025/877 (2025-09-01) takvim maddesi bulunmalı`
    );
    assert.ok(
      rr.transitionCalendarItems.some(
        (t) =>
          t.placingOnMarketDate === '2027-01-01' &&
          t.makingAvailableDate === '2028-07-01' &&
          /2027-01-01/.test(t.deadline) &&
          /2028-07-01/.test(t.deadline) &&
          /2026\/909/.test(t.regulation)
      ),
      `Dil=${lang} TPHP için EU 2026/909 (2027-01-01 piyasaya arz / 2028-07-01 bulundurma) takvim maddesi bulunmalı`
    );
    assert.ok(
      rr.transitionCalendarItems.some(
        (t) =>
          t.placingOnMarketDate === '2025-11-01' &&
          t.makingAvailableDate === '2027-05-01' &&
          /2027-05-01/.test(t.deadline) &&
          /0\.05%/.test(t.regulation) &&
          /0\.3%/.test(t.regulation) &&
          /2024\/996/.test(t.regulation)
      ),
      `Dil=${lang} Retinol için EU 2024/996 (0.05%/0.3%, 2025-11-01 / 2027-05-01) takvim maddesi bulunmalı`
    );
    assert.ok(rr.detectedAllergens.length >= 2, `Dil=${lang} Linalool ve Limonene alerjen olarak listelenmeli`);
    assert.ok(rr.citedOfficialSources.length >= 3, `Dil=${lang} en az 3 resmi kaynak (checkedAt ve url ile) listelenmeli`);
    for (const src of rr.citedOfficialSources) {
      assert.ok(src.id && src.checkedAt && src.url, `Dil=${lang} resmi kaynakta id, checkedAt ve url bulunmalı`);
    }

    // 2) Kojic Acid, Alpha-Arbutin ve Azelaic Acid ayrımı (EU 2024/996 madde bazlı doğru limit ve tarih)
    const kojicEval = evaluateProduct({
      rawText: 'Aqua, Kojic Acid, Alpha-Arbutin',
      productType: 'cosmetic',
      lang
    });
    const kojicItems = kojicEval.cards.regulatoryReportCard.transitionCalendarItems;
    assert.equal(kojicItems.length, 2, `Dil=${lang} Kojic Acid + Alpha-Arbutin 2 ayrı takvim maddesi üretmeli`);
    assert.ok(
      kojicItems.some(
        (t) =>
          /1\.0%/.test(t.regulation) &&
          t.placingOnMarketDate === '2025-02-01' &&
          t.makingAvailableDate === '2025-11-01' &&
          !/0\.3%/.test(t.regulation) &&
          !/2027-05-01/.test(t.deadline)
      ),
      `Dil=${lang} Kojic Acid için %1.0 yüz/el sınırı ve 2025-02-01 / 2025-11-01 tarihleri üretilmeli (Retinol bilgisi karışmamalı)`
    );
    assert.ok(
      kojicItems.some(
        (t) =>
          /2\.0%/.test(t.regulation) &&
          /0\.5%/.test(t.regulation) &&
          t.placingOnMarketDate === '2025-02-01' &&
          t.makingAvailableDate === '2025-11-01'
      ),
      `Dil=${lang} Alpha-Arbutin için %2.0 yüz / %0.5 vücut sınırı ve 2025-02-01 / 2025-11-01 tarihleri üretilmeli`
    );

    const azelaicEval = evaluateProduct({
      rawText: 'Aqua, Azelaic Acid, Tranexamic Acid',
      productType: 'cosmetic',
      lang
    });
    assert.equal(
      azelaicEval.cards.regulatoryReportCard.transitionCalendarItems.length,
      0,
      `Dil=${lang} Azelaic Acid ve Tranexamic Acid için EU 2024/996 takvim maddesi üretilmemeli`
    );

    // 3) Gıda (Nutella barkodu) -> Fındık, Süt, Soya alerjenleri EU_1169_2011 altında raporlanmalı
    const nutella = lookupBarcodeProduct({ barcode: '3017620422003', lang });
    const nutRr = nutella.evaluation.cards.regulatoryReportCard;
    assert.ok(nutRr.detectedAllergens.length >= 3, `Dil=${lang} Nutella'da en az 3 gıda alerjeni (fındık, süt, soya) raporlanmalı`);
    assert.ok(nutRr.citedOfficialSources.some((s) => s.id === 'EU_1169_2011'));
  }
});

console.log(`\n🎉 TÜM TESTLER TAMAMLANDI: ${passed}/58 KABUL KRİTERİ %100 BAŞARIYLA GEÇTİ!`);



