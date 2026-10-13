# InciFact — Nihai teknik çıkış denetimi

**Tarih: 13 Ekim 2026 · Teknik not: 80/100 · Karar: NO-GO**

Hedef `C:\Projeler\clean-halal-scanner`, canlı servis `http://localhost:3456`. Önceki 68/100 raporuna göre önemli düzeltmeler doğrulandı. Buna rağmen konsantrasyon, alerjen negasyonu ve kullanım bağlamında yeniden üretilebilen P1 açıkları bulundu. Bu yüzden tüm P1/P2 bulgularının giderildiği beyanı doğrulanamadı.

## 1. İstenen komutlar ve kanıt kapsamı

Dört komut kullanıcının verdiği sırayla, özgün dosya yollarından çalıştırıldı:

| Sıra | Komut | Sonuç / kanıt |
|---|---|---|
| 1 | `node tests/verify_engine.mjs` | **39/39, exit code 0** — `01-acceptance.txt` |
| 2 | `node ...\incifact-20-audit-2026-10-13\stress20.mjs` | **20 ana senaryo + 56 varyant + 10 dil**, exit code 0 — `02-stress20.txt` |
| 3 | `node ...\incifact-20-audit-2026-10-13\language-precedence.mjs` | **80 yerelleştirilmiş motor örneği + 8 canlı öncelik kontrolü**, exit code 0 — `03-language-precedence.txt` |
| 4 | `node ...\incifact-20-audit-2026-10-13\final-checks.mjs` | **70 bitkisel öncelik kontrolü + 4 API dayanıklılık deneyi**, exit code 0 — `04-final-checks.txt` |

Komut 2'deki 86 canlı değerlendirme/karşılaştırma sonucunun tamamı disk motoruyla tutarlıydı. Ek olarak yedi kritik nokta için **64 canlı vektör**, ardından üç açığı doğrulayan üç canlı vektör çalıştırıldı. İlk 64'ün tamamında HTTP 200 ve `timestamp` dışında disk/API eşitliği doğrulandı. Üç son vektör canlı API'de çalıştırıldı; bunlar için ayrıca disk eşitliği iddia edilmez.

Eski kanıt dosyaları `prior-artifacts` altında yedeklendi. Yeni komut çıktıları `requested-results` altında saklandı; önceki raporların kanıt dosyaları korunmak üzere özgün içeriklerine geri alındı. Denetim betikleri veya üretim kodu değiştirilmedi. Yeni ek denetim betikleri yalnız bu rapor klasörüne yazıldı. İlk dört ürünün eski üretici-listesi fixture'ları tekrar kullanıldı; tüm ambalajların güncel fiziksel baskıları yeniden doğrulanmış sayılmaz.

`final-integrity.json` denetim boyunca izlenen 15 üretim/veri dosyasının SHA-256 karşılaştırmasını içerir. Çalışan HTML diskteki sürümle aynıydı. Tarayıcı kanıtı `ui-evidence.json`, `urdu-ready.jpg`, `low-coverage.jpg` dosyalarındadır.

Kullanıcının tekrar gönderdiği talep sonrasında kaynak hash'leri yeniden kontrol edildi: 15 dosyada değişiklik yok. Soya/hardal negasyonu ve MI/MCI toplamı için üç canlı istek tekrarlandı; aynı hatalı 100/100/80 sonuçları devam etti. Son kontrol çıktısı `07-post-message-confirmation.txt` dosyasındadır.

**Önemli:** stres ve öncelik betiklerinin exit code 0 vermesi bütün sonuçların doğru olduğu anlamına gelmez. Bu betikler büyük ölçüde çıktı kaydeder. Hukuki/teknik hüküm, kayıtlı sonuçların beklenen davranışla ayrıca karşılaştırılmasına dayanır.

## 2. Yirmi ana senaryonun güncel sonuçları

