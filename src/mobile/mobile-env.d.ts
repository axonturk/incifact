declare const __DEV__: boolean | undefined;
declare var require: (id: string) => any;

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
  export const Image: any;
  export const StatusBar: any;
  export const ActivityIndicator: any;
  export const KeyboardAvoidingView: any;
  export const Vibration: any;
  export const Platform: any;
  export function useColorScheme(): 'light' | 'dark' | null | undefined;
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
    multiRemove(keys: string[]): Promise<void>;
  };
  export default AsyncStorage;
}

declare module 'expo-image-picker' {
  export function requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  export function requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  export function launchCameraAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
  export function launchImageLibraryAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
}

declare module 'expo-camera' {
  export const CameraView: any;
  export const Camera: {
    requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
    getCameraPermissionsAsync?(): Promise<{ granted: boolean }>;
  };
}

declare module 'expo-file-system' {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;
  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;
}

declare module 'expo-secure-store' {
  export function getItemAsync(key: string, options?: Record<string, any>): Promise<string | null>;
  export function setItemAsync(key: string, value: string, options?: Record<string, any>): Promise<void>;
  export function deleteItemAsync(key: string, options?: Record<string, any>): Promise<void>;
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
  export function isValidGs1CheckDigit(digits: string): boolean;
  export const VERIFIED_BARCODE_CATALOG: Record<string, any>;
  export function lookupBarcodeProduct(options?: Record<string, any>): any;
  export function createCustomBarcodeEntry(options?: Record<string, any>): any;
  export function evaluateHouseholdProfiles(evalOptions: Record<string, any>, members?: any[]): any;
  export function evaluateRoutineShelf(shelfItems?: any[], sharedOptions?: Record<string, any>): any;
  export function findCleanerAlternativesAndDupes(currentEvalOrInput: any, options?: Record<string, any>): any;
  export function getIngredientDossier(obsOrRaw: any, options?: Record<string, any>): any;
}
