/**
 * InciFact — 10-Language Global Localization & Market Intelligence Module
 * Target Languages:
 * 1. tr (Türkçe)           - Turkey & EU Turkish Diaspora
 * 2. en (English)          - USA, UK, Canada, Australia, Global
 * 3. ar (العربية - RTL)    - Saudi Arabia, UAE, Qatar, Kuwait, Egypt, MENA
 * 4. de (Deutsch)          - Germany, Austria, Switzerland (DACH)
 * 5. fr (Français)         - France, Belgium, Canada, North/West Africa
 * 6. id (Bahasa Indonesia) - Indonesia (#1 Global Halal Market - MUI/BPJPH)
 * 7. ms (Bahasa Melayu)    - Malaysia, Brunei, Singapore (JAKIM Standard)
 * 8. es (Español)          - Spain, US Hispanic, Latin America
 * 9. ru (Русский)          - Kazakhstan, Uzbekistan, Azerbaijan, CIS
 * 10. ur (اردو - RTL)      - Pakistan, UK/GCC/North America Diaspora
 */

export const SUPPORTED_LANGUAGES = [
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    dir: 'ltr',
    defaultAuthority: 'GIMDES',
    primaryMarkets: ['Türkiye', 'Almanya/Avrupa Diasporası'],
    marketRationale: 'Yüksek içerik okuma bilinci + GİMDES helal hassasiyeti (E120, E904, E920).'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['USA', 'UK', 'Canada', 'Australia'],
    marketRationale: 'App Store abonelik gelirinde (ARPU) #1 pazar; hızla büyüyen Clean Beauty + 8M+ Batı Müslüman diasporası.'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    dir: 'rtl',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['Saudi Arabia (KSA)', 'UAE', 'Qatar', 'Kuwait', 'Egypt'],
    marketRationale: 'Kişi başı en yüksek helal kozmetik ve gıda harcaması; Körfez (GCC) iOS payı >%65 ve en yüksek ödeme istekliliği.'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    dir: 'ltr',
    defaultAuthority: 'GIMDES',
    primaryMarkets: ['Deutschland', 'Österreich', 'Schweiz (DACH)'],
    marketRationale: 'Avrupa\'nın #1 "Naturkosmetik" (Temiz İçerik) pazarı + dm/Rossmann alışverişinde E-kodu arayan 6M+ Müslüman nüfus.'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    dir: 'ltr',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['France', 'Belgique', 'Canada (Québec)', 'Maghreb'],
    marketRationale: 'Dünyada içerik tarama alışkanlığının merkezi (her 3 Fransızdan 1\'i tarayıcı kullanıyor) + Avrupa\'nın en büyük Müslüman nüfusu.'
  },
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    dir: 'ltr',
    defaultAuthority: 'MUI',
    primaryMarkets: ['Indonesia (240M+ Müslüman Tüketici)'],
    marketRationale: 'Hacim olarak dünyanın #1 helal kozmetik ve gıda pazarı; 2024–2026 zorunlu BPJPH/MUI helal yasasıyla günlük etiket kontrolü.'
  },
  {
    code: 'ms',
    name: 'Malay',
    nativeName: 'Bahasa Melayu',
    flag: '🇲🇾',
    dir: 'ltr',
    defaultAuthority: 'JAKIM',
    primaryMarkets: ['Malaysia', 'Brunei', 'Singapore'],
    marketRationale: 'Küresel helal regülasyon standardı (JAKIM) merkezi; Güneydoğu Asya\'nın en yüksek mobil uygulama gelir (ARPU) pazarı.'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    dir: 'ltr',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['España', 'USA (Hispanic)', 'México', 'LatAm'],
    marketRationale: 'Yuka ve INCI Beauty\'nin en hızlı büyüyen ilk 3 dilinden biri; AB vs FDA katkı maddesi farkı ve hamilelik güvenliği talebi.'
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇰🇿',
    dir: 'ltr',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['Kazakhstan', 'Uzbekistan', 'Azerbaijan', 'CIS'],
    marketRationale: 'Orta Asya (Kazakistan, Özbekistan, Azerbaycan) ve BDT genelinde 60M+ Müslüman tüketicinin ortak etiket ve INCI analiz dili.'
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇵🇰',
    dir: 'rtl',
    defaultAuthority: 'IFANCA',
    primaryMarkets: ['Pakistan', 'UK / UAE / US South Asian Diaspora'],
    marketRationale: '240M+ nüfus ve İngiltere/Körfez/Kuzey Amerika\'daki yüksek gelirli Güney Asya diasporasının birincil helal tarayıcı dili.'
  }
];