Aşağıdaki tablo ana girdilerin çıktısını gösterir. “Geçti” ilgili girdinin hedefini karşılar; varyantlarda açık varsa ayrıca belirtilmiştir.

| # | Senaryo | Canlı sonuç | Değerlendirme |
|---|---|---|---|
| 1 | Anthelios UVMune 400 | Tam liste **89**, %100 kapsam. İzole Mexoryl losyon %3/altı **90**; ASCII yüzdeyle üst sınır ve sprey **10**. | **Kısmen:** Doğu rakamlı yüzde ve yüzde işareti sınırı atlıyor. |
| 2 | Niacinamide %10 + Zinc %1 | Tam serum **97**; Chlorphenesin hassasiyet uyarısı. İzole niasinamid %1/%10 **100**, uyarı yok. | **Geçti**; evrensel kişisel tolerans kanıtı değildir. |
| 3 | CeraVe krem | **100**, %100 kapsam. Gliserin belirsizliği korunuyor; kolesterol bağımsız “Kolesterol (Hayvansal Lipid)” adıyla. | **Geçti:** rafine mineral yağ varsayımıyla; tedarikçi rafinasyon belgesi denetlenmedi. |
| 4 | Nutella | **100**, %100 kapsam; fındık/süt/soya için üç kırmızı, alerji profili false. | **Ana girdi geçti; genel alerjen modeli kısmen:** Acı Bakla ve bileşene özgü negasyon açıkları var. |
| 5 | Haribo / jelatin | Genel jelatin sarı; pork-free ve domuzsuz jelatin sarı; gerçek domuz + logo CONFLICT. | **Geçti** |
| 6 | Oreo | **100**, %90 kapsam; şeker/şurup bulunuyor. Süt yalnız sarı çapraz temas; buğday ve soya için ayrı kırmızı. | **Geçti:** sahte kırmızı süt alarmı kaldırılmış. |
| 7 | TPO jel oje | **10**, tavan 10, %100 kapsam; FR/ES/RU ve UR adları bulunuyor. | **Geçti:** Almanca hazır listede solvent tanınma kaybı ayrıca sürüyor. |
| 8 | Saç boyası | **60**, %100 kapsam; yetişkin/çocuk hassasiyet uyarıları var. N,N adları tek parça. Yüksek yüzde varyantı 10. | **Hedef kontroller geçti**; tüm Ek III koşullarının doğruluğu bu örnekle kanıtlanmaz. |
| 9 | MI/MCI şampuan | İki koruyuculu ana liste **80**, %100 kapsam; izole MI %0,0015 rinse-off **90**, üst sınır **10**, leave-on **10**. | **Kısmen:** toplam karışım, ppm, Unicode yüzde ve çelişen bağlam açıkları var. |
| 10 | Borik asit/boraks bebek kremi | **10**, tavan 10; çocuk/hamilelik uyarıları. | **Geçti:** kozmetik senaryosu. |
| 11 | TPHP | 2026 ana girdi **90** ve geçiş uyarısı. 2027/2028 veya strict mod **10**. Geçersiz genel string 2026 sistem tarihine dönüyor. | **İstenen kontrol geçti**; piyasaya arz/bulundurma olay ayrımı ayrıca modellenmeli. |
| 12 | Hydroquinone krem | Krem **10**. Tırnak %0,02 **90**, %0,021 **10**. | **Kısmen:** `professionalUse=false` ev tipi tırnakta da 90; profesyonel kullanım koşulu uygulanmıyor. |
| 13 | Enerji içeceği | **100**, kişisel hamilelik/çocuk uyarıları var. Kafeinsiz taurin örneğinde artık “yüksek kafein” yazmıyor. | **Temel düzeltme geçti:** doz/eşik ve özgül bilimsel bağlam tam doğrulanmış değil. |
| 14 | Mirin/Sake sos | Ana liste **100**, %86 kapsam; logo ile CONFLICT, logosuz kırmızı. | **Geçti** |
| 15 | E471 bitkisel ekmek | **100**, %100 kapsam; doğru mono/digliserit adı, bitkisel yeşil, kaynaksız sarı. | **Geçti** |
| 16 | %25 kapsam | Skor null; profil/vegan belirsizlikleri korunuyor. Web kişisel kartı “Kapsam Yetersiz”; bilinmeyen satırları gri “Bilinmeyen / Doğrulanmadı”. | **Geçti:** önceki arayüz P1'i giderilmiş. |
| 17 | Arapça/Urduca | Arapça dört bileşen **100**, %100 kapsam. Urduca hazır nemlendirici **100**, TPO **10**, ikisinde %100 kapsam ve gerçek RTL/Urdu rakamları. | **AR/UR hedefleri geçti; on dilin genel etiket bütünlüğü kısmen.** |
| 18 | C1 7547O / E12O | Skor null, kullanıcı teyidi korunuyor; teyitten sonra karmin değerlendirmesi. | **Geçti** |
| 19 | BHA | Skor null; E320/salisilik asit seçimi korunuyor. | **Geçti** |
| 20 | Karşılaştırma | Fark B’deki MI olarak deterministik izole ediliyor. Varsayılan leave-on bağlamında A=100, B=10. | **Geçti:** gerçek temizleyicinin uygulama bağlamı açıkça verilmelidir. |

