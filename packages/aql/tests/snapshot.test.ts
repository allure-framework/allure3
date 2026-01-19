import { describe, expect, test } from "vitest";
import { parseAql } from "../src/index.js";

/**
 * Snapshot tests - verify that AST structure doesn't change unexpectedly
 * These tests help catch accidental changes in AST structure during refactoring
 */

describe("Snapshot Tests", () => {
  describe("Simple expressions", () => {
    test("simple equality condition", () => {
      const result = parseAql('status = "passed"');
      expect(result.expression).toMatchSnapshot();
    });

    test("simple comparison condition", () => {
      const result = parseAql("age > 25");
      expect(result.expression).toMatchSnapshot();
    });

    test("contains condition", () => {
      const result = parseAql('name ~= "test"');
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Logical operators", () => {
    test("AND expression", () => {
      const result = parseAql('status = "passed" AND age > 25');
      expect(result.expression).toMatchSnapshot();
    });

    test("OR expression", () => {
      const result = parseAql('status = "passed" OR status = "failed"');
      expect(result.expression).toMatchSnapshot();
    });

    test("NOT expression", () => {
      const result = parseAql('NOT status = "passed"');
      expect(result.expression).toMatchSnapshot();
    });

    test("multiple NOT operators", () => {
      const result = parseAql('NOT NOT status = "passed"');
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Parentheses", () => {
    test("single parentheses", () => {
      const result = parseAql('(status = "passed")');
      expect(result.expression).toMatchSnapshot();
    });

    test("nested parentheses", () => {
      const result = parseAql('((status = "passed"))');
      expect(result.expression).toMatchSnapshot();
    });

    test("complex parentheses expression", () => {
      const result = parseAql('(status = "passed" OR status = "failed") AND name ~= "test"');
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Array conditions", () => {
    test("IN with string array", () => {
      const result = parseAql('status IN ["passed", "failed", "broken"]');
      expect(result.expression).toMatchSnapshot();
    });

    test("IN with mixed types", () => {
      const result = parseAql('value IN ["string", 123, true, null]');
      expect(result.expression).toMatchSnapshot();
    });

    test("IN with empty array", () => {
      const result = parseAql("status IN []");
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Accessors", () => {
    test("accessor with string key", () => {
      const result = parseAql('cf["Custom Field"] = "value"');
      expect(result.expression).toMatchSnapshot();
    });

    test("accessor with number index", () => {
      const result = parseAql('items[0] = "test"');
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Value types", () => {
    test("string value", () => {
      const result = parseAql('name = "test string"');
      expect(result.expression).toMatchSnapshot();
    });

    test("number value", () => {
      const result = parseAql("age = 25");
      expect(result.expression).toMatchSnapshot();
    });

    test("negative number", () => {
      const result = parseAql("value = -10");
      expect(result.expression).toMatchSnapshot();
    });

    test("decimal number", () => {
      const result = parseAql("value = 3.14");
      expect(result.expression).toMatchSnapshot();
    });

    test("boolean value", () => {
      const result = parseAql("active = true");
      expect(result.expression).toMatchSnapshot();
    });

    test("null value", () => {
      const result = parseAql("status = null");
      expect(result.expression).toMatchSnapshot();
    });

    test("empty keyword", () => {
      const result = parseAql("status = empty");
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Boolean expressions", () => {
    test("standalone true", () => {
      const result = parseAql("true");
      expect(result.expression).toMatchSnapshot();
    });

    test("standalone false", () => {
      const result = parseAql("false");
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Complex expressions", () => {
    test("very complex expression", () => {
      const result = parseAql(
        '(status = "passed" OR status = "failed") AND (age > 25 AND age < 50) AND name ~= "test" AND duration < 500',
      );
      expect(result.expression).toMatchSnapshot();
    });

    test("expression with all operators", () => {
      const result = parseAql(
        'status = "passed" AND age > 25 AND duration >= 100 AND count <= 10 AND name != "test" AND description ~= "search"',
      );
      expect(result.expression).toMatchSnapshot();
    });

    test("expression with functions", () => {
      const context = { "now()": 1234567890, "currentUser()": "admin" };
      const result = parseAql("createdDate >= now() AND createdBy = currentUser()", context);
      expect(result.expression).toMatchSnapshot();
    });
  });

  describe("Edge cases", () => {
    test("string with escape sequences", () => {
      const result = parseAql('name = "test\\"quote\\nnewline"');
      expect(result.expression).toMatchSnapshot();
    });

    test("string with Unicode characters", () => {
      const result = parseAql('name = "测试中文"');
      expect(result.expression).toMatchSnapshot();
    });

    test("very long identifier", () => {
      const longId = "a".repeat(100);
      const result = parseAql(`${longId} = "value"`);
      expect(result.expression).toMatchSnapshot();
    });
  });
});
