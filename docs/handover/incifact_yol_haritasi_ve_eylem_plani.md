# InciFact - Stratejik Yol Haritası ve Uygulama Planı

**Tarih:** 13 Ekim 2026  
**Hedef:** Pazar Şansını 6/10'dan 8.5/10 Seviyesine Taşımak  
**Odak:** Hukuki Güvence, Milyonluk Ürün Kapsamı (Barkod) ve Prestijli Kurumsal UI  

---

## 1. Adım: Hukuki Koruma ve Çift Kademeli Feragatname (P0 Legal)

### Risk ve Teşhis:
InciFact; **GİMDES (Türkiye)**, **JAKIM (Malezya)**, **MUI / BPJPH (Endonezya)** ve **IFANCA (ABD)** kurumlarının fıkhi içtihatlarını ve standartlarını ayrıştırmaktadır.
- **Hukuki Risk:** Bu kurumların tescilli marka adlarını izinsiz "resmi bir onay varmış gibi" sunmak; marka ihlali davalarına, kurumların tekzip yayınlamasına ve Apple App Store 2.3 / 1.4.1 (Yanıltıcı Tanıtım ve Sağlık Bilgisi Doğruluğu) gerekçesiyle uygulamanın mağazadan kaldırılmasına yol açabilir.

### Uygulama Mimarisi:
Hukuki koruma **çift kademeli (two-tier)** olarak kurulacaktır:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. KADEME: ARAYÜZ İÇİ MİKRO-FERAGATNAME (Inline Micro-Disclaimer)     │
├────────────────────────────────────────────────────────────────────────┤
│ Helal Değerlendirme Kartı ve Kurum Seçim Açılır Menüsü Altında:       │
│                                                                        │
│ ℹ️ "Bu analiz, seçilen kurumların kamuya açık fıkhi standartlarına      │
│     dayalı bağımsız bir algoritmik ön incelemedir. Kurumların resmi    │
│     onay veya sertifikası niteliğinde değildir. Nihai güvence için     │
│     ambalajdaki resmi sertifika logosunu ve kodunu teyit ediniz."     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. KADEME: YASAL METODOLOJİ VE KAYNAK SAYFASI (Modal / Sheet)          │
├────────────────────────────────────────────────────────────────────────┤
│ Kullanıcı "Metodoloji ve Kaynaklar" bağlantısına tıkladığında açılır: │
│                                                                        │
│ • JAKIM: Muzakarah Jawatankuasa Fatwa Majlis Kebangsaan (E120 Karmin   │
│   hükmü ve içtihat gerekçesi resmi fetva bülteni no: 100/2012).        │
│ • GİMDES: Helal Gıda ve İhtiyaç Maddeleri Standardı Madde 4.2 (Böcek   │
│   ve istihale kabul edilmeyen maddeler tebliği).                       │
│ • MUI: Fatwa MUI No. 33 Tahun 2011 (Pewarna Karmin).                   │
│ • Yasal Ayrım: InciFact'in bağımsız bir araştırma motoru olduğu,       │
│   herhangi bir kurumla ticari ortaklığı bulunmadığı beyanı.            │
└────────────────────────────────────────────────────────────────────────┘
```

**Yapılacak Teknik İşlemler:**
1. `src/i18n/locales.mjs` içine 10 dilde `legalDisclaimerMicro` ve `legalMethodology` metinlerinin eklenmesi.
2. `public/index.html` ve `src/mobile/ScannerApp.tsx` Helal kartı altına bu mikro uyarının ve modal tetikleyicisinin yerleştirilmesi.

---

## 2. Adım: Barkod Entegrasyonu ve Milyonluk Ürün Kapsamı (Barkod + Hibrit UX)

### Risk ve Teşhis:
Uygulamada şu an 142 madde ve 30 kural vardır. INCI Beauty 17.000 bileşen tanımaktadır. Sadece fotoğrafla içerik taramak; kavisli şampuan şişelerinde, küçük puntolarda ve market ışığında kullanıcı deneyimini zorlaştırmaktadır. Yuka'nın 80 milyon kullanıcıya ulaşmasının ana sebebi **tek dokunuşla barkod okutma kolaylığıdır**.

### Uygulama Mimarisi:
Sıfırdan milyonlarca ürün girmek yerine, dünyanın en büyük açık veri tabanları olan **Open Food Facts (OFF)** ve **Open Beauty Facts (OBF)** REST API'si sisteme köprü olarak bağlanır.

```
                     ┌───────────────────────────┐
                     │    KULLANICI EKRANI       │
                     └─────────────┬─────────────┘
                                   │
                     Barkod Okutuldu (100 ms)
                                   ▼
          ┌─────────────────────────────────────────────────┐
          │ Open Food Facts / Open Beauty Facts REST API    │
          │ https://world.openbeautyfacts.org/api/v2/       │
          │ product/{barcode}.json                          │
          └────────────────────────┬────────────────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 │                                   │
          [Ürün Bulundu]                     [Ürün Bulunamadı]
                 │                                   │
                 ▼                                   ▼
    İçerik listesi JSON olarak        "Barkod henüz kayıtlı değil.
    çekilir (Türkçe/İngilizce INCI)    Ambalaj arkasındaki içerik
                 │                     yazısını fotoğraflayın."
                 ▼                                   │
    ┌──────────────────────────┐                     │
    │  InciFact Kural Motoru   │                     ▼
    │  (ruleEngine.mjs)        │◄────────── OCR Fotoğraf Akışı
    │  - Sağlık Puanı (0-100)  │
    │  - Fıkhi Helal Hükmü     │
    │  - Profil Uyarıları      │
    └──────────────────────────┘