Ana girdi sonuçları ve 56 varyant: `requested-results/evidence.json`. Nihai hüküm bu ana tabloya ek olarak aşağıdaki sınır kontrollerini kapsar; “20/20 kusursuz” iddiası verilmez.

## 3. İstenen yedi kritik noktanın doğrulaması

| Kritik nokta | Başarılı canlı kontroller | Kalan sınır | Sonuç |
|---|---|---|---|
| Mexoryl 400 | Sprey/inhalasyon 10; losyon %0,3 ve %3 90; %3,0001 10 | `٤٪` ve `۴٪` ile %4 **90** | **Kısmen** |
| CeraVe / kolesterol | Tam liste 100; bağımsız kolesterol adı; gliserin belirsiz | Rafinasyon belgesinin gerçekliği kapsam dışında | **İstenen çıktı geçti** |
| Alerjenler / negasyon / Oreo | 14 grubun seçilmiş İngilizce adı için kırmızı; Arapça/Urduca süt bulunuyor; Nutella üç kırmızı; Oreo süt sarı; pork-free/domuzsuz sarı | Acı Bakla kaçıyor; milk-free soya alarmını da silebiliyor; yanlış gluten alarmları var | **Kısmen** |
| MI/MCI | ASCII %0,0015 90; %0,0016 10; leave-on 10; Ek V/57 atfı düzelmiş | ppm/Unicode, toplam karışım ve açık leave-on bağlamı atlanabiliyor | **Kısmen** |
| TPHP | Varsayılan 2026 ve `invalid` 90; 2027+, strict 10 | Olay türü ve tam takvim geçerliliği tümüyle denetlenmedi | **İstenen kontrol geçti** |
| Kapsam/bilinmeyen | API null; kişisel/helal kartlar belirsiz; gri rozetler | Test edilen arayüz yolunda eski yanlış olumlu mesaj yok | **Geçti** |
| Urduca/Doğu kodları/RTL | Hazır UR ve TPO %100; ۱–۵; üst/telefon/yan panel RTL; E١٧١ ve E۱۷۱ 10 | Diğer yerelleştirilmiş hazır ürünlerde kapsam kayıpları sürüyor | **UR hedefleri geçti; genel bütünlük kısmen** |

İzole sınır testlerinde 90 olması tüm Anthelios formülünün 90 olması gerektiği anlamına gelmez: diğer bileşenler de ana puana katkı yapar. Aynı şekilde Nutella'nın regülasyon indeksinin 100 olması alerjen kartındaki kırmızıları geçersiz kılmaz.

## 4. NO-GO nedeni olan yeniden üretilebilir P1'ler

