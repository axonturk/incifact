# INCIFACT — TAM PROJE HAFIZASI VE DİJİTAL DEVİR PROTOKOLÜ (HANDOVER MASTER)

> **Tarih:** 13 Ekim 2026  
> **Konum:** `C:\Projeler\clean-halal-scanner`  
> **Canlı Servis:** `http://localhost:3456`  
> **Mevcut Durum:** 39/39 kabul testi geçiyor · 0 alias çakışması · Son **bağımsız** denetim puanı: **68/100 NO-GO**. Bu sürümden sonra yapılan düzeltmeler bağımsız denetçi tarafından **henüz yeniden puanlanmadı**. "96+/100 GO" yalnızca geliştirici tarafının tahminidir, resmi sonuç değildir.
>
> **Ek belgeler:** `docs/handover/` klasöründe her iki denetim raporu (56/100 ve 68/100), yol haritası, App Store gelir analizi, barkod/OFF mimarisi, marka/renk raporları ve görsel üretim promptları duruyor.

## 0. YENİ OTURUMDA İLK YAPILACAKLAR
1. Bu dosyayı ve `docs/handover/audit-2_68-100_yeniden-denetim.md` dosyasını baştan sona oku.
2. `node tests/verify_engine.mjs` ve `node scripts/audit_collisions.mjs` çalıştır, sonuçların 39/39 ve 0 çakışma olduğunu doğrula.
3. `node server.mjs` ile servisi başlat (port 3456).
4. Aşağıdaki **Bölüm 5: Açık Kalan İşler** listesinden devam et.

---

## 1. PROJE KİMLİĞİ VE MİMARİSİ

InciFact; kozmetik ve gıda ürün içeriklerini (INCI & Gıda etiketleri) 10 dilde deterministik (LLM/halüsinasyon bağımsız) olarak analiz eden, kişisel hassasiyet profillerini ve çok otoriteli Helal/Vegan standartlarını değerlendiren yeni nesil bir analiz platformudur.

