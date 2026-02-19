/**
 * Creates a null-prototype dictionary for externally keyed string maps.
 * This prevents collisions with Object.prototype keys like `constructor` or `__proto__`.
 */
export const createDictionary = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;
