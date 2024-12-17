export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
export const isString = (value: unknown): value is string => typeof value === "string";
export const isArray = <T = unknown>(value: unknown): value is T[] => Array.isArray(value);
export const isNonNullObject = <T extends object = object>(value: unknown): value is T =>
  typeof value === "object" && value !== null;

export function ensureBoolean(value: unknown): boolean | undefined;
export function ensureBoolean(value: unknown, fallback: boolean): boolean;
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ensureBoolean(value: unknown, fallback?: boolean) {
  return isBoolean(value) ? value : fallback;
}

export const ensureInt = (obj: unknown): number | undefined => {
  if (typeof obj === "number") {
    return obj;
  }
  const stringValue = ensureString(obj);
  if (!stringValue) {
    return undefined;
  }

  const parsed = parseInt(stringValue, 10);
  return isNaN(parsed) ? undefined : parsed;
};

export function ensureString(value: unknown): string | undefined;
export function ensureString(value: unknown, fallback: string): string;
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ensureString(value: unknown, fallback?: string) {
  return isString(value) ? value : fallback;
}

export function ensureArray<T = unknown>(value: unknown): T[] | undefined;
export function ensureArray<T = unknown>(value: unknown, fallback: T[]): T[];
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ensureArray<T = unknown>(value: unknown, fallback?: T[]) {
  return isArray<T>(value) ? value : fallback;
}

export function ensureObject<T extends object = object>(value: unknown): T | undefined;
export function ensureObject<T extends object = object>(value: unknown, fallback: T): T;
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ensureObject<T extends object = object>(value: unknown, fallback?: T) {
  return isNonNullObject(value) ? value : fallback;
}