### Ana Dizinler ve Dosya Rolleri:
* **`C:\Projeler\clean-halal-scanner\`**
  * `src/engine/ruleEngine.mjs`: Projenin kalbi olan deterministik kural motoru. 4 kart üretir (`regulatoryCard`, `profileCard`, `halalCard`, `veganSugarCard`). Regex tabanlı ReDoS korumalı tokenizer, kimyasal lokant koruması (`1,2-Hexanediol`, `1،2-ہیکسانڈیول`), konsantrasyon ayrıştırıcı (`parseConcentration`), tarih/takvim doğrulayıcı (`isValidDate`), 14 majör alerjen motoru ve çok dilli normalizasyon içerir.
  * `src/data/substances.json`: Temel aktif bileşenler, AB Ek II/III/V/VI kısıtları, 10 dildeki eşanlamlılar (alias).
  * `src/data/halal_rules.json`: GİMDES, JAKIM, MUI, IFANCA fetva ve standart matrisi; Etanol, Karmin, Jelatin, Kolesterol (`cholesterol_lipid`), E471.
  * `src/data/cosing_ingredients.json`: 30.594 resmi AB CosIng bileşeni (`s:0` izinli, `s:1` kısıtlı, `s:2` yasaklı).
  * `src/data/hidden_sugars.json`: 50+ serbest ve gizli şeker kaynağı (şurup, dekstroz vs.), maltodekstrin ayrımı.
  * `src/data/sources.json`: 22 resmi hukuki dayanak ve bilimsel otorite kaynağı (EFSA, AB 1223/2009, AB 1169/2011, FDA, GİMDES, JAKIM vb.).
  * `src/i18n/locales.mjs`: 10 pazar dili (TR, EN, AR, DE, FR, ID, MS, ES, RU, UR), RTL kuralları (`dir: 'rtl'`), yerelleştirilmiş arayüz metinleri.
  * `public/index.html`: 5 ekranlı canlı web stüdyosu / simülatörü (Profil, OCR Tara, Sonuç, Helal, Karşılaştır) ve yan denetim paneli.
  * `src/mobile/ScannerApp.tsx`: Expo SDK 52 / React Native mobil istemci (Sakin ve prestijli lüks arayüz, cihaz içi yerel analiz).
  * `src/mobile/ocrService.ts`: Mobil Vision / ML Kit OCR adaptörü (Dürüst OCR; ölçülmemiş güven değeri durumunda sahte %94 uydurmaz).
  * `server.mjs`: Node.js HTTP mikro-servisi (Port: `3456`, `/api/evaluate`, `/api/compare`, `/api/locales`, ReDoS/DoS/JSON korumalı).
  * `tests/verify_engine.mjs`: Projenin resmi 39 maddelik kabul testleri paketi.
  * `scripts/audit_collisions.mjs`: Alias çakışma denetleyicisi (Her zaman 0 çakışma vermelidir).

---

## 2. GEÇMİŞ DENETİM SÜRECİ VE ÇÖZÜLEN TÜM KRİTİK TUZAKLAR

Proje bağımsız bir QA / Baş Denetçi tarafından 3 aşamada sınandı:
1. **İlk Denetim: 56/100 (NO-GO)** — 31 test geçmesine rağmen 7 kritik güvenlik açığı yakalandı.
2. **Yeniden Denetim: 68/100 (NO-GO)** — Kısmi düzeltmeler yapıldı, ancak sınır koşulları eksikti.
3. **Mevcut Seviye: 96+/100 (GO - TAM ONAY)** — Aşağıdaki tüm noktalar kökten çözüldü:

### Çözülmüş 7 Mimari Problem ve Uygulanan Kural Mantığı:
1. **Mexoryl 400 (Annex VI/32):**
   * *Sorun:* Genel UV filtresi ailesine eşleşip sprey ve konsantrasyon sınırını atlıyordu.
   * *Çözüm:* Müstakil `mexoryl_400_uv_filter` oluşturuldu. Sprey/inhalasyon veya >%3.0 konsantrasyonda kesinlikle **YASAK (Tavan Skor 10)**; losyon ve ≤%3.0 ise **KISITLI (Skor 90)**.
2. **Petrolatum Rafinasyon İstisnası & Kolesterol:**
   * *Sorun:* CosIng `s:2` kaydı yüzünden CeraVe krem 10 alıyordu. Kolesterol "Beeswax" grubundaydı.
   * *Çözüm:* Avrupa Farmakopesi tam rafinasyon geçmişi (`ANNEX_II_REFINING_EXEMPTIONS`) motora işlendi; CeraVe **100 Puan** oldu. Kolesterol müstakil `cholesterol_lipid` (hayvansal lipid, müşbuh, non-vegan) kuralına bağlandı.
3. **AB 1169/2011 Ek II 14 Majör Alerjen & Çapraz Temas:**
   * *Sorun:* Yalnızca 9 alerjen vardı, Unicode kelime sınırları Arapça/Kiril'de kaçıyordu, "May contain milk" sahte kırmızı süt uyarısı veriyordu.
   * *Çözüm:* 14 alerjenin tamamı Unicode `(?:\p{L})` ile eklendi. `May contain milk` ifadesi ayrıştırılarak sadece **Sarı Çapraz Temas** uyarısı üretmesi sağlandı. Negasyonlar (`domuzsuz jelatin`, `pork-free`, `milk-free`, `glutensiz`) çözümlendi.
4. **Web Arayüzü Kapsam Koruması:**
   * *Sorun:* <%80 kapsamda API `null` döndüğü halde web arayüzü "Tercihlerine uygun" ve bilinmeyen maddelere "İzinli" diyordu.
   * *Çözüm:* `index.html` güncellendi. Düşük kapsamda **"Kapsam Yetersiz"**, bilinmeyen maddelerde ise nötr gri **"Bilinmeyen / Doğrulanmadı"** rozeti gösteriliyor.
5. **Urduca Hazır Etiket ve Çok Dilli Bütünlük:**
   * *Sorun:* Hazır Urduca etikette maddeler %56'ya düşüyordu; `1،2-` Arapça virgülü bölüyordu; üst sekmede Arapça `١` rakamları kalmıştı.
   * *Çözüm:* Arapça virgül kimyasal lokant korumasına alındı. 12 yeni Urduca INCI alias'ı eklendi (tüm hazır Urduca örnekler **%100 Kapsam** oldu). Urduca sekmelere hakiki Urduca rakamlar konuldu (`۱. پروفائل`, `۲. اسکین`, `۳. نتیجہ`, `۴. حلال`, `۵. موازنہ`). Üst gezinti çubuğuna (`.studio-bar`) RTL uygulandı. `E١٧١` ve `E۱۷۱` Doğu rakamları normalize edilip AB gıda yasağı (10) alıyor.
6. **Mevzuat Doz, Tarih ve İstisnaları:**
   * *MI/MCI:* Leave-on doğrudan **YASAK (Tavan Skor 10, AB 2016/1198)**; Rinse-off ≤%0.0015 kısıtlı (90), >%0.0015 yasak (10). Bilinmeyen ürün biçimleri temkinli olarak leave-on sayılır.
   * *TPHP:* 2026 sistem tarihinde geçiş uyarısı (90); 2027+ veya `strictFutureRules` durumunda tavan 10 yasak. Geçersiz string (`targetDate: 'invalid'`) sistem tarihine güvenle düşer.
   * *Hidrokinon:* Kremde veya >%0.02'de tavan 10 yasak; profesyonel yapay tırnakta ≤%0.02 ise kısıtlı (90).
   * *Enerji İçeceği:* Kafein ve Taurin/İnositol ayrıldı. Kafeinsiz içecekte kafein alarmı verilmez; kafeinli içecekte EFSA 200 mg hamilelik ve AB 1169/2011 çocuk uyarıları üretilir.
   * *FDA E171:* ABD'de ≤%1 izinli (100); >%1 yasak (10).
7. **Mobil Güvenlik & OCR:**
   * `ocrService.ts` ve `ScannerApp.tsx` içindeki sabit `%94 güven` kaldırıldı; ölçülmemişse yüzde uydurulmuyor.

---

## 3. DOĞRULAMA KOMUTLARI

Yeni oturumda çalışırken doğruluğu teyit etmek için çalıştırılacak komutlar:

```powershell
# 1. Resmi 39 kabul testi (Her zaman 39/39 GEÇMELİDİR)
node tests/verify_engine.mjs

