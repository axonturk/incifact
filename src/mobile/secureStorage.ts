import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_JSON_DEPTH = 12;
const MAX_SECURE_STORE_BYTES = 1800;

function getUtf8ByteLength(str: string): number {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
  } catch {
    // Fallback below
  }
  return encodeURIComponent(str).replace(/%[0-9A-F]{2}/gi, 'x').length;
}

function getJsonDepth(val: unknown, depth = 0): number {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (val && typeof val === 'object') {
    const children = Array.isArray(val) ? val : Object.values(val);
    let maxD = depth;
    for (let i = 0; i < children.length; i++) {
      const cd = getJsonDepth(children[i], depth + 1);
      if (cd > maxD) maxD = cd;
      if (maxD > MAX_JSON_DEPTH) return maxD;
    }
    return maxD;
  }
  return depth;
}

function stripProtoKeys(val: unknown, depth = 0): any {
  if (depth > MAX_JSON_DEPTH) return null;
  if (Array.isArray(val)) {
    return val.map((item) => stripProtoKeys(item, depth + 1));
  }
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = stripProtoKeys(v, depth + 1);
    }
    return out;
  }
  return val;
}

export function safeParseBoundedJson<T>(raw: string | null | undefined): T | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 256 * 1024) return null;
  try {
    const parsed = JSON.parse(raw);
    if (getJsonDepth(parsed) > MAX_JSON_DEPTH) return null;
    return stripProtoKeys(parsed) as T;
  } catch {
    return null;
  }
}

interface NativeSecureStoreAdapter {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

function getNativeSecureStore(): NativeSecureStoreAdapter | null {
  try {
    const expoMod = (globalThis as any)?.expo?.modules?.ExpoSecureStore;
    if (
      expoMod &&
      typeof expoMod.getValueWithKeyAsync === 'function' &&
      typeof expoMod.setValueWithKeyAsync === 'function' &&
      typeof expoMod.deleteValueWithKeyAsync === 'function'
    ) {
      const accessibleOpt =
        expoMod.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY !== undefined
          ? { keychainAccessible: expoMod.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
          : {};
      return {
        getItemAsync: (k: string) => expoMod.getValueWithKeyAsync(k, {}),
        setItemAsync: (k: string, v: string) => expoMod.setValueWithKeyAsync(v, k, accessibleOpt),
        deleteItemAsync: (k: string) => expoMod.deleteValueWithKeyAsync(k, {})
      };
    }
  } catch {
    // Continue to NativeModules fallback below
  }
  try {
    // Dynamic property lookup preserves Metro safety when native SecureStore binary is absent
    const legacyBridge = (globalThis as any)?.__turboModuleProxy?.('ExpoSecureStore');
    if (
      legacyBridge &&
      typeof legacyBridge.getItemAsync === 'function' &&
      typeof legacyBridge.setItemAsync === 'function' &&
      typeof legacyBridge.deleteItemAsync === 'function'
    ) {
      return legacyBridge as NativeSecureStoreAdapter;
    }
  } catch {
    // Fallback to AsyncStorage when native ExpoSecureStore module is not linked
  }
  return null;
}

export async function readSensitiveJson<T>(storageKey: string): Promise<T | null> {
  const secureStore = getNativeSecureStore();
  if (secureStore) {
    try {
      const secKey = storageKey.replace(/[^a-zA-Z0-9._-]/g, '_');
      const secVal = await secureStore.getItemAsync(secKey);
      const parsedSec = safeParseBoundedJson<T>(secVal);
      if (parsedSec !== null) return parsedSec;
    } catch {
      // Fall back to AsyncStorage read below
    }
  }
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return safeParseBoundedJson<T>(raw);
  } catch {
    return null;
  }
}

export async function writeSensitiveJson(storageKey: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const secureStore = getNativeSecureStore();
  const secKey = storageKey.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (secureStore && getUtf8ByteLength(serialized) <= MAX_SECURE_STORE_BYTES) {
    try {
      await secureStore.setItemAsync(secKey, serialized);
      // Remove redundant plaintext AsyncStorage copy once encrypted key is safely written
      await AsyncStorage.removeItem(storageKey).catch(() => {});
      return;
    } catch {
      // Fall back to AsyncStorage below
    }
  }
  if (secureStore) {
    // Clear any stale SecureStore shadow copy before falling back to AsyncStorage
    await secureStore.deleteItemAsync(secKey).catch(() => {});
  }
  try {
    await AsyncStorage.setItem(storageKey, serialized);
  } catch {
    // Ignore quota/storage errors
  }
}

export async function clearAllSensitiveStorage(storageKeys: string[]): Promise<void> {
  const cleanKeys = Array.isArray(storageKeys) ? storageKeys.filter((k) => typeof k === 'string' && k.length > 0) : [];
  if (cleanKeys.length === 0) return;

  const secureStore = getNativeSecureStore();
  if (secureStore) {
    await Promise.allSettled(
      cleanKeys.map((k) => secureStore.deleteItemAsync(k.replace(/[^a-zA-Z0-9._-]/g, '_')))
    );
  }
  await AsyncStorage.multiRemove(cleanKeys).catch(() => {});
}
