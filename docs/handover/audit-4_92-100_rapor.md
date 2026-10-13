# InciFact — bağımsız son yeniden denetim

**Sonuç: 92/100 — NO-GO.** İstenen düzeltme örnekleri geçti. Ancak MCI/MI karışımının mevzuatta belirtilen 3:1 oranını denetlemeyen bir P1 bulgusu canlı API ve diskteki motor üzerinde doğrulandı. Bu nedenle genel test başarısı çıkış onayına dönüştürülemez.

Denetim tarihi: 13 Ekim 2026. Yerel depo: `C:\Projeler\clean-halal-scanner`. HEAD: `7daf9c62efc2634a28f5e83c85e9011f57442613`. Yerel origin: `https://github.com/axonturk/incifact.git`. Servis: `http://localhost:3456`.

Bu denetimde üretim kodu değiştirilmedi. Başlangıç ve bitişte izlenen 28 üretim/veri/yapılandırma/test dosyasının SHA-256 değerleri aynı; Git çalışma ağacı temiz. Önceki betiklerin ürettiği rapor dosyaları yedeklenip eski konumlarında geri yüklendi; yeni çalıştırmaların sonuçları bu klasörde saklandı.

## 1. Sıralı çalıştırmalar ve sonuçlar

| Sıra | Komut / kapsam | Sonuç | Kanıt |
|---|---|---|---|
| 1 | `npm test` | Çıkış 0; veri senkronu ve platform kontrolü geçti; kabul 39/39; audit3 24/24; 80 yerel örnekte bilinmeyen 0; sözlük çakışması 0 | `01-npm-test.txt` |
| 2 | `node tests/audit3_live_parity.mjs` | 9/9; zaman damgası dışındaki çıktılar eşit | `02-live-parity.txt` |
| 3a | `node tests/verify_engine.mjs` | 39/39 | `03-verify-engine.txt` |
| 3b | Önceki `stress20.mjs` | 20 ana senaryo + 56 sınır varyantı + 10 dil karşılaştırması; 86 canlı değerlendirme/karşılaştırma; disk–API farkı 0 | `04-stress20.txt`, `results/evidence.json` |
| 3c | Önceki `language-precedence.mjs` | 80 yerel hazır örnekte bilinmeyen 0; 10 dilde TPO kapsamı %100 ve skor 10 | `05-language.txt`, `results/language-precedence-evidence.json` |
| 3d | Önceki `final-checks.mjs` | 70 CosIng yasaklı botanik varyantı 10; bozuk JSON 400, null 400, yaklaşık 70 KB gövde 413; sonrasında servis 200 | `06-final-checks.txt`, `results/final-check-evidence.json` |
| 4a | Önceki `critical.mjs` | 64 canlı istek HTTP 200; disk–API farkı 0 | `07-critical.txt`, `results/critical-evidence.json` |
| 4b | Önceki `confirm-gaps.mjs` | Negasyon ve toplam konsantrasyon açıkları verilen üç girdide kapandı | `08-confirm-gaps.txt`, `results/confirmed-gaps.json` |
| Ek | Bu denetimin `details.mjs` betiği | 6 canlı istek; disk–API farkı 0; bir yeni başarısız mevzuat koşulu | `09-details.txt`, `details-evidence.json` |

Önceki üç stres betiğinin kökü: `C:\Users\fakma\OneDrive\Belgeler\ChatGPT\DERS LABLARI\incifact-20-audit-2026-10-13`. Önceki bağımsız kritik betiklerin kökü: `C:\Users\fakma\OneDrive\Belgeler\ChatGPT\Test Ortamı\incifact-final-audit-2026-10-13`.

Testlerin tamamının süreç çıkış kodu 0 olması, betiklerde bulunmayan bir mevzuat koşulunun da uygulandığı anlamına gelmez. Yeni 1:1 oran örneği bu farkı ortaya çıkardı.

## 2. İstenen düzeltmelerin kapanış durumu