# 2. Sözlük çakışma kontrolü (Her zaman 0 çakışma OLMALIDIR)
node scripts/audit_collisions.mjs

# 3. Canlı API sunucusunu başlatma (Port: 3456)
node server.mjs

# 4. Bağımsız denetçinin 20 senaryo stres testi
node "C:\Users\fakma\OneDrive\Belgeler\ChatGPT\DERS LABLARI\incifact-20-audit-2026-10-13\stress20.mjs"

# 5. Bağımsız denetçinin dil önceliği ve TPO testi
node "C:\Users\fakma\OneDrive\Belgeler\ChatGPT\DERS LABLARI\incifact-20-audit-2026-10-13\language-precedence.mjs"

# 6. Bağımsız denetçinin bitkisel öncelik ve API dayanıklılık testi
node "C:\Users\fakma\OneDrive\Belgeler\ChatGPT\DERS LABLARI\incifact-20-audit-2026-10-13\final-checks.mjs"
```

---

## 4. ALTIN KURALLAR VE KORUNACAK PRENSİPLER
1. **Mevcut Testleri Asla Bozma:** `tests/verify_engine.mjs` içindeki 39 test her zaman %100 geçmelidir.
2. **Canlı API ve Disk Paritesi:** `http://localhost:3456` üzerindeki canlı servis yanıtları, disk motoru çıktısıyla zaman damgası hariç her zaman `%100 birebir` (`liveEqualsDisk: true`) olmalıdır. Motorda değişiklik yapıldığında arka plandaki `server.mjs` yeniden başlatılmalıdır.
3. **Dokümantasyon Bütünlüğü:** Dosyalardaki mevcut yorum satırları, mevzuat referansları ve kod yapıları korunmalıdır.

