// One-off: make privacy statements match real data flow in all 10 languages.
// Mobile app = on-device only. Web preview = sent only to the local server on this computer, not stored, not shared.
import fs from 'node:fs';

const LANGS = ['tr', 'en', 'ar', 'de', 'fr', 'id', 'ms', 'es', 'ru', 'ur'];

const subtitle = {
  tr: 'Mobil uygulamada seçimin yalnızca bu cihazda işlenir. Web önizlemesinde yalnızca bu bilgisayardaki yerel sunucuya analiz için gönderilir; kaydedilmez, üçüncü taraflarla paylaşılmaz. Aynı ürün herkese aynı sonucu vermez.',
  en: 'In the mobile app your choices are processed only on this device. In the web preview they are sent only to the local server on this computer for analysis, never stored or shared with third parties. The same product affects different people differently.',
  ar: 'في تطبيق الهاتف تُعالَج اختياراتك على هذا الجهاز فقط. في معاينة الويب تُرسَل فقط إلى الخادم المحلي على هذا الحاسوب للتحليل، ولا تُخزَّن ولا تُشارَك مع أي طرف ثالث. المنتج نفسه لا يؤثر على الجميع بالطريقة نفسها.',
  de: 'In der mobilen App werden deine Angaben nur auf diesem Gerät verarbeitet. In der Web-Vorschau gehen sie nur zur Analyse an den lokalen Server auf diesem Computer, ohne Speicherung und ohne Weitergabe an Dritte.',
  fr: "Dans l'application mobile, vos choix sont traités uniquement sur cet appareil. Dans l'aperçu web, ils sont envoyés uniquement au serveur local de cet ordinateur pour l'analyse, sans stockage ni partage avec des tiers.",
  id: 'Di aplikasi seluler, pilihan Anda hanya diproses di perangkat ini. Di pratinjau web, pilihan hanya dikirim ke server lokal di komputer ini untuk analisis, tidak disimpan dan tidak dibagikan kepada pihak ketiga.',
  ms: 'Dalam aplikasi mudah alih, pilihan anda hanya diproses di peranti ini. Dalam pratonton web, ia hanya dihantar ke pelayan tempatan di komputer ini untuk analisis, tidak disimpan dan tidak dikongsi dengan pihak ketiga.',
  es: 'En la app móvil tus preferencias se procesan solo en este dispositivo. En la vista previa web se envían solo al servidor local de este ordenador para el análisis, sin guardarse ni compartirse con terceros.',
  ru: 'В мобильном приложении ваш выбор обрабатывается только на этом устройстве. В веб-версии он передаётся только на локальный сервер этого компьютера для анализа, не сохраняется и не передаётся третьим лицам.',
  ur: 'موبائل ایپ میں آپ کا انتخاب صرف اسی ڈیوائس پر پراسیس ہوتا ہے۔ ویب پیش نظارہ میں یہ صرف تجزیے کے لیے اسی کمپیوٹر کے مقامی سرور کو بھیجا جاتا ہے، محفوظ نہیں کیا جاتا اور کسی تیسرے فریق کے ساتھ شیئر نہیں ہوتا۔'
};

const privacyNote = {
  tr: 'Gizlilik: Sağlık ve inanç seçimlerin KVKK md. 6 ve GDPR md. 9 kapsamında özel nitelikli veridir. Hesap açtırmıyoruz, kaydetmiyoruz, buluta veya üçüncü taraflara göndermiyoruz.',
  en: 'Privacy: Health & faith preferences are special-category data under GDPR Art. 9. No account, no storage, nothing sent to the cloud or third parties.',
  ar: 'الخصوصية: تفضيلات الصحة والعقيدة بيانات حساسة وفق المادة 9 من GDPR. لا حساب، ولا تخزين، ولا إرسال إلى السحابة أو أي طرف ثالث.',
  de: 'Datenschutz: Gesundheits- und Glaubensangaben sind besondere Daten nach DSGVO Art. 9. Kein Konto, keine Speicherung, keine Übermittlung an Cloud oder Dritte.',
  fr: 'Confidentialité : vos données de santé et de convictions sont des données sensibles (RGPD art. 9). Aucun compte, aucun stockage, aucun envoi vers le cloud ou des tiers.',
  id: 'Privasi: Data kesehatan dan keyakinan adalah data sensitif (GDPR Pasal 9). Tanpa akun, tanpa penyimpanan, tidak dikirim ke cloud atau pihak ketiga.',
  ms: 'Privasi: Data kesihatan dan kepercayaan ialah data sensitif (GDPR Perkara 9). Tiada akaun, tiada storan, tidak dihantar ke awan atau pihak ketiga.',
  es: 'Privacidad: tus datos de salud y creencias son datos sensibles (RGPD art. 9). Sin cuenta, sin almacenamiento y sin envío a la nube ni a terceros.',
  ru: 'Конфиденциальность: данные о здоровье и убеждениях относятся к особой категории (GDPR, ст. 9). Без аккаунта, без хранения, без передачи в облако или третьим лицам.',
  ur: 'رازداری: صحت اور عقیدے سے متعلق انتخاب GDPR آرٹیکل 9 کے تحت حساس ڈیٹا ہیں۔ نہ اکاؤنٹ، نہ محفوظ کرنا، نہ کلاؤڈ یا کسی تیسرے فریق کو بھیجنا۔'
};

// Engine card notice = first two sentences of the subtitle (no product-effect sentence)
const kvkk = Object.fromEntries(LANGS.map((l) => [l, subtitle[l].replace(/\s*(Aynı ürün|The same product|المنتج نفسه).*$/u, '')]));

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function replaceNth(src, keyRegex, values, label) {
  let i = 0;
  const out = src.replace(keyRegex, (m, indent, key) => {
    if (i >= LANGS.length) return m;
    const v = values[LANGS[i++]];
    return `${indent}${key}: ${q(v)},`;
  });
  if (i !== LANGS.length) throw new Error(`${label}: expected ${LANGS.length} replacements, got ${i}`);
  return out;
}

// locales.mjs: profileScreen.subtitle is the first `subtitle:` inside each language's profileScreen block
let loc = fs.readFileSync('src/i18n/locales.mjs', 'utf8');
loc = loc.replace(/(profileScreen:\s*\{\s*\n\s*title:[^\n]*\n)(\s*)subtitle:\s*'(?:[^'\\]|\\.)*',/g, (() => {
  let i = 0;
  return (m, head, indent) => `${head}${indent}subtitle: ${q(subtitle[LANGS[i++]])},`;
})());
loc = replaceNth(loc, /^(\s*)(privacyNote):\s*'(?:[^'\\]|\\.)*',?$/gm, privacyNote, 'privacyNote');
// restore missing trailing comma semantics: privacyNote is the last key in its block (no comma originally)
loc = loc.replace(/(privacyNote: '(?:[^'\\]|\\.)*'),(\s*\n\s*\})/g, '$1$2');
fs.writeFileSync('src/i18n/locales.mjs', loc, 'utf8');

let eng = fs.readFileSync('src/engine/ruleEngine.mjs', 'utf8');
eng = replaceNth(eng, /^(\s*)(kvkkNotice):\s*'(?:[^'\\]|\\.)*',$/gm, kvkk, 'kvkkNotice');
fs.writeFileSync('src/engine/ruleEngine.mjs', eng, 'utf8');
console.log('privacy texts updated');