export const UI_STRINGS = {
  tr: {
    appTagline: 'Kozmetik, Gıda & Helal İçerik Analizi',
    tabs: {
      profile: '1. Profil',
      scan: '2. Tara (OCR)',
      result: '3. Sonuç',
      halal: '4. Helal',
      compare: '5. Karşılaştır'
    },
    profileScreen: {
      title: 'Kimin için tarıyorsun?',
      subtitle: 'Tercihlerin cihazında işlenir; bulut hesabı ve reklam takibi yoktur. Aynı ürün farklı kişilere aynı sonucu vermez.',
      profiles: {
        hamilelik: { name: 'Hamilelik & Emzirme', desc: 'Retinoidler, yüksek konsantrasyon salisilik asit ve şüpheli UV filtrelerini işaretler.' },
        cocuk_metabolik: { name: 'Bebek & Çocuk', desc: 'Southampton 6 sentetik boyaları, nitritleri, boratları ve sert koruyucuları öne çıkarır.' },
        hassas_cilt: { name: 'Hassas / Atopik Cilt', desc: '80+ (AB 2023/1545) parfüm alerjeni, MI/MCI, SLS ve ilk 5 sıradaki kurutucu alkolü yakalar.' },
        astim_alerji: { name: 'Alerji & Astım', desc: 'Sülfitler (E220-E228), formaldehit salıcılar ve saç boyası duyarlılaştırıcılarını bildirir.' },
        akne: { name: 'Akneye Meyilli Cilt', desc: 'Genel puanı düşürmeden yalnız komedojenik ester ve ağır yağları uyarır.' },
        fungal_acne: { name: 'Fungal Akne (Malassezia)', desc: 'Polisorbatlar, yağ asitleri ve Malassezia mayasını besleyen esterleri işaretler.' },
        egzama_rosacea: { name: 'Egzama & Rozasea', desc: 'Bariyer zayıflatan kurutucu alkol, esansiyel yağ, mentol, BIT ve asitleri bildirir.' }
      },
      halalSectionTitle: 'Helal & Yaşam Tarzı Filtresi',
      authorityLabel: 'Helal Fetva / Standart Otoritesi',
      claimsLabel: 'Ürün Üzerindeki Beyan / Sertifika',
      continueBtn: 'Devam et — Taramaya geç →',
      privacyNote: 'Gizlilik: Sağlık ve inanç seçimlerin KVKK md. 6 ve GDPR md. 9 kapsamında özel nitelikli veridir. Hesap açtırmıyoruz; uzak sunucuda/bulutta kaydetmiyoruz ve üçüncü taraflara göndermiyoruz (tercihlerin, özel kara listen ve son taramaların yalnızca bu cihazın yerel hafızasında tutulur ve istediğin an silinebilir).'
    },
    scanScreen: {
      title: 'İçindekiler Kısmını Hizala',
      subtitle: 'Barkod şart değil. Etiketin "Ingredients / İçindekiler" bölümünü kameraya göster veya aşağıya yapıştır.',
      cameraBtn: '📷 Kamerayla Etiket Fotoğrafı Çek / Seç',
      productTypeCosmetic: 'Kozmetik (INCI)',
      productTypeFood: 'Gıda (E-Kodu)',
      presetsLabel: 'Hızlı Test Senaryoları (Tek Tıkla Yükle):',
      analyzeBtn: 'Bileşenleri Analiz Et →'
    },
    resultScreen: {
      title: 'Ürün Analiz Özeti',
      shareBtn: 'Özet Kartını Paylaş',
      scoreLabel: 'GENEL REGÜLASYON ENDEKSİ',
      coverageLabel: 'Tanınan Kapsam',
      recognizedLabel: 'Tanınan Madde',
      profileStatusLabel: 'Profil Uyumu',
      halalSummaryLabel: 'Helal Özeti',
      ocrWarningTitle: 'Okuma Belirsizliği — Onayın Gerekiyor',
      ingredientsTitle: 'Bileşen Analizi & Resmi Kaynaklar'
    },
    halalScreen: {
      title: 'Helal & Etanol Bağlam Motoru',
      authoritySelectLabel: 'Kriter Otoritesini Değiştir:',
      shieldTitle: 'Yanlış Alarm Koruması (Etil Alkol Değildir)',
      findingsTitle: 'Tespit Edilen Helal / Kaynak Bulguları',
      veganSugarTitle: 'Vegan Uyum & Gizli Şeker Sayacı',
      freeSugarCountLabel: 'Tespit Edilen Serbest Şeker',
      rapidCarbLabel: 'Hızlı Karbonhidrat (Maltodekstrin)'
    },
    compareScreen: {
      title: 'Yan Yana Karşılaştırma',
      subtitle: 'Kararsız kaldığın iki ürünü yan yana koy; farkı yaratan tek maddeyi anında gör.',
      productALabel: '1. Ürün (A)',
      productBLabel: '2. Ürün (B)',
      compareBtn: '⚡ İki Ürünü Yan Yana Karşılaştır',
      criteriaCol: 'Kriter',
      regScoreRow: 'Regülasyon Skoru',
      euBanRow: 'AB Yasaklı Madde',
      attentionRow: 'Dikkat / Uyarı Sayısı',
      profileRow: 'Profiline Uyum',
      halalRow: 'Helal Durumu',
      decidingTitle: 'Farkı Yaratan Madde'
    },
    badges: {
      allowed: 'İzinli',
      restricted: 'Kısıtlı',
      banned: 'AB Yasaklı',
      suitable: 'Uygun',
      avoid: 'Kaçın / Dikkat',
      halalOk: 'Uygun Görünüyor',
      musbooh: 'Şüpheli (kaynağı belirsiz)',
      halalRed: 'Uygunsuz / Çelişki',
      conflict: 'Etiket Çelişkisi!',
      none: 'Yok',
      present: 'Var!',
      lowCoverage: 'Kapsam Yetersiz (<%80)',
      unrecognized: 'Tanınmadı'
    }
  },

  en: {
    appTagline: 'Cosmetic, Food & Halal Ingredient Scanner',
    tabs: {
      profile: '1. Profile',
      scan: '2. Scan (OCR)',
      result: '3. Result',
      halal: '4. Halal',
      compare: '5. Compare'
    },
    profileScreen: {
      title: 'Who are you scanning for?',
      subtitle: 'Your choices are processed on your device with no cloud accounts or ad tracking. The same product affects different people differently.',
      profiles: {
        hamilelik: { name: 'Pregnancy & Nursing', desc: 'Flags retinoids, high-concentration salicylic acid, and suspected endocrine UV filters.' },
        cocuk_metabolik: { name: 'Baby & Child', desc: 'Highlights Southampton 6 synthetic dyes, nitrites, borates, and harsh preservatives.' },
        hassas_cilt: { name: 'Sensitive / Eczema Skin', desc: 'Catches 80+ (EU 2023/1545) fragrance allergens, MI/MCI, SLS, and top-5 drying denatured alcohol.' },
        astim_alerji: { name: 'Allergy & Asthma', desc: 'Flags sulfites (E220–E228), formaldehyde releasers, and hair-dye sensitizers.' },
        akne: { name: 'Acne-Prone Skin', desc: 'Warns about comedogenic esters and heavy oils without distorting the general safety score.' },
        fungal_acne: { name: 'Fungal Acne (Malassezia)', desc: 'Flags polysorbates, fatty acids, and esters that feed Malassezia folliculitis without affecting base score.' },
        egzama_rosacea: { name: 'Eczema & Rosacea', desc: 'Flags flushing triggers, menthol, essential oils, drying alcohols, BIT, and barrier-stripping acids.' }
      },
      halalSectionTitle: 'Halal & Lifestyle Filter',
      authorityLabel: 'Halal Standard Authority',
      claimsLabel: 'Product Label Claims / Certificates',
      continueBtn: 'Continue — Go to Scanner →',
      privacyNote: 'Privacy: Health & faith preferences are special-category data under GDPR Art. 9. No account, no cloud/server storage, nothing sent to third parties (your preferences, personal blacklist, and scan history are kept only in local device storage and can be cleared anytime).'
    },
    scanScreen: {
      title: 'Align the Ingredients List',
      subtitle: 'No barcode needed. Point your camera at the "Ingredients / INCI" text on any package or paste below.',
      cameraBtn: '📷 Scan Label with Camera / Photo',
      productTypeCosmetic: 'Cosmetic (INCI)',
      productTypeFood: 'Food (E-Codes)',
      presetsLabel: 'Quick Test Presets (1-Tap Load):',
      analyzeBtn: 'Analyze Ingredients →'
    },
    resultScreen: {
      title: 'Product Analysis Summary',
      shareBtn: 'Share Analysis Card',
      scoreLabel: 'REGULATORY TRANSPARENCY INDEX',
      coverageLabel: 'Recognized Coverage',
      recognizedLabel: 'Recognized Items',
      profileStatusLabel: 'Profile Match',
      halalSummaryLabel: 'Halal Summary',
      ocrWarningTitle: 'OCR Ambiguity — Your Confirmation Needed',
      ingredientsTitle: 'Ingredient Breakdown & Official Citations'
    },
    halalScreen: {
      title: 'Halal & Ethanol Context Engine',
      authoritySelectLabel: 'Switch Ruling Authority:',
      shieldTitle: 'False-Positive Shield (Not Intoxicating Ethanol)',
      findingsTitle: 'Halal & Source Origin Findings',
      veganSugarTitle: 'Vegan Compatibility & Hidden Sugar Counter',
      freeSugarCountLabel: 'Detected Free Sugars',
      rapidCarbLabel: 'Rapid Carbohydrate (Maltodextrin)'
    },
    compareScreen: {
      title: 'Side-by-Side Comparison',
      subtitle: 'Compare two products head-to-head and immediately spot the single deciding ingredient.',
      productALabel: 'Product 1 (A)',
      productBLabel: 'Product 2 (B)',
      compareBtn: '⚡ Compare Products Side-by-Side',
      criteriaCol: 'Criterion',
      regScoreRow: 'Regulatory Score',
      euBanRow: 'EU Banned Substance',
      attentionRow: 'Attention / Alerts',
      profileRow: 'Your Profile Fit',
      halalRow: 'Halal Status',
      decidingTitle: 'Deciding Ingredient Difference'
    },
    badges: {
      allowed: 'Permitted',
      restricted: 'Restricted',
      banned: 'EU Banned',
      suitable: 'Suitable',
      avoid: 'Avoid / Caution',
      halalOk: 'Appears Halal',
      musbooh: 'Doubtful (source unclear)',
      halalRed: 'Non-Compliant / Conflict',
      conflict: 'Label Conflict!',
      none: 'None',
      present: 'Present!',
      lowCoverage: 'Insufficient Coverage (<80%)',
      unrecognized: 'Unrecognized'
    }
  },

  ar: {
    appTagline: 'فاحص مكونات التجميل والغذاء والحلال',
    tabs: {
      profile: '١. ملفي',
      scan: '٢. مسح (OCR)',
      result: '٣. النتيجة',
      halal: '٤. الحلال',
      compare: '٥. مقارنة'
    },
    profileScreen: {
      title: 'لمن تقوم بفحص المنتج؟',
      subtitle: 'تُعالَج اختياراتك على جهازك دون حسابات سحابية أو تتبع إعلاني. المنتج نفسه لا يؤثر على الجميع بالطريقة نفسها.',
      profiles: {
        hamilelik: { name: 'الحمل والرضاعة', desc: 'ينبهك من الريتينويدات وحمض الساليسيليك بتركيز عالٍ وفلاتر الشمس المشتبه بها.' },
        cocuk_metabolik: { name: 'الأطفال والرضع', desc: 'يكشف ألوان ساوثهامبتون الستة والنيتريت والبورات والمواد الحافظة القوية.' },
        hassas_cilt: { name: 'البشرة الحساسة والأكزيما', desc: 'يرصد 80+ (EU 2023/1545) مادة عطرية مسببة للحساسية و MI/MCI و SLS والكحول المجفف في أول ٥ مكونات.' },
        astim_alerji: { name: 'الحساسية والربو', desc: 'ينبهك من الكبريتيت (E220-E228) ومحررات الفورمالديهايد ومسببات حساسية صبغات الشعر.' },
        akne: { name: 'البشرة المعرضة لحب الشباب', desc: 'يحذر من الإسترات والزيوت السادة للمسام دون خفض المؤشر التنظيمي العام.' },
        fungal_acne: { name: 'حب الشباب الفطري (Malassezia)', desc: 'يرصد البوليسوربات والأحماض الدهنية والإسترات المغذية لفطر المالاسيزيا دون خفض الدرجة العامة.' },
        egzama_rosacea: { name: 'الإكزيما والوردية', desc: 'ينبه من مهيجات الاحمرار والمنثول والزيوت العطرية والكحول المجفف والأحماض القوية.' }
      },
      halalSectionTitle: 'فلتر الحلال ونمط الحياة',
      authorityLabel: 'هيئة معايير الحلال المعتمدة',
      claimsLabel: 'شهادات المنتج على العبوة',
      continueBtn: 'متابعة — انتقل إلى الماسح ←',
      privacyNote: 'الخصوصية: تفضيلات الصحة والعقيدة بيانات حساسة وفق المادة 9 من GDPR. لا ننشئ حساباً ولا نرسلها للسحابة أو جهات إعلانية؛ تُحفظ اختياراتك وقائمتك السوداء وسجل الفحص محلياً على جهازك فقط ويمكنك مسحها في أي وقت.'
    },
    scanScreen: {
      title: 'وجّه الكاميرا نحو قائمة المكونات',
      subtitle: 'لا حاجة للباركود. التقط صورة لقسم "المكونات / Ingredients" أو الصق النص أدناه.',
      cameraBtn: '📷 مسح الملصق بالكاميرا / صورة',
      productTypeCosmetic: 'تجميل وعناية (INCI)',
      productTypeFood: 'غذاء ومشروبات (رموز E)',
      presetsLabel: 'نماذج اختبار سريعة (بضغطة واحدة):',
      analyzeBtn: 'تحليل المكونات ←'
    },
    resultScreen: {
      title: 'ملخص تحليل المنتج',
      shareBtn: 'مشاركة بطاقة النتيجة',
      scoreLabel: 'مؤشر الشفافية والامتثال التنظيمي',
      coverageLabel: 'نسبة التغطية',
      recognizedLabel: 'مكونات معروفة',
      profileStatusLabel: 'توافق ملفك',
      halalSummaryLabel: 'ملخص الحلال',
      ocrWarningTitle: 'التباس في القراءة — يرجى التأكيد',
      ingredientsTitle: 'تفصيل المكونات والمصادر الرسمية'
    },
    halalScreen: {
      title: 'محرك سياق الحلال والإيثانول',
      authoritySelectLabel: 'تغيير هيئة الإفتاء / المعيار:',
      shieldTitle: 'درع الحماية من الإنذار الكاذب (ليست كحولاً مسكراً)',
      findingsTitle: 'نتائج فحص الحلال ومصادر المكونات',
      veganSugarTitle: 'التوافق النباتي وعداد السكر الخفي',
      freeSugarCountLabel: 'السكريات الحرة المكتشفة',
      rapidCarbLabel: 'كربوهيدرات سريعة الامتصاص (مالتوديكسترين)'
    },
    compareScreen: {
      title: 'مقارنة جنباً إلى جنب',
      subtitle: 'قارن بين منتجين محتارين بينهما واكتشف فوراً المكون الفاصل بينهما.',
      productALabel: 'المنتج الأول (أ)',
      productBLabel: 'المنتج الثاني (ب)',
      compareBtn: '⚡ قارن المنتجين جنباً إلى جنب',
      criteriaCol: 'المعيار',
      regScoreRow: 'المؤشر التنظيمي',
      euBanRow: 'مادة محظورة أوروبياً',
      attentionRow: 'عدد التنبيهات',
      profileRow: 'ملاءمة ملفك',
      halalRow: 'حالة الحلال',
      decidingTitle: 'المكون الفاصل بين المنتجين'
    },
    badges: {
      allowed: 'مسموح',
      restricted: 'مقيد بحدود',
      banned: 'محظور أوروبياً',
      suitable: 'مناسب',
      avoid: 'تجنب / تنبيه',
      halalOk: 'يبدو حلالاً',
      musbooh: 'مشكوك فيه (مصدره غير واضح)',
      halalRed: 'غير متوافق / تعارض',
      conflict: 'تعارض في الملصق!',
      none: 'لا يوجد',
      present: 'موجود!',
      lowCoverage: 'تغطية غير كافية (أقل من ٨٠٪)',
      unrecognized: 'غير معروف'
    }
  },

  de: {
    appTagline: 'Kosmetik-, Lebensmittel- & Halal-Inhaltsstoff-Scanner',
    tabs: {
      profile: '1. Profil',
      scan: '2. Scannen (OCR)',
      result: '3. Ergebnis',
      halal: '4. Halal',
      compare: '5. Vergleich'
    },
    profileScreen: {
      title: 'Für wen scannst du?',
      subtitle: 'Deine Angaben werden auf deinem Gerät verarbeitet – ohne Cloud-Konto oder Werbe-Tracking.',
      profiles: {
        hamilelik: { name: 'Schwangerschaft & Stillzeit', desc: 'Markiert Retinoide, hochdosierte Salicylsäure und bedenkliche UV-Filter.' },
        cocuk_metabolik: { name: 'Baby & Kinder', desc: 'Warnt vor Southampton-Azofarbstoffen, Nitriten, Boraten und starken Konservierern.' },
        hassas_cilt: { name: 'Empfindliche Haut / Neurodermitis', desc: 'Erkennt 80+ (EU 2023/1545) Duftstoffallergene, MI/MCI, SLS und Alcohol Denat. in den Top 5.' },
        astim_alerji: { name: 'Allergie & Asthma', desc: 'Meldet Sulfite (E220–E228), Formaldehydabspalter und Haarfärbe-Sensibilisierer.' },
        akne: { name: 'Zu Akne neigende Haut', desc: 'Warnt vor komedogenen Estern und Ölen ohne den allgemeinen Regulierungs-Score zu verzerren.' },
        fungal_acne: { name: 'Fungal Akne (Malassezia)', desc: 'Markiert Polysorbate, Fettsäuren und Ester, die Malassezia-Hefen fördern, ohne den Basis-Score zu verzerren.' },
        egzama_rosacea: { name: 'Ekzem & Rosazea', desc: 'Meldet Flush-Auslöser, Menthol, ätherische Öle, austrocknende Alkohole, BIT und starke Säuren.' }
      },
      halalSectionTitle: 'Halal- & Lifestyle-Filter',
      authorityLabel: 'Halal-Zertifizierungsstandard',
      claimsLabel: 'Etikettenangaben (Halal / Vegan)',
      continueBtn: 'Weiter — Zum Scanner →',
      privacyNote: 'Datenschutz: Gesundheits- und Glaubensangaben sind besondere Daten nach DSGVO Art. 9. Kein Konto, keine Cloud-Speicherung, kein Werbe-Tracking (Einstellungen, Sperrliste und Verlauf bleiben nur lokal auf diesem Gerät und sind jederzeit löschbar).'
    },
    scanScreen: {
      title: 'Inhaltsstoffliste ausrichten',
      subtitle: 'Kein Barcode nötig. Fotografiere einfach die „Ingredients / Zutaten"-Liste oder füge den Text unten ein.',
      cameraBtn: '📷 Etikett mit Kamera / Foto scannen',
      productTypeCosmetic: 'Kosmetik (INCI)',
      productTypeFood: 'Lebensmittel (E-Nummern)',
      presetsLabel: 'Schnelltest-Beispiele (1-Klick):',
      analyzeBtn: 'Inhaltsstoffe analysieren →'
    },
    resultScreen: {
      title: 'Produktanalyse-Übersicht',
      shareBtn: 'Analyse-Karte teilen',
      scoreLabel: 'REGULIERUNGS- & TRANSPARENZ-INDEX',
      coverageLabel: 'Erkannte Abdeckung',
      recognizedLabel: 'Erkannte Stoffe',
      profileStatusLabel: 'Profil-Passung',
      halalSummaryLabel: 'Halal-Status',
      ocrWarningTitle: 'OCR-Unsicherheit — Bitte bestätigen',
      ingredientsTitle: 'Inhaltsstoff-Analyse & Offizielle Quellen'
    },
    halalScreen: {
      title: 'Halal- & Ethanol-Kontext-Engine',
      authoritySelectLabel: 'Halal-Behörde wechseln:',
      shieldTitle: 'Fehlalarm-Schutz (Kein berauschendes Ethanol)',
      findingsTitle: 'Halal- & Herkunftsbefunde',
      veganSugarTitle: 'Vegan-Prüfung & Versteckter Zucker-Zähler',
      freeSugarCountLabel: 'Erkannte freie Zucker',
      rapidCarbLabel: 'Schnelles Kohlenhydrat (Maltodextrin)'
    },
    compareScreen: {
      title: 'Direkter Produktvergleich',
      subtitle: 'Vergleiche zwei Produkte nebeneinander und erkenne sofort den entscheidenden Inhaltsstoff.',
      productALabel: 'Produkt 1 (A)',
      productBLabel: 'Produkt 2 (B)',
      compareBtn: '⚡ Beide Produkte nebeneinander vergleichen',
      criteriaCol: 'Kriterium',
      regScoreRow: 'Regulierungs-Score',
      euBanRow: 'EU-Verbotener Stoff',
      attentionRow: 'Warnhinweise',
      profileRow: 'Profil-Eignung',
      halalRow: 'Halal-Status',
      decidingTitle: 'Entscheidender Unterschied'
    },
    badges: {
      allowed: 'Zugelassen',
      restricted: 'Eingeschränkt',
      banned: 'EU-Verboten',
      suitable: 'Geeignet',
      avoid: 'Meiden / Achtung',
      halalOk: 'Halal-konform',
      musbooh: 'Zweifelhaft (Herkunft unklar)',
      halalRed: 'Nicht konform / Konflikt',
      conflict: 'Etiketten-Widerspruch!',
      none: 'Keine',
      present: 'Vorhanden!',
      lowCoverage: 'Unzureichende Abdeckung (<80%)',
      unrecognized: 'Nicht erkannt'
    }
  },

  fr: {
    appTagline: 'Scanner d\'Ingrédients Cosmétiques, Alimentaires & Halal',
    tabs: {
      profile: '1. Profil',
      scan: '2. Scanner (OCR)',
      result: '3. Résultat',
      halal: '4. Halal',
      compare: '5. Comparer'
    },
    profileScreen: {
      title: 'Pour qui scannez-vous ?',
      subtitle: 'Vos choix sont traités sur votre appareil, sans compte cloud ni suivi publicitaire.',
      profiles: {
        hamilelik: { name: 'Grossesse & Allaitement', desc: 'Signale les rétinoïdes, l\'acide salicylique concentré et les filtres UV préoccupants.' },
        cocuk_metabolik: { name: 'Bébé & Enfant', desc: 'Met en évidence les 6 colorants de Southampton, nitrites, borates et conservateurs irritants.' },
        hassas_cilt: { name: 'Peau Sensible / Atopique', desc: 'Détecte les 80+ (UE 2023/1545) allergènes parfumés, MI/MCI, SLS et l\'alcool dénaturé dans le top 5.' },
        astim_alerji: { name: 'Allergies & Asthme', desc: 'Signale les sulfites (E220–E228), libérateurs de formaldéhyde et colorants capillaires.' },
        akne: { name: 'Peau à Tendance Acnéique', desc: 'Avertit des esters et huiles comédogènes sans fausser le score réglementaire général.' },
        fungal_acne: { name: 'Acné Fongique (Malassezia)', desc: 'Signale polysorbates, acides gras et esters nourrissant Malassezia sans altérer le score de base.' },
        egzama_rosacea: { name: 'Eczéma & Rosacée', desc: 'Détecte menthol, huiles essentielles, alcool asséchant, BIT et acides affaiblissant la barrière.' }
      },
      halalSectionTitle: 'Filtre Halal & Mode de Vie',
      authorityLabel: 'Autorité de Référence Halal',
      claimsLabel: 'Mentions sur l\'Étiquette',
      continueBtn: 'Continuer — Ouvrir le Scanner →',
      privacyNote: 'Confidentialité : vos données de santé et de convictions sont des données sensibles (RGPD art. 9). Aucun compte ni stockage cloud ; vos préférences, liste noire et historique restent uniquement sur cet appareil et peuvent être effacés à tout moment.'
    },
    scanScreen: {
      title: 'Alignez la Liste des Ingrédients',
      subtitle: 'Pas besoin de code-barres. Photographiez la section « Ingrédients / Composition » ou collez le texte ci-dessous.',
      cameraBtn: '📷 Scanner l\'Étiquette avec l\'Appareil Photo',
      productTypeCosmetic: 'Cosmétique (INCI)',
      productTypeFood: 'Alimentaire (Codes E)',
      presetsLabel: 'Exemples Rapides (1 Clic) :',
      analyzeBtn: 'Analyser les Ingrédients →'
    },
    resultScreen: {
      title: 'Résumé d\'Analyse Produit',
      shareBtn: 'Partager la Carte',
      scoreLabel: 'INDICE DE TRANSPARENCE RÉGLEMENTAIRE',
      coverageLabel: 'Couverture Reconnue',
      recognizedLabel: 'Ingrédients Reconnus',
      profileStatusLabel: 'Compatibilité Profil',
      halalSummaryLabel: 'Résumé Halal',
      ocrWarningTitle: 'Ambiguïté OCR — Confirmation Requise',
      ingredientsTitle: 'Analyse des Ingrédients & Sources Officielles'
    },
    halalScreen: {
      title: 'Moteur Contextuel Halal & Éthanol',
      authoritySelectLabel: 'Changer d\'Autorité Halal :',
      shieldTitle: 'Bouclier Anti-Faux Positifs (Alcool Gras / Non-Éthanol)',
      findingsTitle: 'Résultats Halal & Origine des Ingrédients',
      veganSugarTitle: 'Compatibilité Végane & Compteur de Sucres Cachés',
      freeSugarCountLabel: 'Sucres Libres Détectés',
      rapidCarbLabel: 'Glucide Rapide (Maltodextrine)'
    },
    compareScreen: {
      title: 'Comparaison Côte à Côte',
      subtitle: 'Comparez deux produits face à face et identifiez instantanément l\'ingrédient qui fait la différence.',
      productALabel: 'Produit 1 (A)',
      productBLabel: 'Produit 2 (B)',
      compareBtn: '⚡ Comparer les Deux Produits',
      criteriaCol: 'Critère',
      regScoreRow: 'Score Réglementaire',
      euBanRow: 'Substance Interdite UE',
      attentionRow: 'Alertes / Vigilance',
      profileRow: 'Compatibilité Profil',
      halalRow: 'Statut Halal',
      decidingTitle: 'Ingrédient Décisif'
    },
    badges: {
      allowed: 'Autorisé',
      restricted: 'Restreint',
      banned: 'Interdit UE',
      suitable: 'Compatible',
      avoid: 'Éviter / Attention',
      halalOk: 'Semble Halal',
      musbooh: 'Douteux (origine incertaine)',
      halalRed: 'Non Conforme / Conflit',
      conflict: 'Conflit d\'Étiquette !',
      none: 'Aucun',
      present: 'Présent !',
      lowCoverage: 'Couverture Insuffisante (<80%)',
      unrecognized: 'Non reconnu'
    }
  },

  id: {
    appTagline: 'Pemindai Komposisi Kosmetik, Makanan & Halal',
    tabs: {
      profile: '1. Profil',
      scan: '2. Pindai (OCR)',
      result: '3. Hasil',
      halal: '4. Halal',
      compare: '5. Bandingkan'
    },
    profileScreen: {
      title: 'Untuk siapa Anda memindai?',
      subtitle: 'Pilihan Anda diproses di perangkat ini tanpa akun cloud atau pelacak iklan.',
      profiles: {
        hamilelik: { name: 'Ibu Hamil & Menyusui', desc: 'Menandai retinoid, asam salisilat dosis tinggi, dan filter UV yang dicurigai.' },
        cocuk_metabolik: { name: 'Bayi & Anak-Anak', desc: 'Menyoroti 6 pewarna sintetis Southampton, nitrit, borat, dan pengawet keras.' },
        hassas_cilt: { name: 'Kulit Sensitif / Eksim', desc: 'Mendeteksi 80+ (UE 2023/1545) alergen wewangian, MI/MCI, SLS, dan alkohol denat di 5 urutan teratas.' },
        astim_alerji: { name: 'Alergi & Asma', desc: 'Menandai sulfit (E220–E228), pelepas formaldehida, dan pemicu alergi cat rambut.' },
        akne: { name: 'Kulit Rentan Berjerawat', desc: 'Memperingatkan ester dan minyak komedogenik tanpa menurunkan skor regulasi umum.' },
        fungal_acne: { name: 'Jerawat Jamur (Malassezia)', desc: 'Menandai polisorbat, asam lemak, dan ester pemicu Malassezia tanpa memengaruhi skor dasar.' },
        egzama_rosacea: { name: 'Eksim & Rosacea', desc: 'Mendeteksi pemicu kemerahan, mentol, minyak atsiri, alkohol kering, BIT, dan asam keras.' }
      },
      halalSectionTitle: 'Filter Halal & Gaya Hidup',
      authorityLabel: 'Otoritas Standar Halal (MUI / JAKIM / GİMDES)',
      claimsLabel: 'Klaim / Sertifikat pada Kemasan',
      continueBtn: 'Lanjutkan — Buka Pemindai →',
      privacyNote: 'Privasi: Data kesehatan dan keyakinan adalah data sensitif (GDPR Pasal 9). Tanpa akun dan tanpa penyimpanan cloud; preferensi, daftar hitam, dan riwayat hanya disimpan secara lokal di perangkat ini dan dapat dihapus kapan saja.'
    },
    scanScreen: {
      title: 'Arahkan ke Daftar Komposisi',
      subtitle: 'Tidak perlu barcode. Arahkan kamera ke bagian "Ingredients / Komposisi" atau tempel teks di bawah.',
      cameraBtn: '📷 Pindai Label dengan Kamera / Foto',
      productTypeCosmetic: 'Kosmetik (INCI)',
      productTypeFood: 'Makanan (Kode E)',
      presetsLabel: 'Contoh Uji Cepat (1 Klik):',
      analyzeBtn: 'Analisis Komposisi →'
    },
    resultScreen: {
      title: 'Ringkasan Analisis Produk',
      shareBtn: 'Bagikan Kartu Hasil',
      scoreLabel: 'INDEKS TRANSPARANSI REGULASI',
      coverageLabel: 'Cakupan Dikenali',
      recognizedLabel: 'Bahan Dikenali',
      profileStatusLabel: 'Kecocokan Profil',
      halalSummaryLabel: 'Ringkasan Halal',
      ocrWarningTitle: 'Ambiguitas OCR — Konfirmasi Anda Diperlukan',
      ingredientsTitle: 'Rincian Komposisi & Referensi Resmi'
    },
    halalScreen: {
      title: 'Mesin Konteks Halal & Etanol',
      authoritySelectLabel: 'Ubah Otoritas Fatwa Halal:',
      shieldTitle: 'Perisai Anti-Alarm Palsu (Bukan Etanol Memabukkan)',
      findingsTitle: 'Temuan Status Halal & Asal Bahan',
      veganSugarTitle: 'Kesesuaian Vegan & Penghitung Gula Tersembunyi',
      freeSugarCountLabel: 'Gula Bebas Terdeteksi',
      rapidCarbLabel: 'Karbohidrat Cepat (Maltodekstrin)'
    },
    compareScreen: {
      title: 'Perbandingan Berdampingan',
      subtitle: 'Bandingkan dua produk secara berdampingan dan temukan bahan pembeda utamanya.',
      productALabel: 'Produk 1 (A)',
      productBLabel: 'Produk 2 (B)',
      compareBtn: '⚡ Bandingkan Dua Produk',
      criteriaCol: 'Kriteria',
      regScoreRow: 'Skor Regulasi',
      euBanRow: 'Bahan Dilarang UE',
      attentionRow: 'Jumlah Peringatan',
      profileRow: 'Kecocokan Profil',
      halalRow: 'Status Halal',
      decidingTitle: 'Bahan Pembeda Utama'
    },
    badges: {
      allowed: 'Diizinkan',
      restricted: 'Dibatasi',
      banned: 'Dilarang UE',
      suitable: 'Cocok',
      avoid: 'Hindari / Perhatian',
      halalOk: 'Tampak Halal',
      musbooh: 'Syubhat (sumber tidak jelas)',
      halalRed: 'Tidak Sesuai / Konflik',
      conflict: 'Konflik Label!',
      none: 'Tidak Ada',
      present: 'Ada!',
      lowCoverage: 'Cakupan Tidak Cukup (<80%)',
      unrecognized: 'Tidak Dikenali'
    }
  },

  ms: {
    appTagline: 'Pengimbas Ramuan Kosmetik, Makanan & Halal',
    tabs: {
      profile: '1. Profil',
      scan: '2. Imbas (OCR)',
      result: '3. Keputusan',
      halal: '4. Halal',
      compare: '5. Banding'
    },
    profileScreen: {
      title: 'Untuk siapa anda mengimbas?',
      subtitle: 'Pilihan anda diproses pada peranti anda tanpa akaun awan atau penjejak iklan.',
      profiles: {
        hamilelik: { name: 'Kehamilan & Penyusuan', desc: 'Menandakan retinoid, asid salisilik kepekatan tinggi dan penapis UV yang dicurigai.' },
        cocuk_metabolik: { name: 'Bayi & Kanak-kanak', desc: 'Menyerlahkan 6 pewarna tiruan Southampton, nitrit, borat dan pengawet keras.' },
        hassas_cilt: { name: 'Kulit Sensitif / Ekzema', desc: 'Mengesan 80+ (EU 2023/1545) alergen wangian, MI/MCI, SLS dan alkohol denat dalam 5 ramuan teratas.' },
        astim_alerji: { name: 'Alahan & Asma', desc: 'Menandakan sulfit (E220–E228), pelepas formaldehid dan pemeka pewarna rambut.' },
        akne: { name: 'Kulit Mudah Berjerawat', desc: 'Memberi amaran tentang ester dan minyak komedogenik tanpa menjejaskan skor regulasi umum.' },
        fungal_acne: { name: 'Jerawat Kulat (Malassezia)', desc: 'Menanda polisorbat, asid lemak dan ester pencetus Malassezia tanpa mengubah skor asas.' },
        egzama_rosacea: { name: 'Ekzema & Rosacea', desc: 'Mengesan pencetus kemerahan, mentol, minyak pati, alkohol pengering, BIT dan asid kuat.' }
      },
      halalSectionTitle: 'Penapis Halal & Gaya Hidup',
      authorityLabel: 'Pihak Berkuasa Standard Halal (JAKIM / MUI / GİMDES)',
      claimsLabel: 'Akuan / Sijil pada Bungkusan',
      continueBtn: 'Teruskan — Ke Pengimbas →',
      privacyNote: 'Privasi: Data kesihatan dan kepercayaan ialah data sensitif (GDPR Perkara 9). Tiada akaun dan tiada storan awan; pilihan, senarai hitam dan sejarah hanya disimpan secara tempatan pada peranti ini dan boleh dipadam bila-bila masa.'
    },
    scanScreen: {
      title: 'Jajarkan Senarai Ramuan',
      subtitle: 'Kod bar tidak diperlukan. Halakan kamera pada bahagian "Ingredients / Ramuan" atau tampal teks di bawah.',
      cameraBtn: '📷 Imbas Label dengan Kamera / Foto',
      productTypeCosmetic: 'Kosmetik (INCI)',
      productTypeFood: 'Makanan (Kod E)',
      presetsLabel: 'Contoh Ujian Pantas (1 Klik):',
      analyzeBtn: 'Analisis Ramuan →'
    },
    resultScreen: {
      title: 'Ringkasan Analisis Produk',
      shareBtn: 'Kongsi Kad Keputusan',
      scoreLabel: 'INDEKS KETELUSAN REGULASI',
      coverageLabel: 'Liputan Dikenali',
      recognizedLabel: 'Ramuan Dikenali',
      profileStatusLabel: 'Padanan Profil',
      halalSummaryLabel: 'Ringkasan Halal',
      ocrWarningTitle: 'Kesamaran OCR — Pengesahan Diperlukan',
      ingredientsTitle: 'Analisis Ramuan & Rujukan Rasmi'
    },
    halalScreen: {
      title: 'Enjin Konteks Halal & Etanol',
      authoritySelectLabel: 'Tukar Pihak Berkuasa Halal:',
      shieldTitle: 'Perisai Anti-Penggera Palsu (Bukan Etanol Memabukkan)',
      findingsTitle: 'Penemuan Status Halal & Sumber Ramuan',
      veganSugarTitle: 'Keserasian Vegan & Pengira Gula Tersembunyi',
      freeSugarCountLabel: 'Gula Bebas Dikesan',
      rapidCarbLabel: 'Karbohidrat Pantas (Maltodekstrin)'
    },
    compareScreen: {
      title: 'Perbandingan Bersebelahan',
      subtitle: 'Bandingkan dua produk secara bersebelahan dan kenal pasti ramuan pemutus dengan serta-merta.',
      productALabel: 'Produk 1 (A)',
      productBLabel: 'Produk 2 (B)',
      compareBtn: '⚡ Bandingkan Dua Produk',
      criteriaCol: 'Kriteria',
      regScoreRow: 'Skor Regulasi',
      euBanRow: 'Bahan Diharamkan EU',
      attentionRow: 'Jumlah Amaran',
      profileRow: 'Kesesuaian Profil',
      halalRow: 'Status Halal',
      decidingTitle: 'Ramuan Pembeza Utama'
    },
    badges: {
      allowed: 'Dibenarkan',
      restricted: 'Terhad',
      banned: 'Diharamkan EU',
      suitable: 'Sesuai',
      avoid: 'Elakkan / Perhatian',
      halalOk: 'Kelihatan Halal',
      musbooh: 'Syubhah (sumber tidak jelas)',
      halalRed: 'Tidak Patuh / Konflik',
      conflict: 'Konflik Label!',
      none: 'Tiada',
      present: 'Ada!',
      lowCoverage: 'Liputan Tidak Mencukupi (<80%)',
      unrecognized: 'Tidak Dikenali'
    }
  },

  es: {
    appTagline: 'Escáner de Ingredientes Cosméticos, Alimentarios y Halal',
    tabs: {
      profile: '1. Perfil',
      scan: '2. Escanear (OCR)',
      result: '3. Resultado',
      halal: '4. Halal',
      compare: '5. Comparar'
    },
    profileScreen: {
      title: '¿Para quién escaneas?',
      subtitle: 'Tus preferencias se procesan en tu dispositivo sin cuentas en la nube ni rastreadores publicitarios.',
      profiles: {
        hamilelik: { name: 'Embarazo y Lactancia', desc: 'Señala retinoides, ácido salicílico concentrado y filtros UV sospechosos.' },
        cocuk_metabolik: { name: 'Bebés y Niños', desc: 'Destaca los 6 colorantes de Southampton, nitritos, boratos y conservantes fuertes.' },
        hassas_cilt: { name: 'Piel Sensible / Atópica', desc: 'Detecta 80+ (UE 2023/1545) alérgenos de fragancia, MI/MCI, SLS y alcohol desnaturalizado en el top 5.' },
        astim_alerji: { name: 'Alergias y Asma', desc: 'Advierte sobre sulfitos (E220–E228), liberadores de formaldehído y tintes capilares.' },
        akne: { name: 'Piel Propensa al Acné', desc: 'Advierte sobre ésteres y aceites comedogénicos sin distorsionar la puntuación general.' },
        fungal_acne: { name: 'Acné Fúngico (Malassezia)', desc: 'Señala polisorbatos, ácidos grasos y ésteres que alimentan Malassezia sin alterar la puntuación base.' },
        egzama_rosacea: { name: 'Eccema y Rosácea', desc: 'Alerta sobre mentol, aceites esenciales, alcohol secante, BIT y ácidos que dañan la barrera.' }
      },
      halalSectionTitle: 'Filtro Halal y Estilo de Vida',
      authorityLabel: 'Autoridad de Estándar Halal',
      claimsLabel: 'Certificados en el Envase',
      continueBtn: 'Continuar — Ir al Escáner →',
      privacyNote: 'Privacidad: tus datos de salud y creencias son datos sensibles (RGPD art. 9). Sin cuenta ni almacenamiento en la nube; tus preferencias, lista negra e historial se guardan solo localmente en este dispositivo y pueden borrarse cuando quieras.'
    },
    scanScreen: {
      title: 'Alinea la Lista de Ingredientes',
      subtitle: 'Sin código de barras. Apunta la cámara a «Ingredients / Ingredientes» o pega el texto abajo.',
      cameraBtn: '📷 Escanear Etiqueta con Cámara / Foto',
      productTypeCosmetic: 'Cosmética (INCI)',
      productTypeFood: 'Alimentación (Códigos E)',
      presetsLabel: 'Ejemplos de Prueba Rápida (1 Clic):',
      analyzeBtn: 'Analizar Ingredientes →'
    },
    resultScreen: {
      title: 'Resumen del Análisis',
      shareBtn: 'Compartir Tarjeta',
      scoreLabel: 'ÍNDICE DE TRANSPARENCIA REGULATORIA',
      coverageLabel: 'Cobertura Reconocida',
      recognizedLabel: 'Ingredientes Reconocidos',
      profileStatusLabel: 'Ajuste a tu Perfil',
      halalSummaryLabel: 'Resumen Halal',
      ocrWarningTitle: 'Ambigüedad OCR — Confirmación Necesaria',
      ingredientsTitle: 'Análisis de Ingredientes y Fuentes Oficiales'
    },
    halalScreen: {
      title: 'Motor Contextual Halal y Etanol',
      authoritySelectLabel: 'Cambiar Autoridad Halal:',
      shieldTitle: 'Escudo Anti-Falsos Positivos (Alcohol Graso / No Etanol)',
      findingsTitle: 'Hallazgos de Origen y Estado Halal',
      veganSugarTitle: 'Compatibilidad Vegana y Contador de Azúcares Ocultos',
      freeSugarCountLabel: 'Azúcares Libres Detectados',
      rapidCarbLabel: 'Carbohidrato Rápido (Maltodextrina)'
    },
    compareScreen: {
      title: 'Comparación Lado a Lado',
      subtitle: 'Compara dos productos frente a frente y descubre al instante el ingrediente decisivo.',
      productALabel: 'Producto 1 (A)',
      productBLabel: 'Producto 2 (B)',
      compareBtn: '⚡ Comparar Ambos Productos',
      criteriaCol: 'Criterio',
      regScoreRow: 'Puntuación Regulatoria',
      euBanRow: 'Sustancia Prohibida UE',
      attentionRow: 'Alertas / Atención',
      profileRow: 'Ajuste a tu Perfil',
      halalRow: 'Estado Halal',
      decidingTitle: 'Ingrediente Decisivo'
    },
    badges: {
      allowed: 'Permitido',
      restricted: 'Restringido',
      banned: 'Prohibido UE',
      suitable: 'Apto',
      avoid: 'Evitar / Precaución',
      halalOk: 'Parece Halal',
      musbooh: 'Dudoso (origen incierto)',
      halalRed: 'No Apto / Conflicto',
      conflict: '¡Conflicto en Etiqueta!',
      none: 'Ninguno',
      present: '¡Presente!',
      lowCoverage: 'Cobertura Insuficiente (<80%)',
      unrecognized: 'No reconocido'
    }
  },

  ru: {
    appTagline: 'Сканер состава косметики, продуктов и Халяль',
    tabs: {
      profile: '1. Профиль',
      scan: '2. Скан (OCR)',
      result: '3. Результат',
      halal: '4. Халяль',
      compare: '5. Сравнить'
    },
    profileScreen: {
      title: 'Для кого вы проверяете состав?',
      subtitle: 'Ваши настройки обрабатываются на вашем устройстве без облачных аккаунтов и рекламных трекеров.',
      profiles: {
        hamilelik: { name: 'Беременность и ГВ', desc: 'Отмечает ретиноиды, высокую концентрацию салициловой кислоты и спорные УФ-фильтры.' },
        cocuk_metabolik: { name: 'Дети и малыши', desc: 'Выявляет 6 красителей Саутгемптона, нитриты, бораты и жесткие консерванты.' },
        hassas_cilt: { name: 'Чувствительная кожа / Атопия', desc: 'Находит 80+ (ЕС 2023/1545) отдушек-аллергенов, MI/MCI, SLS и денатурированный спирт в топ-5.' },
        astim_alerji: { name: 'Аллергия и астма', desc: 'Предупреждает о сульфитах (E220–E228), релизерах формальдегида и красителях для волос.' },
        akne: { name: 'Склонная к акне кожа', desc: 'Предупреждает о комедогенных эфирах и маслах без занижения общего рейтинга.' },
        fungal_acne: { name: 'Грибковое акне (Malassezia)', desc: 'Отмечает полисорбаты, жирные кислоты и эфиры, питающие Malassezia, не меняя базовый балл.' },
        egzama_rosacea: { name: 'Экзема и розацеа', desc: 'Фиксирует триггеры покраснения, ментол, эфирные масла, сушащий спирт, BIT и жёсткие кислоты.' }
      },
      halalSectionTitle: 'Фильтр Халяль и образа жизни',
      authorityLabel: 'Стандарт Халяль (GİMDES / JAKIM / MUI)',
      claimsLabel: 'Маркировка на упаковке',
      continueBtn: 'Далее — Перейти к сканеру →',
      privacyNote: 'Конфиденциальность: данные о здоровье и убеждениях относятся к особой категории (GDPR, ст. 9). Без аккаунта и облака; настройки, чёрный список и история хранятся только локально на этом устройстве и удаляются в любой момент.'
    },
    scanScreen: {
      title: 'Наведите на список ингредиентов',
      subtitle: 'Штрих-код не нужен. Сфотографируйте раздел «Состав / Ingredients» или вставьте текст ниже.',
      cameraBtn: '📷 Сканировать этикетку камерой / фото',
      productTypeCosmetic: 'Косметика (INCI)',
      productTypeFood: 'Продукты (Е-коды)',
      presetsLabel: 'Быстрые тестовые примеры (в 1 клик):',
      analyzeBtn: 'Анализировать состав →'
    },
    resultScreen: {
      title: 'Сводка анализа продукта',
      shareBtn: 'Поделиться карточкой',
      scoreLabel: 'ИНДЕКС РЕГУЛЯТОРНОЙ ПРОЗРАЧНОСТИ',
      coverageLabel: 'Распознано состава',
      recognizedLabel: 'Известных веществ',
      profileStatusLabel: 'Совместимость',
      halalSummaryLabel: 'Статус Халяль',
      ocrWarningTitle: 'Неоднозначность OCR — Требуется подтверждение',
      ingredientsTitle: 'Разбор ингредиентов и официальные источники'
    },
    halalScreen: {
      title: 'Контекстный анализатор Халяль и этанола',
      authoritySelectLabel: 'Выбрать стандарт Халяль:',
      shieldTitle: 'Защита от ложной тревоги (Не этиловый спирт)',
      findingsTitle: 'Результаты проверки Халяль и происхождения',
      veganSugarTitle: 'Веган-статус и счетчик скрытого сахара',
      freeSugarCountLabel: 'Обнаружено свободных сахаров',
      rapidCarbLabel: 'Быстрый углевод (Мальтодекстрин)'
    },
    compareScreen: {
      title: 'Сравнение двух продуктов',
      subtitle: 'Сравните два товара бок о бок и сразу увидьте решающий ингредиент.',
      productALabel: 'Продукт 1 (А)',
      productBLabel: 'Продукт 2 (Б)',
      compareBtn: '⚡ Сравнить продукты бок о бок',
      criteriaCol: 'Критерий',
      regScoreRow: 'Регуляторный индекс',
      euBanRow: 'Запрещено в ЕС',
      attentionRow: 'Предупреждений',
      profileRow: 'Ваш профиль',
      halalRow: 'Статус Халяль',
      decidingTitle: 'Решающее отличие в составе'
    },
    badges: {
      allowed: 'Разрешено',
      restricted: 'Ограничено',
      banned: 'Запрещено в ЕС',
      suitable: 'Подходит',
      avoid: 'Избегать / Внимание',
      halalOk: 'Соответствует Халяль',
      musbooh: 'Сомнительно (происхождение неясно)',
      halalRed: 'Не халяль / Конфликт',
      conflict: 'Конфликт на этикетке!',
      none: 'Нет',
      present: 'Есть!',
      lowCoverage: 'Недостаточный охват (<80%)',
      unrecognized: 'Не распознано'
    }
  },

  ur: {
    appTagline: 'کاسمیٹکس، خوراک اور حلال اجزاء کا اسکینر',
    tabs: {
      profile: '۱. پروفائل',
      scan: '۲. اسکین (OCR)',
      result: '۳. نتیجہ',
      halal: '۴. حلال',
      compare: '۵. موازنہ'
    },
    profileScreen: {
      title: 'آپ کس کے لیے اسکین کر رہے ہیں؟',
      subtitle: 'آپ کے انتخابات آپ کی ڈیوائس پر پراسیس ہوتے ہیں، بغیر کلاؤڈ اکاؤنٹ یا اشتہاری ٹریکنگ کے۔',
      profiles: {
        hamilelik: { name: 'حمل اور دودھ پلانے والی مائیں', desc: 'ریٹینوئڈز، تیز سیلیسیلک ایسڈ اور مشتبہ یو وی فلٹرز کی نشاندہی کرتا ہے۔' },
        cocuk_metabolik: { name: 'بچے اور شیر خوار', desc: 'ساؤتھمپٹن کے 6 مصنوعی رنگوں، نائٹرائٹس، بوریٹس اور تیز پریزرویٹوز سے آگاہ کرتا ہے۔' },
        hassas_cilt: { name: 'حساس جلد / ایکزیما', desc: '80+ (EU 2023/1545) خوشبو کے الرجن، MI/MCI، SLS اور ابتدائی 5 اجزاء میں خشک کرنے والے الکحل کو پکڑتا ہے۔' },
        astim_alerji: { name: 'الرجی اور دمہ', desc: 'سلفائٹس (E220-E228)، فارملڈیہائیڈ اور ہیئر ڈائی الرجن کی نشاندہی کرتا ہے۔' },
        akne: { name: 'مہاسوں (Acne) والی جلد', desc: 'عمومی اسکور کو کم کیے بغیر مسام بند کرنے والے تیل اور ایسٹرز سے خبردار کرتا ہے۔' },
        fungal_acne: { name: 'فنگل ایکنی (Malassezia)', desc: 'بنیادی اسکور کو متاثر کیے بغیر پولی سوربیٹس، فیٹی ایسڈز اور ایسٹرز کی نشاندہی کرتا ہے۔' },
        egzama_rosacea: { name: 'ایگزیما اور روزیسیا', desc: 'سرخی بڑھانے والے اجزاء، مینتھول، ایسینشل آئلز، خشک الکوحل اور سخت ایسڈز سے خبردار کرتا ہے۔' }
      },
      halalSectionTitle: 'حلال اور طرزِ زندگی فلٹر',
      authorityLabel: 'حلال اسٹینڈرڈ اتھارٹی',
      claimsLabel: 'پیکنگ پر موجود سرٹیفکیٹ',
      continueBtn: 'جاری رکھیں — اسکینر پر جائیں ←',
      privacyNote: 'رازداری: صحت اور عقیدے سے متعلق انتخاب GDPR آرٹیکل 9 کے تحت حساس ڈیٹا ہیں۔ نہ کلاؤڈ اکاؤنٹ اور نہ تیسرے فریق کو منتقلی؛ آپ کی ترجیحات، ذاتی فہرست اور تاریخ صرف اسی ڈیوائس پر محفوظ رہتی ہے اور کسی بھی وقت حذف کی جا سکتی ہے۔'
    },
    scanScreen: {
      title: 'اجزاء کی فہرست کو سیدھ میں رکھیں',
      subtitle: 'بارکوڈ کی ضرورت نہیں۔ کیمرے کو "Ingredients / اجزاء" پر رکھیں یا نیچے متن پیسٹ کریں۔',
      cameraBtn: '📷 کیمرے یا تصویر سے لیبل اسکین کریں',
      productTypeCosmetic: 'کاسمیٹکس (INCI)',
      productTypeFood: 'خوراک (E-Codes)',
      presetsLabel: 'فوری ٹیسٹ نمونے (ایک کلک):',
      analyzeBtn: 'اجزاء کا تجزیہ کریں ←'
    },
    resultScreen: {
      title: 'مصنوعہ تجزیہ خلاصہ',
      shareBtn: 'تجزیہ کارڈ شیئر کریں',
      scoreLabel: 'ریگولیٹری شفافیت انڈیکس',
      coverageLabel: 'شناخت شدہ کوریج',
      recognizedLabel: 'شناخت شدہ اجزاء',
      profileStatusLabel: 'پروفائل مطابقت',
      halalSummaryLabel: 'حلال خلاصہ',
      ocrWarningTitle: 'پڑھنے میں ابہام — آپ کی تصدیق درکار ہے',
      ingredientsTitle: 'اجزاء کی تفصیل اور سرکاری حوالہ جات'
    },
    halalScreen: {
      title: 'حلال اور ایتھانول سیاق و سباق انجن',
      authoritySelectLabel: 'حلال اتھارٹی تبدیل کریں:',
      shieldTitle: 'غلط الارم سے تحفظ (یہ نشہ آور الکحل نہیں ہے)',
      findingsTitle: 'حلال حیثیت اور ماخذ کے نتائج',
      veganSugarTitle: 'ویگن مطابقت اور چھپی ہوئی شوگر کاؤنٹر',
      freeSugarCountLabel: 'دریافت شدہ فری شوگر',
      rapidCarbLabel: 'تیز کاربوہائیڈریٹ (مالٹوڈیکسٹرین)'
    },
    compareScreen: {
      title: 'آمنے سامنے موازنہ',
      subtitle: 'دو مصنوعات کا آمنے سامنے موازنہ کریں اور فرق پیدا کرنے والا جزو فوراً دیکھیں۔',
      productALabel: 'پروڈکٹ 1 (الف)',
      productBLabel: 'پروڈکٹ 2 (ب)',
      compareBtn: '⚡ دونوں مصنوعات کا موازنہ کریں',
      criteriaCol: 'معیار',
      regScoreRow: 'ریگولیٹری اسکور',
      euBanRow: 'یورپی یونین میں ممنوع جزو',
      attentionRow: 'انتباہات کی تعداد',
      profileRow: 'پروفائل مطابقت',
      halalRow: 'حلال حیثیت',
      decidingTitle: 'فیصلہ کن فرق والا جزو'
    },
    badges: {
      allowed: 'اجازت ہے',
      restricted: 'محدود مقدار',
      banned: 'یورپی یونین میں ممنوع',
      suitable: 'موزوں',
      avoid: 'پرہیز / احتیاط',
      halalOk: 'بظاہر حلال',
      musbooh: 'مشکوک (ماخذ غیر واضح)',
      halalRed: 'غیر موزوں / تضاد',
      conflict: 'لیبل پر تضاد!',
      none: 'کوئی نہیں',
      present: 'موجود ہے!',
      lowCoverage: 'ناکافی کوریج (۸۰٪ سے کم)',
      unrecognized: 'غیر شناخت شدہ'
    }
  }
};

