# InciFact cdaf95c — nihai teknik yeniden denetim

**14 Ekim 2026 · 100/100 · GO — denetlenen kural motoru ve yerel API regresyon kapsamı için.**

Önceki 94/100 NO-GO raporundaki MCI/MI oran toleransı P1'i kapandı. 2.8:1 ve 3.2:1 örnekleri artık skor/tavan 10 alıyor; hukuki notta gerçek oran gösteriliyor. Geçerli 3:1 ve miktarsız karışım davranışları korunmuş. Bu turda test edilen kapsamda çıkışı engelleyen açık P1/P2 saptanmadı.

Hedef: `C:\Projeler\clean-halal-scanner`. HEAD: **`cdaf95cdeb489f1de5cb7d9843968c046e0aea81`**. Canlı servis: `http://localhost:3456`. Başlangıç/bitiş commit'i aynı; Git çalışma ağacı temiz. İzlenen 28 üretim/veri/yapılandırma/test dosyasının SHA-256 değerleri değişmedi (`baseline.json`, `integrity.json`). Üretim koduna müdahale edilmedi.

## 1. Çalıştırılan testler

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| `npm test` | Exit 0; veri modülleri senkron; platform kontrolü başarılı; HTML script sözdizimi başarılı; **39/39 kabul + 32/32 regresyon**; çakışma 0 | `01-npm-test.txt` |
| `node tests/audit3_live_parity.mjs` | **15/15**, HTTP 200, disk/API eşitliği ve betikteki beklentiler başarılı | `02-live-parity.txt` |
| Önceki bağımsız `closure.mjs` | **6/6** beklenen skor/tavan/not ve disk/API eşitliği | `03-closure.txt`, `closure-evidence.json` |
| Önceki `stress20.mjs` | **20 ana + 56 varyant + 10 dil = 86** canlı değerlendirme/karşılaştırma; hata veya disk/API farkı 0 | `04-stress20.txt`, `results/stress/evidence.json` |
| Önceki `language-precedence.mjs` | 80 yerel örnekte bilinmeyen 0; 10 dilde TPO %100 kapsam/10 puan; sekiz öncelik kontrolünde beklenen bulgular | `05-language.txt`, `results/stress/language-precedence-evidence.json` |
| Önceki `final-checks.mjs` | 70 yasaklı botanik varyantının tamamı 10; bozuk JSON 400, null 400, 70 KB gövde 413, takip isteği 200/100 | `06-final-checks.txt`, `results/stress/final-check-evidence.json` |
| Önceki `details.mjs` | Altı canlı vakada HTTP 200 ve disk/API eşitliği; kısıt/varsayım/platform/gizlilik çıktıları korundu | `07-details.txt`, `details-evidence.json` |

Eski betikler yeni kanıt klasörüne kopyalanarak çalıştırıldı; test mantığı değiştirilmedi, eski raporların çıktıları üzerine yazılmadı. Önceki `closure.mjs` ve `details.mjs` içindeki sabit eski commit alanları çalışma sürümü kanıtı olarak kullanılmadı. Güncel sürüm `summary.json` ve `integrity.json` ile kaydedildi. Details betiği bu turdaki güncel dil çıktısını okudu.

Bazı eski betikler yalnız çıktı kaydeder. Karar sadece exit 0'a dayanmıyor: kaydedilen beklenen skorlar, notlar, kapsam, alerjen/helal davranışları ve API eşitliği ayrıca incelendi.

## 2. Son P1'in kanıtlı kapanışı

`src/engine/ruleEngine.mjs:1306` artık geniş 2.7–3.3 kabul aralığı yerine `Math.abs(ratio - 3) <= 1e-6` kullanıyor. Açık miktarlı uygunsuz oranlarda `yasak` yolu korunuyor; açıklama gerçek oranı gösteriyor.

| Rinse-off MCI + MI girdisi | Oran | Skor / tavan | Hukuki not | Sonuç |
|---|---|---|---|---|
| 0.0005% + 0.0005% | 1:1 | **10 / 10** | Etiketteki oran 1:1; uygunsuz | Geçti |
| 0.0007% + 0.00025% | 2.8:1 | **10 / 10** | Etiketteki oran 2.8:1; uygunsuz | **Son P1 kapandı** |
| 0.0008% + 0.00025% | 3.2:1 | **10 / 10** | Etiketteki oran 3.2:1; uygunsuz | **Son P1 kapandı** |
| 0.00075% + 0.00025% | 3:1 | **80 / null** | 3:1 olarak doğrulandı | Geçti |
| 0.001125% + 0.000375% | 3:1; toplam 0.0015% | **80 / null** | Oran doğrulandı; toplam sınırda | Geçti |
| Miktarsız MCI + MI | Bilinmiyor | **80 / null**, kısıtlı | Oran ve toplam **DOĞRULANAMADI**; doğrulandı iddiası yok | Geçti |

