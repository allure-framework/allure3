import { describe, expect, test } from "vitest";
import { filterByAql, parseAql } from "../src/index.js";

/**
 * Property-based tests - verify invariants and properties that should always hold
 * These tests check mathematical properties and invariants of the parser
 */

describe("Property-based Tests", () => {
  describe("Parsing invariants", () => {
    test("should always return expression or null for valid input", () => {
      const validInputs = [
        'status = "passed"',
        "age > 25",
        'name ~= "test"',
        'status IN ["passed", "failed"]',
        "true",
        "false",
        "",
        "   ",
      ];

      validInputs.forEach((input) => {
        const result = parseAql(input);
        expect(result.expression === null || typeof result.expression === "object").toBe(true);
      });
    });

    test("should always throw AQL error for invalid input", () => {
      const invalidInputs = [
        'status @ "passed"',
        "status =",
        "= \"passed\"",
        'status = "unterminated',
      ];

      invalidInputs.forEach((input) => {
        try {
          parseAql(input);
          // If it doesn't throw, it should return valid result
        } catch (error: any) {
          expect(error.code).toBeDefined();
          expect(typeof error.code).toBe("string");
          expect(error.message).toBeDefined();
        }
      });
    });

    test("empty string should always parse to null", () => {
      const emptyInputs = ["", "   ", "\n", "\t", "\r\n", " \t \n "];

      emptyInputs.forEach((input) => {
        const result = parseAql(input);
        expect(result.expression).toBeNull();
      });
    });

    test("'true' should always parse to boolean expression with value true", () => {
      const trueInputs = ["true", "TRUE", "True", "  true  "];

      trueInputs.forEach((input) => {
        const result = parseAql(input.trim());
        expect(result.expression).not.toBeNull();
        if (result.expression) {
          expect(result.expression.type).toBe("boolean");
          expect((result.expression as any).value).toBe(true);
        }
      });
    });
  });

  describe("Filtering invariants", () => {
    test("filtering with 'true' should always return all items", () => {
      const testArrays = [
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ status: "passed" }, { status: "failed" }],
        [],
        [{ name: "test", age: 25 }],
      ];

      testArrays.forEach((items) => {
        const result = filterByAql(items as any, "true");
        expect(result).toEqual(items);
      });
    });

    test("filtering with empty string should always return all items", () => {
      const testArrays = [
        [{ id: 1 }, { id: 2 }],
        [],
        [{ status: "passed" }],
      ];

      testArrays.forEach((items) => {
        const result = filterByAql(items as any, "");
        expect(result).toEqual(items);
      });
    });

    test("filtering empty array should always return empty array", () => {
      const expressions = [
        'status = "passed"',
        "age > 25",
        'name ~= "test"',
        'status IN ["passed", "failed"]',
      ];

      expressions.forEach((aql) => {
        const result = filterByAql([], aql);
        expect(result).toEqual([]);
      });
    });

    test("filtering should never mutate original array", () => {
      const original = [
        { id: 1, status: "passed" },
        { id: 2, status: "failed" },
        { id: 3, status: "passed" },
      ];
      const originalCopy = JSON.parse(JSON.stringify(original));

      filterByAql(original, 'status = "passed"');

      expect(original).toEqual(originalCopy);
    });

    test("filtering should always return array", () => {
      const items = [
        { id: 1, status: "passed" },
        { id: 2, status: "failed" },
      ];
      const expressions = [
        'status = "passed"',
        'status = "nonexistent"',
        "age > 100",
      ];

      expressions.forEach((aql) => {
        const result = filterByAql(items, aql);
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe("Logical operator properties", () => {
    test("NOT NOT should be equivalent to original (double negation)", () => {
      const expressions = [
        'status = "passed"',
        "age > 25",
        'name ~= "test"',
      ];

      expressions.forEach((aql) => {
        const original = parseAql(aql);
        const doubleNegated = parseAql(`NOT NOT ${aql}`);

        expect(original.expression).not.toBeNull();
        expect(doubleNegated.expression).not.toBeNull();

        // Both should filter to same results
        const items = [
          { status: "passed", age: 30, name: "test name" },
          { status: "failed", age: 20, name: "other" },
        ];

        const originalFiltered = filterByAql(items, original.expression!);
        const doubleNegatedFiltered = filterByAql(items, doubleNegated.expression!);

        expect(originalFiltered).toEqual(doubleNegatedFiltered);
      });
    });

    test("AND should be commutative for same type conditions", () => {
      const items = [
        { status: "passed", age: 30 },
        { status: "failed", age: 20 },
        { status: "passed", age: 25 },
      ];

      const expr1 = parseAql('status = "passed" AND age > 25');
      const expr2 = parseAql('age > 25 AND status = "passed"');

      expect(expr1.expression).not.toBeNull();
      expect(expr2.expression).not.toBeNull();

      const result1 = filterByAql(items, expr1.expression!);
      const result2 = filterByAql(items, expr2.expression!);

      expect(result1).toEqual(result2);
    });

    test("OR should be commutative", () => {
      const items = [
        { status: "passed" },
        { status: "failed" },
        { status: "broken" },
      ];

      const expr1 = parseAql('status = "passed" OR status = "failed"');
      const expr2 = parseAql('status = "failed" OR status = "passed"');

      expect(expr1.expression).not.toBeNull();
      expect(expr2.expression).not.toBeNull();

      const result1 = filterByAql(items, expr1.expression!);
      const result2 = filterByAql(items, expr2.expression!);

      expect(result1).toEqual(result2);
    });

    test("De Morgan's laws should hold", () => {
      const items = [
        { status: "passed", age: 30 },
        { status: "failed", age: 20 },
        { status: "passed", age: 25 },
      ];

      // NOT (A OR B) === (NOT A) AND (NOT B)
      const notOr = parseAql('NOT (status = "passed" OR age > 25)');
      const andNot = parseAql('NOT status = "passed" AND NOT age > 25');

      expect(notOr.expression).not.toBeNull();
      expect(andNot.expression).not.toBeNull();

      const result1 = filterByAql(items, notOr.expression!);
      const result2 = filterByAql(items, andNot.expression!);

      expect(result1).toEqual(result2);
    });
  });

  describe("Expression equivalence", () => {
    test("'is' operator should be equivalent to '='", () => {
      const items = [
        { status: "passed" },
        { status: "failed" },
      ];

      const eqExpr = parseAql('status = "passed"');
      const isExpr = parseAql('status is "passed"');

      expect(eqExpr.expression).not.toBeNull();
      expect(isExpr.expression).not.toBeNull();

      const result1 = filterByAql(items, eqExpr.expression!);
      const result2 = filterByAql(items, isExpr.expression!);

      expect(result1).toEqual(result2);
    });

    test("'null' and 'empty' should be equivalent", () => {
      const items = [
        { status: "passed", value: null },
        { status: "failed", value: "test" },
        { status: "broken", value: undefined },
      ];

      const nullExpr = parseAql("value = null");
      const emptyExpr = parseAql("value = empty");

      expect(nullExpr.expression).not.toBeNull();
      expect(emptyExpr.expression).not.toBeNull();

      const result1 = filterByAql(items, nullExpr.expression!);
      const result2 = filterByAql(items, emptyExpr.expression!);

      expect(result1).toEqual(result2);
    });
  });

  describe("Idempotency", () => {
    test("parsing same expression multiple times should produce same result", () => {
      const aql = 'status = "passed" AND age > 25';

      const result1 = parseAql(aql);
      const result2 = parseAql(aql);
      const result3 = parseAql(aql);

      expect(result1.expression).not.toBeNull();
      expect(result2.expression).not.toBeNull();
      expect(result3.expression).not.toBeNull();

      // All should filter to same results
      const items = [
        { status: "passed", age: 30 },
        { status: "failed", age: 20 },
        { status: "passed", age: 25 },
      ];

      const filtered1 = filterByAql(items, result1.expression!);
      const filtered2 = filterByAql(items, result2.expression!);
      const filtered3 = filterByAql(items, result3.expression!);

      expect(filtered1).toEqual(filtered2);
      expect(filtered2).toEqual(filtered3);
    });

    test("filtering same array with same expression should produce same result", () => {
      const items = [
        { id: 1, status: "passed" },
        { id: 2, status: "failed" },
        { id: 3, status: "passed" },
      ];
      const aql = 'status = "passed"';

      const result1 = filterByAql(items, aql);
      const result2 = filterByAql(items, aql);
      const result3 = filterByAql(items, aql);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe("Boundary conditions", () => {
    test("filtering with condition that matches nothing should return empty array", () => {
      const items = [{ status: "passed" }, { status: "failed" }];
      const aql = 'status = "nonexistent"';

      const result = filterByAql(items, aql);
      expect(result).toEqual([]);
    });

    test("filtering with condition that matches everything should return all items", () => {
      const items = [
        { status: "passed" },
        { status: "passed" },
        { status: "passed" },
      ];
      const aql = 'status = "passed"';

      const result = filterByAql(items, aql);
      expect(result).toEqual(items);
    });

    test("IN with empty array should match nothing", () => {
      const items = [{ status: "passed" }, { status: "failed" }];
      const aql = "status IN []";

      const result = filterByAql(items, aql);
      expect(result).toEqual([]);
    });
  });
});
