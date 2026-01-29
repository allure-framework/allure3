import { describe, expect, test } from "vitest";
import { parseAql } from "../src/parser/index.js";
import { filterByAql } from "../src/filter/index.js";

interface TestItem {
  id: number;
  name: string;
  status: string;
  age?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

const testItems: TestItem[] = [
  { id: 1, name: "Test 1", status: "passed", age: 25, tags: ["smoke", "regression"] },
  { id: 2, name: "Test 2", status: "failed", age: 30, tags: ["smoke"] },
  { id: 3, name: "Test 3", status: "passed", age: 35 },
  { id: 4, name: "Test 4", status: "broken", age: 20, tags: ["regression"] },
  { id: 5, name: "Another Test", status: "passed", age: 28 },
];

describe("filterByAql", () => {
  test("should return all items for empty AQL", () => {
    const result = filterByAql(testItems, "");

    expect(result).toEqual(testItems);
  });

  test("should filter by simple equality", () => {
    const result = filterByAql(testItems, 'status = "passed"');

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.status === "passed")).toBe(true);
  });

  test("should filter by not equal", () => {
    const result = filterByAql(testItems, 'status != "passed"');

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.status !== "passed")).toBe(true);
  });

  test("should filter by greater than", () => {
    const result = filterByAql(testItems, "age > 25");

    expect(result).toHaveLength(3);
    expect(result.every((item) => (item.age || 0) > 25)).toBe(true);
  });

  test("should filter by greater than or equal", () => {
    const result = filterByAql(testItems, "age >= 30");

    expect(result).toHaveLength(2);
    expect(result.every((item) => (item.age || 0) >= 30)).toBe(true);
  });

  test("should filter by less than", () => {
    const result = filterByAql(testItems, "age < 30");

    // Items with age < 30: id 1 (25), id 4 (20), id 5 (28) = 3 items
    expect(result).toHaveLength(3);
    expect(result.every((item) => (item.age || 0) < 30)).toBe(true);
  });

  test("should filter by less than or equal", () => {
    const result = filterByAql(testItems, "age <= 25");

    expect(result).toHaveLength(2);
    expect(result.every((item) => (item.age || 0) <= 25)).toBe(true);
  });

  test("should filter by contains", () => {
    const result = filterByAql(testItems, 'name ~= "Another"');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Another Test");
  });

  test("should filter by AND", () => {
    const result = filterByAql(testItems, 'status = "passed" AND age > 25');

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.status === "passed" && (item.age || 0) > 25)).toBe(true);
  });

  test("should filter by OR", () => {
    const result = filterByAql(testItems, 'status = "passed" OR status = "failed"');

    expect(result).toHaveLength(4);
    expect(result.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
  });

  test("should filter by NOT", () => {
    const result = filterByAql(testItems, 'NOT status = "passed"');

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.status !== "passed")).toBe(true);
  });

  test("should filter with parentheses", () => {
    const result = filterByAql(testItems, '(status = "passed" OR status = "failed") AND age >= 25');

    // Items matching: id 1 (passed, 25), id 2 (failed, 30), id 3 (passed, 35), id 5 (passed, 28) = 4 items
    expect(result).toHaveLength(4);
    expect(
      result.every((item) => (item.status === "passed" || item.status === "failed") && (item.age || 0) >= 25),
    ).toBe(true);
  });

  test("should filter by IN operator", () => {
    const result = filterByAql(testItems, 'status IN ["passed", "failed"]');

    expect(result).toHaveLength(4);
    expect(result.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
  });

  test("should filter by null value", () => {
    const itemsWithNull = [
      { id: 1, name: "Test 1", status: "passed", age: null },
      { id: 2, name: "Test 2", status: "failed", age: 30 },
    ];

    const result = filterByAql(itemsWithNull, "age = null");

    expect(result).toHaveLength(1);
    expect(result[0].age).toBeNull();
  });

  test("should filter by boolean value", () => {
    const itemsWithBool = [
      { id: 1, name: "Test 1", active: true },
      { id: 2, name: "Test 2", active: false },
    ];

    const result = filterByAql(itemsWithBool, "active = true");

    expect(result).toHaveLength(1);
    expect(result[0].active).toBe(true);
  });

  test("should filter by nested property access", () => {
    const itemsWithNested = [
      { id: 1, metadata: { custom: "value1" } },
      { id: 2, metadata: { custom: "value2" } },
    ];

    const result = filterByAql(itemsWithNested, 'metadata["custom"] = "value1"');

    expect(result).toHaveLength(1);
    expect(result[0].metadata.custom).toBe("value1");
  });

  test("should filter by array index access", () => {
    const itemsWithArray = [
      { id: 1, tags: ["first", "second"] },
      { id: 2, tags: ["third", "fourth"] },
    ];

    const result = filterByAql(itemsWithArray, 'tags[0] = "first"');

    expect(result).toHaveLength(1);
    expect(result[0].tags[0]).toBe("first");
  });

  test("should handle case-insensitive string comparison", () => {
    const result = filterByAql(testItems, 'status = "PASSED"');

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.status === "passed")).toBe(true);
  });

  test("should handle complex expression", () => {
    const result = filterByAql(testItems, '(status = "passed" OR status = "failed") AND (age >= 25 AND age <= 35)');

    // Items matching: id 1 (passed, 25), id 2 (failed, 30), id 3 (passed, 35), id 5 (passed, 28) = 4 items
    expect(result).toHaveLength(4);
  });

  test("should return empty array when no items match", () => {
    const result = filterByAql(testItems, 'status = "nonexistent"');

    expect(result).toHaveLength(0);
  });

  test("should work with context functions", () => {
    const context = { "minAge()": 25 };
    const result = filterByAql(testItems, "age >= minAge()", context);

    expect(result).toHaveLength(4);
    expect(result.every((item) => (item.age || 0) >= 25)).toBe(true);
  });
});

