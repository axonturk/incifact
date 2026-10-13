// Syntax-checks every inline <script> in public/index.html. Run: node tests/html_script_syntax.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
let bad = 0;
scripts.forEach((src, i) => {
  try { new vm.Script(src, { filename: `index.html#script${i}` }); console.log(`✅ script ${i} syntax OK`); }
  catch (e) { bad++; console.log(`❌ script ${i}: ${e.message}`); }
});
process.exit(bad ? 1 : 0);
