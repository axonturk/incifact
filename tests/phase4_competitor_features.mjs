import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateHouseholdProfiles,
  evaluateRoutineShelf,
  findCleanerAlternativesAndDupes,
  getIngredientDossier,
  compareProducts
} from '../src/engine/ruleEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}\n`, err);
    process.exitCode = 1;
  }
}

console.log('======================================================================');
console.log('🏆 PHASE 4 COMPETITOR FEATURES SUITE (10 LANGUAGES · ZERO-HALLUCINATION)');
console.log('======================================================================');

// 1. Household / Family Multi-Profile Evaluation
t('[Household] evaluateHouseholdProfiles returns side-by-side verdicts for up to 4 diverse members', () => {
  for (const lang of ['tr', 'en', 'ar']) {
    const res = evaluateHouseholdProfiles(
      {
        rawText: 'Aqua, Retinol, Methyl Glucose Sesquistearate, Panthenol, Tocopherol',
        productType: 'cosmetic',
        lang
      },
      [
        { id: 'm1', name: 'Me', userProfiles: [], halalAuthority: 'IFANCA', madhhab: 'general' },
        { id: 'm2', name: 'Pregnant Partner', userProfiles: ['hamilelik'], halalAuthority: 'GIMDES', madhhab: 'general' },
        { id: 'm3', name: 'Acne Teen', userProfiles: ['fungal_acne'], halalAuthority: 'GIMDES', madhhab: 'general' },
        { id: 'm4', name: 'Watchlist Dad', userProfiles: [], customWatchlist: ['Panthenol'], halalAuthority: 'IFANCA', madhhab: 'general' },
        { id: 'm5', name: 'Ignored 5th', userProfiles: [] }
      ]
    );
    assert.equal(res.memberCount, 4, 'Must cap household members to 4');
    assert.equal(res.allSafe, false);
    assert.ok(res.flaggedCount >= 2);
    assert.equal(res.members[0].overallColor, 'yesil');
    assert.equal(res.members[1].overallColor, 'kirmizi'); // Retinol in hamilelik
    assert.equal(res.members[2].overallColor, 'sari');    // Methyl Glucose Sesquistearate in fungal_acne
    assert.equal(res.members[3].overallColor, 'kirmizi'); // Custom watchlist Panthenol
    assert.ok(res.members.every((m) => typeof m.topReason === 'string' && m.topReason.length > 5));
  }
});

// 2. AM / PM / Pantry Routine Shelf + Omnibus Tracker
t('[Shelf] evaluateRoutineShelf detects cross-bottle AM/PM conflicts, rinse-off mitigation & EU Omnibus alerts', () => {
  const shelf = evaluateRoutineShelf(
    [
      {
        id: 'am1',
        name: 'Vit C Serum',
        slot: 'AM',
        productType: 'cosmetic',
        applicationType: 'leave_on',
        rawText: 'Aqua, Ascorbic Acid, Glycerin'
      },
      {
        id: 'am2',
        name: 'Copper Serum',
        slot: 'AM',
        productType: 'cosmetic',
        applicationType: 'leave_on',
        rawText: 'Aqua, Copper Tripeptide-1, Butylphenyl Methylpropional, Glycerin'
      },
      {
        id: 'pm1',
        name: 'BPO Wash',
        slot: 'PM',
        productType: 'cosmetic',
        applicationType: 'rinse_off',
        rawText: 'Aqua, Benzoyl Peroxide, Glycerin'
      },
      {
        id: 'pm2',
        name: 'Retinol Night',
        slot: 'PM',
        productType: 'cosmetic',
        applicationType: 'leave_on',
        rawText: 'Aqua, Retinol, Glycerin'
      },
      {
        id: 'pm3',
        name: 'AHA Toner',
        slot: 'PM',
        productType: 'cosmetic',
        applicationType: 'leave_on',
        rawText: 'Aqua, Glycolic Acid, Glycerin'
      },
      {
        id: 'food1',
        name: 'Cereal Bar',
        slot: 'Pantry',
        productType: 'food',
        rawText: 'Oats, Honey'
      }
    ],
    { lang: 'en' }
  );
  assert.equal(shelf.totalItems, 6);
  assert.ok(shelf.amConflicts.some((c) => c.conflictId === 'conflict_copper_peptide_acids_vitc'));
  const pmBpo = shelf.pmConflicts.find((c) => c.conflictId === 'conflict_retinoid_benzoyl_peroxide');
  assert.ok(pmBpo && pmBpo.rinseOffMitigated === true && pmBpo.severity === 'sari');
  assert.ok(shelf.pmConflicts.some((c) => c.conflictId === 'conflict_retinoid_aha_bha'));
  assert.ok(shelf.omnibusAlerts.length >= 1, 'Lilial must appear on Omnibus/banned alert tracker');
});