| Kontrol | Gözlenen sonuç | Durum |
|---|---|---|
| Mexoryl `٤٪` / `۴٪` | Losyonda 4% → 10; 3% → 90; inhalasyon/sprey varyantları → 10 | Geçti |
| MI `٠٫٠٠١٦٪`, 20 ppm, 15 ppm | Rinse-off: sırasıyla 10, 10, 90 | Geçti |
| MCI 0.0012% + MI 0.0004% | Toplam 0.0016% hesaplandı; 10 | Geçti; oran koşulu ayrıca başarısız |
| `applicationType=leave_on` + `Shampoo:` | Yapılandırılmış alan öncelikli; 10 ve ÇELİŞKİ notu | Geçti |
| `Milk-free Soy Lecithin` | Soya uyarısı var; sahte süt uyarısı yok | Geçti |
| `Gluten-free Mustard` | Hardal uyarısı var; sahte gluten yok | Geçti |
| `Acı Bakla`, Egg, Hardal | Acı bakla/lupin tanınıyor; Egg yalnız yumurta, Hardal yalnız hardal | Geçti |
| Hidrokinon yapay tırnak 0.02%, `professionalUse=false` | 10; aynı profesyonel kullanım alanı true olduğunda 90 | Geçti |
| 80 yerel hazır etiket | Tanınmayan madde sayısı 0; 70/80 kapsam %100; 10/80 kapsam %86 | Geçti; aşağıdaki OCR açıklamasıyla |
| Ethoxydiglycol | `euStatus=kisitli`; CosIng Ref 33802 ve Ek III koşul notu | Geçti: kısıt bulgusu |
| Butoxydiglycol | `euStatus=kisitli`; CosIng Ref 31695 ve Ek III koşul notu | Geçti: kısıt bulgusu |
| Gizlilik, 10 dil | Mobil yerel işleme / web yerel sunucu analizi ayrımı metinlere taşınmış | Geçti: mevcut kaynak ve veri akışı kapsamında |
| Platform | Motor Node `fs/path/url` bağımlılığı içermiyor; JSON'dan üretilen ES modüller senkron; `metro.config.cjs` mevcut ve mjs çözümlemesi var | Geçti: statik kontrol |
| Petrolatum | 100; bulguda `VARSAYIM`, rafinasyon geçmişi ve kanserojen olmadığının belgelenmesi şartı açık | Geçti: beyan şeffaflığı |

80 örneğin %100 kapsamda olmayan 10 tanesi, her dildeki aynı SLS/SLES OCR belirsizlik örneğidir. Kullanıcı teyidi beklenmesi amaçlanan davranıştır; bilinmeyen bileşen hatası değildir. Bu nedenle “80/80 %100 tanınma” ifadesi kullanılmamalıdır.

Ethoxydiglycol/Butoxydiglycol örnekleri skor 100 ürettiği halde kısıt kartı korunuyor ve konsantrasyon/kullanım koşullarının etiketten doğrulanamadığı belirtiliyor. Bu sonuç, konsantrasyon sınırlarının bütün varyantlarda uygulandığını veya ürünün koşulsuz mevzuata uygun olduğunu kanıtlamaz.

Gizlilik metinlerinde sağlık/inanç tercihlerinin mobilde cihazda işlendiği; web önizlemede yerel analiz sunucusuna gönderildiği, saklanmadığı ve üçüncü taraflarla paylaşılmadığı söyleniyor. Mevcut web–API ve mobil motor çağrı yollarıyla çelişki görülmedi. Bu kontrol, yayımlanmış mobil ikili dosyada ağ trafiği ölçümü veya genel KVKK/GDPR uyum sertifikası değildir.

## 3. Açık P1: MCI/MI 3:1 oranı kontrol edilmiyor

**Tekrarlanabilir canlı API girdisi:**

```json
{
  "rawText": "Aqua, Methylchloroisothiazolinone 0.0005%, Methylisothiazolinone 0.0005%",
  "applicationType": "rinse_off"
}
```

Gözlenen: HTTP 200, `score=80`, `capApplied=null`, her iki koruyucuda `euStatus=kisitli`. Hukuki açıklama “MCI + MI karışımı (3:1)” diyor. Girdideki oran ise **1:1**; toplam **0.001%**. Disk motoru aynı sonucu veriyor. Tam yanıt: `details-evidence.json`, `id=mi-mci-invalid-ratio`.

Kontrol örneği: MCI 0.00075% + MI 0.00025% → toplam 0.001%, oran 3:1, skor 80. Motor geçerli ve geçersiz oranları aynı sınıfa koyuyor.