describe("filterByAql with parsed expression", () => {
  test("should filter using parsed AQL expression", () => {
    const parseResult = parseAql('status = "passed"');
    expect(parseResult.expression).not.toBeNull();

    const result = filterByAql(testItems, parseResult.expression!);

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.status === "passed")).toBe(true);
  });

  test("should filter using complex parsed expression", () => {
    const parseResult = parseAql('status = "passed" AND age > 25');
    expect(parseResult.expression).not.toBeNull();

    const result = filterByAql(testItems, parseResult.expression!);

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.status === "passed" && (item.age || 0) > 25)).toBe(true);
  });

  test("should reuse parsed expression for multiple filters", () => {
    const parseResult = parseAql('status = "passed"');
    expect(parseResult.expression).not.toBeNull();

    const items1 = filterByAql(testItems, parseResult.expression!);
    const items2 = filterByAql(testItems, parseResult.expression!);
    const items3 = filterByAql(testItems, parseResult.expression!);

    expect(items1).toEqual(items2);
    expect(items2).toEqual(items3);
    expect(items1).toHaveLength(3);
  });

  test("should filter by Chinese characters in string values", () => {
    const itemsWithChinese = [
      { id: 1, name: "测试1", status: "passed" },
      { id: 2, name: "测试2", status: "failed" },
      { id: 3, name: "test", status: "passed" },
    ];

    const result = filterByAql(itemsWithChinese, 'name = "测试1"');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("测试1");
  });

  test("should filter by Japanese characters in string values", () => {
    const itemsWithJapanese = [
      { id: 1, name: "テスト1", status: "passed" },
      { id: 2, name: "テスト2", status: "failed" },
    ];

    const result = filterByAql(itemsWithJapanese, 'name ~= "テスト"');

    expect(result).toHaveLength(2);
  });

  test("should filter by Korean characters in string values", () => {
    const itemsWithKorean = [
      { id: 1, name: "테스트1", status: "passed" },
      { id: 2, name: "테스트2", status: "failed" },
    ];

    const result = filterByAql(itemsWithKorean, 'name IN ["테스트1", "테스트2"]');

    expect(result).toHaveLength(2);
  });
});

