import { evaluateProduct } from '../src/engine/ruleEngine.mjs';
const nutella = evaluateProduct({
  rawText: "İçindekiler: Şeker, Palm Yağı, Fındık (%13), Yağsız Süt Tozu (%8.7), Yağı Azaltılmış Kakao (%7.4), Emülgatör: Lesitin (Soya), Vanilin",
  productType: "food"
});
for (const o of nutella.observations) {
  console.log(`${o.raw} -> ${o.status}`);
}
