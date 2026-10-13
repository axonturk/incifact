<USER_REQUEST>
InciFact — Bağımsız yeniden denetim

**13 Ekim 2026 · 68/100 · NO-GO**

Hedef: `C:\Projeler\clean-halal-scanner`; çalışan servis: `http://localhost:3456`. Üretim koduna müdahale edilmedi. Önceki rapordan kullanılan içerik listeleri yeni motor ve yeni canlı API üzerinde tekrar değerlendirildi; eski sonuçlar güncel sonuç olarak sunulmadı.

## 1. Test yöntemi ve kesin kanıt

- `node tests/verify_engine.mjs`: **exit code 0, 39/39 başarılı**. Tam çıktı `existing-tests.txt` dosyasında.
- **77 canlı `/api/evaluate` isteği**, bir `/api/compare`, bir `/api/locales` kontrolü. Tüm değerlendirmeler HTTP 200 döndü. Disk motoru ile canlı API arasında `timestamp` alanları dışında fark bulunmadı; zaman damgaları analiz kararının parçası değildir ve karşılaştırmada açıkça dışarıda tutuldu.
- Canlı HTML içeriği diskteki `public/index.html` ile aynı SHA-256 değerine sahipti.
- Önceki denetimde kendi veritabanının yasak statüsü maskelenen **70 bitkisel kayıt** yeniden denendi: tamamında artık tavan 10 var. Bu test kayıtların gerçek yasal statüsünü sertifikalandırmaz; öncelik düzeltmesinin çalıştığını gösterir.
- Arapça/Urduca dil değişimi ve düşük kapsam ekranı gerçek tarayıcıda test edildi; `ui-evidence.json` ve ekran görüntüleri kaydedildi.
- Denetim öncesi/sonrası izlenen **15 kaynak/veri dosyası değişmedi**: `final-integrity.json`.
- Dosya sistemi izolasyonu localhost soketini başlangıçta engelledi. Aynı sınırlı denetim betikleri ağ erişimiyle çalıştırıldı; üretim dosyaları değiştirilmedi. Test ortamına bağımlılık kurulmadı, servis yeniden başlatılmadı.

Kanıtlar: `evidence.json` (65 ana/ek vektör, compare, locales, 70 bitkisel kontrol); `supplement-evidence.json` (12 sınır kontrolü); `compact.json`; `fixtures.json`; `ui-evidence.json`. Betikler: `re-audit.mjs`, `supplement.mjs`, `verify-semantic.mjs`.

## 2. Yirmi senaryonun yeniden denetim sonucu

“Geçti” ilgili kontrolün geçtiğini belirtir; bütün formül için tıbbi güvenlilik veya resmî sertifikasyon sonucu değildir. “Kısmen” istenen davranışın bir bölümünün düzeldiğini, ancak kalan hata veya önemli sınır bulunduğunu gösterir.

