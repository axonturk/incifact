# InciFact f2a6d27 — oran düzeltmesi yeniden denetimi

**Nihai teknik puan: 94/100 — NO-GO.** İstenen dört oran vakası başarılı. Önceki 1:1 örneği kapandı; ancak oran kontrolünün 2.7–3.3 aralığını 3:1 diye doğrulaması nedeniyle aynı P1'in sınır varyantları açık.

Denetim 13 Ekim gecesi başladı, 14 Ekim 2026'da tamamlandı (Europe/Istanbul). Hedef commit: `f2a6d278b20f85756ea5e41b5631baaab9bb5647`; yerel depo `C:\Projeler\clean-halal-scanner`; canlı servis `http://localhost:3456`.

## 1. İstenen komutların sıralı sonucu

| Sıra | Kontrol | Sonuç / kanıt |
|---|---|---|
| 1 | `npm test` | Exit 0. Veri modülleri senkron; motor/locale platform kontrolü başarılı; **39/39 kabul + 30/30 regresyon**; 80 yerel örnekte bilinmeyen 0; sözlük çakışması 0. `01-npm-test.txt` |
| 2 | `node tests/audit3_live_parity.mjs` | **13/13**, HTTP 200, zaman damgası dışındaki disk/API çıktıları eşit; betikteki beklenti kontrolleri başarılı. `02-live-parity-retry.txt` |
| 3 | Önceki `details.mjs` değişmeden tekrar | **6/6** HTTP 200 ve disk/API eşitliği; eski hatalı oran 80 yerine 10. `03-details.txt`, `details-evidence.json` |
| Ek | Dört kapanış + iki yakın oran sınırı | **4/4 istenen vaka geçti; 0/2 sınır varyantı geçti.** `04-closure.txt`, `closure-evidence.json` |

İlk canlı test denemesi sandbox ağ erişiminde EACCES aldı; izinli yerel ağ erişimiyle aynı komut yeniden çalıştırıldı ve geçti. Bu, uygulama hatası değildir.

`audit3_live_parity` betiği 13 vakada eşitliği denetliyor; beklenen skor/tavan alanları vakaların bir kısmında tanımlı. Hukuki notlar dahil dört oran vakası ayrıca bağımsız `closure.mjs` ile kontrol edildi.

Önceki `details.mjs` değiştirilmediğinden içerisindeki eski commit alanı `7daf9c6`, yerel örnek özetinin girdisi ise önceki dil kanıtıdır. Bu metadata yeni commit veya yeni dil çalıştırması olarak kullanılmadı. Betiğin altı canlı isteği bu turda yeniden çalıştırıldı; güncel yerel etiket kontrolü `npm test` çıktısındadır.

## 2. İstenen dört koşul

| MCI + MI, rinse-off | Canlı skor / tavan | Hukuki not | Hüküm |
|---|---|---|---|
| 0.0005% + 0.0005% | **10 / 10** | Etiketteki oran **1:1**, izin verilen koşulu sağlamıyor | Geçti |
| 0.00075% + 0.00025% | **80 / null** | **3:1 olarak doğrulandı** | Geçti |
| 0.001125% + 0.000375% | **80 / null** | Oran 3:1; toplam 0.0015%, tavan uygulanmadı | Geçti |
| Miktarsız MCI + MI | **80 / null**, `kisitli` | Oran ve toplam **DOĞRULANAMADI**; üreticiden teyit gerekli; doğrulandı iddiası yok | Geçti |

## 3. Kalan P1 — geniş tolerans kesin doğrulama üretiyor

Commit'e sabitlenmiş kaynak noktası: `snapshot-f2a6d27/src/engine/ruleEngine.mjs:1306`.

```js
const ratioValid = ratioKnown && ratio >= 2.7 && ratio <= 3.3;
// 3:1 ± 10 % rounding tolerance
```

1322–1323 satırlarında bu geniş aralıktaki tüm oranlar **“MCI/MI oranı 3:1 olarak doğrulandı”** metnine dönüştürülüyor. Bu, yalnız ikili kayan nokta yuvarlama hatasını giderecek bir tolerans değildir.

İki canlı kanıt:

```text
Aqua, Methylchloroisothiazolinone 0.0007%, Methylisothiazolinone 0.00025%
applicationType = rinse_off
Gerçek oran: 2.8:1. Skor: 80. Tavan: null. Not: 3:1 olarak doğrulandı.

Aqua, Methylchloroisothiazolinone 0.0008%, Methylisothiazolinone 0.00025%
applicationType = rinse_off
Gerçek oran: 3.2:1. Skor: 80. Tavan: null. Not: 3:1 olarak doğrulandı.
```

Her iki örnekte HTTP 200 ve disk/API eşitliği var. Bu kapanış çalıştırması sırasında izlenen üretim dosyaları değişmemişti (`integrity.json`); bulgu f2a6d27'e aittir.

AB 1003/2014 Ek V/39, izin verilen karışımı 3:1 olarak tanımlar. İncelenen resmi metinde bu koşulu 2.7–3.3 aralığına genişleten bir tolerans bulunmuyor. [Resmi EUR-Lex metni](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014R1003).

**Etki:** Açık miktarların 3:1 olmadığını gösterdiği etikette doğrulanmış uygun karışım izlenimi oluşuyor. İstenen 1:1 örneğinin reddedilmesi bu yakın sınır açıklarını kapatmıyor.

