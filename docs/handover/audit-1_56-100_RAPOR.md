# InciFact — Bağımsız kural motoru ve çıkış denetimi

**Denetim tarihi: 13 Ekim 2026 · Nihai not: 56/100 · Çıkış kararı: NO-GO**

Hedef: `C:\Projeler\clean-halal-scanner`, çalışan servis: `http://localhost:3456`. Üretim dosyaları değiştirilmedi. Bu rapor mevcut dosyaların, canlı API yanıtlarının ve gözlenen web arayüzünün teknik değerlendirmesidir; ürün sertifikası veya herhangi bir helal otoritesinin onayı değildir.

Kanıt kapsamı: 20 ana senaryo, 56 sınır/bağlam varyantı, aynı INCI listesinin 10 dilde değerlendirilmesi, 17 ek API varyantı, 8 eşleştirme önceliği deneyi ve 4 API dayanıklılık kontrolü. Ayrıca arayüzün hazır etiketlerinden 80 senaryo–dil kombinasyonu ve veritabanının yasaklı işaretlediği 70 bitkisel kayıt motor üzerinde denendi. Ana 86 değerlendirmede canlı API ile diskteki motorun çıktıları aynıydı. Mevcut kabul testleri **31/31 geçti**; aşağıdaki başarısızlıkları yakalamaları için tasarlanmamış olmaları bu sonucu sınırlar.

İlk dört ürün için üreticinin güncel bölgesel sayfasındaki içerik listesi kullanıldı. The Ordinary örneğine üreticinin ilan ettiği %10 niasinamid miktarı ayrıca eklendi. Haribo, Oreo ve diğer örnekler kullanıcının tuzaklarını sınayan kontrollü girdilerdir; yirmi ürünün her birinin güncel fiziksel ambalajının doğrulandığı iddia edilmez. Özellikle Oreo girdisi güncel resmi formül olarak sunulmaz. Bölge ve formül revizyonu sonuçları değiştirebilir. Kesin girdiler `fixtures.json` ve diğer kanıt JSON'larında bulunur.