| # | Senaryo | Canlı API / disk sonucu | Karar |
|---|---|---|---|
| 1 | Mexoryl 400, sprey/inhalasyon | `Spray: Aqua, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate` **100**, tavan yok. `applicationType: spray` ve `inhalation` da 100. Madde `modern_eu_uv_filters` grubuna eşleşiyor; yazılan yeni kısıt bu gruba uygulanmıyor. | **Başarısız** |
| 2 | Niasinamid ve koruyucu | Aqua + Niacinamide %10 + Zinc PCA: **100**, hassas cilt uygun, uyarı yok. Tam serum girdisi **97**, hassas cilt uyarısı yalnız Chlorphenesin’den. | **Geçti** — “hiç kimseyi irite etmez” şeklinde evrensel bir tıbbi sonuç çıkarılamaz. |
| 3 | CeraVe / seramid, kolesterol, gliserin | Tam liste **%100 tanınıyor**. Gliserin vegan kartının `uncertainVeganItems` alanında korunuyor. Fakat Petrolatum kesin yasak sayılıp tüm krem **10** alıyor. Kolesterol ayrıca vegan listesinde “Beeswax, Honey & Lanolin” grup kimliğiyle sunuluyor. | **Kısmen** — kimlik/kapsam kontrolü geçti; yeni koşulsuz Petrolatum hükmü sorunlu. |
| 4 | Nutella, üç majör alerjen | Fındık, süt tozu ve soya için **tam üç kırmızı**; `astim_alerji='false'`. Regülasyon skoru 100 olması alerjen riskini ortadan kaldırmıyor; kartlar ayrı. | **Geçti** |
| 5 | Jelatin negasyonu | `Gelatin (pork-free)` ve `(no pork)` **sarı**, domuz alarmı yok. `domuzsuz jelatin` ise **%0 kapsam**, helal bulgusu boş; müşbuh jelatin olarak tanınmıyor. Gerçek domuz + logo hâlâ CONFLICT. | **Kısmen** |
| 6 | Oreo çapraz temas | `May contain milk` için **sarı çapraz temas** var; alerji profili false. Ancak aynı metin ayrıca **kırmızı “ürün süt içerir”** alarmı da oluşturuyor. Buğday için ayrı kırmızı uygun. | **Kısmen** — varlık ile olası çapraz temas ayrımı yapılmamış. |
| 7 | TPO FR/ES/RU | Üçünde de yasak bulgusu ve **tavan 10** bulundu. FR girdisindeki genel `Acrylates` tanınmadığı için kapsam %50 ve sayısal skor null; ES/RU tek maddeli girdiler 10. | **Geçti** — tavan/bulgu korunuyor; FR’de null kapsam kuralının sonucu. |
| 8 | N,N lokantı | `Aqua, N,N-DIETHYLTOLUENE-2,5-DIAMINE HCL, Resorcinol` **üç token**, kimyasal ad bölünmüyor; **10**, %100 kapsam. | **Geçti** |
| 9 | MI leave-on / rinse-off | `applicationType='leave_on'`: **10**; `'rinse_off'`: **90**. Ancak yanlış “Ek II/1330” atfı kalmış; %1 MI içeren rinse-off da 90, konsantrasyon uygulanmıyor. Tanınmayan uygulama enumları reddedilmiyor. | **Kısmen** |
| 10 | Borik asit / boraks bebek kremi | Her ikisinde **10**, tavan 10 ve çocuk uyarısı var. | **Geçti** — kozmetik senaryosu. |
| 11 | TPHP takvimi | `targetDate='2026-10-13'`: **90**, geçiş uyarısı; `'2027-01-01'` veya `strictFutureRules=true`: **10**. Tarih verilmezse gerçek sistem tarihi kullanılmıyor; `asOf` yok sayılıyor, geçersiz `targetDate='invalid'` ise yasak sonucu veriyor. | **Kısmen** |
| 12 | Hydroquinone krem / yapay tırnak | Krem %2: **10**. Metinde “Professional artificial nail system” varsa **90**, Ek III/14 açıklaması var. Aynı tırnak sisteminde **%2** de 90; %0,02 sınırı ve profesyonellik kanıtı uygulanmıyor. | **Kısmen** |
| 13 | Enerji içeceği | Hamilelik için 200 mg bilgili sarı ve çocuk için kırmızı uyarı üretiliyor; iki profil false. Fakat **kafeinsiz Taurine/Inositol** girdisi de “Yüksek Kafein” alarmı veriyor; uyarı kaynakları WHO şeker rehberine bağlı. | **Kısmen** |
| 14 | Mirin/Sake ve helal logo | Logo ile her iki bulgu **CONFLICT**; logosuz kırmızı. | **Geçti** |
| 15 | E471 kimliği | **“Mono- ve Digliseritler (E471)”** olarak gösteriliyor; kaynaksız sarı, `(Bitkisel)` yeşil. | **Geçti** |
| 16 | %25 kapsam | API: skor null; seçili sağlık profilleri ve vegan `kapsam_yetersiz`; profil eşleşme skoru null. Web: **“Tercihlerine uygun”** ve bilinmeyen maddelere **“Sorun yok / izinli standart bileşen”** gösteriliyor. | **Kısmen** — motor düzeldi, sunum düzeltmesi tamamlanmadı. |
| 17 | Arapça/Urduca, RTL/rakamlar | Arapça dört bileşen **%100**. Kabul testindeki Urduca yazım %100; alternatif dört bileşen yazımı %50; **arayüzün kendi hazır Urduca etiketi %56**. Telefon/yan panel RTL, üst gezinme LTR. Skor/yüzdeler yerel; Urduca üst sekmelerde Arapça rakamlar kalıyor. | **Başarısız** — bütünlük iddiası geçmiyor. |
| 18 | C1 7547O / E12O | Skor null; CI 75470/E120 için kullanıcı teyidi var, sessiz hüküm yok. | **Geçti** |
| 19 | BHA | Teyit listesinde E320 ile Salicylic Acid seçenekleri var; skor null. | **Geçti** |
| 20 | Cetearyl Alcohol vs MI | `/api/compare` farkı **B’deki MI** olarak izole ediyor. Varsayılan leave-on kabulü nedeniyle A=100, B=10. Gerçek temizleyici için rinse-off bağlamı açıkça verilmelidir. | **Geçti** — fark çıkarımı. |

