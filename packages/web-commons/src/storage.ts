export function loadFromLocalStorage<T>(key: string, defaultValue: T): T;
export function loadFromLocalStorage<T>(key: string): T | undefined;
export function loadFromLocalStorage<T>(key: string, defaultValue?: T): T | undefined {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}
