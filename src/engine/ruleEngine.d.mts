export const DATASET_VERSION: string;
export const RULE_ENGINE_VERSION: string;
export function parseIngredientList(rawText: string): any[];
export function extractSmartLabelContext(rawInput: string | string[]): {
  ingredientText: string;
  detectedProductType: 'food' | 'cosmetic' | null;
  detectedApplicationType: 'leave_on' | 'rinse_off' | 'spray' | null;
  detectedBarcode: string | null;
  detectedVeganClaim: 'declared' | null;
  detectedNutritionPer100g: Record<string, any> | null;
};
export function evaluateProduct(options: Record<string, any>): any;
export function compareProducts(productA: any, productB: any, sharedOptions?: Record<string, any>): any;
export function normalizeBarcodeInput(rawBarcode: any): { valid: boolean; code: string };
export function isValidGs1CheckDigit(digits: string): boolean;
export const VERIFIED_BARCODE_CATALOG: Record<string, any>;
export function lookupBarcodeProduct(options?: Record<string, any>): any;
export function createCustomBarcodeEntry(options?: Record<string, any>): any;
export function evaluateHouseholdProfiles(evalOptions: Record<string, any>, members?: any[]): any;
export function evaluateRoutineShelf(shelfItems?: any[], sharedOptions?: Record<string, any>): any;
export function findCleanerAlternativesAndDupes(currentEvalOrInput: any, options?: Record<string, any>): any;
export function getIngredientDossier(obsOrRaw: any, options?: Record<string, any>): any;
export function evaluateNutriScore(nutritionPer100g: Record<string, any> | null | undefined, options?: Record<string, any>): any;

