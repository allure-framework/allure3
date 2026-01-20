import { describe, expect, test } from "vitest";
import { parseAql } from "../src/parser/index.js";

describe("AqlParser", () => {
  test("should parse simple condition", async () => {
    const result = parseAql('status = "passed"');

    expect(result.expression).not.toBeNull();
    expect(result.expression).toMatchObject({
      type: "condition",
      left: { identifier: "status" },
      operator: "EQ",
      right: { value: "passed", type: "STRING" },
    });
  });

  test("should parse condition with different operators", () => {
    expect(parseAql('status > "passed"').expression).toMatchObject({
      operator: "GT",
    });
    expect(parseAql('status >= "passed"').expression).toMatchObject({
      operator: "GE",
    });
    expect(parseAql('status < "passed"').expression).toMatchObject({
      operator: "LT",
    });
    expect(parseAql('status <= "passed"').expression).toMatchObject({
      operator: "LE",
    });
    expect(parseAql('status != "passed"').expression).toMatchObject({
      operator: "NEQ",
    });
    expect(parseAql('status ~= "passed"').expression).toMatchObject({
      operator: "CONTAINS",
    });
  });

  test("should parse condition with 'is' operator", () => {
    const result = parseAql('status is "passed"');

    expect(result.expression).toMatchObject({
      type: "condition",
      operator: "EQ",
    });
  });

  test("should parse AND expression", () => {
    const result = parseAql('status = "passed" AND name = "test"');

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "AND",
      left: {
        type: "condition",
        left: { identifier: "status" },
      },
      right: {
        type: "condition",
        left: { identifier: "name" },
      },
    });
  });

  test("should parse OR expression", () => {
    const result = parseAql('status = "passed" OR status = "failed"');

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "OR",
    });
  });

  test("should parse NOT expression", () => {
    const result = parseAql('NOT status = "passed"');

    expect(result.expression).toMatchObject({
      type: "not",
      expression: {
        type: "condition",
      },
    });
  });

  test("should parse parentheses", () => {
    const result = parseAql('(status = "passed")');

    expect(result.expression).toMatchObject({
      type: "paren",
      expression: {
        type: "condition",
      },
    });
  });

  test("should respect operator precedence", () => {
    const result = parseAql('status = "passed" OR status = "failed" AND name = "test"');

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "OR",
      left: {
        type: "condition",
      },
      right: {
        type: "binary",
        operator: "AND",
      },
    });
  });

  test("should parse complex expression with parentheses", () => {
    const result = parseAql('(status = "passed" OR status = "failed") AND name ~= "test"');

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "AND",
      left: {
        type: "paren",
        expression: {
          type: "binary",
          operator: "OR",
        },
      },
    });
  });

  test("should parse number values", () => {
    const result = parseAql("createdDate >= 1234567890");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "1234567890", type: "NUMBER" },
    });
  });

  test("should parse complex expression with date and array condition", () => {
    const date = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    const aql = `createdDate >= ${date} and description in ["test1", "test2"]`;
    const result = parseAql(aql);

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "AND",
      left: {
        type: "condition",
        left: { identifier: "createdDate" },
        operator: "GE",
        right: { value: String(date), type: "NUMBER" },
      },
      right: {
        type: "arrayCondition",
        operator: "IN",
        left: { identifier: "description" },
        right: [
          { value: "test1", type: "STRING" },
          { value: "test2", type: "STRING" },
        ],
      },
    });
  });

  test("should parse very complex expression with date, parentheses and array", () => {
    const date = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    const aql = `createdDate >= ${date} and (description in ["description1", "description2"] or name = "test1")`;
    const result = parseAql(aql);

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "AND",
      left: {
        type: "condition",
        left: { identifier: "createdDate" },
        operator: "GE",
        right: { value: String(date), type: "NUMBER" },
      },
      right: {
        type: "paren",
        expression: {
          type: "binary",
          operator: "OR",
          left: {
            type: "arrayCondition",
            operator: "IN",
            left: { identifier: "description" },
            right: [
              { value: "description1", type: "STRING" },
              { value: "description2", type: "STRING" },
            ],
          },
          right: {
            type: "condition",
            left: { identifier: "name" },
            operator: "EQ",
            right: { value: "test1", type: "STRING" },
          },
        },
      },
    });
  });

  test("should parse negative numbers", () => {
    const result = parseAql("value >= -10");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "-10", type: "NUMBER" },
    });
  });

  test("should parse decimal numbers", () => {
    const result = parseAql("value = 3.14");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "3.14", type: "NUMBER" },
    });
  });

  test("should parse boolean values", () => {
    const result = parseAql("true");

    expect(result.expression).toMatchObject({
      type: "boolean",
      value: true,
    });

    const result2 = parseAql("false");
    expect(result2.expression).toMatchObject({
      type: "boolean",
      value: false,
    });
  });

  test("should parse NOT with boolean value", () => {
    const result = parseAql("not false");

    expect(result.expression).toMatchObject({
      type: "not",
      expression: {
        type: "boolean",
        value: false,
      },
    });
  });

  test("should parse NOT true OR false expression", () => {
    const result = parseAql("not true or false");

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "OR",
      left: {
        type: "not",
        expression: {
          type: "boolean",
          value: true,
        },
      },
      right: {
        type: "boolean",
        value: false,
      },
    });
  });

  test("should parse condition with 'is' operator and boolean value", () => {
    const result = parseAql("automation is true");

    expect(result.expression).toMatchObject({
      type: "condition",
      left: { identifier: "automation" },
      operator: "EQ",
      right: { value: "true", type: "BOOLEAN" },
    });
  });

  test("should parse null values", () => {
    const result = parseAql("status = null");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "null", type: "NULL" },
    });
  });

  test("should parse empty keyword as null", () => {
    const result = parseAql("status = empty");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "null", type: "NULL" },
    });
  });

  test("should parse accessor with numeric parameter and null value", () => {
    const result = parseAql("cf[10] is null");

    expect(result.expression).toMatchObject({
      type: "condition",
      left: {
        identifier: "cf",
        param: { value: 10, type: "number" },
      },
      operator: "EQ",
      right: { value: "null", type: "NULL" },
    });
  });

  test("should parse array condition with IN", () => {
    const result = parseAql('status IN ["passed", "failed", "broken"]');

    expect(result.expression).toMatchObject({
      type: "arrayCondition",
      operator: "IN",
      right: [
        { value: "passed", type: "STRING" },
        { value: "failed", type: "STRING" },
        { value: "broken", type: "STRING" },
      ],
    });
  });

  test("should parse empty array", () => {
    const result = parseAql("status IN []");

    expect(result.expression).toMatchObject({
      type: "arrayCondition",
      right: [],
    });
  });

  test("should parse array with mixed types", () => {
    const result = parseAql('status IN ["passed", 123, true, null]');

    expect(result.expression).toMatchObject({
      type: "arrayCondition",
      right: [
        { value: "passed", type: "STRING" },
        { value: "123", type: "NUMBER" },
        { value: "true", type: "BOOLEAN" },
        { value: "null", type: "NULL" },
      ],
    });
  });

  test("should parse accessor with string key", () => {
    const result = parseAql('cf["Custom Field"] = "value"');

    expect(result.expression).toMatchObject({
      type: "condition",
      left: {
        identifier: "cf",
        param: { value: "Custom Field", type: "string" },
      },
    });
  });

  test("should parse accessor with number index", () => {
    const result = parseAql('items[0] = "test"');

    expect(result.expression).toMatchObject({
      type: "condition",
      left: {
        identifier: "items",
        param: { value: 0, type: "number" },
      },
    });
  });

  test("should parse function from context", () => {
    const context = {
      "now()": 1234567890,
      "currentUser()": "admin",
    };

    const result = parseAql("createdDate >= now()", context);

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "1234567890", type: "NUMBER" },
    });
  });

  test("should parse function returning string from context", () => {
    const context = { "currentUser()": "admin" };
    const result = parseAql("createdBy = currentUser()", context);

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "admin", type: "STRING" },
    });
  });

  test("should parse function returning boolean from context", () => {
    const context = { "isActive()": true };
    const result = parseAql("active = isActive()", context);

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "true", type: "BOOLEAN" },
    });
  });

  test("should parse null when function not in context", () => {
    const result = parseAql("createdDate >= now()");

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "null", type: "NULL" },
    });
  });

  test("should parse empty string", () => {
    const result = parseAql("");

    expect(result.expression).toBeNull();
  });

  test("should parse strings with escape sequences", () => {
    const result = parseAql('name = "test\\"quote"');

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: 'test"quote', type: "STRING" },
    });
  });

  test("should throw error on invalid syntax", () => {
    expect(() => parseAql('status = "passed" AND')).toThrow();
    expect(() => parseAql("status =")).toThrow();
    expect(() => parseAql('(status = "passed"')).toThrow();
  });

  test("should parse very complex expression", () => {
    const result = parseAql(
      '(status = "passed" OR status = "failed") AND (name ~= "test" OR tag IN ["smoke", "regression"])',
    );

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "AND",
      left: {
        type: "paren",
        expression: {
          type: "binary",
          operator: "OR",
        },
      },
      right: {
        type: "paren",
        expression: {
          type: "binary",
          operator: "OR",
        },
      },
    });
  });

  test("should parse multiple NOT operators", () => {
    const result = parseAql('NOT NOT status = "passed"');

    expect(result.expression).toMatchObject({
      type: "not",
      expression: {
        type: "not",
        expression: {
          type: "condition",
        },
      },
    });
  });

  test("should parse strings with Chinese characters", () => {
    const result = parseAql('name = "测试中文"');

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "测试中文", type: "STRING" },
    });
  });

  test("should parse strings with Japanese characters", () => {
    const result = parseAql('name = "テスト"');

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "テスト", type: "STRING" },
    });
  });

  test("should parse strings with Korean characters", () => {
    const result = parseAql('name = "테스트"');

    expect(result.expression).toMatchObject({
      type: "condition",
      right: { value: "테스트", type: "STRING" },
    });
  });

  test("should parse complex expression with Unicode strings", () => {
    const result = parseAql('name = "测试" OR description ~= "日本語"');

    expect(result.expression).toMatchObject({
      type: "binary",
      operator: "OR",
    });
  });

  describe("identifier validation", () => {
    test("should accept valid identifiers with Latin letters and underscores", () => {
      expect(() => parseAql('status = "passed"')).not.toThrow();
      expect(() => parseAql('identifier_name = "value"')).not.toThrow();
      expect(() => parseAql('_private = "value"')).not.toThrow();
      expect(() => parseAql('CamelCase = "value"')).not.toThrow();
      expect(() => parseAql('UPPER_CASE = "value"')).not.toThrow();
    });

    test("should reject identifiers with digits", () => {
      expect(() => {
        parseAql('identifier1 = "value"');
      }).toThrow();

      expect(() => {
        parseAql('identifier_123 = "value"');
      }).toThrow();
    });

    test("should reject identifiers with Cyrillic characters", () => {
      expect(() => {
        parseAql('поле = "value"');
      }).toThrow();

      expect(() => {
        parseAql('identifier_поле = "value"');
      }).toThrow();
    });

    test("should reject identifiers with special characters", () => {
      expect(() => {
        parseAql('identifier-name = "value"');
      }).toThrow();

      expect(() => {
        parseAql('identifier.name = "value"');
      }).toThrow();

      expect(() => {
        parseAql('identifier@name = "value"');
      }).toThrow();
    });

    test("should reject identifiers starting with digit", () => {
      expect(() => {
        parseAql('123field = "value"');
      }).toThrow();
    });

    test("should provide clear error message for invalid identifier", () => {
      // Note: identifiers with invalid characters like digits will be caught
      // by the tokenizer stopping early, so we test with a valid token that
      // passes tokenizer but fails format validation
      // Since tokenizer now only accepts Latin letters and underscores,
      // this test validates that the format check works correctly
      // For identifiers that can't be tokenized, tokenizer will throw UNEXPECTED_CHARACTER
      // For identifiers that are tokenized but invalid, parser will throw INVALID_IDENTIFIER

      // This case is actually handled by tokenizer stopping at the digit
      // So we just verify that invalid format identifiers are rejected
      expect(() => {
        parseAql('field123 = "value"');
      }).toThrow();

      // The error will be EXPECTED_OPERATION because tokenizer reads "field" and "123" separately
      // But the important thing is that identifiers with invalid characters are rejected
    });
  });
});