**Kapatma ölçütü:** Sayısal işlem için dar bir kayan nokta toleransı kullanın. Etiket yuvarlamasının sonucu belirsizse bunu kesin “doğrulandı” sonucuna dönüştürmeyin; belirsizlik ve üretici teyidi gösterin. Açık uygunsuz oranlarda mevcut tavan 10 yolunu uygulayın. 2.8:1 / 3.2:1 örneklerini hem motor hem API regresyonuna ekleyin.

## 4. Önceki düzeltmelerde regresyon kontrolü

- `npm test` eski 24 regresyonun tamamını ve altı yeni oran regresyonunu geçti. Unicode yüzde/ppm, toplam konsantrasyon, leave-on önceliği/ÇELİŞKİ, hedef alerjen negasyonu, Acı Bakla, sahte gluten ve profesyonel hidrokinon kontrolleri başarılı.
- `details.mjs` ile MI 15 ppm → 90, Ethoxydiglycol/Butoxydiglycol Ek III kısıt bulguları, Petrolatum VARSAYIM notu tekrar görüldü. Platform bağımlılığı kontrolü başarılı; gerçek cihaz derlemesi yapılmadı.
- Yerel örneklerde 70/80 kapsam %100; kalan 10 örnek kasıtlı SLS/SLES OCR teyidi. Tanınmayan bileşen çıktısı yok.
- Ek olarak önceki 20 ana senaryo + 56 varyant + 10 dil kümesi çalıştırıldı. f2a6d27 kaynaklarına sabitlenmiş motorun özet çıktıları önceki 7daf9c6 sonuçlarıyla karşılaştırıldı: yalnız miktarsız ana MI/MCI örneğinin iki hukuki açıklaması, beklenen “DOĞRULANAMADI” yönünde değişmiş. Diğer kayıtlı özet davranışlarında regresyon görülmedi. `regression-comparison.json`.

Bu, çalıştırılan kümeler içindir; bütün olası etiketlerde regresyon bulunmadığı iddiası değildir.

## 5. Denetim sırasında sürüm değişikliği

Başlangıç HEAD'i f2a6d27 idi. İstenen komutlar ve dört kapanış vakasından sonra, HEAD'in **9c3ff4fecd92e7c1320f8d8c8495528c59b4922f** olduğu ve `public/index.html`, `src/engine/ruleEngine.mjs`, `src/i18n/locales.mjs` değiştiği görüldü. Denetçi üretim kodunu değiştirmedi.

Bu nedenle Git arşivinden ayrı `snapshot-f2a6d27` kopyası alındı. Eski stres betiğinin yalnız kaynak kökü bu kopyaya yönlendirildi; senaryo mantığı değiştirilmedi. Arşiv/check-out satır sonu farkları nedeniyle ham SHA-256 değerleri aynı olmayabilir; arşiv, Git commit'inden doğrudan üretilmiştir.

Geniş canlı regresyon turunun son kısmı farklı servis sürümüne denk geldi: sabit f2a6d27 motoruyla canlı yanıt özetlerinde 12 vakada müşbuh rozet/açıklama metni farkları görüldü. Bu karşılaştırmada genel disk/API eşitliği iddia edilmez. Skor/alerjen/kap davranışlarını ayıran karşılaştırma dosyası saklandı. Başlangıçtaki istenen 13/13 canlı eşitlik sonucu bu sonraki sürüm değişikliğinden önceki çalıştırmaya aittir.

Bu raporun 94/100 notu **f2a6d27** içindir; 9c3ff4f'e çıkış onayı verilmez veya f2a6d27'in bir hatası olarak sonraki metin değişiklikleri yazılmaz.

## 6. PROJECT_HANDOVER.md

Üstteki durum özeti ve Bölüm 2 güncellenmiş: son bağımsız sonuç 92/100 NO-GO, oran düzeltmesi yeniden denetim bekliyor; doğrulanmamış GO iddiası kaldırılmış. Bu denetim öncesi durum açısından doğru.

**P3 belge tutarlılığı:** Bölüm 5'te “hâlâ kapanmamış” altında Node fs/path/url ve gizlilik hatası devam ediyormuş gibi yazılıyor; Bölüm 7'nin sonraki düzeltme açıklaması bunların kapandığını söylüyor. Tarihsel listeler açıkça “eski bulgular” olarak işaretlenmeli. Bu belge eksikliği tek başına NO-GO gerekçesi değildir. Güncel yeniden denetim sonucunun belgeye aktarılması üretim dosyasına müdahale edilmediği için yapılmadı.

## 7. Puan ve karar

| Alan | Puan |
|---|---:|
| Test tekrarlanabilirliği, veri senkronu, başlangıç API eşitliği | 25/25 |
| Konsantrasyon, kullanım bağlamı, mevzuat koşulları | 24/30 |
| Alerjen/negasyon, OCR, dil ve belirsizlik | 25/25 |
| Dayanıklılık, platform ayrımı, gizlilik beyanı | 20/20 |
| **Toplam** | **94/100** |

Önceki 92/100'e göre artış, oran ayrıştırmasının ve kanıt eksikliğinin artık modellenmesine dayanır. Kalan geniş tolerans, kesin doğrulama hatasını sürdürür. Aktif P1 toplam puandan bağımsız çıkış engelidir.

**Karar: NO-GO.** Gerçek cihaz derlemesi kapsam dışında; ret gerekçesi değildir. Oran toleransı/kanıt modeli düzeltilip sabit commit ve yeniden başlatılmış servis üzerinde iki yakın oran varyantı doğrulanmadan GO verilmez.

Bu teknik kapsam değerlendirmesidir; mevzuat sertifikası, klinik güvenlik veya resmi helal onayı değildir. Kanıtlar bu klasörde saklanmıştır; üretim kodu değiştirilmemiştir.
