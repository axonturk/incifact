import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as ReactNative from 'react-native';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureAndRecognizeLabel } from './ocrService';
import { lookupBarcodeOnDevice, saveCustomBarcodeOnDevice, BarcodeLookupResult } from './barcodeService';
import { SUPPORTED_LANGUAGES, getLocaleStrings } from '../i18n/locales.mjs';
import { evaluateProduct, compareProducts } from '../engine/ruleEngine.mjs';

/**
 * InciFact — 5-Screen Calm Mobile Architecture (React Native / Expo SDK 52)
 * Supports 10 Global Languages (TR, EN, AR [RTL], DE, FR, ID, MS, ES, RU, UR [RTL])
 * Palette:
 *   Light: #F4F5F2 (Broken White), #FFFFFF (Card), #0F5D4E (Emerald), #17201C (Ink)
 *   Dark:  #0E1411 (Forest Night), #161F1B (Card), #34D399 (Emerald), #ECF2EE (Ink)
 */

type TabId = 'profile' | 'scan' | 'result' | 'halal' | 'compare';
type ProductType = 'cosmetic' | 'food';
type HalalAuthority = 'general_cautious' | 'GIMDES' | 'JAKIM' | 'MUI' | 'IFANCA';
type JurisdictionCode = 'TR' | 'EU' | 'US';
type VeganStatus = 'none' | 'declared' | 'verified';
type LangCode = 'tr' | 'en' | 'ar' | 'de' | 'fr' | 'id' | 'ms' | 'es' | 'ru' | 'ur';

interface CompareSlotItem {
  name: string;
  rawText: string;
  productType: ProductType;
  jurisdiction?: string;
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

const EXTRA_MOBILE_I18N: Record<
  LangCode,
  {
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
  }
> = {
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
    shareNativeBtn: 'Paylaş'
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
    shareNativeBtn: 'Share'
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
    shareNativeBtn: 'مشاركة'
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
    shareNativeBtn: 'Teilen'
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
    shareNativeBtn: 'Partager'
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
    shareNativeBtn: 'Bagikan'
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
    shareNativeBtn: 'Kongsi'
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
    shareNativeBtn: 'Compartir'
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
    shareNativeBtn: 'Поделиться'
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
    shareNativeBtn: 'شیئر کریں'
  }
};

const MOBILE_A11Y_I18N: Record<
  LangCode,
  {
    settingsBtn: string;
    themeToLight: string;
    themeToDark: string;
    proBtn: string;
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
    proBtn: 'InciFact Pro Bilgisi',
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
    proBtn: 'InciFact Pro Details',
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
    proBtn: 'معلومات InciFact Pro',
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
    proBtn: 'InciFact Pro Details',
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
    proBtn: 'Détails InciFact Pro',
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
    proBtn: 'Info InciFact Pro',
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
    proBtn: 'Maklumat InciFact Pro',
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
    proBtn: 'Detalles de InciFact Pro',
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
    proBtn: 'Подробнее об InciFact Pro',
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
    proBtn: 'InciFact Pro تفصیلات',
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
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function detectDeviceLocaleConfig(): { lang: LangCode; authority: HalalAuthority; jurisdiction: JurisdictionCode } {
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
    return {
      lang: found.code as LangCode,
      authority: (found.defaultAuthority || 'GIMDES') as HalalAuthority,
      jurisdiction: found.code === 'tr' ? 'TR' : 'EU'
    };
  } catch {
    return { lang: 'tr', authority: 'GIMDES', jurisdiction: 'TR' };
  }
}

