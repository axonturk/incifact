# INCIFACT — TAM PROJE HAFIZASI VE DİJİTAL DEVİR PROTOKOLÜ (HANDOVER MASTER)

> **Tarih:** 30 Ekim 2026  
> **Konum:** `C:\Projeler\clean-halal-scanner`  
> **Canlı Servis:** `http://localhost:3456`  
> **Mevcut Durum:** `npm test` tamamen geçiyor (50/50 kabul + 32/32 regresyon + 15/15 canlı parite + 0 çakışma) · 7. ve 8. bağımsız Teknik & UI/UX denetimlerinde tespit edilen tüm P0, P1 ve P2 bulgular regresyon testleriyle kapatılmıştır.
>
> **Ek belgeler:** `docs/handover/` klasöründe tüm bağımsız denetim raporları, yol haritası, App Store gelir analizi, barkod/OFF mimarisi, marka/renk raporları ve görsel üretim promptları duruyor.

## 0. YENİ OTURUMDA İLK YAPILACAKLAR
1. Bu dosyayı ve `docs/handover/audit-6_100-100_GO_rapor.md` dosyasını baştan sona oku.
2. `npm test` çalıştır; sonuçların 50/50 kabul, 32/32 regresyon, 80 yerel örnekte 0 bilinmeyen (70/80 %100 kapsam + 10/80 %86 kasıtlı SLS/SLES OCR teyit örneği) ve 0 çakışma olduğunu doğrula.
3. `node server.mjs` ile servisi başlat (port 3456) ve `node tests/audit3_live_parity.mjs` ile 15/15 canlı/disk eşitliğini doğrula.
4. Aşağıdaki **Bölüm 7: Güncel Durum ve Nihai Teknik Denetim Kapsamı** ve **Bölüm 8: Kullanıcı Odaklı 4 Ek Özellik & 7–8. Denetim Kapanışları** bölümlerini incele.

---

## 1. PROJE KİMLİĞİ VE MİMARİSİ

InciFact; kozmetik ve gıda ürün içeriklerini (INCI & Gıda etiketleri) 10 dilde deterministik (LLM/halüsinasyon bağımsız) olarak analiz eden, kişisel hassasiyet profillerini ve çok otoriteli Helal/Vegan standartlarını değerlendiren yeni nesil bir analiz platformudur.