```

**Bu Entegrasyonun Sağlayacağı Devrim:**
1. **Sıfır Veri Tabanı Bakım Maliyeti:** Dünya genelindeki 3 milyondan fazla gıda ve 1 milyondan fazla kozmetik barkodu anında InciFact'e açılır.
2. **Klon Uygulamalardan Ayrışma:** Sadece etiket okuyan klonların aksine, InciFact hem barkodlu (Yuka kolaylığı) hem de barkodsuz (lokal ürün üstünlüğü) çalışan hibrit bir deve dönüşür.
3. **Kural Motoru Üstünlüğü:** Open Food Facts'in ham verisi çekilir, ancak hükmü ve puanı InciFact'in hatasız çalışan deterministik kural motoru verir!

---

## 3. Adım: Kurumsal Gece Mavisi & Asil Altın UI Giydirmesi (Branding & UX)

### Tasarım Mimarisi:
Kullanıcının kurumsal kimliği ile bilimsel ergonomi **60-30-10 renk dağılımı** ile birleştirilecektir:

| Katman | Renk / Kod | Arayüzdeki Yeri | Psikolojik Etkisi |
| :--- | :--- | :--- | :--- |
| **%60 Hakim Taban (Canvas)** | `#0B132B` (Derin Gece Mavisi) / Dark Navy | Uygulama çerçevesi, üst header, navigasyon barı, koyu mod arka planı | Sarsılmaz resmiyet, devlet teftişi, laboratuvar ciddiyeti. |
| **%30 İçerik Kartları (Surfaces)** | `#141C33` (Slate Dark) veya `#FFFFFF` (Light) | Bileşen analiz kartları, içerik listesi panelleri, metin zeminleri | WCAG AAA seviyesinde yüksek kontrast, sıfır göz yorgunluğu. |
| **%5 Kurumsal Prestij Vurgusu** | `#D4AF37` / `#C5A059` (Şampanya Altın) | **Yeni 'IF' Kalkan Amblemi**, onaylanmış rapor mührü, kalkan çizgileri | Prestij, asalet, tescilli kalite hissi. |
| **%5 Semantik Trafik Işıkları** | 🟢 `#10B981` (Zümrüt Yeşili)<br>🟡 `#F59E0B` (Kehribar Sarısı)<br>🔴 `#EF4444` (Yakut Kırmızısı) | **Helal/Sağlık Durumları:**<br>Yeşil = Temiz/Helal<br>Sarı = Müşbuh/Alerjen<br>Kırmızı = Yasak/Haram | Asla kurumsal altınla karıştırılmaz; fıkhi netlik %100 korunur. |

**Varlık ve Kod Entegrasyonu:**
1. Üretilen **Seçenek A (Resmi Kurumsal Mühür)** web simülatörünün (`index.html`) header alanına ve üreticiye gönderilen resmi raporların tepesine mühür olarak eklenecek.
2. Üretilen **Seçenek B (Minimalist Kalkan İkonu)** mobil projenin (`app.json`) 1024x1024 uygulama ikonu ve splash ekranı olarak tanımlanacak.
3. CSS değişkenleri (`--primary: #0B132B; --gold: #D4AF37;`) arayüze bağlanarak modern lüks bir denetim platformu tasarımı elde edilecek.

---

## 4. İcra Sıralaması (Önerilen Uygulama Sırası)

```
[AŞAMA 1 - HUKUKİ ZIRH] ──────► 10 Dilde Yasal Feragatname ve Metodoloji Modalı
                                (Sıfır risk, hemen uygulanabilir)

[AŞAMA 2 - KURUMSAL UI] ──────► Gece Mavisi + Altın Kalkan Ambleminin Giydirilmesi
                                (Görsel algıyı 10 katına çıkarır)

[AŞAMA 3 - BARKOD MOTORU] ────► Open Food / Beauty Facts API Entegrasyonu
                                (Ürün kapsamını milyonlara fırlatır)
```