export default function InciFactMobileApp() {
  const initialLocale = useMemo(() => detectDeviceLocaleConfig(), []);
  const [darkMode, setDarkMode] = useState(false);
  const [regionMode, setRegionMode] = useState<'auto' | LangCode>('auto');
  const [lang, setLang] = useState<LangCode>(initialLocale.lang);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [productType, setProductType] = useState<ProductType>('cosmetic');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(['hamilelik', 'hassas_cilt']);
  const [customWatchlist, setCustomWatchlist] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState('');
  const [halalAuthority, setHalalAuthority] = useState<HalalAuthority>(initialLocale.authority);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionCode>(initialLocale.jurisdiction);
  const [halalCert, setHalalCert] = useState(false);
  const [veganStatus, setVeganStatus] = useState<VeganStatus>('none');
  const [attentionOnly, setAttentionOnly] = useState(false);

  const [rawText, setRawText] = useState(
    'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Sodium Laur?l Sulfate, Phenoxyethanol, Niacinamide, Panthenol, Butylphenyl Methylpropional, Limonene'
  );
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [regReportModalVisible, setRegReportModalVisible] = useState(false);
  const [shareCardModalVisible, setShareCardModalVisible] = useState(false);
  const [methodologyModalVisible, setMethodologyModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [barcodeSaveMsg, setBarcodeSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [barcodeMeta, setBarcodeMeta] = useState<BarcodeLookupResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const isStorageHydrated = useRef(false);

  // Load persisted on-device watchlist and scan history from AsyncStorage on startup
  useEffect(() => {
    (async () => {
      try {
        const [savedWatch, savedHist] = await Promise.all([
          AsyncStorage.getItem('incifact_custom_watchlist_v1'),
          AsyncStorage.getItem('incifact_scan_history_v1')
        ]);
        isStorageHydrated.current = true;
        if (savedWatch) {
          const parsedWatch = JSON.parse(savedWatch);
          if (Array.isArray(parsedWatch)) {
            const validTerms = parsedWatch.filter(
              (w): w is string => typeof w === 'string' && w.trim().length > 0
            );
            setCustomWatchlist((prev) => Array.from(new Set([...validTerms, ...prev])).slice(0, 50));
          }
        }
        if (savedHist) {
          const parsedHist = JSON.parse(savedHist);
          if (Array.isArray(parsedHist)) {
            setScanHistory((prev) => {
              const merged: ScanHistoryEntry[] = [];
              const seenKeys = new Set<string>();
              for (const h of [...prev, ...parsedHist]) {
                if (!h || typeof h.rawText !== 'string') continue;
                const key = `${h.rawText}::${h.productType || 'cosmetic'}::${h.jurisdiction || 'EU'}`;
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  merged.push(h);
                }
              }
              return merged.slice(0, 10);
            });
          }
        }
      } catch {
        isStorageHydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    AsyncStorage.setItem('incifact_custom_watchlist_v1', JSON.stringify(customWatchlist)).catch(() => {});
  }, [customWatchlist]);

  useEffect(() => {
    if (!isStorageHydrated.current) return;
    AsyncStorage.setItem('incifact_scan_history_v1', JSON.stringify(scanHistory)).catch(() => {});
  }, [scanHistory]);

  // Side-by-side comparison state (preserves productType, claims & confirmations per slot)
  const [slotA, setSlotA] = useState<CompareSlotItem>({
    name: 'Product A',
    rawText:
      'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceteareth-20, Petrolatum, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Tocopherol',
    productType: 'cosmetic'
  });
  const [slotB, setSlotB] = useState<CompareSlotItem>({
    name: 'Product B',
    rawText:
      'Ingredients: Aqua, Glycerin, Isopropyl Myristate, Cetearyl Alcohol, Propylparaben, Butylphenyl Methylpropional, Methylisothiazolinone, Parfum, Linalool',
    productType: 'cosmetic'
  });

  const langMeta = useMemo(
    () => SUPPORTED_LANGUAGES.find((l: any) => l.code === lang) || SUPPORTED_LANGUAGES[0],
    [lang]
  );
  const isRtl = langMeta.dir === 'rtl';
  const t = useMemo(() => getLocaleStrings(lang), [lang]);
  const ft = useMemo(() => MOBILE_FEAT_I18N[lang] || MOBILE_FEAT_I18N.en, [lang]);
  const xt = useMemo(() => EXTRA_MOBILE_I18N[lang] || EXTRA_MOBILE_I18N.en, [lang]);
  const at = useMemo(() => MOBILE_A11Y_I18N[lang] || MOBILE_A11Y_I18N.en, [lang]);

  const applyRegionStructure = (mode: 'auto' | LangCode) => {
    setRegionMode(mode);
    const targetCode = mode === 'auto' ? initialLocale.lang : mode;
    setLang(targetCode);
    setJurisdiction(targetCode === 'tr' ? 'TR' : 'EU');
    const targetMeta = SUPPORTED_LANGUAGES.find((l: any) => l.code === targetCode);
    if (targetMeta?.defaultAuthority) {
      setHalalAuthority(targetMeta.defaultAuthority as HalalAuthority);
    }
  };

  // Live deterministic evaluations on device using unified rule engine
  const evalMain = useMemo(
    () =>
      evaluateProduct({
        rawText,
        productType,
        applicationType: barcodeMeta?.applicationType || undefined,
        allergenStatement: barcodeMeta?.allergenStatement || '',
        jurisdiction,
        userProfiles: selectedProfiles,
        customWatchlist,
        halalAuthority,
        claims: {
          halalCertified: halalCert,
          veganStatus,
          vegetarianStatus: 'none'
        },
        userConfirmations: confirmations,
        lang
      }),
    [rawText, productType, barcodeMeta, jurisdiction, selectedProfiles, customWatchlist, halalAuthority, halalCert, veganStatus, confirmations, lang]
  );

  const comparison = useMemo(
    () =>
      compareProducts(slotA, slotB, {
        jurisdiction,
        userProfiles: selectedProfiles,
        customWatchlist,
        halalAuthority,
        lang
      }),
    [slotA, slotB, jurisdiction, selectedProfiles, customWatchlist, halalAuthority, lang]
  );

  const addWatchTerm = (term?: string) => {
    const val = (term ?? watchInput).trim();
    if (val.length < 2 || customWatchlist.length >= 50) return;
    if (!customWatchlist.some((w) => w.toLowerCase() === val.toLowerCase())) {
      const next = [...customWatchlist, val].slice(0, 50);
      setCustomWatchlist(next);
    }
    setWatchInput('');
  };

  const removeWatchTerm = (term: string) => {
    const next = customWatchlist.filter((w) => w !== term);
    setCustomWatchlist(next);
  };

  const formatHalalSummaryStatus = () => {
    const halal = evalMain.cards.halalCard;
    const covPct = evalMain.cards.regulatoryCard.coveragePercent;
    // Definite Haram / Conflict findings ALWAYS take priority over pending OCR or low coverage
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
    const reg = evalMain.cards.regulatoryCard;
    const halal = evalMain.cards.halalCard;
    const scoreTxt = reg.canShowScore
      ? `${formatDigits(reg.score, lang)}/${formatDigits(100, lang)}`
      : `— (${formatPercent(reg.coveragePercent, lang)})`;
    const msg = `🛡️ INCIFACT (${jurisdiction}) — ${t.resultScreen.scoreLabel}: ${scoreTxt}\n🌙 ${t.resultScreen.halalSummaryLabel} (${halal.selectedAuthority}): ${formatHalalSummaryStatus()}\n⚖️ ${t.halalScreen.legalDisclaimerMicro || ''}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const handleShareRegulatoryReport = async () => {
    const rr = evalMain.cards.regulatoryReportCard;
    if (!rr) return;
    const lines = [
      `📄 INCIFACT — ${rr.cardTitle}`,
      `${rr.datasetManifest?.activeJurisdiction || jurisdiction} · ${rr.datasetManifest?.selectedHalalAuthority || halalAuthority} · v${rr.datasetManifest?.datasetVersion || ''}`,
      '',
      `=== ${rr.freshnessTitle} ===`,
      ...((rr.freshnessPillars || []).map((p: any, i: number) => `${i + 1}. ${p.title}: ${p.detail}`)),
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
      ...((rr.citedOfficialSources || []).map((s: any) => {
        const safeUrl = sanitizeHttpUrl(s?.url);
        return `• [${s.id}] ${s.title}${safeUrl ? ` — ${safeUrl}` : ''}`;
      }))
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

  const recordScanToHistory = (customLabel?: string) => {
    const allTokens = rawText
      .replace(/^[\s\S]*?ingredients\s*:\s*/i, '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const nonBase = allTokens.filter((tk) => !/^(aqua|water|eau|wasser|agua|su|glycerin|glycerine|gliserin)$/i.test(tk));
    const chosenTokens = (nonBase.length > 0 ? nonBase : allTokens).slice(0, 2).join(', ');
    const derivedName = customLabel || (chosenTokens ? `${ft.customScanPrefix}: ${chosenTokens}` : ft.scannedLabel('1'));
    const entry: CompareSlotItem & { score: number | null } = {
      name: derivedName,
      rawText,
      productType,
      jurisdiction,
      claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' },
      userConfirmations: { ...confirmations },
      score: evalMain.cards.regulatoryCard.score
    };
    setScanHistory((prev) => {
      const next = [
        entry,
        ...prev.filter(
          (p) =>
            !(
              p.rawText === rawText &&
              p.productType === productType &&
              (p.jurisdiction || 'EU') === jurisdiction
            )
        )
      ].slice(0, 10);
      return next;
    });
    return entry;
  };

  const assignCurrentToCompare = (slot: 'A' | 'B') => {
    const labelName = ft.scannedLabel(slot);
    const entry = recordScanToHistory(labelName);
    if (slot === 'A') {
      setSlotA(entry);
    } else {
      setSlotB(entry);
    }
    setActiveTab('compare');
  };

  const theme = useMemo(
    () =>
      darkMode
        ? {
            bg: '#08120E',
            card: '#0F221A',
            subtle: '#163025',
            text: '#F3EFE6',
            muted: '#B5AEA0',
            border: '#5E8C76',
            accent: '#D4B26A',
            onAccent: '#0F291E',
            accentSoft: '#1D352B',
            danger: '#FCA5A5',
            warning: '#FBBF24',
            success: '#6EE7B7'
          }
        : {
            bg: '#F7F4EF',
            card: '#FFFFFF',
            subtle: '#EFECE6',
            text: '#14261D',
            muted: '#4A5950',
            border: '#6E7670',
            accent: '#0F291E',
            onAccent: '#F7F4EF',
            accentSoft: '#E8EFEA',
            danger: '#B91C1C',
            warning: '#92400E',
            success: '#145A32'
          },
    [darkMode]
  );

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev: string[]) => (prev.includes(id) ? prev.filter((p: string) => p !== id) : [...prev, id]));
  };

  const handleBarcodeLookup = async (codeOverride?: string) => {
    const targetCode = codeOverride !== undefined ? codeOverride : barcodeInput;
    setBarcodeInput(targetCode);
    setBarcodeSaveMsg(null);
    const res = await lookupBarcodeOnDevice(targetCode, lang, {
      jurisdiction,
      userProfiles: selectedProfiles,
      customWatchlist,
      halalAuthority,
      claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' }
    });
    setBarcodeMeta(res);
    if (res.found && res.rawText) {
      if (res.productType) setProductType(res.productType);
      setRawText(res.rawText);
      setConfirmations({});
      setOcrStatusMsg(`📦 ${res.productName || res.barcode} (${res.source || 'ODbL'})`);
      if (!res.requiresOcrFallback) {
        recordScanToHistory(res.productName);
        setActiveTab('result');
      }
    } else {
      setOcrStatusMsg(`⚠️ ${res.message}`);
    }
  };

  const handleSaveCustomBarcode = async () => {
    const cov = evalMain.cards.regulatoryCard.coveragePercent;
    if (cov < 80 || (evalMain.unresolvedConfirmations || []).length > 0) {
      setBarcodeSaveMsg({ ok: false, text: xt.saveBarcodeLowCov });
      return;
    }
    const saved = await saveCustomBarcodeOnDevice({
      barcode: barcodeInput.trim(),
      productName: customProductName.trim() || undefined,
      productType,
      applicationType: barcodeMeta?.applicationType || (productType === 'food' ? 'oral' : 'leave_on'),
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

  const handleCameraScan = async (mode: 'camera' | 'gallery') => {
    const res = await captureAndRecognizeLabel(mode);
    if (!res || typeof res !== 'object') {
      setOcrStatusMsg('⚠️ OCR capture unavailable');
      return;
    }
    const extracted = typeof res.extractedText === 'string' ? res.extractedText.trim() : '';
    if (!res.cancelled && extracted.length > 0) {
      setBarcodeMeta(null);
      setBarcodeSaveMsg(null);
      setRawText(extracted);
      setConfirmations({});
      if (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) {
        setOcrStatusMsg(`OCR (${formatPercent(Math.round(res.confidence * 100), lang)})`);
      } else {
        setOcrStatusMsg('OCR OK');
      }
    } else if (res.error === 'NO_NATIVE_OCR') {
      setOcrStatusMsg('⚠️ OCR text input mode');
    } else if (typeof res.error === 'string' && res.error.trim().length > 0) {
      setOcrStatusMsg(res.error);
    }
  };

  const unresolvedConfirmations = evalMain.unresolvedConfirmations || [];
  const regulatoryFindings: any[] = evalMain.cards.regulatoryCard.findings || [];
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
  const profileAlerts: any[] = evalMain.cards.profileCard?.alerts || [];
  const rtlTextStyle = {
    textAlign: (isRtl ? 'right' : 'left') as 'right' | 'left',
    writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr'
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border, flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.brandMark, { backgroundColor: '#0F291E' }]}>
            <Text style={styles.brandMarkText}>IF</Text>
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: theme.text }, rtlTextStyle]}>InciFact</Text>
            <Text style={[styles.brandSub, { color: theme.muted }, rtlTextStyle]}>
              {t.appTagline}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={at.settingsBtn}
            onPress={() => setActiveTab('profile')}
            style={[styles.iconBtn, { backgroundColor: theme.subtle }]}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={darkMode ? at.themeToLight : at.themeToDark}
            onPress={() => setDarkMode(!darkMode)}
            style={[styles.iconBtn, { backgroundColor: theme.subtle }]}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={at.proBtn}
            onPress={() => setPaywallVisible(true)}
            style={[styles.proBtn, { backgroundColor: '#C5A059' }]}
          >
            <Text style={styles.proBtnText}>Pro</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 5-Tab Bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border, flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {(
          [
            ['profile', t.tabs.profile],
            ['scan', t.tabs.scan],
            ['result', t.tabs.result],
            ['halal', t.tabs.halal],
            ['compare', t.tabs.compare]
          ] as [TabId, string][]
        ).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === id }}
            accessibilityLabel={label}
            onPress={() => setActiveTab(id)}
            style={[
              styles.tabItem,
              activeTab === id && { borderBottomColor: theme.accent, borderBottomWidth: 2.5 }
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === id ? theme.accent : theme.muted }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SCREEN 1: PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.profileScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.profileScreen.subtitle}
            </Text>

            {(['hamilelik', 'cocuk_metabolik', 'hassas_cilt', 'astim_alerji', 'akne'] as const).map((pid) => {
              const active = selectedProfiles.includes(pid);
              const profText = t.profileScreen.profiles[pid];
              return (
                <TouchableOpacity
                  key={pid}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={profText.name}
                  onPress={() => toggleProfile(pid)}
                  style={[
                    styles.profileRow,
                    {
                      backgroundColor: active ? theme.accentSoft : theme.subtle,
                      borderColor: active ? theme.accent : theme.border,
                      flexDirection: isRtl ? 'row-reverse' : 'row'
                    }
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileName, { color: theme.text }, rtlTextStyle]}>
                      {profText.name}
                    </Text>
                    <Text style={[styles.profileDesc, { color: theme.muted }, rtlTextStyle]}>
                      {profText.desc}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: active ? theme.accent : theme.muted }}>
                    {active ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Personal Custom Blacklist ("Benim Yasaklılarım") */}
            <View
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.subtle,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[{ fontSize: 12.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                  🧬 {ft.watchlistTitle}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted }}>
                  {formatDigits(customWatchlist.length, lang)}/50
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
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                      color: theme.text,
                      paddingHorizontal: 10,
                      fontSize: 12
                    },
                    rtlTextStyle
                  ]}
                />
                <TouchableOpacity
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
                    borderRadius: 8
                  }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 14 }}>+</Text>
                </TouchableOpacity>
              </View>
              {customWatchlist.length > 0 && (
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {customWatchlist.map((term) => (
                    <TouchableOpacity
                      key={term}
                      accessibilityRole="button"
                      accessibilityLabel={at.removeWatchTerm(term)}
                      onPress={() => removeWatchTerm(term)}
                      style={{
                        maxWidth: '100%',
                        minHeight: 44,
                        minWidth: 44,
                        justifyContent: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: '#FCE8E6',
                        borderWidth: 1,
                        borderColor: '#991B1B'
                      }}
                    >
                      <Text style={[{ fontSize: 11.5, fontWeight: '800', color: '#991B1B' }, rtlTextStyle]}>🧬 {term} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Region, Country Structure, Jurisdiction & Language Settings */}
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.subtle,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Text
                style={[
                  {
                    fontSize: 12,
                    fontWeight: '800',
                    color: theme.text,
                    marginBottom: 4
                  },
                  rtlTextStyle
                ]}
              >
                ⚙️ {langMeta.flag} {langMeta.nativeName} · {halalAuthority} · {jurisdiction}
              </Text>
              <Text
                style={[
                  {
                    fontSize: 11,
                    color: theme.muted,
                    marginBottom: 8
                  },
                  rtlTextStyle
                ]}
              >
                {regionMode === 'auto'
                  ? `📍 Auto (${initialLocale.lang.toUpperCase()} / ${initialLocale.authority})`
                  : `${langMeta.nativeName} (${halalAuthority})`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: regionMode === 'auto' }}
                  accessibilityLabel={at.autoRegion}
                  onPress={() => applyRegionStructure('auto')}
                  style={[
                    styles.langChip,
                    {
                      backgroundColor: regionMode === 'auto' ? theme.accentSoft : theme.card,
                      borderColor: regionMode === 'auto' ? theme.accent : theme.border
                    }
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: regionMode === 'auto' ? theme.accent : theme.muted
                    }}
                  >
                    📍 Auto ({initialLocale.lang.toUpperCase()})
                  </Text>
                </TouchableOpacity>
                {SUPPORTED_LANGUAGES.map((l: any) => {
                  const active = regionMode === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${l.nativeName} (${l.name})`}
                      onPress={() => applyRegionStructure(l.code as LangCode)}
                      style={[
                        styles.langChip,
                        {
                          backgroundColor: active ? theme.accentSoft : theme.card,
                          borderColor: active ? theme.accent : theme.border
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: active ? theme.accent : theme.muted }}>
                        {l.flag} {l.nativeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Jurisdiction Selector ('TR' | 'EU' | 'US') */}
              <Text
                style={[
                  {
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: theme.text,
                    marginTop: 12,
                    marginBottom: 6
                  },
                  rtlTextStyle
                ]}
              >
                🏛️ {xt.jurisdictionLabel}
              </Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['TR', 'EU', 'US'] as JurisdictionCode[]).map((jur) => {
                  const active = jurisdiction === jur;
                  return (
                    <TouchableOpacity
                      key={jur}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${xt.jurisdictionLabel}: ${jur}`}
                      onPress={() => setJurisdiction(jur)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.accentSoft : theme.card,
                          borderColor: active ? theme.accent : theme.border
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? theme.accent : theme.text }}>
                        {jur === 'TR' ? '🇹🇷 TR' : jur === 'EU' ? '🇪🇺 EU' : '🇺🇸 US'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={xt.privacyBtn}
              onPress={() => setPrivacyModalVisible(true)}
              style={[
                styles.chip,
                {
                  marginTop: 12,
                  backgroundColor: theme.subtle,
                  borderColor: theme.border,
                  alignItems: 'center'
                }
              ]}
            >
              <Text style={[{ color: theme.accent, fontWeight: '800', fontSize: 12 }, rtlTextStyle]}>
                🔒 {xt.privacyBtn}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t.profileScreen.continueBtn}
              onPress={() => setActiveTab('scan')}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{t.profileScreen.continueBtn}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SCREEN 2: SCAN (OCR) */}
        {activeTab === 'scan' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.viewfinder}>
              <Text style={[{ color: '#EAD39C', fontWeight: '700', marginBottom: 4 }, rtlTextStyle]}>{t.scanScreen.title}</Text>
              <Text style={{ color: '#D8D2C5', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
                {t.scanScreen.subtitle}
              </Text>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t.scanScreen.cameraBtn}
                  onPress={() => handleCameraScan('camera')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#C5A059' }]}
                >
                  <Text style={{ color: '#0F291E', fontWeight: '800', fontSize: 12 }}>{t.scanScreen.cameraBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={at.galleryOcr}
                  onPress={() => handleCameraScan('gallery')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#163025', borderWidth: 1, borderColor: '#C5A059' }]}
                >
                  <Text style={{ color: '#EAD39C', fontWeight: '700', fontSize: 12 }}>🖼️ OCR</Text>
                </TouchableOpacity>
              </View>
              {ocrStatusMsg && (
                <Text style={[{ color: '#EAD39C', fontSize: 11, marginTop: 6 }, rtlTextStyle]}>{ocrStatusMsg}</Text>
              )}
            </View>

            {/* Hybrid Barcode Lookup Bar (Open Food / Beauty Facts ODbL) */}
            <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, alignItems: 'center' }}>
                <TextInput
                  accessibilityLabel={at.barcodeInput}
                  value={barcodeInput}
                  onChangeText={(v: string) => {
                    setBarcodeInput(v);
                    setBarcodeSaveMsg(null);
                  }}
                  placeholder="EAN-13 / UPC (3017620422003)"
                  placeholderTextColor={theme.muted}
                  style={[
                    {
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                      color: theme.text,
                      paddingHorizontal: 10,
                      fontSize: 12
                    },
                    rtlTextStyle
                  ]}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={at.barcodeLookup}
                  onPress={() => handleBarcodeLookup()}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: theme.accent,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12 }}>📦 EAN</Text>
                </TouchableOpacity>
              </View>
              {barcodeMeta && (
                <Text
                  style={[
                    {
                      fontSize: 11,
                      color: barcodeMeta.requiresOcrFallback ? theme.warning : theme.accent,
                      fontWeight: '700',
                      marginTop: 6
                    },
                    rtlTextStyle
                  ]}
                >
                  {barcodeMeta.message}
                </Text>
              )}

              {/* Save Custom Barcode on Device (guarded by >=80% coverage & 0 unresolved confirmations) */}
              {barcodeInput.trim().length > 0 && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, gap: 6 }}>
                  <Text style={[{ fontSize: 11.5, fontWeight: '800', color: theme.text }, rtlTextStyle]}>
                    💾 {xt.saveBarcodeTitle}
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
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                          color: theme.text,
                          paddingHorizontal: 10,
                          fontSize: 12
                        },
                        rtlTextStyle
                      ]}
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={xt.saveBarcodeBtn}
                      onPress={handleSaveCustomBarcode}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.accentSoft,
                          borderColor: theme.accent
                        }
                      ]}
                    >
                      <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 11.5 }}>{xt.saveBarcodeBtn}</Text>
                    </TouchableOpacity>
                  </View>
                  {barcodeSaveMsg && (
                    <Text
                      style={[
                        {
                          fontSize: 11,
                          fontWeight: '700',
                          color: barcodeSaveMsg.ok ? theme.success : theme.danger
                        },
                        rtlTextStyle
                      ]}
                    >
                      {barcodeSaveMsg.text}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(['cosmetic', 'food'] as ProductType[]).map((pt) => (
                <TouchableOpacity
                  key={pt}
                  accessibilityRole="button"
                  accessibilityState={{ selected: productType === pt }}
                  accessibilityLabel={pt === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood}
                  onPress={() => setProductType(pt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: productType === pt ? theme.accentSoft : theme.subtle,
                      borderColor: productType === pt ? theme.accent : theme.border
                    }
                  ]}
                >
                  <Text style={{ color: productType === pt ? theme.accent : theme.text, fontWeight: '700' }}>
                    {pt === 'cosmetic' ? t.scanScreen.productTypeCosmetic : t.scanScreen.productTypeFood}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Packaging Claims Toggles (halalCertified + 3-state veganStatus) */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: halalCert }}
                accessibilityLabel={t.profileScreen.claimsLabel || 'Helal'}
                onPress={() => setHalalCert(!halalCert)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: halalCert ? theme.accentSoft : theme.subtle,
                    borderColor: halalCert ? theme.accent : theme.border
                  }
                ]}
              >
                <Text style={{ color: halalCert ? theme.accent : theme.text, fontWeight: '700', fontSize: 12 }}>
                  {halalCert ? '✓ ' + (t.profileScreen.claimsLabel || 'Helal') : '○ ' + (t.profileScreen.claimsLabel || 'Helal')}
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                    onPress={() => setVeganStatus(vs)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.accentSoft : theme.subtle,
                        borderColor: active ? theme.accent : theme.border
                      }
                    ]}
                  >
                    <Text style={{ color: active ? theme.accent : theme.text, fontWeight: '700', fontSize: 12 }}>
                      {active ? '✓ ' : '○ '}{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              accessibilityLabel={t.scanScreen.title}
              multiline
              value={rawText}
              onChangeText={(txt: string) => {
                setBarcodeMeta(null);
                setBarcodeSaveMsg(null);
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

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t.scanScreen.analyzeBtn}
              onPress={() => {
                recordScanToHistory();
                setActiveTab('result');
              }}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{t.scanScreen.analyzeBtn}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SCREEN 3: RESULT (LIVE DETERMINISTIC ENGINE) */}
        {activeTab === 'result' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {unresolvedConfirmations.length > 0 &&
              unresolvedConfirmations.map((conf: any, confIdx: number) => (
                <View key={`${conf.token || 'conf'}-${confIdx}`} style={styles.ocrAlertBox}>
                  <Text style={[styles.ocrAlertTitle, rtlTextStyle]}>
                    {t.resultScreen.ocrWarningTitle}: "{conf.token}"
                  </Text>
                  {!!conf.message && (
                    <Text style={[styles.ocrAlertDesc, rtlTextStyle]}>
                      {conf.message}
                    </Text>
                  )}
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {Array.isArray(conf.options) && conf.options.length > 0 ? (
                      conf.options.map((opt: any) => (
                        <TouchableOpacity
                          key={opt.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${opt.label}${opt.code ? ` (${opt.code})` : ''}`}
                          onPress={() =>
                            setConfirmations((prev) => ({
                              ...prev,
                              [conf.token]: opt.id
                            }))
                          }
                          style={styles.ocrChoiceBtn}
                        >
                          <Text style={styles.ocrChoiceText}>
                            {opt.label}
                            {opt.code ? ` (${opt.code})` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : conf.candidateCode ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={conf.candidateCode}
                        onPress={() =>
                          setConfirmations((prev) => ({
                            ...prev,
                            [conf.token]: conf.candidateCode
                          }))
                        }
                        style={styles.ocrChoiceBtn}
                      >
                        <Text style={styles.ocrChoiceText}>✓ {conf.candidateCode}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}

            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.resultScreen.scoreLabel}: {evalMain.cards.regulatoryCard.canShowScore ? `${formatDigits(evalMain.cards.regulatoryCard.score, lang)} / ${formatDigits(100, lang)}` : `— (${formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)})`}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.resultScreen.coverageLabel}: {formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)} • {jurisdiction} • {formatHalalSummaryStatus()}
            </Text>

            {/* Attention / Warning Filter Toggle */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: attentionOnly }}
                accessibilityLabel={xt.attentionOnlyBtn}
                onPress={() => setAttentionOnly(true)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: attentionOnly ? theme.accentSoft : theme.subtle,
                    borderColor: attentionOnly ? theme.accent : theme.border
                  }
                ]}
              >
                <Text style={{ color: attentionOnly ? theme.accent : theme.text, fontWeight: '800', fontSize: 12 }}>
                  ⚠️ {xt.attentionOnlyBtn} · {formatDigits(attentionFindings.length, lang)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: !attentionOnly }}
                accessibilityLabel={xt.allItemsBtn}
                onPress={() => setAttentionOnly(false)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: !attentionOnly ? theme.accentSoft : theme.subtle,
                    borderColor: !attentionOnly ? theme.accent : theme.border
                  }
                ]}
              >
                <Text style={{ color: !attentionOnly ? theme.accent : theme.text, fontWeight: '800', fontSize: 12 }}>
                  📋 {xt.allItemsBtn} · {formatDigits(regulatoryFindings.length, lang)}
                </Text>
              </TouchableOpacity>
            </View>

            {attentionOnly && displayedRegulatoryFindings.length === 0 && profileAlerts.length === 0 ? (
              <Text style={[{ color: theme.success, fontSize: 12, fontWeight: '700', marginBottom: 8 }, rtlTextStyle]}>
                ✓ {xt.noAttentionMsg}
              </Text>
            ) : (
              displayedRegulatoryFindings.map((f: any, idx: number) => {
                const isBanned = f.euStatus === 'yasak' || f.status === 'yasak' || f.effectiveStatus === 'yasak';
                const isAllowed = f.euStatus === 'izinli' && f.severity === 'bilgi';
                const badgeLabel = isBanned ? t.badges.banned : isAllowed ? t.badges.allowed : t.badges.restricted;
                return (
                  <Text
                    key={idx}
                    style={[{ color: isBanned ? theme.danger : theme.text, fontSize: 12, lineHeight: 19, marginBottom: 6 }, rtlTextStyle]}
                  >
                    • <Text style={{ fontWeight: '700' }}>{f.localizedName || f.name}</Text>: {badgeLabel}
                  </Text>
                );
              })
            )}
            {profileAlerts.map((pa: any, idx: number) => (
              <Text
                key={`pa-${idx}`}
                style={[
                  {
                    color: (pa.level || pa.severity) === 'kirmizi' ? theme.danger : theme.warning,
                    fontSize: 12,
                    lineHeight: 19,
                    marginBottom: 6
                  },
                  rtlTextStyle
                ]}
              >
                {(pa.level || pa.severity) === 'kirmizi' ? '🔴' : '🟡'} <Text style={{ fontWeight: '700' }}>{pa.localizedName || pa.rawToken}</Text>: {pa.explanation || pa.reason}
              </Text>
            ))}
            {!attentionOnly &&
              evalMain.cards.halalCard.falsePositiveShields.map((sh: any, idx: number) => (
                <Text
                  key={`sh-${idx}`}
                  style={[{ color: theme.accent, fontSize: 12, lineHeight: 18, marginTop: 4 }, rtlTextStyle]}
                >
                  🛡️ {sh.canonical}: {t.halalScreen.shieldTitle}
                </Text>
              ))}

            {/* Share Result Card Modal Trigger & 1-Click Compare A/B Assignment */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={ft.shareCardBtn}
                onPress={() => setShareCardModalVisible(true)}
                style={[styles.chip, { flex: 1, backgroundColor: theme.accent, borderColor: theme.accent, alignItems: 'center' }]}
              >
                <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12 }}>
                  📤 {ft.shareCardBtn}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={at.assignCompareA}
                onPress={() => assignCurrentToCompare('A')}
                style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>🅰️ A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={at.assignCompareB}
                onPress={() => assignCurrentToCompare('B')}
                style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>🅱️ B</Text>
              </TouchableOpacity>
            </View>

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
          </View>
        )}

        {/* SCREEN 4: HALAL (LIVE AUTHORITY ENGINE) */}
        {activeTab === 'halal' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.halalScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.halalScreen.authoritySelectLabel}
            </Text>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {(['GIMDES', 'JAKIM', 'MUI', 'IFANCA'] as HalalAuthority[]).map((auth) => (
                <TouchableOpacity
                  key={auth}
                  accessibilityRole="button"
                  accessibilityState={{ selected: halalAuthority === auth }}
                  accessibilityLabel={`${t.halalScreen.authoritySelectLabel} ${auth}`}
                  onPress={() => setHalalAuthority(auth)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: halalAuthority === auth ? theme.accentSoft : theme.subtle,
                      borderColor: halalAuthority === auth ? theme.accent : theme.border
                    }
                  ]}
                >
                  <Text style={{ color: halalAuthority === auth ? theme.accent : theme.text, fontWeight: '700' }}>
                    {auth}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {evalMain.cards.halalCard.findings.length > 0 ? (
              evalMain.cards.halalCard.findings.map((hf: any, idx: number) => (
                <Text
                  key={idx}
                  style={[{ color: theme.text, fontSize: 13, lineHeight: 20, marginBottom: 6 }, rtlTextStyle]}
                >
                  • {hf.localizedName || hf.canonical} ({hf.rawToken}):{' '}
                  {hf.status === 'kirmizi'
                    ? `🔴 ${t.badges.halalRed}`
                    : hf.status === 'yesil'
                    ? `🟢 ${t.badges.halalOk}`
                    : hf.status === 'conflict'
                    ? `⚠️ ${t.badges.conflict || 'Conflict'}`
                    : `🟡 ${t.badges.musbooh}`}
                </Text>
              ))
            ) : (
              <Text style={[{ color: theme.muted, fontSize: 13, lineHeight: 20 }, rtlTextStyle]}>
                {formatHalalSummaryStatus()}
              </Text>
            )}
            {/* 4-Authority Interactive 2x2 Comparison Matrix & Fıkhi Difference Explanation */}
            {(evalMain.cards.halalCard.authorityComparison || []).map((ac: any, idx: number) => (
              <View
                key={`ac-${idx}`}
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: theme.subtle,
                  borderWidth: 1,
                  borderColor: theme.accent
                }}
              >
                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.accent, marginBottom: 8 }, rtlTextStyle]}>
                  🔎 {ac.localizedName || ac.canonical}
                </Text>
                <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {(['GIMDES', 'JAKIM', 'MUI', 'IFANCA'] as HalalAuthority[]).map((ak) => {
                    const st = ac.authorityMatrix ? ac.authorityMatrix[ak] : 'sari';
                    const isCurr = halalAuthority === ak;
                    const cellBg = st === 'yesil' ? '#E4F2EA' : st === 'kirmizi' || st === 'conflict' ? '#FCE8E6' : '#FDF0DF';
                    const cellFg = st === 'yesil' ? '#145A32' : st === 'kirmizi' || st === 'conflict' ? '#991B1B' : '#8A3B08';
                    const stWord = st === 'yesil' ? t.badges.halalOk : st === 'kirmizi' || st === 'conflict' ? t.badges.halalRed : t.badges.musbooh;
                    return (
                      <TouchableOpacity
                        key={ak}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCurr }}
                        accessibilityLabel={`${ak}: ${stWord}`}
                        onPress={() => setHalalAuthority(ak)}
                        style={{
                          width: '47%',
                          minHeight: 46,
                          minWidth: 44,
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: cellBg,
                          borderWidth: isCurr ? 2 : 1,
                          borderColor: isCurr ? theme.accent : cellFg
                        }}
                      >
                        <Text style={[{ fontSize: 12, fontWeight: '800', color: '#14261D' }, rtlTextStyle]}>
                          {ak}{isCurr ? ' ✓' : ''}
                        </Text>
                        <Text style={[{ fontSize: 11.5, fontWeight: '700', color: cellFg }, rtlTextStyle]}>
                          {stWord}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[{ fontSize: 12, color: theme.text, lineHeight: 17 }, rtlTextStyle]}>
                  {ac.reason}
                </Text>
              </View>
            ))}
            {evalMain.cards.halalCard.falsePositiveShields.map((sh: any, idx: number) => (
              <Text
                key={idx}
                style={[{ color: theme.accent, fontSize: 12, lineHeight: 19, marginTop: 4 }, rtlTextStyle]}
              >
                🛡️ {sh.canonical}: {t.halalScreen.shieldTitle}
              </Text>
            ))}

            <TouchableOpacity
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

        {/* SCREEN 5: SIDE-BY-SIDE COMPARE (LIVE COMPARISON) */}
        {activeTab === 'compare' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
              {t.compareScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.compareScreen.subtitle}
            </Text>

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 12 }}>
              <View style={[styles.compareCol, { backgroundColor: theme.subtle, borderColor: comparison.productA.score !== null && comparison.productA.score >= (comparison.productB.score || 0) ? theme.accent : theme.border }]}>
                <Text style={[{ fontWeight: '800', color: theme.accent }, rtlTextStyle]}>{comparison.productA.name}</Text>
                <Text style={[{ fontSize: 22, fontWeight: '800', color: comparison.productA.hasBanned ? theme.danger : theme.success, marginVertical: 4 }, rtlTextStyle]}>
                  {comparison.productA.canShowScore ? `${formatDigits(comparison.productA.score, lang)} / ${formatDigits(100, lang)}` : '—'}
                </Text>
                <Text style={[{ fontSize: 12, color: theme.muted }, rtlTextStyle]}>
                  {t.compareScreen.euBanRow}: {comparison.productA.hasBanned ? t.badges.present : t.badges.none}
                  {'\n'}
                  {t.compareScreen.profileRow}: {comparison.productA.profileStatusLocalized}
                  {'\n'}
                  {t.compareScreen.halalRow}: {comparison.productA.halalStatusLocalized}
                </Text>
              </View>
              <View style={[styles.compareCol, { backgroundColor: theme.subtle, borderColor: comparison.productB.score !== null && comparison.productB.score > (comparison.productA.score || 0) ? theme.accent : theme.border }]}>
                <Text style={[{ fontWeight: '800', color: theme.text }, rtlTextStyle]}>{comparison.productB.name}</Text>
                <Text style={[{ fontSize: 22, fontWeight: '800', color: comparison.productB.hasBanned ? theme.danger : theme.success, marginVertical: 4 }, rtlTextStyle]}>
                  {comparison.productB.canShowScore ? `${formatDigits(comparison.productB.score, lang)} / ${formatDigits(100, lang)}` : '—'}
                </Text>
                <Text style={[{ fontSize: 12, color: theme.muted }, rtlTextStyle]}>
                  {t.compareScreen.euBanRow}: {comparison.productB.hasBanned ? t.badges.present : t.badges.none}
                  {'\n'}
                  {t.compareScreen.profileRow}: {comparison.productB.profileStatusLocalized}
                  {'\n'}
                  {t.compareScreen.halalRow}: {comparison.productB.halalStatusLocalized}
                </Text>
              </View>
            </View>

            {comparison.decidingDifference && (
              <View style={styles.diffBox}>
                <Text style={[{ fontWeight: '800', color: '#8A3B08', marginBottom: 4 }, rtlTextStyle]}>
                  ⚡ {comparison.decidingDifference.headline}
                </Text>
                <Text style={[{ fontSize: 12, color: '#8A3B08', lineHeight: 18 }, rtlTextStyle]}>
                  {comparison.decidingDifference.explanation}
                </Text>
              </View>
            )}

            {comparison.routineLayeringCard?.applicable && (comparison.routineLayeringCard.conflicts || []).length > 0 && (
              <View style={[styles.diffBox, { marginTop: 10 }]}>
                <Text style={[{ fontWeight: '800', color: '#8A3B08', marginBottom: 4 }, rtlTextStyle]}>
                  {comparison.routineLayeringCard.compareLayerTitle}
                </Text>
                {(comparison.routineLayeringCard.conflicts || []).map((rc: any, idx: number) => (
                  <View key={rc.conflictId || idx} style={{ marginTop: 6 }}>
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: '#991B1B' }, rtlTextStyle]}>
                      {rc.severityLabel} · {rc.detectedPair}
                    </Text>
                    <Text style={[{ fontSize: 11.5, color: '#8A3B08', marginTop: 2 }, rtlTextStyle]}>
                      {rc.howToLayer}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Scans History with 1-Click A/B Assignment */}
            <View style={{ marginTop: 14 }}>
              <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 8 }, rtlTextStyle]}>
                🕘 {ft.recentScansTitle}
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
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }, rtlTextStyle]}>
                    {item.name} ({item.score !== null ? `${formatDigits(item.score, lang)}/${formatDigits(100, lang)}` : '—'})
                  </Text>
                  <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6 }}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} — ${at.assignCompareA}`}
                      onPress={() => setSlotA(item)}
                      style={[
                        styles.chip,
                        { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.subtle, borderColor: theme.border }
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} — ${at.assignCompareB}`}
                      onPress={() => setSlotB(item)}
                      style={[
                        styles.chip,
                        { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.subtle, borderColor: theme.border }
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>B</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Regulatory & Allergen Report Modal */}
      <Modal
        visible={regReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRegReportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '86%' }]}>
            {evalMain.cards.regulatoryReportCard && (
              <ScrollView showsVerticalScrollIndicator>
                <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>
                  📑 {evalMain.cards.regulatoryReportCard.cardTitle}
                </Text>
                <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.cardSubtitle}
                </Text>

                {/* Dataset Manifest */}
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}>
                  <Text style={[{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 4 }, rtlTextStyle]}>
                    v{evalMain.cards.regulatoryReportCard.datasetManifest.datasetVersion} · {evalMain.cards.regulatoryReportCard.datasetManifest.sourcesSnapshotDate}
                  </Text>
                  <Text style={[{ fontSize: 11.5, color: theme.muted, lineHeight: 17 }, rtlTextStyle]}>
                    {evalMain.cards.regulatoryReportCard.datasetManifest.activeJurisdiction} · {evalMain.cards.regulatoryReportCard.datasetManifest.selectedHalalAuthority} · CosIng #{evalMain.cards.regulatoryReportCard.datasetManifest.cosingDictionaryCount} · {evalMain.cards.regulatoryReportCard.datasetManifest.verifiedSourceCount} sources
                  </Text>
                </View>

                {/* 4-Layer Freshness Architecture */}
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

                {/* Omnibus Transition Calendar */}
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

                {/* Detected Allergens */}
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

                {/* Cited Official Sources (https?:// whitelisted) */}
                <Text style={[{ fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 8, marginBottom: 6 }, rtlTextStyle]}>
                  {evalMain.cards.regulatoryReportCard.officialSourcesTitle}
                </Text>
                {(evalMain.cards.regulatoryReportCard.citedOfficialSources || []).map((src: any, idx: number) => (
                  <TouchableOpacity
                    key={src.id || idx}
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
                accessibilityRole="button"
                accessibilityLabel={evalMain.cards.regulatoryReportCard?.copyReportBtn || xt.shareNativeBtn}
                onPress={handleShareRegulatoryReport}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>
                  📤 {evalMain.cards.regulatoryReportCard?.copyReportBtn || xt.shareNativeBtn}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
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
            <View style={{ padding: 14, borderRadius: 14, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}>
              <Text style={[{ fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 6 }, rtlTextStyle]}>
                {barcodeMeta?.productName || customProductName.trim() || t.resultScreen.title}
              </Text>
              <Text style={[{ fontSize: 22, fontWeight: '900', color: theme.accent, marginBottom: 6 }, rtlTextStyle]}>
                {evalMain.cards.regulatoryCard.canShowScore
                  ? `${formatDigits(evalMain.cards.regulatoryCard.score, lang)} / ${formatDigits(100, lang)}`
                  : `— (${formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)})`}
              </Text>
              <Text style={[{ fontSize: 12, color: theme.muted, lineHeight: 18 }, rtlTextStyle]}>
                {t.resultScreen.coverageLabel}: {formatPercent(evalMain.cards.regulatoryCard.coveragePercent, lang)}
                {'\n'}
                {xt.jurisdictionLabel}: {jurisdiction} · {halalAuthority}: {formatHalalSummaryStatus()}
              </Text>
            </View>
            <Text style={[{ fontSize: 11, color: theme.muted, lineHeight: 16, marginBottom: 12 }, rtlTextStyle]}>
              {t.halalScreen.legalDisclaimerMicro}
            </Text>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={xt.shareNativeBtn}
                onPress={handleShareResultCard}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>📤 {xt.shareNativeBtn}</Text>
              </TouchableOpacity>
              <TouchableOpacity
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
                    borderWidth: 1,
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

      {/* Paywall Modal */}
      <Modal
        visible={paywallVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaywallVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }, rtlTextStyle]}>InciFact Pro</Text>
            <Text style={[styles.sectionSub, { color: theme.muted }, rtlTextStyle]}>
              {t.compareScreen.subtitle} • GIMDES / JAKIM / MUI / IFANCA
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="InciFact Pro ($29.99/yr)"
              onPress={() => setPaywallVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>InciFact Pro ($29.99/yr)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={xt.closeBtn}
              onPress={() => setPaywallVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.text }]}>{xt.closeBtn}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  brandMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#D4AF37' },
  brandMarkText: { color: '#D4AF37', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  brandTitle: { fontSize: 17, fontWeight: '800' },
  brandSub: { fontSize: 11 },
  iconBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  proBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  proBtnText: { color: '#0B132B', fontWeight: '800', fontSize: 12 },
  langBar: { paddingVertical: 8, borderBottomWidth: 1 },
  langChip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, minHeight: 44, minWidth: 44, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 14 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  profileName: { fontSize: 14, fontWeight: '700' },
  profileDesc: { fontSize: 11, marginTop: 2 },
  primaryBtn: { minHeight: 44, minWidth: 44, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  viewfinder: {
    backgroundColor: '#13221C',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12
  },
  cameraActionBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textArea: { minHeight: 95, borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 12 },
  ocrAlertBox: {
    backgroundColor: '#FCF3DF',
    borderColor: '#8F4B00',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  ocrAlertTitle: { fontWeight: '800', color: '#8F4B00', fontSize: 13 },
  ocrAlertDesc: { color: '#8F4B00', fontSize: 12, marginTop: 2 },
  ocrChoiceBtn: {
    backgroundColor: '#FFF',
    borderColor: '#8F4B00',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
    flex: 1,
    minWidth: '45%'
  },
  ocrChoiceText: { fontSize: 11, fontWeight: '700', color: '#17201C', textAlign: 'center' },
  compareCol: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  diffBox: {
    backgroundColor: '#FCF3DF',
    borderColor: '#8F4B00',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: { borderRadius: 18, padding: 20 }
});
