# InciFact - Hibrit Barkod ve Açık Veri Entegrasyon Mimarisi

**Tarih:** 13 Ekim 2026  
**Konu:** Open Food Facts (OFF) & Open Beauty Facts (OBF) Entegrasyonunda Riskler, Limitler ve Çözüm Mimarisi  
**Temel İlke:** "Sunucu IP'sini Koruyan İstemci Çağrısı + Çok Kademeli Önbellek + Etiket Fotoğrafı Sigortası"  

---

## 1. Tespit Edilen Kritik Riskler ve Mühendislik Çözümleri

| Risk Boyutu | Karşılaşılan Tehdit | Mühendislik Çözümü |
| :--- | :--- | :--- |
| **IP Engelleme (Rate Limit)** | OFF limiti IP başına dakikada ~15-60 sorgudur. Tüm kullanıcılar sunucu (`server.mjs`) üzerinden sorgularsa sunucu dakikalar içinde banlanır. | **İstemci-Taraflı Doğrudan Çağrı (Client-Side Fetch):** API isteği merkezi sunucudan değil, her kullanıcının mobil cihazından kendi IP'siyle yapılır. `User-Agent: InciFact/1.0 (destek@incifact.com)` başlığı zorunlu tutulur. |
| **Kozmetik Veri Yetersizliği** | OFF'ta 4M+ gıda varken, OBF kozmetikte çok küçüktür (on binler mertebesinde). Barkodların çoğu boş döner. | **Fotoğraf Akışı Ana Damar Kalır:** Kozmetikte barkod yalnızca opsiyonel bir kısayoldur; etiket fotoğrafı / OCR taraması uygulamanın değişmez ana omurgasıdır. |
| **Eksik/Eski Gönüllü Verisi** | OFF verileri kitle kaynaklıdır; yazım hataları, eski formüller veya yabancı dilde içerikler olabilir. | **Kapsam <%80 Sigortası:** Gelen metin InciFact motorunda %80 tanınma oranının altındaysa sistem otomatik olarak: *"Veri yetersiz, ambalaj arkasını fotoğrafla doğrula"* akışına yönlendirir. |
| **Coğrafi Kapsam Dengesizliği** | Fransa/Almanya kapsanırken; Türkiye, Körfez, Endonezya ve Pakistan'da barkod doluluğu düşüktür. | Hedef pazarlarımızda kullanıcıya asla "Ürün yok" hayal kırıklığı yaşatılmaz; saniyesinde kamera açılarak etiket okutulur. |
| **ODbL ve CC BY-SA Lisansı** | Veritabanı ODbL, görseller CC BY-SA lisanslıdır. Atıf yapılmazsa hukuki ihlal oluşur. | Arayüzde açık kaynak atfı gösterilir: `📦 Kaynak: Open Food Facts (Son Güncelleme: DD.MM.YYYY)`. |

---

## 2. Çok Kademeli Hibrit Barkod Akış Şeması

```
                       [KULLANICI BARKOD OKUTTU]
                                   │
                                   ▼
                   [1. CİHAZ YEREL ÖNBELLEĞİ (AsyncStorage)]
                     Daha önce okutulduysa 0 ms'de getir
                                   │
                           Önbellekte Yoksa
                                   ▼
             [2. MOBİL CİHAZDAN DOĞRUDAN API İSTEĞİ (Client Fetch)]
                 User-Agent: InciFact-App/1.0 (support@incifact.com)
                 https://world.openfoodfacts.org/api/v2/product/{code}.json
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
           [Ürün Bulundu]                     [Ürün Bulunamadı]
                  │                                 │
                  ▼                                 │
        [İçerik Metni Çekildi]                      │
                  │                                 │
                  ▼                                 │
        [InciFact Kural Motoru]                     │
        Bileşenleri Analiz Et                       │
                  │                                 │
           ┌──────┴──────┐                          │
           │             │                          │
     Kapsam >= %80   Kapsam < %80                   │
           │             │                          │
           ▼             ▼                          ▼
     [SONUÇ EKRANI]  [DOĞRULAMA ÇAĞRISI]   [FOTOĞRAF AKIŞI]
     Kaynak: OFF     "Veri eksik olabilir, "Barkod bulunamadı.
     Rozeti Göster    ambalajı fotoğrafla   İçerik yazısını
                      teyit ediniz."        fotoğraflayın."
```

---

## 3. Ekosisteme Değer Katma: Çift Yönlü Katkı Modeli (Two-Way Sync)

Kullanıcı barkodu bulunamayan veya eksik olan bir ürünün etiketini kamerayla fotoğraflayıp InciFact ile analiz ettiğinde:
1. Analiz kullanıcının ekranında derhal üretilir.
2. Ekrana opsiyonel bir onay kutusu çıkar:
   > *"Bu ürünün doğrulanmış içerik listesini Open Food Facts küresel kütüphanesine anonim olarak bağışlamak ister misiniz? [✓ Evet]"*
3. Kullanıcı onay verirse, fotoğraf ve çözümlenen metin OFF API'sine gönderilir.
4. **Sonuç:** InciFact hem lisans gereksinimlerini en etik şekilde karşılar hem de Türkiye, Endonezya ve Körfez'deki helal/kozmetik veri tabanının küresel büyümesine öncülük eder.

---

## 4. Uygulama Adımları

1. **`src/mobile/barcodeService.ts` Modülü:**
   - `fetchProductByBarcode(barcode: string, type: 'food' | 'cosmetic')` fonksiyonu.
   - Cihaz üzerinde `AsyncStorage` (veya Web'de `localStorage`) ile 7 günlük LRU önbellek.
   - Doğrudan istemci çağrısı (sunucu IP ban riskini sıfırlar).
2. **Kapsam Eşik Kontrolü:**
   - Çekilen ham metin doğrudan `evaluateProduct()` fonksiyonuna sokulur; eğer `coverageRatio < 0.8` ise kullanıcıya kamerayla çekim seçeneği sunulur.
3. **Şeffaf Kaynak Rozeti:**
   - Barkoddan gelen sonuçlarda kartın sağ üst köşesine `Open Food Facts (ODbL)` kaynak etiketi ve son senkronizasyon tarihi basılır.
