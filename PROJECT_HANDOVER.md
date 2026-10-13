# INCIFACT — TAM PROJE HAFIZASI VE DİJİTAL DEVİR PROTOKOLÜ (HANDOVER MASTER)

> **Tarih:** 14 Ekim 2026  
> **Konum:** `C:\Projeler\clean-halal-scanner`  
> **Canlı Servis:** `http://localhost:3456`  
> **Mevcut Durum:** `npm test` tamamen geçiyor (39/39 kabul + 32/32 regresyon + 15/15 canlı parite) · Son **bağımsız** denetim: **94/100 NO-GO** (5. denetim, commit `f2a6d27`; rapor `docs/handover/audit-5_94-100_rapor.md`). Tek açık P1 (MCI/MI 3:1 oran kontrolünde 2.7–3.3 geniş toleransının 2.8:1 ve 3.2:1 örneklerini "doğrulandı" sayması) dar kayan nokta toleransıyla (`1e-6`) düzeltildi, yeniden denetim bekliyor. Puan geçmişi: 56 → 68 → 80 → 92 → 94.
>
> **Ek belgeler:** `docs/handover/` klasöründe tüm bağımsız denetim raporları (`56/100`, `68/100`, `80/100`, `92/100`, `94/100`), yol haritası, App Store gelir analizi, barkod/OFF mimarisi, marka/renk raporları ve görsel üretim promptları duruyor.

## 0. YENİ OTURUMDA İLK YAPILACAKLAR
1. Bu dosyayı ve `docs/handover/audit-5_94-100_rapor.md` dosyasını baştan sona oku.
2. `npm test` çalıştır; sonuçların 39/39 kabul, 32/32 regresyon, 80 yerel örnekte 0 bilinmeyen ve 0 çakışma olduğunu doğrula.
3. `node server.mjs` ile servisi başlat (port 3456) ve `node tests/audit3_live_parity.mjs` ile 15/15 canlı/disk eşitliğini doğrula.
4. Aşağıdaki **Bölüm 7: Güncel Durum ve Tarihsel Denetim Kayıtları** bölümünden devam et.

---

## 1. PROJE KİMLİĞİ VE MİMARİSİ

InciFact; kozmetik ve gıda ürün içeriklerini (INCI & Gıda etiketleri) 10 dilde deterministik (LLM/halüsinasyon bağımsız) olarak analiz eden, kişisel hassasiyet profillerini ve çok otoriteli Helal/Vegan standartlarını değerlendiren yeni nesil bir analiz platformudur.

