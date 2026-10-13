// Replaces the Arabic loanword "müşbooh / mushbooh / mashbooh / Мушбух / مشبوه" in user-visible text
// with the natural word of each language. Internal codes (C_musbooh, kaynak_belirsiz_musbooh, badges.musbooh) are unchanged.
// Each replacement must match exactly the expected number of times, otherwise the script aborts.
import fs from 'node:fs';

const edits = {
  'src/i18n/locales.mjs': [
    ["musbooh: 'Müşbooh (Kaynak Belirsiz)'", "musbooh: 'Şüpheli (kaynağı belirsiz)'"],
    ["musbooh: 'Mushbooh (Doubtful Source)'", "musbooh: 'Doubtful (source unclear)'"],
    ["musbooh: 'مشبوه (مصدر غير محدد)'", "musbooh: 'مشكوك فيه (مصدره غير واضح)'"],
    ["musbooh: 'Mashbooh (Unklare Herkunft)'", "musbooh: 'Zweifelhaft (Herkunft unklar)'"],
    ["musbooh: 'Mashbooh (Origine Douteuse)'", "musbooh: 'Douteux (origine incertaine)'"],
    ["musbooh: 'Syubhat (Asal Belum Jelas)'", "musbooh: 'Syubhat (sumber tidak jelas)'"],
    ["musbooh: 'Syubhah (Sumber Tidak Jelas)'", "musbooh: 'Syubhah (sumber tidak jelas)'"],
    ["musbooh: 'Mashbooh (Origen Dudoso)'", "musbooh: 'Dudoso (origen incierto)'"],
    ["musbooh: 'Сомнительно (Машбух)'", "musbooh: 'Сомнительно (происхождение неясно)'"],
    ["musbooh: 'مشبوہ (ماخذ غیر واضح)'", "musbooh: 'مشکوک (ماخذ غیر واضح)'"]
  ],
  'src/engine/ruleEngine.mjs': [
    ["halalMusboohDesc: 'Bitkisel veya hayvansal kaynaklı olabilir (Müşbooh); kesin hüküm için Helal veya Vegan sertifikası doğrulanmalıdır.'",
     "halalMusboohDesc: 'Şüpheli (kaynağı belirsiz): bitkisel veya hayvansal kaynaklı olabilir; kesin hüküm için Helal veya Vegan sertifikası doğrulanmalıdır.'"],
    ["halalMusboohDesc: 'Doubtful / Dual-source ingredient (Mushbooh: can be plant or animal derived); verify Halal or Vegan certification on packaging.'",
     "halalMusboohDesc: 'Doubtful (source unclear): can be plant- or animal-derived; verify Halal or Vegan certification on the packaging.'"],
    ["halalMusboohDesc: 'مكون مشبوه (مزدوج المصدر: قد يكون نباتياً أو حيوانياً)؛ يرجى التحقق من شهادة الحلال أو النباتي (Vegan) على العبوة.'",
     "halalMusboohDesc: 'مشكوك فيه (مصدره غير واضح): قد يكون نباتياً أو حيوانياً؛ يرجى التحقق من شهادة الحلال أو النباتي (Vegan) على العبوة.'"],
    ["halalMusboohDesc: 'Zweifelhaft / Doppelter Ursprung (Mushbooh: pflanzlich oder tierisch); Halal- oder Vegan-Siegel prüfen.'",
     "halalMusboohDesc: 'Zweifelhaft (Herkunft unklar): kann pflanzlich oder tierisch sein; Halal- oder Vegan-Siegel prüfen.'"],
    ["halalMusboohDesc: 'Douteux / Double origine (Mushbooh : végétale ou animale) ; vérifiez la certification Halal ou Vegan.'",
     "halalMusboohDesc: 'Douteux (origine incertaine) : peut être d\\'origine végétale ou animale ; vérifiez la certification Halal ou Vegan.'"],
    ["halalMusboohDesc: 'Syubhat / Sumber ganda (bisa nabati atau hewani); pastikan logo Halal atau Vegan resmi pada kemasan.'",
     "halalMusboohDesc: 'Syubhat (sumber tidak jelas): bisa nabati atau hewani; pastikan logo Halal atau Vegan resmi pada kemasan.'"],
    ["halalMusboohDesc: 'Syubhah / Dwi-sumber (boleh jadi tumbuhan atau haiwan); sila semak logo Halal atau Vegan pada bungkusan.'",
     "halalMusboohDesc: 'Syubhah (sumber tidak jelas): boleh jadi tumbuhan atau haiwan; sila semak logo Halal atau Vegan pada bungkusan.'"],
    ["halalMusboohDesc: 'Dudoso / Doble origen (Mushbooh: vegetal o animal); verifica el certificado Halal o Vegano en el envase.'",
     "halalMusboohDesc: 'Dudoso (origen incierto): puede ser de origen vegetal o animal; verifica el certificado Halal o Vegano en el envase.'"],
    ["halalMusboohDesc: 'Сомнительный компонент двойного происхождения (Мушбух: растительный или животный); проверьте сертификат Халяль или Веган.'",
     "halalMusboohDesc: 'Сомнительно (происхождение неясно): может быть растительного или животного происхождения; проверьте сертификат Халяль или Веган.'"],
    ["halalMusboohDesc: 'مشبوہ (دوہرا ذریعہ: نباتاتی یا حیوانی ہو سکتا ہے)؛ حتمی فیصلے کے لیے پیکنگ پر حلال یا ویگن سرٹیفکیٹ چیک کریں۔'",
     "halalMusboohDesc: 'مشکوک (ماخذ غیر واضح): نباتاتی یا حیوانی ہو سکتا ہے؛ حتمی فیصلے کے لیے پیکنگ پر حلال یا ویگن سرٹیفکیٹ چیک کریں۔'"],
    ["? 'Müşbooh'", "? 'Şüpheli'", 2]
  ],
  'public/index.html': [
    ['color:var(--warn);">Müşbooh</span>', 'color:var(--warn);">Şüpheli</span>'],
    ["'87/100', 'Müşbooh',", "'87/100', 'Şüpheli',"],
    ["'87/100', 'Mushbooh',", "'87/100', 'Doubtful',"],
    ["'87/100', 'Мушбух',", "'87/100', 'Сомнительно',"],
    ["'مشبوه', 'فحص SLS'", "'مشكوك فيه', 'فحص SLS'", 1, true],
    ["musboohInspect: 'Müşbooh / İncele'", "musboohInspect: 'Şüpheli / İncele'"],
    ["musboohInspect: 'Mushbooh / Review'", "musboohInspect: 'Doubtful / Review'"],
    ["musboohInspect: 'مشبوه / راجع المصدر'", "musboohInspect: 'مشكوك فيه / راجع المصدر'"],
    ["musboohInspect: 'Muschbooh / Prüfen'", "musboohInspect: 'Zweifelhaft / Prüfen'"],
    ["musboohInspect: 'Mushbooh / À vérifier'", "musboohInspect: 'Douteux / À vérifier'"],
    ["musboohInspect: 'Mushbooh / Revisar'", "musboohInspect: 'Dudoso / Revisar'"],
    ["musboohInspect: 'Мушбух / Проверить'", "musboohInspect: 'Сомнительно / Проверить'"],
    ["musboohInspect: 'مشبوہ / جائزہ لیں'", "musboohInspect: 'مشکوک / جائزہ لیں'"],
    ["scaleMusbooh: 'Müşbooh'", "scaleMusbooh: 'Şüpheli'"],
    ["scaleMusbooh: 'Mushbooh', scaleHaram: 'Haram / Conflict'", "scaleMusbooh: 'Doubtful', scaleHaram: 'Haram / Conflict'"],
    ["scaleMusbooh: 'مشبوه'", "scaleMusbooh: 'مشكوك فيه'"],
    ["scaleMusbooh: 'Muschbooh'", "scaleMusbooh: 'Zweifelhaft'"],
    ["scaleMusbooh: 'Mushbooh', scaleHaram: 'Haram / Conflit'", "scaleMusbooh: 'Douteux', scaleHaram: 'Haram / Conflit'"],
    ["scaleMusbooh: 'Mushbooh', scaleHaram: 'Haram / Conflicto'", "scaleMusbooh: 'Dudoso', scaleHaram: 'Haram / Conflicto'"],
    ["scaleMusbooh: 'Мушбух'", "scaleMusbooh: 'Сомнительно'"],
    ["scaleMusbooh: 'مشبوہ'", "scaleMusbooh: 'مشکوک'"],
    [" (Мушбух); проверьте", "; проверьте"],
    ["حیوانی دونوں ذرائع سے ہو سکتا ہے (مشبوہ)؛", "حیوانی دونوں ذرائع سے ہو سکتا ہے (مشکوک)؛"],
    ["halalSubWarn: 'مشبوه (", "halalSubWarn: 'مشكوك فيه ("],
    ["halalSubWarn: 'مشبوہ (", "halalSubWarn: 'مشکوک ("],
    ['المواد المشبوهة', 'المواد المشكوك فيها'],
    ['3-State Scale: Helal / Müşbooh / Haram', '3-State Scale: Helal / Şüpheli / Haram']
  ]
};

for (const [file, list] of Object.entries(edits)) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [from, to, expected = 1, optional = false] of list) {
    const count = src.split(from).length - 1;
    if (expected === 0) continue; // handled by a more specific rule below
    if (count !== expected) {
      if (optional && count === 0) { console.log(`skip (not present): ${from.slice(0, 50)}`); continue; }
      throw new Error(`${file}: expected ${expected} x "${from.slice(0, 60)}", found ${count}`);
    }
    src = src.split(from).join(to);
  }
  fs.writeFileSync(file, src, 'utf8');
  console.log(`updated ${file}`);
}