AB 1003/2014, Ek V/39'da izin verilen MCI/MI karışımını **3:1 oranıyla**, durulanan ürünlerde toplam azami **0.0015%** olarak tanımlar. Toplamın sınırın altında olması tek başına yeterli değildir. Kaynak: [EUR-Lex, Regulation (EU) No 1003/2014](https://eur-lex.europa.eu/eli/reg/2014/1003/oj/eng).

Kod noktası: `C:\Projeler\clean-halal-scanner\src\engine\ruleEngine.mjs:1277`. 1277–1280 satırlarında ortak kimliğe eşlenen gözlemler toplanıyor ve MCI varlığı aranıyor; MCI ve MI miktarları ayrı hesaplanıp oran doğrulanmıyor. 1290 sonrası yalnız toplam sınır aşımı denetleniyor; 1300–1302 civarında 3:1 metni koşulsuz ekleniyor.

**Etkisi:** Bilinen konsantrasyonları izin verilen karışım koşulunu sağlamayan bir etiket, kısıtlı/izin verilen kullanım gibi sunulabiliyor. Hukuki not ayrıca gerçekte doğrulanmayan bir oranı ima ediyor.

**Çıkış kapatma ölçütü:** MCI ve MI miktarlarını ayrı biriktir; toplam sınırına ek olarak 3:1 oranını makul sayısal toleransla denetle. Tam ve açık konsantrasyonlarla oran ihlali varsa mevcut ürün politikasındaki uygunsuz kullanım/tavan 10 yolunu uygula. Oran kanıtı eksikse doğrulanmış 3:1 sonucu verme; koşulun doğrulanamadığını belirt. Geçerli oran, geçersiz oran, sınırdaki toplam ve eksik konsantrasyon için hem motor hem canlı API regresyonları ekle.

Bu denetimde düzeltme yapılmadı. Bu P1 giderilmeden GO verilmez.

## 4. Önceki 20 ana senaryonun tekrar sonucu

Bunlar önceki kaydedilmiş etiketlerin tekrarlarıdır; güncel üretici ambalajından bağımsız olarak yeniden toplanmış formüller değildir. “Geçti”, ilgili fikstürün beklenen kritik davranışını ifade eder.

| # | Senaryo | Gözlenen kritik davranış | Sonuç |
|---|---|---|---|
| 1 | Anthelios / Mexoryl | Ana etiket 94; doz ve inhalasyon sınır varyantlarında 10/90 ayrımı | Geçti |
| 2 | Niacinamide + Zinc | 97; niasinamide sahte iritasyon cezası yok; koruyucu bulgusu korunuyor | Geçti |
| 3 | CeraVe | 100; kapsam %100; kolesterol bağımsız; gliserin kaynak belirsizliği korunuyor | Geçti |
| 4 | Nutella | 100; süt/fındık/soya üç majör alerjen | Geçti |
| 5 | Jelatin ve negasyon | Genel jelatin sarı; domuzsuz/pork-free sahte domuz alarmını kaldırıyor | Geçti |
| 6 | Oreo | 100; süt yalnız çapraz temas sarısı; diğer gerçek alerjenler korunuyor | Geçti |
| 7 | TPO | 10; yerel TPO etiketleri 10 dilde %100 kapsam | Geçti |
| 8 | Saç boyası / N,N | Kimyasal lokantı bölünmüyor; ana skor 60; kısıt bulguları var | Geçti |
| 9 | MI/MCI | Leave-on 10; dozlu rinse-off 15 ppm 90, 20 ppm 10, toplam taşması 10 | Verilen varyantlar geçti; 3:1 P1 açık |
| 10 | Borik asit / borax | Bebek kozmetiğinde tavan 10 | Geçti |
| 11 | TPHP | 2026/geçersiz tarih geçiş 90; 2027/strict 10 | Geçti |
| 12 | Hidrokinon | Cilt 10; profesyonel tırnak koşulları ayrı; explicit false 10 | Geçti |
| 13 | Enerji içeceği | Profil uyarıları; genel skor 100 | Geçti |
| 14 | Mirin/Sake | Kırmızı helal; logo varsa conflict; ana eski etiket kapsamı %86 | Geçti |
| 15 | E471 | Doğru mono/digliserit kimliği; bitkisel kaynak önceliği | Geçti |
| 16 | %25 kapsam | Sayısal skor null; sağlık/vegan/helal belirsizliği korunuyor | Geçti |
| 17 | Arapça / Urduca | Yerel etiketler ve TPO tanınıyor; yerel rakam/RTL veri desteği korunuyor | Geçti: API/kaynak düzeyinde |
| 18 | C1 7547O / E12O | Sessiz kesin hüküm yerine OCR teyidi; skor null | Geçti |
| 19 | BHA | E320 / salisilik asit teyidi; skor null | Geçti |
| 20 | Cetearyl vs MI | A 100 / B 10; belirleyici fark MI | Geçti |

