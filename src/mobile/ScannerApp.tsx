import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as ReactNative from 'react-native';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  StyleSheet,
  Share,
  useColorScheme
} from 'react-native';
import { readSensitiveJson, writeSensitiveJson, clearAllSensitiveStorage } from './secureStorage';
import { CameraView, Camera } from 'expo-camera';
import { captureAndRecognizeLabel } from './ocrService';
import {
  BARCODE_CACHE_KEY,
  CUSTOM_BARCODES_STORAGE_KEY,
  lookupBarcodeOnDevice,
  saveCustomBarcodeOnDevice,
  BarcodeLookupResult
} from './barcodeService';
import { SUPPORTED_LANGUAGES, getLocaleStrings } from '../i18n/locales.mjs';
import {
  evaluateProduct,
  compareProducts,
  evaluateHouseholdProfiles,
  evaluateRoutineShelf,
  findCleanerAlternativesAndDupes,
  getIngredientDossier,
  extractSmartLabelContext
} from '../engine/ruleEngine.mjs';

/**
 * InciFact — 5-Screen Calm Mobile Architecture (React Native / Expo SDK 52)
 * Supports 10 Global Languages (TR, EN, AR [RTL], DE, FR, ID, MS, ES, RU, UR [RTL])
 * Zero pre-filled fake scan state on startup, live camera barcode + offline ML Kit OCR,
 * persisted user preferences, and high-contrast authority/criterion toggles.
 */

type TabId = 'profile' | 'scan' | 'result' | 'halal' | 'compare';
type ProductType = 'cosmetic' | 'food';
type SelectableHalalAuthority = 'GIMDES' | 'JAKIM' | 'MUI' | 'IFANCA';
type JurisdictionCode = 'TR' | 'EU' | 'US';
type VeganStatus = 'none' | 'declared' | 'verified';
type LangCode = 'tr' | 'en' | 'ar' | 'de' | 'fr' | 'id' | 'ms' | 'es' | 'ru' | 'ur';

const AUTHORITIES: readonly SelectableHalalAuthority[] = ['GIMDES', 'JAKIM', 'MUI', 'IFANCA'];
const APP_ICON = require('../../assets/icon.png');
const USER_PREFS_STORAGE_KEY = 'incifact_user_prefs_v1';
const WATCHLIST_STORAGE_KEY = 'incifact_custom_watchlist_v1';
const HISTORY_STORAGE_KEY = 'incifact_scan_history_v1';
const HOUSEHOLD_STORAGE_KEY = 'incifact_household_v1';
const SHELF_STORAGE_KEY = 'incifact_shelf_v1';
type MadhhabCode = 'general' | 'hanafi' | 'shafii' | 'maliki' | 'hanbali';
const MADHHABS: readonly MadhhabCode[] = ['general', 'hanafi', 'shafii', 'maliki', 'hanbali'];

interface CompareSlotItem {
  name: string;
  rawText: string;
  productType: ProductType;
  jurisdiction?: string;
  nutritionPer100g?: Record<string, any> | null;
  claims?: {
    halalCertified: boolean;
    veganStatus: 'none' | 'declared' | 'verified';
    vegetarianStatus: 'none' | 'declared' | 'verified';
  };
  userConfirmations?: Record<string, string>;
}

type ScanHistoryEntry = CompareSlotItem & { score: number | null };

const MOBILE_FEAT_I18N: Record<
  LangCode,
  {
    watchlistTitle: string;
    shareCardBtn: string;
    recentScansTitle: string;
    scannedLabel: (slot: string) => string;
    customScanPrefix: string;
    pendingOcr: string;
    lowCoverage: string;
  }
> = {
  tr: {
    watchlistTitle: 'Kişisel Kara Listem (Özel Madde Ekle)',
    shareCardBtn: 'Sonuç Özeti Paylaş',
    recentScansTitle: 'Son Tarananlar (Tek Tıkla A / B Karşılaştır)',
    scannedLabel: (s) => `Taranan Ürün (${s})`,
    customScanPrefix: 'Özel Analiz',
    pendingOcr: 'OCR Teyidi Bekliyor',
    lowCoverage: 'Kapsam Yetersiz (<%80)'
  },
  en: {
    watchlistTitle: 'My Personal Watchlist (Custom Ingredients)',
    shareCardBtn: 'Share Result Summary',
    recentScansTitle: 'Recent Scans (1-Click Compare A / B)',
    scannedLabel: (s) => `Scanned Product (${s})`,
    customScanPrefix: 'Custom Scan',
    pendingOcr: 'Awaiting OCR Confirmation',
    lowCoverage: 'Low Coverage (<80%)'
  },
  ar: {
    watchlistTitle: 'قائمتي السوداء الشخصية (إضافة مكونات خاصة)',
    shareCardBtn: 'مشاركة ملخص النتيجة',
    recentScansTitle: 'عمليات الفحص الأخيرة (مقارنة بنقرة أ / ب)',
    scannedLabel: (s) => `المنتج الممسوح (${s})`,
    customScanPrefix: 'فحص مخصص',
    pendingOcr: 'بانتظار تأكيد القراءة',
    lowCoverage: 'التغطية غير كافية (<80%)'
  },
  de: {
    watchlistTitle: 'Persönliche Sperrliste (Eigene Stoffe)',
    shareCardBtn: 'Ergebnis teilen',
    recentScansTitle: 'Letzte Scans (1-Klick Vergleich A / B)',
    scannedLabel: (s) => `Gescanntes Produkt (${s})`,
    customScanPrefix: 'Eigene Analyse',
    pendingOcr: 'OCR-Bestätigung ausstehend',
    lowCoverage: 'Abdeckung unzureichend (<80%)'
  },
  fr: {
    watchlistTitle: 'Ma Liste Noire Personnelle (Ingrédients)',
    shareCardBtn: 'Partager le résumé',
    recentScansTitle: 'Scans récents (Comparer A / B en 1 clic)',
    scannedLabel: (s) => `Produit scanné (${s})`,
    customScanPrefix: 'Analyse perso',
    pendingOcr: 'Confirmation OCR requise',
    lowCoverage: 'Couverture insuffisante (<80%)'
  },
  id: {
    watchlistTitle: 'Daftar Hitam Pribadi (Bahan Khusus)',
    shareCardBtn: 'Bagikan Ringkasan Hasil',
    recentScansTitle: 'Pindaian Terakhir (1-Klik Bandingkan A / B)',
    scannedLabel: (s) => `Produk Dipindai (${s})`,
    customScanPrefix: 'Analisis Khusus',
    pendingOcr: 'Menunggu Konfirmasi OCR',
    lowCoverage: 'Cakupan Kurang (<80%)'
  },
  ms: {
    watchlistTitle: 'Senarai Hitam Peribadi (Bahan Khas)',
    shareCardBtn: 'Kongsi Ringkasan Keputusan',
    recentScansTitle: 'Imbasan Terkini (1-Klik Banding A / B)',
    scannedLabel: (s) => `Produk Diimbas (${s})`,
    customScanPrefix: 'Analisis Khas',
    pendingOcr: 'Menunggu Pengesahan OCR',
    lowCoverage: 'Liputan Tidak Mencukupi (<80%)'
  },
  es: {
    watchlistTitle: 'Mi Lista Negra Personal (Ingredientes)',
    shareCardBtn: 'Compartir Resumen',
    recentScansTitle: 'Escaneos Recientes (Comparar A / B)',
    scannedLabel: (s) => `Producto Escaneado (${s})`,
    customScanPrefix: 'Análisis propio',
    pendingOcr: 'Confirmación OCR pendiente',
    lowCoverage: 'Cobertura insuficiente (<80%)'
  },
  ru: {
    watchlistTitle: 'Мой черный список (Свои компоненты)',
    shareCardBtn: 'Поделиться результатом',
    recentScansTitle: 'Недавние сканы (Сравнить A / B)',
    scannedLabel: (s) => `Проверенный продукт (${s})`,
    customScanPrefix: 'Свой анализ',
    pendingOcr: 'Ожидает подтверждения OCR',
    lowCoverage: 'Недостаточный охват (<80%)'
  },
  ur: {
    watchlistTitle: 'میری ذاتی بلیک لسٹ (مخصوص اجزاء)',
    shareCardBtn: 'نتیجہ شیئر کریں',
    recentScansTitle: 'حالیہ اسکینز (موازنہ A / B)',
    scannedLabel: (s) => `اسکین شدہ پروڈکٹ (${s})`,
    customScanPrefix: 'مخصوص تجزیہ',
    pendingOcr: 'OCR تصدیق درکار ہے',
    lowCoverage: 'کوریج ناکافی (<80%)'
  }
};

interface ExtraMobileLocale {
  jurisdictionLabel: string;
  veganNone: string;
  veganDeclared: string;
  veganVerified: string;
  attentionOnlyBtn: string;
  allItemsBtn: string;
  noAttentionMsg: string;
  saveBarcodeTitle: string;
  saveBarcodePlaceholder: string;
  saveBarcodeBtn: string;
  saveBarcodeLowCov: string;
  saveBarcodeOk: (code: string) => string;
  methodologyBtn: string;
  methodologyTitle: string;
  methodologyIntro: string;
  methodologyItems: [string, string][];
  privacyBtn: string;
  privacyTitle: string;
  privacyBarcodeNote: string;
  closeBtn: string;
  shareNativeBtn: string;
  barcodeCardTitle: string;
  scanBarcodeCameraBtn: string;
  barcodeModalTitle: string;
  barcodeModalHint: string;
  barcodeFallbackOcrBtn: string;
  barcodeInputPlaceholder: string;
  barcodeLookupBtn: string;
  barcodeNameFoundHint: (name: string) => string;
  ocrCardTitle: string;
  ocrCameraBtn: string;
  ocrGalleryBtn: string;
  ocrEmptyErr: string;
  ocrPermissionErr: string;
  ocrNoNativeErr: string;
  manualCardTitle: string;
  manualPlaceholder: string;
  demoHeader: string;
  demoNames: [string, string, string];
  demoLoadedMsg: (name: string) => string;
  emptyResultTitle: string;
  emptyResultDesc: string;
  goScanBtn: string;
  editTextBtn: string;
  newScanReset: string;
  activeAuthorityTitle: string;
  emptyHalalDesc: string;
  loadAuthorityDemoBtn: string;
  emptyCompareTitle: string;
  emptyCompareDesc: string;
  emptySlotLabel: string;
  loadCompareDemoBtn: string;
  torchOn: string;
  torchOff: string;
  cropModeToggle: string;
  shieldSummaryPrefix: string;
}

