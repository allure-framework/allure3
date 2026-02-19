import { describe, expect, it } from "vitest";
import { createDictionary } from "../../src/index.js";

describe("createDictionary", () => {
  it("creates object without prototype", () => {
    const dictionary = createDictionary<number>();

    expect(Object.getPrototypeOf(dictionary)).toBeNull();
  });

  it("treats prototype-like keys as regular data keys", () => {
    const dictionary = createDictionary<number>();

    dictionary.__proto__ = 1;
    dictionary.constructor = 2;
    dictionary.toString = 3;

    expect(dictionary.__proto__).toBe(1);
    expect(dictionary.constructor).toBe(2);
    expect(dictionary.toString).toBe(3);
  });
});