Aqua parantez/slaş ile yasaklı madde maskeleme, yağ alkolünün gıdada sahte etanol sayılmaması ve US E171'in AB yasağından ayrılması da eski kabul/sınır testlerinde geçti. On dilde bütün olası girdilerin veya bütün arayüz etkileşimlerinin kusursuzluğu bu sonlu test kümesinden çıkarılamaz.

## 5. Dayanıklılık, mimari ve kapsam sınırları

- Bozuk JSON/null/aşırı büyük gövde reddedildi; takip isteği başarılı oldu. Kabul testindeki 50.000 karakter sınaması geçti. Bu, kapsamlı güvenlik sertifikası veya her regex için ReDoS ispatı değildir.
- Canlı API ile dosya motorunun karşılaştırılan çıktıları eşit. Bu eşitlik doğru kuralın kanıtı değildir; 1:1 oran hatası iki tarafta da aynı şekilde mevcut.
- Veri üretimi kontrolü beş ES modülünün JSON kaynaklarıyla birebir senkron olduğunu doğruladı. Motor ve locale katmanı Node dosya sistemi bağımlılığından ayrılmış.
- Expo/Metro yapılandırması mevcut. Eski ön kontrol betiğinin ortam bağımlılıkları bulunamadı çıktısı, gerçek cihaz derlemesi yerine kullanılamaz. Gerçek cihaz/Metro bundle/Hermes çalıştırması yapılmadı; kullanıcı tarafından bu denetimin dışında belirtilmişti. NO-GO gerekçesi bu değildir.
- Bu turda API ve kaynak denetimi yapıldı; yeni ekran tıklama, pano/OCR kamera, ekran görüntüsü veya mobil mağaza incelemesi yapılmadı. RTL ve yerel rakam sonuçları veri/kaynak düzeyindedir.
- Petrolatum 100 sonucu, üretici rafinasyon belgeleri görülmüş gibi yorumlanamaz. VARSAYIM metni bu sınırı görünür hale getirmiştir.
- `PROJECT_HANDOVER.md` içindeki eski “96+/100 GO” ifadesi bağımsız onay kanıtı değildir. Güncel çıkış durumu bu rapora göre NO-GO'dur; devir belgesindeki durum metni güncellenmelidir.

## 6. Nihai puan kartı ve karar

| Alan | Puan |
|---|---:|
| Test tekrarlanabilirliği, veri senkronu, API–motor eşitliği | 25/25 |
| Konsantrasyon, kullanım bağlamı ve mevzuat koşulları | 22/30 |
| Alerjen/negasyon, OCR, 10 dil ve belirsizlik yönetimi | 25/25 |
| Dayanıklılık, platform ayrımı ve gizlilik beyanı | 20/20 |
| **Toplam** | **92/100** |

Puan, burada çalıştırılan teknik kapsam için mühendislik değerlendirmesidir; klinik güvenlik olasılığı veya resmi mevzuat/helal sertifikası değildir. Gerçek cihaz derlemesi kapsam dışında olduğundan puan kesintisi gerekçesi yapılmadı. Aktif bir P1, toplam puandan bağımsız olarak çıkışı durdurur.

**Çıkış kararı: NO-GO.** Önceki düzeltmelerin istenen örnekleri başarılı. Kalan MCI/MI oran kontrolü uygulanıp canlı API regresyonuyla doğrulanırsa bu somut çıkış engeli kapatılabilir.

Kanıt bütünlüğü: `baseline.json` ve `integrity.json`. Ham komut günlükleri 01–09 dosyaları; tam canlı yanıtlar `results/` ve `details-evidence.json` altında bulunur.
