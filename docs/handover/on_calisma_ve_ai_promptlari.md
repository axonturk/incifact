# Ön Çalışma Raporu: Bilimsel Veri Mimarisi, Resmi Kaynaklar ve Çapraz AI Doğrulama Protokolü

> [!IMPORTANT]
> **Temel Prensip ("Sıfır Halüsinasyon" Kuralı):**
> Sağlık, kozmetik, gıda ve helal kontrolü yapan bir uygulamada **yapay zekanın kendi kafasından "bence bu zararlıdır" diye yorum yapması KESİNLİKLE YASAKTIR.**
> Ayrıca Apple, **App Store Review Guideline 1.4.1 (Physical Harm)** maddesi gereği sağlık/içerik skoru gösteren uygulamaların ekranında **resmi bilimsel kaynakların (EFSA, FDA, EU CosIng vb.) açıkça referans gösterilmesini** zorunlu tutar. Aksi halde uygulama mağazadan reddedilir.

---

## 1. Ön Çalışma: Uygulamanın "Gerçeklik Kaynağı" (Ground Truth) Mimarisi

Uydurma bilgiyi (halüsinasyonu) %100 engellemek için sistemimizde yapay zeka **"Karar Verici"** değil, sadece **"Okuyucu ve Eşleştirici"** rolünde olacaktır. Kararları ise uluslararası resmi kurumlardan çekilen **Deterministik Kural Tablosu (Rule Engine)** verecektir.

### A. Başvurulacak Ücretsiz ve Resmi Açık Veri Kaynakları
Veritabanımızı oluştururken kullanacağımız, hukuki ve bilimsel geçerliliği olan 5 ana kaynak:
1. **EU CosIng (Avrupa Komisyonu Kozmetik İçerik Veritabanı):** 30.000+ INCI (Uluslararası Kozmetik İçerik Adlandırması) maddesinin resmi fonksiyonu, yasaklı/kısıtlı (Annex II - VI) listeleri.
2. **AB SCCS & ECHA (Avrupa Kimyasallar Ajansı) Endokrin Bozucu Listesi:** Hormon bozucu (EDC - Endocrine Disrupting Chemicals) olarak sınıflandırılan resmi kimyasallar.
3. **EFSA (Avrupa Gıda Güvenliği Otoritesi) & OpenFoodFacts:** Tüm E-kodları (E100–E1599), günlük alım limitleri (ADI) ve NOVA gıda işlenme dereceleri (1'den 4'e kadar).
4. **CIR (Cosmetic Ingredient Review) & Dermatolojik Komedojenik Ölçeği (0–5):** Hangi yağların/esterlerin gözenek tıkadığı (sivilce yaptığı) ve irritasyon skorları.
5. **Uluslararası Helal Standartları (GİMDES, JAKIM, IFANCA, SMIIC):** E-kodlarının ve kozmetik bileşenlerin *Helal*, *Haram (Kesin Yasak)* ve *Müşbooh (Şüpheli - Kaynağına Göre Değişen)* sınıflandırması.

---

### B. Ön Çalışma: 5 Ana Risk Kategorisi ve Kritik Maddeler (Çekirdek Liste Taslağı)

Diğer yapay zekalarla çapraz kontrol edeceğimiz temel bilimsel sınıflandırma matrisi:

