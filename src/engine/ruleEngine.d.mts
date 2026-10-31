export function parseIngredientList(rawText: string): any[];
export function evaluateProduct(options: Record<string, any>): any;
export function compareProducts(productA: any, productB: any, sharedOptions?: Record<string, any>): any;
export function normalizeBarcodeInput(rawBarcode: any): { valid: boolean; code: string };
export const VERIFIED_BARCODE_CATALOG: Record<string, any>;
export function lookupBarcodeProduct(options?: Record<string, any>): any;
export function createCustomBarcodeEntry(options?: Record<string, any>): any;