### P1 — Konsantrasyon normalizasyonu eksik

`src/engine/ruleEngine.mjs:69–75`, `parseConcentration` yalnız ASCII rakamlar ve `%` işareti arıyor. E kodunda çalışan rakam normalizasyonu konsantrasyon alanına uygulanmıyor.

Canlı kanıtlar (`critical-evidence.json`):

- `Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate ٤٪` + lotion → **90, tavan yok**, %100 kapsam. Urduca `۴٪` da aynı. ASCII `%4` için yasak kolu çalışırken yerel gösterim sınırı atlıyor.
- `Aqua, Methylisothiazolinone ٠٫٠٠١٦٪` + rinse-off → **90**, tavan yok; ASCII %0,0016 → **10**.
- `Aqua, Methylisothiazolinone (20 ppm)` + rinse-off → **90**. 20 ppm = %0,002; 15 ppm sınırı aşılmıştır.

Eksik bilgiye ihtiyatlı uyarı verilebilir; etikette açıkça yazılmış sınır aşımını “kısıtlı/izinli sınırda” gibi değerlendirmek doğru değildir. [Mexoryl Ek VI/32](https://eur-lex.europa.eu/eli/reg/2020/1684/oj/eng/pdf), [MI Ek V/57](https://eur-lex.europa.eu/eli/reg/2017/1224/oj/eng/pdf).

### P1 — MI/MCI karışımının toplamı uygulanmıyor

`ruleEngine.mjs:1262–1276` her gözlemin konsantrasyonuna ayrı bakıyor; karışım konsantrasyonu/3:1 oranını birlikte değerlendirmiyor.

`Aqua, Methylchloroisothiazolinone 0.0012%, Methylisothiazolinone 0.0004%`, rinse-off → **80, tavan yok, %100 kapsam**. Bu 3:1 karışım toplam **%0,0016**; Ek V/39 toplam %0,0015 sınırını aşar. İzole MI'nin doğru 90/10 üretmesi karışım kuralını doğrulamıyor. Kanıt: `confirmed-gaps.json`, `mi-mci-total-over`. [1003/2014, Ek V/39](https://eur-lex.europa.eu/eli/reg/2014/1003/oj/eng).

### P1 — Açık uygulama alanını serbest etiket sözcüğü geçersiz kılıyor

`ruleEngine.mjs:1263` `isRinseOff` kararında yapılandırılmış alan ile etiket regexini OR yapıyor.

`applicationType='leave_on'`, `rawText='Shampoo: Aqua, Methylisothiazolinone'` → **90**. Açık leave-on beyanı ile çelişen sözcük saptandığında teyit/çelişki istenmeli veya ihtiyatlı değerlendirme yapılmalı; kısıt sessizce kaldırılmamalı. Kanıt: `critical-evidence.json`, `mi-conflicting-context`.

### P1 — Negasyonun hedefi bütün alerjenlere yayılıyor

`ruleEngine.mjs:1543–1545` her alerjen için aynı genel negasyon ifadesini kullanıyor. “Süt içermez” soya içermez anlamına gelmez.

- `Water, Sugar, Salt, Citric Acid, Milk-free Soy Lecithin` → **100, %80 kapsam, alerji uygun, uyarı yok**.
- `Water, Sugar, Salt, Citric Acid, Gluten-free Mustard` → **100, %80 kapsam, alerji uygun, uyarı yok**.

İlkinde soya, ikincisinde hardal hedeflenmeliydi. Kanıt: `confirmed-gaps.json`. [1169/2011 Ek II](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/eng).

### P1 — Türkçe Acı Bakla eş adı eksik

`ruleEngine.mjs:1531` yalnız bitişik `acıbakla` yazımını içeriyor.

`Su, Şeker, Tuz, Sitrik Asit, Acı Bakla` → **100, %80 kapsam, alerji uygun, uyarı yok**. İngilizce Lupin kontrolü kırmızı; Türkçe karşılığın kaçması “14 alerjen Unicode uyumlu eksiksiz” iddiasını bozar. Kanıt: `critical-evidence.json`, `allergen-tr-lupin`.

## 5. Kalan P2 ve doğrulanmamış çıkış alanları

- **Alerjen kimliği yanlış olumlu sonuçlar üretiyor.** Örneğin Egg girdisi hem yumurta hem gluten alarmı, Hardal hem hardal hem gluten alarmı oluşturuyor. Genel veri grubunun yerelleştirilmiş “Buğday Unu” adı alerjen taramasına tekrar sokuluyor (`ruleEngine.mjs:1539`). Gruplar gerçek bileşenin kimliğini değiştirmemeli. Seçilmiş 14 İngilizce grubun hedef uyarısı bulunmuş olsa da uyarı setlerinin tümü doğru değildir.
- **On dilin tüm yerel etiketleri eşdeğer değil.** Sekiz hazır ürün × on dil = 80 örneğin **49'u %100**, **70'i ≥%80**, **10'u <%80** tanındı. Almanca TPO %60; İspanyolca salyangoz örneği %33; ID/MS aynı örnek %44. TPO yasak bulgusu Almancada da korunuyor ve skor null olduğundan bu örnekte yanlış güvenlilik puanı yok; fakat tam dil bütünlüğü sağlanmış değil.
- **Hydroquinone profesyonellik şartı kullanılmıyor.** API'de `professionalUse=false` ile ev tipi yapay tırnak %0,02 de 90 alıyor; parametre tanımlı ancak istisna bu koşula bağlanmamış (`ruleEngine.mjs:1292–1298`). Profesyonel kullanım şartının uygulanması ayrıca gerekir.
- **Rafine Petrolatum istisnası artık korunuyor; kanıt varsayımı açık olmalı.** `ruleEngine.mjs:1101` rafine mineral yağ grubunu CosIng s=2 önceliğinden istisna ediyor. Bu CeraVe fixture'ını doğru beklenen 100'e getirir; tek başına üreticinin rafinasyon sertifikasının doğrulanması değildir.
- **Gizlilik beyanı hâlâ tutarsız.** Gerçek profil ekranı ve `src/i18n/locales.mjs:131` “sunucuya gönderilmez” diyor; web profilleri localhost API'ye gönderiyor. Motorun localhost açıklaması düzelmiş. Bu üçüncü kişiye sızıntı kanıtı değildir; kullanıcı beyanı ile veri akışı ayrımı doğru yazılmalı.
- **Mobil çalışabilirlik kanıtı yok.** `ScannerApp.tsx:14` Node fs/path/url kullanan motoru import ediyor; motor açılışta JSON dosyalarını fs ile okuyor. `final-checks.mjs` Expo/Metro/React Native/TypeScript için MODULE_NOT_FOUND verdi. Native build/gerçek cihaz testi yapılmadı; bu rapor gerçekleşmiş bir build hatası iddia etmez, mobil çıkışa çalışabilirlik onayı vermez.
- **OCR güven yüzdesindeki eski sabit 0,94 kaldırılmış.** Kod artık mümkünse ölçülen confidence kullanıyor. Bu olumlu düzeltme statik olarak görüldü; gerçek mobil OCR performansı ölçülmedi.
- **CosIng kısıt önceliği hâlâ seçici.** Ethoxydiglycol/Butoxydiglycol öncelik kontrolleri 100 ve boş regülasyon bulgusu veriyor. Veri kaynağındaki s=1 koşulları genel derin profil altında kalabiliyor. CAS/aktif kayıt/Annex koşulu tamlığı ayrıca doğrulanmalı; 70 bitkisel kaydın artık 10 alması verinin tamamının hukuken doğrulandığı anlamına gelmez.

### Dil sonuçlarının sayısal özeti

| Dil | %100 kapsamlı örnek / 8 | En düşük kapsam | <%80 örnek |
|---|---:|---:|---:|
| TR | 7 | %86 | 0 |
| EN | 7 | %86 | 0 |
| AR | 5 | %67 | 1 |
| DE | 3 | %60 | 2 |
| FR | 3 | %67 | 1 |
| ID | 3 | %44 | 2 |
| MS | 3 | %44 | 2 |
| ES | 5 | %33 | 1 |
| RU | 6 | %78 | 1 |
| UR | 7 | %86 | 0 |

Aynı İngilizce INCI'nin on arayüz dilinde eşit sonuç vermesi ayrı kontroldür; burada değerlendirilenler gerçek yerelleştirilmiş hazır metinlerdir. Düşük kapsam her zaman hata değildir, fakat hazır eşdeğer çevirilerde bileşen tanınmasının kaybolması sözlük boşluğudur.

## 6. API dayanıklılığı ve düzelmiş arayüz kanıtı

- Bozuk JSON → **400**.
- JSON null → **400**.
- 70 KB istek → **413**.
- Sonraki normal değerlendirme → **200 / 100 puan**; servis ayakta.
- Kaynak veride yasaklı işaretlenmiş 70 bitkisel kayıt → tamamı **10**; önceki maskelenme yok.
- Urduca üst sekmeler **۱,۲,۳,۴,۵**, üst gezinme/telefon/yan panel **RTL**. Sekme x koordinatları sağdan sola azalıyor; bu yalnız API `dir` alanına bakılarak verilmiş bir hüküm değildir.
- Hazır Urduca nemlendirici ve TPO'da **%100**; E١٧١ ve E۱۷۱ gıdada **10**.
- %25 kapsamda kişisel ve helal kartları belirsiz, üç bilinmeyen satır gri rozetli. Kullanıcıya eski “Sorun yok / izinli standart bileşen” mesajı gösterilmedi.

![Düzelmiş belirsizlik ve bilinmeyen rozetleri](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/Test Ortamı/incifact-final-audit-2026-10-13/low-coverage.jpg>)

![Düzelmiş Urduca rakamlar ve RTL](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/Test Ortamı/incifact-final-audit-2026-10-13/urdu-ready.jpg>)

## 7. Güncel puan kartı ve karar

| Alan | Önceki | Güncel | Azami |
|---|---:|---:|---:|
| Deterministik kurallar, OCR teyidi, compare | 23 | 24 | 25 |
| Toksikoloji ve uygulanabilir mevzuat koşulları | 15 | 22 | 30 |
| Helal bağlamı ve çok dilli bütünlük | 20 | 22 | 25 |
| Mobil, gizlilik, input doğrulama | 10 | 12 | 20 |
| **Toplam** | **68** | **80** | **100** |

**NO-GO.** Bu teknik çıkış notudur; resmî helal sertifikası, klinik güvenlilik veya mevzuat sertifikası değildir. Karar yalnız düşük bir puandan kaynaklanmıyor: gerçek sınır aşımını ve alerjeni kaçıran aktif P1 bulguları var.

GO için zorunlu kapanışlar:

1. Konsantrasyon alanında Doğu rakamları, yüzde/ondalık işaretleri ve ppm dönüşümünü tek normalize edilmiş miktar modelinde uygulayın.
2. MI/MCI toplam ve oran koşulunu uygulayın; açık kullanım bağlamı ile etiket sözcüğü çelişirse teyit/çelişki üretin.
3. Negasyonu yalnız ilgili alerjene bağlayın; Acı Bakla dahil eş adları tamamlayın; yerelleştirilmiş grup adından sahte alerjen üretmeyin.
4. Kalan yerel hazır etiket sözlüğü boşluklarını kapatın ve mobil çalışabilirlik/gizlilik kanıtını tamamlayın.

Yeni regresyonlar yeşil olmadan, dört komutun exit code 0 olması veya 39/39 sonucu üzerinden GO verilmemeli.