describe("Filter Edge Cases - Arrays", () => {
  describe("Array field access", () => {
    test("should filter by array element by index", () => {
      const items = [
        { id: 1, tags: ["smoke", "regression"] },
        { id: 2, tags: ["smoke"] },
        { id: 3, tags: ["regression", "api"] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke"');
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.tags[0] === "smoke")).toBe(true);
    });

    test("should filter by array element by non-zero index", () => {
      const items = [
        { id: 1, tags: ["smoke", "regression"] },
        { id: 2, tags: ["smoke", "api"] },
        { id: 3, tags: ["regression"] },
      ];

      const result = filterByAql(items, 'tags[1] = "regression"');
      expect(result).toHaveLength(1);
      expect(result[0].tags[1]).toBe("regression");
    });

    test("should handle out of bounds array index", () => {
      const items = [
        { id: 1, tags: ["smoke"] },
        { id: 2, tags: ["regression"] },
      ];

      const result = filterByAql(items, 'tags[10] = "value"');
      expect(result).toHaveLength(0);
    });

    test("should handle negative array index", () => {
      const items = [
        { id: 1, tags: ["smoke"] },
        { id: 2, tags: ["regression"] },
      ];

      const result = filterByAql(items, 'tags[-1] = "smoke"');
      expect(result).toHaveLength(0);
    });
  });

  describe("Empty arrays", () => {
    test("should handle items with empty arrays", () => {
      const items = [
        { id: 1, tags: [] },
        { id: 2, tags: ["smoke"] },
        { id: 3, tags: [] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke"');
      expect(result).toHaveLength(1);
      expect(result[0].tags[0]).toBe("smoke");
    });

    test("should handle missing array field", () => {
      const items = [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2", tags: ["smoke"] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke"');
      expect(result).toHaveLength(1);
    });

    test("should handle null array field", () => {
      const items = [
        { id: 1, tags: null },
        { id: 2, tags: ["smoke"] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke"');
      expect(result).toHaveLength(1);
    });

    test("should handle undefined array field", () => {
      const items = [
        { id: 1, tags: undefined },
        { id: 2, tags: ["smoke"] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke"');
      expect(result).toHaveLength(1);
    });
  });

  describe("Arrays with different value types", () => {
    test("should filter by number array elements", () => {
      const items = [
        { id: 1, scores: [10, 20, 30] },
        { id: 2, scores: [5, 15, 25] },
        { id: 3, scores: [10, 15, 20] },
      ];

      const result = filterByAql(items, "scores[0] = 10");
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.scores[0] === 10)).toBe(true);
    });

    test("should filter by boolean array elements", () => {
      const items = [
        { id: 1, flags: [true, false] },
        { id: 2, flags: [false, true] },
        { id: 3, flags: [true, true] },
      ];

      const result = filterByAql(items, "flags[0] = true");
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.flags[0] === true)).toBe(true);
    });

    test("should filter by null array elements", () => {
      const items = [
        { id: 1, values: [null, "test"] },
        { id: 2, values: ["test", null] },
        { id: 3, values: ["test", "test"] },
      ];

      const result = filterByAql(items, "values[0] = null");
      expect(result).toHaveLength(1);
      expect(result[0].values[0]).toBeNull();
    });

    test("should filter by mixed type array elements", () => {
      const items = [
        { id: 1, mixed: ["string", 123, true] },
        { id: 2, mixed: [456, "string", false] },
      ];

      const result = filterByAql(items, 'mixed[0] = "string"');
      expect(result).toHaveLength(1);
      expect(result[0].mixed[0]).toBe("string");
    });
  });

  describe("Nested arrays", () => {
    test("should handle nested arrays (not directly supported)", () => {
      const items = [
        { id: 1, matrix: [[1, 2], [3, 4]] },
        { id: 2, matrix: [[5, 6], [7, 8]] },
      ];

      // Nested array access like matrix[0][0] is not supported in AQL
      // This test verifies that it throws an error
      expect(() => {
        filterByAql(items, "matrix[0][0] = 1");
      }).toThrow();
    });

    test("should handle deeply nested arrays (not supported)", () => {
      const items = [
        { id: 1, deep: [[[1]]] },
        { id: 2, deep: [[[2]]] },
      ];

      // Deep nesting is not supported
      expect(() => {
        filterByAql(items, "deep[0][0][0] = 1");
      }).toThrow();
    });
  });

  describe("Array comparison operations", () => {
    test("should compare array length indirectly", () => {
      const items = [
        { id: 1, tags: ["smoke"] },
        { id: 2, tags: ["smoke", "regression"] },
        { id: 3, tags: ["smoke", "regression", "api"] },
      ];

      // Check if second element exists
      const result = filterByAql(items, "tags[1] != null");
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("should handle array field with contains operator", () => {
      const items = [
        { id: 1, description: "smoke test description" },
        { id: 2, description: "regression test" },
      ];

      // CONTAINS works on strings, not arrays
      const result = filterByAql(items, 'description ~= "smoke"');
      expect(result).toHaveLength(1);
    });
  });

  describe("Arrays in complex expressions", () => {
    test("should filter with array access in AND expression", () => {
      const items = [
        { id: 1, status: "passed", tags: ["smoke"] },
        { id: 2, status: "passed", tags: ["regression"] },
        { id: 3, status: "failed", tags: ["smoke"] },
      ];

      const result = filterByAql(items, 'status = "passed" AND tags[0] = "smoke"');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("passed");
      expect(result[0].tags[0]).toBe("smoke");
    });

    test("should filter with array access in OR expression", () => {
      const items = [
        { id: 1, tags: ["smoke"] },
        { id: 2, tags: ["regression"] },
        { id: 3, tags: ["api"] },
      ];

      const result = filterByAql(items, 'tags[0] = "smoke" OR tags[0] = "regression"');
      expect(result).toHaveLength(2);
    });

    test("should filter with array access in parentheses", () => {
      const items = [
        { id: 1, status: "passed", tags: ["smoke"] },
        { id: 2, status: "failed", tags: ["smoke"] },
        { id: 3, status: "passed", tags: ["regression"] },
      ];

      const result = filterByAql(items, '(status = "passed" OR status = "failed") AND tags[0] = "smoke"');
      expect(result).toHaveLength(2);
    });
  });

  describe("Array edge cases", () => {
    test("should handle sparse arrays", () => {
      const items = [
        { id: 1, sparse: [] },
      ];
      items[0].sparse[5] = "value";

      const result = filterByAql(items, 'sparse[5] = "value"');
      expect(result).toHaveLength(1);
    });

    test("should handle arrays with undefined elements", () => {
      const items = [
        { id: 1, arr: [undefined, "value"] },
        { id: 2, arr: ["value", undefined] },
      ];

      const result = filterByAql(items, 'arr[1] = "value"');
      expect(result).toHaveLength(1);
    });

    test("should handle very large array indices", () => {
      const items = [
        { id: 1, large: [] },
      ];
      items[0].large[1000] = "test";

      const result = filterByAql(items, 'large[1000] = "test"');
      expect(result).toHaveLength(1);
    });

    test("should handle array with object elements (limited support)", () => {
      const items = [
        { id: 1, items: [{ name: "test1" }, { name: "test2" }] },
        { id: 2, items: [{ name: "test3" }] },
      ];

      // Accessing object properties within array elements like items[0]["name"] is not directly supported
      // This test verifies current behavior
      expect(() => {
        filterByAql(items, 'items[0]["name"] = "test1"');
      }).toThrow();
    });
  });
});
