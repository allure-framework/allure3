import { describe, expect, it } from "vitest";

import { ensureArray, ensureBoolean, ensureInt, ensureObject, ensureString } from "../src/utils.js";

describe("reader utility helpers", () => {
  describe("ensureBoolean", () => {
    it("should keep boolean values and fall back for non-boolean values", () => {
      expect(ensureBoolean(true)).toBe(true);
      expect(ensureBoolean(false)).toBe(false);
      expect(ensureBoolean("true")).toBeUndefined();
      expect(ensureBoolean("true", true)).toBe(true);
    });
  });

  describe("ensureInt", () => {
    it("should parse numbers and integer-like strings", () => {
      expect(ensureInt(42)).toBe(42);
      expect(ensureInt("42")).toBe(42);
      expect(ensureInt("42px")).toBe(42);
      expect(ensureInt("nope")).toBeUndefined();
    });
  });

  describe("ensureString", () => {
    it("should keep strings and fall back for non-string values", () => {
      expect(ensureString("value")).toBe("value");
      expect(ensureString(42)).toBeUndefined();
      expect(ensureString(42, "fallback")).toBe("fallback");
    });
  });

  describe("ensureArray", () => {
    it("should keep arrays and fall back for non-array values", () => {
      expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(ensureArray("value")).toBeUndefined();
      expect(ensureArray("value", ["fallback"])).toEqual(["fallback"]);
    });
  });

  describe("ensureObject", () => {
    it("should keep non-null objects and fall back otherwise", () => {
      expect(ensureObject({ foo: "bar" })).toEqual({ foo: "bar" });
      expect(ensureObject(null)).toBeUndefined();
      expect(ensureObject(["not", "object"])).toEqual(["not", "object"]);
      expect(ensureObject(undefined, { fallback: true })).toEqual({ fallback: true });
    });
  });
});
