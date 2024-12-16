export const isString = (value: unknown): value is string => typeof value === "string";
export const isArray = <T = unknown>(value: unknown): value is Array<T> => Array.isArray(value);
export const isNonNullObject = <T extends object = object>(value: unknown): value is T => typeof value === "object" && value !== null;

export function ensureString(value: unknown): string | undefined
export function ensureString(value: unknown, fallback: string): string
export function ensureString(value: unknown, fallback?: string) {
  return typeof value === "string" ? value : fallback;
}

export function ensureArray<T = unknown>(value: unknown): Array<T> | undefined
export function ensureArray<T = unknown>(value: unknown, fallback: Array<T>): Array<T>
export function ensureArray<T = unknown>(value: unknown, fallback?: Array<T>) {
  return isArray<T>(value) ? value : fallback;
}

export function ensureObject<T extends object = object>(value: unknown): T | undefined
export function ensureObject<T extends object = object>(value: unknown, fallback: T): T
export function ensureObject<T extends object = object>(value: unknown, fallback?: T) {
  return isNonNullObject(value) ? value : fallback;
}
