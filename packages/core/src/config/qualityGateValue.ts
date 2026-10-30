/** Keep computed values reportable, and convert CEL integers without losing precision. */
export const qualityGateValue = (input: unknown, convertIntegers = false): unknown => {
  const ancestors = new Set<object>();
  const copy = (value: unknown): unknown => {
    if (typeof value === "bigint" && convertIntegers) {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) {
        throw new Error("CEL integer exceeds JavaScript's safe integer range");
      }
      return number;
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return value;
    }
    if (typeof value !== "object" || value === null || ancestors.has(value)) {
      throw new Error("expected JSON-compatible data without cycles");
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map(copy);
      }
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        throw new Error("expected plain JSON-compatible objects");
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
    } finally {
      ancestors.delete(value);
    }
  };
  return copy(input);
};
