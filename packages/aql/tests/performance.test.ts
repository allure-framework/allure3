import { story } from "allure-js-commons";
import { runWithAllure } from "allure-tinybench";
import { Bench } from "tinybench";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { filterByAql, parseAql } from "../src/index.js";

beforeEach(async () => {
  await story("performance");
});
async function benchmark(key: string, fn: () => void, iterations: number): Promise<number> {
  const bench = new Bench({ iterations, time: 0, warmup: false, throws: true });
  bench.add(key, fn);
  const [task] = await runWithAllure(bench);
  if (task.result.state !== "completed") {
    throw new Error(`Benchmark ${key} did not complete: ${task.result.state}`);
  }
  return task.result.period;
}

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

/**
 * Generate test data
 */
function generateTestItems(count: number): TestItem[] {
  const statuses = ["passed", "failed", "broken", "skipped"];
  const tags = ["smoke", "regression", "api", "ui", "e2e"];
  const priorities = ["High", "Medium", "Low"];
  const components = ["Auth", "UI", "API", "Database"];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Test ${i + 1}`,
    status: statuses[i % statuses.length],
    age: 20 + (i % 50),
    duration: 10 + (i % 1000),
    tags: tags.slice(0, (i % 3) + 1),
    metadata: {
      priority: priorities[i % priorities.length],
      component: components[i % components.length],
    },
  }));
}

describe("Performance Tests", () => {
  describe("Parsing Performance", () => {
    test("should parse simple condition quickly", async () => {
      const aql = 'status = "passed"';
      const avgTime = await benchmark(
        "aql.parse.simple",
        () => {
          parseAql(aql);
        },
        1000,
      );

      // Simple condition should parse in less than 1ms on average
      expect(avgTime).toBeLessThan(1);
    });

    test("should parse complex expression with multiple operators", async () => {
      const aql = '(status = "passed" OR status = "failed") AND (age > 25 AND age < 50) AND name ~= "test"';
      const avgTime = await benchmark(
        "aql.parse.complex",
        () => {
          parseAql(aql);
        },
        100,
      );

      // Complex expression should parse in less than 3ms on average
      expect(avgTime).toBeLessThan(3);
    });

    test("should parse array condition efficiently", async () => {
      const aql = 'status IN ["passed", "failed", "broken", "skipped", "pending"]';
      const avgTime = await benchmark(
        "aql.parse.array",
        () => {
          parseAql(aql);
        },
        100,
      );

      expect(avgTime).toBeLessThan(2);
    });

    test("should parse deeply nested parentheses efficiently", async () => {
      const aql =
        '((((status = "passed" AND age > 25) OR (status = "failed" AND age < 30)) AND name ~= "test") OR duration > 100)';
      const avgTime = await benchmark(
        "aql.parse.nested",
        () => {
          parseAql(aql);
        },
        100,
      );

      expect(avgTime).toBeLessThan(3);
    });

    test("should parse many simple expressions quickly", async () => {
      const expressions = Array.from({ length: 1000 }, (_, i) => `status = "test${i}"`);
      const avgTime = await benchmark(
        "aql.parse.many",
        () => {
          expressions.forEach((expr) => parseAql(expr));
        },
        1,
      );

      // 1000 simple expressions should parse in less than 100ms
      expect(avgTime).toBeLessThan(100);
    });
  });

  describe("Filtering Performance", () => {
    test("should filter small array quickly", async () => {
      const items = generateTestItems(100);
      const aql = 'status = "passed"';

      const avgTime = await benchmark(
        "aql.filter.small",
        () => {
          filterByAql(items, aql);
        },
        100,
      );

      // 100 items should filter in less than 1ms
      expect(avgTime).toBeLessThan(1);
    });

    test("should filter medium array efficiently", async () => {
      const items = generateTestItems(1000);
      const aql = 'status = "passed" AND age > 25';

      const avgTime = await benchmark(
        "aql.filter.medium",
        () => {
          filterByAql(items, aql);
        },
        50,
      );

      // 1000 items should filter in less than 5ms
      expect(avgTime).toBeLessThan(5);
    });

    test("should filter large array efficiently", async () => {
      const items = generateTestItems(10000);
      const aql = 'status = "passed" OR status = "failed"';

      const avgTime = await benchmark(
        "aql.filter.large",
        () => {
          filterByAql(items, aql);
        },
        10,
      );

      // 10000 items should filter in less than 50ms
      expect(avgTime).toBeLessThan(50);
    });

    test("should filter with complex expression efficiently", async () => {
      const items = generateTestItems(5000);
      const aql = '(status = "passed" OR status = "failed") AND (age > 25 AND age < 50) AND duration < 500';

      const avgTime = await benchmark(
        "aql.filter.complex",
        () => {
          filterByAql(items, aql);
        },
        10,
      );

      // Complex expression on 5000 items should filter in less than 30ms
      expect(avgTime).toBeLessThan(30);
    });

    test("should filter with IN operator efficiently", async () => {
      const items = generateTestItems(5000);
      const aql = 'status IN ["passed", "failed", "broken"]';

      const avgTime = await benchmark(
        "aql.filter.in",
        () => {
          filterByAql(items, aql);
        },
        10,
      );

      expect(avgTime).toBeLessThan(20);
    });

    test("should filter with nested property access efficiently", async () => {
      const items = generateTestItems(5000);
      const aql = 'metadata["priority"] = "High" AND metadata["component"] = "Auth"';

      const avgTime = await benchmark(
        "aql.filter.nested",
        () => {
          filterByAql(items, aql);
        },
        10,
      );

      expect(avgTime).toBeLessThan(30);
    });

    test("should reuse parsed expression efficiently", async () => {
      const items = generateTestItems(1000);
      const aql = 'status = "passed" AND age > 25';

      // Parse once
      const parseResult = parseAql(aql);
      expect(parseResult.expression).not.toBeNull();

      // Filter multiple times with pre-parsed expression
      const avgTime = await benchmark(
        "aql.filter.reuse",
        () => {
          if (parseResult.expression) {
            filterByAql(items, parseResult.expression);
          }
        },
        100,
      );

      // Reusing parsed expression should be faster than parsing each time
      expect(avgTime).toBeLessThan(2);
    });

    test("should handle empty result efficiently", async () => {
      const items = generateTestItems(10000);
      const aql = 'status = "nonexistent"';

      const avgTime = await benchmark(
        "aql.filter.empty",
        () => {
          filterByAql(items, aql);
        },
        10,
      );

      // Empty result should still be fast
      expect(avgTime).toBeLessThan(30);
    });
  });

  describe("End-to-End Performance", () => {
    test("should handle parse and filter workflow efficiently", async () => {
      const items = generateTestItems(5000);
      const aql = '(status = "passed" OR status = "failed") AND age > 25';

      const avgTime = await benchmark(
        "aql.workflow.parseAndFilter",
        () => {
          const result = parseAql(aql);
          if (result.expression) {
            filterByAql(items, result.expression);
          }
        },
        10,
      );

      // Complete workflow should complete in less than 40ms
      expect(avgTime).toBeLessThan(40);
    });

    test("should handle multiple filters on same dataset efficiently", async () => {
      const items = generateTestItems(5000);
      const queries = [
        'status = "passed"',
        'status = "failed"',
        "age > 30",
        "duration < 100",
        'status IN ["passed", "failed"]',
      ];

      const avgTime = await benchmark(
        "aql.workflow.multipleFilters",
        () => {
          queries.forEach((aql) => {
            filterByAql(items, aql);
          });
        },
        5,
      );

      // 5 filters on 5000 items should complete in less than 100ms
      expect(avgTime).toBeLessThan(100);
    });
  });
});