export const LEGAL_DISCLAIMERS = {
  tr: 'Bu analiz, seçilen kurumların kamuya açık fıkhi standartlarına dayalı bağımsız bir algoritmik ön incelemedir. Kurumların resmi onayı veya tescili niteliğinde değildir. Nihai güvence için ambalajdaki resmi sertifika logosunu ve numarasını teyit ediniz.',
  en: 'This assessment is an independent algorithmic screening based on publicly available standards of the selected authorities. It is not an official endorsement or certification. Please verify the official certification logo and number on packaging.',
  ar: 'هذا التقييم هو فحص خوارزمي مستقل يستند إلى المعايير الفقهية المعلنة للجهات المختارة، ولا يُعد اعتماداً أو ترخيصاً رسمياً. يُرجى التحقق من شعار ورقم الشهادة المعتمدة على العبوة.',
  de: 'Diese Analyse ist eine unabhängige algorithmische Vorprüfung auf Grundlage öffentlich zugänglicher Standards der ausgewählten Institutionen. Sie stellt keine offizielle Zertifizierung dar. Bitte prüfen Sie das offizielle Siegel auf der Packung.',
  fr: 'Cette évaluation est un examen algorithmique indépendant basé sur les normes publiques des autorités sélectionnées. Elle ne constitue pas une certification officielle. Veuillez vérifier le logo et le numéro de certification sur l\'emballage.',
  id: 'Analisis ini merupakan penyaringan algoritmik independen berdasarkan standar publik lembaga terkait. Bukan merupakan sertifikasi resmi. Silakan verifikasi nomor dan logo sertifikasi halal resmi pada kemasan.',
  ms: 'Penilaian ini adalah saringan algoritma bebas berdasarkan piawaian awam pihak berkuasa yang dipilih. Ia bukan perakuan rasmi. Sila sahkan logo dan nombor sijil rasmi pada bungkusan produk.',
  es: 'Esta evaluación es un análisis algorítmico independiente basado en estándares públicos de las entidades seleccionadas. No constituye una certificación oficial. Verifique el sello y código oficial en el empaque.',
  ru: 'Данный анализ представляет собой независимую алгоритмическую проверку на основе публичных стандартов выбранных организаций. Он не является официальным сертификатом. Проверяйте официальный знак на упаковке.',
  ur: 'یہ تجزیہ منتخب اداروں کے عوامی معیارات پر مبنی ایک خود مختار الگورتھمک جانچ ہے۔ یہ کوئی سرکاری تصدیق یا سرٹیفکیٹ نہیں ہے۔ پیکیجنگ پر سرکاری سرٹیفکیٹ لوگو اور نمبر کی تصدیق کریں۔'
};

/**
 * Translates dynamic engine status labels and disclaimers into the requested language
 */
export function getLocaleStrings(lang = 'tr') {
  const safeLang = typeof lang === 'string' && Object.hasOwn(UI_STRINGS, lang) ? lang : 'en';
  const base = UI_STRINGS[safeLang];
  return {
    ...base,
    halalScreen: {
      ...base.halalScreen,
      legalDisclaimerMicro: Object.hasOwn(LEGAL_DISCLAIMERS, safeLang) ? LEGAL_DISCLAIMERS[safeLang] : LEGAL_DISCLAIMERS.en
    }
  };
}
