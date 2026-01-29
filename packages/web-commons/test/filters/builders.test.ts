/* eslint-disable max-lines */
import { label } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildFieldFilters, buildFilterPredicate } from "../../src/filters/builders.js";
import type { Filter } from "../../src/filters/model.js";

describe("filters > builders", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("buildFieldFilters", () => {
    describe("single field filter", () => {
      test("should build AQL expression for string field with strict mode", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "status",
            value: "passed",
            type: "string",
            strict: true,
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          left: { identifier: "status" },
          operator: "EQ",
          right: { value: "passed", type: "STRING" },
        });
      });

      test("should build AQL expression for string field with non-strict mode", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "name",
            value: "test",
            type: "string",
            strict: false,
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          left: { identifier: "name" },
          operator: "CONTAINS",
          right: { value: "test", type: "STRING" },
        });
      });

      test("should build AQL expression for string field without strict (defaults to strict)", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "status",
            value: "passed",
            type: "string",
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          operator: "EQ",
        });
      });

      test("should build AQL expression for number field", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "age",
            value: 25,
            type: "number",
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          left: { identifier: "age" },
          operator: "EQ",
          right: { value: "25", type: "NUMBER" },
        });
      });

      test("should build AQL expression for boolean field (true)", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "flaky",
            value: true,
            type: "boolean",
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          left: { identifier: "flaky" },
          operator: "EQ",
          right: { value: "true", type: "BOOLEAN" },
        });
      });

      test("should build AQL expression for array field (strict mode - IN operator)", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "tags",
            value: ["smoke", "regression"],
            type: "array",
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "arrayCondition",
          left: { identifier: "tags" },
          operator: "IN",
          right: [
            { value: "smoke", type: "STRING" },
            { value: "regression", type: "STRING" },
          ],
        });
      });

      test("should build AQL expression for array field (non-strict mode - intersection)", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "tags",
            value: ["smoke", "regression"],
            type: "array",
            strict: false,
          },
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        // Should generate OR conditions for array intersection
        expect(result.type).toBe("binary");
        if (result.type === "binary") {
          expect(result.operator).toBe("OR");
        }
      });

      test("should throw error for empty array field", () => {
        const filter: Filter = {
          type: "field",
          value: {
            key: "tags",
            value: [],
            type: "array",
          },
          logicalOperator: "AND",
        };

        expect(() => buildFieldFilters([filter])).toThrow("ArrayField value cannot be empty");
      });
    });

    describe("multiple field filters", () => {
      test("should chain two filters with AND operator", () => {
        const filters: Filter[] = [
          {
            type: "field",
            value: {
              key: "status",
              value: "passed",
              type: "string",
            },
            logicalOperator: "AND",
          },
          {
            type: "field",
            value: {
              key: "name",
              value: "test",
              type: "string",
            },
            logicalOperator: "AND",
          },
        ];

        const result = buildFieldFilters(filters);

        expect(result).toMatchObject({
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

      test("should chain two filters with OR operator", () => {
        const filters: Filter[] = [
          {
            type: "field",
            value: {
              key: "status",
              value: "passed",
              type: "string",
            },
            logicalOperator: "OR",
          },
          {
            type: "field",
            value: {
              key: "status",
              value: "failed",
              type: "string",
            },
            logicalOperator: "OR",
          },
        ];

        const result = buildFieldFilters(filters);

        expect(result).toMatchObject({
          type: "binary",
          operator: "OR",
        });
      });

      test("should chain three filters with different operators", () => {
        const filters: Filter[] = [
          {
            type: "field",
            value: {
              key: "status",
              value: "passed",
              type: "string",
            },
            logicalOperator: "AND",
          },
          {
            type: "field",
            value: {
              key: "flaky",
              value: true,
              type: "boolean",
            },
            logicalOperator: "OR",
          },
          {
            type: "field",
            value: {
              key: "age",
              value: 25,
              type: "number",
            },
            logicalOperator: "AND",
          },
        ];

        const result = buildFieldFilters(filters);

        // First two are combined with first's operator (AND), then third is combined with third's operator (AND)
        expect(result).toMatchObject({
          type: "binary",
          operator: "AND",
          left: {
            type: "binary",
            operator: "AND", // First and second combined with first's operator
          },
        });
      });

      test("should chain multiple filters correctly", () => {
        const filters: Filter[] = [
          {
            type: "field",
            value: { key: "a", value: "1", type: "string" },
            logicalOperator: "AND",
          },
          {
            type: "field",
            value: { key: "b", value: "2", type: "string" },
            logicalOperator: "AND",
          },
          {
            type: "field",
            value: { key: "c", value: "3", type: "string" },
            logicalOperator: "AND",
          },
          {
            type: "field",
            value: { key: "d", value: "4", type: "string" },
            logicalOperator: "AND",
          },
        ];

        const result = buildFieldFilters(filters);

        // Should create nested binary expressions
        expect(result.type).toBe("binary");
        if (result.type === "binary") {
          expect(result.operator).toBe("AND");
        }
      });
    });

    describe("group filters", () => {
      test("should build AQL expression for single filter group", () => {
        const filter: Filter = {
          type: "group",
          value: [
            {
              type: "field",
              value: {
                key: "status",
                value: "passed",
                type: "string",
              },
              logicalOperator: "AND",
            },
          ],
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "condition",
          left: { identifier: "status" },
        });
      });

      test("should build AQL expression for group with multiple filters", () => {
        const filter: Filter = {
          type: "group",
          value: [
            {
              type: "field",
              value: { key: "status", value: "passed", type: "string" },
              logicalOperator: "AND",
            },
            {
              type: "field",
              value: { key: "flaky", value: true, type: "boolean" },
              logicalOperator: "AND",
            },
          ],
          logicalOperator: "AND",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "paren",
          expression: {
            type: "binary",
            operator: "AND",
          },
        });
      });

      test("should build AQL expression for nested groups", () => {
        const filter: Filter = {
          type: "group",
          value: [
            {
              type: "group",
              value: [
                {
                  type: "field",
                  value: { key: "status", value: "passed", type: "string" },
                  logicalOperator: "AND",
                },
              ],
              logicalOperator: "AND",
            },
            {
              type: "field",
              value: { key: "flaky", value: true, type: "boolean" },
              logicalOperator: "AND",
            },
          ],
          logicalOperator: "OR",
        };

        const result = buildFieldFilters([filter]);

        expect(result).toMatchObject({
          type: "paren",
          expression: {
            type: "binary",
            operator: "AND",
          },
        });
      });

      test("should throw error for empty group", () => {
        const filter: Filter = {
          type: "group",
          value: [],
          logicalOperator: "AND",
        };

        expect(() => buildFieldFilters([filter])).toThrow("buildFieldFilters: value array cannot be empty");
      });
    });

    describe("mixed filters", () => {
      test("should build AQL expression for field and group combination", () => {
        const filters: Filter[] = [
          {
            type: "field",
            value: { key: "status", value: "passed", type: "string" },
            logicalOperator: "AND",
          },
          {
            type: "group",
            value: [
              {
                type: "field",
                value: { key: "flaky", value: true, type: "boolean" },
                logicalOperator: "AND",
              },
              {
                type: "field",
                value: { key: "retry", value: false, type: "boolean" },
                logicalOperator: "OR",
              },
            ],
            logicalOperator: "AND",
          },
        ];

        const result = buildFieldFilters(filters);

        expect(result).toMatchObject({
          type: "binary",
          operator: "AND",
          left: {
            type: "condition",
            left: { identifier: "status" },
          },
          right: {
            type: "paren",
          },
        });
      });
    });

    describe("error handling", () => {
      test("should throw error for empty filters array", () => {
        expect(() => buildFieldFilters([])).toThrow("chainFieldFilters: filters array cannot be empty");
      });
    });
  });

  describe("buildFilterPredicate", () => {
    test("should create predicate that filters items correctly", () => {
      const items = [
        { status: "passed", name: "test1" },
        { status: "failed", name: "test2" },
        { status: "passed", name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "status", value: "passed", type: "string" },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === "passed")).toBe(true);
    });

    test("should create predicate for number field", () => {
      const items = [
        { age: 20, name: "test1" },
        { age: 25, name: "test2" },
        { age: 30, name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "age", value: 25, type: "number" },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(25);
    });

    test("should create predicate for boolean field", () => {
      const items = [
        { flaky: true, name: "test1" },
        { flaky: false, name: "test2" },
        { flaky: true, name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "flaky", value: true, type: "boolean" },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(2);
      expect(result.every((item) => item.flaky === true)).toBe(true);
    });

    test("should create predicate for array field (IN operator - strict mode)", () => {
      // IN operator checks if the field value equals any value in the array
      // Array field type creates an IN condition: field IN [value1, value2, ...]
      const items = [
        { status: "passed", name: "test1" },
        { status: "failed", name: "test2" },
        { status: "broken", name: "test3" },
        { status: "skipped", name: "test4" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "status", value: ["passed", "failed"], type: "array" },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      // IN checks if status equals "passed" OR "failed"
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
    });

    test("should create predicate for array field (intersection - non-strict mode)", () => {
      // Non-strict mode checks if array field contains any of the specified values
      const items = [
        { tags: ["smoke"], name: "test1" },
        { tags: ["regression"], name: "test2" },
        { tags: ["smoke", "regression"], name: "test3" },
        { tags: ["e2e"], name: "test4" },
        { tags: ["smoke", "api"], name: "test5" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "tags", value: ["smoke", "regression"], type: "array", strict: false },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      // Should match items where tags array contains "smoke" OR "regression"
      expect(result).toHaveLength(4); // test1, test2, test3, test5
      expect(result.every((item) => item.tags.some((tag) => ["smoke", "regression"].includes(tag)))).toBe(true);
    });

    test("should create predicate with AND operator", () => {
      const items = [
        { status: "passed", flaky: true, name: "test1" },
        { status: "passed", flaky: false, name: "test2" },
        { status: "failed", flaky: true, name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "status", value: "passed", type: "string" },
          logicalOperator: "AND",
        },
        {
          type: "field",
          value: { key: "flaky", value: true, type: "boolean" },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("passed");
      expect(result[0].flaky).toBe(true);
    });

    test("should create predicate with OR operator", () => {
      const items = [
        { status: "passed", name: "test1" },
        { status: "failed", name: "test2" },
        { status: "skipped", name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "status", value: "passed", type: "string" },
          logicalOperator: "OR",
        },
        {
          type: "field",
          value: { key: "status", value: "failed", type: "string" },
          logicalOperator: "OR",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === "passed" || item.status === "failed")).toBe(true);
    });

    test("should create predicate with CONTAINS operator (non-strict)", () => {
      const items = [
        { name: "test1", description: "smoke test" },
        { name: "test2", description: "regression test" },
        { name: "test3", description: "unit test" },
      ];

      const filters: Filter[] = [
        {
          type: "field",
          value: { key: "description", value: "smoke", type: "string", strict: false },
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("smoke");
    });

    test("should create predicate with group filter", () => {
      const items = [
        { status: "passed", flaky: true, name: "test1" },
        { status: "passed", flaky: false, name: "test2" },
        { status: "failed", flaky: true, name: "test3" },
      ];

      const filters: Filter[] = [
        {
          type: "group",
          value: [
            {
              type: "field",
              value: { key: "status", value: "passed", type: "string" },
              logicalOperator: "AND",
            },
            {
              type: "field",
              value: { key: "flaky", value: true, type: "boolean" },
              logicalOperator: "OR",
            },
          ],
          logicalOperator: "AND",
        },
      ];

      const predicate = buildFilterPredicate(filters);
      const result = items.filter(predicate);

      // Should match items where (status = "passed" OR flaky = true)
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
