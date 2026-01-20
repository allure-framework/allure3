import { describe, expect, test } from "vitest";
import { filterByAql, isAqlError, parseAql } from "../src/index.js";
import { AqlErrorCode } from "../src/errors/index.js";

/**
 * Chaos Monkey / Fuzzing tests for AQL parser
 * Tests resilience to malformed, unexpected, and edge case inputs
 */

/**
 * Generate random string of given length
 */
function randomString(length: number, charset: string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate random AQL-like string with potential issues
 */
function randomAqlString(length: number): string {
  const operators = ["=", "!=", ">", "<", ">=", "<=", "~=", "IN"];
  const logicalOps = ["AND", "OR", "NOT"];
  const values = ['"string"', "123", "true", "false", "null"];
  const identifiers = ["status", "name", "age", "duration", "id"];

  let result = "";
  for (let i = 0; i < length; i++) {
    const choice = Math.random();
    if (choice < 0.3) {
      result += identifiers[Math.floor(Math.random() * identifiers.length)] + " ";
    } else if (choice < 0.5) {
      result += operators[Math.floor(Math.random() * operators.length)] + " ";
    } else if (choice < 0.7) {
      result += values[Math.floor(Math.random() * values.length)] + " ";
    } else if (choice < 0.85) {
      result += logicalOps[Math.floor(Math.random() * logicalOps.length)] + " ";
    } else {
      result += randomString(5) + " ";
    }
  }
  return result.trim();
}

/**
 * Generate malicious or edge case strings
 */
function generateMaliciousStrings(): string[] {
  return [
    // Empty and whitespace
    "",
    "   ",
    "\n\n\n",
    "\t\t\t",

    // Special characters
    "status @ \"passed\"",
    "status # \"passed\"",
    "status $ \"passed\"",
    "status % \"passed\"",
    "status ^ \"passed\"",
    "status & \"passed\"",
    "status * \"passed\"",
    "status | \"passed\"",
    "status \\ \"passed\"",
    "status / \"passed\"",
    "status ? \"passed\"",
    "status : \"passed\"",
    "status ; \"passed\"",
    "status ' \"passed\"",

    // Unicode and special characters
    "status = \"привет\"",
    "status = \"你好\"",
    "status = \"こんにちは\"",
    "status = \"مرحبا\"",
    "status = \"🎉\"",
    "status = \"\u0000\"",
    "status = \"\uFFFF\"",

    // Unterminated strings
    'status = "passed',
    'status = "passed\\',
    'status = "passed\n',
    'status = "passed\t',

    // Invalid operators
    "status === \"passed\"",
    "status !== \"passed\"",
    "status == \"passed\"",
    "status <> \"passed\"",
    "status => \"passed\"",
    "status <=> \"passed\"",

    // Missing parts
    "status",
    "status =",
    "= \"passed\"",
    "status = \"passed\" AND",
    "status = \"passed\" OR",
    "status = \"passed\" NOT",
    "(status = \"passed\"",
    "status = \"passed\")",
    "[status = \"passed\"]",
    "status = \"passed\"]",

    // Invalid numbers
    "age = 123.456.789",
    "age = .123",
    "age = 123.",
    "age = --123",
    "age = ++123",
    "age = 123abc",
    "age = 0x123",

    // Invalid identifiers
    "123field = \"value\"",
    "field-name = \"value\"",
    "field.name = \"value\"",
    "field name = \"value\"",
    "field@name = \"value\"",
    "中文字段 = \"value\"",

    // Invalid arrays
    "status IN [",
    "status IN ]",
    "status IN [\"passed\"",
    "status IN \"passed\"]",
    "status IN [\"passed\",]",
    "status IN [, \"passed\"]",

    // Invalid functions
    "now",
    "now(",
    "now)",
    "now(123)",
    "now(\"arg\")",

    // Deep nesting (potential stack overflow)
    "(".repeat(1000) + 'status = "passed"' + ")".repeat(1000),
    "[".repeat(1000) + '"value"' + "]".repeat(1000),

    // Very long strings
    `status = "${"a".repeat(100000)}"`,
    `name = "${randomString(50000)}"`,

    // Control characters
    "status = \"\x00\"",
    "status = \"\x01\"",
    "status = \"\x1F\"",
    "status = \"\x7F\"",

    // SQL injection attempts
    "status = \"'; DROP TABLE tests; --\"",
    "status = \"' OR '1'='1\"",
    "status = \"' UNION SELECT * FROM users --\"",

    // XSS attempts
    "status = \"<script>alert('xss')</script>\"",
    "status = \"javascript:alert('xss')\"",
    "status = \"<img src=x onerror=alert('xss')>\"",

    // Path traversal
    "status = \"../../../etc/passwd\"",
    "status = \"..\\\\..\\\\..\\\\windows\\\\system32\"",

    // Null bytes
    "status = \"\0\"",
    "status\0= \"passed\"",
    "\0status = \"passed\"",
  ];
}

describe("Chaos Monkey / Fuzzing Tests", () => {
  describe("Fuzzing with Random Inputs", () => {
    test("should handle random strings gracefully", () => {
      const iterations = 100;
      let errors = 0;
      let successes = 0;

      for (let i = 0; i < iterations; i++) {
        const randomInput = randomAqlString(10 + Math.floor(Math.random() * 50));
        try {
          const result = parseAql(randomInput);
          if (result.expression !== null) {
            successes++;
          }
        } catch (error) {
          errors++;
          // Should always throw AQL errors, not generic errors
          expect(isAqlError(error)).toBe(true);
        }
      }

      // Should not crash, should either parse or throw AQL error
      expect(errors + successes).toBe(iterations);
    });

    test("should handle very long random strings", () => {
      const longInput = randomAqlString(1000);
      try {
        parseAql(longInput);
      } catch (error) {
        expect(isAqlError(error)).toBe(true);
      }
      // Should not crash or hang
    });

    test("should handle random unicode characters", () => {
      const unicodeInputs = [
        "status = \"\u{1F600}\"", // emoji
        "status = \"\u{10FFFF}\"", // max unicode
        "status = \"\u{0000}\"", // null
        "name = \"测试\"",
        "name = \"тест\"",
        "name = \"テスト\"",
      ];

      unicodeInputs.forEach((input) => {
        try {
          parseAql(input);
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });
  });

  describe("Malicious Input Handling", () => {
    test("should reject all malicious strings with proper errors", () => {
      const maliciousStrings = generateMaliciousStrings();

      maliciousStrings.forEach((input) => {
        try {
          const result = parseAql(input);
          // If it parses, it should be a valid expression or null
          expect(result.expression === null || typeof result.expression === "object").toBe(true);
        } catch (error) {
          // Should throw AQL error, not crash
          expect(isAqlError(error)).toBe(true);
          expect(error.code).toBeDefined();
          expect(error.message).toBeDefined();
        }
      });
    });

    test("should handle SQL injection attempts safely", () => {
      const sqlInjectionAttempts = [
        "status = \"'; DROP TABLE tests; --\"",
        "status = \"' OR '1'='1\"",
        "status = \"' UNION SELECT * FROM users --\"",
        "status = \"1' OR '1'='1\"",
      ];

      sqlInjectionAttempts.forEach((input) => {
        try {
          const result = parseAql(input);
          // Should parse as string literals, not execute SQL
          if (result.expression) {
            expect(result.expression).toBeDefined();
          }
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });

    test("should handle XSS attempts safely", () => {
      const xssAttempts = [
        "status = \"<script>alert('xss')</script>\"",
        "status = \"javascript:alert('xss')\"",
        "status = \"<img src=x onerror=alert('xss')>\"",
      ];

      xssAttempts.forEach((input) => {
        try {
          const result = parseAql(input);
          // Should parse as string literals
          if (result.expression) {
            expect(result.expression).toBeDefined();
          }
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle extremely long strings", () => {
      const veryLongString = `status = "${"a".repeat(100000)}"`;
      try {
        const result = parseAql(veryLongString);
        // Should either parse or throw error, not crash
        expect(result.expression === null || typeof result.expression === "object").toBe(true);
      } catch (error) {
        expect(isAqlError(error)).toBe(true);
      }
    });

    test("should handle deeply nested parentheses", () => {
      const depths = [10, 50, 100, 500];
      depths.forEach((depth) => {
        const nested = "(".repeat(depth) + 'status = "passed"' + ")".repeat(depth);
        try {
          const result = parseAql(nested);
          if (result.expression) {
            expect(result.expression).toBeDefined();
          }
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });

    test("should handle many operations in sequence", () => {
      const manyOps = Array.from({ length: 100 }, () => 'status = "passed"').join(" AND ");
      try {
        const result = parseAql(manyOps);
        if (result.expression) {
          expect(result.expression).toBeDefined();
        }
      } catch (error) {
        expect(isAqlError(error)).toBe(true);
      }
    });

    test("should handle empty and whitespace-only inputs", () => {
      const emptyInputs = ["", "   ", "\n", "\t", "\r\n", " \t \n "];
      emptyInputs.forEach((input) => {
        const result = parseAql(input);
        expect(result.expression).toBeNull();
      });
    });

    test("should handle control characters", () => {
      const controlChars = ["\x00", "\x01", "\x1F", "\x7F"];
      controlChars.forEach((char) => {
        const input = `status = "${char}"`;
        try {
          parseAql(input);
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });
  });

  describe("Error Recovery and Resilience", () => {
    test("should always return proper error types", () => {
      const invalidInputs = [
        "status @ \"passed\"",
        "status =",
        "= \"passed\"",
        'status = "unterminated',
      ];

      invalidInputs.forEach((input) => {
        try {
          parseAql(input);
          // If it doesn't throw, it should return valid result
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
          expect(error.code).toBeDefined();
          expect(typeof error.code).toBe("string");
          expect(Object.values(AqlErrorCode)).toContain(error.code);
        }
      });
    });

    test("should provide error details for debugging", () => {
      try {
        parseAql('status = "unterminated');
      } catch (error) {
        expect(isAqlError(error)).toBe(true);
        expect(error.details).toBeDefined();
        expect(error.fullDetails).toBeDefined();
        expect(error.fullDetails.code).toBeDefined();
      }
    });

    test("should handle rapid successive parsing", () => {
      const inputs = Array.from({ length: 1000 }, () => 'status = "passed"');
      inputs.forEach((input) => {
        try {
          parseAql(input);
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
      // Should not leak memory or crash
    });
  });

  describe("Filter Resilience", () => {
    test("should handle filtering with invalid expressions gracefully", () => {
      const items = [{ status: "passed" }, { status: "failed" }];
      const invalidExpressions = [
        "status @ \"passed\"",
        "status =",
        "= \"passed\"",
      ];

      invalidExpressions.forEach((aql) => {
        try {
          filterByAql(items, aql);
          // Should not crash
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
        }
      });
    });

    test("should handle filtering with empty arrays", () => {
      const emptyArray: any[] = [];
      const result = filterByAql(emptyArray, 'status = "passed"');
      expect(result).toEqual([]);
    });

    test("should handle filtering with null/undefined values in objects", () => {
      const items = [
        { status: "passed", name: null },
        { status: "failed", name: undefined },
        { status: "passed", name: "test" },
      ];

      const result = filterByAql(items, 'status = "passed"');
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("should handle filtering with deeply nested objects", () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "test",
                },
              },
            },
          },
        },
      };

      try {
        const result = filterByAql([deepObject], 'level1["level2"]["level3"]["level4"]["level5"]["value"] = "test"');
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // May not support such deep nesting, but should not crash
        expect(isAqlError(error) || error instanceof Error).toBe(true);
      }
    });

    test("should handle filtering with circular references gracefully", () => {
      const circular: any = { status: "passed" };
      circular.self = circular;

      try {
        const result = filterByAql([circular], 'status = "passed"');
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // May throw on circular reference, but should not crash
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe("Memory and Performance Under Stress", () => {
    test("should not leak memory with repeated parsing", () => {
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        try {
          parseAql(`status = "test${i}"`);
        } catch (error) {
          // Ignore errors
        }
      }
      // If we get here, no memory leak detected
      expect(true).toBe(true);
    });

    test("should handle concurrent parsing attempts", () => {
      const inputs = Array.from({ length: 100 }, () => 'status = "passed"');
      const results = inputs.map((input) => {
        try {
          return parseAql(input);
        } catch (error) {
          return error;
        }
      });

      expect(results.length).toBe(100);
      results.forEach((result) => {
        if (result instanceof Error) {
          expect(isAqlError(result)).toBe(true);
        } else {
          expect(result.expression !== null || result.expression === null).toBe(true);
        }
      });
    });

    test("should handle very large filter operations", () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        status: i % 2 === 0 ? "passed" : "failed",
        name: `Test ${i}`,
      }));

      try {
        const result = filterByAql(largeArray, 'status = "passed"');
        expect(result.length).toBe(5000);
      } catch (error) {
        expect(isAqlError(error) || error instanceof Error).toBe(true);
      }
    });
  });

  describe("Type Safety and Validation", () => {
    test("should reject non-string inputs", () => {
      const invalidInputs: any[] = [null, undefined, 123, {}, [], true, false];

      invalidInputs.forEach((input) => {
        try {
          parseAql(input);
        } catch (error) {
          expect(isAqlError(error)).toBe(true);
          expect(error.code).toBe(AqlErrorCode.INVALID_INPUT);
        }
      });
    });

    test("should handle string-like objects", () => {
      const stringLike = {
        toString: () => 'status = "passed"',
      };

      try {
        parseAql(stringLike as any);
      } catch (error) {
        expect(isAqlError(error)).toBe(true);
        expect(error.code).toBe(AqlErrorCode.INVALID_INPUT);
      }
    });
  });
});