const EXTRA_MOBILE_I18N: Record<LangCode, ExtraMobileLocale> = {
  tr: {
    jurisdictionLabel: 'Mevzuat Bölgesi',
    veganNone: 'Vegan: Yok',
    veganDeclared: 'Vegan: Beyanlı',
    veganVerified: 'Vegan: Sertifikalı',
    attentionOnlyBtn: 'Dikkat / Uyarılar',
    allItemsBtn: 'Tümü',
    noAttentionMsg: 'Bu üründe acil dikkat gerektiren yasaklı veya kısıtlı bulgu tespit edilmedi.',
    saveBarcodeTitle: 'Cihaza Özel Barkod Kaydet',
    saveBarcodePlaceholder: 'Ürün adı (isteğe bağlı)',
    saveBarcodeBtn: 'Barkodu Cihaza Kaydet',
    saveBarcodeLowCov: 'Kapsam %80 altında veya bekleyen OCR onayı var; önce etiketi netleştirip %80+ kapsama ulaşın.',
    saveBarcodeOk: (code) => `Barkod (${code}) doğrulandı ve yerel cihaz kataloğuna kaydedildi.`,
    methodologyBtn: 'Fıkhi Metodoloji & Resmi Fetva Kaynakları',
    methodologyTitle: 'Fıkhi Metodoloji ve Kaynak Beyanı',
    methodologyIntro: 'InciFact bağımsız bir bilimsel ve algoritmik tarama motorudur; adı geçen kurumlarla resmi veya ticari bağı yoktur.',
    methodologyItems: [
      ['1. GİMDES (Türkiye)', 'Madde 4.2 gereği böcek kaynaklı katkılar (E120 Karmin, Şellak, Salyangoz Müsini), etanol ve sertifikasız şüpheli emülgatörler kabul edilmez.'],
      ['2. JAKIM (Malezya)', 'Fetva Bülteni 100/2012 uyarınca Karmin (E120) caizdir; harici kozmetikte salyangoz müsini (Irsyad 188) temizlik ve işkencesiz üretim şartına bağlıdır.'],
      ['3. MUI / BPJPH (Endonezya)', 'Fatwa MUI 33/2011 uyarınca Karmin caizdir; Fatwa 24/2012 gereği salyangoz tüketimi haram olup kozmetik kullanımı arındırma denetimine tabidir.'],
      ['4. IFANCA (ABD / Global)', 'Doğrulanmış bitkisel/mikrobiyal kaynaklı çift kaynaklı bileşenleri sertifika kapsamında değerlendirir; domuz ve alkol türevlerini yasaklar.']
    ],
    privacyBtn: 'Gizlilik Politikası & Barkod API Bildirimi',
    privacyTitle: 'Gizlilik & Veri Güvenliği',
    privacyBarcodeNote: 'İsteğe Bağlı Canlı Barkod Sorgusu: Yalnızca siz EAN barkod sorgusu başlattığınızda girilen barkod numarası Open Food Facts / Open Beauty Facts ODbL uçlarına gönderilir; kişisel profiliniz, özel kara listeniz ve kimlik veriniz cihaz dışına çıkmaz.',
    closeBtn: 'Kapat',
    shareNativeBtn: 'Paylaş',
    barcodeCardTitle: 'Barkod İle Hızlı Tara',
    scanBarcodeCameraBtn: '📷 Kamerayla Barkod Okut',
    barcodeModalTitle: 'Barkodu Çerçeveye Hizala',
    barcodeModalHint: 'Ürünün arkasındaki EAN-13 / UPC barkodunu kare içine tutun.',
    barcodeFallbackOcrBtn: '📸 Barkod Yoksa: İçindekiler Etiketini Çek',
    barcodeInputPlaceholder: '8–14 haneli EAN / UPC numarası',
    barcodeLookupBtn: '🔍 Sorgula',
    barcodeNameFoundHint: (name) => `"${name}" bulundu, ancak açık veritabanında içindekiler listesi eksik. Lütfen aşağıdan "Etiket Fotoğrafı Çek" butonunu kullanın.`,
    ocrCardTitle: 'İçindekiler Etiketi Okuma (OCR)',
    ocrCameraBtn: '📸 Etiket Fotoğrafı Çek',
    ocrGalleryBtn: '🖼️ Galeriden Seç',
    ocrEmptyErr: 'Fotoğrafta okunabilir metin bulunamadı. Daha aydınlık ortamda İçindekiler yazısına yakından çekim yapın.',
    ocrPermissionErr: 'Kamera veya galeri izni verilmedi. Lütfen telefon ayarlarından InciFact için kamera iznini açın.',
    ocrNoNativeErr: 'Bu cihaz ortamında yerleşik OCR modülü bulunamadı; aşağıya metni yapıştırabilirsiniz.',
    manualCardTitle: 'Elle Yapıştır / Düzenle',
    manualPlaceholder: 'İçindekiler (Ingredients) listesini buraya yazın veya yapıştırın...',
    demoHeader: '🧪 Hızlı Test Örneği Yükle',
    demoNames: ['Nemlendirici', 'Helal E120 Jöle', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Örnek yüklendi: ${name}`,
    emptyResultTitle: 'Henüz Bir Ürün Taranmadı',
    emptyResultDesc: 'Analiz sonucunu görmek için barkod okutun, ürünün İçindekiler etiketini fotoğraflayın veya metin yapıştırın.',
    goScanBtn: '📷 Ürün Tara',
    editTextBtn: '✏️ Metni Gör / Düzenle',
    newScanReset: 'Yeni Tarama (Temizle)',
    activeAuthorityTitle: 'Seçili Helal Standardı',
    emptyHalalDesc: 'Ürün bileşenlerinin GİMDES, JAKIM, MUI ve IFANCA standartlarına göre fıkhi analizini görmek için önce ürün tarayın.',
    loadAuthorityDemoBtn: '🧪 Otorite Farkı Örneği Yükle (E120 & Salyangoz)',
    emptyCompareTitle: 'Karşılaştırma Boş',
    emptyCompareDesc: 'İki ürünü yan yana kıyaslamak için ürün taradıktan sonra Sonuç ekranından A ve B slotlarına atayın veya hazır örnek yükleyin.',
    emptySlotLabel: 'Henüz ürün atanmadı',
    loadCompareDemoBtn: '🧪 Örnek A / B Karşılaştırması Yükle',
    torchOn: '🔦 Flaş Açık',
    torchOff: '🔦 Flaş',
    cropModeToggle: '✂️ Yakınlaştır / Kırp',
    shieldSummaryPrefix: 'Yanlış Alarm Koruması (Etil Alkol Değildir)'
  },
  en: {
    jurisdictionLabel: 'Regulatory Jurisdiction',
    veganNone: 'Vegan: None',
    veganDeclared: 'Vegan: Declared',
    veganVerified: 'Vegan: Certified',
    attentionOnlyBtn: 'Attention / Warnings',
    allItemsBtn: 'All',
    noAttentionMsg: 'No banned, restricted, or attention-required regulatory findings detected.',
    saveBarcodeTitle: 'Save Custom Barcode on Device',
    saveBarcodePlaceholder: 'Product name (optional)',
    saveBarcodeBtn: 'Save Barcode Locally',
    saveBarcodeLowCov: 'Coverage is below 80% or OCR confirmations are pending; resolve ingredients to reach ≥80% before saving.',
    saveBarcodeOk: (code) => `Barcode (${code}) verified and saved to local device catalog.`,
    methodologyBtn: 'Methodology & Official Fatwa Sources',
    methodologyTitle: 'Jurisprudential Methodology & Sources',
    methodologyIntro: 'InciFact is an independent scientific and algorithmic screening engine with no official or commercial affiliation with the cited bodies.',
    methodologyItems: [
      ['1. GİMDES (Turkey)', 'Under Standard Art. 4.2, insect derivatives (E120 Carmine, Shellac, Snail Mucin), ethanol, and uncertified suspect emulsifiers are not accepted.'],
      ['2. JAKIM (Malaysia)', 'Under National Fatwa 100/2012, Carmine (E120) is permissible; topical snail mucin (Irsyad 188) requires non-harmful extraction and purity verification.'],
      ['3. MUI / BPJPH (Indonesia)', 'Under Fatwa 33/2011, Carmine is permissible; under Fatwa 24/2012, snail food intake is haram while topical cosmetic use requires purification audit.'],
      ['4. IFANCA (US / Global)', 'Evaluates dual-origin emulsifiers through verified plant/microbial origin or certification, strictly prohibiting porcine and intoxicant derivatives.']
    ],
    privacyBtn: 'Privacy Policy & Barcode API Disclosure',
    privacyTitle: 'Privacy & Data Security',
    privacyBarcodeNote: 'Optional Live Barcode Lookup: Only when you trigger an EAN lookup is the barcode number queried directly against Open Food Facts / Open Beauty Facts (ODbL). Your health profiles, watchlist, and history never leave your device.',
    closeBtn: 'Close',
    shareNativeBtn: 'Share',
    barcodeCardTitle: 'Quick Barcode Scan',
    scanBarcodeCameraBtn: '📷 Scan Barcode with Camera',
    barcodeModalTitle: 'Align Barcode in Frame',
    barcodeModalHint: 'Hold the EAN-13 / UPC barcode steady inside the frame.',
    barcodeFallbackOcrBtn: '📸 No Barcode Match? Shoot Ingredients Label',
    barcodeInputPlaceholder: '8–14 digit EAN / UPC number',
    barcodeLookupBtn: '🔍 Lookup',
    barcodeNameFoundHint: (name) => `"${name}" was found, but its ingredient list is missing in the open database. Please use "Shoot Label Photo" below.`,
    ocrCardTitle: 'Ingredient Label Reader (OCR)',
    ocrCameraBtn: '📸 Shoot Label Photo',
    ocrGalleryBtn: '🖼️ Choose from Gallery',
    ocrEmptyErr: 'No readable text found in the photo. Move closer to the Ingredients section in bright light and retry.',
    ocrPermissionErr: 'Camera or photo library permission denied. Please enable camera access for InciFact in device settings.',
    ocrNoNativeErr: 'On-device OCR module is not available in this runtime; you can paste the text below.',
    manualCardTitle: 'Paste or Edit Manually',
    manualPlaceholder: 'Paste or type the Ingredients list here...',
    demoHeader: '🧪 Load Quick Test Sample',
    demoNames: ['Moisturizer', 'Halal E120 Gummy', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Sample loaded: ${name}`,
    emptyResultTitle: 'No Product Scanned Yet',
    emptyResultDesc: 'Scan a barcode, photograph an ingredient label, or paste text on the Scan tab to see the analysis.',
    goScanBtn: '📷 Scan Product',
    editTextBtn: '✏️ View / Edit Text',
    newScanReset: 'New Scan (Reset)',
    activeAuthorityTitle: 'Selected Halal Standard',
    emptyHalalDesc: 'Scan a product first to inspect its Halal ruling across GİMDES, JAKIM, MUI, and IFANCA standards.',
    loadAuthorityDemoBtn: '🧪 Load Authority Difference Sample (E120 & Snail)',
    emptyCompareTitle: 'Comparison Empty',
    emptyCompareDesc: 'Scan products and assign them to Slot A / Slot B from Result, or load an example comparison below.',
    emptySlotLabel: 'No product assigned yet',
    loadCompareDemoBtn: '🧪 Load Sample A / B Comparison',
    torchOn: '🔦 Flash On',
    torchOff: '🔦 Flash',
    cropModeToggle: '✂️ Crop to Label',
    shieldSummaryPrefix: 'False-Positive Shield (Not Intoxicating Ethanol)'
  },
  ar: {
    jurisdictionLabel: 'النطاق التنظيمي',
    veganNone: 'نباتي: لا يوجد',
    veganDeclared: 'نباتي: معلن',
    veganVerified: 'نباتي: معتمد',
    attentionOnlyBtn: 'تنبيهات / تحذيرات',
    allItemsBtn: 'الكل',
    noAttentionMsg: 'لم يتم رصد مواد محظورة أو مقيدة تتطلب انتباهاً.',
    saveBarcodeTitle: 'حفظ باركود مخصص على الجهاز',
    saveBarcodePlaceholder: 'اسم المنتج (اختياري)',
    saveBarcodeBtn: 'حفظ الباركود محلياً',
    saveBarcodeLowCov: 'التغطية أقل من 80% أو توجد تأكيدات OCR معلقة؛ أكمل التحقق قبل الحفظ.',
    saveBarcodeOk: (code) => `تم التحقق من الباركود (${code}) وحفظه محلياً على الجهاز.`,
    methodologyBtn: 'المنهجية الفقهية ومصادر الفتاوى الرسمية',
    methodologyTitle: 'المنهجية الفقهية ومصادر الأحكام',
    methodologyIntro: 'محرك فحص علمي وخوارزمي مستقل تماماً دون أي ارتباط رسمي أو تجاري بالهيئات المذكورة.',
    methodologyItems: [
      ['١. GİMDES (تركيا)', 'وفق المادة ٤.٢ لا تُقبل المضافات الحشرية (كارمين E120، شيلاك، إفراز الحلزون) ولا الإيثانول أو المستحلبات غير المعتمدة.'],
      ['٢. JAKIM (ماليزيا)', 'وفق قرار ١٠٠/٢٠١٢ يُباح الكارمين (E120)؛ وفي التجميل الخارجي يخضع مستخلص الحلزون لشروط الطهارة وعدم الإيذاء.'],
      ['٣. MUI / BPJPH (إندونيسيا)', 'وفق فتوى ٣٣/٢٠١١ يُباح الكارمين، ووفق فتوى ٢٤/٢٠١٢ يحرم أكل الحلزون ويخضع التجميل الخارجي للتنقية.'],
      ['٤. IFANCA (عالمي)', 'تعتمد المكونات مزدوجة المصدر عند ثبوت أصلها النباتي أو بشهادة موثقة، مع تحريم مشتقات الخنزير والمسكرات.']
    ],
    privacyBtn: 'سياسة الخصوصية وإفصاح واجهة الباركود',
    privacyTitle: 'الخصوصية وأمان البيانات',
    privacyBarcodeNote: 'استعلام الباركود المباشر الاختياري: عند البحث برمز EAN يُرسل رقم الباركود فقط إلى Open Food Facts / Open Beauty Facts، وتبقى ملفاتك الصحية وقائمتك على جهازك فقط.',
    closeBtn: 'إغلاق',
    shareNativeBtn: 'مشاركة',
    barcodeCardTitle: 'مسح الباركود السريع',
    scanBarcodeCameraBtn: '📷 مسح الباركود بالكاميرا',
    barcodeModalTitle: 'وجّه الكاميرا نحو الباركود',
    barcodeModalHint: 'ثبّت رمز EAN-13 / UPC داخل الإطار.',
    barcodeFallbackOcrBtn: '📸 لم يتوفر باركود؟ صوّر قائمة المكونات',
    barcodeInputPlaceholder: 'رقم EAN / UPC من 8 إلى 14 رقماً',
    barcodeLookupBtn: '🔍 بحث',
    barcodeNameFoundHint: (name) => `تم العثور على "${name}" لكن قائمة المكونات غير مكتملة في القاعدة المفتوحة. يرجى استخدام "تصوير قائمة المكونات" أدناه.`,
    ocrCardTitle: 'قراءة ملصق المكونات (OCR)',
    ocrCameraBtn: '📸 تصوير المكونات بالكاميرا',
    ocrGalleryBtn: '🖼️ اختيار من المعرض',
    ocrEmptyErr: 'لم يتم العثور على نص مقروء في الصورة. قرّب الكاميرا من قائمة المكونات في إضاءة جيدة وأعد المحاولة.',
    ocrPermissionErr: 'تم رفض إذن الكاميرا أو الصور. يرجى تفعيل الإذن من إعدادات الهاتف.',
    ocrNoNativeErr: 'وحدة OCR غير متوفرة في هذه البيئة؛ يمكنك لصق المكونات أدناه.',
    manualCardTitle: 'لصق أو تعديل يدوياً',
    manualPlaceholder: 'اكتب أو الصق قائمة المكونات هنا...',
    demoHeader: '🧪 تحميل عينة اختبار سريعة',
    demoNames: ['كريم مرطب', 'حلوى جيلي E120', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ تم تحميل العينة: ${name}`,
    emptyResultTitle: 'لم يتم فحص أي منتج بعد',
    emptyResultDesc: 'امسح الباركود أو صوّر قائمة المكونات أو الصق النص في تبويب المسح لعرض التحليل.',
    goScanBtn: '📷 فحص منتج',
    editTextBtn: '✏️ عرض / تعديل النص',
    newScanReset: 'فحص جديد (مسح)',
    activeAuthorityTitle: 'معيار الحلال المختار',
    emptyHalalDesc: 'افحص منتجاً أولاً لمقارنة الأحكام بين GİMDES وJAKIM وMUI وIFANCA.',
    loadAuthorityDemoBtn: '🧪 تحميل عينة اختلاف الهيئات (E120 والحلزون)',
    emptyCompareTitle: 'المقارنة فارغة',
    emptyCompareDesc: 'افحص منتجين وعيّنهما إلى أ / ب من شاشة النتيجة، أو حمّل مثال مقارنة أدناه.',
    emptySlotLabel: 'لم يُعيّن منتج بعد',
    loadCompareDemoBtn: '🧪 تحميل مثال مقارنة أ / ب',
    torchOn: '🔦 الفلاش مفتوح',
    torchOff: '🔦 الفلاش',
    cropModeToggle: '✂️ قص منطقة المكونات',
    shieldSummaryPrefix: 'حماية من الإنذار الكاذب (ليس إيثانول مسكر)'
  },
  de: {
    jurisdictionLabel: 'Rechtsraum',
    veganNone: 'Vegan: Keine',
    veganDeclared: 'Vegan: Deklariert',
    veganVerified: 'Vegan: Zertifiziert',
    attentionOnlyBtn: 'Warnungen / Hinweise',
    allItemsBtn: 'Alle',
    noAttentionMsg: 'Keine verbotenen oder eingeschränkten Stoffe erkannt.',
    saveBarcodeTitle: 'Eigenen Barcode lokal speichern',
    saveBarcodePlaceholder: 'Produktname (optional)',
    saveBarcodeBtn: 'Barcode lokal speichern',
    saveBarcodeLowCov: 'Abdeckung unter 80 % oder OCR-Bestätigung offen; vor dem Speichern klären.',
    saveBarcodeOk: (code) => `Barcode (${code}) geprüft und lokal gespeichert.`,
    methodologyBtn: 'Methodik & Offizielle Fatwa-Quellen',
    methodologyTitle: 'Fiqh-Methodik & Quellennachweis',
    methodologyIntro: 'Unabhängige wissenschaftlich-algorithmische Prüf-Engine ohne offizielle oder kommerzielle Verbindung zu den genannten Stellen.',
    methodologyItems: [
      ['1. GİMDES (Türkei)', 'Gemäß Art. 4.2 werden insektenbasierte Stoffe (E120, Schellack, Schneckenschleim), Ethanol und unzertifizierte Emulgatoren abgelehnt.'],
      ['2. JAKIM (Malaysia)', 'Laut Fatwa 100/2012 ist Karmin (E120) zulässig; topischer Schneckenschleim (Irsyad 188) erfordert Reinheitsprüfung.'],
      ['3. MUI / BPJPH (Indonesien)', 'Gemäß Fatwa 33/2011 ist Karmin zulässig; gemäß Fatwa 24/2012 ist Schneckenverzehr haram, topische Kosmetik unterliegt Reinheitskontrolle.'],
      ['4. IFANCA (USA / Global)', 'Bewertet doppelt-ursprüngliche Stoffe über pflanzliche Herkunft oder Zertifikat; Schweine- und Alkoholderivate sind haram.']
    ],
    privacyBtn: 'Datenschutz & Barcode-API-Hinweis',
    privacyTitle: 'Datenschutz & Datensicherheit',
    privacyBarcodeNote: 'Optionale Live-Barcode-Abfrage: Nur bei aktiver EAN-Suche wird die Barcodenummer an Open Food/Beauty Facts (ODbL) gesendet; Gesundheitsprofile bleiben lokal.',
    closeBtn: 'Schließen',
    shareNativeBtn: 'Teilen',
    barcodeCardTitle: 'Schnell-Barcode-Scan',
    scanBarcodeCameraBtn: '📷 Barcode mit Kamera scannen',
    barcodeModalTitle: 'Barcode ausrichten',
    barcodeModalHint: 'Halten Sie den EAN-13 / UPC-Code ruhig in den Rahmen.',
    barcodeFallbackOcrBtn: '📸 Kein Treffer? Zutatenetikett fotografieren',
    barcodeInputPlaceholder: '8–14-stellige EAN / UPC-Nummer',
    barcodeLookupBtn: '🔍 Suchen',
    barcodeNameFoundHint: (name) => `"${name}" gefunden, aber Zutatenliste fehlt in der offenen Datenbank. Bitte nutzen Sie unten "Etikett fotografieren".`,
    ocrCardTitle: 'Etiketten-Texterkennung (OCR)',
    ocrCameraBtn: '📸 Etikett fotografieren',
    ocrGalleryBtn: '🖼️ Aus Galerie wählen',
    ocrEmptyErr: 'Kein lesbarer Text erkannt. Bei gutem Licht näher an die Zutatenliste herangehen.',
    ocrPermissionErr: 'Kamera- oder Galerieberechtigung verweigert. Bitte in den Geräteeinstellungen aktivieren.',
    ocrNoNativeErr: 'Natives OCR-Modul in dieser Laufzeit nicht verfügbar; Text unten einfügen.',
    manualCardTitle: 'Manuell einfügen / bearbeiten',
    manualPlaceholder: 'Zutaten / Ingredients hier eingeben oder einfügen...',
    demoHeader: '🧪 Schnelltest-Beispiel laden',
    demoNames: ['Feuchtigkeitscreme', 'Halal E120 Gelee', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Beispiel geladen: ${name}`,
    emptyResultTitle: 'Noch kein Produkt gescannt',
    emptyResultDesc: 'Scannen Sie einen Barcode, fotografieren Sie das Etikett oder fügen Sie Text unter "Scannen" ein.',
    goScanBtn: '📷 Produkt scannen',
    editTextBtn: '✏️ Text ansehen / bearbeiten',
    newScanReset: 'Neuer Scan (Zurücksetzen)',
    activeAuthorityTitle: 'Gewählter Halal-Standard',
    emptyHalalDesc: 'Scannen Sie zuerst ein Produkt, um die Bewertung nach GİMDES, JAKIM, MUI und IFANCA zu sehen.',
    loadAuthorityDemoBtn: '🧪 Autoritäts-Unterschied testen (E120 & Schnecke)',
    emptyCompareTitle: 'Vergleich leer',
    emptyCompareDesc: 'Weisen Sie gescannte Produkte unter Ergebnis zu A / B zu oder laden Sie unten einen Beispielvergleich.',
    emptySlotLabel: 'Noch kein Produkt zugewiesen',
    loadCompareDemoBtn: '🧪 Beispielvergleich A / B laden',
    torchOn: '🔦 Licht An',
    torchOff: '🔦 Licht',
    cropModeToggle: '✂️ Etikett zuschneiden',
    shieldSummaryPrefix: 'Fehlalarm-Schutz (Kein Ethylalkohol)'
  },
  fr: {
    jurisdictionLabel: 'Juridiction',
    veganNone: 'Vegan : Aucun',
    veganDeclared: 'Vegan : Déclaré',
    veganVerified: 'Vegan : Certifié',
    attentionOnlyBtn: 'Alertes / Attention',
    allItemsBtn: 'Tout',
    noAttentionMsg: 'Aucune substance interdite ou restreinte nécessitant attention.',
    saveBarcodeTitle: 'Enregistrer un code-barres localement',
    saveBarcodePlaceholder: 'Nom du produit (optionnel)',
    saveBarcodeBtn: 'Enregistrer sur l’appareil',
    saveBarcodeLowCov: 'Couverture <80 % ou confirmation OCR en attente ; complétez l’étiquette avant d’enregistrer.',
    saveBarcodeOk: (code) => `Code-barres (${code}) vérifié et enregistré localement.`,
    methodologyBtn: 'Méthodologie & Sources Officielles',
    methodologyTitle: 'Méthodologie & Sources des Fatwas',
    methodologyIntro: 'Moteur d’analyse scientifique et algorithmique indépendant sans affiliation officielle ou commerciale.',
    methodologyItems: [
      ['1. GİMDES (Turquie)', 'Art. 4.2 : refus des additifs issus d’insectes (E120 Carmin, Shellac, Mucine d’escargot), éthanol et émulsifiants non certifiés.'],
      ['2. JAKIM (Malaisie)', 'Fatwa 100/2012 : Carmin (E120) licite ; mucine d’escargot topique soumise à vérification de pureté (Irsyad 188).'],
      ['3. MUI / BPJPH (Indonésie)', 'Fatwa 33/2011 : Carmin licite ; Fatwa 24/2012 : consommation d’escargot haram, usage cosmétique contrôlé.'],
      ['4. IFANCA (USA / Global)', 'Valide les substances à double origine sur preuve végétale ou certification ; interdit porc et alcool.']
    ],
    privacyBtn: 'Confidentialité & Info API Code-barres',
    privacyTitle: 'Confidentialité & Sécurité',
    privacyBarcodeNote: 'Recherche de code-barres en direct optionnelle : seul le numéro EAN est envoyé à Open Food/Beauty Facts (ODbL) lors de votre recherche ; vos préférences restent locales.',
    closeBtn: 'Fermer',
    shareNativeBtn: 'Partager',
    barcodeCardTitle: 'Scan Code-Barres Rapide',
    scanBarcodeCameraBtn: '📷 Scanner le code-barres',
    barcodeModalTitle: 'Aligner le code-barres',
    barcodeModalHint: 'Maintenez le code EAN-13 / UPC dans le cadre.',
    barcodeFallbackOcrBtn: '📸 Sans code-barres ? Photographier la liste INCI',
    barcodeInputPlaceholder: 'Code EAN / UPC à 8–14 chiffres',
    barcodeLookupBtn: '🔍 Rechercher',
    barcodeNameFoundHint: (name) => `"${name}" trouvé, mais la liste d’ingrédients manque dans la base ouverte. Utilisez "Prendre l’étiquette en photo" ci-dessous.`,
    ocrCardTitle: 'Lecture d’étiquette (OCR)',
    ocrCameraBtn: '📸 Photo de l’étiquette',
    ocrGalleryBtn: '🖼️ Depuis la galerie',
    ocrEmptyErr: 'Aucun texte lisible détecté. Rapprochez-vous de la liste des ingrédients avec un bon éclairage.',
    ocrPermissionErr: 'Permission caméra ou galerie refusée. Activez l’accès dans les réglages du téléphone.',
    ocrNoNativeErr: 'Module OCR natif absent dans cet environnement ; collez le texte ci-dessous.',
    manualCardTitle: 'Coller ou modifier manuellement',
    manualPlaceholder: 'Collez ou saisissez la liste des ingrédients ici...',
    demoHeader: '🧪 Charger un exemple rapide',
    demoNames: ['Crème hydratante', 'Bonbon E120 Halal', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Exemple chargé : ${name}`,
    emptyResultTitle: 'Aucun produit scanné',
    emptyResultDesc: 'Scannez un code-barres, photographiez l’étiquette ou collez le texte dans Scanner pour voir le résultat.',
    goScanBtn: '📷 Scanner un produit',
    editTextBtn: '✏️ Voir / Modifier le texte',
    newScanReset: 'Nouveau scan (Réinitialiser)',
    activeAuthorityTitle: 'Référentiel Halal actif',
    emptyHalalDesc: 'Scannez d’abord un produit pour consulter son verdict selon GİMDES, JAKIM, MUI et IFANCA.',
    loadAuthorityDemoBtn: '🧪 Charger un exemple multi-autorités (E120 & Escargot)',
    emptyCompareTitle: 'Comparaison vide',
    emptyCompareDesc: 'Assignez des produits scannés à A / B depuis Résultat, ou chargez un exemple ci-dessous.',
    emptySlotLabel: 'Aucun produit assigné',
    loadCompareDemoBtn: '🧪 Charger une comparaison exemple A / B',
    torchOn: '🔦 Flash Activé',
    torchOff: '🔦 Flash',
    cropModeToggle: '✂️ Recadrer l’étiquette',
    shieldSummaryPrefix: 'Bouclier anti-faux positif (Pas d’éthanol)'
  },
  id: {
    jurisdictionLabel: 'Yurisdiksi Regulasi',
    veganNone: 'Vegan: Tidak Ada',
    veganDeclared: 'Vegan: Klaim Label',
    veganVerified: 'Vegan: Bersertifikat',
    attentionOnlyBtn: 'Perhatian / Peringatan',
    allItemsBtn: 'Semua',
    noAttentionMsg: 'Tidak ditemukan bahan terlarang atau terbatas yang memerlukan perhatian.',
    saveBarcodeTitle: 'Simpan Barcode Khusus di Perangkat',
    saveBarcodePlaceholder: 'Nama produk (opsional)',
    saveBarcodeBtn: 'Simpan Barcode Lokal',
    saveBarcodeLowCov: 'Cakupan di bawah 80% atau konfirmasi OCR tertunda; lengkapi label sebelum menyimpan.',
    saveBarcodeOk: (code) => `Barcode (${code}) diverifikasi dan disimpan secara lokal.`,
    methodologyBtn: 'Metodologi & Sumber Fatwa Resmi',
    methodologyTitle: 'Metodologi Fikih & Rujukan Resmi',
    methodologyIntro: 'Mesin pemindai ilmiah dan algoritmik independen tanpa afiliasi resmi atau komersial.',
    methodologyItems: [
      ['1. GİMDES (Turki)', 'Pasal 4.2 menolak bahan turunan serangga (E120 Karmin, Syelak, Lendir Siput), etanol, dan pengemulsi syubhat tanpa sertifikat.'],
      ['2. JAKIM (Malaysia)', 'Fatwa 100/2012 membolehkan Karmin (E120); lendir siput kosmetik luar (Irsyad 188) wajib memenuhi syarat kesucian.'],
      ['3. MUI / BPJPH (Indonesia)', 'Fatwa MUI 33/2011 membolehkan Karmin; Fatwa 24/2012 mengharamkan konsumsi siput dan mengatur verifikasi kosmetik luar.'],
      ['4. IFANCA (AS / Global)', 'Menilai bahan sumber ganda melalui sumber nabati terverifikasi/sertifikat, serta menolak turunan babi dan khamr.']
    ],
    privacyBtn: 'Kebijakan Privasi & Info API Barcode',
    privacyTitle: 'Privasi & Keamanan Data',
    privacyBarcodeNote: 'Pencarian Barcode Langsung Opsional: Hanya saat Anda mencari EAN, nomor barcode dikirim ke Open Food/Beauty Facts (ODbL); profil Anda tetap di perangkat.',
    closeBtn: 'Tutup',
    shareNativeBtn: 'Bagikan',
    barcodeCardTitle: 'Pindai Barcode Cepat',
    scanBarcodeCameraBtn: '📷 Pindai Barcode via Kamera',
    barcodeModalTitle: 'Arahkan ke Barcode',
    barcodeModalHint: 'Posisikan kode EAN-13 / UPC di dalam bingkai.',
    barcodeFallbackOcrBtn: '📸 Tidak ketemu? Foto Label Komposisi',
    barcodeInputPlaceholder: 'Nomor EAN / UPC 8–14 digit',
    barcodeLookupBtn: '🔍 Cari',
    barcodeNameFoundHint: (name) => `"${name}" ditemukan, namun daftar bahan belum tersedia di basis data terbuka. Gunakan "Foto Label" di bawah.`,
    ocrCardTitle: 'Pembaca Label Komposisi (OCR)',
    ocrCameraBtn: '📸 Foto Label Komposisi',
    ocrGalleryBtn: '🖼️ Pilih dari Galeri',
    ocrEmptyErr: 'Teks tidak terbaca pada foto. Dekatkan kamera ke bagian Komposisi di tempat terang lalu coba lagi.',
    ocrPermissionErr: 'Izin kamera atau galeri ditolak. Aktifkan izin kamera untuk InciFact di pengaturan HP.',
    ocrNoNativeErr: 'Modul OCR perangkat tidak tersedia; silakan tempel daftar bahan di bawah.',
    manualCardTitle: 'Tempel atau Edit Manual',
    manualPlaceholder: 'Ketik atau tempel daftar komposisi (Ingredients) di sini...',
    demoHeader: '🧪 Muat Contoh Uji Cepat',
    demoNames: ['Pelembap', 'Jeli E120 Halal', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Contoh dimuat: ${name}`,
    emptyResultTitle: 'Belum Ada Produk Dipindai',
    emptyResultDesc: 'Pindai barcode, foto label komposisi, atau tempel teks pada tab Pindai untuk melihat hasil analisis.',
    goScanBtn: '📷 Pindai Produk',
    editTextBtn: '✏️ Lihat / Edit Teks',
    newScanReset: 'Pindai Baru (Reset)',
    activeAuthorityTitle: 'Standar Halal Terpilih',
    emptyHalalDesc: 'Pindai produk terlebih dahulu untuk melihat penilaian menurut GİMDES, JAKIM, MUI, dan IFANCA.',
    loadAuthorityDemoBtn: '🧪 Muat Contoh Beda Fatwa (E120 & Siput)',
    emptyCompareTitle: 'Perbandingan Kosong',
    emptyCompareDesc: 'Pindai produk lalu tetapkan ke Slot A / B dari layar Hasil, atau muat contoh perbandingan di bawah.',
    emptySlotLabel: 'Belum ada produk',
    loadCompareDemoBtn: '🧪 Muat Contoh Perbandingan A / B',
    torchOn: '🔦 Lampu Nyala',
    torchOff: '🔦 Lampu',
    cropModeToggle: '✂️ Potong Area Label',
    shieldSummaryPrefix: 'Pelindung Salah Deteksi (Bukan Etanol)'
  },
  ms: {
    jurisdictionLabel: 'Bidang Kuasa Regulasi',
    veganNone: 'Vegan: Tiada',
    veganDeclared: 'Vegan: Diisytihar',
    veganVerified: 'Vegan: Disahkan',
    attentionOnlyBtn: 'Perhatian / Amaran',
    allItemsBtn: 'Semua',
    noAttentionMsg: 'Tiada bahan terlarang atau terhad yang memerlukan perhatian dikesan.',
    saveBarcodeTitle: 'Simpan Kod Bar Khas pada Peranti',
    saveBarcodePlaceholder: 'Nama produk (pilihan)',
    saveBarcodeBtn: 'Simpan Kod Bar Setempat',
    saveBarcodeLowCov: 'Liputan di bawah 80% atau pengesahan OCR belum selesai; lengkapkan label dahulu.',
    saveBarcodeOk: (code) => `Kod bar (${code}) disahkan dan disimpan dalam peranti.`,
    methodologyBtn: 'Metodologi & Sumber Fatwa Rasmi',
    methodologyTitle: 'Metodologi Fiqh & Rujukan Rasmi',
    methodologyIntro: 'Enjin saringan saintifik dan algoritma bebas tanpa kaitan rasmi atau komersial dengan institusi yang dinyatakan.',
    methodologyItems: [
      ['1. GİMDES (Turki)', 'Perkara 4.2 menolak bahan serangga (E120 Karmin, Syelak, Mucin Siput), etanol dan pengemulsi syubhah tanpa sijil.'],
      ['2. JAKIM (Malaysia)', 'Fatwa Bil. 100/2012 mengharuskan Karmin (E120); mucin siput kosmetik luar (Irsyad 188) tertakluk pada syarat kesucian.'],
      ['3. MUI / BPJPH (Indonesia)', 'Fatwa MUI 33/2011 mengharuskan Karmin; Fatwa 24/2012 mengharamkan pemakanan siput dan menyemak penggunaan kosmetik luar.'],
      ['4. IFANCA (AS / Global)', 'Menilai bahan dwi-sumber melalui sumber tumbuhan sah atau sijil Halal, menolak khinzir dan arak.']
    ],
    privacyBtn: 'Dasar Privasi & Makluman API Kod Bar',
    privacyTitle: 'Privasi & Keselamatan Data',
    privacyBarcodeNote: 'Carian Kod Bar Langsung Pilihan: Hanya nombor kod bar dihantar ke Open Food/Beauty Facts (ODbL) apabila anda membuat carian; profil anda kekal pada peranti.',
    closeBtn: 'Tutup',
    shareNativeBtn: 'Kongsi',
    barcodeCardTitle: 'Imbas Kod Bar Pantas',
    scanBarcodeCameraBtn: '📷 Imbas Kod Bar dengan Kamera',
    barcodeModalTitle: 'Selaraskan Kod Bar dalam Bingkai',
    barcodeModalHint: 'Pegang kod EAN-13 / UPC dengan stabil di dalam bingkai.',
    barcodeFallbackOcrBtn: '📸 Tiada rekod? Tangkap Gambar Label Ramuan',
    barcodeInputPlaceholder: 'Nombor EAN / UPC 8–14 digit',
    barcodeLookupBtn: '🔍 Semak',
    barcodeNameFoundHint: (name) => `"${name}" ditemui, tetapi senarai ramuan tiada dalam pangkalan data terbuka. Sila guna "Tangkap Gambar Label" di bawah.`,
    ocrCardTitle: 'Pembaca Label Ramuan (OCR)',
    ocrCameraBtn: '📸 Tangkap Gambar Label',
    ocrGalleryBtn: '🖼️ Pilih daripada Galeri',
    ocrEmptyErr: 'Tiada teks jelas dikesan. Dekatkan kamera pada senarai ramuan dalam cahaya terang dan cuba semula.',
    ocrPermissionErr: 'Kebenaran kamera atau galeri ditolak. Sila benarkan akses kamera untuk InciFact dalam tetapan telefon.',
    ocrNoNativeErr: 'Modul OCR asli tiada pada peranti ini; sila tampal senarai ramuan di bawah.',
    manualCardTitle: 'Tampal atau Edit Secara Manual',
    manualPlaceholder: 'Taip atau tampal senarai ramuan (Ingredients) di sini...',
    demoHeader: '🧪 Muat Contoh Ujian Pantas',
    demoNames: ['Pelembap', 'Jeli E120 Halal', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Contoh dimuatkan: ${name}`,
    emptyResultTitle: 'Belum Ada Produk Diimbas',
    emptyResultDesc: 'Imbas kod bar, ambil gambar label ramuan, atau tampal teks pada tab Imbas untuk melihat keputusan.',
    goScanBtn: '📷 Imbas Produk',
    editTextBtn: '✏️ Lihat / Edit Teks',
    newScanReset: 'Imbasan Baharu (Set Semula)',
    activeAuthorityTitle: 'Piawaian Halal Dipilih',
    emptyHalalDesc: 'Imbas produk dahulu untuk menyemak hukum mengikut GİMDES, JAKIM, MUI dan IFANCA.',
    loadAuthorityDemoBtn: '🧪 Muat Contoh Perbezaan Badan (E120 & Siput)',
    emptyCompareTitle: 'Perbandingan Kosong',
    emptyCompareDesc: 'Tetapkan produk yang diimbas ke Slot A / B daripada skrin Keputusan, atau muat contoh di bawah.',
    emptySlotLabel: 'Tiada produk ditetapkan',
    loadCompareDemoBtn: '🧪 Muat Contoh Perbandingan A / B',
    torchOn: '🔦 Lampu Hidup',
    torchOff: '🔦 Lampu',
    cropModeToggle: '✂️ Pangkas Label',
    shieldSummaryPrefix: 'Perisai Amaran Palsu (Bukan Etanol)'
  },
  es: {
    jurisdictionLabel: 'Jurisdicción Regulatoria',
    veganNone: 'Vegano: Ninguno',
    veganDeclared: 'Vegano: Declarado',
    veganVerified: 'Vegano: Certificado',
    attentionOnlyBtn: 'Atención / Alertas',
    allItemsBtn: 'Todos',
    noAttentionMsg: 'No se detectaron sustancias prohibidas o restringidas que requieran atención.',
    saveBarcodeTitle: 'Guardar código de barras en el dispositivo',
    saveBarcodePlaceholder: 'Nombre del producto (opcional)',
    saveBarcodeBtn: 'Guardar localmente',
    saveBarcodeLowCov: 'Cobertura inferior al 80% o confirmaciones OCR pendientes; resuelve primero antes de guardar.',
    saveBarcodeOk: (code) => `Código de barras (${code}) verificado y guardado localmente.`,
    methodologyBtn: 'Metodología & Fuentes de Fatwas',
    methodologyTitle: 'Metodología & Divulgación de Fuentes',
    methodologyIntro: 'Motor de análisis científico y algorítmico independiente sin vínculo oficial ni comercial con las entidades citadas.',
    methodologyItems: [
      ['1. GİMDES (Turquía)', 'Art. 4.2: rechaza derivados de insectos (Carmín E120, Goma laca, Baba de caracol), etanol y emulsionantes sin certificar.'],
      ['2. JAKIM (Malasia)', 'Fatwa 100/2012: permite Carmín (E120); baba de caracol tópica (Irsyad 188) sujeta a verificación de pureza.'],
      ['3. MUI / BPJPH (Indonesia)', 'Fatwa 33/2011: permite Carmín; Fatwa 24/2012: prohíbe consumo de caracol y audita su uso cosmético externo.'],
      ['4. IFANCA (EE. UU. / Global)', 'Evalúa ingredientes de doble origen mediante origen vegetal verificado o certificación, prohibiendo porcino y alcohol.']
    ],
    privacyBtn: 'Privacidad y Aviso de API de Códigos',
    privacyTitle: 'Privacidad y Seguridad',
    privacyBarcodeNote: 'Consulta opcional en vivo: solo al buscar un EAN se envía el número de código a Open Food/Beauty Facts (ODbL); tu perfil permanece en el dispositivo.',
    closeBtn: 'Cerrar',
    shareNativeBtn: 'Compartir',
    barcodeCardTitle: 'Escaneo Rápido de Código de Barras',
    scanBarcodeCameraBtn: '📷 Escanear código con cámara',
    barcodeModalTitle: 'Alinea el código en el marco',
    barcodeModalHint: 'Mantén el código EAN-13 / UPC dentro del recuadro.',
    barcodeFallbackOcrBtn: '📸 ¿Sin código? Fotografiar etiqueta de ingredientes',
    barcodeInputPlaceholder: 'Código EAN / UPC de 8–14 dígitos',
    barcodeLookupBtn: '🔍 Buscar',
    barcodeNameFoundHint: (name) => `Se encontró "${name}", pero falta la lista de ingredientes en la base abierta. Usa "Fotografiar etiqueta" abajo.`,
    ocrCardTitle: 'Lector de Etiqueta (OCR)',
    ocrCameraBtn: '📸 Fotografiar etiqueta',
    ocrGalleryBtn: '🖼️ Elegir de galería',
    ocrEmptyErr: 'No se detectó texto legible. Acércate a los ingredientes con buena luz e inténtalo de nuevo.',
    ocrPermissionErr: 'Permiso de cámara o galería denegado. Actívalo para InciFact en los ajustes del teléfono.',
    ocrNoNativeErr: 'El módulo OCR nativo no está disponible aquí; pega el texto abajo.',
    manualCardTitle: 'Pegar o editar manualmente',
    manualPlaceholder: 'Escribe o pega aquí la lista de ingredientes...',
    demoHeader: '🧪 Cargar ejemplo rápido',
    demoNames: ['Crema hidratante', 'Gominola E120 Halal', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Ejemplo cargado: ${name}`,
    emptyResultTitle: 'Aún no se escaneó ningún producto',
    emptyResultDesc: 'Escanea un código de barras, fotografía la etiqueta o pega el texto en Escanear para ver el análisis.',
    goScanBtn: '📷 Escanear producto',
    editTextBtn: '✏️ Ver / Editar texto',
    newScanReset: 'Nuevo escaneo (Limpiar)',
    activeAuthorityTitle: 'Estándar Halal seleccionado',
    emptyHalalDesc: 'Escanea primero un producto para revisar el veredicto de GİMDES, JAKIM, MUI e IFANCA.',
    loadAuthorityDemoBtn: '🧪 Cargar ejemplo con diferencia (E120 y Caracol)',
    emptyCompareTitle: 'Comparación vacía',
    emptyCompareDesc: 'Asigna productos escaneados a A / B desde Resultado o carga un ejemplo comparativo abajo.',
    emptySlotLabel: 'Sin producto asignado',
    loadCompareDemoBtn: '🧪 Cargar comparación ejemplo A / B',
    torchOn: '🔦 Linterna On',
    torchOff: '🔦 Linterna',
    cropModeToggle: '✂️ Recortar etiqueta',
    shieldSummaryPrefix: 'Escudo anti-falsos positivos (No es etanol)'
  },
  ru: {
    jurisdictionLabel: 'Регуляторная зона',
    veganNone: 'Веган: Нет',
    veganDeclared: 'Веган: Заявлено',
    veganVerified: 'Веган: Сертификат',
    attentionOnlyBtn: 'Внимание / Риски',
    allItemsBtn: 'Все',
    noAttentionMsg: 'Запрещенных или ограниченных ингредиентов, требующих внимания, не найдено.',
    saveBarcodeTitle: 'Сохранить штрихкод на устройстве',
    saveBarcodePlaceholder: 'Название продукта (необязательно)',
    saveBarcodeBtn: 'Сохранить штрихкод',
    saveBarcodeLowCov: 'Охват ниже 80% или ожидается подтверждение OCR; уточните состав перед сохранением.',
    saveBarcodeOk: (code) => `Штрихкод (${code}) проверен и сохранен локально.`,
    methodologyBtn: 'Методология и официальные источники фетв',
    methodologyTitle: 'Методология и источники стандартов',
    methodologyIntro: 'Независимый научный и алгоритмический сервис без официальной или коммерческой связи с указанными организациями.',
    methodologyItems: [
      ['1. GİMDES (Турция)', 'По ст. 4.2 добавки из насекомых (Кармин E120, Шеллак, Муцин улитки), этанол и несертифицированные эмульгаторы не допускаются.'],
      ['2. JAKIM (Малайзия)', 'По фетве № 100/2012 Кармин (E120) допустим; наружный муцин улитки требует проверки чистоты и гуманности.'],
      ['3. MUI / BPJPH (Индонезия)', 'По фетве № 33/2011 Кармин допустим; по фетве № 24/2012 употребление улиток запрещено, косметика проверяется отдельно.'],
      ['4. IFANCA (США / Мир)', 'Оценивает компоненты двойного происхождения по растительному источнику или сертификату; свинина и алкоголь запрещены.']
    ],
    privacyBtn: 'Конфиденциальность и API штрихкодов',
    privacyTitle: 'Конфиденциальность и защита данных',
    privacyBarcodeNote: 'Необязательный поиск штрихкода: при запросе EAN в Open Food/Beauty Facts (ODbL) передается только номер штрихкода; ваши профили остаются на устройстве.',
    closeBtn: 'Закрыть',
    shareNativeBtn: 'Поделиться',
    barcodeCardTitle: 'Быстрое сканирование штрихкода',
    scanBarcodeCameraBtn: '📷 Сканировать штрихкод камерой',
    barcodeModalTitle: 'Наведите камеру на штрихкод',
    barcodeModalHint: 'Держите код EAN-13 / UPC ровно внутри рамки.',
    barcodeFallbackOcrBtn: '📸 Нет кода? Сфотографировать состав',
    barcodeInputPlaceholder: '8–14 цифр EAN / UPC',
    barcodeLookupBtn: '🔍 Найти',
    barcodeNameFoundHint: (name) => `Продукт "${name}" найден, но состав в открытой базе отсутствует. Сфотографируйте этикетку кнопкой ниже.`,
    ocrCardTitle: 'Чтение состава с фото (OCR)',
    ocrCameraBtn: '📸 Фото состава (Камера)',
    ocrGalleryBtn: '🖼️ Выбрать из галереи',
    ocrEmptyErr: 'Текст на фото не распознан. Поднесите камеру ближе к составу при хорошем освещении.',
    ocrPermissionErr: 'Доступ к камере или галерее отклонён. Разрешите доступ для InciFact в настройках телефона.',
    ocrNoNativeErr: 'Встроенный модуль OCR недоступен; вставьте состав вручную ниже.',
    manualCardTitle: 'Вставить или изменить вручную',
    manualPlaceholder: 'Введите или вставьте список ингредиентов (Ingredients)...',
    demoHeader: '🧪 Загрузить быстрый пример',
    demoNames: ['Крем-уход', 'Мармелад E120 Халяль', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ Пример загружен: ${name}`,
    emptyResultTitle: 'Продукт ещё не отсканирован',
    emptyResultDesc: 'Отсканируйте штрихкод, сфотографируйте этикетку или вставьте состав во вкладке Сканер.',
    goScanBtn: '📷 Сканировать товар',
    editTextBtn: '✏️ Просмотр / Изменить текст',
    newScanReset: 'Новый скан (Сброс)',
    activeAuthorityTitle: 'Выбранный стандарт Халяль',
    emptyHalalDesc: 'Сначала отсканируйте товар, чтобы увидеть оценку по стандартам GİMDES, JAKIM, MUI и IFANCA.',
    loadAuthorityDemoBtn: '🧪 Загрузить пример различий (E120 и Улитка)',
    emptyCompareTitle: 'Сравнение пусто',
    emptyCompareDesc: 'Назначьте товары в слоты A / B на экране Результат или загрузите пример сравнения ниже.',
    emptySlotLabel: 'Товар не назначен',
    loadCompareDemoBtn: '🧪 Загрузить пример сравнения A / B',
    torchOn: '🔦 Вспышка Вкл',
    torchOff: '🔦 Вспышка',
    cropModeToggle: '✂️ Обрезать этикетку',
    shieldSummaryPrefix: 'Защита от ложных тревог (Не этанол)'
  },
  ur: {
    jurisdictionLabel: 'قانونی دائرہ کار',
    veganNone: 'ویگن: کوئی نہیں',
    veganDeclared: 'ویگن: لیبل دعویٰ',
    veganVerified: 'ویگن: مصدقہ',
    attentionOnlyBtn: 'توجہ / انتباہات',
    allItemsBtn: 'تمام',
    noAttentionMsg: 'کوئی ممنوع یا محدود جزو نہیں ملا جس پر فوری توجہ درکار ہو۔',
    saveBarcodeTitle: 'ڈیوائس پر مخصوص بارکوڈ محفوظ کریں',
    saveBarcodePlaceholder: 'پروڈکٹ کا نام (اختیاری)',
    saveBarcodeBtn: 'بارکوڈ مقامی طور پر محفوظ کریں',
    saveBarcodeLowCov: 'کوریج 80% سے کم ہے یا OCR تصدیق باقی ہے؛ محفوظ کرنے سے پہلے مکمل کریں۔',
    saveBarcodeOk: (code) => `بارکوڈ (${code}) کی تصدیق ہو گئی اور مقامی کیٹلاگ میں محفوظ ہو گیا۔`,
    methodologyBtn: 'فقہی طریقہ کار اور سرکاری فتاویٰ کے ذرائع',
    methodologyTitle: 'فقہی طریقہ کار اور ذرائع کا بیان',
    methodologyIntro: 'InciFact ایک آزاد سائنسی اور الگورتھمک جانچ انجن ہے جس کا مذکورہ اداروں سے کوئی سرکاری یا تجارتی تعلق نہیں۔',
    methodologyItems: [
      ['١. GİMDES (ترکی)', 'معیار دفعہ 4.2 کے تحت کیڑوں سے حاصل شدہ اجزاء (کارمین E120، شیلیک، سنیل میوسن)، ایتھانول اور غیر مصدقہ ایملسیفائر قبول نہیں۔'],
      ['٢. JAKIM (ملائیشیا)', 'فتویٰ 100/2012 کے تحت کارمین (E120) جائز ہے؛ بیرونی کاسمیٹکس میں سنیل میوسن پاکیزگی کی شرط سے مشروط ہے۔'],
      ['٣. MUI / BPJPH (انڈونیشیا)', 'فتویٰ 33/2011 کے تحت کارمین جائز ہے؛ فتویٰ 24/2012 کے تحت گھونگھے کھانا حرام اور بیرونی کاسمیٹکس جانچ کے تابع ہیں۔'],
      ['٤. IFANCA (عالمی)', 'دوہرے ماخذ والے اجزاء کو مصدقہ نباتاتی اصل یا سرٹیفکیٹ کی بنیاد پر پرکھتا ہے اور خنزیر و الکوحل کو ممنوع قرار دیتا ہے۔']
    ],
    privacyBtn: 'رازداری کی پالیسی اور بارکوڈ API وضاحت',
    privacyTitle: 'رازداری اور ڈیٹا کا تحفظ',
    privacyBarcodeNote: 'اختیاری لائیو بارکوڈ سرچ: صرف EAN تلاش کرنے پر بارکوڈ نمبر Open Food/Beauty Facts (ODbL) کو بھیجا جاتا ہے؛ آپ کی پروفائل ڈیوائس پر ہی رہتی ہے۔',
    closeBtn: 'بند کریں',
    shareNativeBtn: 'شیئر کریں',
    barcodeCardTitle: 'فوری بارکوڈ اسکین',
    scanBarcodeCameraBtn: '📷 کیمرے سے بارکوڈ اسکین کریں',
    barcodeModalTitle: 'بارکوڈ کو فریم میں رکھیں',
    barcodeModalHint: 'EAN-13 / UPC کوڈ کو چوکور خانے کے اندر سیدھا رکھیں۔',
    barcodeFallbackOcrBtn: '📸 بارکوڈ نہ ملے؟ اجزاء کی تصویر لیں',
    barcodeInputPlaceholder: '8 سے 14 ہندسوں کا EAN / UPC نمبر',
    barcodeLookupBtn: '🔍 تلاش کریں',
    barcodeNameFoundHint: (name) => `"${name}" مل گیا، لیکن اوپن ڈیٹا بیس میں اجزاء کی فہرست موجود نہیں۔ نیچے "لیبل کی تصویر لیں" استعمال کریں۔`,
    ocrCardTitle: 'اجزاء کا لیبل پڑھیں (OCR)',
    ocrCameraBtn: '📸 لیبل کی تصویر لیں',
    ocrGalleryBtn: '🖼️ گیلری سے منتخب کریں',
    ocrEmptyErr: 'تصویر میں کوئی قابلِ مطالعہ متن نہیں ملا۔ اچھی روشنی میں اجزاء کے قریب سے تصویر لیں۔',
    ocrPermissionErr: 'کیمرے یا گیلری کی اجازت نہیں ملی۔ براہِ کرم فون کی سیٹنگز میں InciFact کو اجازت دیں۔',
    ocrNoNativeErr: 'اس ماحول میں مقامی OCR دستیاب نہیں؛ نیچے متن پیسٹ کریں۔',
    manualCardTitle: 'دستی طور پر پیسٹ یا ترمیم کریں',
    manualPlaceholder: 'اجزاء (Ingredients) کی فہرست یہاں لکھیں یا پیسٹ کریں...',
    demoHeader: '🧪 فوری ٹیسٹ مثال لوڈ کریں',
    demoNames: ['موئسچرائزر', 'حلال E120 جیلی', "L'Oréal Glotion"],
    demoLoadedMsg: (name) => `✓ مثال لوڈ ہو گئی: ${name}`,
    emptyResultTitle: 'ابھی کوئی پروڈکٹ اسکین نہیں ہوئی',
    emptyResultDesc: 'تجزیہ دیکھنے کے لیے اسکین ٹیب میں بارکوڈ اسکین کریں، لیبل کی تصویر لیں یا متن پیسٹ کریں۔',
    goScanBtn: '📷 پروڈکٹ اسکین کریں',
    editTextBtn: '✏️ متن دیکھیں / ترمیم کریں',
    newScanReset: 'نیا اسکین (صاف کریں)',
    activeAuthorityTitle: 'منتخب حلال معیار',
    emptyHalalDesc: 'GİMDES، JAKIM، MUI اور IFANCA کے مطابق جانچ دیکھنے کے لیے پہلے پروڈکٹ اسکین کریں۔',
    loadAuthorityDemoBtn: '🧪 اتھارٹی فرق کی مثال لوڈ کریں (E120 اور سنیل)',
    emptyCompareTitle: 'موازنہ خالی ہے',
    emptyCompareDesc: 'نتیجہ اسکرین سے مصنوعات کو A / B میں شامل کریں یا نیچے مثال لوڈ کریں۔',
    emptySlotLabel: 'ابھی کوئی پروڈکٹ منتخب نہیں',
    loadCompareDemoBtn: '🧪 مثال A / B موازنہ لوڈ کریں',
    torchOn: '🔦 فلیش آن',
    torchOff: '🔦 فلیش',
    cropModeToggle: '✂️ لیبل کراپ کریں',
    shieldSummaryPrefix: 'غلط انتباہ سے تحفظ (ایتھنول نہیں)'
  }
};

const PHASE1_MOBILE_I18N: Record<
  LangCode,
  {
    consentTitle: string;
    consentDesc: string;
    consentAcceptBtn: string;
    consentAcceptedLbl: string;
    liveBarcodeTitle: string;
    liveBarcodeDesc: string;
    eraseAllBtn: string;
    eraseDoneMsg: string;
    reformulationNotice: string;
    barcodeSourceLbl: string;
    sugarTotalLbl: string;
    freeSugarLbl: string;
    rapidCarbLbl: string;
    veganConcernLbl: string;
  }
> = {
  tr: {
    consentTitle: 'Cihaz İçi Gizlilik & Tercih Onayı (KVKK)',
    consentDesc: 'Profil tercihleriniz, özel kara listeniz ve tarama geçmişiniz yalnızca bu cihazda tutulur; buluta aktarılmaz.',
    consentAcceptBtn: 'Anladım & Onayla',
    consentAcceptedLbl: '✓ Yerel İşleme Onaylandı',
    liveBarcodeTitle: 'Çevrimiçi Barkod Veritabanı (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Kapalıyken (önerilen) yalnızca cihaz içi doğrulanmış katalog kullanılır; açıkken sorgulanan barkod harici sunucuya gönderilir.',
    eraseAllBtn: '🗑️ Tüm Yerel Verileri Tek Dokunuşla Sil',
    eraseDoneMsg: 'Tüm yerel tercihler, geçmiş, kara liste ve barkod önbelleği silindi.',
    reformulationNotice: 'Üretici formülasyonu değiştirmiş olabilir; kullanmadan önce ambalajı kontrol edin.',
    barcodeSourceLbl: 'Kaynak',
    sugarTotalLbl: 'Gizli Şeker Yükü',
    freeSugarLbl: 'Serbest Şekerler',
    rapidCarbLbl: 'Hızlı Karbonhidrat / Maltodekstrin',
    veganConcernLbl: 'Vegan / Vejetaryen Uyumsuz veya Belirsiz'
  },
  en: {
    consentTitle: 'On-Device Privacy & Consent',
    consentDesc: 'Your preferences, custom watchlist, and scan history stay strictly on this device and are never uploaded to a cloud server.',
    consentAcceptBtn: 'Accept Local Processing',
    consentAcceptedLbl: '✓ On-Device Processing Confirmed',
    liveBarcodeTitle: 'Live Barcode API (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'When off (default), only on-device catalog runs; when on, queried barcodes are sent to Open Food/Beauty Facts ODbL APIs.',
    eraseAllBtn: '🗑️ Erase All Local Data',
    eraseDoneMsg: 'All local preferences, history, watchlist, and barcode caches erased.',
    reformulationNotice: 'Formulas may change over time; verify the physical package label before use.',
    barcodeSourceLbl: 'Source',
    sugarTotalLbl: 'Hidden Sugar Flags',
    freeSugarLbl: 'Free Sugars',
    rapidCarbLbl: 'Rapid Carbs / Maltodextrin',
    veganConcernLbl: 'Non-Vegan / Uncertain Origin'
  },
  ar: {
    consentTitle: 'الخصوصية والموافقة المحلية على الجهاز',
    consentDesc: 'تُحفظ تفضيلاتك وقائمة الحظر وسجل الفحوصات على هذا الجهاز فقط ولا تُرفع إلى أي خادم سحابي.',
    consentAcceptBtn: 'موافق على المعالجة المحلية',
    consentAcceptedLbl: '✓ تم تأكيد المعالجة المحلية',
    liveBarcodeTitle: 'استعلام الباركود عبر الإنترنت (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'عند الإيقاف (الافتراضي) يعمل التطبيق دون إنترنت؛ وعند التفعيل يُرسل رقم الباركود فقط.',
    eraseAllBtn: '🗑️ مسح جميع البيانات المحلية بنقرة واحدة',
    eraseDoneMsg: 'تم مسح جميع التفضيلات والسجل وذاكرة الباركود.',
    reformulationNotice: 'قد يغيّر المصنّع التركيبة؛ يرجى التحقق من ملصق العبوة الفعلي قبل الاستخدام.',
    barcodeSourceLbl: 'المصدر',
    sugarTotalLbl: 'السكريات المخفية',
    freeSugarLbl: 'السكريات الحرة',
    rapidCarbLbl: 'كربوهيدرات سريعة الامتصاص',
    veganConcernLbl: 'غير نباتي / مصدر غير مؤكد'
  },
  de: {
    consentTitle: 'Lokale Verarbeitung & Einwilligung',
    consentDesc: 'Profil, Sperrliste und Verlauf bleiben ausschließlich auf diesem Gerät gespeichert und werden nicht in eine Cloud hochgeladen.',
    consentAcceptBtn: 'Lokale Verarbeitung bestätigen',
    consentAcceptedLbl: '✓ Lokal bestätigt',
    liveBarcodeTitle: 'Online-Barcode-Abruf (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Aus (Standard): rein offline. Ein: sendet nur die abgefragte Barcode-Nummer.',
    eraseAllBtn: '🗑️ Alle lokalen Daten löschen',
    eraseDoneMsg: 'Alle lokalen Einstellungen, Verlauf und Barcode-Caches wurden gelöscht.',
    reformulationNotice: 'Rezepturen können sich ändern; bitte prüfen Sie vor Verwendung das Originaletikett.',
    barcodeSourceLbl: 'Quelle',
    sugarTotalLbl: 'Versteckte Zucker',
    freeSugarLbl: 'Freie Zucker',
    rapidCarbLbl: 'Schnelle Kohlenhydrate',
    veganConcernLbl: 'Nicht-vegan / Herkunft unklar'
  },
  fr: {
    consentTitle: 'Confidentialité & Consentement Local',
    consentDesc: 'Vos préférences, liste noire et historique restent uniquement sur cet appareil et ne sont jamais envoyés dans le cloud.',
    consentAcceptBtn: 'Confirmer le traitement local',
    consentAcceptedLbl: '✓ Traitement local confirmé',
    liveBarcodeTitle: 'Recherche code-barres en ligne (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Désactivé par défaut (hors ligne) ; si activé, seul le code-barres saisi est interrogé.',
    eraseAllBtn: '🗑️ Effacer toutes les données locales',
    eraseDoneMsg: 'Préférences, historique, liste noire et cache codes-barres effacés.',
    reformulationNotice: 'La formule peut avoir changé ; vérifiez toujours l’étiquette physique avant usage.',
    barcodeSourceLbl: 'Source',
    sugarTotalLbl: 'Sucres cachés',
    freeSugarLbl: 'Sucres libres',
    rapidCarbLbl: 'Glucides rapides',
    veganConcernLbl: 'Non végan / Origine incertaine'
  },
  id: {
    consentTitle: 'Privasi & Persetujuan Lokal',
    consentDesc: 'Preferensi, daftar blokir, dan riwayat hanya tersimpan di perangkat ini dan tidak pernah dikirim ke server cloud.',
    consentAcceptBtn: 'Setujui Pemrosesan Lokal',
    consentAcceptedLbl: '✓ Pemrosesan Lokal Disetujui',
    liveBarcodeTitle: 'Pencarian Barcode Online (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Saat nonaktif (default), hanya katalog offline yang berjalan; saat aktif, nomor barcode dikirim ke API publik.',
    eraseAllBtn: '🗑️ Hapus Semua Data Lokal',
    eraseDoneMsg: 'Semua preferensi lokal, riwayat, daftar blokir, dan cache barcode dihapus.',
    reformulationNotice: 'Komposisi produk dapat berubah; periksa kembali label fisik kemasan sebelum digunakan.',
    barcodeSourceLbl: 'Sumber',
    sugarTotalLbl: 'Gula Tersembunyi',
    freeSugarLbl: 'Gula Bebas',
    rapidCarbLbl: 'Karbohidrat Cepat',
    veganConcernLbl: 'Non-Vegan / Sumber Belum Jelas'
  },
  ms: {
    consentTitle: 'Privasi & Persetujuan Setempat',
    consentDesc: 'Keutamaan, senarai hitam dan sejarah imbasan kekal di peranti ini sahaja tanpa dimuat naik ke awan.',
    consentAcceptBtn: 'Sahkan Pemprosesan Setempat',
    consentAcceptedLbl: '✓ Pemprosesan Setempat Disahkan',
    liveBarcodeTitle: 'Carian Kod Bar Dalam Talian (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Dimatikan secara lalai (luar talian); apabila dihidupkan, hanya nombor kod bar dihantar.',
    eraseAllBtn: '🗑️ Padam Semua Data Setempat',
    eraseDoneMsg: 'Semua keutamaan, sejarah, senarai hitam dan cache kod bar telah dipadam.',
    reformulationNotice: 'Formulasi boleh berubah; sila sahkan label pada bungkusan fizikal sebelum guna.',
    barcodeSourceLbl: 'Sumber',
    sugarTotalLbl: 'Gula Tersembunyi',
    freeSugarLbl: 'Gula Bebas',
    rapidCarbLbl: 'Karbohidrat Pantas',
    veganConcernLbl: 'Bukan Vegan / Sumber Tidak Pasti'
  },
  es: {
    consentTitle: 'Privacidad y Consentimiento Local',
    consentDesc: 'Tus preferencias, lista negra e historial permanecen solo en este dispositivo y nunca se suben a la nube.',
    consentAcceptBtn: 'Aceptar procesamiento local',
    consentAcceptedLbl: '✓ Procesamiento local confirmado',
    liveBarcodeTitle: 'Consulta online de códigos (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'Desactivada por defecto (sin conexión); si se activa, solo se envía el código escaneado.',
    eraseAllBtn: '🗑️ Borrar todos los datos locales',
    eraseDoneMsg: 'Preferencias, historial, lista negra y caché de códigos eliminados.',
    reformulationNotice: 'La fórmula puede haber cambiado; verifica siempre la etiqueta del envase antes de usar.',
    barcodeSourceLbl: 'Fuente',
    sugarTotalLbl: 'Azúcares ocultos',
    freeSugarLbl: 'Azúcares libres',
    rapidCarbLbl: 'Carbohidratos rápidos',
    veganConcernLbl: 'No vegano / Origen incierto'
  },
  ru: {
    consentTitle: 'Локальная конфиденциальность и согласие',
    consentDesc: 'Настройки, чёрный список и история проверок хранятся только на этом устройстве и не передаются в облако.',
    consentAcceptBtn: 'Подтвердить локальную обработку',
    consentAcceptedLbl: '✓ Локальная обработка подтверждена',
    liveBarcodeTitle: 'Онлайн-поиск штрихкодов (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'По умолчанию выключен (офлайн); при включении отправляется только сам номер штрихкода.',
    eraseAllBtn: '🗑️ Удалить все локальные данные',
    eraseDoneMsg: 'Локальные настройки, история, чёрный список и кэш штрихкодов удалены.',
    reformulationNotice: 'Состав мог измениться производителем; проверьте упаковку перед использованием.',
    barcodeSourceLbl: 'Источник',
    sugarTotalLbl: 'Скрытые сахара',
    freeSugarLbl: 'Свободные сахара',
    rapidCarbLbl: 'Быстрые углеводы',
    veganConcernLbl: 'Не веган / Неясное происхождение'
  },
  ur: {
    consentTitle: 'ڈیوائس پر رازداری اور مقامی رضامندی',
    consentDesc: 'آپ کی ترجیحات، ذاتی بلیک لسٹ اور اسکین ہسٹری صرف اسی ڈیوائس پر رہتی ہے اور کلاؤڈ پر نہیں بھیجی جاتی۔',
    consentAcceptBtn: 'مقامی پراسیسنگ منظور کریں',
    consentAcceptedLbl: '✓ مقامی پراسیسنگ منظور شدہ',
    liveBarcodeTitle: 'آن لائن بارکوڈ تلاش (Open Food/Beauty Facts)',
    liveBarcodeDesc: 'ڈیفالٹ طور پر بند (آف لائن)؛ آن کرنے پر صرف بارکوڈ نمبر عوامی API کو بھیجا جاتا ہے۔',
    eraseAllBtn: '🗑️ تمام مقامی ڈیٹا ایک ٹیپ میں مٹائیں',
    eraseDoneMsg: 'تمام مقامی ترجیحات، ہسٹری، بلیک لسٹ اور بارکوڈ کیش حذف کر دیا گیا۔',
    reformulationNotice: 'تیاری کا فارمولا تبدیل ہو سکتا ہے؛ استعمال سے پہلے اصل پیکج لیبل کی تصدیق کریں۔',
    barcodeSourceLbl: 'ماخذ',
    sugarTotalLbl: 'چھپی ہوئی شوگر',
    freeSugarLbl: 'آزاد شکر',
    rapidCarbLbl: 'تیز کاربوہائیڈریٹ',
    veganConcernLbl: 'نان ویگن / غیر یقینی ماخذ'
  }
};

const MOBILE_A11Y_I18N: Record<
  LangCode,
  {
    settingsBtn: string;
    themeToLight: string;
    themeToDark: string;
    addWatchTerm: string;
    removeWatchTerm: (term: string) => string;
    autoRegion: string;
    galleryOcr: string;
    barcodeInput: string;
    barcodeLookup: string;
    assignCompareA: string;
    assignCompareB: string;
  }
> = {
  tr: {
    settingsBtn: 'Profil, Dil ve Bölge Ayarları',
    themeToLight: 'Açık Temaya Geç',
    themeToDark: 'Koyu Temaya Geç',
    addWatchTerm: 'Özel Kara Listeye Ekle',
    removeWatchTerm: (term) => `${term} maddesini kara listeden kaldır`,
    autoRegion: 'Otomatik Dil ve Bölge',
    galleryOcr: 'Galeriden OCR Etiket Okuma',
    barcodeInput: 'EAN-13 veya UPC Barkod Numarası',
    barcodeLookup: 'Barkod ile Ürün Ara',
    assignCompareA: '1. Karşılaştırma Ürünü (A) Olarak Ata',
    assignCompareB: '2. Karşılaştırma Ürünü (B) Olarak Ata'
  },
  en: {
    settingsBtn: 'Profile, Language and Region Settings',
    themeToLight: 'Switch to Light Theme',
    themeToDark: 'Switch to Dark Theme',
    addWatchTerm: 'Add to Personal Watchlist',
    removeWatchTerm: (term) => `Remove ${term} from watchlist`,
    autoRegion: 'Automatic Language and Region',
    galleryOcr: 'OCR Label Scan from Gallery',
    barcodeInput: 'EAN-13 or UPC Barcode Number',
    barcodeLookup: 'Lookup Product by Barcode',
    assignCompareA: 'Assign to Compare Slot A',
    assignCompareB: 'Assign to Compare Slot B'
  },
  ar: {
    settingsBtn: 'إعدادات الملف واللغة والمنطقة',
    themeToLight: 'التبديل إلى الوضع الفاتح',
    themeToDark: 'التبديل إلى الوضع الداكن',
    addWatchTerm: 'إضافة إلى القائمة السوداء',
    removeWatchTerm: (term) => `إزالة ${term} من القائمة السوداء`,
    autoRegion: 'لغة ومنطقة تلقائية',
    galleryOcr: 'مسح الملصق من المعرض OCR',
    barcodeInput: 'رقم الباركود EAN-13 أو UPC',
    barcodeLookup: 'البحث عن المنتج بالباركود',
    assignCompareA: 'تعيين للمقارنة أ',
    assignCompareB: 'تعيين للمقارنة ب'
  },
  de: {
    settingsBtn: 'Profil-, Sprach- und Regionseinstellungen',
    themeToLight: 'Zum hellen Design wechseln',
    themeToDark: 'Zum dunklen Design wechseln',
    addWatchTerm: 'Zur Sperrliste hinzufügen',
    removeWatchTerm: (term) => `${term} aus Sperrliste entfernen`,
    autoRegion: 'Automatische Sprache und Region',
    galleryOcr: 'OCR-Etikettenscan aus Galerie',
    barcodeInput: 'EAN-13 oder UPC Barcodenummer',
    barcodeLookup: 'Produkt per Barcode suchen',
    assignCompareA: 'Als Vergleichsprodukt A festlegen',
    assignCompareB: 'Als Vergleichsprodukt B festlegen'
  },
  fr: {
    settingsBtn: 'Paramètres de profil, langue et région',
    themeToLight: 'Passer au thème clair',
    themeToDark: 'Passer au thème sombre',
    addWatchTerm: 'Ajouter à la liste noire',
    removeWatchTerm: (term) => `Retirer ${term} de la liste noire`,
    autoRegion: 'Langue et région automatiques',
    galleryOcr: 'Analyse OCR depuis la galerie',
    barcodeInput: 'Numéro de code-barres EAN-13 ou UPC',
    barcodeLookup: 'Rechercher le produit par code-barres',
    assignCompareA: 'Assigner au produit comparé A',
    assignCompareB: 'Assigner au produit comparé B'
  },
  id: {
    settingsBtn: 'Pengaturan Profil, Bahasa, dan Wilayah',
    themeToLight: 'Beralih ke Tema Terang',
    themeToDark: 'Beralih ke Tema Gelap',
    addWatchTerm: 'Tambah ke Daftar Hitam',
    removeWatchTerm: (term) => `Hapus ${term} dari daftar hitam`,
    autoRegion: 'Bahasa dan Wilayah Otomatis',
    galleryOcr: 'Pindai Label OCR dari Galeri',
    barcodeInput: 'Nomor Barcode EAN-13 atau UPC',
    barcodeLookup: 'Cari Produk dengan Barcode',
    assignCompareA: 'Tetapkan ke Bandingkan A',
    assignCompareB: 'Tetapkan ke Bandingkan B'
  },
  ms: {
    settingsBtn: 'Tetapan Profil, Bahasa dan Wilayah',
    themeToLight: 'Tukar ke Tema Cerah',
    themeToDark: 'Tukar ke Tema Gelap',
    addWatchTerm: 'Tambah ke Senarai Hitam',
    removeWatchTerm: (term) => `Buang ${term} daripada senarai hitam`,
    autoRegion: 'Bahasa dan Wilayah Automatik',
    galleryOcr: 'Imbasan Label OCR dari Galeri',
    barcodeInput: 'Nombor Kod Bar EAN-13 atau UPC',
    barcodeLookup: 'Cari Produk melalui Kod Bar',
    assignCompareA: 'Tetapkan ke Bandingkan A',
    assignCompareB: 'Tetapkan ke Bandingkan B'
  },
  es: {
    settingsBtn: 'Ajustes de perfil, idioma y región',
    themeToLight: 'Cambiar a tema claro',
    themeToDark: 'Cambiar a tema oscuro',
    addWatchTerm: 'Añadir a lista negra',
    removeWatchTerm: (term) => `Quitar ${term} de lista negra`,
    autoRegion: 'Idioma y región automáticos',
    galleryOcr: 'Escaneo OCR desde galería',
    barcodeInput: 'Número de código de barras EAN-13 o UPC',
    barcodeLookup: 'Buscar producto por código de barras',
    assignCompareA: 'Asignar a producto A',
    assignCompareB: 'Asignar a producto B'
  },
  ru: {
    settingsBtn: 'Настройки профиля, языка и региона',
    themeToLight: 'Переключить на светлую тему',
    themeToDark: 'Переключить на темную тему',
    addWatchTerm: 'Добавить в черный список',
    removeWatchTerm: (term) => `Удалить ${term} из черного списка`,
    autoRegion: 'Автовыбор языка и региона',
    galleryOcr: 'OCR-сканирование из галереи',
    barcodeInput: 'Номер штрихкода EAN-13 или UPC',
    barcodeLookup: 'Найти товар по штрихкоду',
    assignCompareA: 'Назначить товаром A',
    assignCompareB: 'Назначить товаром B'
  },
  ur: {
    settingsBtn: 'پروفائل، زبان اور علاقے کی ترتیبات',
    themeToLight: 'روشن تھیم پر سوئچ کریں',
    themeToDark: 'ڈارک تھیم پر سوئچ کریں',
    addWatchTerm: 'ذاتی بلیک لسٹ میں شامل کریں',
    removeWatchTerm: (term) => `${term} کو بلیک لسٹ سے ہٹائیں`,
    autoRegion: 'خودکار زبان اور علاقہ',
    galleryOcr: 'گیلری سے OCR لیبل اسکین',
    barcodeInput: 'EAN-13 یا UPC بارکوڈ نمبر',
    barcodeLookup: 'بارکوڈ کے ذریعے پروڈکٹ تلاش کریں',
    assignCompareA: 'موازنہ پروڈکٹ A منتخب کریں',
    assignCompareB: 'موازنہ پروڈکٹ B منتخب کریں'
  }
};

const PHASE34_MOBILE_I18N: Record<string, any> = {
  tr: {
    madhhabLbl: 'Fıkıh Mezhebi',
    madhhabs: { general: 'Genel', hanafi: 'Hanefi', shafii: 'Şafii', maliki: 'Maliki', hanbali: 'Hanbeli' },
    curatedCovLbl: 'Kürasyon',
    lowConfWarn: 'OCR güven skoru düşük (<%65). Lütfen bileşen adlarını gözden geçirin veya daha net fotoğraf çekin.',
    askMfrBtn: '💬 Üreticiye Helal / Kaynak Sorusu Paylaş',
    askMfrMsg: (p: string, auth: string) => `Merhaba, "${p}" ürününüzün içerik/kaynak beyanı (${auth} kriterleri çerçevesinde; hayvansal/mikrobiyal köken ve çözücü alkol durumu) hakkında yazılı bilgi paylaşabilir misiniz?`,
    householdTitle: '👨‍👩‍👧‍👦 Aile / Hane Profilleri (4\'e kadar)',
    householdAddPreg: '+ Hamile Eş',
    householdAddBaby: '+ Bebek / Çocuk',
    householdAddFungal: '+ Fungal Akne',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Aile Profilleri Özeti',
    shelfSaveTitle: 'Rafa Kaydet:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Kiler',
    shelfTitle: '🧴 AM/PM Rutin & Kiler Çakışma Rafı',
    altTitle: '✨ Daha Temiz / Helal Alternatifler & Muadiller',
    inciSimLbl: 'INCI Benzerliği',
    dossierClose: 'Kapat',
    tapDossierHint: 'Detay için dokun ↗',
    ocrModelMissing: 'Bu cihazda seçili alfabe için çevrimdışı OCR paketi (Arapça/Urduca/Kiril) yüklü değil. Barkod okuyun veya metni yapıştırın.',
    nutriToggle: '📊 100 g Besin Tablosu & Nutri-Score (Opsiyonel)',
    nutriKcal: 'Enerji (kcal)',
    nutriSugars: 'Şeker (g)',
    nutriSatFat: 'Doymuş Yağ (g)',
    nutriSalt: 'Tuz (g)',
    nutriFiber: 'Lif (g)',
    nutriProtein: 'Protein (g)',
    nutriBev: 'İçecek (2023 ölçeği)',
    nutriClear: 'Temizle'
  },
  en: {
    madhhabLbl: 'Fiqh Madhhab',
    madhhabs: { general: 'General', hanafi: 'Hanafi', shafii: 'Shafi\'i', maliki: 'Maliki', hanbali: 'Hanbali' },
    curatedCovLbl: 'Curated',
    lowConfWarn: 'Low OCR confidence (<65%). Please review ingredient spelling or retake a sharper photo.',
    askMfrBtn: '💬 Share Manufacturer Origin Inquiry',
    askMfrMsg: (p: string, auth: string) => `Hello, could you confirm the origin (animal/microbial/synthetic source and carrier ethanol status) for "${p}" under ${auth} Halal criteria?`,
    householdTitle: '👨‍👩‍👧‍👦 Household Profiles (Up to 4)',
    householdAddPreg: '+ Pregnant Partner',
    householdAddBaby: '+ Baby / Child',
    householdAddFungal: '+ Fungal Acne',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Household Verdict',
    shelfSaveTitle: 'Save to Shelf:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Pantry',
    shelfTitle: '🧴 AM/PM Routine & Pantry Conflict Shelf',
    altTitle: '✨ Cleaner & Halal Swaps + INCI Dupes',
    inciSimLbl: 'INCI Similarity',
    dossierClose: 'Close',
    tapDossierHint: 'Tap for dossier ↗',
    ocrModelMissing: 'Offline script OCR pack (Arabic/Urdu/Cyrillic) is not bundled on this device. Use barcode scan or paste ingredients.',
    nutriToggle: '📊 Per-100g Nutrition & Nutri-Score (Optional)',
    nutriKcal: 'Energy (kcal)',
    nutriSugars: 'Sugars (g)',
    nutriSatFat: 'Sat. Fat (g)',
    nutriSalt: 'Salt (g)',
    nutriFiber: 'Fiber (g)',
    nutriProtein: 'Protein (g)',
    nutriBev: 'Beverage (2023 scale)',
    nutriClear: 'Clear'
  },
  ar: {
    madhhabLbl: 'المذهب الفقهي',
    madhhabs: { general: 'عام', hanafi: 'حنفي', shafii: 'شافعي', maliki: 'مالكي', hanbali: 'حنبلي' },
    curatedCovLbl: 'تحقق دقيق',
    lowConfWarn: 'دقة OCR منخفضة (<٦٥٪). يُرجى مراجعة الأسماء أو إعادة التصوير بوضوح أكبر.',
    askMfrBtn: '💬 مشاركة رسالة استفسار للمُصنّع',
    askMfrMsg: (p: string, auth: string) => `مرحباً، هل يمكنكم توضيح مصدر المكونات وحالة الإيثانول لمنتج "${p}" وفق معايير ${auth}؟`,
    householdTitle: '👨‍👩‍👧‍👦 ملفات العائلة (حتى ٤)',
    householdAddPreg: '+ زوجة (حمل)',
    householdAddBaby: '+ طفل',
    householdAddFungal: '+ حب شباب فطري',
    householdVerdictTitle: '👨‍👩‍👧‍👦 ملخص العائلة',
    shelfSaveTitle: 'حفظ في الرف:',
    shelfAm: '+ صباحي',
    shelfPm: '+ مسائي',
    shelfPantry: '+ مؤونة',
    shelfTitle: '🧴 رف الروتين الصباحي والمسائي والمؤونة',
    altTitle: '✨ بدائل أنظف وحلال + شبيهات INCI',
    inciSimLbl: 'تشابه INCI',
    dossierClose: 'إغلاق',
    tapDossierHint: 'اضغط للتفاصيل ↗',
    ocrModelMissing: 'حزمة OCR المحلية للخط العربي غير مثبتة على هذا الجهاز. استخدم مسح الباركود أو ألصق المكونات.',
    nutriToggle: '📊 القيم الغذائية 100غ و Nutri-Score (اختياري)',
    nutriKcal: 'الطاقة (kcal)',
    nutriSugars: 'السكر (g)',
    nutriSatFat: 'دهون مشبعة (g)',
    nutriSalt: 'ملح (g)',
    nutriFiber: 'ألياف (g)',
    nutriProtein: 'بروتين (g)',
    nutriBev: 'مشروب (مقياس 2023)',
    nutriClear: 'مسح'
  },
  de: {
    madhhabLbl: 'Rechtsschule (Madhhab)',
    madhhabs: { general: 'Allgemein', hanafi: 'Hanafi', shafii: 'Schafi\'i', maliki: 'Maliki', hanbali: 'Hanbali' },
    curatedCovLbl: 'Kuratiert',
    lowConfWarn: 'Geringe OCR-Erkennungssicherheit (<65 %). Bitte Inhaltsstoffe prüfen oder schärferes Foto machen.',
    askMfrBtn: '💬 Hersteller-Anfrage zu Herkunft teilen',
    askMfrMsg: (p: string, auth: string) => `Guten Tag, können Sie die Herkunft (tierisch/mikrobiell/pflanzlich und Trägeralkohol) von „${p}“ gemäß ${auth}-Halal-Kriterien bestätigen?`,
    householdTitle: '👨‍👩‍👧‍👦 Familien-Profile (Bis 4)',
    householdAddPreg: '+ Schwanger',
    householdAddBaby: '+ Baby',
    householdAddFungal: '+ Fungal Akne',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Familien-Ergebnis',
    shelfSaveTitle: 'Im Regal speichern:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Vorrat',
    shelfTitle: '🧴 AM/PM-Routine- & Vorratsregal',
    altTitle: '✨ Saubere Alternativen & Dupes',
    inciSimLbl: 'INCI-Ähnlichkeit',
    dossierClose: 'Schließen',
    tapDossierHint: 'Details öffnen ↗',
    ocrModelMissing: 'Offline-Schriftpaket (Arabisch/Urdu/Kyrillisch) nicht installiert. Bitte Barcode scannen oder Text einfügen.',
    nutriToggle: '📊 Nährwerte 100 g & Nutri-Score (Optional)',
    nutriKcal: 'Energie (kcal)',
    nutriSugars: 'Zucker (g)',
    nutriSatFat: 'Ges. Fett (g)',
    nutriSalt: 'Salz (g)',
    nutriFiber: 'Ballaststoffe (g)',
    nutriProtein: 'Eiweiß (g)',
    nutriBev: 'Getränk (2023)',
    nutriClear: 'Leeren'
  },
  fr: {
    madhhabLbl: 'Madhhab (École juridique)',
    madhhabs: { general: 'Général', hanafi: 'Hanafite', shafii: 'Chaféite', maliki: 'Malikite', hanbali: 'Hanbalite' },
    curatedCovLbl: 'Expert',
    lowConfWarn: 'Confiance OCR faible (<65 %). Veuillez vérifier les ingrédients ou reprendre une photo nette.',
    askMfrBtn: '💬 Partager une demande au fabricant',
    askMfrMsg: (p: string, auth: string) => `Bonjour, pouvez-vous confirmer l'origine des ingrédients et l'absence d'éthanol résiduel pour « ${p} » selon les critères ${auth} ?`,
    householdTitle: '👨‍👩‍👧‍👦 Profils Famille (Jusqu\'à 4)',
    householdAddPreg: '+ Grossesse',
    householdAddBaby: '+ Bébé',
    householdAddFungal: '+ Acné fongique',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Résumé Foyer',
    shelfSaveTitle: 'Étagère :',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Cuisine',
    shelfTitle: '🧴 Étagère Routine AM/PM & Garde-manger',
    altTitle: '✨ Alternatives saines/Halal & Dupes',
    inciSimLbl: 'Similarité INCI',
    dossierClose: 'Fermer',
    tapDossierHint: 'Voir fiche ↗',
    ocrModelMissing: 'Pack OCR hors-ligne (arabe/ourdou/cyrillique) absent sur cet appareil. Scannez le code-barres ou collez le texte.',
    nutriToggle: '📊 Valeurs 100 g & Nutri-Score (Optionnel)',
    nutriKcal: 'Énergie (kcal)',
    nutriSugars: 'Sucres (g)',
    nutriSatFat: 'Gras sat. (g)',
    nutriSalt: 'Sel (g)',
    nutriFiber: 'Fibres (g)',
    nutriProtein: 'Protéines (g)',
    nutriBev: 'Boisson (barème 2023)',
    nutriClear: 'Effacer'
  },
  id: {
    madhhabLbl: 'Mazhab Fikih',
    madhhabs: { general: 'Umum', hanafi: 'Hanafi', shafii: 'Syafi\'i', maliki: 'Maliki', hanbali: 'Hanbali' },
    curatedCovLbl: 'Kurasi',
    lowConfWarn: 'Akurasi OCR rendah (<65%). Mohon periksa teks bahan atau foto ulang lebih jelas.',
    askMfrBtn: '💬 Bagikan Pertanyaan ke Produsen',
    askMfrMsg: (p: string, auth: string) => `Halo, bisakah Anda mengonfirmasi sumber bahan (hewani/nabati/mikroba & status etanol) untuk "${p}" sesuai standar Halal ${auth}?`,
    householdTitle: '👨‍👩‍👧‍👦 Profil Keluarga (Maks 4)',
    householdAddPreg: '+ Ibu Hamil',
    householdAddBaby: '+ Bayi',
    householdAddFungal: '+ Jerawat Jamur',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Ringkasan Keluarga',
    shelfSaveTitle: 'Simpan ke Rak:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Dapur',
    shelfTitle: '🧴 Rak Rutinitas AM/PM & Dapur',
    altTitle: '✨ Alternatif Halal & Dupe INCI',
    inciSimLbl: 'Kemiripan INCI',
    dossierClose: 'Tutup',
    tapDossierHint: 'Lihat detail ↗',
    ocrModelMissing: 'Paket OCR skrip non-Latin (Arab/Urdu/Kiril) belum terpasang. Pindai barcode atau tempel komposisi.',
    nutriToggle: '📊 Tabel Gizi 100 g & Nutri-Score (Opsional)',
    nutriKcal: 'Energi (kcal)',
    nutriSugars: 'Gula (g)',
    nutriSatFat: 'Lemak Jenuh (g)',
    nutriSalt: 'Garam (g)',
    nutriFiber: 'Serat (g)',
    nutriProtein: 'Protein (g)',
    nutriBev: 'Minuman (skala 2023)',
    nutriClear: 'Bersihkan'
  },
  ms: {
    madhhabLbl: 'Mazhab Fiqh',
    madhhabs: { general: 'Umum', hanafi: 'Hanafi', shafii: 'Syafii', maliki: 'Maliki', hanbali: 'Hanbali' },
    curatedCovLbl: 'Kurasi',
    lowConfWarn: 'Keyakinan OCR rendah (<65%). Sila semak ejaan ramuan atau ambil gambar lebih jelas.',
    askMfrBtn: '💬 Kongsi Pertanyaan kepada Pengilang',
    askMfrMsg: (p: string, auth: string) => `Salam, boleh sahkan sumber bahan dan status etanol bagi "${p}" mengikut piawaian Halal ${auth}?`,
    householdTitle: '👨‍👩‍👧‍👦 Profil Isi Rumah (Maks 4)',
    householdAddPreg: '+ Ibu Hamil',
    householdAddBaby: '+ Bayi',
    householdAddFungal: '+ Jerawat Kulat',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Keputusan Keluarga',
    shelfSaveTitle: 'Simpan ke Rak:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Pantri',
    shelfTitle: '🧴 Rak Rutin AM/PM & Pantri',
    altTitle: '✨ Alternatif Bersih/Halal & Dupe INCI',
    inciSimLbl: 'Persamaan INCI',
    dossierClose: 'Tutup',
    tapDossierHint: 'Ketik info ↗',
    ocrModelMissing: 'Pek OCR skrip bukan Latin (Arab/Urdu/Cyrillic) tiada pada peranti ini. Imbas kod bar atau tampal teks.',
    nutriToggle: '📊 Pemakanan 100 g & Nutri-Score (Pilihan)',
    nutriKcal: 'Tenaga (kcal)',
    nutriSugars: 'Gula (g)',
    nutriSatFat: 'Lemak Tepu (g)',
    nutriSalt: 'Garam (g)',
    nutriFiber: 'Serat (g)',
    nutriProtein: 'Protein (g)',
    nutriBev: 'Minuman (skala 2023)',
    nutriClear: 'Kosongkan'
  },
  es: {
    madhhabLbl: 'Madhhab (Escuela)',
    madhhabs: { general: 'General', hanafi: 'Hanafí', shafii: 'Shafi\'í', maliki: 'Malikí', hanbali: 'Hanbalí' },
    curatedCovLbl: 'Curación',
    lowConfWarn: 'Confianza OCR baja (<65%). Revisa los ingredientes o toma una foto más nítida.',
    askMfrBtn: '💬 Compartir consulta al fabricante',
    askMfrMsg: (p: string, auth: string) => `Hola, ¿podrían confirmar el origen de los ingredientes y el estado del alcohol en "${p}" según criterios Halal de ${auth}?`,
    householdTitle: '👨‍👩‍👧‍👦 Perfiles Familiares (Hasta 4)',
    householdAddPreg: '+ Embarazo',
    householdAddBaby: '+ Bebé',
    householdAddFungal: '+ Acné fúngico',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Resumen Familiar',
    shelfSaveTitle: 'Guardar en estante:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Despensa',
    shelfTitle: '🧴 Estante Rutina AM/PM y Despensa',
    altTitle: '✨ Alternativas Limpias/Halal y Dupes',
    inciSimLbl: 'Similitud INCI',
    dossierClose: 'Cerrar',
    tapDossierHint: 'Ver ficha ↗',
    ocrModelMissing: 'Paquete OCR sin conexión (árabe/urdu/cirílico) no instalado. Escanea el código de barras o pega el texto.',
    nutriToggle: '📊 Nutrición 100 g y Nutri-Score (Opcional)',
    nutriKcal: 'Energía (kcal)',
    nutriSugars: 'Azúcares (g)',
    nutriSatFat: 'Grasas sat. (g)',
    nutriSalt: 'Sal (g)',
    nutriFiber: 'Fibra (g)',
    nutriProtein: 'Proteínas (g)',
    nutriBev: 'Bebida (escala 2023)',
    nutriClear: 'Limpiar'
  },
  ru: {
    madhhabLbl: 'Мазхаб',
    madhhabs: { general: 'Общий', hanafi: 'Ханафи', shafii: 'Шафии', maliki: 'Малики', hanbali: 'Ханбали' },
    curatedCovLbl: 'Экспертно',
    lowConfWarn: 'Низкая уверенность OCR (<65%). Проверьте названия компонентов или переснимите этикетку чётче.',
    askMfrBtn: '💬 Отправить запрос производителю',
    askMfrMsg: (p: string, auth: string) => `Здравствуйте! Просим уточнить происхождение ингредиентов (животное/растительное, растворитель этанол) продукта «${p}» по стандарту Халяль ${auth}.`,
    householdTitle: '👨‍👩‍👧‍👦 Профили семьи (До 4)',
    householdAddPreg: '+ Беременность',
    householdAddBaby: '+ Ребёнок',
    householdAddFungal: '+ Грибк. акне',
    householdVerdictTitle: '👨‍👩‍👧‍👦 Сводка для семьи',
    shelfSaveTitle: 'На полку:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ Продукты',
    shelfTitle: '🧴 Полка рутины AM/PM и конфликтов',
    altTitle: '✨ Альтернативы Халяль и Дюпы INCI',
    inciSimLbl: 'Сходство INCI',
    dossierClose: 'Закрыть',
    tapDossierHint: 'Открыть досье ↗',
    ocrModelMissing: 'Офлайн-пакет OCR для кириллицы/арабицы/урду не установлен. Отсканируйте штрихкод или вставьте состав.',
    nutriToggle: '📊 Пищевая ценность 100 г и Nutri-Score',
    nutriKcal: 'Калории (kcal)',
    nutriSugars: 'Сахар (g)',
    nutriSatFat: 'Нас. жиры (g)',
    nutriSalt: 'Соль (g)',
    nutriFiber: 'Клетчатка (g)',
    nutriProtein: 'Белки (g)',
    nutriBev: 'Напиток (шкала 2023)',
    nutriClear: 'Очистить'
  },
  ur: {
    madhhabLbl: 'فقہی مسلک',
    madhhabs: { general: 'عمومی', hanafi: 'حنفی', shafii: 'شافعی', maliki: 'مالکی', hanbali: 'حنبلی' },
    curatedCovLbl: 'تحقیق شدہ',
    lowConfWarn: 'OCR اعتماد کم ہے (<٦٥٪)۔ براہ کرم اجزاء چیک کریں یا واضح تصویر لیں۔',
    askMfrBtn: '💬 مینوفیکچرر سے ماخذ کی تصدیق شیئر کریں',
    askMfrMsg: (p: string, auth: string) => `سلام، برائے مہربانی "${p}" کے اجزاء کے ماخذ (حیوانی/نباتاتی اور ایتھنول) کی ${auth} حلال معیار کے مطابق وضاحت فرمائیں۔`,
    householdTitle: '👨‍👩‍👧‍👦 خاندانی پروفائلز (٤ تک)',
    householdAddPreg: '+ حمل پروفائل',
    householdAddBaby: '+ بچہ پروفائل',
    householdAddFungal: '+ فنگل ایکنی',
    householdVerdictTitle: '👨‍👩‍👧‍👦 خاندانی جائزہ',
    shelfSaveTitle: 'شیلف میں محفوظ:',
    shelfAm: '+ AM',
    shelfPm: '+ PM',
    shelfPantry: '+ خوراک',
    shelfTitle: '🧴 صبح/شام روٹین اور پینٹری شیلف',
    altTitle: '✨ صاف حلال متبادل اور INCI ہم شکل',
    inciSimLbl: 'INCI مماثلت',
    dossierClose: 'بند کریں',
    tapDossierHint: 'تفصیل دیکھیں ↗',
    ocrModelMissing: 'اس ڈیوائس پر اردو/عربی/سریلک آف لائن OCR پیک موجود نہیں۔ بارکوڈ اسکین کریں یا اجزاء چسپاں کریں۔',
    nutriToggle: '📊 فی 100 گرام غذائی جدول اور Nutri-Score (اختیاری)',
    nutriKcal: 'توانائی (kcal)',
    nutriSugars: 'شکر (g)',
    nutriSatFat: 'سیر شدہ چکنائی (g)',
    nutriSalt: 'نمک (g)',
    nutriFiber: 'فائبر (g)',
    nutriProtein: 'پروٹین (g)',
    nutriBev: 'مشروب / مائع (2023 پیمانہ)',
    nutriClear: 'صاف کریں'
  }
};

const MOBILE_BOOST_I18N: Record<
  LangCode,
  {
    dossierProfileLbl: string;
    dossierHalalLbl: string;
    dossierSourceLbl: string;
    statusUnknown: string;
    altDupeSub: string;
    omnibusAlertsLbl: string;
    novaMarkersLbl: string;
    watchlistBadge: string;
  }
> = {
  tr: {
    dossierProfileLbl: '7 Kişisel Profil Etkisi',
    dossierHalalLbl: 'Helal & 4 Kurum Matrisi',
    dossierSourceLbl: 'Doğrulanmış Resmi Kaynaklar',
    statusUnknown: 'Bilinmiyor',
    altDupeSub: 'En Yüksek INCI Formül Benzerliği (Muadil %)',
    omnibusAlertsLbl: 'AB Omnibus & Yasak Takibi',
    novaMarkersLbl: 'Tespit edilen UPF belirteçleri',
    watchlistBadge: 'Kara Liste'
  },
  en: {
    dossierProfileLbl: '7-Profile Compatibility',
    dossierHalalLbl: 'Halal & 4-Board Matrix',
    dossierSourceLbl: 'Verified Official Sources',
    statusUnknown: 'Unknown',
    altDupeSub: 'Highest INCI Formula Overlap (Dupe Match %)',
    omnibusAlertsLbl: 'EU Omnibus & Ban Tracker',
    novaMarkersLbl: 'Detected UPF markers',
    watchlistBadge: 'Watchlist'
  },
  ar: {
    dossierProfileLbl: 'التوافق مع الملفات السبعة',
    dossierHalalLbl: 'الحكم الحلال ومقارنة الهيئات',
    dossierSourceLbl: 'المصادر الرسمية الموثقة',
    statusUnknown: 'غير معروف',
    altDupeSub: 'أعلى نسبة تطابق في التركيبة (%)',
    omnibusAlertsLbl: 'تنبيهات الحظر والمهل',
    novaMarkersLbl: 'مؤشرات التصنيع الفائق المرصودة',
    watchlistBadge: 'القائمة السوداء'
  },
  de: {
    dossierProfileLbl: '7-Profil-Matrix',
    dossierHalalLbl: 'Halal- & 4-Behörden-Matrix',
    dossierSourceLbl: 'Offizielle Quellen',
    statusUnknown: 'Unbekannt',
    altDupeSub: 'Höchste INCI-Übereinstimmung (Dupe %)',
    omnibusAlertsLbl: 'EU-Omnibus-Fristen',
    novaMarkersLbl: 'Erkannte UPF-Marker',
    watchlistBadge: 'Sperrliste'
  },
  fr: {
    dossierProfileLbl: 'Matrice 7 Profils',
    dossierHalalLbl: 'Statut Halal & 4 Autorités',
    dossierSourceLbl: 'Sources officielles',
    statusUnknown: 'Inconnu',
    altDupeSub: 'Meilleure similarité INCI (Dupe %)',
    omnibusAlertsLbl: 'Échéances EU Omnibus',
    novaMarkersLbl: 'Marqueurs UPF détectés',
    watchlistBadge: 'Liste noire'
  },
  id: {
    dossierProfileLbl: 'Matriks 7 Profil',
    dossierHalalLbl: 'Hukum Halal 4 Lembaga',
    dossierSourceLbl: 'Sumber Resmi',
    statusUnknown: 'Tidak diketahui',
    altDupeSub: 'Kemiripan Formula INCI Tertinggi (%)',
    omnibusAlertsLbl: 'Pantauan EU Omnibus',
    novaMarkersLbl: 'Penanda UPF terdeteksi',
    watchlistBadge: 'Daftar Hitam'
  },
  ms: {
    dossierProfileLbl: 'Matriks 7 Profil',
    dossierHalalLbl: 'Status Halal 4 Badan',
    dossierSourceLbl: 'Sumber Rasmi',
    statusUnknown: 'Tidak diketahui',
    altDupeSub: 'Persamaan Formula INCI Tertinggi (%)',
    omnibusAlertsLbl: 'Amaran EU Omnibus',
    novaMarkersLbl: 'Penanda UPF dikesan',
    watchlistBadge: 'Senarai Hitam'
  },
  es: {
    dossierProfileLbl: 'Matriz de 7 Perfiles',
    dossierHalalLbl: 'Dictamen Halal 4 Entidades',
    dossierSourceLbl: 'Fuentes Oficiales',
    statusUnknown: 'Desconocido',
    altDupeSub: 'Mayor similitud de fórmula INCI (%)',
    omnibusAlertsLbl: 'Plazos EU Omnibus',
    novaMarkersLbl: 'Marcadores UPF detectados',
    watchlistBadge: 'Lista negra'
  },
  ru: {
    dossierProfileLbl: 'Матрица 7 профилей',
    dossierHalalLbl: 'Халяль по 4 стандартам',
    dossierSourceLbl: 'Официальные источники',
    statusUnknown: 'Неизвестно',
    altDupeSub: 'Максимальное совпадение состава (%)',
    omnibusAlertsLbl: 'Сроки EU Omnibus',
    novaMarkersLbl: 'Обнаруженные маркеры УПП',
    watchlistBadge: 'Чёрный список'
  },
  ur: {
    dossierProfileLbl: '7 پروفائلز پر اثر',
    dossierHalalLbl: 'حلال اور 4 اداروں کی رائے',
    dossierSourceLbl: 'مصدقہ سرکاری ذرائع',
    statusUnknown: 'نامعلوم',
    altDupeSub: 'اجزاء میں سب سے زیادہ مماثلت (%)',
    omnibusAlertsLbl: 'EU اومنی بس پابندی الرٹ',
    novaMarkersLbl: 'شناخت شدہ UPF علامات',
    watchlistBadge: 'بلیک لسٹ'
  }
};

function normalizeAuthority(auth?: string): SelectableHalalAuthority {
  if (auth === 'GIMDES' || auth === 'JAKIM' || auth === 'MUI' || auth === 'IFANCA') {
    return auth;
  }
  return 'IFANCA';
}

function formatDigits(val: any, lang: string): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (lang === 'ar') {
    return s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]).replace(/%/g, '٪');
  }
  if (lang === 'ur') {
    return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]).replace(/%/g, '٪');
  }
  return s;
}

