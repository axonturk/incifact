import React, { useState, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal
} from 'react-native';
import { captureAndRecognizeLabel } from './ocrService';
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
  const [halalAuthority, setHalalAuthority] = useState<HalalAuthority>(initialLocale.authority);
  const [halalCert, setHalalCert] = useState(false);
  const [veganStatus, setVeganStatus] = useState<'none' | 'declared' | 'verified'>('none');

  const [rawText, setRawText] = useState(
    'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Sodium Laur?l Sulfate, Phenoxyethanol, Niacinamide, Panthenol, Butylphenyl Methylpropional, Limonene'
  );
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);

  // Side-by-side comparison state
  const [compNameA, setCompNameA] = useState('CeraVe Nemlendirici Krem (A)');
  const [compTextA, setCompTextA] = useState(
    'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceteareth-20, Petrolatum, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Tocopherol'
  );
  const [compNameB, setCompNameB] = useState('Klasik Gece Kremi (B)');
  const [compTextB, setCompTextB] = useState(
    'Ingredients: Aqua, Glycerin, Isopropyl Myristate, Cetearyl Alcohol, Propylparaben, Butylphenyl Methylpropional, Methylisothiazolinone, Parfum, Linalool'
  );

  const langMeta = useMemo(
    () => SUPPORTED_LANGUAGES.find((l: any) => l.code === lang) || SUPPORTED_LANGUAGES[0],
    [lang]
  );
  const isRtl = langMeta.dir === 'rtl';
  const t = useMemo(() => getLocaleStrings(lang), [lang]);

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
        userProfiles: selectedProfiles,
        halalAuthority,
        claims: {
          halalCertified: halalCert,
          veganStatus,
          vegetarianStatus: 'none'
        },
        userConfirmations: confirmations,
        lang
      }),
    [rawText, productType, selectedProfiles, halalAuthority, halalCert, veganStatus, confirmations, lang]
  );

  const evalCompA = useMemo(
    () =>
      evaluateProduct({
        rawText: compTextA,
        productType,
        userProfiles: selectedProfiles,
        halalAuthority,
        claims: { halalCertified: false, veganStatus: 'none', vegetarianStatus: 'none' },
        userConfirmations: {},
        lang
      }),
    [compTextA, productType, selectedProfiles, halalAuthority, lang]
  );

  const evalCompB = useMemo(
    () =>
      evaluateProduct({
        rawText: compTextB,
        productType,
        userProfiles: selectedProfiles,
        halalAuthority,
        claims: { halalCertified: false, veganStatus: 'none', vegetarianStatus: 'none' },
        userConfirmations: {},
        lang
      }),
    [compTextB, productType, selectedProfiles, halalAuthority, lang]
  );

  const comparison = useMemo(
    () => compareProducts(evalCompA, evalCompB, compNameA, compNameB, lang),
    [evalCompA, evalCompB, compNameA, compNameB, lang]
  );

  const theme = useMemo(
    () =>
      darkMode
        ? {
            bg: '#070C18',
            card: '#0B132B',
            subtle: '#131F3F',
            text: '#F1F5F9',
            muted: '#94A3B8',
            border: '#1F2E52',
            accent: '#D4AF37',
            accentSoft: '#1F2A44'
          }
        : {
            bg: '#F8F9FA',
            card: '#FFFFFF',
            subtle: '#EEF2F6',
            text: '#0B132B',
            muted: '#4A5568',
            border: '#E2E8F0',
            accent: '#0B132B',
            accentSoft: '#E9ECEF'
          },
    [darkMode]
  );

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleCameraScan = async (mode: 'camera' | 'gallery') => {
    const res = await captureAndRecognizeLabel(mode);
    if (!res.cancelled && res.extractedText) {
      setRawText(res.extractedText);
      setConfirmations({});
      if (typeof res.confidence === 'number') {
        setOcrStatusMsg(`OCR metni başarıyla okundu (%${Math.round(res.confidence * 100)} güven).`);
      } else {
        setOcrStatusMsg('OCR metni başarıyla okundu.');
      }
    } else if (res.error === 'NO_NATIVE_OCR') {
      setOcrStatusMsg('⚠️ Yerel OCR motoru bu simülatörde bulunamadı. Lütfen metni yapıştırarak analiz ediniz.');
    } else if (res.error) {
      setOcrStatusMsg(res.error);
    }
  };

  const hasUnresolvedSls = (evalMain.unresolvedConfirmations || []).length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Bar (No main-screen language bar; auto-detects device locale and provides Settings shortcut) */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border, flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
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
            style={[styles.proBtn, { backgroundColor: '#D4AF37' }]}
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

            {/* Region, Country Structure & Language Settings (Inside Settings/Profile, not on main header) */}
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
              <Text
                style={{
                  fontSize: 11,
                  lineHeight: 15,
                  color: theme.muted,
                  marginTop: 8,
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                {lang === 'tr'
                  ? `🌍 Seçilen ülkeye göre (${langMeta.flag} ${langMeta.nativeName}) dil ve ${halalAuthority} helal kriteri otomatik eşleşir. Ülke veya kurum değiştirdiğinizde aynı ürünün sonucu değişebilir (ör. E120 Karmin veya Salyangoz Müsini GİMDES'te uygunsuzken diğer ülke standartlarında farklı değerlendirilir). Kurum adları yalnızca kamuya açık standartlarıyla bilgi amaçlı karşılaştırma içindir.`
                  : `🌍 Language and the ${halalAuthority} Halal standard are automatically matched to the selected region (${langMeta.flag} ${langMeta.nativeName}). Switching country or authority can change a product's verdict. Institution names are referenced strictly for informational comparison against their public standards.`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setActiveTab('scan')}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.primaryBtnText}>{t.profileScreen.continueBtn}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SCREEN 2: SCAN (OCR) */}
        {activeTab === 'scan' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.viewfinder}>
              <Text style={{ color: '#9FF3DF', fontWeight: '700', marginBottom: 4 }}>{t.scanScreen.title}</Text>
              <Text style={{ color: '#D1DFD8', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
                {t.scanScreen.subtitle}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleCameraScan('camera')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#10B981' }]}
                >
                  <Text style={{ color: '#052E24', fontWeight: '800', fontSize: 12 }}>{t.scanScreen.cameraBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleCameraScan('gallery')}
                  style={[styles.cameraActionBtn, { backgroundColor: '#1E2924', borderWidth: 1, borderColor: '#34D399' }]}
                >
                  <Text style={{ color: '#A7F3D0', fontWeight: '700', fontSize: 12 }}>🖼️ OCR</Text>
                </TouchableOpacity>
              </View>
              {ocrStatusMsg && (
                <Text style={{ color: '#A7F3D0', fontSize: 11, marginTop: 6 }}>{ocrStatusMsg}</Text>
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
              onChangeText={(txt) => {
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
              onPress={() => setActiveTab('result')}
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.primaryBtnText}>{t.scanScreen.analyzeBtn}</Text>
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
              {t.resultScreen.scoreLabel}: {evalMain.cards.regulatoryCard.canShowScore ? `${formatDigits(evalMain.cards.regulatoryCard.score, lang)} / ${formatDigits(100, lang)}` : `— (${formatDigits(evalMain.coveragePercent, lang)}%)`}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.muted, textAlign: isRtl ? 'right' : 'left' }]}>
              {t.resultScreen.coverageLabel}: {lang === 'ar' || lang === 'ur' ? '٪' + formatDigits(evalMain.coveragePercent, lang) : '%' + evalMain.coveragePercent} • {t.halalScreen.veganSugarTitle}: {formatDigits(evalMain.cards.veganSugarCard.freeSugarCount, lang)}
            </Text>
            {evalMain.cards.regulatoryCard.findings.map((f: any, idx: number) => (
              <Text
                key={idx}
                style={{ color: theme.text, fontSize: 12, lineHeight: 19, marginBottom: 6, textAlign: isRtl ? 'right' : 'left' }}
              >
                • <Text style={{ fontWeight: '700' }}>{f.localizedName || f.name}</Text>: {f.status === 'yasak' || f.effectiveStatus === 'yasak' ? t.badges.banned : t.badges.restricted}
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
                  • {hf.canonical} ({hf.rawToken}):{' '}
                  {hf.status === 'kirmizi'
                    ? `🔴 ${t.badges.halalRed}`
                    : hf.status === 'yesil'
                    ? `🟢 ${t.badges.halalOk}`
                    : hf.status === 'conflict'
                    ? `⚠️ ${t.badges.conflict || 'Çelişki'}`
                    : `🟡 ${t.badges.musbooh}`}
                </Text>
              ))
            ) : (
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20, textAlign: isRtl ? 'right' : 'left' }}>
                {evalMain.cards.halalCard.overallStatus === 'uygun_gorunuyor'
                  ? `🟢 ${t.badges.halalOk} — ${t.badges.none}`
                  : evalMain.cards.halalCard.overallStatus === 'kapsam_yetersiz'
                  ? `🟡 ${t.badges.musbooh} — ${t.badges.lowCoverage || 'Kapsam <%80'}`
                  : `— ${t.badges.none}`}
              </Text>
            )}
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
                ⚖️ {t.halalScreen.legalDisclaimerMicro || 'Bu analiz seçilen kurumların kamuya açık standartlarına dayalı bağımsız bir algoritmik ön incelemedir. Resmi tescil niteliğinde değildir.'}
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
                <Text style={{ fontSize: 22, fontWeight: '800', color: comparison.productA.hasBanned ? '#B42318' : '#1F6F50', marginVertical: 4 }}>
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
                <Text style={{ fontSize: 22, fontWeight: '800', color: comparison.productB.hasBanned ? '#B42318' : '#1F6F50', marginVertical: 4 }}>
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
                <Text style={{ fontWeight: '800', color: '#8F4B00', marginBottom: 4 }}>
                  {t.compareScreen.decidingTitle}: {comparison.decidingDifference.productName} → {comparison.decidingDifference.itemName}
                </Text>
                <Text style={{ fontSize: 12, color: '#8F4B00', lineHeight: 18 }}>
                  {comparison.decidingDifference.reason}
                </Text>
              </View>
            )}
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
              <Text style={styles.primaryBtnText}>InciFact Pro ($29.99/yr)</Text>
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