Üretici kaynakları: [La Roche-Posay UK](https://www.laroche-posay.co.uk/en_GB/anthelios-uvmune-400-invisible-fluid-spf50-sun-cream-for-sensitive-skin-50ml/LRP_026.html), [The Ordinary](https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html), [CeraVe US](https://www.cerave.com/skincare/moisturizers/moisturizing-cream/), [Nutella UK](https://www.nutella.com/uk/en/products/nutella).

## 1. KURAL MOTORU DENETİM SONUÇLARI

“Başarılı” ilgili tuzağın geçildiği anlamındadır; bütün ürünün güvenli, mevzuata uygun veya sertifikalı olduğu anlamına gelmez. “Kapsam” bileşenlerin motor tarafından eşleştirilme oranıdır, toksikoloji bilgisinin yeterliliği değildir.

| # | Senaryo | Gerçek çıktı ve sınır deneyi | Hüküm |
|---|---|---|---|
| 1 | Anthelios UVMune 400 | 99 puan, %100 kapsam. Mexoryl 400 tanınıyor; ancak kaydı `cosing_89733`, `s=0`, Ek bilgisi boş. %3 ve %10 filtre girdileri ile inhalasyon/spray bağlamı aynı 100 sonucu veriyor. | **Risk** — kimlik tanınıyor, kullanım koşulu doğrulanmıyor. |
| 2 | Niacinamide %10 + Zinc %1 | 97 puan. Hassas cilt uyarısının nedeni Chlorphenesin; %10 niasinamid değil. Sade %1 ve %10 niasinamid kontrolleri aynı 100 ve `hassas_cilt=true`. | **Risk** — konsantrasyon modeli yok. %10 için herkese zorunlu kırmızı uyarı da bilimsel olarak varsayılamaz. |
| 3 | CeraVe nemlendirici krem | 100 puan, %100 kapsam; seramidler ve kolesterol tanınıyor, hassas cilt/akne uyarısı yok. Gliserin kaynak belirsizliği korunuyor; vegan kartı hayvansal bileşen bildiriyor. | **Başarılı** — test edilen formül ve temel içerik tanıma bakımından. |
| 4 | Nutella | 100 puan, %100 kapsam. Süt, fındık ve soya mevcutken `astim_alerji=true`, uyarı listesi boş. Alerji filtresi seçili web denemesinde “Tercihlerine uygun” görülüyor. Şeker ve hayvansal süt bileşeni bulunuyor. | **Başarısız** — alerjen analizi mevcut profilin kapsamını karşılamıyor. |
| 5 | Haribo / jelatin kaynağı | Kaynaksız jelatin sarı; domuz jelatini + helal logo `conflict`; sığır + logo yeşil, logosuz sığır sarı. İç içe parantezli domuz beyanı EN/AR/RU/UR kontrollerinde de çatışma veriyor. | **Başarılı** — temel kaynak/çelişki tuzağı. `pork-free` yanlış kırmızı olabiliyor; aşağıdaki ek bulgu geçerli. |
| 6 | Oreo / şurup ve çapraz temas | 100 puan, %89 kapsam. Şeker ve glikoz-fruktoz şurubu iki serbest şeker kaynağı olarak bulunuyor. `May contain milk` bilinmeyen metin kalıyor; ayrı `allergenStatement` alanı da dikkate alınmıyor. Alerji profili hâlâ uygun. | **Başarısız** — çapraz temas uyarısı işlenmiyor. |
| 7 | TPO jel tırnak cilası | Standart INCI girdisinde 10 puan ve tavan 10 doğru. %25 kapsamda skor `null`, fakat yasak bulgusu ve webde kırmızı mevzuat uyarısı korunuyor. Hazır FR/ES etiketleri 90, RU etiketi 80 alıyor; bu üçünde TPO yasak bulgusu yok. | **Risk** — temel kural doğru, çok dilli güvenlik bütünlüğü başarısız. |
| 8 | Toluene-2,5-Diamine Sulfate + Resorcinol saç boyası | 60 puan, %100 kapsam; üç orta bulgu tavan 60'ı çalıştırıyor. Düşük ve yüksek yüzde kontrolleri aynı 80. Karışım sonrası konsantrasyon ve yaş/kullanım şartı uygulanmıyor; çocuk profili uygun kalıyor. | **Risk** — kısıt metni var, uygulanabilir mevzuat kontrolü yok. |
| 9 | MI/MCI şampuan veya leave-on | Aynı etiket durulanan ve durulanmayan bağlamda aynı 80. Tek MI %0,0015 kontrolleri her iki kullanımda 90. Hassas cilt uyarısı var, leave-on yasağına dönüşmüyor. | **Başarısız** — ürün türüne bağlı koruyucu kuralı eksik. |
| 10 | Boric Acid / Borax bebek kremi | Her iki kozmetik girdi 10 ve tavan 10; çocuk/hamilelik uyarıları var. | **Başarılı** — kozmetik Ek II kontrolü. Gıda E284 için aynı hükmün taşınması ayrıca hatalı. |
| 11 | TPHP oje plastifiyanı | 13.10.2026 tarihinde 10 puan ve mevcut yasak çıktısı. 2027/2028 tarih seçenekleri sonucu değiştirmiyor. Gelecekteki piyasaya arz ve bulundurma tarihleri modellenmiyor. | **Başarısız** — yürürlük/geçiş takvimi hatalı. |
| 12 | Hydroquinone beyazlatıcı krem | %2 krem 10 ve tavan 10; hedef senaryo doğru yakalanıyor. Profesyonel yapay tırnak %0,02 istisnası da yanlışlıkla 10 oluyor. | **Başarılı** — cilt kremi senaryosu; mutlak bütün-kozmetikler yasağı iddiası doğru değil. |
| 13 | Kafein + taurin + inositol enerji içeceği | 100 puan, %100 kapsam; hamilelik ve çocuk profilleri uygun, uyarılar boş. 32 mg/100 ml ve 500 ml dozu eklenince kapsam %75, skor `null`, profiller yine uygun. | **Başarısız** — doz, porsiyon ve hedef grup bilgisi işlenmiyor. |
| 14 | Mirin / Sake içeren sos | Helal logo ile her ikisi `conflict`, logosuz kırmızı. Vegan etanol kontrolü veganla çatışmıyor; bu doğru. | **Başarılı** — alkollü içecek beyanı tuzağı. Mirin tarzı çeşni için alkol oranı ve kaynak bağlamı ayrıca gerekir. |
| 15 | E471 (Bitkisel) ekmek | Bitkisel beyanla yeşil, kaynaksız E471 sarı. Fakat E471 sonucu “Lesitin (Soya)” adıyla gösteriliyor. | **Risk** — helal çözümü doğru, kimyasal kimlik/sunum yanlış. |
| 16 | Aqua + üç bilinmeyen madde | %25 kapsam; regülasyon skoru `null`, helal `kapsam_yetersiz` doğru. Buna rağmen hamilelik profili uygun/100 ve vegan kartı uygun görünüyor. | **Risk** — belirsizlik dört karta tutarlı yayılmıyor. |
| 17 | Arapça dört bileşen | Dört bileşen tanınıyor: 100 puan, %100 kapsam. Telefon ve yan panel RTL; ١٠٠ ve ٪١٠٠ görülüyor. Üst gezinme LTR kalıyor. Urduca eşdeğerinde niasinamid tanınmıyor: %75 kapsam, skor `null`. | **Risk** — istenen Arapça liste geçiyor; tüm dil/RTL bütünlüğü geçmiyor. |
| 18 | C1 7547O / E12O OCR bozulması | Kullanıcı onayı isteniyor, skor `null`; CI 75470 veya E120 teyidinden sonra karmin işleniyor. | **Başarılı** — sessiz otomatik hüküm yok. `E١٧١` ayrıca tanınmıyor. |
| 19 | Tek başına BHA | E320 ile salisilik asit seçenekleri sunuluyor; teyit öncesi skor `null`. Seçime göre 90 / 97. | **Başarılı** — kimyasal anlam belirsizliği doğru kapatılıyor. |
| 20 | Cetearyl Alcohol A vs MI B | A=100, B=90; deterministik fark B'deki MI/MCI grubunu işaret ediyor. | **Başarılı** — LLM çağrısı olmadan doğru fark. Sonuç konsantrasyon veya ürün uygunluğu kanıtı değil. |

Toplam: **8 Başarılı / 7 Risk / 5 Başarısız**. Ham çıktılar: `evidence.json`; okunabilir özet: `compact-main.json`.

### Çıkışı engelleyen kod ve veri bulguları

- **[P1] Zararsız aday eşleştirmesi yasaklı eşleştirmeyi engelliyor.** `ruleEngine.mjs:1021–1039`: aile/alias eşleştirmesi yapılınca CosIng hiç denetlenmiyor. Canlı API'de `4-METHOXYTOLUENE-2,5-DIAMINE HCL` tek başına **10**, `Aqua (4-METHOXYTOLUENE-2,5-DIAMINE HCL)` ve `Aqua / 4-METHOXYTOLUENE-2,5-DIAMINE HCL` ise **100**. İkinci ve üçüncü girdide yalnız Aqua değerlendirilip yasak kaydı kayboluyor. Gerçek ambalajlarda parantez içi eş adlar normaldir; yalnız “en kötü adayı seç” kuralı da yeterli değildir. Eş ad, karışım bileşeni ve kaynak beyanı ayrı ayrıştırılmalıdır. Kanıt: `language-precedence-evidence.json` ve `extra-evidence.json`.
- **[P1] Genel bitkisel kalıp kaynak kayıtlarına üstün geliyor.** `ruleEngine.mjs:344–345`, `1021–1027`. CosIng JSON'unda `s=2` olan ve bitkisel kalıba uyan **70 kayıt** denendi: **69'u 100**, biri 97 aldı; hiçbirinde kendi `s=2` kaydı uygulanmadı. Bu, yetmiş bitkinin gerçekte yasak olduğu iddiası değildir: kaynak statülerinin kendisi ayrıca doğrulanmalıdır. Kesin bulgu, motorun kendi yasak listesini bu yoldan bypass etmesidir. Kanıt: `final-check-evidence.json`, `botanicalMasked` alanı.
- **[P1] Toksikolojik bilgi ile kimlik tanıma aynı kapsam sayacına giriyor.** `makeCosingSubstance`, `ruleEngine.mjs:24–44`: `s=0` kayıtlar “izinli” sayılıyor; oluşturulan kayıtların kişisel profil bilgisi boş. `scripts/build_cosing_json.mjs:43–74` CAS, ayrıntılı kısıt ve tarih bilgilerini son JSON'a taşımıyor. Bu nedenle %100 kapsam, %100 bilimsel değerlendirme demek değil.
- **[P1] Alerjen ve kafein için yanlış olumlu kişisel kart.** `ruleEngine.mjs:1225`, `1230–1233`, `1282–1286` profili başlangıçta uygun kabul ediyor, sadece mevcut profil kurallarıyla bozuyor. Veri yokken “uygun” sonucu oluşuyor. Nutella süt/fındık/soya ve enerji içeceği hamilelik/çocuk deneyleri bunun somut örnekleri. Alerjen türü seçilmeyen genel “astım/alerji” profiliyle kişisel tolerans da doğrulanamaz.
- **[P1] TPO yerelleştirmesi mevzuat sonucunu değiştiriyor.** Aynı hazır jel oje senaryosunun FR/ES/RU çevirileri yasak bulgusunu kaybediyor. DE'de yasak bulunmasına rağmen %60 kapsam nedeniyle skor yok; UR %40. TR/EN/ID/MS 10, AR %80 kapsam ile 10. Bu hata salt metin çevirisi değildir. Kanıt: `language-precedence-evidence.json`, `samples` alanı, `i=5`.
- **[P1] Mevzuat bağlamı eksik.** `evaluateProduct`, `ruleEngine.mjs:889` ve sonraki değerlendirme ürün kategorisi/uygulama biçimi/konsantrasyon/tarih koşullarını çalıştırmıyor. MI leave-on, Mexoryl %10/spray, saç boyası dozları ve profesyonel hidrokinon istisnası farklı sonuç üretmiyor.
- **[P1] TPHP tarihinin metinde bulunması yürürlük kuralı oluşturmuyor.** `substances.json:4860` 1 Ocak 2027'yi yazıyor; motor yine 2026'da doğrudan yasak uyguluyor. Tarih seçenekleri işlenmiyor. Kabul testinin bunu mevcut yasak gibi beklemesi doğru mevzuat doğrulaması değil.
- **[P1] Düşük kapsamda diğer kartlar ve bilinmeyen madde satırı yanlış güven veriyor.** `ruleEngine.mjs:1468` veganı başlangıçta uygun kabul ediyor; kapsam koruması `1420` yalnız helal kartının bir durumunu kapsıyor. %25 kapsamlı örnekte hamilelik/vegan olumlu. Web XSS kontrolünde %0 tanınan bilinmeyen metin bile “Sorun yok / izinli standart bileşen” açıklaması aldı. Bilinmeyen, olumlu güvenlik kanıtı değildir.
- **[P1] Gıda alkol kalkanında regresyon.** `ruleEngine.mjs:1053`: genel `alcohol` sözcüğü eşleştirmesi, `productType=food` altında Cetearyl Alcohol ve Cetyl Alcohol'ü etanol kuralına yükseltiyor. Kozmetikte yağ alkolü kalkanı çalışıyor. Phenoxyethanol tek başına kontrolünde bu özel hata görülmedi. Etanol sınıflandırması ad içindeki bir kelimeye dayandırılmamalı.
- **[P2] Negasyon ve kimlik ayrıştırma hataları.** `Gelatin (pork-free)` veya `(no pork)` yanlış domuz sonucu verebiliyor. `N,N-DIETHYLTOLUENE-2,5-DIAMINE HCL` N,N virgülünden bölünüp tanınmıyor; kendi verisinde yasaklı kaydı var. E471'nin adı `ruleEngine.mjs:748`, `756` önceliği yüzünden lesitin olarak sunuluyor.

### Çok dilli modelin sınırı

- Aynı İngilizce INCI girdisi on dilde aynı 99 puan ve kapsam üretti. Bu, arayüz dilinin deterministik çıktıyı bozmadığını gösterir; her dilin yerel etiket sözlüğünün tam olduğunu göstermez.
- Arapça testte RTL ve Doğu Arap rakamları gözlendi; üst menü LTR kaldı. Urduca karşılıkta tanınma kaybı ve Doğu Arap rakamlı E kodunda eşleştirme kaybı bulundu. Tüm on dilin tüm ekranlarında görsel/erişilebilirlik ve yerel sayı biçimi için eksiksiz kabul verilmedi.
- Mevzuat açıklamalarının bir bölümü yabancı dilde özgül koşullar yerine genel “kısıtlı/izinli” metnine dönüşüyor: `ruleEngine.mjs:1111–1117`. Kaynağın ve uygulanabilir sınırın çevrilmesi de gerekir.

## 2. MEVZUAT VE HELAL RİSK ANALİZİ

### AB kozmetik ve gıda

- **CosIng bir izin belgesi değildir.** Komisyon, CosIng'in bilgilendirici olduğunu ve hukuki değer taşımadığını; bir adın kayıtlı olmasının kozmetik kullanımının onaylandığı anlamına gelmediğini belirtir. Motorun “CosIng kayıtlı → izinli” dönüşümü bu sınırı aşıyor. [Avrupa Komisyonu CosIng açıklaması](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en).
- Dosyada **145 temel kayıt**, **30.594 normalize CosIng anahtarı** var. CSV'de **30.609 satır**, 15 aynı anahtar grubu bulunuyor. Bu fark “15 ayrı kimyasal kayıp” diye yorumlanamaz; normalize çakışmalar ve revizyon tercihleri denetlenmeli. JSON'da 843 `s=2`, 824 `s=1` mevcut. Sayıların doğrulanması bunların tamamının güncel resmî mevzuatla doğrulandığı anlamına gelmez. CSV'nin bazı 2020/2021 tarihli satırları yeni mevzuat notları taşıyor; veri revizyonu, orijinal veri tarihi ve kuralların geçerlilik tarihi ayrılmamış.
- **TPO:** 1 Eylül 2025 yasağı temel INCI girdisinde doğru uygulanıyor. Düşük kapsamda sayıyı gizleyip yasak uyarısını görünür tutmak makul ve mevcut arayüzde gözlendi. Sorun yasak uyarısının FR/ES/RU etiketinde hiç bulunmaması. [2025/877](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A32025R0877), [Komisyon TPO soru–cevapları](https://single-market-economy.ec.europa.eu/sectors/cosmetics/tpo-nail-products-questions-answers_en).
- **TPHP:** 2026/909 ile Ek II'ye ekleniyor; piyasaya arz tarihi **1 Ocak 2027**, piyasada bulundurma tarihi **1 Temmuz 2028**. 13 Ekim 2026 değerlendirmesinde gelecekteki yasağı mevcut yasak gibi sunmak yanlış. Kaydın CMR 1B/üreme toksini iddiası için ayrıca uygun CLP dayanağı gösterilmeli; 2026/909'un TPHP gerekçesi SCCS'nin genotoksisite verisi yetersizliği nedeniyle güvenlilik sonucuna varamamasını içerir. [2026/909, Ek II/1752 ve dipnotu](https://eur-lex.europa.eu/eli/reg/2026/909/oj/eng).
- **Mexoryl 400:** Ek VI koşulu %3 maksimum ve son kullanıcının akciğerinin solunumla maruz kalabileceği uygulamalarda kullanılmaması. Kimliği tanımak bu koşulları doğrulamaz. [2020/1684](https://eur-lex.europa.eu/eli/reg/2020/1684/oj/eng/pdf).
- **MI/MCI:** Ürün durulanma durumu ve ilgili Ek V konsantrasyon/karışım şartları gerekir. MI için durulanan ürünlerde %0,0015 sınırı bulunur; leave-on değerlendirmesi aynı skorla geçemez. Etikette MI ve MCI'nin birlikte yazılması tek başına yasak karışım kanıtı değildir; korunması gereken toplam konsantrasyon ve karışım şartıdır. [2017/1224](https://eur-lex.europa.eu/eli/reg/2017/1224/oj/eng/pdf).
- **Boratlar ve hidrokinon:** Borik asit/boraks kozmetik yasağı doğru. Gıda E284/E285 için kategoriyi ve miktarı görmeden kozmetik hükmü taşınamaz: 1333/2008'de mersin balığı havyarında 4.000 mg/kg, borik asit olarak ifade edilen koşullu kullanım bulunur. Hidrokinon cilt kremi yasağı da profesyonel yapay tırnakta karışım sonrası %0,02 istisnasını ortadan kaldırmaz. [2019/831](https://eur-lex.europa.eu/eli/reg/2019/831/oj/eng), [1333/2008 güncel konsolide metin](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02008R1333-20251104), [1223/2009 Ek III/14](https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=CELEX%3A02009R1223-20260518).
- **Kafein ve alerjen:** Hamilelik için EFSA'nın 200 mg/gün, tüm kaynakların toplamına ilişkin değerlendirmesi; çocuk/ergen için 3 mg/kg/gün referansı doz/porsiyon gerektirir. Salt “taurin” veya “kafein” adı otomatik kırmızı için yeterli değildir; bilgi yoksa “uygun” da denmemeli. Süt, soya ve fındık alerjen bilgisi ile olası çapraz temas ayrı veri alanları olmalıdır. “May contain milk” kasten eklenen süt ile eşitlenmemeli, ayrı bir uyarı üretmelidir. [EFSA kafein](https://www.efsa.europa.eu/en/topics/topic/caffeine), [1169/2011 Ek II](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/eng).
- **Şeker sayacı:** Şeker ve şurup kaynaklarını bulma, maltodekstrini serbest şekerden ayırma çalışıyor. Sayılan şey farklı kaynak sayısıdır; gram şeker, porsiyon başına tüketim veya metabolik risk ölçümü değildir. “2” sonucunu miktar olarak sunmak yanıltır.
- **Skor:** 0/3/10/25 ve 10/40/60 tavanları deterministik yazılım kuralları olarak çalışıyor. Bu katsayıların doğruluğu kabul testleriyle tıbbi olarak ispatlanmış olmaz. Tehlike, maruziyet, izin şartı ve bireysel tolerans ayrılmalı; 100 ürün güvenliliği sertifikası gibi sunulmamalı.

### FDA ve ülke kapsamı

`jurisdiction=US` E171 için yine AB yasağı/tavan 10 döndürüyor. FDA'nın gıdalarda titanyum dioksit için belirli koşullarla ağırlıkça en çok %1 kullanım izni bulunuyor; AB sonucunu ABD sonucuna çevirmek doğru değil. Desteklenmeyen ülke açıkça reddedilmeli veya “yalnız AB kuralları uygulanmıştır” belirtilmeli. [FDA titanyum dioksit](https://www.fda.gov/industry/color-additives/titanium-dioxide-color-additive-foods).

FDA hidrokinonda da reçetesiz onaylanmamış cilt açıcı ürünler ile reçeteli kullanım ayrımını yapar. AB kozmetik değerlendirmesi, FDA ilaç/kozmetik sınıflandırmasının yerine geçmez. [FDA ürün güvenliği açıklaması](https://www.fda.gov/consumers/skin-facts-what-you-need-know-about-skin-lightening-products/skin-product-safety).

### Helal standartları ve hüküm sınırları

- Karmin denemelerinde kod matrisi **GİMDES/IFANCA kırmızı, JAKIM/MUI yeşil** üretiyor. Kod beklentisinin geçmesi tüm otoritelerin güncel ve koşulsuz karmin onayının bağımsız doğrulanması değildir. MUI ve Malezya metinleri koşullarıyla bağlanmalı; IFANCA için güncel özgül birincil dayanak bu denetimde tam doğrulanmadı. [MUI birincil karmin belgesi](https://halalmui.org/wp-content/uploads/2023/11/164.pdf), [Malezya MKI karar derlemesi](https://www.islam.gov.my/images/ePenerbitan/KOMPILASI_MUZAKARAH_MKI_2016.pdf).
- Kullanıcının MS 1500:2009 referansı güncellenmeli: **MS 1500:2019 önceki 2009 standardını iptal edip yerine geçer**. Güncel JAKIM prosedürleriyle birlikte sürüm/tarih izlenmeli. [Standards Malaysia resmî önsözü](https://mysol.jsm.gov.my/getPdfFileForAdmin/eyJpdiI6InRlWU1uTS91Z1RDcVJhWGNtb2VEVnc9PSIsInZhbHVlIjoiM3BGd2xYamJZUVQrM2JZU3lZNVE2dz09IiwibWFjIjoiMGYxMGRhODFjM2EwZTMxNDE4OGM2OGQ1ZjgyZWFmOGNmM2ZiNTlmMmFmNzk3Yjc2OWVkZjY0MGY2YmZmMzFiZSJ9).
- “GİMDES 4.2” tek başına belge adı, revizyon ve tarih tanımlamıyor; sürüm mü madde numarası mı olduğu netleştirilmeli. HAS 23000 uyumu yalnız bileşen adlarından çıkmaz: süreç, tesis, kaynak, kayıt ve izlenebilirlik de değerlendirilir. [LPPOM MUI kriterleri](https://halalmui.org/lets-get-to-know-the-criteria-system-guarantee-halal-lppom-mui/).
- Logo düğmesi bir **sertifika doğrulaması değil kullanıcı beyanı/simülasyonudur**. Sertifika numarası, kurum, ürün/formül kapsamı, üretim tesisi ve geçerlilik kontrol edilmeden “verified” olamaz. E471 veya sığır jelatinini bu düğmeyle yeşile çevirmek denetim delili oluşturmaz. [GİMDES logo ve belge kullanım talimatı](https://www.gimdes.org/logo-marka-ve-belge-kullanim-talimati-2).
- Domuz + helal/vegan beyanında çatışma korunması güçlü. Buna karşılık **etanol + vegan logosu her zaman çelişki değildir**; bitkisel etanol vegan olabilir. Sarhoş edici içecek, fermantasyon kalıntısı, çözücü ve kozmetik kullanım koşulları otoriteye göre ayrı ele alınmalıdır. Mirin tarzı çeşni de geleneksel mirin ile otomatik eşitlenmemeli. [Kikkoman'ın %0,3 alkollü mirin tarzı çeşni örneği](https://www.kikkoman.eu/products/detail/kikkoman-mirin-style-sweet-cooking-seasoning).
- Kolesterol, gliserin, enzim ve emülgatörlerde isim kimlik sağlar; bitkisel/hayvansal kaynak, kesim, üretim yardımcıları ve çapraz bulaşma için tedarik zinciri kanıtı gerekir. Kart sonucu “etiket taramasında tespit edilen durum” olarak sınırlandırılmalı.

## 3. HUKUKİ & MOBİL MAĞAZA GÜVENLİK NOTU

- **[P1] 1.4.1 açısından doğruluk riski:** sağlıkla ilişkili kişisel öneriler daha sıkı inceleme görebilir; yöntem ve doğruluk iddiaları açıklanmalıdır. İncelenen sürümde alerjen/kafein karşısında olumlu kişisel kart, sabit OCR güven yüzdesi ve tanınan her adın bilimsel olarak değerlendirilmiş gibi gösterilmesi bu savunmayı zayıflatıyor. Mevcut doktor/eczacı uyarısı yararlı; yanlış olumlu sonucu gidermez. Bu bulgular otomatik App Store ret kararı değildir. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- **[P1] 5.1.1 ve gerçek veri akışı:** uygulama içinde erişilebilir gizlilik politikası, mağaza bildirimi, veri kullanım/saklama/silme açıklaması ve uygun izin akışı gerekir. İncelenen dosyalarda kapsamlı erişilebilir politika bağlantısı bulunamadı. `ruleEngine.mjs:391` profillerin yalnız cihazda işlendiğini, sunucuya gitmediğini söylüyor; web arayüzü `public/index.html:984` ve `1000` bu profilleri `/api/evaluate` ve compare isteklerine koyuyor. Test ortamında sunucu localhost; bu üçüncü kişiye sızıntı kanıtı değildir. Ancak “hiçbir sunucuya gönderilmez” beyanı mevcut web mimarisiyle çelişiyor. [Apple gizlilik koşulları](https://developer.apple.com/app-store/review/guidelines/).
- **[P1] Mobil ortak motor portatif değil:** `ScannerApp.tsx:14` artık ortak motoru import ediyor; ayrı ve farklı bir mobil motor sorunu bu sürümde yok. Fakat ortak motor `ruleEngine.mjs:1–18` Node `fs/path/url` ve açılışta senkron dosya okumaya dayanıyor. Android/iOS çalışma zamanı için taşınabilir saf çekirdek/veri adaptörü gerekiyor. Bu ortamda Expo, Metro, React Native, TypeScript modülleri kurulu bulunmadı; native build ve gerçek cihaz testi yapılmadı. Statik uyumsuzluk işareti kesin; tamamlanmış başarısız native build iddiası yok.
- **[P2] OCR güven değeri ölçülmüyor:** `ocrService.ts:88` gerçek tanıma yolunda `confidence:0.94` sabit; `ScannerApp.tsx:200` bunu kullanıcıya “%94 güven” diye sunuyor. Gerçek OCR ölçümü değilse yüzde gösterilmemeli. Üretimde sessiz sahte OCR sonucu verme yolu artık dev bayrağına kapatılmış; modül yoksa hata dönüşü mevcut.
- **[P2] On dil mağaza/izin kabulü yok:** kamera/fotoğraf izin metinleri yalnız İngilizce; işletim sistemi izin ekranlarının dil desteği test edilmedi. [Apple purpose strings](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings). Yerel sağlık profilinin depolama, silme, yedekleme ve SDK veri akışı için gerçek cihaz kanıtı gerekiyor; bu denetim bunların tamamını doğrulamadı.
- **[P2] Otorite adı ve logo sunumu:** görsellerin kurumsal onay/sertifikasyon izlenimi yaratıp yaratmadığı ve kullanım yetkileri doğrulanmalı. Teknik simülatör ekranındaki logo, sertifikasyon kanıtı değildir.

### API ve arayüz dayanıklılığı

- Test edilen `<img src=x onerror="document.title='AUDIT20_XSS'">` girdisi düz metin kaldı; olay işleyicili img elemanı **0**, belge başlığı değişmedi. `public/index.html:580` kaçış fonksiyonu mevcut. Bu test edilen yolun geçtiğini gösterir; bütün DOM/sink yollarının kapsamlı penetrasyon testi değildir.
- Bozuk JSON **400**, JSON `null` **400**, 70 KB istek **413**, ardından normal değerlendirme **200**. `server.mjs:12–50` boyut/kök JSON korumaları çalışıyor. `nosniff` ve frame koruması mevcut.
- Alan şeması hâlâ zayıf: `productType='FOOD'` E171'i kozmetik yoluna sokup 100 üretebiliyor; `halalCertified='false'` `Boolean(...)` nedeniyle doğru kabul ediliyor (`ruleEngine.mjs:898`); profil stringi array gibi işlenebiliyor. Enum, tür ve iç içe alan doğrulaması gerekir. Başarılı JSON ayrıştırma geçerli analiz isteği anlamına gelmez.
- Mevcut 31 test içinde uzun metin dayanıklılığı kontrolü geçti. Buradan tüm saldırı girdileri ve eşzamanlı yükler için ReDoS/DoS bağışıklığı çıkarılamaz. Yük dağıtımı/üretim servis kapasitesi bu denetimin kapsamına alınmadı.
- `tests/test_server.mjs` hatayı yakalasa da `process.exit(0)` yapıyor, çoğu sonucu yalnız yazdırıyor ve `productType` yerine `type` kullanıyor. Çalışan 3456 servisiyle çakışmamak için bu yardımcı ayrıca başlatılmadı; API kontrolleri bağımsız denetim betiğiyle yapıldı. Kabul testleri gerçek başarısızlıkta nonzero dönmeli ve mevzuatın güncel bağımsız beklentisini sınamalı.

## 4. NİHAİ BAŞ DENETÇİ PUANI

**56/100 — NO-GO.** Puan, bu kanıt kapsamına ait teknik çıkış değerlendirmesidir; klinik doğrulama, helal belgesi veya resmî mevzuat sertifikası değildir.

| Değerlendirme alanı | Verilen / Azami |
|---|---:|
| Deterministik temel kurallar, OCR teyidi, karşılaştırma | 19 / 25 |
| Toksikoloji, doz/kategori/tarih ve mevzuat doğruluğu | 12 / 30 |
| Helal bağlamı ve çok dilli veri bütünlüğü | 17 / 25 |
| Mobil çalışabilirlik, gizlilik, input dayanıklılığı | 8 / 20 |
| **Toplam** | **56 / 100** |

Çıkış için somut kabul koşulları:

1. Yasak/kısıt kontrolünü genel alias ve bitkisel aile eşleştirmesiyle atlanamaz yapın; parantez, slash ve N,N adlarında regresyonları kapatın. Kaynak veri statülerini güncel Annex/CAS koşullarıyla doğrulayın.
2. Konsantrasyon, maruziyet biçimi, ürün alt türü, yaş, ülke ve geçerlilik tarihlerini kural girdisi yapın. MI leave-on, Mexoryl sınırı, TPHP geçişi ve hidrokinon/E284 istisnaları farklı doğru sonuç üretmeli.
3. Süt/fındık/soya ve çapraz temas uyarılarını ayrı işleyin. Kafein dozu belirsiz veya profil bilgisi eksikse kişisel kart “uygun” vermemeli; düşük kapsam belirsizliği dört karta yayılmalı.
4. On dilde aynı tehlikeyi aynı şekilde tanıyın; yerel rakamlar ve RTL üst gezinme dahil doğrulansın. TPO FR/ES/RU testleri kırmızı bulguyu korumalı; E471 adı doğru olmalı.
5. Helal logo simülasyonu ile doğrulanmış sertifikayı ayırın; otorite kararlarının belge/revizyon/koşul izini tutun. Alkol negasyonu ve yağ alkolü gıda regresyonu kapatılsın.
6. Native uyumlu ortak çekirdek oluşturup Android/iOS derleme, gerçek OCR ve çevrimdışı veri akışını doğrulayın. Sabit güven yüzdesini kaldırın; gizlilik beyanı ile gerçek API davranışını eşitleyin.
7. API şemasını sıkılaştırın ve kabul testlerinin yanlış beklentilerini düzeltin. Yeni bağımsız regresyonlar geçmeden sadece mevcut 31/31 sonucuyla çıkış vermeyin.

Kanıt paketi: `fixtures.json`, `evidence.json`, `extra-evidence.json`, `language-precedence-evidence.json`, `final-check-evidence.json`, `ui-evidence.json`, `existing-tests.txt`, test betikleri ve `final-integrity.json`.

Webde gözlenen yanlış olumlu kişisel kart:

![Alerji filtresi açıkken fındık kreması için olumlu kişisel kart](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/DERS LABLARI/incifact-20-audit-2026-10-13/nutella-allergy.jpg>)

Arapça test ekranı:

![Arapça içerik ve rakamlar](<C:/Users/fakma/OneDrive/Belgeler/ChatGPT/DERS LABLARI/incifact-20-audit-2026-10-13/arabic-ui.jpg>)