### Ana Dizinler ve Dosya Rolleri:
* **`C:\Projeler\clean-halal-scanner\`**
  * `src/engine/ruleEngine.mjs`: Projenin kalbi olan deterministik kural motoru. 4 kart üretir (`regulatoryCard`, `profileCard`, `halalCard`, `veganSugarCard`). Platform bağımsızdır (`node:fs`/`path`/`url` içermez, veriyi `src/data/generated/*.mjs` ES modüllerinden alır). Regex tabanlı ReDoS korumalı tokenizer, kimyasal lokant koruması (`1,2-Hexanediol`, `1،2-ہیکسانڈیول`), konsantrasyon ayrıştırıcı (`parseConcentration`), tarih/takvim doğrulayıcı (`isValidDate`), 14 majör alerjen motoru ve çok dilli normalizasyon içerir.
  * `src/data/substances.json`: Temel aktif bileşenler, AB Ek II/III/V/VI kısıtları, 10 dildeki eşanlamlılar (alias). Düzenlendikten sonra `npm run build:data` ile ES modüllerine derlenir.
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
  * `tests/audit3_regressions.mjs` & `tests/audit3_live_parity.mjs`: Bağımsız denetim regresyon ve canlı API parite testleri.
  * `scripts/audit_collisions.mjs`: Alias çakışma denetleyicisi (Her zaman 0 çakışma vermelidir).

---

## 2. GEÇMİŞ DENETİM SÜRECİ VE ÇÖZÜLEN TÜM KRİTİK TUZAKLAR

Proje bağımsız bir QA / Baş Denetçi tarafından 5 aşamada sınandı (raporlar `docs/handover/`):
1. **1. denetim: 56/100 (NO-GO)** — 31 test geçmesine rağmen 7 kritik açık (`docs/handover/audit-1_56-100_RAPOR.md`).
2. **2. denetim: 68/100 (NO-GO)** — kısmi düzeltmeler, sınır koşulları eksik (`docs/handover/audit-2_68-100_yeniden-denetim.md`).
3. **3. denetim: 80/100 (NO-GO)** — konsantrasyon, MCI+MI toplamı, bağlam, alerjen negasyonu P1'leri (`docs/handover/audit-3_80-100_nihai-denetim.md`).
4. **4. denetim (commit `7daf9c6`): 92/100 (NO-GO)** — önceki tüm P1/P2'ler kapandı; tek P1: MCI/MI 3:1 oranı denetlenmiyordu (`docs/handover/audit-4_92-100_rapor.md`).
5. **5. denetim (commit `f2a6d27`): 94/100 (NO-GO)** — 4 ana oran vakası geçti; ancak `2.7–3.3` (±%10) toleransı nedeniyle `2.8:1` ve `3.2:1` sınır varyantları "3:1 olarak doğrulandı" döndürdü (`docs/handover/audit-5_94-100_rapor.md`). Bu tek P1 dar kayan nokta toleransı (`Math.abs(ratio - 3) <= 1e-6`) ile kapatıldı; **yeniden denetim bekliyor**. Bağımsız bir GO kararı henüz YOK.

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

## 7. GÜNCEL DURUM — 5. BAĞIMSIZ DENETİM (94/100 NO-GO) VE SON DÜZELTME

Kaynak: `docs/handover/audit-5_94-100_rapor.md` (Hedef commit: `f2a6d27`).

### 5. Denetimde Tespit Edilen Tek Kalan P1 ve Kapatılması (14 Ekim 2026)
- **Bulgu (P1):** `src/engine/ruleEngine.mjs` satır 1306'da `ratio >= 2.7 && ratio <= 3.3` (±%10 tolerans) kullanıldığı için `0.0007% + 0.00025%` (`2.8:1`) ve `0.0008% + 0.00025%` (`3.2:1`) sınır örnekleri `"MCI/MI oranı 3:1 olarak doğrulandı"` notuyla 80 puan alıyordu.
- **Uygulanan Çözüm:**
  1. Geniş `2.7–3.3` aralığı kaldırıldı; yalnızca ikili kayan nokta (IEEE-754) yuvarlama hatasını tolere eden dar epsilon (`Math.abs(ratio - 3) <= 1e-6`) tanımlandı.
  2. Açık miktarların `3:1` olmadığı `2.8:1` (`0.0007% + 0.00025%`) ve `3.2:1` (`0.0008% + 0.00025%`) örnekleri artık `yasak` (Skor **10**, Tavan **10**) alır ve hukuki metinde gerçek oranı (`Etiketteki oran 2.8:1` / `Etiketteki oran 3.2:1`) gösterir.
  3. Her iki sınır varyantı hem `tests/audit3_regressions.mjs` (**32/32**) hem de `tests/audit3_live_parity.mjs` (**15/15**) paketlerine eklendi.
- **Bulgu (P3):** Bu belgedeki (`PROJECT_HANDOVER.md`) Bölüm 5 ve Bölüm 7 arasındaki tarihsel "hâlâ açık" ifadeleri temizlendi ve tarihsel arşiv olarak işaretlendi.
- **Kapsam Dışı Notu:** Gerçek iOS/Android cihaz derlemesi (`npm install` + EAS build) kapsam dışıdır; 5. denetim raporunda bunun ret (NO-GO) gerekçesi olmadığı açıkça kaydedilmiştir.

