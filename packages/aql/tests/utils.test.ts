import { describe, expect, test } from "vitest";
import { parseAql } from "../src/parser/index.js";
import { expressionToString, includesAll } from "../src/utils/index.js";

describe("includesAll", () => {
  test("should return true for empty string", () => {
    expect(includesAll("")).toBe(true);
    expect(includesAll("   ")).toBe(true);
  });

  test("should return true for null or undefined", () => {
    expect(includesAll(null)).toBe(true);
    expect(includesAll(undefined)).toBe(true);
  });

  test("should return true for 'true'", () => {
    expect(includesAll("true")).toBe(true);
    expect(includesAll("TRUE")).toBe(true);
    expect(includesAll("True")).toBe(true);
  });

  test("should return false for other values", () => {
    expect(includesAll('status = "passed"')).toBe(false);
    expect(includesAll("false")).toBe(false);
    expect(includesAll("null")).toBe(false);
  });
});

describe("expressionToString", () => {
  test("should convert simple condition to string", () => {
    const parsed = parseAql('status = "passed"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('status = "passed"');
  });

  test("should convert condition with different operators", () => {
    expect(expressionToString(parseAql('status > "passed"').expression!)).toBe('status > "passed"');
    expect(expressionToString(parseAql('status >= "passed"').expression!)).toBe('status >= "passed"');
    expect(expressionToString(parseAql('status < "passed"').expression!)).toBe('status < "passed"');
    expect(expressionToString(parseAql('status <= "passed"').expression!)).toBe('status <= "passed"');
    expect(expressionToString(parseAql('status != "passed"').expression!)).toBe('status != "passed"');
    expect(expressionToString(parseAql('status ~= "passed"').expression!)).toBe('status ~= "passed"');
  });

  test("should convert AND expression to string", () => {
    const parsed = parseAql('status = "passed" AND name = "test"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('status = "passed" AND name = "test"');
  });

  test("should convert OR expression to string", () => {
    const parsed = parseAql('status = "passed" OR status = "failed"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('status = "passed" OR status = "failed"');
  });

  test("should convert NOT expression to string", () => {
    const parsed = parseAql('NOT status = "passed"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('NOT status = "passed"');
  });

  test("should convert parentheses to string", () => {
    const parsed = parseAql('(status = "passed")');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('(status = "passed")');
  });

  test("should convert boolean expression to string", () => {
    expect(expressionToString(parseAql("true").expression!)).toBe("true");
    expect(expressionToString(parseAql("false").expression!)).toBe("false");
  });

  test("should convert array condition to string", () => {
    const parsed = parseAql('status IN ["passed", "failed", "broken"]');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('status IN ["passed", "failed", "broken"]');
  });

  test("should convert accessor with string key to string", () => {
    const parsed = parseAql('cf["Custom Field"] = "value"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('cf["Custom Field"] = "value"');
  });

  test("should convert accessor with number index to string", () => {
    const parsed = parseAql('items[0] = "test"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('items[0] = "test"');
  });

  test("should convert null value to string", () => {
    const parsed = parseAql("status = null");
    const result = expressionToString(parsed.expression!);

    expect(result).toBe("status = null");
  });

  test("should convert number value to string", () => {
    const parsed = parseAql("createdDate >= 1234567890");
    const result = expressionToString(parsed.expression!);

    expect(result).toBe("createdDate >= 1234567890");
  });

  test("should convert complex expression to string", () => {
    const parsed = parseAql('(status = "passed" OR status = "failed") AND name ~= "test"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('(status = "passed" OR status = "failed") AND name ~= "test"');
  });

  test("should handle strings with quotes in expressionToString", () => {
    const parsed = parseAql('name = "test\\"quote"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('name = "test\\"quote"');
  });

  test("should handle strings with backslashes in expressionToString", () => {
    const parsed = parseAql('name = "test\\\\backslash"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('name = "test\\\\backslash"');
  });

  test("should handle accessor with string key containing backslashes", () => {
    const parsed = parseAql('cf["test\\\\backslash"] = "value"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('cf["test\\\\backslash"] = "value"');
  });

  test("should handle accessor with string key containing both backslashes and quotes", () => {
    const parsed = parseAql('cf["test\\\\backslash\\"quote"] = "value"');
    const result = expressionToString(parsed.expression!);

    expect(result).toBe('cf["test\\\\backslash\\"quote"] = "value"');
  });
});