### Ana Dizinler ve Dosya Rolleri:
* **`C:\Projeler\clean-halal-scanner\`**
  * `src/engine/ruleEngine.mjs`: Projenin kalbi olan deterministik kural motoru. 4 kart üretir (`regulatoryCard`, `profileCard`, `halalCard`, `veganSugarCard`). Platform bağımsızdır (`node:fs`/`path`/`url` içermez, veriyi `src/data/generated/*.mjs` ES modüllerinden alır). Regex tabanlı ReDoS korumalı tokenizer, kimyasal lokant koruması (`1,2-Hexanediol`, `1،2-ہیکسانڈیول`), konsantrasyon ayrıştırıcı (`parseConcentration`), tarih/takvim doğrulayıcı (`isValidDate`), 14 majör alerjen motoru ve çok dilli normalizasyon içerir.
  * `src/data/substances.json`: Temel aktif bileşenler, AB Ek II/III/V/VI kısıtları, 10 dildeki eşanlamlılar (alias). Düzenlendikten sonra `npm run build:data` ile ES modüllerine derlenir.
  * `src/data/halal_rules.json`: GİMDES, JAKIM, MUI, IFANCA fetva ve standart matrisi; Etanol, Karmin, Jelatin, Kolesterol (`cholesterol_lipid`), E471.
  * `src/data/cosing_ingredients.json`: 30.609 resmi AB CosIng bileşeni (`s:0` izinli, `s:1` kısıtlı, `s:2` yasaklı).
  * `src/data/hidden_sugars.json`: 50+ serbest ve gizli şeker kaynağı (şurup, dekstroz vs.), maltodekstrin ayrımı.
  * `src/data/sources.json`: 22 resmi hukuki dayanak ve bilimsel otorite kaynağı (EFSA, AB 1223/2009, AB 1169/2011, FDA, GİMDES, JAKIM vb.).
  * `src/i18n/locales.mjs`: 10 pazar dili (TR, EN, AR, DE, FR, ID, MS, ES, RU, UR), RTL kuralları (`dir: 'rtl'`), yerelleştirilmiş arayüz metinleri.
  * `public/index.html`: 5 ekranlı canlı web stüdyosu / simülatörü (Profil, OCR Tara, Sonuç, Helal, Karşılaştır) ve yan denetim paneli.
  * `src/mobile/ScannerApp.tsx`: Expo SDK 52 / React Native mobil istemci (Sakin ve prestijli lüks arayüz, cihaz içi yerel analiz, `AsyncStorage` kalıcılığı).
  * `src/mobile/ocrService.ts`: Mobil Vision / ML Kit OCR adaptörü (Dürüst OCR; ölçülmemiş güven değeri durumunda sahte %94 uydurmaz).
  * `server.mjs`: Node.js HTTP mikro-servisi (Port: `3456`, `/api/evaluate`, `/api/compare`, `/api/locales`, ReDoS/DoS/JSON korumalı).
  * `tests/verify_engine.mjs`: Projenin resmi 50 maddelik kabul testleri paketi.
  * `tests/audit3_regressions.mjs` & `tests/audit3_live_parity.mjs`: Bağımsız denetim regresyon ve canlı API parite testleri.
  * `scripts/audit_collisions.mjs`: Alias çakışma denetleyicisi (Her zaman 0 çakışma vermelidir).

---

## 2. GEÇMİŞ DENETİM SÜRECİ VE ÇÖZÜLEN TÜM KRİTİK TUZAKLAR

Proje bağımsız bir QA / Baş Denetçi tarafından 6 aşamada sınandı (raporlar `docs/handover/`):
1. **1. denetim: 56/100 (NO-GO)** — 31 test geçmesine rağmen 7 kritik açık (`docs/handover/audit-1_56-100_RAPOR.md`).
2. **2. denetim: 68/100 (NO-GO)** — kısmi düzeltmeler, sınır koşulları eksik (`docs/handover/audit-2_68-100_yeniden-denetim.md`).
3. **3. denetim: 80/100 (NO-GO)** — konsantrasyon, MCI+MI toplamı, bağlam, alerjen negasyonu P1'leri (`docs/handover/audit-3_80-100_nihai-denetim.md`).
4. **4. denetim (commit `7daf9c6`): 92/100 (NO-GO)** — önceki tüm P1/P2'ler kapandı; tek P1: MCI/MI 3:1 oranı denetlenmiyordu (`docs/handover/audit-4_92-100_rapor.md`).
5. **5. denetim (commit `f2a6d27`): 94/100 (NO-GO)** — 4 ana oran vakası geçti; ancak `2.7–3.3` (±%10) toleransı nedeniyle `2.8:1` ve `3.2:1` sınır varyantları "3:1 olarak doğrulandı" döndürdü (`docs/handover/audit-5_94-100_rapor.md`).
6. **6. denetim (commit `cdaf95c`): 100/100 (GO — denetlenen kural motoru ve yerel API regresyon kapsamı için)** — `2.8:1` ve `3.2:1` dahil tüm MCI/MI oran vakaları (6/6), 39/39 kabul, 32/32 regresyon, 15/15 canlı parite, 86 stres değerlendirmesi, 70 botanik varyantı ve 80 yerel örnek (70/80 %100 kapsam + 10/80 %86 kasıtlı SLS/SLES OCR teyit örneği; 0 bilinmeyen madde) doğrulandı (`docs/handover/audit-6_100-100_GO_rapor.md`).

Aşağıdaki liste ilk denetimlerde çözülen konuları anlatır:

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
# 1. Resmi 50 kabul testi (Her zaman 50/50 GEÇMELİDİR)
node tests/verify_engine.mjs

# 2. Sözlük çakışma kontrolü (Her zaman 0 çakışma OLMALIDIR)
node scripts/audit_collisions.mjs

# 3. Canlı API sunucusunu başlatma (Port: 3456)
node server.mjs

# 4. Tam paket testi (50 kabul + 32 regresyon + veri senkronu + HTML script sözdizimi + 0 çakışma)
npm test

# 5. Canlı API ve disk motoru parite testi (15/15)
node tests/audit3_live_parity.mjs
```

---

## 4. ALTIN KURALLAR VE KORUNACAK PRENSİPLER
1. **Mevcut Testleri Asla Bozma:** `tests/verify_engine.mjs` içindeki 50 test her zaman %100 geçmelidir.
2. **Canlı API ve Disk Paritesi:** `http://localhost:3456` üzerindeki canlı servis yanıtları, disk motoru çıktısıyla zaman damgası hariç her zaman `%100 birebir` (`liveEqualsDisk: true`) olmalıdır. Motorda değişiklik yapıldığında arka plandaki `server.mjs` yeniden başlatılmalıdır.
3. **Dokümantasyon Bütünlüğü:** Dosyalardaki mevcut yorum satırları, mevzuat referansları ve kod yapıları korunmalıdır.

---

## 5. [TARİHSEL ARŞİV — ESKİ BULGULAR (2. DENETİM 68/100 DÖNEMİNDEN KAPANANLAR)]

> **Not:** Aşağıdaki maddeler 2. denetim (`68/100`) sonrasında kaydedilmiş tarihsel bulgulardır. Denetim 3, 4 ve 5 itibarıyla kod tabanında **tamamı kapatılmış ve doğrulanmıştır** (yalnızca gerçek fiziksel mobil cihaz / EAS derlemesi kapsam dışı bırakılmıştır):

1. ~~**Kafeinsiz enerji içeceği:**~~ **[KAPANDI — Denetim 3'te doğrulandı]** Kafein ve Taurin/İnositol ayrıldı; kafeinsiz içecekte "yüksek kafein" uyarısı üretilmez.
2. ~~**Petrolatum:**~~ **[KAPANDI — Denetim 4 & 5'te doğrulandı (`7daf9c6`)]** Avrupa Farmakopesi tam rafinasyon geçmişi istisnası açık `"VARSAYIM: ... üretici rafinasyon belgesi bu taramada doğrulanmamıştır"` notuyla sunulur.
3. ~~**Mobil çekirdek taşınabilir değil (`node:fs`, `node:path`, `node:url`):**~~ **[KAPANDI — Denetim 4 & 5'te doğrulandı (`7daf9c6`)]** `src/engine/ruleEngine.mjs` içinden Node.js yerleşik modülleri tamamen kaldırıldı; veriler `src/data/generated/*.mjs` ES modüllerinden yüklenir (`npm run build:data` + `tests/data_modules_sync.mjs` + `metro.config.cjs`). *(Not: Gerçek cihaz / EAS derlemesi kapsam dışıdır ve denetim raporunda ret gerekçesi olmadığı açıkça belirtilmiştir).*
4. ~~**Gizlilik beyanı çelişkisi:**~~ **[KAPANDI — Denetim 4 & 5'te doğrulandı (`7daf9c6`)]** `src/i18n/locales.mjs` (10 dilde) ve `ruleEngine.mjs` (`kvkkNotice`) metinleri mobil cihaz içi işleme ile web simülatörünün yerel (`localhost`) analiz sunucusu ayrımını dürüstçe açıklayacak şekilde güncellendi.
5. ~~**Bağlam & şema çelişkisi:**~~ **[KAPANDI — Denetim 4 & 5'te doğrulandı (`8455e71`)]** Açık yapılandırılmış `applicationType` (`leave_on` / `rinse_off`) etiket metnindeki kelime eşleşmelerine önceliklidir; çelişki durumunda ihtiyatlı `leave_on` uygulanır ve `ÇELİŞKİ` notu düşülür.
6. ~~**CosIng Ek III (`s=1`) görünürlüğü:**~~ **[KAPANDI — Denetim 4 & 5'te doğrulandı (`7daf9c6`)]** `ETHOXYDIGLYCOL`, `BUTOXYDIGLYCOL` vb. CosIng `s=1` kayıtları `kisitli` bulgu olarak raporlanır.
7. ~~**UI tarayıcı / hazır etiket rozet uyumu:**~~ **[KAPANDI (`a0165ee`)]** Web simülatöründeki hazır senaryo kartlarının (COSRX Salyangoz Müsini, Jöle E120 vb.) rozetleri, aktif dil ve helal otoritesine göre doğrudan canlı `evaluateProduct` motorundan dinamik olarak hesaplanır (`refreshPresetVerdictBadges`).

---

## 6. [TARİHSEL ARŞİV — 3. VE 4. DENETİMDE (80/100 → 92/100) KAPANAN BULGULAR]

Kaynaklar: `docs/handover/audit-3_80-100_nihai-denetim.md` (`80/100`) ve `docs/handover/audit-4_92-100_rapor.md` (`92/100`). Bu maddelerin tamamı 4. ve 5. bağımsız denetimlerde **geçti** olarak doğrulanmıştır:

- ✅ **P1-1 Konsantrasyon normalizasyonu (`8455e71`):** Doğu Arapça/Urduca rakamlar (`٤٪`, `۴٪`, `٠٫٠٠١٦٪`), Arapça yüzde `٪`, ondalık `٫` ve `ppm` (`20 ppm = %0.002`, `15 ppm = %0.0015`) tek `parseConcentration` fonksiyonunda birleştirildi.
- ✅ **P1-2 MI/MCI karışım toplamı (`8455e71`):** Gözlemler tek tek değil, toplam izotiazolinon konsantrasyonu üzerinden değerlendirilir (`totalIsoConc > 0.0015` → `yasak`, tavan 10).
- ✅ **P1-3 Açık uygulama türü önceliği (`8455e71`):** `applicationType='leave_on'` + `"Shampoo:"` etiketi → skor 10 + `ÇELİŞKİ` notu.
- ✅ **P1-4 Hedefe bağlı alerjen negasyonu (`8455e71`):** `Milk-free Soy Lecithin` → yalnızca Soya uyarısı; `Gluten-free Mustard` → yalnızca Hardal uyarısı; `Glutensiz un` → gluten uyarısı yok.
- ✅ **P1-5 Türkçe "Acı Bakla" (`8455e71`):** İki kelimeli `Acı Bakla` Lupin alerjen desenine eklendi.
- ✅ **P2-6 Sahte gluten alarmı (`8455e71`):** Alerjen taraması yalnızca `obs.raw` üzerinde çalışır; `Egg` ve `Hardal` sahte gluten uyarısı üretmez.
- ✅ **P2-7 Hidrokinon profesyonel kullanım şartı (`8455e71`):** `professionalUse=false` durumunda `%0.02` tırnak sistemi istisnası kapanır ve skor 10 olur.
- ✅ **P2-8..12 Sözlük, CosIng Ek III, Gizlilik, Platform bağımsızlığı, Petrolatum VARSAYIM (`7daf9c6`):** 80 yerel örnekte 0 bilinmeyen bileşen; `node:fs`/`path`/`url` kaldırıldı.
- ✅ **Denetim-4 P1 — MCI/MI 4 ana oran vakası (`f2a6d27`):** `1:1` (`0.0005% + 0.0005%` → 10), `3:1` (`0.00075% + 0.00025%` → 80), toplam sınırda `3:1` (`0.001125% + 0.000375%` → 80) ve miktarsız `MCI + MI` (`DOĞRULANAMADI`, `kisitli` → 80) 5. denetimde **4/4 geçti**.

---

## 7. GÜNCEL DURUM VE NİHAİ TEKNİK DENETİM (100/100 · GO) KAPSAMI

Kaynak: `docs/handover/audit-6_100-100_GO_rapor.md` (Hedef commit: `cdaf95cdeb489f1de5cb7d9843968c046e0aea81`).

### 6. Bağımsız Denetim Sonucu: **100/100 · GO** (14 Ekim 2026)
- **Puan Kartı:**
  - Test tekrarlanabilirliği, veri senkronu, API eşitliği: **25 / 25**
  - Konsantrasyon, kullanım bağlamı ve denetlenen mevzuat koşulları: **30 / 30**
  - Alerjen/negasyon, OCR, dil ve belirsizlik: **25 / 25**
  - Dayanıklılık, platform ayrımı ve gizlilik beyanı: **20 / 20**
  - **Toplam:** **100 / 100 · GO** *(denetlenen kural motoru ve yerel API regresyon kapsamı için)*
- **Son Kapanan P1 (`cdaf95c`):** `src/engine/ruleEngine.mjs:1306` satırındaki MCI/MI `3:1` oran kontrolü `Math.abs(ratio - 3) <= 1e-6` epsilonuna çekildi. `2.8:1` (`%0.0007 + %0.00025`) ve `3.2:1` (`%0.0008 + %0.00025`) sınır varyantları artık **Skor 10 / Tavan 10 (`yasak`)** alıyor ve hukuki notta gerçek oranı (`2.8:1` / `3.2:1`) gösteriyor.
- **Doğrulanan Kapsam Özeti:**
  - `npm test`: **39/39** kabul kriteri + **32/32** regresyon + 0 sözlük çakışması + veri modülü senkronu + HTML script sözdizimi kontrolü.
  - `node tests/audit3_live_parity.mjs`: **15/15** canlı API = disk motoru eşitliği.
  - Bağımsız `closure.mjs` (**6/6**), `stress20.mjs` (**86/86** canlı değerlendirme/karşılaştırma, 0 fark), `language-precedence.mjs` (80 yerel örnekte **0 bilinmeyen madde**: **70/80 %100 kapsam**, **10/80 %86 kapsam** — kalan 10 örnek her dildeki kasıtlı SLS/SLES OCR teyidi örneğidir), `final-checks.mjs` (**70/70** yasaklı botanik varyantı = 10, API dayanıklılık kontrolleri).
- **GO Kararının Teknik Sınırı ve Kapsam Dışı Maddeler:**
  - Bu **100/100 · GO** kararı, **denetlenen kural motoru ve yerel API regresyon kapsamı** içindir.
  - Gerçek iOS/Android fiziksel cihaz derlemesi (`npm install` + EAS build), gerçek cihazda mobil OCR performansı, tam ekran tıklama testi ve App Store mağaza kabulü bu teknik denetimin kapsamı dışındadır.
  - Bu teknik GO kararı, mobil mağaza yayını onayı veya resmi toksikoloji / helal / mevzuat sertifikası olarak sunulmamalıdır.

---

## 8. KULLANICI ODAKLI 4 EK ÖZELLİK (10 DİLDE & HEM WEB HEM MOBİL)

1. **📸 WhatsApp / Instagram için Tek Tıkla "Sonuç Özeti Kartı" Paylaşımı:**
   - Web stüdyosunda (`public/index.html`) 3. Sonuç ekranında **📸 Sonuç Kartı (PNG / Paylaş)** ve **💬 Özeti Kopyala** butonları; `1080×1350` yüksek çözünürlüklü HTML5 `<canvas>` lüks paylaşım kartı üretimi, PNG indirme ve doğrudan WhatsApp paylaşımı.
   - Mobil istemcide (`src/mobile/ScannerApp.tsx`) React Native `Share.share` ile yerel paylaşım menüsü.
2. **⚖️ "Otoriteler Neden Farklı Karar Verdi?" Karşılaştırma İpucu (4 Kurum Matrisi):**
   - `src/engine/ruleEngine.mjs` içinde `halalCard.authorityComparison` ve her bulguda `authorityMatrix` (`GIMDES`, `JAKIM`, `MUI`, `IFANCA`), `hasAuthorityDifference` ve 10 dilde fıkhi fark açıklaması (`authorityDiffReason` — Karmin E120, Etanol, Şellak E904, Salyangoz Müsini vb.).
   - 4. Helal ekranında 4 kurumun kararını yan yana gösteren ve tıklandığında ilgili otoriteye geçiş yapan etkileşimli matris.
3. **🧬 Kişisel Özel Hassasiyet / Kara Liste Ekleme ("Benim Yasaklılarım" / `customWatchlist`):**
   - `evaluateProduct({ ..., customWatchlist })` içinde negasyon korumalı (`free`/`siz`/`ohne` muafiyetli) deterministik eşleşme (`profileStatuses.ozel_kara_liste` ve `'kirmizi'` uyarı).
   - 1. Profil ekranında serbest metin + hızlı öneri çipleri (`Niacinamide`, `Phenoxyethanol`, `Parfum`, `SLS`, `Palm Oil`, `MSG E621`, `Silicones`) ve cihaz içi kalıcı depolama (`incifact_custom_watchlist_v1`).
4. **🔄 Son Tarananlar Geçmişi & Tek Tıkla Karşılaştırmaya Aktarma (`scanHistory` & `A`/`B` Atama):**
   - Taranan ürünlerin cihaz içinde (`incifact_scan_history_v1`) otomatik saklanması; 3. Sonuç ekranından veya 5. Karşılaştır ekranındaki **🕘 Son Tarananlar** listesinden tek tıkla **🅰️ 1. Ürün (A) Yap** / **🅱️ 2. Ürün (B) Yap** ataması ve canlı yan yana karşılaştırma.
5. **🛡️ 7. ve 8. Bağımsız Teknik & UI/UX Denetim Kapanışları (Test 42–50):**
   - Parantezsiz `ppm` / `mg/kg` (`Methylisothiazolinone 20 ppm`, `MI 20 ppm` vs `10 ppm`) ayrıştırma, puanlama (`10` vs `90`) ve `compareProducts` `decidingDifference` tespiti (Test 46–47).
   - 10 dilin tamamında `status === 'yesil'` olan helal bulgularının `halalOkDesc` ile tutarlı açıklama üretmesi (Test 48).
   - Helal sertifikası (`halalCertified: true`) beyanının `authorityMatrix` içinde yalnız seçili otoriteyi çözmesi; `D_tartismali` kategorisinde `kirmizi` + sertifika (`Carmine E120` / `GIMDES`) durumunda `conflict`, `sari` + sertifika (`Snail Mucin` / `MUI` kozmetik) durumunda `yesil` üretmesi (Test 45, 49).
   - Kelime sınırlı negasyon (`free`, `without`, `no`, `sin`, `sans`, `ohne`), yağ alkolü koruması (`Alcohol` vs `Cetyl Alcohol`), 2 harfli alt-dize koruması ve `>50` kara liste sınır aşımında `'unknown'` belirsizlik koruması (Test 42–44, 50).
   - Web ve Native (`ScannerApp.tsx`) 6-durumlu paylaşım önceliği (kesin kırmızı bulgunun OCR uyarısıyla örtülmemesi), `AsyncStorage` kalıcılığı, 390px mobil çerçeve hizalaması ve İlk 3 Saniye Karar Başlığı (`Verdict Hero`).