// 3. Cleaner & Halal Alternatives + INCI Dupes + compareProducts().dupeAnalysis
t('[Alternatives/Dupes] findCleanerAlternativesAndDupes & compareProducts().dupeAnalysis work accurately', () => {
  const res = findCleanerAlternativesAndDupes(
    {
      rawText: 'Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Sodium Lauryl Sulfate, Methylisothiazolinone, Parfum, Limonene',
      productType: 'cosmetic'
    },
    { lang: 'tr', userProfiles: ['hassas_cilt'], halalAuthority: 'GIMDES' }
  );
  assert.ok(res.totalCandidatesEvaluated >= 3);
  assert.ok(res.cleanerAlternatives.length >= 1);
  for (const alt of res.cleanerAlternatives) {
    assert.ok(alt.score >= 80, `Alternative ${alt.name} score must be >=80, got ${alt.score}`);
    assert.notEqual(alt.halalStatus, 'uygunsuz_bulgu');
  }
  assert.ok(res.dupes.length >= 1);
  assert.ok(res.dupes[0].similarityPercent >= 15);

  const comp = compareProducts(
    { name: 'Cream A', productType: 'cosmetic', rawText: 'Aqua, Glycerin, Niacinamide, Panthenol, Ceramide NP, Tocopherol' },
    { name: 'Cream B', productType: 'cosmetic', rawText: 'Aqua, Glycerin, Niacinamide, Panthenol, Allantoin' },
    { lang: 'en' }
  );
  assert.ok(comp.dupeAnalysis);
  assert.ok(comp.dupeAnalysis.similarityPercent >= 40 && comp.dupeAnalysis.similarityPercent < 100);
  assert.ok(comp.dupeAnalysis.sharedActives.some((a) => /Niacinamide|Panthenol/i.test(a)));
});

// 4. INCIDecoder-style Clickable Ingredient Dossier
t('[Dossier] getIngredientDossier surfaces Superstar badges, CosIng functions, 7 profiles, Halal & HTTPS sources across languages', () => {
  for (const lang of ['tr', 'en', 'ar', 'de']) {
    const niac = getIngredientDossier('Niacinamide', { productType: 'cosmetic', lang, userProfiles: ['akne'] });
    assert.equal(niac.isSuperstar, true);
    assert.ok(niac.beneficialRoles.length >= 2);
    assert.ok(niac.cosingFunctions.length >= 1, `Expected CosIng functions for Niacinamide in ${lang}`);
    assert.equal(niac.profileMatrix.length, 7);
    assert.ok(niac.authorityMatrix && niac.authorityMatrix.GIMDES && niac.authorityMatrix.IFANCA);
  }

  const badMi = getIngredientDossier('Methylisothiazolinone', { productType: 'cosmetic', lang: 'en' });
  assert.equal(badMi.euStatus, 'yasak');
  assert.ok(badMi.sources.some((s) => typeof s.url === 'string' && s.url.startsWith('https://')));
});

// 5. Web & Mobile Faz 4 UI Wiring
t('[Web/Mobile UI] Phase 4 engine hooks, modals, Household, Shelf & WebRTC BarcodeDetector are integrated', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  for (const token of [
    'getIngredientDossier',
    'evaluateHouseholdProfiles',
    'evaluateRoutineShelf',
    'findCleanerAlternativesAndDupes',
    'ingredientDossierModal',
    'webBarcodeCameraModal',
    'BarcodeDetector',
    'getUserMedia',
    'householdVerdictCard',
    'routineShelfCard',
    'cleanerAlternativesCard',
    'compareDupeBox'
  ]) {
    assert.ok(html.includes(token), `public/index.html missing Phase 4 hook: ${token}`);
  }

  const mobile = fs.readFileSync(path.join(ROOT, 'src/mobile/ScannerApp.tsx'), 'utf8');
  for (const token of [
    'getIngredientDossier',
    'evaluateHouseholdProfiles',
    'evaluateRoutineShelf',
    'findCleanerAlternativesAndDupes',
    'dossierModalData',
    'dupeAnalysis'
  ]) {
    assert.ok(mobile.includes(token), `ScannerApp.tsx missing Phase 4 hook: ${token}`);
  }
});

console.log(`\n🎉 Phase 4 suite finished: ${passed} checks passed.`);