Altı örneğin tamamında canlı API ve disk motoru aynı sonucu verdi. Yakın iki oran varyantı proje regresyon ve canlı eşitlik paketlerinde de mevcut. Kaynak dayanak, karışımı 3:1 oranında ve durulanan ürünlerde azami 0.0015% olarak tanımlar: [AB 1003/2014, Ek V/39](https://eur-lex.europa.eu/eli/reg/2014/1003/oj/eng).

## 3. Önceki düzeltmeler korunuyor

- Unicode yüzde ve ppm: Mexoryl `٤٪`/`۴٪` → 10; MI Arapça 0.0016% ve 20 ppm → 10; 15 ppm → 90.
- MCI+MI toplam 0.0016% → 10; `leave_on` + Shampoo → 10 ve ÇELİŞKİ.
- Süt/gluten negasyonu yalnız kendi hedefini etkiliyor; soya/hardal/Acı Bakla uyarıları korunuyor. Egg ve Hardal sahte gluten üretmiyor.
- Profesyonel hidrokinon alanı false olduğunda 0.02% tırnak istisnası uygulanmıyor: 10. True olduğunda ilgili kısıtlı yol korunuyor.
- Ethoxydiglycol ve Butoxydiglycol Ek III kısıt bulguları var. Petrolatum 100 çıktısında **VARSAYIM** ve üretici rafinasyon belgesi gereği açıklanıyor.
- Düşük kapsam, OCR kod bozulması ve BHA belirsizliğinde sayısal skor/teyit korumaları sürüyor. Helal logo/domuz/alkol çelişkileri ve compare MI seçimi korunuyor.
- Motor Node fs/path/url bağımlılığı içermiyor; veri modülleri senkron; Metro yapılandırması mevcut. Gizlilik metinleri 10 dilde mobil yerel işleme ile web yerel sunucu ayrımını koruyor.

Önceki f2a6d27 kanıtlarıyla karşılaştırılan 86 girdinin skor, kapsam, tavan, profil durumu, alerjen düzeyi, helal genel durumu, şeker/belirsizlik ve regülasyon sınıflarında davranış regresyonu yok (`summary.json`). Karşılaştırma vakası ayrıca kontrol edildi: A=100, B=10; belirleyici taraf B, madde MI (`compare-regression.json`). İnsan tarafından görülen metin düzenlemeleri bu karşılaştırmadan ayrı değerlendirilmiştir.

80 yerel hazır örnekte **70/80 %100 kapsam**, **10/80 %86 kapsam** var. Kalan on örnek her dildeki aynı SLS/SLES OCR teyidi örneğidir; tanınmayan madde sayısı sıfır. On yerel TPO örneğinin tamamı %100 kapsamla 10 aldı. Bu durum “80/80 %100 kapsam” şeklinde sunulmamalıdır.

20 ana ürünün kaydedilmiş etiketleri kullanıldı; yeni üretici ambalajlarının tümü yeniden toplanmış sayılmaz. Yirmi ana çıktının ayrıntısı `summary.json` ve tam yanıtları `results/stress/evidence.json` içindedir.

## 4. Devir belgesi

`PROJECT_HANDOVER.md` üst durum özeti, son bağımsız 94/100 NO-GO sonucunu ve yeniden denetim bekleyen epsilon düzeltmesini doğru ayırıyor. Eski açıklar tarihsel arşiv olarak işaretlenmiş; önceki P3'teki “hâlâ açık” çelişkisi hedeflenen bölümlerde giderilmiş. 32 regresyon/15 canlı vaka beyanı bu turda doğrulandı.

Bu raporla oluşan yeni GO sonucu henüz devir belgesine yazılmadı; denetçi üretim dosyasını değiştirmedi. Sonraki devir güncellemesi bu raporu ve **GO'nun teknik kapsamını** referans almalıdır.

## 5. Puan kartı ve karar sınırı

| Önceki raporla aynı teknik alanlar | Puan |
|---|---:|
| Test tekrarlanabilirliği, veri senkronu, API eşitliği | 25/25 |
| Konsantrasyon, kullanım bağlamı ve denetlenen mevzuat koşulları | 30/30 |
| Alerjen/negasyon, OCR, dil ve belirsizlik | 25/25 |
| Dayanıklılık, platform ayrımı ve gizlilik beyanı | 20/20 |
| **Toplam** | **100/100** |

**GO:** Önceki raporlardaki test edilmiş çıkış engelleri, son oran toleransı P1'i dahil, bu commit ve canlı servis üzerinde kapandı. Not, aynı teknik puan kartında kalan altı puanlık kesintinin kapanışını ifade eder; tüm olası etiketlerde kusursuzluk olasılığı değildir.

Gerçek iOS/Android cihaz derlemesi, mobil OCR performansı, bu turda tam ekran tıklama testi ve App Store kabulü kapsam dışıdır. Eski native ön kontrolünde MODULE_NOT_FOUND görülmesi bir cihaz derlemesi yerine kullanılmadı; önceki mutabakat doğrultusunda bu turda ret gerekçesi yapılmadı. Bu GO, mobil mağaza yayını onayı veya resmi toksikoloji/helal/mevzuat sertifikası olarak sunulmamalıdır.

Toplu kanıt özeti: `summary.json`. Üretim dosyası/commit bütünlüğü: `integrity.json`. Denetim raporu dışındaki uygulama kodu değiştirilmedi.