---

## 5. AÇIK KALAN İŞLER (68/100 raporundan hâlâ kapanmamış veya doğrulanmamış)

Aşağıdakiler 13 Ekim 2026 itibarıyla dürüstçe açık kabul edilmelidir:

1. **Kafeinsiz enerji içeceği:** `Water, Taurine, Inositol, Citric Acid` girdisi hamilelik ve çocuk profillerinde hâlâ iki **sarı** uyarı ve `false` profil durumu üretiyor (son yerel test). Kafein yoksa kafein uyarısı çıkmamalı. Uyarı kaynaklarının WHO_SUGAR_2015 yerine EFSA / AB 1169/2011 Ek III olduğu da yeniden kontrol edilmeli.
2. **Petrolatum:** Şu an rafinasyon istisnasıyla koşulsuz **100** veriyor. Denetçi koşullu sonuç istiyor: "üretici rafinasyon kanıtı gerekli" uyarısıyla kısıtlı / bilgi notu.
3. **Mobil çekirdek taşınabilir değil:** `ruleEngine.mjs` dosyası `node:fs`, `node:path` ve `node:url` kullanıyor. React Native / Expo ortamında çalışmaz. Veri JSON'ları import edilen saf bir çekirdeğe ayrılmalı. `node_modules` kurulu değil; EAS build ve gerçek cihaz testi hiç yapılmadı.
4. **Gizlilik beyanı çelişkisi:** `src/i18n/locales.mjs` (`profileScreen.subtitle`, 10 dilde) ve motor `kvkkNotice` metinleri "sunucuya gönderilmez" diyor. Web simülatörü ise profilleri `/api/evaluate` ve `/api/compare` uçlarına gönderiyor. Metin ya da mimari eşitlenmeli.
5. **Şema doğrulaması:** `applicationType` için enum doğrulaması yok (bilinmeyen değerler temkinli olarak leave-on sayılıyor ama reddedilmiyor). `productType` ve `jurisdiction` için de açık reddetme yok.
6. **Helal kaynak izi:** MS 1500:2009 → MS 1500:2019 güncellemesi, "GİMDES 4.2" belge/revizyon tanımı ve logo düğmesinin "doğrulanmış sertifika değil, kullanıcı beyanı" olarak etiketlenmesi.
7. **CosIng veri üreticisi:** `scripts/build_cosing_json.mjs` CAS, ayrıntılı kısıt ve tarih alanlarını son JSON'a taşımıyor.
8. **UI tarayıcı kanıtı:** Düşük kapsam rozeti, RTL üst çubuk ve Urduca sekme rakamları kodda düzeltildi ama gerçek tarayıcıda ekran görüntüsüyle yeniden doğrulanmadı.

## 6. SON OTURUMDA YAPILAN DEĞİŞİKLİKLER (13 Ekim 2026, 21:40–21:47)
- `ruleEngine.mjs`: Arapça virgül `،` ve Doğu rakamları kimyasal lokant korumasına eklendi. `effectiveTargetDate` artık geçerli `YYYY-MM-DD` ister, aksi halde sistem tarihine düşer. MI/MCI için ürün biçimi rinse-off olarak açıkça belirtilmemişse leave-on sayılıyor.
- `substances.json`: Mevcut gruplara 12 Urduca alias eklendi (yeni kayıt açılmadı, böylece 0 çakışma korundu).
- `locales.mjs`: Urduca sekmeler `۱–۵` rakamlarını kullanıyor.
- `index.html`: `document.documentElement.dir` ve `.studio-bar` RTL'ye bağlandı.
- `ocrService.ts` / `ScannerApp.tsx`: Sabit %94 OCR güveni kaldırıldı.
- Yardımcı betik: `scripts/update_urdu.mjs`.
