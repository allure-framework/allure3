import { describe, expect, test } from "vitest";
import { parseAql } from "../src/parser/index.js";
import { expressionToString } from "../src/utils/index.js";

/**
 * Round-trip tests - verify that parse → stringify → parse produces equivalent results
 * Tests that AST can be correctly serialized and deserialized
 */

describe("Round-trip Tests", () => {
  describe("Simple expressions", () => {
    test("should round-trip simple equality", () => {
      const original = 'status = "passed"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip with different operators", () => {
      const operators = [">", ">=", "<", "<=", "!=", "~="];
      for (const op of operators) {
        const original = `age ${op} 25`;
        const parsed = parseAql(original);
        expect(parsed.expression).not.toBeNull();

        const stringified = expressionToString(parsed.expression!);
        const reparsed = parseAql(stringified);

        expect(reparsed.expression).not.toBeNull();
        expect(stringified).toBe(original);
      }
    });

    test("should round-trip with 'is' operator", () => {
      const original = 'status is "passed"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      // 'is' is converted to '=' during parsing, so we expect '=' in output
      expect(stringified).toBe('status = "passed"');

      const reparsed = parseAql(stringified);
      expect(reparsed.expression).not.toBeNull();
    });
  });

  describe("Logical operators", () => {
    test("should round-trip AND expression", () => {
      const original = 'status = "passed" AND age > 25';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip OR expression", () => {
      const original = 'status = "passed" OR status = "failed"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip NOT expression", () => {
      const original = 'NOT status = "passed"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip complex logical expression", () => {
      const original = 'status = "passed" AND (age > 25 OR duration < 100)';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Parentheses", () => {
    test("should round-trip expression with parentheses", () => {
      const original = '(status = "passed")';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip nested parentheses", () => {
      const original = '((status = "passed"))';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Array conditions", () => {
    test("should round-trip IN expression", () => {
      const original = 'status IN ["passed", "failed", "broken"]';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip IN with mixed types", () => {
      const original = 'value IN ["string", 123, true, null]';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip empty array", () => {
      const original = "status IN []";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Accessors", () => {
    test("should round-trip accessor with string key", () => {
      const original = 'cf["Custom Field"] = "value"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip accessor with number index", () => {
      const original = 'items[0] = "test"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Value types", () => {
    test("should round-trip string values", () => {
      const original = 'name = "test string"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip string values with escape sequences", () => {
      const original = 'name = "test\\"quote"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip number values", () => {
      const original = "age = 25";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip negative numbers", () => {
      const original = "value = -10";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip decimal numbers", () => {
      const original = "value = 3.14";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip boolean values", () => {
      const original = "active = true";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip null values", () => {
      const original = "status = null";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Boolean expressions", () => {
    test("should round-trip standalone true", () => {
      const original = "true";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip standalone false", () => {
      const original = "false";
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Complex expressions", () => {
    test("should round-trip very complex expression", () => {
      const original =
        '(status = "passed" OR status = "failed") AND (age > 25 AND age < 50) AND name ~= "test" AND duration < 500';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });

    test("should round-trip expression with multiple NOT operators", () => {
      const original = 'NOT NOT status = "passed"';
      const parsed = parseAql(original);
      expect(parsed.expression).not.toBeNull();

      const stringified = expressionToString(parsed.expression!);
      const reparsed = parseAql(stringified);

      expect(reparsed.expression).not.toBeNull();
      expect(stringified).toBe(original);
    });
  });

  describe("Semantic equivalence", () => {
    test("should produce semantically equivalent expressions", () => {
      const expressions = [
        'status = "passed"',
        'status is "passed"', // 'is' should be equivalent to '='
      ];

      const parsed1 = parseAql(expressions[0]);
      const parsed2 = parseAql(expressions[1]);

      // Both should parse to equivalent AST structures
      expect(parsed1.expression).not.toBeNull();
      expect(parsed2.expression).not.toBeNull();

      // Stringified versions should be the same (both use '=')
      const stringified1 = expressionToString(parsed1.expression!);
      const stringified2 = expressionToString(parsed2.expression!);
      expect(stringified1).toBe(stringified2);
    });

    test("should handle null and empty keywords equivalently", () => {
      const expressions = ["status = null", "status = empty"];

      const parsed1 = parseAql(expressions[0]);
      const parsed2 = parseAql(expressions[1]);

      expect(parsed1.expression).not.toBeNull();
      expect(parsed2.expression).not.toBeNull();

      // Both should stringify to "null"
      const stringified1 = expressionToString(parsed1.expression!);
      const stringified2 = expressionToString(parsed2.expression!);
      expect(stringified1).toBe("status = null");
      expect(stringified2).toBe("status = null");
    });
  });
});