**Toplam: 10 geçti / 8 kısmen / 2 başarısız.** Bu sayım senaryo düzeyindedir; tüm sınır kontrollerinin başarı oranı değildir.

### İstenen ek kontroller

- `Aqua (4-METHOXYTOLUENE-2,5-DIAMINE HCL)` → **10 / tavan 10**: giderilmiş.
- `Aqua / 4-METHOXYTOLUENE-2,5-DIAMINE HCL` → **10 / tavan 10**: giderilmiş.
- Gıdada Cetearyl Alcohol → **etanol/haram bulgusu yok**: giderilmiş.
- `jurisdiction='US'`, E171 → **100 / tavan yok**, FDA %1 koşulu açıklamada: ülke ayrımı düzelmiş. Ancak açıkça **%2** E171 de 100; sınır hesaplanmıyor. **Kısmi düzeltme.**
- `productType='FOOD'` artık normalize edilip AB E171 için 10 döndürüyor; `halalCertified='false'` artık sarı jelatini yeşile çevirmiyor. Buna karşılık profil stringi hâlâ karakterlerine bölünüyor.
- `/api/locales` → HTTP 200, **TR/EN/AR/DE/FR/ID/MS/ES/RU/UR**, AR/UR `dir=rtl`. Locale kaydının bulunması etiket sözlüğünün tamlığı değildir.
- **39/39 kabul testi doğrulandı.** Test 39 yalnız seçilmiş negatif/pozitif örnekleri kapsıyor. Örneğin negasyonda Türkçe `domuzsuz jelatin`, Urduca arayüzün ürettiği yazımlar veya FDA %2 sınırı bu testle doğrulanmıyor.

## 3. Çıkışı engelleyen kalan P1/P2 bulguları

### P1 — Mexoryl 400 kısıtı doğru kimliğe ulaşmıyor

`src/data/substances.json:3524` uzun INCI adını `modern_eu_uv_filters` grubuna eşliyor. `src/engine/ruleEngine.mjs:1212` ise yalnız `cosing_89733` veya adında uzun INCI metni bulunan kaydı denetliyor. Grubun adı bu koşula uymuyor. **Kuralın kodda bulunması çalıştığını göstermiyor:** sprey metni ve `applicationType='spray'` kontrolleri 100 verdi.

