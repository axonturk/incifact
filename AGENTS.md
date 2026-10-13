# InciFact — Ajan Kuralları

Bu projede çalışan her ajan, işe başlamadan önce şunları yapmalıdır:

1. `PROJECT_HANDOVER.md` dosyasını baştan sona oku. Projenin tüm geçmişi, mimarisi, denetim sonuçları ve **açık kalan işleri** orada.
2. Gerekirse `docs/handover/` klasöründeki denetim raporlarına ve planlara bak.
3. Kod değiştirmeden önce ve sonra `npm test` çalıştır (veri senkronu, 39 kabul testi, denetim-3 regresyonları, yerel etiket kapsamı, 0 çakışma). `src/data/*.json` düzenlediysen önce `npm run build:data`.
4. Motor veya veri değişikliğinden sonra `server.mjs` yeniden başlatılmalı; canlı API ile disk motoru aynı sonucu vermeli.
5. Bağımsız denetçi tarafından doğrulanmamış bir puanı (ör. "GO", "95+") kesin sonuç gibi sunma.
6. Kullanıcı ile Türkçe konuş.