function formatPercent(val: any, lang: string): string {
  if (val === null || val === undefined) return '';
  const d = formatDigits(val, lang);
  if (lang === 'tr') return `%${d}`;
  if (lang === 'de') return `${d} %`;
  if (lang === 'ar' || lang === 'ur') return `${d}٪`;
  return `${d}%`;
}

function sanitizeHttpUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

function deduplicateShieldNames(shields: any[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sh of shields) {
    const label = String(sh?.localizedName || sh?.rawToken || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

function detectDeviceLocaleConfig(): { lang: LangCode; authority: SelectableHalalAuthority; jurisdiction: JurisdictionCode } {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const tz = (resolved.timeZone || '').toLowerCase();
    const loc = (resolved.locale || 'tr-TR').toLowerCase();
    let code: LangCode = 'tr';
    if (tz.includes('istanbul') || loc.startsWith('tr')) code = 'tr';
    else if (tz.includes('jakarta') || loc.startsWith('id')) code = 'id';
    else if (tz.includes('kuala_lumpur') || loc.startsWith('ms')) code = 'ms';
    else if (tz.includes('riyadh') || tz.includes('dubai') || loc.startsWith('ar')) code = 'ar';
    else if (tz.includes('karachi') || loc.startsWith('ur')) code = 'ur';
    else if (tz.includes('berlin') || loc.startsWith('de')) code = 'de';
    else if (tz.includes('paris') || loc.startsWith('fr')) code = 'fr';
    else if (tz.includes('madrid') || loc.startsWith('es')) code = 'es';
    else if (tz.includes('moscow') || loc.startsWith('ru')) code = 'ru';
    else if (loc.startsWith('en')) code = 'en';
    const found = SUPPORTED_LANGUAGES.find((l: any) => l.code === code) || SUPPORTED_LANGUAGES[0];
    const isUsLocale = loc.includes('-us') || loc.includes('_us') || tz.startsWith('america/');
    return {
      lang: found.code as LangCode,
      authority: normalizeAuthority(found.defaultAuthority),
      jurisdiction: found.code === 'tr' ? 'TR' : isUsLocale ? 'US' : 'EU'
    };
  } catch {
    return { lang: 'tr', authority: 'GIMDES', jurisdiction: 'TR' };
  }
}

function NavIcon({ kind, color, size = 16 }: { kind: TabId | 'moon' | 'sun' | 'reset'; color: string; size?: number }) {
  const s = size;
  if (kind === 'profile') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s * 0.4, height: s * 0.4, borderRadius: s * 0.2, borderWidth: 1.7, borderColor: color, marginBottom: 1.5 }} />
        <View style={{ width: s * 0.72, height: s * 0.34, borderTopLeftRadius: s * 0.36, borderTopRightRadius: s * 0.36, borderWidth: 1.7, borderBottomWidth: 0, borderColor: color }} />
      </View>
    );
  }
  if (kind === 'scan') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s * 0.84, height: s * 0.84, borderRadius: 4, borderWidth: 1.8, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: s * 0.52, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
      </View>
    );
  }
  if (kind === 'result') {
    return (
      <View style={{ width: s * 0.78, height: s * 0.9, borderRadius: 3, borderWidth: 1.7, borderColor: color, alignItems: 'center', justifyContent: 'center', gap: 2.5 }}>
        <View style={{ width: s * 0.42, height: 1.8, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: s * 0.42, height: 1.8, borderRadius: 1, backgroundColor: color }} />
      </View>
    );
  }
  if (kind === 'halal' || kind === 'moon') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: s * 0.76,
            height: s * 0.76,
            borderRadius: s * 0.38,
            borderLeftWidth: 2.8,
            borderBottomWidth: 2.8,
            borderTopWidth: 1,
            borderRightWidth: 0,
            borderColor: color,
            transform: [{ rotate: '28deg' }]
          }}
        />
      </View>
    );
  }
  if (kind === 'sun') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s * 0.5, height: s * 0.5, borderRadius: s * 0.25, borderWidth: 1.8, borderColor: color }} />
      </View>
    );
  }
  if (kind === 'reset') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: s * 0.72,
            height: s * 0.72,
            borderRadius: s * 0.36,
            borderWidth: 1.9,
            borderTopColor: 'transparent',
            borderLeftColor: color,
            borderRightColor: color,
            borderBottomColor: color,
            transform: [{ rotate: '-30deg' }]
          }}
        />
      </View>
    );
  }
  return (
    <View style={{ width: s, height: s, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2.5 }}>
      <View style={{ width: s * 0.3, height: s * 0.76, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
      <View style={{ width: s * 0.3, height: s * 0.54, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
    </View>
  );
}

export default function InciFactMobileApp() {
  const initialLocale = useMemo(() => detectDeviceLocaleConfig(), []);
  const systemScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(systemScheme === 'dark');
  const [regionMode, setRegionMode] = useState<'auto' | LangCode>('auto');
  const [lang, setLang] = useState<LangCode>(initialLocale.lang);
  const [activeTab, setActiveTab] = useState<TabId>('scan');
  const [productType, setProductType] = useState<ProductType>('cosmetic');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [customWatchlist, setCustomWatchlist] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState('');
  const [halalAuthority, setHalalAuthority] = useState<SelectableHalalAuthority>(initialLocale.authority);
  const [madhhab, setMadhhab] = useState<MadhhabCode>('general');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionCode>(initialLocale.jurisdiction);
  const [halalCert, setHalalCert] = useState(false);
  const [veganStatus, setVeganStatus] = useState<VeganStatus>('none');
  const [attentionOnly, setAttentionOnly] = useState(false);

  // Clean startup: no pre-scanned fake product on launch
  const [rawText, setRawText] = useState('');
  const [debouncedRawText, setDebouncedRawText] = useState('');
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [regReportModalVisible, setRegReportModalVisible] = useState(false);
  const [shareCardModalVisible, setShareCardModalVisible] = useState(false);
  const [methodologyModalVisible, setMethodologyModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [dossierModalData, setDossierModalData] = useState<any | null>(null);
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [ocrLowConfidence, setOcrLowConfidence] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [barcodeSaveMsg, setBarcodeSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [barcodeMeta, setBarcodeMeta] = useState<BarcodeLookupResult | null>(null);
  const [ocrAppType, setOcrAppType] = useState<'leave_on' | 'rinse_off' | 'spray' | null>(null);
  const [cropBeforeOcr, setCropBeforeOcr] = useState<boolean>(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [householdMembers, setHouseholdMembers] = useState<any[]>([]);
  const [routineShelf, setRoutineShelf] = useState<any[]>([]);
  const [nutritionPer100g, setNutritionPer100g] = useState<Record<string, any> | null>(null);
  const [nutritionDraftStrings, setNutritionDraftStrings] = useState<Record<string, string>>({});
  const [showNutritionInputs, setShowNutritionInputs] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [liveBarcodeEnabled, setLiveBarcodeEnabled] = useState(false);
  const [eraseStatusMsg, setEraseStatusMsg] = useState<string | null>(null);
  const [slotA, setSlotA] = useState<CompareSlotItem | null>(null);
  const [slotB, setSlotB] = useState<CompareSlotItem | null>(null);

  const isStorageHydrated = useRef(false);
  const barcodeScanLockRef = useRef(false);
  const hasActiveProduct = rawText.trim().length > 0;

  useEffect(() => {
    if (activeTab !== 'scan' || !rawText.trim()) {
      setDebouncedRawText(rawText);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedRawText(rawText);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawText, activeTab]);

  // Hydrate persisted watchlist, scan history, and user preferences on startup
  useEffect(() => {
    (async () => {
      try {
        const [parsedWatch, parsedHist, prefs, parsedHH, parsedShelf] = await Promise.all([
          readSensitiveJson<unknown>(WATCHLIST_STORAGE_KEY),
          readSensitiveJson<unknown>(HISTORY_STORAGE_KEY),
          readSensitiveJson<Record<string, any>>(USER_PREFS_STORAGE_KEY),
          readSensitiveJson<unknown>(HOUSEHOLD_STORAGE_KEY),
          readSensitiveJson<unknown>(SHELF_STORAGE_KEY)
        ]);
        if (Array.isArray(parsedHH)) {
          setHouseholdMembers(parsedHH.filter((m: any) => m && typeof m.name === 'string').slice(0, 4));
        }
        if (Array.isArray(parsedShelf)) {
          setRoutineShelf(parsedShelf.filter((s: any) => s && typeof s.rawText === 'string').slice(0, 30));
        }
        if (Array.isArray(parsedWatch)) {
          const validTerms = parsedWatch.filter(
            (w): w is string => typeof w === 'string' && w.trim().length > 0
          );
          setCustomWatchlist((prev) => Array.from(new Set([...validTerms, ...prev])).slice(0, 50));
        }
        if (Array.isArray(parsedHist)) {
          setScanHistory((prev) => {
            const merged: ScanHistoryEntry[] = [];
            const seenKeys = new Set<string>();
            for (const h of [...prev, ...(parsedHist as ScanHistoryEntry[])]) {
              if (!h || typeof h.rawText !== 'string' || !h.rawText.trim()) continue;
              const key = `${h.rawText}::${h.productType || 'cosmetic'}::${h.jurisdiction || 'EU'}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(h);
              }
            }
            return merged.slice(0, 10);
          });
        }
        if (prefs && typeof prefs === 'object') {
          if (typeof prefs.darkMode === 'boolean') setDarkMode(prefs.darkMode);
          if (typeof prefs.regionMode === 'string') setRegionMode(prefs.regionMode as 'auto' | LangCode);
          if (typeof prefs.lang === 'string' && SUPPORTED_LANGUAGES.some((l: any) => l.code === prefs.lang)) {
            setLang(prefs.lang as LangCode);
          }
          if (Array.isArray(prefs.selectedProfiles)) {
            setSelectedProfiles(prefs.selectedProfiles.filter((x: unknown): x is string => typeof x === 'string'));
          }
          if (typeof prefs.halalAuthority === 'string') {
            setHalalAuthority(normalizeAuthority(prefs.halalAuthority));
          }
          if (typeof prefs.madhhab === 'string' && MADHHABS.includes(prefs.madhhab as MadhhabCode)) {
            setMadhhab(prefs.madhhab as MadhhabCode);
          }
          if (prefs.jurisdiction === 'TR' || prefs.jurisdiction === 'EU' || prefs.jurisdiction === 'US') {
            setJurisdiction(prefs.jurisdiction);
          }
          if (typeof prefs.consentAccepted === 'boolean') {
            setConsentAccepted(prefs.consentAccepted);
          }
          if (typeof prefs.liveBarcodeEnabled === 'boolean') {
            setLiveBarcodeEnabled(prefs.liveBarcodeEnabled);
          }
        }
      } catch {
        // Ignore storage read errors
      } finally {
        isStorageHydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    writeSensitiveJson(WATCHLIST_STORAGE_KEY, customWatchlist).catch(() => {});
  }, [customWatchlist]);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    writeSensitiveJson(HISTORY_STORAGE_KEY, scanHistory).catch(() => {});
  }, [scanHistory]);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    writeSensitiveJson(HOUSEHOLD_STORAGE_KEY, householdMembers).catch(() => {});
  }, [householdMembers]);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    writeSensitiveJson(SHELF_STORAGE_KEY, routineShelf).catch(() => {});
  }, [routineShelf]);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    writeSensitiveJson(USER_PREFS_STORAGE_KEY, {
      darkMode,
      regionMode,
      lang,
      selectedProfiles,
      halalAuthority,
      madhhab,
      jurisdiction,
      consentAccepted,
      liveBarcodeEnabled
    }).catch(() => {});
  }, [darkMode, regionMode, lang, selectedProfiles, halalAuthority, madhhab, jurisdiction, consentAccepted, liveBarcodeEnabled]);

  const langMeta = useMemo(
    () => SUPPORTED_LANGUAGES.find((l: any) => l.code === lang) || SUPPORTED_LANGUAGES[0],
    [lang]
  );
  const isRtl = langMeta.dir === 'rtl';
  const t = useMemo(() => getLocaleStrings(lang), [lang]);
  const ft = useMemo(() => MOBILE_FEAT_I18N[lang] || MOBILE_FEAT_I18N.en, [lang]);
  const xt = useMemo(() => EXTRA_MOBILE_I18N[lang] || EXTRA_MOBILE_I18N.en, [lang]);
  const at = useMemo(() => MOBILE_A11Y_I18N[lang] || MOBILE_A11Y_I18N.en, [lang]);
  const pt1 = useMemo(() => PHASE1_MOBILE_I18N[lang] || PHASE1_MOBILE_I18N.en, [lang]);
  const p34 = useMemo(() => PHASE34_MOBILE_I18N[lang] || PHASE34_MOBILE_I18N.en, [lang]);
  const mb = useMemo(() => MOBILE_BOOST_I18N[lang] || MOBILE_BOOST_I18N.en, [lang]);

  const applyNutritionObject = (obj: Record<string, any> | null) => {
    setNutritionPer100g(obj);
    if (!obj || typeof obj !== 'object') {
      setNutritionDraftStrings({});
      return;
    }
    const drafts: Record<string, string> = {};
    for (const k of ['energyKcal', 'sugarsG', 'saturatedFatG', 'saltG', 'fiberG', 'proteinG']) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        drafts[k] = String(obj[k]);
      }
    }
    if (!drafts.energyKcal && typeof obj.energyKj === 'number' && Number.isFinite(obj.energyKj)) {
      drafts.energyKcal = String(Math.round(obj.energyKj / 4.184));
    }
    if (!drafts.saltG && typeof obj.sodiumMg === 'number' && Number.isFinite(obj.sodiumMg)) {
      drafts.saltG = String(Number(((obj.sodiumMg * 2.5) / 1000).toFixed(2)));
    }
    setNutritionDraftStrings(drafts);
  };

  const handleEraseAllLocalData = async () => {
    await clearAllSensitiveStorage([
      USER_PREFS_STORAGE_KEY,
      WATCHLIST_STORAGE_KEY,
      HISTORY_STORAGE_KEY,
      BARCODE_CACHE_KEY,
      CUSTOM_BARCODES_STORAGE_KEY,
      HOUSEHOLD_STORAGE_KEY,
      SHELF_STORAGE_KEY
    ]);
    setCustomWatchlist([]);
    setScanHistory([]);
    setHouseholdMembers([]);
    setRoutineShelf([]);
    applyNutritionObject(null);
    setShowNutritionInputs(false);
    setSelectedProfiles([]);
    setMadhhab('general');
    setOcrLowConfidence(false);
    setConsentAccepted(false);
    setLiveBarcodeEnabled(false);
    setConfirmations({});
    setBarcodeMeta(null);
    setBarcodeSaveMsg(null);
    setCustomProductName('');
    setBarcodeInput('');
    setRawText('');
    setDebouncedRawText('');
    setOcrStatusMsg(null);
    setSlotA(null);
    setSlotB(null);
    setEraseStatusMsg(pt1.eraseDoneMsg);
  };

  const applyRegionStructure = (mode: 'auto' | LangCode) => {
    setRegionMode(mode);
    const targetCode = mode === 'auto' ? initialLocale.lang : mode;
    setLang(targetCode);
    setJurisdiction(mode === 'auto' ? initialLocale.jurisdiction : targetCode === 'tr' ? 'TR' : 'EU');
    const targetMeta = SUPPORTED_LANGUAGES.find((l: any) => l.code === targetCode);
    setHalalAuthority(normalizeAuthority(targetMeta?.defaultAuthority));
  };

  // Live deterministic evaluation ONLY when a product ingredient text exists (debounced while typing on scan tab)
  const effectiveFoodNutrition = useMemo(() => {
    if (productType !== 'food') return null;
    if (nutritionPer100g) return nutritionPer100g;
    if (
      Object.keys(nutritionDraftStrings).length === 0 &&
      debouncedRawText &&
      /100\s*(?:g|gr|ml|г|غ|мл|مل)/iu.test(debouncedRawText)
    ) {
      return extractSmartLabelContext(debouncedRawText).detectedNutritionPer100g || null;
    }
    return null;
  }, [productType, nutritionPer100g, nutritionDraftStrings, debouncedRawText]);

  const evalMain = useMemo(() => {
    if (!debouncedRawText.trim()) return null;
    return evaluateProduct({
      rawText: debouncedRawText,
      productType,
      applicationType: barcodeMeta?.applicationType || ocrAppType || undefined,
      allergenStatement: barcodeMeta?.allergenStatement || '',
      jurisdiction,
      userProfiles: selectedProfiles,
      customWatchlist,
      halalAuthority,
      madhhab,
      claims: {
        halalCertified: halalCert,
        veganStatus,
        vegetarianStatus: 'none'
      },
      userConfirmations: confirmations,
      nutritionPer100g: effectiveFoodNutrition,
      lang
    });
  }, [debouncedRawText, productType, barcodeMeta, ocrAppType, jurisdiction, selectedProfiles, customWatchlist, halalAuthority, madhhab, halalCert, veganStatus, confirmations, effectiveFoodNutrition, lang]);

  const comparison = useMemo(() => {
    if (!slotA || !slotB) return null;
    return compareProducts(slotA, slotB, {
      jurisdiction,
      userProfiles: selectedProfiles,
      customWatchlist,
      halalAuthority,
      madhhab,
      lang
    });
  }, [slotA, slotB, jurisdiction, selectedProfiles, customWatchlist, halalAuthority, madhhab, lang]);

  const householdEval = useMemo(() => {
    if (!debouncedRawText.trim() || householdMembers.length === 0) return null;
    return evaluateHouseholdProfiles(
      {
        rawText: debouncedRawText,
        productType,
        applicationType: barcodeMeta?.applicationType || ocrAppType || undefined,
        allergenStatement: barcodeMeta?.allergenStatement || '',
        jurisdiction,
        halalAuthority,
        madhhab,
        claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' },
        lang
      },
      householdMembers
    );
  }, [householdMembers, debouncedRawText, productType, barcodeMeta, ocrAppType, jurisdiction, halalAuthority, madhhab, halalCert, veganStatus, lang]);

  const shelfEval = useMemo(() => {
    if (routineShelf.length === 0) return null;
    return evaluateRoutineShelf(routineShelf, { lang, jurisdiction, halalAuthority, madhhab });
  }, [routineShelf, lang, jurisdiction, halalAuthority, madhhab]);

  const alternativesData = useMemo(() => {
    if (!debouncedRawText.trim()) return null;
    const extraCatalog = routineShelf.map((s: any) => ({
      name: s.name,
      productType: s.productType,
      applicationType: s.applicationType,
      rawText: s.rawText
    }));
    return findCleanerAlternativesAndDupes(
      {
        rawText: debouncedRawText,
        productType,
        applicationType: barcodeMeta?.applicationType || ocrAppType || undefined,
        allergenStatement: barcodeMeta?.allergenStatement || '',
        jurisdiction,
        userProfiles: selectedProfiles,
        customWatchlist,
        halalAuthority,
        madhhab,
        claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' },
        userConfirmations: confirmations,
        lang
      },
      {
        lang,
        jurisdiction,
        halalAuthority,
        madhhab,
        userProfiles: selectedProfiles,
        customWatchlist,
        barcode: barcodeMeta?.barcode || '',
        extraCatalog
      }
    );
  }, [debouncedRawText, productType, barcodeMeta, ocrAppType, halalCert, veganStatus, confirmations, routineShelf, lang, jurisdiction, halalAuthority, madhhab, selectedProfiles, customWatchlist]);

  const theme = useMemo(
    () =>
      darkMode
        ? {
            bg: '#091410',
            card: '#11221B',
            subtle: '#183026',
            text: '#F3EFE6',
            muted: '#A4B5AC',
            border: '#254739',
            borderStrong: '#34604E',
            accent: '#2FA877',
            accentDeep: '#34C38B',
            onAccent: '#07120E',
            accentSoft: '#0D3526',
            gold: '#D9B972',
            danger: '#FCA5A5',
            dangerBg: '#3D1418',
            warning: '#FBBF24',
            warningBg: '#3A270B',
            success: '#6EE7B7',
            successBg: '#0D3526',
            info: '#93C5FD',
            infoBg: '#172554'
          }
        : {
            bg: '#F2F0EB',
            card: '#FFFFFF',
            subtle: '#EDEBE9',
            text: '#14261D',
            muted: '#52615A',
            border: '#E2DED6',
            borderStrong: '#C9C3B8',
            accent: '#00754A',
            accentDeep: '#006241',
            onAccent: '#FFFFFF',
            accentSoft: '#E4F3EC',
            gold: '#CBA258',
            danger: '#B42318',
            dangerBg: '#FDEAEA',
            warning: '#8A5300',
            warningBg: '#FEF4DB',
            success: '#0F5132',
            successBg: '#E4F3EC',
            info: '#1E3A8A',
            infoBg: '#EFF6FF'
          },
    [darkMode]
  );

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? theme.accent : theme.subtle,
    borderColor: active ? theme.accent : theme.border,
    borderWidth: active ? 1.5 : 1,
    borderRadius: 9999
  });
  const chipTextStyle = (active: boolean) => ({
    color: active ? theme.onAccent : theme.text,
    fontWeight: '800' as const
  });

  const clearCurrentScan = () => {
    setRawText('');
    setDebouncedRawText('');
    setBarcodeInput('');
    setCustomProductName('');
    setBarcodeMeta(null);
    setOcrAppType(null);
    setBarcodeSaveMsg(null);
    setConfirmations({});
    setOcrStatusMsg(null);
    applyNutritionObject(null);
    setAttentionOnly(false);
    setActiveTab('scan');
  };

  const addWatchTerm = (term?: string) => {
    const val = (term ?? watchInput).trim();
    if (val.length < 2 || customWatchlist.length >= 50) return;
    if (!customWatchlist.some((w) => w.toLowerCase() === val.toLowerCase())) {
      setCustomWatchlist([...customWatchlist, val].slice(0, 50));
    }
    setWatchInput('');
  };

  const removeWatchTerm = (term: string) => {
    setCustomWatchlist(customWatchlist.filter((w) => w !== term));
  };

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const addHouseholdMemberPreset = (preset: 'preg' | 'baby' | 'fungal') => {
    if (householdMembers.length >= 4) return;
    const item =
      preset === 'preg'
        ? { id: `hh_preg_${Date.now()}`, name: p34.householdAddPreg.replace(/^\+\s*/, ''), userProfiles: ['hamilelik', 'hassas_cilt'], halalAuthority, madhhab }
        : preset === 'baby'
        ? { id: `hh_baby_${Date.now()}`, name: p34.householdAddBaby.replace(/^\+\s*/, ''), userProfiles: ['cocuk_metabolik', 'egzama_rosacea', 'hassas_cilt'], halalAuthority, madhhab }
        : { id: `hh_fungal_${Date.now()}`, name: p34.householdAddFungal.replace(/^\+\s*/, ''), userProfiles: ['fungal_acne', 'akne'], halalAuthority: 'IFANCA', madhhab: 'hanafi' };
    setHouseholdMembers((prev) => [...prev, item].slice(0, 4));
  };

  const removeHouseholdMember = (idx: number) => {
    setHouseholdMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveCurrentToRoutineShelf = (slot: 'AM' | 'PM' | 'Pantry') => {
    const cleanRaw = debouncedRawText.trim() || rawText.trim();
    if (!cleanRaw || !evalMain) return;
    const title = (barcodeMeta?.productName || customProductName.trim() || xt.demoNames[0] || 'Saved').slice(0, 80);
    const entry = {
      id: `sh_${Date.now()}`,
      name: title,
      slot,
      productType,
      applicationType: evalMain.applicationType || null,
      rawText: cleanRaw,
      ts: Date.now()
    };
    setRoutineShelf((prev) => [entry, ...prev.filter((x: any) => !(x.slot === slot && x.rawText === cleanRaw))].slice(0, 30));
    setActiveTab('compare');
  };

  const removeShelfItem = (id: string) => {
    setRoutineShelf((prev) => prev.filter((x: any) => x.id !== id));
  };

  const openIngredientDossier = (findingOrRaw: any) => {
    const rawStr = typeof findingOrRaw === 'string' ? findingOrRaw : (findingOrRaw?.rawToken || findingOrRaw?.raw || findingOrRaw?.name || '');
    if (!rawStr) return;
    const matchedObs = (evalMain?.observations || []).find(
      (o: any) => o && (o.raw === rawStr || (findingOrRaw?.position && o.position === findingOrRaw.position))
    );
    const d = getIngredientDossier(matchedObs || rawStr, {
      productType,
      applicationType: evalMain?.applicationType || barcodeMeta?.applicationType || ocrAppType || undefined,
      customWatchlist,
      lang,
      jurisdiction,
      halalAuthority,
      madhhab,
      userProfiles: selectedProfiles,
      claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' }
    });
    setDossierModalData(d);
  };

  const handleShareManufacturerInquiry = async () => {
    const pName = barcodeMeta?.productName || customProductName.trim() || (productType === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood);
    const msg = p34.askMfrMsg(pName, halalAuthority);
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const getHalalBadgeLabel = (st: string) => {
    if (st === 'yesil') return `🟢 ${t.badges.halalOk}`;
    if (st === 'kirmizi') return `🔴 ${t.badges.halalRed}`;
    if (st === 'conflict') return `⚠️ ${t.badges.conflict || t.badges.halalRed}`;
    if (st === 'unknown' || st === 'bilinmiyor') return `⚪ ${mb.statusUnknown}`;
    return `🟡 ${t.badges.musbooh}`;
  };

  const formatHalalSummaryStatus = () => {
    if (!evalMain) return `🟡 ${t.badges.musbooh}`;
    const halal = evalMain.cards.halalCard;
    const covPct = evalMain.cards.regulatoryCard.coveragePercent;
    if (halal.overallStatus === 'uygunsuz_bulgu' || halal.overallStatus === 'conflict') {
      return `🔴 ${t.badges.halalRed}`;
    }
    if ((evalMain.unresolvedConfirmations || []).length > 0 || halal.overallStatus === 'unknown') {
      return `🟡 ${ft.pendingOcr}`;
    }
    if (halal.overallStatus === 'kapsam_yetersiz' || covPct < 80) {
      return `🟡 ${ft.lowCoverage}`;
    }
    if (halal.overallStatus === 'uygun_gorunuyor') return `🟢 ${t.badges.halalOk}`;
    return `🟡 ${t.badges.musbooh}`;
  };

  const handleShareResultCard = async () => {
    if (!evalMain) return;
    const reg = evalMain.cards.regulatoryCard;
    const halal = evalMain.cards.halalCard;
    const nutri = evalMain.cards.nutriScoreCard;
    const nova = evalMain.cards.novaCard;
    const scoreTxt = reg.canShowScore
      ? `${formatDigits(reg.score, lang)}/${formatDigits(100, lang)}`
      : `— (${formatPercent(reg.coveragePercent, lang)})`;
    const foodParts: string[] = [];
    if (nutri?.available && nutri.grade) foodParts.push(`Nutri-Score ${nutri.grade}`);
    if (nova?.applicable && nova.group) foodParts.push(`NOVA ${formatDigits(nova.group, lang)}`);
    const foodLine = foodParts.length > 0 ? `\n🥗 ${foodParts.join(' · ')}` : '';
    const msg = `🛡️ INCIFACT (${jurisdiction}) — ${t.resultScreen.scoreLabel}: ${scoreTxt}${foodLine}\n🌙 ${t.resultScreen.halalSummaryLabel} (${halal.selectedAuthority}): ${formatHalalSummaryStatus()}\n⚖️ ${t.halalScreen.legalDisclaimerMicro || ''}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const handleShareRegulatoryReport = async () => {
    if (!evalMain?.cards?.regulatoryReportCard) return;
    const rr = evalMain.cards.regulatoryReportCard;
    const lines = [
      `📄 INCIFACT — ${rr.cardTitle}`,
      `${rr.datasetManifest?.activeJurisdiction || jurisdiction} · ${rr.datasetManifest?.selectedHalalAuthority || halalAuthority} · v${rr.datasetManifest?.datasetVersion || ''}`,
      '',
      `=== ${rr.freshnessTitle} ===`,
      ...(rr.freshnessPillars || []).map((p: any, i: number) => `${i + 1}. ${p.title}: ${p.detail}`),
      '',
      `=== ${rr.transitionCalendarTitle} ===`,
      ...((rr.transitionCalendarItems || []).length > 0
        ? rr.transitionCalendarItems.map((item: any) => `• ${item.name}: ${item.regulation} (${item.deadline}) — ${item.status}`)
        : [rr.noTransitionItems]),
      '',
      `=== ${rr.allergenSectionTitle} ===`,
      ...((rr.detectedAllergens || []).length > 0
        ? rr.detectedAllergens.map((a: any) => `• ${a.name} (${a.category} · ${a.regulation})`)
        : [rr.noAllergensFound]),
      '',
      `=== ${rr.officialSourcesTitle} ===`,
      ...(rr.citedOfficialSources || []).map((s: any) => {
        const safeUrl = sanitizeHttpUrl(s?.url);
        return `• [${s.id}] ${s.title}${safeUrl ? ` — ${safeUrl}` : ''}`;
      })
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  const handleOpenExternalUrl = async (rawUrl: unknown) => {
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (!safeUrl) return;
    const linking = (
      ReactNative as {
        Linking?: {
          canOpenURL?: (url: string) => Promise<boolean>;
          openURL?: (url: string) => Promise<any>;
        };
      }
    ).Linking;
    if (!linking || typeof linking.canOpenURL !== 'function' || typeof linking.openURL !== 'function') {
      return;
    }
    try {
      const supported = await linking.canOpenURL(safeUrl);
      if (supported) {
        await linking.openURL(safeUrl);
      }
    } catch {}
  };

  const recordScanToHistory = (
    customLabel?: string,
    overrideText?: string,
    overrideType?: ProductType,
    overrideScore?: number | null,
    overrideNutrition?: Record<string, any> | null
  ): ScanHistoryEntry | null => {
    const effectiveRaw = (overrideText !== undefined ? overrideText : rawText).trim();
    if (!effectiveRaw) return null;
    const effectiveType = overrideType || productType;
    const allTokens = effectiveRaw
      .replace(/^[\s\S]*?(?:ingredients|içindekiler)\s*:\s*/i, '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const nonBase = allTokens.filter((tk) => !/^(aqua|water|eau|wasser|agua|su|glycerin|glycerine|gliserin)$/i.test(tk));
    const chosenTokens = (nonBase.length > 0 ? nonBase : allTokens).slice(0, 2).join(', ');
    const derivedName =
      customLabel ||
      customProductName.trim() ||
      (chosenTokens ? `${ft.customScanPrefix}: ${chosenTokens}` : ft.scannedLabel('1'));
    const computedScore =
      overrideScore !== undefined
        ? overrideScore
        : overrideText !== undefined
        ? evaluateProduct({ rawText: effectiveRaw, productType: effectiveType, jurisdiction, lang }).cards.regulatoryCard.score
        : evalMain?.cards?.regulatoryCard?.score ?? null;
    const resolvedNutrition =
      effectiveType !== 'food'
        ? null
        : overrideNutrition !== undefined
        ? overrideNutrition
        : overrideText === undefined
        ? effectiveFoodNutrition
        : null;
    const entry: ScanHistoryEntry = {
      name: derivedName,
      rawText: effectiveRaw,
      productType: effectiveType,
      jurisdiction,
      nutritionPer100g: resolvedNutrition,
      claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' },
      userConfirmations: overrideText !== undefined ? {} : { ...confirmations },
      score: computedScore
    };
    setScanHistory((prev) =>
      [
        entry,
        ...prev.filter(
          (p) =>
            !(
              p.rawText === effectiveRaw &&
              p.productType === effectiveType &&
              (p.jurisdiction || 'EU') === jurisdiction
            )
        )
      ].slice(0, 10)
    );
    return entry;
  };

  const assignCurrentToCompare = (slot: 'A' | 'B') => {
    if (!hasActiveProduct) return;
    const labelName = barcodeMeta?.productName || customProductName.trim() || ft.scannedLabel(slot);
    const entry = recordScanToHistory(labelName);
    if (!entry) return;
    if (slot === 'A') {
      setSlotA(entry);
    } else {
      setSlotB(entry);
    }
    setActiveTab('compare');
  };

  const openBarcodeCamera = async () => {
    try {
      const perm = await Camera.requestCameraPermissionsAsync();
      if (!perm || perm.granted !== true) {
        setOcrStatusMsg(`⚠️ ${xt.ocrPermissionErr}`);
        return;
      }
      barcodeScanLockRef.current = false;
      setTorchOn(false);
      setBarcodeScannerVisible(true);
    } catch (err: any) {
      setOcrStatusMsg(`⚠️ ${err?.message || xt.ocrPermissionErr}`);
    }
  };

  const handleBarcodeLookup = async (codeOverride?: string) => {
    const targetCode = (codeOverride !== undefined ? codeOverride : barcodeInput).trim();
    if (!targetCode) {
      await openBarcodeCamera();
      return;
    }
    setBarcodeInput(targetCode);
    setBarcodeSaveMsg(null);
    setOcrAppType(null);
    setOcrStatusMsg(null);
    setIsLookingUpBarcode(true);
    try {
      const res = await lookupBarcodeOnDevice(
        targetCode,
        lang,
        {
          jurisdiction,
          productType,
          userProfiles: selectedProfiles,
          customWatchlist,
          halalAuthority,
          madhhab,
          claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' }
        },
        { enableLiveLookup: liveBarcodeEnabled }
      );
      setBarcodeMeta(res);
      if (res.found && res.rawText) {
        const nextType: ProductType = res.productType || productType;
        if (res.productType) setProductType(res.productType);
        if (res.productName) setCustomProductName(res.productName);
        applyNutritionObject(res.nutritionPer100g || null);
        setRawText(res.rawText);
        setDebouncedRawText(res.rawText);
        setConfirmations({});
        setOcrStatusMsg(null);
        recordScanToHistory(
          res.productName,
          res.rawText,
          nextType,
          res.evaluation?.cards?.regulatoryCard?.score ?? null,
          nextType === 'food' ? (res.nutritionPer100g || null) : null
        );
        if (!res.requiresOcrFallback) {
          setActiveTab('result');
        }
      } else if (!res.found && res.productName) {
        setCustomProductName(res.productName);
      }
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleSaveCustomBarcode = async () => {
    if (!evalMain) {
      setBarcodeSaveMsg({ ok: false, text: xt.saveBarcodeLowCov });
      return;
    }
    const cov = evalMain.cards.regulatoryCard.coveragePercent;
    if (cov < 80 || (evalMain.unresolvedConfirmations || []).length > 0) {
      setBarcodeSaveMsg({ ok: false, text: xt.saveBarcodeLowCov });
      return;
    }
    const saved = await saveCustomBarcodeOnDevice({
      barcode: barcodeInput.trim(),
      productName: customProductName.trim() || undefined,
      productType,
      applicationType: barcodeMeta?.applicationType || ocrAppType || (productType === 'food' ? 'oral' : 'leave_on'),
      allergenStatement: barcodeMeta?.allergenStatement || '',
      rawText,
      lang
    });
    if (saved && saved.ok) {
      setBarcodeSaveMsg({ ok: true, text: xt.saveBarcodeOk(saved.barcode) });
    } else {
      setBarcodeSaveMsg({ ok: false, text: xt.saveBarcodeLowCov });
    }
  };

  const handleCameraScan = async (mode: 'camera' | 'gallery', forceCrop?: boolean) => {
    setIsProcessingOcr(true);
    setBarcodeSaveMsg(null);
    try {
      const res = await captureAndRecognizeLabel(mode, { allowsEditing: forceCrop ?? cropBeforeOcr, lang });
      if (!res || typeof res !== 'object') {
        setOcrStatusMsg(`⚠️ ${xt.ocrEmptyErr}`);
        return;
      }
      const extracted = typeof res.extractedText === 'string' ? res.extractedText.trim() : '';
      if (!res.cancelled && extracted.length > 0) {
        const effectiveType: ProductType = res.detectedProductType || productType;
        if (res.detectedProductType) {
          setProductType(res.detectedProductType);
        }
        setOcrAppType(effectiveType === 'cosmetic' ? (res.detectedApplicationType || null) : null);
        if (res.detectedBarcode && !barcodeInput.trim()) {
          setBarcodeInput(res.detectedBarcode);
        }
        if (res.detectedVeganClaim === 'declared' && veganStatus === 'none') {
          setVeganStatus('declared');
        }
        setBarcodeMeta(null);
        applyNutritionObject(effectiveType === 'food' ? (res.detectedNutritionPer100g || null) : null);
        setRawText(extracted);
        setDebouncedRawText(extracted);
        setConfirmations({});
        if (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) {
          const isLowConf = res.confidence < 0.65;
          setOcrLowConfidence(isLowConf);
          setOcrStatusMsg(
            isLowConf
              ? `⚠️ OCR (${formatPercent(Math.round(res.confidence * 100), lang)}) — ${p34.lowConfWarn}`
              : `✓ OCR (${formatPercent(Math.round(res.confidence * 100), lang)})`
          );
        } else {
          setOcrLowConfidence(false);
          setOcrStatusMsg('✓ OCR OK');
        }
        recordScanToHistory(
          customProductName.trim() || undefined,
          extracted,
          effectiveType,
          undefined,
          effectiveType === 'food' ? (res.detectedNutritionPer100g || null) : null
        );
        setActiveTab('result');
      } else if (res.error === 'PERMISSION_DENIED') {
        setOcrStatusMsg(`⚠️ ${xt.ocrPermissionErr}`);
      } else if (res.error === 'EMPTY_OCR_TEXT') {
        setOcrStatusMsg(`⚠️ ${xt.ocrEmptyErr}`);
      } else if (res.error === 'NO_NATIVE_OCR') {
        setOcrStatusMsg(`⚠️ ${xt.ocrNoNativeErr}`);
      } else if (res.error === 'OCR_SCRIPT_MODEL_MISSING') {
        setOcrStatusMsg(`⚠️ ${p34.ocrModelMissing}`);
      } else if (typeof res.error === 'string' && res.error.trim().length > 0) {
        setOcrStatusMsg(`⚠️ ${res.error}`);
      }
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const loadQuickDemoSample = (idx: 0 | 1 | 2) => {
    const samples: { name: string; type: ProductType; text: string }[] = [
      {
        name: xt.demoNames[0],
        type: 'cosmetic',
        text: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Niacinamide, Panthenol, Ceramide NP, Phenoxyethanol, Tocopherol, Limonene'
      },
      {
        name: xt.demoNames[1],
        type: 'food',
        text: 'İçindekiler: Su, Şeker, Sitrik Asit, Gelatin, Carmine (E120), Lecithin (E322)'
      },
      {
        name: xt.demoNames[2],
        type: 'cosmetic',
        text: 'Aqua / Water, Glycerin, Dimethicone, Alcohol Denat., Butyrospermum Parkii Butter / Shea Butter, Phenoxyethanol, Cetyl Alcohol, Adenosine, Citric Acid, Sodium Stearate, Mica, CI 77891 / Titanium Dioxide'
      }
    ];
    const picked = samples[idx];
    setBarcodeMeta(null);
    setOcrAppType(null);
    setBarcodeInput('');
    setBarcodeSaveMsg(null);
    applyNutritionObject(null);
    setCustomProductName(picked.name);
    setProductType(picked.type);
    setConfirmations({});
    setRawText(picked.text);
    setDebouncedRawText(picked.text);
    setOcrStatusMsg(xt.demoLoadedMsg(picked.name));
  };

  const loadAuthorityDiffDemo = () => {
    setBarcodeMeta(null);
    setOcrAppType(null);
    setBarcodeInput('');
    setBarcodeSaveMsg(null);
    applyNutritionObject(null);
    setCustomProductName('Carmine E120 & Snail Mucin');
    setProductType('cosmetic');
    setConfirmations({});
    const demoText = 'Ingredients: Aqua, Snail Secretion Filtrate, Glycerin, Carmine (CI 75470 / E120), Shellac, Alcohol Denat., Panthenol';
    setRawText(demoText);
    setDebouncedRawText(demoText);
    setOcrStatusMsg(null);
  };

  const loadCompareDemo = () => {
    setSlotA({
      name: 'CeraVe Moisturizer',
      productType: 'cosmetic',
      rawText:
        'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceramide NP, Sodium Hyaluronate, Phenoxyethanol, Tocopherol'
    });
    setSlotB({
      name: 'Sample Cleanser B',
      productType: 'cosmetic',
      rawText:
        'Ingredients: Aqua, Glycerin, Isopropyl Myristate, Cetearyl Alcohol, Propylparaben, Butylphenyl Methylpropional, Methylisothiazolinone, Parfum, Linalool'
    });
  };

  const unresolvedConfirmations = evalMain?.unresolvedConfirmations || [];
  const regulatoryFindings: any[] = evalMain?.cards?.regulatoryCard?.findings || [];
  const attentionFindings: any[] = regulatoryFindings.filter(
    (f: any) =>
      f &&
      (f.euStatus === 'yasak' ||
        f.euStatus === 'kisitli' ||
        f.euStatus === 'alerjen_etiket' ||
        f.status === 'yasak' ||
        f.effectiveStatus === 'yasak' ||
        (typeof f.severity === 'string' && f.severity !== 'bilgi'))
  );
  const displayedRegulatoryFindings = attentionOnly ? attentionFindings : regulatoryFindings;
  const profileAlerts: any[] = evalMain?.cards?.profileCard?.alerts || [];
  const dedupedShieldNames = useMemo(
    () => deduplicateShieldNames(evalMain?.cards?.halalCard?.falsePositiveShields || []),
    [evalMain]
  );
  const activeAuthorityInfo = useMemo(
    () => xt.methodologyItems[Math.max(0, AUTHORITIES.indexOf(halalAuthority))] || xt.methodologyItems[0],
    [xt, halalAuthority]
  );

  const rtlTextStyle = {
    textAlign: (isRtl ? 'right' : 'left') as 'right' | 'left',
    writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr'
  };

  const renderAuthorityChipsRow = () => (
    <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {AUTHORITIES.map((auth) => {
        const active = halalAuthority === auth;
        return (
          <TouchableOpacity
            key={auth}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.halalScreen.authoritySelectLabel} ${auth}`}
            onPress={() => setHalalAuthority(auth)}
            style={[styles.chip, chipStyle(active)]}
          >
            <Text style={[{ fontSize: 12.5 }, chipTextStyle(active)]}>
              {active ? `✓ ${auth}` : `○ ${auth}`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const tabsMeta: [TabId, string][] = [
    ['profile', t.tabs.profile.replace(/^[0-9١-٥۱-۵]+\.\s*/, '')],
    ['result', t.tabs.result.replace(/^[0-9١-٥۱-۵]+\.\s*/, '')],
    ['scan', t.tabs.scan.replace(/^[0-9١-٥۱-۵]+\.\s*/, '')],
    ['halal', t.tabs.halal.replace(/^[0-9١-٥۱-۵]+\.\s*/, '')],
    ['compare', t.tabs.compare.replace(/^[0-9١-٥۱-۵]+\.\s*/, '')]
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.card} translucent={false} />

      {/* Top Bar — Zero Clipping on LTR & RTL */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border, flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="InciFact"
          onPress={() => setActiveTab('scan')}
          style={{ flex: 1, minWidth: 0, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 9 }}
        >
          <Image
            source={APP_ICON}
            style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: theme.gold }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.brandTitle, { color: theme.text }, rtlTextStyle]}>
              InciFact
            </Text>
            <Text numberOfLines={1} style={[styles.brandSub, { color: theme.muted }, rtlTextStyle]}>
              {t.appTagline}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexShrink: 0, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={at.settingsBtn}
            onPress={() => setActiveTab('profile')}
            style={[
              styles.topActionPill,
              { backgroundColor: theme.subtle, borderColor: theme.border }
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>
              {langMeta.flag} {lang.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={darkMode ? at.themeToLight : at.themeToDark}
            onPress={() => setDarkMode(!darkMode)}
            style={[
              styles.topIconSquare,
              { backgroundColor: theme.subtle, borderColor: theme.border }
            ]}
          >
            <NavIcon kind={darkMode ? 'sun' : 'moon'} color={theme.text} size={17} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={xt.newScanReset}
            onPress={clearCurrentScan}
            style={[
              styles.topIconSquare,
              {
                backgroundColor: hasActiveProduct ? theme.accent : theme.subtle,
                borderColor: hasActiveProduct ? theme.accent : theme.border
              }
            ]}
          >
            <NavIcon kind="reset" color={hasActiveProduct ? theme.onAccent : theme.text} size={17} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* SCREEN 1: PROFILE & SETTINGS */}
          {activeTab === 'profile' && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
                {t.profileScreen.title}
              </Text>
              <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
                {t.profileScreen.subtitle}
              </Text>

              {(['hamilelik', 'cocuk_metabolik', 'hassas_cilt', 'astim_alerji', 'akne', 'fungal_acne', 'egzama_rosacea'] as const).map((pid) => {
              const active = selectedProfiles.includes(pid);
              const profText = t.profileScreen.profiles[pid];
              return (
                <TouchableOpacity
                  key={pid}
                  activeOpacity={0.82}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={profText.name}
                  onPress={() => toggleProfile(pid)}
                  style={[
                    styles.profileRow,
                    {
                      backgroundColor: active ? theme.accentSoft : theme.subtle,
                      borderColor: active ? theme.accent : theme.border,
                      borderWidth: active ? 1.5 : 1,
                      flexDirection: isRtl ? 'row-reverse' : 'row'
                    }
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: isRtl ? 0 : 8, paddingLeft: isRtl ? 8 : 0 }}>
                    <Text style={[styles.profileName, { color: theme.text }, rtlTextStyle]}>
                      {profText.name}
                    </Text>
                    <Text style={[styles.profileDesc, { color: theme.muted }, rtlTextStyle]}>
                      {profText.desc}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: active ? theme.accent : theme.card,
                      borderWidth: 1,
                      borderColor: active ? theme.accent : theme.border,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontWeight: '900', fontSize: 13, color: active ? theme.onAccent : theme.muted }}>
                      {active ? '✓' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Personal Custom Watchlist */}
            <View
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.subtle,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text, flex: 1 }, rtlTextStyle]}>
                  {ft.watchlistTitle}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.muted, fontVariant: ['tabular-nums'] }}>
                  {formatDigits(customWatchlist.length, lang)}/{formatDigits(50, lang)}
                </Text>
              </View>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, marginTop: 4 }}>
                <TextInput
                  accessibilityLabel={ft.watchlistTitle}
                  value={watchInput}
                  onChangeText={setWatchInput}
                  placeholder="Niacinamide, Parfum, Salicylic Acid..."
                  placeholderTextColor={theme.muted}
                  style={[
                    {
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                      color: theme.text,
                      paddingHorizontal: 12,
                      fontSize: 12.5
                    },
                    rtlTextStyle
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={at.addWatchTerm}
                  onPress={() => addWatchTerm()}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    backgroundColor: theme.accent,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 9999
                  }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>
              {customWatchlist.length > 0 && (
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {customWatchlist.map((term) => (
                    <TouchableOpacity
                      key={term}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel={at.removeWatchTerm(term)}
                      onPress={() => removeWatchTerm(term)}
                      style={{
                        maxWidth: '100%',
                        minHeight: 44,
                        minWidth: 44,
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: 9999,
                        backgroundColor: theme.dangerBg,
                        borderWidth: 1,
                        borderColor: theme.danger
                      }}
                    >
                      <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.danger }, rtlTextStyle]}>{term} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Region, Language, Halal Standard & Jurisdiction Settings */}
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.subtle,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                {langMeta.flag} {langMeta.nativeName} · {halalAuthority} · {jurisdiction}
              </Text>
              <Text style={[{ fontSize: 11.5, color: theme.muted, marginBottom: 8 }, rtlTextStyle]}>
                {regionMode === 'auto'
                  ? `Auto (${initialLocale.lang.toUpperCase()} / ${initialLocale.authority})`
                  : `${langMeta.nativeName} (${halalAuthority})`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityState={{ selected: regionMode === 'auto' }}
                  accessibilityLabel={at.autoRegion}
                  onPress={() => applyRegionStructure('auto')}
                  style={[styles.langChip, chipStyle(regionMode === 'auto')]}
                >
                  <Text style={[{ fontSize: 11.5 }, chipTextStyle(regionMode === 'auto')]}>
                    {regionMode === 'auto' ? '✓ ' : ''}Auto ({initialLocale.lang.toUpperCase()})
                  </Text>
                </TouchableOpacity>
                {SUPPORTED_LANGUAGES.map((l: any) => {
                  const active = regionMode === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${l.nativeName} (${l.name})`}
                      onPress={() => applyRegionStructure(l.code as LangCode)}
                      style={[styles.langChip, chipStyle(active)]}
                    >
                      <Text style={[{ fontSize: 11.5 }, chipTextStyle(active)]}>
                        {active ? '✓ ' : ''}{l.flag} {l.nativeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Halal Standard Selector inside Profile */}
              <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginTop: 12, marginBottom: 6 }, rtlTextStyle]}>
                {t.profileScreen.authorityLabel}
              </Text>
              {renderAuthorityChipsRow()}

              {/* Madhhab Fiqh Layer Selector */}
              <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                {p34.madhhabLbl}
              </Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {MADHHABS.map((mk) => {
                  const active = madhhab === mk;
                  const lbl = (p34.madhhabs && p34.madhhabs[mk]) || mk;
                  return (
                    <TouchableOpacity
                      key={mk}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${p34.madhhabLbl}: ${lbl}`}
                      onPress={() => setMadhhab(mk)}
                      style={[styles.chip, chipStyle(active)]}
                    >
                      <Text style={[{ fontSize: 11.5 }, chipTextStyle(active)]}>
                        {active ? '✓ ' : ''}{lbl}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Household Multi-Profile Manager */}
              <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
                <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                  {p34.householdTitle} ({formatDigits(householdMembers.length, lang)}/{formatDigits(4, lang)})
                </Text>
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(['preg', 'baby', 'fungal'] as const).map((pk) => {
                    const lbl = pk === 'preg' ? p34.householdAddPreg : pk === 'baby' ? p34.householdAddBaby : p34.householdAddFungal;
                    return (
                      <TouchableOpacity
                        key={pk}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={lbl}
                        onPress={() => addHouseholdMemberPreset(pk)}
                        disabled={householdMembers.length >= 4}
                        style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1 }]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.text }}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {householdMembers.length > 0 && (
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {householdMembers.map((m, idx) => (
                      <TouchableOpacity
                        key={m.id || idx}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.name}`}
                        onPress={() => removeHouseholdMember(idx)}
                        style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1 }]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.accentDeep }}>👤 {m.name} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Jurisdiction Selector ('TR' | 'EU' | 'US') */}
              <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                {xt.jurisdictionLabel}
              </Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['TR', 'EU', 'US'] as JurisdictionCode[]).map((jur) => {
                  const active = jurisdiction === jur;
                  return (
                    <TouchableOpacity
                      key={jur}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${xt.jurisdictionLabel}: ${jur}`}
                      onPress={() => setJurisdiction(jur)}
                      style={[styles.chip, chipStyle(active)]}
                    >
                      <Text style={[{ fontSize: 12 }, chipTextStyle(active)]}>
                        {active ? '✓ ' : '○ '}{jur === 'TR' ? '🇹🇷 TR' : jur === 'EU' ? '🇪🇺 EU' : '🇺🇸 US'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={xt.privacyBtn}
              onPress={() => setPrivacyModalVisible(true)}
              style={[
                styles.chip,
                {
                  marginTop: 12,
                  backgroundColor: theme.subtle,
                  borderColor: theme.border,
                  borderWidth: 1,
                  alignItems: 'center'
                }
              ]}
            >
              <Text style={[{ color: theme.accentDeep, fontWeight: '800', fontSize: 12 }, rtlTextStyle]}>
                {xt.privacyBtn}
              </Text>
            </TouchableOpacity>

            {/* KVKK/GDPR On-Device Consent, Offline-First Barcode Toggle & 1-Tap Erase All Local Data */}
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.subtle,
                borderWidth: 1,
                borderColor: theme.border,
                gap: 10
              }}
            >
              <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                🔒 {pt1.consentTitle}
              </Text>
              <Text style={[{ fontSize: 11.5, color: theme.muted, lineHeight: 17 }, rtlTextStyle]}>
                {pt1.consentDesc}
              </Text>
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                accessibilityLabel={pt1.consentTitle}
                onPress={() => {
                  setEraseStatusMsg(null);
                  setConsentAccepted((v) => !v);
                }}
                style={[
                  styles.chip,
                  {
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: consentAccepted ? theme.successBg : theme.card,
                    borderColor: consentAccepted ? theme.success : theme.accent,
                    borderWidth: 1.5
                  }
                ]}
              >
                <Text style={[{ fontSize: 12, fontWeight: '800', color: consentAccepted ? theme.success : theme.accentDeep }, rtlTextStyle]}>
                  {consentAccepted ? pt1.consentAcceptedLbl : pt1.consentAcceptBtn}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: liveBarcodeEnabled }}
                accessibilityLabel={pt1.liveBarcodeTitle}
                onPress={() => {
                  setEraseStatusMsg(null);
                  setLiveBarcodeEnabled((v) => !v);
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: liveBarcodeEnabled ? theme.accent : theme.border,
                  backgroundColor: liveBarcodeEnabled ? theme.accentSoft : theme.card,
                  gap: 4
                }}
              >
                <Text style={[{ fontSize: 12, fontWeight: '800', color: liveBarcodeEnabled ? theme.accentDeep : theme.text }, rtlTextStyle]}>
                  {liveBarcodeEnabled ? '🌐 ✓ ' : '📵 ○ '} {pt1.liveBarcodeTitle}
                </Text>
                <Text style={[{ fontSize: 11, color: theme.muted, lineHeight: 16 }, rtlTextStyle]}>
                  {pt1.liveBarcodeDesc}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={pt1.eraseAllBtn}
                onPress={handleEraseAllLocalData}
                style={[
                  styles.chip,
                  {
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.dangerBg,
                    borderColor: theme.danger,
                    borderWidth: 1.5
                  }
                ]}
              >
                <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.danger }, rtlTextStyle]}>
                  {pt1.eraseAllBtn}
                </Text>
              </TouchableOpacity>
              {!!eraseStatusMsg && (
                <Text style={[{ fontSize: 11.5, fontWeight: '700', color: theme.success }, rtlTextStyle]}>
                  ✓ {eraseStatusMsg}
                </Text>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t.profileScreen.continueBtn}
              onPress={() => setActiveTab('scan')}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{t.profileScreen.continueBtn}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SCREEN 2: SCAN (LIVE BARCODE CAMERA + OCR + MANUAL INPUT) */}
        {activeTab === 'scan' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Unified Scan Hero Card (Camera Barcode + Photo OCR + Gallery — Theme-Aware) */}
            <View style={[styles.viewfinder, { backgroundColor: theme.subtle, borderColor: theme.border }]}>
              <Text style={[{ color: theme.text, fontWeight: '800', fontSize: 16, marginBottom: 4 }, rtlTextStyle]}>
                {xt.ocrCardTitle}
              </Text>
              <Text style={[{ color: theme.muted, fontSize: 12, marginBottom: 12, lineHeight: 17 }, rtlTextStyle]}>
                {t.scanScreen.subtitle}
              </Text>
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={xt.scanBarcodeCameraBtn}
                onPress={openBarcodeCamera}
                style={[styles.primaryBtn, { width: '100%', marginTop: 0, marginBottom: 8, backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.scanBarcodeCameraBtn}</Text>
              </TouchableOpacity>
              {isProcessingOcr ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : (
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, width: '100%' }}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={xt.ocrCameraBtn}
                    onPress={() => handleCameraScan('camera')}
                    style={[
                      styles.cameraActionBtn,
                      { flex: 1, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accent }
                    ]}
                  >
                    <Text style={{ color: theme.accentDeep, fontWeight: '800', fontSize: 12.5 }}>{xt.ocrCameraBtn}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={xt.ocrGalleryBtn}
                    onPress={() => handleCameraScan('gallery')}
                    style={[
                      styles.cameraActionBtn,
                      { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12.5 }}>{xt.ocrGalleryBtn}</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ alignItems: isRtl ? 'flex-end' : 'flex-start', marginTop: 10, width: '100%' }}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: cropBeforeOcr }}
                  accessibilityLabel={xt.cropModeToggle}
                  onPress={() => setCropBeforeOcr((v) => !v)}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: cropBeforeOcr ? theme.accent : theme.border,
                    backgroundColor: cropBeforeOcr ? theme.accentSoft : theme.card
                  }}
                >
                  <Text style={{ color: cropBeforeOcr ? theme.accentDeep : theme.muted, fontSize: 11.5, fontWeight: '700' }}>
                    {cropBeforeOcr ? `✓ ${xt.cropModeToggle}` : `○ ${xt.cropModeToggle}`}
                  </Text>
                </TouchableOpacity>
              </View>
              {ocrStatusMsg && (
                <Text
                  style={[
                    {
                      color: ocrLowConfidence
                        ? theme.warning
                        : ocrStatusMsg.startsWith('⚠️')
                        ? theme.danger
                        : theme.accentDeep,
                      fontSize: 11.5,
                      fontWeight: '700',
                      marginTop: 10
                    },
                    rtlTextStyle
                  ]}
                >
                  {ocrStatusMsg}
                </Text>
              )}
            </View>

            {/* Card B: Manual Barcode Entry & Local Save */}
            <View style={{ marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
              <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 8 }, rtlTextStyle]}>
                {xt.barcodeCardTitle}
              </Text>

              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, alignItems: 'center' }}>
                <TextInput
                  accessibilityLabel={at.barcodeInput}
                  keyboardType="number-pad"
                  value={barcodeInput}
                  onChangeText={(v: string) => {
                    setBarcodeInput(v);
                    setBarcodeSaveMsg(null);
                  }}
                  placeholder={xt.barcodeInputPlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[
                    {
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                      color: theme.text,
                      paddingHorizontal: 12,
                      fontSize: 12.5,
                      fontVariant: ['tabular-nums']
                    },
                    rtlTextStyle
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={isLookingUpBarcode}
                  accessibilityRole="button"
                  accessibilityLabel={at.barcodeLookup}
                  onPress={() => handleBarcodeLookup()}
                  style={{
                    minHeight: 44,
                    minWidth: 88,
                    paddingHorizontal: 14,
                    borderRadius: 9999,
                    backgroundColor: theme.accent,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  {isLookingUpBarcode ? (
                    <ActivityIndicator size="small" color={theme.onAccent} />
                  ) : (
                    <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12.5 }}>{xt.barcodeLookupBtn}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {barcodeMeta && (
                <Text
                  style={[
                    {
                      fontSize: 11.5,
                      color: barcodeMeta.requiresOcrFallback ? theme.warning : theme.success,
                      fontWeight: '700',
                      marginTop: 8,
                      lineHeight: 17
                    },
                    rtlTextStyle
                  ]}
                >
                  {!barcodeMeta.found && barcodeMeta.productName
                    ? `ℹ️ ${xt.barcodeNameFoundHint(barcodeMeta.productName)}`
                    : `${barcodeMeta.requiresOcrFallback ? '⚠️' : '✓'} ${barcodeMeta.message}`}
                </Text>
              )}
              {barcodeMeta && barcodeMeta.requiresOcrFallback && (
                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={xt.ocrCameraBtn}
                  onPress={() => handleCameraScan('camera')}
                  style={[
                    styles.cameraActionBtn,
                    { backgroundColor: theme.warningBg, borderWidth: 1, borderColor: theme.warning, marginTop: 8, alignSelf: 'flex-start' }
                  ]}
                >
                  <Text style={{ color: theme.warning, fontWeight: '800', fontSize: 12 }}>{xt.ocrCameraBtn}</Text>
                </TouchableOpacity>
              )}

              {/* Save Custom Barcode on Device (guarded by >=80% coverage & 0 unresolved confirmations) */}
              {barcodeInput.trim().length > 0 && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, gap: 6 }}>
                  <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                    {xt.saveBarcodeTitle}
                  </Text>
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      accessibilityLabel={xt.saveBarcodePlaceholder}
                      value={customProductName}
                      onChangeText={setCustomProductName}
                      placeholder={xt.saveBarcodePlaceholder}
                      placeholderTextColor={theme.muted}
                      style={[
                        {
                          flex: 1,
                          minHeight: 44,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                          color: theme.text,
                          paddingHorizontal: 12,
                          fontSize: 12
                        },
                        rtlTextStyle
                      ]}
                    />
                    <TouchableOpacity
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel={xt.saveBarcodeBtn}
                      onPress={handleSaveCustomBarcode}
                      style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1 }]}
                    >
                      <Text style={{ color: theme.accentDeep, fontWeight: '800', fontSize: 11.5 }}>{xt.saveBarcodeBtn}</Text>
                    </TouchableOpacity>
                  </View>
                  {barcodeSaveMsg && (
                    <Text
                      style={[
                        { fontSize: 11.5, fontWeight: '700', color: barcodeSaveMsg.ok ? theme.success : theme.danger },
                        rtlTextStyle
                      ]}
                    >
                      {barcodeSaveMsg.text}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Card C: Product Type, Claims & Manual INCI Input */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {(['cosmetic', 'food'] as ProductType[]).map((pt) => {
                const active = productType === pt;
                return (
                  <TouchableOpacity
                    key={pt}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={pt === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood}
                    onPress={() => {
                      setProductType(pt);
                      if (pt === 'food') setOcrAppType(null);
                    }}
                    style={[styles.chip, chipStyle(active)]}
                  >
                    <Text style={[{ fontSize: 12 }, chipTextStyle(active)]}>
                      {active ? '✓ ' : '○ '}{pt === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: halalCert }}
                accessibilityLabel={t.profileScreen.claimsLabel || 'Helal'}
                onPress={() => setHalalCert(!halalCert)}
                style={[styles.chip, chipStyle(halalCert)]}
              >
                <Text style={[{ fontSize: 12 }, chipTextStyle(halalCert)]}>
                  {halalCert ? '✓ ' : '○ '}{t.profileScreen.claimsLabel || 'Helal'}
                </Text>
              </TouchableOpacity>
              {(
                [
                  ['none', xt.veganNone],
                  ['declared', xt.veganDeclared],
                  ['verified', xt.veganVerified]
                ] as [VeganStatus, string][]
              ).map(([vs, label]) => {
                const active = veganStatus === vs;
                return (
                  <TouchableOpacity
                    key={vs}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                    onPress={() => setVeganStatus(vs)}
                    style={[styles.chip, chipStyle(active)]}
                  >
                    <Text style={[{ fontSize: 12 }, chipTextStyle(active)]}>
                      {active ? '✓ ' : '○ '}{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
              ✏️ {xt.manualCardTitle}
            </Text>
            <TextInput
              accessibilityLabel={xt.manualCardTitle}
              multiline
              value={rawText}
              placeholder={xt.manualPlaceholder}
              placeholderTextColor={theme.muted}
              onChangeText={(txt: string) => {
                setBarcodeMeta(null);
                setOcrAppType(null);
                setBarcodeSaveMsg(null);
                applyNutritionObject(null);
                setRawText(txt);
                setConfirmations({});
              }}
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.subtle,
                  color: theme.text,
                  borderColor: theme.border
                },
                rtlTextStyle
              ]}
            />

            {productType === 'food' && (
              <View style={{ marginBottom: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.subtle }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={p34.nutriToggle}
                  onPress={() => setShowNutritionInputs((prev) => !prev)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.accent }, rtlTextStyle]}>
                    {showNutritionInputs ? '▾ ' : '▸ '}{p34.nutriToggle}
                  </Text>
                </TouchableOpacity>
                {showNutritionInputs && (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(
                        [
                          ['energyKcal', p34.nutriKcal],
                          ['sugarsG', p34.nutriSugars],
                          ['saturatedFatG', p34.nutriSatFat],
                          ['saltG', p34.nutriSalt],
                          ['fiberG', p34.nutriFiber],
                          ['proteinG', p34.nutriProtein]
                        ] as [string, string][]
                      ).map(([fieldKey, label]) => (
                        <View key={fieldKey} style={{ width: '47%' }}>
                          <Text style={[{ fontSize: 10.5, color: theme.muted, marginBottom: 3 }, rtlTextStyle]}>{label}</Text>
                          <TextInput
                            keyboardType="decimal-pad"
                            value={
                              Object.hasOwn(nutritionDraftStrings, fieldKey)
                                ? nutritionDraftStrings[fieldKey]
                                : nutritionPer100g && nutritionPer100g[fieldKey] !== undefined
                                ? String(nutritionPer100g[fieldKey])
                                : ''
                            }
                            onChangeText={(val: string) => {
                              setNutritionDraftStrings((prev) => ({ ...prev, [fieldKey]: val }));
                              setNutritionPer100g((prev) => {
                                const next: Record<string, any> = { ...(prev || {}) };
                                if (fieldKey === 'energyKcal') delete next.energyKj;
                                if (fieldKey === 'saltG') delete next.sodiumMg;
                                const trimmed = val.trim();
                                if (!trimmed) {
                                  delete next[fieldKey];
                                } else {
                                  const normalized = trimmed.replace(',', '.');
                                  if (/^\d*(?:\.\d*)?$/.test(normalized) && normalized !== '.' && normalized !== '') {
                                    const parsed = Number(normalized);
                                    if (Number.isFinite(parsed) && parsed >= 0) next[fieldKey] = parsed;
                                  }
                                }
                                return Object.keys(next).length > 0 ? next : null;
                              });
                            }}
                            style={{
                              minHeight: 44,
                              borderWidth: 1,
                              borderColor: theme.border,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              backgroundColor: theme.card,
                              color: theme.text,
                              fontSize: 13
                            }}
                          />
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(nutritionPer100g?.isBeverage) }}
                        onPress={() => {
                          setNutritionPer100g((prev) => {
                            const next: Record<string, any> = { ...(prev || {}) };
                            if (next.isBeverage) {
                              delete next.isBeverage;
                              delete next.isWater;
                            } else {
                              next.isBeverage = true;
                            }
                            return Object.keys(next).length > 0 ? next : null;
                          });
                        }}
                        style={[styles.chip, chipStyle(Boolean(nutritionPer100g?.isBeverage))]}
                      >
                        <Text style={[{ fontSize: 11.5 }, chipTextStyle(Boolean(nutritionPer100g?.isBeverage))]}>
                          {nutritionPer100g?.isBeverage ? '✓ ' : '○ '}{p34.nutriBev}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        onPress={() => applyNutritionObject(null)}
                        style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.card }]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.muted }}>{p34.nutriClear}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.75}
              disabled={!hasActiveProduct}
              accessibilityRole="button"
              accessibilityLabel={t.scanScreen.analyzeBtn}
              onPress={() => {
                if (!hasActiveProduct) return;
                setDebouncedRawText(rawText);
                recordScanToHistory(
                  undefined,
                  rawText,
                  productType,
                  debouncedRawText === rawText ? evalMain?.cards?.regulatoryCard?.score ?? null : undefined
                );
                setActiveTab('result');
              }}
              style={[
                styles.primaryBtn,
                { backgroundColor: hasActiveProduct ? theme.accent : theme.subtle, borderWidth: 1, borderColor: theme.border }
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: hasActiveProduct ? theme.onAccent : theme.muted }]}>
                {t.scanScreen.analyzeBtn}
              </Text>
            </TouchableOpacity>

            {/* Optional Quick Demo Presets (Only Loaded When Tapped) */}
            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={[{ fontSize: 11.5, fontWeight: '700', color: theme.muted, marginBottom: 8 }, rtlTextStyle]}>
                {xt.demoHeader}
              </Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                {([0, 1, 2] as const).map((idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={xt.demoNames[idx]}
                    onPress={() => loadQuickDemoSample(idx)}
                    style={[styles.chip, { minHeight: 44, paddingVertical: 8, backgroundColor: theme.subtle, borderColor: theme.border }]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.text }}>{xt.demoNames[idx]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* SCREEN 3: RESULT */}
        {activeTab === 'result' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {!evalMain ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={[rtlTextStyle, { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 6, textAlign: 'center' }]}>
                  📊 {xt.emptyResultTitle}
                </Text>
                <Text style={[rtlTextStyle, { fontSize: 13, color: theme.muted, lineHeight: 19, marginBottom: 14, textAlign: 'center' }]}>
                  {xt.emptyResultDesc}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={xt.goScanBtn}
                  onPress={() => setActiveTab('scan')}
                  style={[styles.primaryBtn, { width: '100%', backgroundColor: theme.accent }]}
                >
                  <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.goScanBtn}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {(barcodeMeta?.productName || customProductName.trim().length > 0) && (
                  <Text style={[{ fontSize: 14, fontWeight: '800', color: theme.accent, marginBottom: 4 }, rtlTextStyle]}>
                    📦 {barcodeMeta?.productName || customProductName.trim()}
                  </Text>
                )}
                {barcodeMeta?.found && (
                  <View
                    style={{
                      marginBottom: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: theme.subtle,
                      borderWidth: 1,
                      borderColor: theme.border,
                      gap: 2
                    }}
                  >
                    <Text style={[{ fontSize: 11, fontWeight: '700', color: theme.accentDeep }, rtlTextStyle]}>
                      🧾 {pt1.barcodeSourceLbl}: {barcodeMeta.source || 'Open Food / Beauty Facts (ODbL)'}
                      {barcodeMeta.updatedAt ? ` · ${barcodeMeta.updatedAt}` : ''}
                    </Text>
                    <Text style={[{ fontSize: 10.5, color: theme.muted, lineHeight: 15 }, rtlTextStyle]}>
                      ⚠️ {pt1.reformulationNotice}
                    </Text>
                  </View>
                )}

                {unresolvedConfirmations.length > 0 &&
                  unresolvedConfirmations.map((conf: any, confIdx: number) => (
                    <View
                      key={`${conf.token || 'conf'}-${confIdx}`}
                      style={[styles.ocrAlertBox, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}
                    >
                      <Text style={[styles.ocrAlertTitle, { color: theme.warning }, rtlTextStyle]}>
                        {t.resultScreen.ocrWarningTitle}: "{conf.token}"
                      </Text>
                      {!!conf.message && (
                        <Text style={[styles.ocrAlertDesc, { color: theme.warning }, rtlTextStyle]}>
                          {conf.message}
                        </Text>
                      )}
                      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {Array.isArray(conf.options) && conf.options.length > 0 ? (
                          conf.options.map((opt: any) => (
                            <TouchableOpacity
                              key={opt.id}
                              activeOpacity={0.82}
                              accessibilityRole="button"
                              accessibilityLabel={`${opt.label}${opt.code ? ` (${opt.code})` : ''}`}
                              onPress={() =>
                                setConfirmations((prev) => ({
                                  ...prev,
                                  [conf.token]: opt.id
                                }))
                              }
                              style={[styles.ocrChoiceBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                            >
                              <Text style={[styles.ocrChoiceText, { color: theme.text }]}>
                                {opt.label}
                                {opt.code ? ` (${opt.code})` : ''}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : conf.candidateCode ? (
                          <TouchableOpacity
                            activeOpacity={0.82}
                            accessibilityRole="button"
                            accessibilityLabel={conf.candidateCode}
                            onPress={() =>
                              setConfirmations((prev) => ({
                                ...prev,
                                [conf.token]: conf.candidateCode
                              }))
                            }
                            style={[styles.ocrChoiceBtn, { backgroundColor: theme.card, borderColor: theme.accent }]}
                          >
                            <Text style={[styles.ocrChoiceText, { color: theme.accentDeep }]}>✓ {conf.candidateCode}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}

                {/* Visual Score Hero Card + Coverage Progress Bar */}
                {(() => {
                  const regCard = evalMain.cards.regulatoryCard;
                  const halalCard = evalMain.cards.halalCard;
                  const sc = regCard.score;
                  const covPct = Math.min(100, Math.max(0, Number(regCard.coveragePercent) || 0));
                  const scCol =
                    !regCard.canShowScore
                      ? theme.warning
                      : regCard.capApplied === 10 || (sc !== null && sc < 50)
                      ? theme.danger
                      : sc !== null && sc >= 75
                      ? theme.success
                      : theme.warning;
                  const halalIsRed = halalCard.overallStatus === 'uygunsuz_bulgu' || halalCard.overallStatus === 'conflict';
                  const halalIsOk = halalCard.overallStatus === 'uygun_gorunuyor';
                  const halalBg = halalIsRed ? theme.dangerBg : halalIsOk ? theme.successBg : theme.warningBg;
                  const halalFg = halalIsRed ? theme.danger : halalIsOk ? theme.success : theme.warning;
                  return (
                    <View
                      style={{
                        backgroundColor: theme.subtle,
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: theme.border,
                        marginBottom: 12
                      }}
                    >
                      <View
                        style={{
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 10
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[{ fontSize: 11.5, fontWeight: '700', color: theme.muted, marginBottom: 2 }, rtlTextStyle]}>
                            {t.resultScreen.scoreLabel}
                          </Text>
                          <Text style={[{ fontSize: 15, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                            {barcodeMeta?.productName || customProductName.trim() || (productType === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood)}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 26,
                            fontWeight: '800',
                            fontVariant: ['tabular-nums'],
                            color: scCol
                          }}
                        >
                          {regCard.canShowScore
                            ? `${formatDigits(sc, lang)} / ${formatDigits(100, lang)}`
                            : `— (${formatPercent(covPct, lang)})`}
                        </Text>
                      </View>

                      <View style={{ height: 6, borderRadius: 99, backgroundColor: theme.border, marginVertical: 10, overflow: 'hidden' }}>
                        <View style={{ width: `${covPct}%`, height: 6, borderRadius: 99, backgroundColor: theme.accent }} />
                      </View>

                      <View
                        style={{
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8
                        }}
                      >
                        <Text style={[{ fontSize: 12, fontWeight: '600', color: theme.muted }, rtlTextStyle]}>
                          {t.resultScreen.coverageLabel}: {formatPercent(covPct, lang)} • {p34.curatedCovLbl}: {formatPercent(Math.round(Number(regCard.curatedCoveragePercent) || 0), lang)} • {jurisdiction}
                        </Text>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: halalBg }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: halalFg }}>{formatHalalSummaryStatus()}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Edit Text & Attention Filter Controls */}
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityState={{ selected: attentionOnly }}
                    accessibilityLabel={xt.attentionOnlyBtn}
                    onPress={() => setAttentionOnly(true)}
                    style={[styles.chip, chipStyle(attentionOnly)]}
                  >
                    <Text style={[{ fontSize: 12, fontVariant: ['tabular-nums'] }, chipTextStyle(attentionOnly)]}>
                      {attentionOnly ? '✓ ' : ''}{xt.attentionOnlyBtn} · {formatDigits(attentionFindings.length, lang)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !attentionOnly }}
                    accessibilityLabel={xt.allItemsBtn}
                    onPress={() => setAttentionOnly(false)}
                    style={[styles.chip, chipStyle(!attentionOnly)]}
                  >
                    <Text style={[{ fontSize: 12, fontVariant: ['tabular-nums'] }, chipTextStyle(!attentionOnly)]}>
                      {!attentionOnly ? '✓ ' : ''}{xt.allItemsBtn} · {formatDigits(regulatoryFindings.length, lang)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={xt.editTextBtn}
                    onPress={() => setActiveTab('scan')}
                    style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1, borderRadius: 9999 }]}
                  >
                    <Text style={{ color: theme.accentDeep, fontWeight: '800', fontSize: 12 }}>{xt.editTextBtn}</Text>
                  </TouchableOpacity>
                </View>

                {attentionOnly && displayedRegulatoryFindings.length === 0 && profileAlerts.length === 0 ? (
                  <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.successBg, borderWidth: 1, borderColor: theme.border, marginBottom: 10 }}>
                    <Text style={[{ color: theme.success, fontSize: 12.5, fontWeight: '700' }, rtlTextStyle]}>
                      ✓ {xt.noAttentionMsg}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      overflow: 'hidden',
                      marginBottom: 10
                    }}
                  >
                    {displayedRegulatoryFindings.map((f: any, idx: number) => {
                      const isBanned = f.euStatus === 'yasak' || f.status === 'yasak' || f.effectiveStatus === 'yasak';
                      const isAllowed = f.euStatus === 'izinli' && f.severity === 'bilgi';
                      const badgeLabel = isBanned ? t.badges.banned : isAllowed ? t.badges.allowed : t.badges.restricted;
                      const badgeBg = isBanned ? theme.dangerBg : isAllowed ? theme.successBg : theme.warningBg;
                      const badgeFg = isBanned ? theme.danger : isAllowed ? theme.success : theme.warning;
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityLabel={`${f.localizedName || f.name} — ${p34.tapDossierHint}`}
                          onPress={() => openIngredientDossier(f)}
                          style={{
                            flexDirection: isRtl ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minHeight: 44,
                            gap: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderBottomWidth: idx < displayedRegulatoryFindings.length - 1 ? 1 : 0,
                            borderBottomColor: theme.border
                          }}
                        >
                          <Text style={[{ flex: 1, color: isBanned ? theme.danger : theme.text, fontSize: 13, fontWeight: '700' }, rtlTextStyle]}>
                            {f.localizedName || f.name}
                          </Text>
                          <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9999, backgroundColor: badgeBg }}>
                            <Text style={{ color: badgeFg, fontSize: 11.5, fontWeight: '800' }}>{badgeLabel}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {profileAlerts.map((pa: any, idx: number) => {
                  const isRed = (pa.level || pa.severity) === 'kirmizi';
                  return (
                    <View
                      key={`pa-${idx}`}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: isRed ? theme.dangerBg : theme.warningBg,
                        borderWidth: 1,
                        borderColor: isRed ? theme.danger : theme.warning,
                        marginBottom: 8
                      }}
                    >
                      <Text style={[{ color: isRed ? theme.danger : theme.warning, fontSize: 12.5, lineHeight: 18 }, rtlTextStyle]}>
                        <Text style={{ fontWeight: '800' }}>{pa.localizedName || pa.rawToken}</Text>: {pa.explanation || pa.reason}
                      </Text>
                    </View>
                  );
                })}

                {!attentionOnly && dedupedShieldNames.length > 0 && (
                  <View
                    style={{
                      marginTop: 4,
                      padding: 11,
                      borderRadius: 12,
                      backgroundColor: theme.successBg,
                      borderWidth: 1,
                      borderColor: theme.border
                    }}
                  >
                    <Text style={[{ color: theme.success, fontSize: 12, fontWeight: '800', marginBottom: 2 }, rtlTextStyle]}>
                      ✓ {xt.shieldSummaryPrefix}
                    </Text>
                    <Text style={[{ color: theme.text, fontSize: 12, lineHeight: 18 }, rtlTextStyle]}>
                      {dedupedShieldNames.join(', ')}
                    </Text>
                  </View>
                )}

                {/* Share Result Card, 1-Click Compare A/B & Save to AM/PM/Pantry Shelf */}
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={ft.shareCardBtn}
                    onPress={() => setShareCardModalVisible(true)}
                    style={[styles.chip, { flex: 1, backgroundColor: theme.accent, borderColor: theme.accent, borderRadius: 9999, alignItems: 'center' }]}
                  >
                    <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12.5 }}>
                      {ft.shareCardBtn}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={at.assignCompareA}
                    onPress={() => assignCurrentToCompare('A')}
                    style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1, borderRadius: 9999 }]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>A</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={at.assignCompareB}
                    onPress={() => assignCurrentToCompare('B')}
                    style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1, borderRadius: 9999 }]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>B</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.muted }, rtlTextStyle]}>{p34.shelfSaveTitle}</Text>
                  {productType === 'cosmetic' ? (
                    <>
                      <TouchableOpacity activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={p34.shelfAm} onPress={() => saveCurrentToRoutineShelf('AM')} style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1 }]}>
                        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 11.5 }}>{p34.shelfAm}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={p34.shelfPm} onPress={() => saveCurrentToRoutineShelf('PM')} style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1 }]}>
                        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 11.5 }}>{p34.shelfPm}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={p34.shelfPantry} onPress={() => saveCurrentToRoutineShelf('Pantry')} style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1 }]}>
                      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 11.5 }}>{p34.shelfPantry}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Household Multi-Profile Strip */}
                {householdEval && householdEval.memberCount > 0 && (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: theme.accent, backgroundColor: theme.card, gap: 6 }}>
                    <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>{p34.householdVerdictTitle}</Text>
                    {householdEval.members.map((m: any) => {
                      const rowBg =
                        m.overallColor === 'kirmizi'
                          ? theme.dangerBg
                          : m.overallColor === 'sari'
                          ? theme.warningBg
                          : m.overallColor === 'unknown'
                          ? theme.subtle
                          : theme.successBg;
                      const rowCol =
                        m.overallColor === 'kirmizi'
                          ? theme.danger
                          : m.overallColor === 'sari'
                          ? theme.warning
                          : m.overallColor === 'unknown'
                          ? theme.muted
                          : theme.success;
                      return (
                        <View key={m.id} style={{ padding: 8, borderRadius: 10, backgroundColor: rowBg, borderWidth: m.overallColor === 'unknown' ? 1 : 0, borderColor: theme.border }}>
                          <Text style={[{ fontSize: 12, fontWeight: '800', color: rowCol }, rtlTextStyle]}>👤 {m.name}</Text>
                          <Text style={[{ fontSize: 11.5, color: theme.text, marginTop: 2 }, rtlTextStyle]}>{m.topReason}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* FAO/WHO NOVA 1-4 Food Ultra-Processing Card */}
                {evalMain.cards.novaCard?.applicable && (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: evalMain.cards.novaCard.badgeColor === 'kirmizi' ? theme.danger : evalMain.cards.novaCard.badgeColor === 'sari' ? theme.warning : theme.success, backgroundColor: theme.subtle, gap: 4 }}>
                    <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>{evalMain.cards.novaCard.cardTitle}</Text>
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: evalMain.cards.novaCard.badgeColor === 'kirmizi' ? theme.danger : evalMain.cards.novaCard.badgeColor === 'sari' ? theme.warning : theme.success }, rtlTextStyle]}>{evalMain.cards.novaCard.label}</Text>
                    <Text style={[{ fontSize: 11.5, color: theme.muted, lineHeight: 16 }, rtlTextStyle]}>{evalMain.cards.novaCard.summary}</Text>
                    {(evalMain.cards.novaCard.markers || []).length > 0 && (
                      <Text style={[{ fontSize: 11, fontWeight: '700', color: theme.danger, marginTop: 2 }, rtlTextStyle]}>
                        • {mb.novaMarkersLbl}: {evalMain.cards.novaCard.markers.join(', ')}
                      </Text>
                    )}
                  </View>
                )}

                {/* Official Nutri-Score 2023 (A-E) Food Card */}
                {evalMain.productType === 'food' && evalMain.cards.nutriScoreCard && (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: evalMain.cards.nutriScoreCard.available ? evalMain.cards.nutriScoreCard.gradeColor : theme.border, backgroundColor: theme.subtle, gap: 6 }}>
                    <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                      {evalMain.cards.nutriScoreCard.cardTitle}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => {
                        const active = evalMain.cards.nutriScoreCard.available && evalMain.cards.nutriScoreCard.grade === g;
                        const bgMap: Record<string, string> = { A: '#038141', B: '#85BB2F', C: '#FECB02', D: '#EE8100', E: '#E63E11' };
                        const fg = g === 'B' || g === 'C' ? '#091410' : '#FFFFFF';
                        return (
                          <View
                            key={g}
                            style={{
                              width: active ? 32 : 24,
                              height: active ? 32 : 24,
                              borderRadius: 7,
                              backgroundColor: bgMap[g],
                              opacity: active ? 1 : 0.35,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: active ? 2 : 0,
                              borderColor: theme.text
                            }}
                          >
                            <Text style={{ fontSize: active ? 15 : 11.5, fontWeight: '900', color: fg }}>{g}</Text>
                          </View>
                        );
                      })}
                      {evalMain.cards.nutriScoreCard.available && (
                        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, marginLeft: 4 }}>
                          N:{formatDigits(evalMain.cards.nutriScoreCard.negativePoints, lang)} · P:{formatDigits(evalMain.cards.nutriScoreCard.positivePoints, lang)}
                        </Text>
                      )}
                    </View>
                    {evalMain.cards.nutriScoreCard.available && evalMain.cards.nutriScoreCard.trafficLights && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {Object.values(evalMain.cards.nutriScoreCard.trafficLights).map((tl: any, idx: number) => (
                          <Text
                            key={idx}
                            style={{
                              fontSize: 10.5,
                              fontWeight: '700',
                              color: tl.color === 'kirmizi' ? theme.danger : tl.color === 'sari' ? theme.warning : theme.success
                            }}
                          >
                            • {tl.title}: {formatDigits(tl.value, lang)} {tl.unit} ({tl.label})
                          </Text>
                        ))}
                      </View>
                    )}
                    {(evalMain.cards.nutriScoreCard.notes || []).map((noteText: string, idx: number) => (
                      <Text key={idx} style={[{ fontSize: 11, color: theme.muted, lineHeight: 15 }, rtlTextStyle]}>
                        {noteText}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Cosmetic Routine & Layering Conflict Alert */}
                {evalMain.cards.routineConflictCard?.applicable &&
                  ((evalMain.cards.routineConflictCard.conflicts || []).length > 0 ||
                    evalMain.cards.routineConflictCard.needsSpfReminder) && (
                    <View
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: theme.warning,
                        backgroundColor: theme.subtle
                      }}
                    >
                      <Text style={[{ color: theme.warning, fontWeight: '800', fontSize: 13, marginBottom: 4 }, rtlTextStyle]}>
                        {evalMain.cards.routineConflictCard.cardTitle}
                      </Text>
                      <Text style={[{ color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 }, rtlTextStyle]}>
                        {evalMain.cards.routineConflictCard.cardSubtitle}
                      </Text>
                      {(evalMain.cards.routineConflictCard.conflicts || []).map((rc: any, idx: number) => (
                        <View
                          key={rc.conflictId || idx}
                          style={{
                            marginTop: idx === 0 ? 0 : 8,
                            padding: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.card
                          }}
                        >
                          <Text style={[{ color: rc.severity === 'kirmizi' ? theme.danger : theme.warning, fontWeight: '800', fontSize: 11.5 }, rtlTextStyle]}>
                            ⚡ {rc.severityLabel} · {rc.detectedPair}
                          </Text>
                          <Text style={[{ color: theme.muted, fontSize: 11, marginTop: 3 }, rtlTextStyle]}>
                            {evalMain.cards.routineConflictCard.whyLabel} {rc.whyConflict}
                          </Text>
                          <Text style={[{ color: theme.accent, fontWeight: '700', fontSize: 11.5, marginTop: 4 }, rtlTextStyle]}>
                            🛡️ {evalMain.cards.routineConflictCard.routineTipLabel}: {rc.howToLayer}
                          </Text>
                        </View>
                      ))}
                      {evalMain.cards.routineConflictCard.needsSpfReminder && (
                        <Text style={[{ color: theme.warning, fontSize: 11, fontWeight: '700', marginTop: 8 }, rtlTextStyle]}>
                          ☀️ {evalMain.cards.routineConflictCard.spfReminderText}
                        </Text>
                      )}
                    </View>
                  )}

                {/* Brand-Neutral Clean & Halal Ingredient Swap Guide */}
                {evalMain.cards.swapGuideCard && (
                  <View
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.accent,
                      backgroundColor: theme.subtle
                    }}
                  >
                    <Text style={[{ color: theme.accent, fontWeight: '800', fontSize: 13, marginBottom: 4 }, rtlTextStyle]}>
                      {evalMain.cards.swapGuideCard.cardTitle}
                    </Text>
                    <Text style={[{ color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 }, rtlTextStyle]}>
                      {evalMain.cards.swapGuideCard.cardSubtitle}
                    </Text>
                    {(evalMain.cards.swapGuideCard.items || []).length === 0 ? (
                      <Text style={[{ color: theme.accent, fontSize: 12, fontWeight: '700' }, rtlTextStyle]}>
                        ✓ {evalMain.cards.swapGuideCard.allCleanMessage}
                      </Text>
                    ) : (
                      (evalMain.cards.swapGuideCard.items || []).map((sw: any, idx: number) => (
                        <View
                          key={sw.swapId || idx}
                          style={{
                            marginTop: idx === 0 ? 0 : 8,
                            padding: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.card
                          }}
                        >
                          <Text style={[{ color: sw.severity === 'kirmizi' ? theme.danger : theme.warning, fontWeight: '800', fontSize: 11.5 }, rtlTextStyle]}>
                            ❌ {evalMain.cards.swapGuideCard.detectedLabel}: {sw.detectedIngredient}
                          </Text>
                          <Text style={[{ color: theme.text, fontWeight: '700', fontSize: 12, marginTop: 4 }, rtlTextStyle]}>
                            ✅ {evalMain.cards.swapGuideCard.lookForLabel}: {sw.lookForInstead}
                          </Text>
                          <Text style={[{ color: theme.muted, fontSize: 11, marginTop: 3 }, rtlTextStyle]}>
                            {evalMain.cards.swapGuideCard.whyLabel} {sw.whySwap}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Food Hidden Sugar, Rapid Carb & Vegan Audit Card (rendered for food products) */}
                {productType === 'food' && evalMain.cards.veganSugarCard && (
                  <View
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.subtle,
                      gap: 6
                    }}
                  >
                    <Text style={[{ color: theme.text, fontWeight: '800', fontSize: 13 }, rtlTextStyle]}>
                      🍬 {evalMain.cards.veganSugarCard.cardTitle}
                    </Text>
                    <Text style={[{ color: theme.muted, fontSize: 11.5, fontWeight: '700' }, rtlTextStyle]}>
                      {pt1.sugarTotalLbl}: {formatDigits(evalMain.cards.veganSugarCard.freeSugarCount || 0, lang)}
                    </Text>
                    {(evalMain.cards.veganSugarCard.detectedFreeSugars || []).length > 0 && (
                      <Text style={[{ color: theme.warning, fontSize: 11.5, lineHeight: 17 }, rtlTextStyle]}>
                        • {pt1.freeSugarLbl}:{' '}
                        {evalMain.cards.veganSugarCard.detectedFreeSugars
                          .map((s: any) => s.localizedName || s.canonical || s.rawToken)
                          .join(', ')}
                      </Text>
                    )}
                    {(evalMain.cards.veganSugarCard.detectedRapidCarbs || []).length > 0 && (
                      <Text style={[{ color: theme.muted, fontSize: 11.5, lineHeight: 17 }, rtlTextStyle]}>
                        • {pt1.rapidCarbLbl}:{' '}
                        {evalMain.cards.veganSugarCard.detectedRapidCarbs
                          .map((c: any) => c.localizedName || c.canonical || c.rawToken)
                          .join(', ')}
                      </Text>
                    )}
                    {((evalMain.cards.veganSugarCard.nonVeganItems || []).length > 0 ||
                      (evalMain.cards.veganSugarCard.uncertainVeganItems || []).length > 0) && (
                      <Text style={[{ color: theme.danger, fontSize: 11.5, fontWeight: '700', lineHeight: 17 }, rtlTextStyle]}>
                        • {pt1.veganConcernLbl}:{' '}
                        {[
                          ...(evalMain.cards.veganSugarCard.nonVeganItems || []),
                          ...(evalMain.cards.veganSugarCard.uncertainVeganItems || [])
                        ]
                          .map((v: any) => v.localizedName || v.canonical || v.rawToken)
                          .join(', ')}
                      </Text>
                    )}
                  </View>
                )}

                {/* Official Regulatory & Allergen Report Summary */}
                {evalMain.cards.regulatoryReportCard && (
                  <View
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.subtle
                    }}
                  >
                    <Text style={[{ color: theme.text, fontWeight: '800', fontSize: 13, marginBottom: 4 }, rtlTextStyle]}>
                      {evalMain.cards.regulatoryReportCard.cardTitle} (v{evalMain.cards.regulatoryReportCard.datasetManifest.datasetVersion})
                    </Text>
                    <Text style={[{ color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 }, rtlTextStyle]}>
                      {evalMain.cards.regulatoryReportCard.cardSubtitle}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={evalMain.cards.regulatoryReportCard.openModalBtn}
                      onPress={() => setRegReportModalVisible(true)}
                      style={[
                        styles.chip,
                        {
                          minHeight: 44,
                          minWidth: 44,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: theme.accentSoft,
                          borderColor: theme.accent
                        }
                      ]}
                    >
                      <Text style={[{ color: theme.accent, fontWeight: '800', fontSize: 12.5 }, rtlTextStyle]}>
                        📑 {evalMain.cards.regulatoryReportCard.openModalBtn}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Brand-Neutral Alternatives & Catalog Swaps / INCI Dupes */}
                {alternativesData &&
                  ((alternativesData.cleanerAlternatives || []).length > 0 || (alternativesData.dupes || []).length > 0) && (
                    <View style={{ marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: theme.accent, backgroundColor: theme.card, gap: 6 }}>
                      <Text style={[{ color: theme.accent, fontWeight: '800', fontSize: 13 }, rtlTextStyle]}>{p34.altTitle}</Text>
                      {(alternativesData.cleanerAlternatives || []).map((alt: any, idx: number) => (
                        <TouchableOpacity
                          key={`alt-${idx}`}
                          activeOpacity={0.82}
                          accessibilityRole="button"
                          accessibilityLabel={alt.name}
                          onPress={() => {
                            const nextPt: ProductType = alt.productType === 'food' ? 'food' : 'cosmetic';
                            setProductType(nextPt);
                            setBarcodeMeta(null);
                            setOcrAppType(alt.applicationType || null);
                            applyNutritionObject(nextPt === 'food' ? (alt.nutritionPer100g || null) : null);
                            setCustomProductName(alt.name);
                            setConfirmations({});
                            setRawText(alt.rawText);
                            setDebouncedRawText(alt.rawText);
                          }}
                          style={{ padding: 10, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: theme.success, backgroundColor: theme.successBg, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text }, rtlTextStyle]}>{alt.name}</Text>
                            <Text style={[{ fontSize: 11, color: theme.muted }, rtlTextStyle]}>
                              {p34.inciSimLbl}: {formatPercent(alt.similarityPercent, lang)}
                              {alt.nutriScoreGrade ? ` · Nutri-Score ${alt.nutriScoreGrade}` : ''}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.success }}>{formatDigits(alt.score, lang)}/100</Text>
                        </TouchableOpacity>
                      ))}
                      {(alternativesData.dupes || []).length > 0 && (
                        <>
                          <Text style={[{ fontSize: 11, fontWeight: '700', color: theme.muted, marginTop: 4 }, rtlTextStyle]}>{mb.altDupeSub}</Text>
                          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                            {(alternativesData.dupes || []).map((dp: any, idx: number) => (
                              <TouchableOpacity
                                key={`dupe-${idx}`}
                                activeOpacity={0.82}
                                accessibilityRole="button"
                                accessibilityLabel={dp.name}
                                onPress={() => {
                                  const nextPt: ProductType = dp.productType === 'food' ? 'food' : 'cosmetic';
                                  setProductType(nextPt);
                                  setBarcodeMeta(null);
                                  setOcrAppType(dp.applicationType || null);
                                  applyNutritionObject(nextPt === 'food' ? (dp.nutritionPer100g || null) : null);
                                  setCustomProductName(dp.name);
                                  setConfirmations({});
                                  setRawText(dp.rawText);
                                  setDebouncedRawText(dp.rawText);
                                }}
                                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.subtle }}
                              >
                                <Text style={[{ fontSize: 11, fontWeight: '700', color: theme.text }, rtlTextStyle]}>
                                  🧪 {dp.name} · {formatPercent(dp.similarityPercent, lang)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  )}

                {!!evalMain.appleGuideline141Disclaimer && (
                  <Text style={[{ fontSize: 11, color: theme.muted, lineHeight: 16, marginTop: 12 }, rtlTextStyle]}>
                    ⚖️ {evalMain.appleGuideline141Disclaimer}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* SCREEN 4: HALAL (LIVE AUTHORITY ENGINE) */}
        {activeTab === 'halal' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.halalScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, marginBottom: 10 }, rtlTextStyle]}>
              {t.halalScreen.authoritySelectLabel}
            </Text>
            {renderAuthorityChipsRow()}

            {/* Active Authority Standard Summary Card (Updates on Every Tap Even When Empty) */}
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.accentSoft,
                borderWidth: 1.5,
                borderColor: theme.accent,
                marginBottom: 12
              }}
            >
              <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.accent, marginBottom: 4 }, rtlTextStyle]}>
                ✓ {xt.activeAuthorityTitle}: {activeAuthorityInfo[0]}
              </Text>
              <Text style={[{ fontSize: 12, color: theme.text, lineHeight: 18 }, rtlTextStyle]}>
                {activeAuthorityInfo[1]}
              </Text>
            </View>

            {!evalMain ? (
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
                <Text style={[{ fontSize: 12.5, color: theme.muted, lineHeight: 19, marginBottom: 12 }, rtlTextStyle]}>
                  {xt.emptyHalalDesc}
                </Text>
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={xt.goScanBtn}
                    onPress={() => setActiveTab('scan')}
                    style={[styles.primaryBtn, { marginTop: 0, backgroundColor: theme.accent }]}
                  >
                    <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.goScanBtn}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={xt.loadAuthorityDemoBtn}
                    onPress={loadAuthorityDiffDemo}
                    style={[styles.chip, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.accent }, rtlTextStyle]}>
                      {xt.loadAuthorityDemoBtn}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.subtle,
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginBottom: 10
                  }}
                >
                  <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                    {halalAuthority}: {formatHalalSummaryStatus()}
                  </Text>
                  {!!evalMain.cards.halalCard.madhhabNote && (
                    <Text style={[{ fontSize: 11.5, color: theme.accent, fontWeight: '700', marginTop: 4 }, rtlTextStyle]}>
                      🕌 {evalMain.cards.halalCard.madhhabNote}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={p34.askMfrBtn}
                  onPress={handleShareManufacturerInquiry}
                  style={[styles.chip, { marginBottom: 12, minHeight: 44, backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1 }]}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.accentDeep }, rtlTextStyle]}>{p34.askMfrBtn}</Text>
                </TouchableOpacity>

                {evalMain.cards.halalCard.findings.map((hf: any, idx: number) => (
                  <View
                    key={`${hf.ruleId || 'hf'}-${idx}`}
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: theme.subtle,
                      borderWidth: 1,
                      borderColor: hf.hasAuthorityDifference ? theme.accent : theme.border
                    }}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                      • {hf.localizedName || hf.canonical} ({hf.rawToken}): {getHalalBadgeLabel(hf.status)}
                    </Text>
                    {!!(hf.contextResolution || hf.explanation) && (
                      <Text style={[{ fontSize: 12, color: theme.muted, lineHeight: 18, marginBottom: 8 }, rtlTextStyle]}>
                        {hf.contextResolution || hf.explanation}
                      </Text>
                    )}

                    {/* 4-Authority Interactive 2x2 Matrix for this Finding */}
                    {hf.authorityMatrix && (
                      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                        {AUTHORITIES.map((ak) => {
                          const st = hf.authorityMatrix[ak] || 'sari';
                          const isCurr = halalAuthority === ak;
                          const cellBg = st === 'yesil' ? theme.successBg : st === 'kirmizi' || st === 'conflict' ? theme.dangerBg : theme.warningBg;
                          const cellFg = st === 'yesil' ? theme.success : st === 'kirmizi' || st === 'conflict' ? theme.danger : theme.warning;
                          const stWord =
                            st === 'yesil'
                              ? t.badges.halalOk
                              : st === 'kirmizi' || st === 'conflict'
                              ? t.badges.halalRed
                              : t.badges.musbooh;
                          return (
                            <TouchableOpacity
                              key={ak}
                              activeOpacity={0.82}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isCurr }}
                              accessibilityLabel={`${ak}: ${stWord}`}
                              onPress={() => setHalalAuthority(ak)}
                              style={{
                                width: '48%',
                                minHeight: 46,
                                padding: 9,
                                borderRadius: 12,
                                backgroundColor: cellBg,
                                borderWidth: isCurr ? 2 : 1,
                                borderColor: isCurr ? theme.accent : cellFg
                              }}
                            >
                              <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                                {ak}{isCurr ? ' ✓' : ''}
                              </Text>
                              <Text style={[{ fontSize: 11.5, fontWeight: '700', color: cellFg, marginTop: 1 }, rtlTextStyle]}>
                                {stWord}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {hf.hasAuthorityDifference && !!hf.authorityDiffReason && (
                      <Text style={[{ fontSize: 11.5, color: theme.text, lineHeight: 17, marginTop: 8 }, rtlTextStyle]}>
                        🔎 {hf.authorityDiffReason}
                      </Text>
                    )}
                  </View>
                ))}

                {dedupedShieldNames.length > 0 && (
                  <View
                    style={{
                      marginTop: 4,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: theme.accentSoft,
                      borderWidth: 1,
                      borderColor: theme.border
                    }}
                  >
                    <Text style={[{ color: theme.accent, fontSize: 12, fontWeight: '800', marginBottom: 2 }, rtlTextStyle]}>
                      🛡️ {xt.shieldSummaryPrefix}
                    </Text>
                    <Text style={[{ color: theme.text, fontSize: 12, lineHeight: 18 }, rtlTextStyle]}>
                      {dedupedShieldNames.join(', ')}
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={xt.methodologyBtn}
              onPress={() => setMethodologyModalVisible(true)}
              style={[
                styles.chip,
                {
                  marginTop: 12,
                  minHeight: 44,
                  minWidth: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: theme.subtle,
                  borderColor: theme.border
                }
              ]}
            >
              <Text style={[{ fontSize: 12.5, fontWeight: '700', color: theme.accent }, rtlTextStyle]}>
                ⚖️ {xt.methodologyBtn}
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
              <Text style={[{ fontSize: 11, color: theme.muted, lineHeight: 16 }, rtlTextStyle]}>
                ⚖️ {t.halalScreen.legalDisclaimerMicro || ''}
              </Text>
            </View>
          </View>
        )}

        {/* SCREEN 5: SIDE-BY-SIDE COMPARE */}
        {activeTab === 'compare' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.compareScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.compareScreen.subtitle}
            </Text>

            {!comparison ? (
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border, marginBottom: 10 }}>
                {(slotA || slotB) && (
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 12 }}>
                    <View style={[styles.compareCol, { backgroundColor: theme.card, borderColor: slotA ? theme.accent : theme.border }]}>
                      <Text style={[{ fontWeight: '800', color: theme.accent }, rtlTextStyle]}>🅰️ A</Text>
                      <Text style={[{ fontSize: 12, color: slotA ? theme.text : theme.muted, marginTop: 4 }, rtlTextStyle]}>
                        {slotA ? slotA.name : xt.emptySlotLabel}
                      </Text>
                    </View>
                    <View style={[styles.compareCol, { backgroundColor: theme.card, borderColor: slotB ? theme.accent : theme.border }]}>
                      <Text style={[{ fontWeight: '800', color: theme.accent }, rtlTextStyle]}>🅱️ B</Text>
                      <Text style={[{ fontSize: 12, color: slotB ? theme.text : theme.muted, marginTop: 4 }, rtlTextStyle]}>
                        {slotB ? slotB.name : xt.emptySlotLabel}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={[{ fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                  ⚖️ {xt.emptyCompareTitle}
                </Text>
                <Text style={[{ fontSize: 12.5, color: theme.muted, lineHeight: 18, marginBottom: 12 }, rtlTextStyle]}>
                  {xt.emptyCompareDesc}
                </Text>
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={xt.goScanBtn}
                    onPress={() => setActiveTab('scan')}
                    style={[styles.primaryBtn, { marginTop: 0, backgroundColor: theme.accent }]}
                  >
                    <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.goScanBtn}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={xt.loadCompareDemoBtn}
                    onPress={loadCompareDemo}
                    style={[styles.chip, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.accent }, rtlTextStyle]}>
                      {xt.loadCompareDemoBtn}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 12 }}>
                  <View
                    style={[
                      styles.compareCol,
                      {
                        backgroundColor: theme.subtle,
                        borderColor:
                          comparison.productA.score !== null && comparison.productA.score >= (comparison.productB.score || 0)
                            ? theme.accent
                            : theme.border
                      }
                    ]}
                  >
                    <Text style={[{ fontWeight: '800', color: theme.accentDeep }, rtlTextStyle]}>{comparison.productA.name}</Text>
                    <Text
                      style={[
                        { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], color: comparison.productA.hasBanned ? theme.danger : theme.success, marginVertical: 4 },
                        rtlTextStyle
                      ]}
                    >
                      {comparison.productA.canShowScore
                        ? `${formatDigits(comparison.productA.score, lang)} / ${formatDigits(100, lang)}`
                        : '—'}
                    </Text>
                    <Text style={[{ fontSize: 12, color: theme.muted }, rtlTextStyle]}>
                      {t.compareScreen.euBanRow}: {comparison.productA.hasBanned ? t.badges.present : t.badges.none}
                      {'\n'}
                      {t.compareScreen.profileRow}: {comparison.productA.profileStatusLocalized}
                      {'\n'}
                      {t.compareScreen.halalRow}: {comparison.productA.halalStatusLocalized}
                      {(comparison.productA.nutriScoreGrade || comparison.productA.novaGroup)
                        ? `\n${[
                            comparison.productA.nutriScoreGrade ? `Nutri-Score ${comparison.productA.nutriScoreGrade}` : '',
                            comparison.productA.novaGroup ? `NOVA ${formatDigits(comparison.productA.novaGroup, lang)}` : ''
                          ].filter(Boolean).join(' · ')}`
                        : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.compareCol,
                      {
                        backgroundColor: theme.subtle,
                        borderColor:
                          comparison.productB.score !== null && comparison.productB.score > (comparison.productA.score || 0)
                            ? theme.accent
                            : theme.border
                      }
                    ]}
                  >
                    <Text style={[{ fontWeight: '800', color: theme.text }, rtlTextStyle]}>{comparison.productB.name}</Text>
                    <Text
                      style={[
                        { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], color: comparison.productB.hasBanned ? theme.danger : theme.success, marginVertical: 4 },
                        rtlTextStyle
                      ]}
                    >
                      {comparison.productB.canShowScore
                        ? `${formatDigits(comparison.productB.score, lang)} / ${formatDigits(100, lang)}`
                        : '—'}
                    </Text>
                    <Text style={[{ fontSize: 12, color: theme.muted }, rtlTextStyle]}>
                      {t.compareScreen.euBanRow}: {comparison.productB.hasBanned ? t.badges.present : t.badges.none}
                      {'\n'}
                      {t.compareScreen.profileRow}: {comparison.productB.profileStatusLocalized}
                      {'\n'}
                      {t.compareScreen.halalRow}: {comparison.productB.halalStatusLocalized}
                      {(comparison.productB.nutriScoreGrade || comparison.productB.novaGroup)
                        ? `\n${[
                            comparison.productB.nutriScoreGrade ? `Nutri-Score ${comparison.productB.nutriScoreGrade}` : '',
                            comparison.productB.novaGroup ? `NOVA ${formatDigits(comparison.productB.novaGroup, lang)}` : ''
                          ].filter(Boolean).join(' · ')}`
                        : ''}
                    </Text>
                  </View>
                </View>

                {comparison.decidingDifference && (
                  <View style={[styles.diffBox, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
                    <Text style={[{ fontWeight: '800', color: theme.warning, marginBottom: 4 }, rtlTextStyle]}>
                      {comparison.decidingDifference.headline}
                    </Text>
                    <Text style={[{ fontSize: 12, color: theme.text, lineHeight: 18 }, rtlTextStyle]}>
                      {comparison.decidingDifference.explanation}
                    </Text>
                  </View>
                )}

                {comparison.routineLayeringCard?.applicable && (comparison.routineLayeringCard.conflicts || []).length > 0 && (
                  <View style={[styles.diffBox, { marginTop: 10, backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
                    <Text style={[{ fontWeight: '800', color: theme.warning, marginBottom: 4 }, rtlTextStyle]}>
                      {comparison.routineLayeringCard.compareLayerTitle}
                    </Text>
                    {(comparison.routineLayeringCard.conflicts || []).map((rc: any, idx: number) => (
                      <View key={rc.conflictId || idx} style={{ marginTop: 6 }}>
                        <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.danger }, rtlTextStyle]}>
                          {rc.severityLabel} · {rc.detectedPair}
                        </Text>
                        <Text style={[{ fontSize: 11.5, color: theme.text, marginTop: 2 }, rtlTextStyle]}>
                          {rc.howToLayer}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {comparison.dupeAnalysis && (
                  <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accent }}>
                    <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.accentDeep }, rtlTextStyle]}>
                      🧪 {p34.inciSimLbl}: {formatPercent(comparison.dupeAnalysis.similarityPercent, lang)}
                    </Text>
                    {(comparison.dupeAnalysis.sharedActives || []).length > 0 && (
                      <Text style={[{ fontSize: 11.5, color: theme.text, marginTop: 3 }, rtlTextStyle]}>
                        {comparison.dupeAnalysis.sharedActives.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Saved AM/PM Routine & Pantry Conflict Shelf */}
            {routineShelf.length > 0 && (
              <View style={{ marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.subtle, gap: 6 }}>
                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text }, rtlTextStyle]}>{p34.shelfTitle} ({formatDigits(routineShelf.length, lang)})</Text>
                {!!shelfEval && (
                  <Text style={[{ fontSize: 11.5, fontWeight: '700', color: shelfEval.summaryColor === 'kirmizi' ? theme.danger : shelfEval.summaryColor === 'sari' ? theme.warning : theme.success }, rtlTextStyle]}>
                    {shelfEval.summaryText}
                  </Text>
                )}
                {!!shelfEval && [...(shelfEval.amConflicts || []), ...(shelfEval.pmConflicts || [])].length > 0 && (
                  <View style={{ gap: 5 }}>
                    {[...(shelfEval.amConflicts || []), ...(shelfEval.pmConflicts || [])].slice(0, 6).map((c: any, idx: number) => (
                      <View key={`shc-${idx}`} style={{ padding: 8, borderRadius: 10, backgroundColor: c.severity === 'kirmizi' ? theme.dangerBg : theme.warningBg, borderWidth: 1, borderColor: c.severity === 'kirmizi' ? theme.danger : theme.warning }}>
                        <Text style={[{ fontSize: 11.5, fontWeight: '800', color: c.severity === 'kirmizi' ? theme.danger : theme.warning }, rtlTextStyle]}>
                          [{c.slot}] {c.productA} + {c.productB}: {c.title || c.detectedPair}
                        </Text>
                        {!!c.howToLayer && (
                          <Text style={[{ fontSize: 11, color: theme.text, marginTop: 2 }, rtlTextStyle]}>🛡️ {c.howToLayer}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {!!shelfEval && (shelfEval.omnibusAlerts || []).length > 0 && (
                  <View style={{ padding: 8, borderRadius: 10, backgroundColor: theme.dangerBg, borderWidth: 1, borderColor: theme.danger }}>
                    <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.danger }, rtlTextStyle]}>
                      ⏳ {mb.omnibusAlertsLbl}: {shelfEval.omnibusAlerts.map((o: any) => `${o.productName} (${o.substance})`).join(', ')}
                    </Text>
                  </View>
                )}
                {routineShelf.map((sh: any) => (
                  <View key={sh.id} style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={[{ flex: 1, fontSize: 12, fontWeight: '700', color: theme.text }, rtlTextStyle]}>[{sh.slot}] {sh.name}</Text>
                    <TouchableOpacity activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={`Remove ${sh.name}`} onPress={() => removeShelfItem(sh.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: theme.danger, fontWeight: '800' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Scans History with Tap-to-Reload & 1-Click A/B Assignment */}
            {scanHistory.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 8 }, rtlTextStyle]}>
                  {ft.recentScansTitle}
                </Text>
                {scanHistory.map((item, idx) => (
                  <View
                    key={`hist-${idx}`}
                    style={{
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                      gap: 8
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      onPress={() => {
                        setProductType(item.productType || 'cosmetic');
                        setCustomProductName(item.name || '');
                        setBarcodeMeta(null);
                        setOcrAppType(null);
                        applyNutritionObject(item.productType === 'food' ? (item.nutritionPer100g || null) : null);
                        setConfirmations(item.userConfirmations ? { ...item.userConfirmations } : {});
                        setRawText(item.rawText);
                        setDebouncedRawText(item.rawText);
                        setActiveTab('result');
                      }}
                      style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text style={[{ fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], color: theme.text }, rtlTextStyle]}>
                        {item.name} ({item.score !== null ? `${formatDigits(item.score, lang)}/${formatDigits(100, lang)}` : '—'})
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6 }}>
                      <TouchableOpacity
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} — ${at.assignCompareA}`}
                        onPress={() => setSlotA(item)}
                        style={[
                          styles.chip,
                          { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1, borderRadius: 9999 }
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>A</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} — ${at.assignCompareB}`}
                        onPress={() => setSlotB(item)}
                        style={[
                          styles.chip,
                          { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.subtle, borderColor: theme.border, borderWidth: 1, borderRadius: 9999 }
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>B</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Navigation Bar — Ergonomic Thumb-Zone 5 Tabs (Scan Center FAB) */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.card, borderTopColor: theme.border, flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {tabsMeta.map(([id, shortLabel]) => {
          const isActive = activeTab === id;
          if (id === 'scan') {
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t.tabs[id]}
                onPress={() => setActiveTab(id)}
                style={[
                  styles.bottomScanFab,
                  {
                    backgroundColor: theme.accent,
                    borderColor: theme.bg
                  }
                ]}
              >
                <NavIcon kind="scan" color={theme.onAccent} size={20} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.82}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t.tabs[id]}
              onPress={() => setActiveTab(id)}
              style={styles.bottomTabItem}
            >
              <NavIcon kind={id} color={isActive ? theme.accentDeep : theme.muted} size={17} />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.accentDeep : theme.muted, fontWeight: isActive ? '800' : '600' }
                ]}
              >
                {shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Live Barcode Camera Modal */}
      <Modal
        visible={barcodeScannerVisible}
        animationType="slide"
        onRequestClose={() => setBarcodeScannerVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            autofocus="on"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14']
            }}
            onBarcodeScanned={(event: any) => {
              if (barcodeScanLockRef.current) return;
              const scannedData = typeof event?.data === 'string' ? event.data.trim() : '';
              if (!scannedData) return;
              barcodeScanLockRef.current = true;
              try {
                Vibration.vibrate(60);
              } catch {}
              setBarcodeScannerVisible(false);
              setTorchOn(false);
              handleBarcodeLookup(scannedData);
            }}
          />
          <View style={styles.scannerOverlayTop}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
              {xt.barcodeModalTitle}
            </Text>
            <Text style={{ color: '#E5E7EB', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
              {xt.barcodeModalHint}
            </Text>
          </View>
          <View pointerEvents="none" style={styles.scannerReticleWrapper}>
            <View style={styles.scannerReticle} />
          </View>
          <View style={styles.scannerOverlayBottom}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={torchOn ? xt.torchOn : xt.torchOff}
                onPress={() => setTorchOn(!torchOn)}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: torchOn ? '#C5A059' : '#1F2937' }]}
              >
                <Text style={{ color: torchOn ? '#0F291E' : '#FFF', fontWeight: '800', fontSize: 13 }}>
                  {torchOn ? xt.torchOn : xt.torchOff}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={xt.closeBtn}
                onPress={() => {
                  setTorchOn(false);
                  setBarcodeScannerVisible(false);
                }}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: '#374151' }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{xt.closeBtn}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={xt.barcodeFallbackOcrBtn}
              onPress={() => {
                setTorchOn(false);
                setBarcodeScannerVisible(false);
                setTimeout(() => handleCameraScan('camera'), 320);
              }}
              style={[styles.primaryBtn, { marginTop: 10, backgroundColor: '#0F291E', borderWidth: 1, borderColor: '#C5A059' }]}
            >
              <Text style={{ color: '#EAD39C', fontWeight: '800', fontSize: 12.5 }}>
                {xt.barcodeFallbackOcrBtn}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Regulatory & Allergen Report Modal */}
      <Modal
        visible={regReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRegReportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '86%' }]}>
            {evalMain?.cards?.regulatoryReportCard && (
              <ScrollView showsVerticalScrollIndicator>
                <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
                  📑 {evalMain.cards.regulatoryReportCard.cardTitle}
                </Text>
                <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.cardSubtitle}
                </Text>

                <View style={{ padding: 10, borderRadius: 10, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}>
                  <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                    v{evalMain.cards.regulatoryReportCard.datasetManifest.datasetVersion} · {evalMain.cards.regulatoryReportCard.datasetManifest.sourcesSnapshotDate}
                  </Text>
                  <Text style={[{ fontSize: 11.5, color: theme.muted, lineHeight: 17 }, rtlTextStyle]}>
                    {evalMain.cards.regulatoryReportCard.datasetManifest.activeJurisdiction} · {evalMain.cards.regulatoryReportCard.datasetManifest.selectedHalalAuthority} · CosIng #{evalMain.cards.regulatoryReportCard.datasetManifest.cosingDictionaryCount} · {evalMain.cards.regulatoryReportCard.datasetManifest.verifiedSourceCount} sources
                  </Text>
                </View>

                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.freshnessTitle}
                </Text>
                {(evalMain.cards.regulatoryReportCard.freshnessPillars || []).map((fp: any, idx: number) => (
                  <View
                    key={fp.id || idx}
                    style={{
                      padding: 9,
                      borderRadius: 10,
                      backgroundColor: theme.subtle,
                      borderWidth: 1,
                      borderColor: theme.border,
                      marginBottom: 6
                    }}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.accent }, rtlTextStyle]}>
                      {fp.title}
                    </Text>
                    <Text style={[{ fontSize: 11.5, color: theme.muted, marginTop: 2 }, rtlTextStyle]}>
                      {fp.detail || fp.text || ''}
                    </Text>
                  </View>
                ))}

                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 8, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.transitionCalendarTitle}
                </Text>
                {(evalMain.cards.regulatoryReportCard.transitionCalendarItems || []).length === 0 ? (
                  <Text style={[{ fontSize: 12, color: theme.muted, marginBottom: 8 }, rtlTextStyle]}>
                    {evalMain.cards.regulatoryReportCard.noTransitionItems}
                  </Text>
                ) : (
                  (evalMain.cards.regulatoryReportCard.transitionCalendarItems || []).map((tc: any, idx: number) => (
                    <View
                      key={idx}
                      style={{
                        padding: 9,
                        borderRadius: 10,
                        backgroundColor: theme.subtle,
                        borderWidth: 1,
                        borderColor: theme.warning,
                        marginBottom: 6
                      }}
                    >
                      <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.warning }, rtlTextStyle]}>
                        ⏳ {tc.name} — {tc.deadline}
                      </Text>
                      <Text style={[{ fontSize: 11.5, color: theme.muted, marginTop: 2 }, rtlTextStyle]}>
                        {tc.regulation} ({tc.status})
                      </Text>
                    </View>
                  ))
                )}

                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 8, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.allergenSectionTitle}
                </Text>
                {(evalMain.cards.regulatoryReportCard.detectedAllergens || []).length === 0 ? (
                  <Text style={[{ fontSize: 12, color: theme.muted, marginBottom: 8 }, rtlTextStyle]}>
                    {evalMain.cards.regulatoryReportCard.noAllergensFound}
                  </Text>
                ) : (
                  (evalMain.cards.regulatoryReportCard.detectedAllergens || []).map((al: any, idx: number) => (
                    <Text key={idx} style={[{ fontSize: 12, color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                      • {al.name} ({al.category}) — {al.regulation}
                    </Text>
                  ))
                )}

                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 8, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.officialSourcesTitle}
                </Text>
                {(evalMain.cards.regulatoryReportCard.citedOfficialSources || []).map((src: any, idx: number) => (
                  <TouchableOpacity
                    key={src.id || idx}
                    activeOpacity={0.75}
                    accessibilityRole="link"
                    accessibilityLabel={`${src.title} (${src.jurisdiction})`}
                    onPress={() => handleOpenExternalUrl(src.url)}
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      justifyContent: 'center',
                      padding: 9,
                      borderRadius: 10,
                      backgroundColor: theme.subtle,
                      borderWidth: 1,
                      borderColor: theme.border,
                      marginBottom: 6
                    }}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.accent }, rtlTextStyle]}>
                      🔗 {src.title} ({src.jurisdiction})
                    </Text>
                    <Text style={[{ fontSize: 11, color: theme.muted, marginTop: 2 }, rtlTextStyle]}>
                      {evalMain.cards.regulatoryReportCard?.checkedAtLabel}: {src.checkedAt || src.checked_at || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={evalMain?.cards?.regulatoryReportCard?.copyReportBtn || xt.shareNativeBtn}
                onPress={handleShareRegulatoryReport}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>
                  📤 {evalMain?.cards?.regulatoryReportCard?.copyReportBtn || xt.shareNativeBtn}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={xt.closeBtn}
                onPress={() => setRegReportModalVisible(false)}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.text }]}>{xt.closeBtn}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Summary Card Modal */}
      <Modal
        visible={shareCardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareCardModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              📤 {t.resultScreen.shareBtn}
            </Text>
            {evalMain && (
              <View style={{ padding: 14, borderRadius: 14, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}>
                <Text style={[{ fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                  {barcodeMeta?.productName || customProductName.trim() || t.resultScreen.title}
                </Text>
                <Text style={[{ fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'], color: theme.accentDeep, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryCard.canShowScore
                    ? `${formatDigits(evalMain.cards.regulatoryCard.score, lang)} / ${formatDigits(100, lang)}`
                    : `— (${formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)})`}
                </Text>
                <Text style={[{ fontSize: 12, color: theme.muted, lineHeight: 18 }, rtlTextStyle]}>
                  {t.resultScreen.coverageLabel}: {formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)}
                  {'\n'}
                  {xt.jurisdictionLabel}: {jurisdiction} · {halalAuthority}: {formatHalalSummaryStatus()}
                  {(evalMain.cards.nutriScoreCard?.available || evalMain.cards.novaCard?.applicable)
                    ? `\n🥗 ${[
                        evalMain.cards.nutriScoreCard?.available ? `Nutri-Score ${evalMain.cards.nutriScoreCard.grade}` : '',
                        evalMain.cards.novaCard?.applicable ? `NOVA ${formatDigits(evalMain.cards.novaCard.group, lang)}` : ''
                      ].filter(Boolean).join(' · ')}`
                    : ''}
                </Text>
              </View>
            )}
            <Text style={[{ fontSize: 11, color: theme.muted, lineHeight: 16, marginBottom: 8 }, rtlTextStyle]}>
              {t.halalScreen.legalDisclaimerMicro}
            </Text>
            {!!evalMain?.appleGuideline141Disclaimer && (
              <Text style={[{ fontSize: 10.5, color: theme.muted, lineHeight: 15, marginBottom: 12 }, rtlTextStyle]}>
                ⚖️ {evalMain.appleGuideline141Disclaimer}
              </Text>
            )}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={xt.shareNativeBtn}
                onPress={handleShareResultCard}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>📤 {xt.shareNativeBtn}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={xt.closeBtn}
                onPress={() => setShareCardModalVisible(false)}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.text }]}>{xt.closeBtn}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Halal Authority Methodology Modal */}
      <Modal
        visible={methodologyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMethodologyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '82%' }]}>
            <ScrollView showsVerticalScrollIndicator>
              <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
                ⚖️ {xt.methodologyTitle}
              </Text>
              <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
                {xt.methodologyIntro}
              </Text>
              {xt.methodologyItems.map(([auth, summary]) => (
                <View
                  key={auth}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.subtle,
                    borderWidth: auth.includes(halalAuthority) ? 2 : 1,
                    borderColor: auth.includes(halalAuthority) ? theme.accent : theme.border,
                    marginBottom: 8
                  }}
                >
                  <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.accent, marginBottom: 3 }, rtlTextStyle]}>
                    {auth}
                  </Text>
                  <Text style={[{ fontSize: 12, color: theme.text, lineHeight: 17 }, rtlTextStyle]}>
                    {summary}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={xt.closeBtn}
              onPress={() => setMethodologyModalVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.closeBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Clickable Ingredient Dossier Modal */}
      <Modal
        visible={Boolean(dossierModalData)}
        transparent
        animationType="slide"
        onRequestClose={() => setDossierModalData(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '85%' }]}>
            {dossierModalData && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
                  🔬 {dossierModalData.localizedName || dossierModalData.canonical}
                </Text>
                <Text style={[{ fontSize: 11.5, color: theme.muted, marginBottom: 8 }, rtlTextStyle]}>
                  {dossierModalData.concentrationZone}
                </Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {(dossierModalData.beneficialRoles || []).length > 0 && (
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.accent, marginBottom: 6 }, rtlTextStyle]}>
                      ✨ {dossierModalData.beneficialRoles.map((r: any) => r.label).join(' · ')}
                    </Text>
                  )}
                  {(dossierModalData.cosingFunctions || []).length > 0 && (
                    <Text style={[{ fontSize: 11.5, color: theme.muted, marginBottom: 6 }, rtlTextStyle]}>
                      CosIng: {dossierModalData.cosingFunctions.join(' · ')}
                      {dossierModalData.cosingRef ? ` (Ref ${dossierModalData.cosingRef})` : ''}
                    </Text>
                  )}
                  <Text style={[{ fontSize: 12.5, color: theme.text, lineHeight: 19, marginBottom: 10 }, rtlTextStyle]}>
                    {dossierModalData.legalText}
                  </Text>

                  {/* 7-Profile + Watchlist Compatibility Matrix */}
                  {Array.isArray(dossierModalData.profileMatrix) && dossierModalData.profileMatrix.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.muted, marginBottom: 6 }, rtlTextStyle]}>
                        {mb.dossierProfileLbl}
                      </Text>
                      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                        {dossierModalData.profileMatrix.map((pm: any, idx: number) => {
                          const pName =
                            pm.profile === 'ozel_kara_liste'
                              ? `🧬 ${mb.watchlistBadge}`
                              : (t.profileScreen?.profiles as any)?.[pm.profile]?.name || pm.profile;
                          const isBad = pm.status === 'kirmizi';
                          const isWarn = pm.status === 'sari' || pm.status === 'sari_ilk5' || pm.status === 'veri_yok';
                          const isUnknown = pm.status === 'unknown' || pm.status === 'bilinmiyor';
                          const bg = isBad
                            ? theme.dangerBg
                            : isWarn
                            ? theme.warningBg
                            : isUnknown
                            ? theme.subtle
                            : theme.successBg;
                          const fg = isBad
                            ? theme.danger
                            : isWarn
                            ? theme.warning
                            : isUnknown
                            ? theme.muted
                            : theme.success;
                          return (
                            <View key={`dpm-${pm.profile}-${idx}`} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: bg }}>
                              <Text style={[{ fontSize: 11, fontWeight: '700', color: fg }, rtlTextStyle]}>
                                {pName}{isUnknown ? ` · ${mb.statusUnknown}` : ''}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* 4-Authority Halal Matrix */}
                  {dossierModalData.authorityMatrix && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.muted, marginBottom: 6 }, rtlTextStyle]}>
                        {mb.dossierHalalLbl}
                      </Text>
                      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(['GIMDES', 'JAKIM', 'MUI', 'IFANCA'] as const).map((ak) => {
                          const st = dossierModalData.authorityMatrix[ak] || 'unknown';
                          const bg =
                            st === 'yesil'
                              ? theme.successBg
                              : st === 'kirmizi' || st === 'conflict'
                              ? theme.dangerBg
                              : st === 'unknown' || st === 'bilinmiyor'
                              ? theme.subtle
                              : theme.warningBg;
                          const fg =
                            st === 'yesil'
                              ? theme.success
                              : st === 'kirmizi' || st === 'conflict'
                              ? theme.danger
                              : st === 'unknown' || st === 'bilinmiyor'
                              ? theme.muted
                              : theme.warning;
                          return (
                            <View key={`dam-${ak}`} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: bg }}>
                              <Text style={[{ fontSize: 11, fontWeight: '800', color: fg }, rtlTextStyle]}>
                                {ak}: {getHalalBadgeLabel(st)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {!!dossierModalData.cleanerSwapTip && (
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.success, marginBottom: 10 }, rtlTextStyle]}>
                      💡 {dossierModalData.cleanerSwapTip}
                    </Text>
                  )}

                  {/* Clickable Verified HTTPS Sources */}
                  {Array.isArray(dossierModalData.sources) && dossierModalData.sources.length > 0 && (
                    <View style={{ marginBottom: 8, gap: 6 }}>
                      <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.muted }, rtlTextStyle]}>
                        {mb.dossierSourceLbl}
                      </Text>
                      {dossierModalData.sources.map((src: any, idx: number) => {
                        const safeUrl = sanitizeHttpUrl(src?.url);
                        if (!safeUrl) return null;
                        return (
                          <TouchableOpacity
                            key={`dsrc-${src.id || idx}`}
                            activeOpacity={0.75}
                            accessibilityRole="link"
                            accessibilityLabel={`${src.id}: ${src.title}`}
                            onPress={() => handleOpenExternalUrl(safeUrl)}
                            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}
                          >
                            <Text style={[{ fontSize: 11.5, fontWeight: '700', color: theme.accent }, rtlTextStyle]}>
                              🔗 {src.id}: {src.title} ↗
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={p34.dossierClose}
                  onPress={() => setDossierModalData(null)}
                  style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{p34.dossierClose}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Privacy & Live Barcode Lookup Disclosure Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              🔒 {xt.privacyTitle}
            </Text>
            <Text style={[{ fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 10 }, rtlTextStyle]}>
              {t.profileScreen.privacyNote}
            </Text>
            <Text style={[{ fontSize: 12.5, color: theme.muted, lineHeight: 19, marginBottom: 12 }, rtlTextStyle]}>
              {xt.privacyBarcodeNote}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="link"
              accessibilityLabel="Open Food Facts / Open Beauty Facts Terms"
              onPress={() => handleOpenExternalUrl('https://world.openfoodfacts.org/terms-of-use')}
              style={[
                styles.chip,
                { minHeight: 44, minWidth: 44, justifyContent: 'center', backgroundColor: theme.subtle, borderColor: theme.border, marginBottom: 10 }
              ]}
            >
              <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.accent }, rtlTextStyle]}>
                🔗 Open Food Facts / Open Beauty Facts Terms
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={xt.closeBtn}
              onPress={() => setPrivacyModalVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{xt.closeBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8
  },
  brandTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  brandSub: { fontSize: 11 },
  topActionPill: {
    minHeight: 44,
    height: 44,
    minWidth: 58,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topIconSquare: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  langChip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8
  },
  bottomTabItem: {
    flex: 1,
    minHeight: 46,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  bottomScanFab: {
    width: 52,
    height: 52,
    marginTop: -18,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 14, paddingBottom: 24 },
  card: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8
  },
  profileName: { fontSize: 14, fontWeight: '700' },
  profileDesc: { fontSize: 11.5, marginTop: 2 },
  primaryBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13.5 },
  viewfinder: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12
  },
  cameraActionBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textArea: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 12.5,
    textAlignVertical: 'top'
  },
  ocrAlertBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14
  },
  ocrAlertTitle: { fontWeight: '800', fontSize: 13 },
  ocrAlertDesc: { fontSize: 12, marginTop: 2 },
  ocrChoiceBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
    flex: 1,
    minWidth: '45%'
  },
  ocrChoiceText: { fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  compareCol: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1 },
  diffBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  scannerOverlayTop: {
    position: 'absolute',
    top: 32,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 41, 30, 0.78)'
  },
  scannerReticleWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scannerReticle: {
    width: 260,
    height: 150,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#C5A059',
    backgroundColor: 'transparent'
  },
  scannerOverlayBottom: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: { borderRadius: 18, padding: 20 }
});
