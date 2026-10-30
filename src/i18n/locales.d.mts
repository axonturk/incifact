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
