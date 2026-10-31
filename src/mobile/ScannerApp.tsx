import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { lookupBarcodeOnDevice, BarcodeLookupResult } from './barcodeService';
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

function detectDeviceLocaleConfig(): { lang: LangCode; authority: HalalAuthority } {
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
      authority: (found.defaultAuthority || 'GIMDES') as HalalAuthority
    };
  } catch {
    return { lang: 'tr', authority: 'GIMDES' };
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
  const [halalCert, setHalalCert] = useState(false);
  const [veganStatus, setVeganStatus] = useState<'none' | 'declared' | 'verified'>('none');

  const [rawText, setRawText] = useState(
    'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Sodium Laur?l Sulfate, Phenoxyethanol, Niacinamide, Panthenol, Butylphenyl Methylpropional, Limonene'
  );
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
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
            setCustomWatchlist((prev) => Array.from(new Set([...parsedWatch, ...prev])).slice(0, 50));
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

  const applyRegionStructure = (mode: 'auto' | LangCode) => {
    setRegionMode(mode);
    const targetCode = mode === 'auto' ? initialLocale.lang : mode;
    setLang(targetCode);
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
    [rawText, productType, barcodeMeta, selectedProfiles, customWatchlist, halalAuthority, halalCert, veganStatus, confirmations, lang]
  );

  const comparison = useMemo(
    () =>
      compareProducts(slotA, slotB, {
        userProfiles: selectedProfiles,
        customWatchlist,
        halalAuthority,
        lang
      }),
    [slotA, slotB, selectedProfiles, customWatchlist, halalAuthority, lang]
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
    const scoreTxt = reg.canShowScore ? `${reg.score}/100` : `— (${reg.coveragePercent}%)`;
    const msg = `🛡️ INCIFACT — ${t.resultScreen.scoreLabel}: ${scoreTxt}\n🌙 ${t.resultScreen.halalSummaryLabel} (${halal.selectedAuthority}): ${formatHalalSummaryStatus()}\n⚖️ ${t.halalScreen.legalDisclaimerMicro || ''}`;
    try {
      await Share.share({ message: msg });
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
      claims: { halalCertified: halalCert, veganStatus, vegetarianStatus: 'none' },
      userConfirmations: { ...confirmations },
      score: evalMain.cards.regulatoryCard.score
    };
    setScanHistory((prev) => {
      const next = [
        entry,
        ...prev.filter((p) => !(p.rawText === rawText && p.productType === productType))
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
            border: '#254235',
            accent: '#D4B26A',
            onAccent: '#0F291E',
            accentSoft: '#1D352B'
          }
        : {
            bg: '#F7F4EF',
            card: '#FFFFFF',
            subtle: '#EFECE6',
            text: '#14261D',
            muted: '#4A5950',
            border: '#DCD6CA',
            accent: '#0F291E',
            onAccent: '#F7F4EF',
            accentSoft: '#E8EFEA'
          },
    [darkMode]
  );

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev: string[]) => (prev.includes(id) ? prev.filter((p: string) => p !== id) : [...prev, id]));
  };

  const handleBarcodeLookup = async (codeOverride?: string) => {
    const targetCode = codeOverride !== undefined ? codeOverride : barcodeInput;
    setBarcodeInput(targetCode);
    const res = await lookupBarcodeOnDevice(targetCode, lang, {
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

  const handleCameraScan = async (mode: 'camera' | 'gallery') => {
    const res = await captureAndRecognizeLabel(mode);
    if (!res.cancelled && res.extractedText) {
      setBarcodeMeta(null);
      setRawText(res.extractedText);
      setConfirmations({});
      if (typeof res.confidence === 'number') {
        setOcrStatusMsg(`OCR (${Math.round(res.confidence * 100)}%)`);
      } else {
        setOcrStatusMsg('OCR OK');
      }
    } else if (res.error === 'NO_NATIVE_OCR') {
      setOcrStatusMsg('⚠️ OCR text input mode');
    } else if (res.error) {
      setOcrStatusMsg(res.error);
    }
  };

  const hasUnresolvedSls = (evalMain.unresolvedConfirmations || []).length > 0;

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
            <Text style={[styles.brandTitle, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>InciFact</Text>
            <Text style={[styles.brandSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.appTagline}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('profile')}
            style={[styles.iconBtn, { backgroundColor: theme.subtle }]}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDarkMode(!darkMode)}
            style={[styles.iconBtn, { backgroundColor: theme.subtle }]}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
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
            <Text style={[styles.sectionTitle, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.profileScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.profileScreen.subtitle}
            </Text>

            {(['hamilelik', 'cocuk_metabolik', 'hassas_cilt', 'astim_alerji', 'akne'] as const).map((pid) => {
              const active = selectedProfiles.includes(pid);
              const profText = t.profileScreen.profiles[pid];
              return (
                <TouchableOpacity
                  key={pid}
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
                    <Text style={[styles.profileName, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>
                      {profText.name}
                    </Text>
                    <Text style={[styles.profileDesc, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
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
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.text, textAlign: isRtl ? 'right' : 'left' }}>
                  🧬 {ft.watchlistTitle}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted }}>
                  {formatDigits(customWatchlist.length, lang)}/50
                </Text>
              </View>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, marginTop: 4 }}>
                <TextInput
                  value={watchInput}
                  onChangeText={setWatchInput}
                  placeholder="Niacinamide, Parfum, Salicylic Acid..."
                  placeholderTextColor={theme.muted}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.card,
                    color: theme.text,
                    paddingHorizontal: 10,
                    fontSize: 12
                  }}
                />
                <TouchableOpacity
                  onPress={() => addWatchTerm()}
                  style={{ backgroundColor: theme.accent, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12 }}>+</Text>
                </TouchableOpacity>
              </View>
              {customWatchlist.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {customWatchlist.map((term) => (
                    <TouchableOpacity
                      key={term}
                      onPress={() => removeWatchTerm(term)}
                      style={{
                        maxWidth: '100%',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 12,
                        backgroundColor: '#FCE8E6',
                        borderWidth: 1,
                        borderColor: '#991B1B'
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#991B1B' }}>🧬 {term} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Region, Country Structure & Language Settings */}
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
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: theme.text,
                  marginBottom: 4,
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                ⚙️ {langMeta.flag} {langMeta.nativeName} · {halalAuthority}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.muted,
                  marginBottom: 8,
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                {regionMode === 'auto'
                  ? `📍 Auto (${initialLocale.lang.toUpperCase()} / ${initialLocale.authority})`
                  : `${langMeta.nativeName} (${halalAuthority})`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
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
            </View>

            <TouchableOpacity
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
              <Text style={{ color: '#EAD39C', fontWeight: '700', marginBottom: 4 }}>{t.scanScreen.title}</Text>
              <Text style={{ color: '#D8D2C5', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
                {t.scanScreen.subtitle}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleCameraScan('camera')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#C5A059' }]}
                >
                  <Text style={{ color: '#0F291E', fontWeight: '800', fontSize: 12 }}>{t.scanScreen.cameraBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleCameraScan('gallery')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#163025', borderWidth: 1, borderColor: '#C5A059' }]}
                >
                  <Text style={{ color: '#EAD39C', fontWeight: '700', fontSize: 12 }}>🖼️ OCR</Text>
                </TouchableOpacity>
              </View>
              {ocrStatusMsg && (
                <Text style={{ color: '#EAD39C', fontSize: 11, marginTop: 6 }}>{ocrStatusMsg}</Text>
              )}
            </View>

            {/* Hybrid Barcode Lookup Bar (Open Food / Beauty Facts ODbL) */}
            <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6, alignItems: 'center' }}>
                <TextInput
                  value={barcodeInput}
                  onChangeText={(v: string) => setBarcodeInput(v)}
                  placeholder="EAN-13 / UPC (3017620422003)"
                  placeholderTextColor={theme.muted}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.card,
                    color: theme.text,
                    paddingHorizontal: 10,
                    fontSize: 12
                  }}
                />
                <TouchableOpacity
                  onPress={() => handleBarcodeLookup()}
                  style={{ height: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: theme.accent, justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12 }}>📦 EAN</Text>
                </TouchableOpacity>
              </View>
              {barcodeMeta && (
                <Text style={{ fontSize: 11, color: barcodeMeta.requiresOcrFallback ? '#B45309' : theme.accent, fontWeight: '700', marginTop: 6 }}>
                  {barcodeMeta.message}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginBottom: 12 }}>
              {(['cosmetic', 'food'] as ProductType[]).map((pt) => (
                <TouchableOpacity
                  key={pt}
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

            {/* Packaging Claims Toggles */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
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
              <TouchableOpacity
                onPress={() => setVeganStatus(veganStatus === 'verified' ? 'none' : 'verified')}
                style={[
                  styles.chip,
                  {
                    backgroundColor: veganStatus === 'verified' ? theme.accentSoft : theme.subtle,
                    borderColor: veganStatus === 'verified' ? theme.accent : theme.border
                  }
                ]}
              >
                <Text style={{ color: veganStatus === 'verified' ? theme.accent : theme.text, fontWeight: '700', fontSize: 12 }}>
                  {veganStatus === 'verified' ? '✓ Vegan' : '○ Vegan'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              multiline
              value={rawText}
              onChangeText={(txt: string) => {
                setBarcodeMeta(null);
                setRawText(txt);
                setConfirmations({});
              }}
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.subtle,
                  color: theme.text,
                  borderColor: theme.border,
                  textAlign: isRtl ? 'right' : 'left'
                }
              ]}
            />

            <TouchableOpacity
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
            {hasUnresolvedSls && (
              <View style={styles.ocrAlertBox}>
                <Text style={styles.ocrAlertTitle}>{t.resultScreen.ocrWarningTitle}: "Sodium Laur?l Sulfate"</Text>
                <Text style={styles.ocrAlertDesc}>SLS vs SLES:</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setConfirmations({ ...confirmations, 'Sodium Laur?l Sulfate': 'sls_inci' })}
                    style={styles.ocrChoiceBtn}
                  >
                    <Text style={styles.ocrChoiceText}>Sodium Lauryl Sulfate (SLS)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmations({ ...confirmations, 'Sodium Laur?l Sulfate': 'sles_inci' })}
                    style={styles.ocrChoiceBtn}
                  >
                    <Text style={styles.ocrChoiceText}>Sodium Laureth Sulfate (SLES)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.resultScreen.scoreLabel}: {evalMain.cards.regulatoryCard.canShowScore ? `${formatDigits(evalMain.cards.regulatoryCard.score, lang)} / ${formatDigits(100, lang)}` : `— (${formatDigits(evalMain.cards.regulatoryCard.coveragePercent, lang)}%)`}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.resultScreen.coverageLabel}: {lang === 'ar' || lang === 'ur' ? '٪' + formatDigits(evalMain.cards.regulatoryCard.coveragePercent, lang) : lang === 'tr' ? '%' + evalMain.cards.regulatoryCard.coveragePercent : evalMain.cards.regulatoryCard.coveragePercent + '%'} • {formatHalalSummaryStatus()}
            </Text>
            {evalMain.cards.regulatoryCard.findings.map((f: any, idx: number) => (
              <Text
                key={idx}
                style={{ color: theme.text, fontSize: 12, lineHeight: 19, marginBottom: 6, textAlign: isRtl ? 'right' : 'left' }}
              >
                • <Text style={{ fontWeight: '700' }}>{f.localizedName || f.name}</Text>: {f.status === 'yasak' || f.effectiveStatus === 'yasak' ? t.badges.banned : t.badges.restricted}
              </Text>
            ))}
            {(evalMain.cards.profileCard?.alerts || []).map((pa: any, idx: number) => (
              <Text
                key={`pa-${idx}`}
                style={{
                  color: (pa.level || pa.severity) === 'kirmizi' ? '#DC2626' : '#D97706',
                  fontSize: 12,
                  lineHeight: 19,
                  marginBottom: 6,
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                {(pa.level || pa.severity) === 'kirmizi' ? '🔴' : '🟡'} <Text style={{ fontWeight: '700' }}>{pa.localizedName || pa.rawToken}</Text>: {pa.explanation || pa.reason}
              </Text>
            ))}
            {evalMain.cards.halalCard.falsePositiveShields.map((sh: any, idx: number) => (
              <Text
                key={`sh-${idx}`}
                style={{ color: theme.accent, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: isRtl ? 'right' : 'left' }}
              >
                🛡️ {sh.canonical}: {t.halalScreen.shieldTitle}
              </Text>
            ))}

            {/* Share Result Card & 1-Click Compare A/B Assignment */}
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={handleShareResultCard}
                style={[styles.chip, { flex: 1, backgroundColor: theme.accent, borderColor: theme.accent, alignItems: 'center' }]}
              >
                <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: 12 }}>
                  📤 {ft.shareCardBtn}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => assignCurrentToCompare('A')}
                style={[styles.chip, { backgroundColor: theme.subtle, borderColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>🅰️ A</Text>
              </TouchableOpacity>
              <TouchableOpacity
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
                    borderColor: '#D97706',
                    backgroundColor: theme.subtle
                  }}
                >
                  <Text style={{ color: '#D97706', fontWeight: '800', fontSize: 13, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                    {evalMain.cards.routineConflictCard.cardTitle}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
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
                      <Text style={{ color: rc.severity === 'kirmizi' ? '#DC2626' : '#D97706', fontWeight: '800', fontSize: 11.5, textAlign: isRtl ? 'right' : 'left' }}>
                        ⚡ {rc.severityLabel} · {rc.detectedPair}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3, textAlign: isRtl ? 'right' : 'left' }}>
                        {evalMain.cards.routineConflictCard.whyLabel} {rc.whyConflict}
                      </Text>
                      <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 11.5, marginTop: 4, textAlign: isRtl ? 'right' : 'left' }}>
                        🛡️ {evalMain.cards.routineConflictCard.routineTipLabel}: {rc.howToLayer}
                      </Text>
                    </View>
                  ))}
                  {evalMain.cards.routineConflictCard.needsSpfReminder && (
                    <Text style={{ color: '#D97706', fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: isRtl ? 'right' : 'left' }}>
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
                <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 13, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                  {evalMain.cards.swapGuideCard.cardTitle}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
                  {evalMain.cards.swapGuideCard.cardSubtitle}
                </Text>
                {(evalMain.cards.swapGuideCard.items || []).length === 0 ? (
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700', textAlign: isRtl ? 'right' : 'left' }}>
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
                      <Text style={{ color: sw.severity === 'kirmizi' ? '#DC2626' : '#D97706', fontWeight: '800', fontSize: 11.5, textAlign: isRtl ? 'right' : 'left' }}>
                        ❌ {evalMain.cards.swapGuideCard.detectedLabel}: {sw.detectedIngredient}
                      </Text>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12, marginTop: 4, textAlign: isRtl ? 'right' : 'left' }}>
                        ✅ {evalMain.cards.swapGuideCard.lookForLabel}: {sw.lookForInstead}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3, textAlign: isRtl ? 'right' : 'left' }}>
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
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                  {evalMain.cards.regulatoryReportCard.cardTitle} (v{evalMain.cards.regulatoryReportCard.datasetManifest.datasetVersion})
                </Text>
                <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16, textAlign: isRtl ? 'right' : 'left' }}>
                  {evalMain.cards.regulatoryReportCard.cardSubtitle}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* SCREEN 4: HALAL (LIVE AUTHORITY ENGINE) */}
        {activeTab === 'halal' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.halalScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.halalScreen.authoritySelectLabel}
            </Text>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {(['GIMDES', 'JAKIM', 'MUI', 'IFANCA'] as HalalAuthority[]).map((auth) => (
                <TouchableOpacity
                  key={auth}
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
                  style={{ color: theme.text, fontSize: 13, lineHeight: 20, marginBottom: 6, textAlign: isRtl ? 'right' : 'left' }}
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
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20, textAlign: isRtl ? 'right' : 'left' }}>
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
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.accent, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
                  🔎 {ac.localizedName || ac.canonical}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {(['GIMDES', 'JAKIM', 'MUI', 'IFANCA'] as HalalAuthority[]).map((ak) => {
                    const st = ac.authorityMatrix ? ac.authorityMatrix[ak] : 'sari';
                    const isCurr = halalAuthority === ak;
                    const cellBg = st === 'yesil' ? '#E4F2EA' : st === 'kirmizi' || st === 'conflict' ? '#FCE8E6' : '#FDF0DF';
                    const cellFg = st === 'yesil' ? '#145A32' : st === 'kirmizi' || st === 'conflict' ? '#991B1B' : '#8A3B08';
                    const stWord = st === 'yesil' ? t.badges.halalOk : st === 'kirmizi' || st === 'conflict' ? t.badges.halalRed : t.badges.musbooh;
                    return (
                      <TouchableOpacity
                        key={ak}
                        onPress={() => setHalalAuthority(ak)}
                        style={{
                          width: '47%',
                          minHeight: 46,
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: cellBg,
                          borderWidth: isCurr ? 2 : 1,
                          borderColor: isCurr ? theme.accent : cellFg
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#14261D' }}>
                          {ak}{isCurr ? ' ✓' : ''}
                        </Text>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: cellFg }}>
                          {stWord}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17, textAlign: isRtl ? 'right' : 'left' }}>
                  {ac.reason}
                </Text>
              </View>
            ))}
            {evalMain.cards.halalCard.falsePositiveShields.map((sh: any, idx: number) => (
              <Text
                key={idx}
                style={{ color: theme.accent, fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: isRtl ? 'right' : 'left' }}
              >
                🛡️ {sh.canonical}: {t.halalScreen.shieldTitle}
              </Text>
            ))}

            <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: theme.subtle, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 11, color: theme.muted, lineHeight: 16, textAlign: isRtl ? 'right' : 'left' }}>
                ⚖️ {t.halalScreen.legalDisclaimerMicro || ''}
              </Text>
            </View>
          </View>
        )}

        {/* SCREEN 5: SIDE-BY-SIDE COMPARE (LIVE COMPARISON) */}
        {activeTab === 'compare' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.compareScreen.title}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.compareScreen.subtitle}
            </Text>

            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 12 }}>
              <View style={[styles.compareCol, { backgroundColor: theme.subtle, borderColor: comparison.productA.score !== null && comparison.productA.score >= (comparison.productB.score || 0) ? theme.accent : theme.border }]}>
                <Text style={{ fontWeight: '800', color: theme.accent }}>{comparison.productA.name}</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: comparison.productA.hasBanned ? '#991B1B' : '#145A32', marginVertical: 4 }}>
                  {comparison.productA.canShowScore ? `${formatDigits(comparison.productA.score, lang)} / ${formatDigits(100, lang)}` : '—'}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted }}>
                  {t.compareScreen.euBanRow}: {comparison.productA.hasBanned ? t.badges.present : t.badges.none}
                  {'\n'}
                  {t.compareScreen.profileRow}: {comparison.productA.profileStatusLocalized}
                  {'\n'}
                  {t.compareScreen.halalRow}: {comparison.productA.halalStatusLocalized}
                </Text>
              </View>
              <View style={[styles.compareCol, { backgroundColor: theme.subtle, borderColor: comparison.productB.score !== null && comparison.productB.score > (comparison.productA.score || 0) ? theme.accent : theme.border }]}>
                <Text style={{ fontWeight: '800', color: theme.text }}>{comparison.productB.name}</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: comparison.productB.hasBanned ? '#991B1B' : '#145A32', marginVertical: 4 }}>
                  {comparison.productB.canShowScore ? `${formatDigits(comparison.productB.score, lang)} / ${formatDigits(100, lang)}` : '—'}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted }}>
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
                <Text style={{ fontWeight: '800', color: '#8A3B08', marginBottom: 4 }}>
                  ⚡ {comparison.decidingDifference.headline}
                </Text>
                <Text style={{ fontSize: 12, color: '#8A3B08', lineHeight: 18 }}>
                  {comparison.decidingDifference.explanation}
                </Text>
              </View>
            )}

            {comparison.routineLayeringCard?.applicable && (comparison.routineLayeringCard.conflicts || []).length > 0 && (
              <View style={[styles.diffBox, { marginTop: 10 }]}>
                <Text style={{ fontWeight: '800', color: '#8A3B08', marginBottom: 4 }}>
                  {comparison.routineLayeringCard.compareLayerTitle}
                </Text>
                {(comparison.routineLayeringCard.conflicts || []).map((rc: any, idx: number) => (
                  <View key={rc.conflictId || idx} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#991B1B' }}>
                      {rc.severityLabel} · {rc.detectedPair}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#8A3B08', marginTop: 2 }}>
                      {rc.howToLayer}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Scans History with 1-Click A/B Assignment */}
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
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
                    borderBottomColor: theme.border
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }}>
                    {item.name} ({item.score !== null ? `${item.score}/100` : '—'})
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSlotA(item)}
                      style={[styles.chip, { paddingVertical: 5, paddingHorizontal: 10, backgroundColor: theme.subtle, borderColor: theme.border }]}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.text }}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSlotB(item)}
                      style={[styles.chip, { paddingVertical: 5, paddingHorizontal: 10, backgroundColor: theme.subtle, borderColor: theme.border }]}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.text }}>B</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Paywall Modal */}
      <Modal visible={paywallVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>InciFact Pro</Text>
            <Text style={[styles.sectionSub, { color: theme.muted }]}>
              {t.compareScreen.subtitle} • GIMDES / JAKIM / MUI / IFANCA
            </Text>
            <TouchableOpacity
              onPress={() => setPaywallVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>InciFact Pro ($29.99/yr)</Text>
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
  iconBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  proBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  proBtnText: { color: '#0B132B', fontWeight: '800', fontSize: 12 },
  langBar: { paddingVertical: 8, borderBottomWidth: 1 },
  langChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, paddingVertical: 11, alignItems: 'center' },
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
  primaryBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  viewfinder: {
    backgroundColor: '#13221C',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12
  },
  cameraActionBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
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
    flex: 1
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
