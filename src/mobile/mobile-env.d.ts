declare const __DEV__: boolean | undefined;

declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  const React: any;
  export default React;
  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare module 'react-native' {
  export const SafeAreaView: any;
  export const ScrollView: any;
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const Modal: any;
  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
  };
  export const Share: {
    share(content: { message: string; title?: string; url?: string }): Promise<any>;
  };
  export const NativeModules: Record<string, any>;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  export default AsyncStorage;
}

declare module 'expo-image-picker' {
  export function requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  export function requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  export function launchCameraAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
  export function launchImageLibraryAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
}

declare module '../i18n/locales.mjs' {
  export const SUPPORTED_LANGUAGES: Array<{
    code: string;
    name: string;
    nativeName: string;
    dir: 'ltr' | 'rtl';
    flag: string;
    defaultAuthority?: string;
  }>;
  export const UI_STRINGS: Record<string, any>;
  export function getLocaleStrings(lang?: string): any;
}

declare module '../engine/ruleEngine.mjs' {
  export function parseIngredientList(rawText: string): any[];
  export function evaluateProduct(options: Record<string, any>): any;
  export function compareProducts(productA: any, productB: any, sharedOptions?: Record<string, any>): any;
  export function normalizeBarcodeInput(rawBarcode: any): { valid: boolean; code: string };
  export const VERIFIED_BARCODE_CATALOG: Record<string, any>;
  export function lookupBarcodeProduct(options?: Record<string, any>): any;
  export function createCustomBarcodeEntry(options?: Record<string, any>): any;
}