#### 1. Hormon Bozucular (Endocrine Disruptors - EDCs)
* **Parabenler (Yüksek/Orta Risk):** *Methylparaben, Propylparaben, Butylparaben, Isobutylparaben, Isopropylparaben* (Östrojen taklidi / üreme toksisitesi şüphesi).
* **Kimyasal UV Filtreleri:** *Oxybenzone (Benzophenone-3), Octinoxate (Ethylhexyl Methoxycinnamate), Homosalate, Octocrylene, 4-Methylbenzylidene Camphor (4-MBC)*.
* **Sentetik Antioksidanlar & Koruyucular:** *BHA (Butylated Hydroxyanisole), BHT (Butylated Hydroxytoluene), Triclosan, Triclocarban, Resorcinol*.
* **Ftalatlar ve Halkalı Silikonlar:** *DEP (Diethyl Phthalate), DBP, D4 (Cyclotetrasiloxane), D5 (Cyclopentasiloxane)*.
* **Koku Maddeleri (Gizli Ftalat/Misk):** *Lilial (Butylphenyl Methylpropional - AB'de üreme toksisitesi nedeniyle yasaklandı!), Galaxolide (HHCB)*.

#### 2. Hamilelik ve Emzirme Döneminde Kesin/Yüksek Riskli Maddeler
* **Retinoidler / A Vitamini Türevleri (Kırmızı Alarm - Teratojenik):** *Retinol, Retinal, Retinyl Palmitate, Retinoic Acid (Tretinoin), Adapalene, Tazarotene, Bakuchiol (dikkatli kullanım)*.
* **Cilt Açıcılar & Asitler:** *Hydroquinone, Arbutin (yüksek konsantrasyon), Salicylic Acid / BHA (%2 üzeri veya oral/geniş yüzey kullanımı)*.
* **Formaldehit Salıcı Koruyucular:** *DMDM Hydantoin, Imidazolidinyl Urea, Diazolidinyl Urea, Quaternium-15, Bronopol*.

#### 3. Akne / Gözenek Tıkayıcılar (Komedojenik Skor $\ge 3$) ve Cilt Tahriş Ediciler
* **Yüksek Komedojenik Esterler ve Yağlar:** *Isopropyl Myristate (5/5), Isopropyl Palmitate (4/5), Myristyl Myristate (5/5), Coconut Oil / Cocos Nucifera (4/5), Cocoa Butter (4/5), Wheat Germ Oil (5/5), Algae Extract, Lanolin*.
* **Sert Sülfatlar ve Kurutucu Alkoller:** *SLS (Sodium Lauryl Sulfate), SLES (Sodium Laureth Sulfate), Alcohol Denat., SD Alcohol 40, Isopropyl Alcohol*.

#### 4. Gıda Katkı Maddeleri (E-Kodları) ve Metabolik Riskler
* **Çocuklarda Hiperaktivite Uyarı Zorunluluğu Olan Boyalar ("Southampton Altılısı" - AB Kuralı):** *E102 (Tartrazin), E104 (Kinolin Sarısı), E110 (Sunset Yellow), E122 (Karmoizin), E124 (Ponceau 4R), E129 (Allura Red)*.
* **Kanserojen / Nitrosamin Riskli Koruyucular:** *E249, E250 (Sodyum Nitrit), E251, E252 (Potasyum Nitrat), E220-E228 (Sülfitler), E320 (BHA), E321 (BHT)*.
* **Metabolik / İnsülin & Bağırsak Florası Riskleri:** *Yüksek Fruktozlu Mısır Şurubu (HFCS / Glikoz-Fruktoz Şurubu), Maltodekstrin (Çok yüksek glisemik indeks), E621 (MSG - Monosodyum Glutamat), Karagenan (E407 - bağırsak inflamasyonu), Polisorbat 80 (E433)*.

#### 5. Helal / Haram / Şüpheli (Müşbooh) Sınıflandırması ve "Yanlış Pozitif" Tuzakları
> [!WARNING]
> **Amatör Uygulamaların Düştüğü En Büyük 3 Hata (Bizim Uygulamamızın Farkı):**
> 1. **"Alkol" Kelimesi Tuzağı:** Acemi uygulamalar içindekilerde `Cetyl Alcohol`, `Stearyl Alcohol`, `Cetearyl Alcohol` veya `Behenyl Alcohol` görünce "HARAM / ALKOL VAR" uyarısı verir! **Bu büyük bir bilimsel ve fıkhi hatadır.** Bunlar sıvı etil alkol değil, bitkisel yağlardan elde edilen mumsu **Yağ Alkolleridir (Fatty Alcohols)**. Hem cildi nemlendirir hem de **Helaldir**. Gerçek etil alkol olanlar: `Alcohol Denat.`, `Ethanol`, `Ethyl Alcohol`, `SD Alcohol`'dür.
> 2. **Kesin Haram Olanlar (Kırmızı):** *E120 (Karmin / Cochineal - Böcek kanı boyası), Domuz Jelatini (Pork Gelatin / E441), L-Sistein (E920 - insan saçı veya domuz kılından üretilen form), Carmine, Shellac (E904 - mezheplere göre tartışmalı).*
> 3. **Çift Kaynaklı / Şüpheli (Müşbooh - Sarı Uyarı):** *E471 (Mono- ve digliseridler), E472–E477, Gliserin (Glycerin/E422), Stearik Asit (Stearic Acid/E570), Magnezyum Stearat, Lesitin (Soya ise helal, hayvansal ise şüpheli), Peynir Altı Suyu (Whey - kullanılan peynir mayası/rennet kaynağına bağlı).*

---

## 2. Diğer 2 Yapay Zekaya Verilecek Detaylı Promptlar

En yüksek kalitede ve uydurma içermeyen bir sonuç almak için diğer 2 yapay zekaya **aynı anda tek bir dev prompt sormak yerine**, işi iki uzmanlık alanına bölerek veya iki aşamalı sorarak maksimum detay alabiliriz.

* **Prompt 1 (Toksikoloji, Dermatoloji, Hormon Bozucular & Gıda Güvenliği Uzmanı):** Kozmetik (INCI) ve Gıda (E-kodları) bilimsel veri tablosunu ve puanlama algoritmasını denetletmek için.
* **Prompt 2 (Helal Sertifikasyon, Biyokimya & "Yanlış Pozitif / Edge-Case" Denetçisi):** Helal/Şüpheli kurallarını, kimyasal isim tuzaklarını ve OCR okuma hatalarını yakalamak için.

*(İsterseniz iki yapay zekaya da sırayla her iki promptu verebilirsiniz.)*

---

### 📋 KOPYALA-YAPIŞTIR PROMPT 1: Kozmetik (INCI), Hormon Bozucular ve Gıda (E-Kodu) Bilimsel Kural Motoru

```markdown
ROLÜN VE AMACIN:
Sen kıdemli bir Kozmetik Toksikoloğu (EU SCCS / CIR standartlarına hakim), Dermatolog ve Gıda Güvenliği (EFSA / FDA) uzmanısın.
Şu anda iOS ve Android için "Kozmetik ve Gıda İçerik Tarayıcı" (Ingredient Scanner) mobil uygulaması geliştiriyoruz.
En kritik kuralımız: SIFIR HALÜSİNASYON (Zero Hallucination). Uygulama hiçbir madde hakkında uydurma veya bilimsel dayanağı olmayan spekülatif yorum yapmamalıdır. Tüm risk puanları deterministik bir veritabanı ve kural motoruna (Rule Engine) dayanacaktır.

GÖREVİN:
Aşağıdaki 4 başlıkta, uygulamamızın veritabanı çekirdeğini oluşturacak en kapsamlı, bilimsel referanslı ve hatasız sınıflandırma kurallarını çıkarmak ve ön çalışmamızdaki olası eksikleri/tuzakları tamamlamaktır:

1. HORMON BOZUCULAR (ENDOCRINE DISRUPTORS - EDCs) LİSTESİ:
- Kozmetik (INCI) ve gıda paketlerinde karşılaşabileceğimiz tüm bilinen ve şüpheli endokrin bozucuları (AB SCCS Öncelikli Listesi, ECHA SVHC ve NIEHS referanslarıyla) "Yüksek Risk (Kesin/Güçlü Kanıt)" ve "Orta Risk (Şüpheli/Kısıtlı)" olarak iki kademede listele.
- Her maddenin tüm alternatif INCI/etiket yazılışlarını (synonyms) yaz (Örn: Benzophenone-3 = Oxybenzone, Butylphenyl Methylpropional = Lilial, BHA = E320 vb.).

2. ÖZEL HASSASİYET PROFİLLERİ MATRİSİ (KULLANICI FİLTRELERİ):
Aşağıdaki 4 kullanıcı profili için "Kesin Kaçınılması Gerekenler (Kırmızı)" ve "Dikkatli Olunması Gerekenler (Sarı)" tam içerik listelerini (INCI ve E-kodlarıyla) çıkar:
a) Hamilelik ve Emzirme Güvenliği (Teratojenik maddeler, retinoid türevlerinin tüm isimleri, salisilik asit türevleri, uçucu yağlar, kimyasal filtreler vb.)
b) Akneye Meyilli / Komedojenik Cilt (Komedojenik skoru 3, 4 ve 5 olan yağlar, esterler, emülgatörler) ve fungal akne (Malassezia) tetikleyicileri.
c) Hassas Cilt / Egzama / Rozasea (AB'nin belirlediği alerjen parfüm bileşenleri, formaldehit salıcıların tüm gizli isimleri, izotiazolinon türevleri MI/MCI, sülfatlar).
d) Çocuk Beslenmesi & İnsülin Direnci / Metabolik Sağlık (Southampton 6'lısı yapay boyalar, nitrit/nitratlar, gizli şekerlerin 30+ farklı etiket adı, bağırsak bariyerini bozan emülgatörler).

3. BİLİMSEL "YANLIŞ POZİTİF" (FALSE POSITIVE) TUZAKLARI:
Amatör uygulamaların ismine bakarak yanlışlıkla "Zararlı/Kötü" dediği ama aslında güvenli olan maddeleri listele. (Örn: "Alcohol Denat." ile güvenli yağ alkolleri olan "Cetyl/Cetearyl Alcohol" farkı; veya "Sodium Hyaluronate" içindeki "Sodium" kelimesinin tuz sanılması gibi en az 15-20 kritik kimyasal isim tuzağını açıkla).

4. SKORLAMA ALGORİTMASI (0-100 PUANLAMA FORMÜLÜ):
Bir üründe 25 madde olduğunda genel ürün puanını (0-100) hesaplarken nasıl bir matematiksel ağırlıklandırma kullanmalıyız?
- Örneğin içindekiler listesindeki sıralama (ilk 5 madde yüksek konsantrasyon vs. %1 altı koruyucular/parfüm) skoru nasıl etkilemeli?
- Tek bir "Yüksek Riskli Hormon Bozucu" veya "AB'de Yasaklı Madde (örn. Lilial)" bulunduğunda ortalamaya bakılmaksızın tavan puan (Cap Score) kaç olmalı?

Lütfen yanıtını doğrudan bir yazılım mühendisinin JSON/SQL kural motoruna aktarabileceği netlikte, eksiksiz INCI/E-kodu isimleriyle ve resmi referans kurumlarıyla (EU CosIng Annex, EFSA, CIR) yapılandır.
```

---

### 📋 KOPYALA-YAPIŞTIR PROMPT 2: Helal/Haram/Müşbooh Denetimi, OCR Hata Toleransı ve Hukuki/App Store Uyumu

```markdown
ROLÜN VE AMACIN:
Sen Uluslararası Helal Gıda ve Kozmetik Sertifikasyon Uzmanı (SMIIC, JAKIM, GİMDES, IFANCA standartlarına hakim bir Gıda Kimyageri) ve aynı zamanda Sağlık/Tüketici Mobil Uygulamaları Veri Mimarısın.
Geliştirdiğimiz "Gıda ve Kozmetik İçerik Tarayıcı" mobil uygulamasında hem "Temiz İçerik" hem de "Helal / Alkolsüz / Vegan Kontrolü" modülü yer alacak. Uygulamanın kullanıcıyı yanlış yönlendirmemesi (helale haram, harama helal dememesi veya güvenli maddeye zehirli dememesi) hayati önem taşıyor.

GÖREVİN:
Aşağıdaki 4 teknik ve bilimsel başlığı sıfır hata prensibiyle detaylandırmak:

1. HELAL / HARAM / MÜŞBOOH (ŞÜPHELİ) TAM VERİTABANI KURALLARI:
Kozmetik (INCI) ve Gıda (E-Kodları ve genel içerikler) için maddeleri 3 kesin kategoriye ayır:
- KATEGORİ A (Kesin Haram / Necis - Kırmızı): Karmin (E120 / Cochineal / CI 75470), Domuz Jelatini, L-Sistein (E920 - saç/kıl kaynaklı), Pepsin, Domuz yağı türevleri (Lard) vb. tüm etiket ve CI (Color Index) kodlarıyla listele.
- KATEGORİ B (Alkol & Çözücü Ayrımı - Çok Kritik): Kozmetik ve gıdada hangi alkol türleri kesin haram/sakıncalıdır (Ethanol, Alcohol Denat., SD Alcohol, Isopropyl Alcohol vb.), hangileri kimyasal yapısında "-ol" veya "Alcohol" geçmesine rağmen İslami ve kimyasal açıdan sarhoş edici/çözücü olmayan helal yağ alkolleridir veya şeker alkolleridir (Cetyl Alcohol, Stearyl Alcohol, Cetearyl Alcohol, Panthenol, Tocopherol, Sorbitol, Xylitol, Erythritol vb.)? Bu ayrımı eksiksiz bir beyaz/kara liste olarak ver.
- KATEGORİ C (Müşbooh / Çift Kaynaklı Şüpheli Maddeler - Sarı Uyarı): Bitkisel de hayvansal da olabilen (Gliserin/Glycerin, E471-E477, Stearik Asit, Magnezyum Stearat, Lesitin, Kollajen, Keratin, Allantoin, Squalene, Peynir altı suyu/Rennet vb.) maddelerin tam listesini ve kullanıcıya ekranda gösterilecek en doğru, paniğe sevk etmeyen bilimsel açıklama metnini yaz ("Üründe Vegan veya Helal logosu varsa güvenlidir, yoksa kaynağı hayvansal olabilir" kuralı nasıl işlemeli?).

2. PAKET ÜZERİNDEKİ İŞARETLERİN ÇAPRAZ KONTROLÜ (CONTEXT ENGINE):
Eğer ürünün üzerinde "Vegan" veya "Vegetarian" ibaresi/logosu varsa, "Şüpheli (Müşbooh)" kategorisindeki hangi maddeler otomatik olarak "Helal / Güvenli (Yeşil)" sınıfına yükseltilebilir? (İstisnaları nelerdir? Örn: Vegan bir üründe hayvansal E471 olamaz ama Ethanol olabilir!) Bu mantıksal karar ağacını (if-else matrisini) çıkar.

3. OCR (KAMERA METİN OKUMA) HATALARI VE NORMALİZASYON:
Kullanıcı kıvrımlı bir şampuan şişesinin veya parlak bir çikolata paketinin fotoğrafını çektiğinde OCR motoru harfleri yanlış okuyabilir (Örn: "CI 75470" yerine "C1 7547O" veya "Methylisothiazolinone" kelimesinin satır sonundan bölünmesi).
- En sık karşılaşılan çok dilli (Türkçe, İngilizce, Almanca, Fransızca, Arapça) içindekiler listesi yazım farklılıklarını ve bulanık eşleştirme (Fuzzy Matching / Levenshtein Distance) yaparken birbirine karıştırılabilecek tehlikeli madde çiftlerini (Örn: "Sodium Lauryl Sulfate" vs "Sodium Laureth Sulfate" vs "Sodium Lauroyl Sarcosinate") listele.

4. HUKUKİ SORUMLULUK (DISCLAIMER) VE APP STORE GUIDELINE 1.4.1 UYUMU:
Markaların (L'Oréal, Unilever, Ülker vb.) bize dava açmaması ve Apple'ın uygulamayı sağlık kurallarından reddetmemesi için:
- Sonuç ekranında kullanmamız gereken "İfade Dili" nasıl olmalı? ("Bu ürün kanser yapar" yerine "Bu bileşen (X), EU SCCS raporuna göre endokrin sistem üzerinde potansiyel etki açısından incelenmektedir" gibi hukuki açıdan kurşun geçirmez şablon cümleler oluştur).
```

---

## 3. Sonraki Adım Planı

1. Yukarıdaki **Prompt 1** ve **Prompt 2**'yi kullandığınız diğer 2 yapay zekaya (örneğin Claude ve ChatGPT / DeepSeek) gönderin.
2. Onlardan gelen yanıtları doğrudan buraya yapıştırın.
3. Ben üçümüzün (benim ön çalışmam + diğer 2 AI'nın çıktıları) verilerini birleştirip **çelişkileri temizleyeyim** ve uygulamanın içine gömeceğimiz **Doğrulanmış Ana İçerik Veritabanı (`ingredients_master_db.json`) ve Puanlama Algoritmasını** oluşturayım.