AB Ek VI/32 maksimum %3, akciğer inhalasyon maruziyeti doğuran uygulamalarda kullanmama ve nitrosasyon koşulları içerir. %10 kontrolü de 100 dönüyor. Bunları yalnız açıklama metnine yazmak mevzuat şartını uygulamak değildir. [2020/1684 resmî metin](https://eur-lex.europa.eu/eli/reg/2020/1684/oj/eng).

### P1 — Genel yasak önceliği koşullu istisnaları siliyor

`ruleEngine.mjs:1031–1032` CosIng `s=2` kaydını mevcut derin profilden üstün tutuyor. Maskelenme sorunu kapanmış; ancak **PETROLATUM** için `cosing_79504` ile koşulsuz yasak oluşmuş. CeraVe örneği bu yüzden 10 aldı.

Ek II/904 rafinasyon geçmişinin bilinmesi ve üretildiği maddenin kanserojen olmadığının gösterilmesi istisnasını içerir. Etiket bu kanıtı sağlamaz; buna rağmen istisnayı metinden silip “doğrudan yasak” demek de doğru değildir. Uygun sonuç gerekli üretici kanıtını isteyen koşullu değerlendirmedir. “Fully refined” kullanıcı metni tek başına belge yerine geçmemelidir. [1223/2009 konsolide Ek II/904](https://eur-lex.europa.eu/eli/reg/2009/1223/2024-04-04/eng).

CosIng zaten bağlayıcı bir izin/yasak karar motoru değildir; resmî Annex koşulları, aktif/tarihsel kayıtlar ve istisnalar birlikte ele alınmalıdır. `makeCosingSubstance`, `ruleEngine.mjs:24–44` ve veri üreticisindeki CAS/koşul/tarih kaybı önceki kapsam sorununu koruyor. [Komisyonun güncel CosIng uyarısı](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en).

### P1 — Alerjen ayrıştırması dar ve çok dilli güvenlik eksik

`ruleEngine.mjs:1373–1381` yalnız dokuz grup içeriyor; Ek II'nin 14 grubunun tamamını kapsamıyor. Kabuklular, yumuşakçalar, kereviz, hardal, acı bakla gibi gruplar eksik. **%80 kapsamlı Lupin ve Shrimp kontrolleri 100 ve alerji uygun** dönüyor.

`\b` sınırları Arapça/Kiril/Urduca sözcüklerle güvenilir biçimde çalışmıyor; kısaltılmış çoğul kökler de tam kelime sınırıyla kaçıyor. Arapça `حليب` içeren %80 kapsamlı kontrol **100, alerji uygun, uyarı yok**. Türkçe süt kontrolü uyarı verirken Arapça karşılığı kaçıyor. `find(...)` yalnız ilk grubu seçtiği için “Soy milk” girdisinde soya yerine sadece süt alarmı var.

Çapraz temas metni ingredient gözleminin içinde kalıyor: `ruleEngine.mjs:1384–1396` kırmızı süt varlığı çıkarırken `1402` tekrar sarı çapraz temas üretiyor. `Milk-free flavouring` de yanlış kırmızı süt alarmı veriyor. İçerik, kaynak, negasyon ve çapraz temas ifadeleri ayrı ayrıştırılmalıdır. [1169/2011 Ek II ve III](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/eng).

### P1 — Kapsam koruması webde yanlış olumlu sonuca çevriliyor

API düzeltmesi gerçek: `ruleEngine.mjs:1455–1459`, `1660`. Fakat `public/index.html:2166–2170` sadece uyarı sayısına bakıyor; `kapsam_yetersiz` statüsünü okumuyor. Uyarı listesi boşsa uygun gösteriyor.

`public/index.html:2068–2072` bilinmeyen gözlemleri varsayılan “ok / Sorun yok / izinli standart bileşen” yapıyor. İncelenen %25 kapsamlı listede üç uydurma madde bu mesajı aldı. Bu hata ekran görüntüsü ve DOM kanıtında mevcut; motorun daha ihtiyatlı JSON'u kullanıcının gördüğü sonucu düzeltmemiş.

![Düşük kapsamda hâlâ olumlu kişisel kart](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/Test Ortamı/incifact-re-audit-2026-10-13/low-coverage-ui.jpg>)

### P1 — Konsantrasyon ve kullanım doğrulaması açıklama seviyesinde kalıyor

- MI rinse-off **%1 → 90**; %0,0015 sınırı hesaplanmıyor. `applicationType` doğrulanmadığı için `rinse-off` gibi desteklenmeyen değerler de yasağı atlayan kola girebiliyor: `ruleEngine.mjs:1182`.
- Profesyonel yapay tırnakta Hydroquinone **%2 → 90**; %0,02 sınırı uygulanmıyor. Metinde yalnız `nail` sözcüğü varsa istisna seçilebiliyor; `Skin whitening nail cream: Aqua, Hydroquinone 2%` 90 verdi: `ruleEngine.mjs:1203`.
- FDA E171 **%2 → 100**. `ruleEngine.mjs:1167–1170` koşulu anlatıyor, kontrol etmiyor. FDA'nın sınırı %1'dir. [FDA](https://www.fda.gov/industry/color-additives/titanium-dioxide-color-additive-foods).
- Gıda E284/havyar bağlamına hâlâ kozmetik borat yasağı taşınıyor. Kozmetik Boric Acid testinin geçmesi gıda kategorisi değerlendirmesini doğrulamaz.

### P1/P2 — TPHP tarihi örtük ve doğrulanmayan string karşılaştırmasına bağlı

`ruleEngine.mjs:1192`: yalnız `strictFutureRules === true` veya verilen `targetDate` stringi kullanılıyor. Tarih verilmezse sistem tarihi devreye girmiyor; bu tasarım 2027'de de varsayılan geçiş uyarısını sürdürebilir. `targetDate='invalid'` lexical karşılaştırma nedeniyle 10 verdi; şema bunu reddetmeli. Desteklenen alan `targetDate`; `asOf` değildir.

Düzenlemenin **1 Ocak 2027 piyasaya arz / 1 Temmuz 2028 piyasada bulundurma** ayrımı da ayrı olay bağlamı gerektirir. `strictFutureRules` gelecekteki kuralları ihtiyat amaçlı erkenden uyguladığını kullanıcıya bildirmeli. [2026/909](https://eur-lex.europa.eu/eli/reg/2026/909/oj/eng).

### P2 — MI mevzuat atfı kullanıcı beklentisinde ve kodda yanlış

Leave-on yasağını uygulayan davranış yararlı; ancak **“Ek II/1330” MI için doğru hukuki atıf değildir**. 2016/1198 Ek V/57'yi değiştirir; 2017/1224 aynı kayıtta rinse-off için %0,0015 sınırını düzenler. `ruleEngine.mjs:1185` ve compare açıklaması yanlış atfı kullanıcıya taşıyor. Bu denetim yanlış hukuki beklentiyi “geçti” diye onaylamaz. [2016/1198](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=uriserv%3AOJ.L_.2016.198.01.0010.01.ENG), [2017/1224](https://eur-lex.europa.eu/eli/reg/2017/1224/oj/eng/pdf).

### P2 — Enerji uyarısının kaynağı ve tehlike eşiği doğru bağlanmamış

`ruleEngine.mjs:1420` kafein, taurin ve inositolü aynı regex ile tetikliyor. Kafein bulunmayan listeye “Yüksek Kafein” deniyor. `1434` ve `1447` kaynak olarak **WHO_SUGAR_2015** kullanıyor; şeker rehberi bu iddiayı desteklemez.

EFSA hamilelik değerlendirmesi bütün kaynaklardan günlük toplam kafein için 200 mg referansıdır; AB 1169/2011 Ek III/4.1 içecek etiketlemesinde **150 mg/L üzeri** ve bazı istisnalar yer alır. Bu iki kavram ayrılmalı, miktar bilinmiyorsa “yüksek kafein” tespiti gibi sunulmamalıdır. [EFSA kafein](https://www.efsa.europa.eu/en/topics/topic/caffeine), [1169/2011](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/eng).

### P2 — Urduca, RTL ve profil beyanı tutarsızlığı

- Testte kullanılan `نیاسینامائڈ` ve `فینوکسی ایتھنول` yazımları tanınıyor. Arayüz ise başka yazımlar üretip kendi hazır listesinde %56'ya düşüyor. Tüm görüntülenen yerelleştirilmiş adlar geri eşleştirme sözlüğünün de parçası olmalıdır.
- Telefon ve yan panel RTL; üst sekme satırı LTR. Urduca skorlar ۱۰۰ türünde, üst sekme numaraları ١ türünde kalmış. `E١٧١` tanınmıyor.
- Motorun gizlilik notu web localhost ayrımını artık açıklıyor; buna karşılık `src/i18n/locales.mjs:131` ve gerçek profil ekranı hâlâ “sunucuya gönderilmez” diyor. `public/index.html:984`, `1000` profilleri API'ye iletiyor. Localhost kontrolü üçüncü kişiye sızıntı kanıtı değildir; çelişkili kullanıcı beyanı kalmıştır.

![Urduca hazır etikette yüzde 56 tanınma](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/Test Ortamı/incifact-re-audit-2026-10-13/ur-ui.jpg>)

### Mobil çıkış için doğrulanmayan alanlar

`ScannerApp.tsx:14` hâlâ Node tabanlı motoru import ediyor; `ruleEngine.mjs:1–18` Node fs/path/url ve senkron dosya okuma içeriyor. Projede `node_modules` bulunmadı; bu re-audit kapsamında native derleme/cihaz/OCR testi yapılmadı. Gerçek Android/iOS çalışabilirlik onayı verilmez.

`ocrService.ts:88` sabit 0,94 güven değeri ve `ScannerApp.tsx:200` kullanıcıya güven yüzdesi sunumu kalıyor. Otuz dokuz motor testinin geçmesi bunları kapatmaz. Tam mobil mağaza, gizlilik politikası ve bağımlılık veri akışı denetimi ayrıca tamamlanmalıdır; bu yeniden denetim onların tümüne GO vermiyor.

## 4. Nihai not ve çıkış kararı

**68/100 — NO-GO. Önceki 56/100'e göre +12 puan.** Aynı ağırlıklı teknik çıkış rubriği kullanıldı; puan klinik güvenlilik veya mevzuat sertifikası değildir.

| Alan | Önceki | Yeni | Azami |
|---|---:|---:|---:|
| Deterministik kurallar, OCR teyidi, compare | 19 | 23 | 25 |
| Toksikoloji ve uygulanabilir mevzuat koşulları | 12 | 15 | 30 |
| Helal bağlamı ve çok dilli bütünlük | 17 | 20 | 25 |
| Mobil, gizlilik, input doğrulama | 8 | 10 | 20 |
| **Toplam** | **56** | **68** | **100** |

Giderilenler: Nutella'nın seçilmiş üç alerjeni; N,N adının parçalanması; TPO FR/ES/RU yasak tanıması; Aqua ile maskelenen yasak; 70 bitkisel kaydın veri önceliği; E471 adı; İngilizce domuz negasyonu; gıda yağ alkolü kalkanı; düşük kapsam API statüleri; büyük harf FOOD ve string false normalizasyonu. MI, hidrokinon, TPHP ve FDA için bağlam dalları da eklenmiş, ancak koşulların tamamını uygulamıyor.

GO için kalan zorunlu işler:

1. Mexoryl kuralını gerçek eşleşen kimliğe bağlayıp uygulama/konsantrasyon koşullarını doğrulayın.
2. CosIng statüsünü koşulsuz yasak/izin kararına dönüştürmeyin; Petrolatum dahil Annex istisnalarını ve kaynak kanıtını koruyun.
3. İçerik–çapraz temas–negasyon ayrımını yapın; 14 alerjen grubu ve on dil için Unicode uyumlu eşleştirme sağlayın.
4. Web kişisel kartı ve bilinmeyen madde satırları API belirsizlik durumlarını doğru göstermeli.
5. Urduca hazır metin %100 eşleşmeli; üst gezinme ve rakamlar hedef dilin düzenini izlemeli.
6. FDA/MI/hidrokinon sınırları, TPHP gerçek tarih/olay bağlamı ve şema doğrulaması çalışmalı; mevzuat kaynakları düzeltilmeli.
7. Native ortak çekirdek, gerçek cihaz OCR ve doğru gizlilik beyanı için somut çıkış kanıtı sunulmalı.

**39/39 sonucu doğrudur; bütün eski P1/P2'lerin giderildiği sonucu doğru değildir.**

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-13T21:08:51+03:00.
</ADDITIONAL_METADATA>