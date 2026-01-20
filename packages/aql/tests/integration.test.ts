import { describe, expect, test } from "vitest";
import { filterByAql, parseAql } from "../src/index.js";

/**
 * Integration tests - test full workflow from AQL string to filtered results
 * Tests interaction between tokenizer, parser, and filter components
 */

interface TestItem {
  id: number;
  name: string;
  status: string;
  age: number;
  duration: number;
  tags: string[];
  metadata?: {
    priority?: string;
    component?: string;
    [key: string]: any;
  };
}

const testItems: TestItem[] = [
  { id: 1, name: "Login test", status: "passed", age: 25, duration: 150, tags: ["smoke", "regression"] },
  { id: 2, name: "Logout test", status: "failed", age: 30, duration: 200, tags: ["smoke"] },
  { id: 3, name: "API test", status: "passed", age: 35, duration: 100, tags: ["smoke", "api"] },
  { id: 4, name: "UI test", status: "broken", age: 20, duration: 300, tags: ["regression"] },
  { id: 5, name: "E2E test", status: "passed", age: 28, duration: 500, tags: ["e2e"] },
];

describe("Integration Tests", () => {
  describe("Full workflow: Parse → Filter", () => {
    test("should parse and filter simple condition", () => {
      const aql = 'status = "passed"';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(3);
      expect(filtered.every((item) => item.status === "passed")).toBe(true);
    });

    test("should parse and filter complex expression with AND", () => {
      const aql = 'status = "passed" AND age > 25';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(2);
      expect(filtered.every((item) => item.status === "passed" && item.age > 25)).toBe(true);
    });

    test("should parse and filter complex expression with OR", () => {
      const aql = 'status = "passed" OR status = "failed"';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(4);
      expect(filtered.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
    });

    test("should parse and filter with parentheses", () => {
      const aql = '(status = "passed" OR status = "failed") AND age >= 25';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(4);
      expect(filtered.every((item) => (item.status === "passed" || item.status === "failed") && item.age >= 25)).toBe(
        true,
      );
    });

    test("should parse and filter with IN operator", () => {
      const aql = 'status IN ["passed", "failed"]';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(4);
      expect(filtered.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
    });

    test("should parse and filter with nested property access", () => {
      const itemsWithNested = [
        { id: 1, metadata: { priority: "High", component: "Auth" } },
        { id: 2, metadata: { priority: "Low", component: "UI" } },
        { id: 3, metadata: { priority: "High", component: "API" } },
      ];

      const aql = 'metadata["priority"] = "High"';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(itemsWithNested, parseResult.expression!);

      expect(filtered.length).toBe(2);
      expect(filtered.every((item) => item.metadata?.priority === "High")).toBe(true);
    });

    test("should parse and filter with context functions", () => {
      const context = { "minAge()": 25 };
      const aql = "age >= minAge()";
      const parseResult = parseAql(aql, context);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(4);
      expect(filtered.every((item) => item.age >= 25)).toBe(true);
    });
  });

  describe("Error propagation through layers", () => {
    test("should propagate tokenizer errors correctly", () => {
      const invalidAql = 'status @ "passed"'; // Invalid operator

      expect(() => {
        const parseResult = parseAql(invalidAql);
        filterByAql(testItems, parseResult.expression!);
      }).toThrow();
    });

    test("should propagate parser errors correctly", () => {
      const invalidAql = "status ="; // Incomplete expression

      expect(() => {
        const parseResult = parseAql(invalidAql);
        filterByAql(testItems, parseResult.expression!);
      }).toThrow();
    });

    test("should handle empty expression gracefully", () => {
      const emptyAql = "";
      const parseResult = parseAql(emptyAql);

      expect(parseResult.expression).toBeNull();
      const filtered = filterByAql(testItems, emptyAql);

      // Empty AQL should return all items
      expect(filtered).toEqual(testItems);
    });
  });

  describe("Real-world scenarios", () => {
    test("should handle complex filtering scenario", () => {
      const aql = '(status = "passed" OR status = "failed") AND (age >= 25 AND age <= 35) AND duration < 400';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      // Expected: id 1 (passed, 25, 150), id 2 (failed, 30, 200), id 3 (passed, 35, 100), id 5 (passed, 28, 500) - but 500 > 400, so exclude
      expect(filtered.length).toBe(3);
      expect(filtered.map((item) => item.id)).toEqual([1, 2, 3]);
    });

    test("should handle multiple filters on same dataset", () => {
      const queries = ['status = "passed"', 'status = "failed"', "age > 25", 'status IN ["passed", "failed"]'];

      const results = queries.map((aql) => {
        const parseResult = parseAql(aql);
        return filterByAql(testItems, parseResult.expression!);
      });

      expect(results[0].length).toBe(3); // passed
      expect(results[1].length).toBe(1); // failed
      expect(results[2].length).toBe(3); // age > 25 (id: 2, 3, 5)
      expect(results[3].length).toBe(4); // status IN ["passed", "failed"]
    });

    test("should handle filter with NOT operator", () => {
      const aql = 'NOT status = "passed"';
      const parseResult = parseAql(aql);

      expect(parseResult.expression).not.toBeNull();
      const filtered = filterByAql(testItems, parseResult.expression!);

      expect(filtered.length).toBe(2);
      expect(filtered.every((item) => item.status !== "passed")).toBe(true);
    });
  });

  describe("Data consistency", () => {
    test("should maintain data integrity through parse-filter cycle", () => {
      const aql = 'status = "passed" AND age > 25';
      const parseResult = parseAql(aql);
      const filtered = filterByAql(testItems, parseResult.expression!);

      // Verify original data is not mutated
      expect(testItems.length).toBe(5);
      expect(testItems[0].status).toBe("passed");
      expect(testItems[1].status).toBe("failed");

      // Verify filtered results are correct
      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe(3);
      expect(filtered[1].id).toBe(5);
    });

    test("should handle objects with missing properties", () => {
      const itemsWithMissing = [
        { id: 1, status: "passed" }, // missing age
        { id: 2, status: "failed", age: 30 },
        { id: 3, status: "passed", age: 35 },
      ];

      const aql = "age > 25";
      const parseResult = parseAql(aql);
      const filtered = filterByAql(itemsWithMissing, parseResult.expression!);

      // Items without age should be filtered out
      expect(filtered.length).toBe(2);
      expect(filtered.every((item) => (item as any).age > 25)).toBe(true);
    });
  });
});
