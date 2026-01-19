import { describe, expect, test } from "vitest";
import { filterByAql, parseAql } from "../src/index.js";

/**
 * Memory profiling tests - verify no memory leaks and proper memory management
 * These tests check that memory usage doesn't grow unbounded with repeated operations
 *
 * Note: --expose-gc flag is enabled in vitest.config.ts via poolOptions.execArgv
 * This allows using global.gc() for more accurate memory measurements
 */

/**
 * Get current heap memory usage
 */
function getMemoryUsage(): number {
  return process.memoryUsage().heapUsed;
}

/**
 * Force garbage collection if available
 */
function forceGC(): void {
  if (typeof global.gc === "function") {
    global.gc();
  }
}

/**
 * Measure memory delta after operation
 */
function measureMemoryDelta(operation: () => void): number {
  forceGC();
  const before = getMemoryUsage();
  operation();
  forceGC();
  const after = getMemoryUsage();
  return after - before;
}

/**
 * Generate test data
 */
function generateTestItems(count: number): Array<Record<string, any>> {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Test ${i}`,
    status: i % 2 === 0 ? "passed" : "failed",
    age: 20 + (i % 50),
    duration: 10 + (i % 1000),
  }));
}

describe("Memory Profiling Tests", () => {
  describe("Parsing memory usage", () => {
    test("should not leak memory with repeated parsing", () => {
      const iterations = 1000;
      const aql = 'status = "passed" AND age > 25';

      // Warm up
      for (let i = 0; i < 10; i++) {
        parseAql(aql);
      }
      forceGC();

      const initialMemory = getMemoryUsage();

      // Parse many times
      for (let i = 0; i < iterations; i++) {
        parseAql(aql);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 10MB for 1000 iterations)
      // This is a rough check - actual values may vary
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);
    });

    test("should not accumulate memory with different expressions", () => {
      const expressions = Array.from({ length: 100 }, (_, i) => `status = "test${i}"`);

      forceGC();
      const initialMemory = getMemoryUsage();

      expressions.forEach((aql) => {
        parseAql(aql);
      });

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory growth should be reasonable
      expect(memoryDelta).toBeLessThan(5 * 1024 * 1024);
    });

    test("should release memory after parsing large expressions", () => {
      const largeExpression = `status = "${"a".repeat(10000)}"`;

      forceGC();
      const before = getMemoryUsage();

      const result = parseAql(largeExpression);
      expect(result.expression).not.toBeNull();

      // Clear reference
      const parsed = result.expression;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = parsed;

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      // Memory should be released (delta should be small or negative after GC)
      // Note: This is approximate as GC timing is not guaranteed
      expect(Math.abs(delta)).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe("Filtering memory usage", () => {
    test("should not leak memory with repeated filtering", () => {
      const items = generateTestItems(1000);
      const aql = 'status = "passed"';

      // Warm up
      for (let i = 0; i < 10; i++) {
        filterByAql(items, aql);
      }
      forceGC();

      const initialMemory = getMemoryUsage();

      // Filter many times
      for (let i = 0; i < 100; i++) {
        filterByAql(items, aql);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory growth should be reasonable
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);
    });

    test("should not accumulate memory with large arrays", () => {
      const largeArray = generateTestItems(10000);
      const aql = 'status = "passed"';

      forceGC();
      const initialMemory = getMemoryUsage();

      // Filter multiple times
      for (let i = 0; i < 10; i++) {
        filterByAql(largeArray, aql);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory growth should be reasonable
      expect(memoryDelta).toBeLessThan(20 * 1024 * 1024);
    });

    test("should release memory after filtering", () => {
      const items = generateTestItems(5000);
      const aql = 'status = "passed"';

      forceGC();
      const before = getMemoryUsage();

      const filtered = filterByAql(items, aql);
      expect(filtered.length).toBeGreaterThan(0);

      // Clear reference
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = filtered;

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      // Memory should be released (approximate check)
      expect(Math.abs(delta)).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe("Memory with parsed expressions", () => {
    test("should not leak when reusing parsed expressions", () => {
      const aql = 'status = "passed" AND age > 25';
      const parseResult = parseAql(aql);
      expect(parseResult.expression).not.toBeNull();

      const items = generateTestItems(1000);

      forceGC();
      const initialMemory = getMemoryUsage();

      // Reuse same expression many times
      for (let i = 0; i < 100; i++) {
        filterByAql(items, parseResult.expression!);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Reusing expressions should be memory efficient
      expect(memoryDelta).toBeLessThan(5 * 1024 * 1024);
    });

    test("should release memory when expression is no longer referenced", () => {
      const items = generateTestItems(1000);

      forceGC();
      const before = getMemoryUsage();

      // Create and use many expressions
      for (let i = 0; i < 100; i++) {
        const aql = `status = "test${i}"`;
        const parseResult = parseAql(aql);
        filterByAql(items, parseResult.expression!);
        // Expressions go out of scope here
      }

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      // Memory should be released after expressions go out of scope
      expect(Math.abs(delta)).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe("Memory with complex operations", () => {
    test("should handle complex expressions without excessive memory", () => {
      const complexAql = '(status = "passed" OR status = "failed") AND (age > 25 AND age < 50) AND duration < 500';
      const items = generateTestItems(5000);

      forceGC();
      const initialMemory = getMemoryUsage();

      // Parse and filter many times
      for (let i = 0; i < 50; i++) {
        const parseResult = parseAql(complexAql);
        filterByAql(items, parseResult.expression!);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Complex operations should still be memory efficient
      expect(memoryDelta).toBeLessThan(15 * 1024 * 1024);
    });

    test("should handle nested property access without leaks", () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        metadata: {
          priority: i % 2 === 0 ? "High" : "Low",
          component: `Component${i % 10}`,
        },
      }));

      const aql = 'metadata["priority"] = "High"';

      forceGC();
      const initialMemory = getMemoryUsage();

      for (let i = 0; i < 100; i++) {
        filterByAql(items, aql);
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe("Memory stability", () => {
    test("should maintain stable memory usage over time", () => {
      const items = generateTestItems(1000);
      const expressions = ['status = "passed"', 'status = "failed"', "age > 25", 'name ~= "test"'];

      forceGC();
      const initialMemory = getMemoryUsage();

      // Run many iterations
      for (let iteration = 0; iteration < 10; iteration++) {
        expressions.forEach((aql) => {
          const parseResult = parseAql(aql);
          filterByAql(items, parseResult.expression!);
        });

        // Force GC periodically
        if (iteration % 5 === 0) {
          forceGC();
        }
      }

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory should remain stable
      expect(Math.abs(memoryDelta)).toBeLessThan(10 * 1024 * 1024);
    });

    test("should not grow memory with increasing input sizes", () => {
      const sizes = [100, 500, 1000, 2000];
      const aql = 'status = "passed"';

      forceGC();
      const initialMemory = getMemoryUsage();

      sizes.forEach((size) => {
        const items = generateTestItems(size);
        filterByAql(items, aql);
      });

      forceGC();
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;

      // Memory growth should be proportional, not exponential
      expect(memoryDelta).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe("Memory with edge cases", () => {
    test("should handle empty arrays without memory issues", () => {
      const emptyArray: any[] = [];
      const aql = 'status = "passed"';

      forceGC();
      const before = getMemoryUsage();

      for (let i = 0; i < 1000; i++) {
        filterByAql(emptyArray, aql);
      }

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      // Empty arrays should not cause memory issues
      // Note: Some memory overhead is expected for function calls
      expect(Math.abs(delta)).toBeLessThan(5 * 1024 * 1024);
    });

    test("should handle empty expressions without memory issues", () => {
      const items = generateTestItems(1000);

      forceGC();
      const before = getMemoryUsage();

      for (let i = 0; i < 1000; i++) {
        filterByAql(items, "");
      }

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      expect(Math.abs(delta)).toBeLessThan(1 * 1024 * 1024);
    });

    test("should handle very long strings efficiently", () => {
      const longString = "a".repeat(100000);
      const aql = `name = "${longString}"`;

      // Test that parsing works without throwing
      const result = parseAql(aql);
      expect(result.expression).not.toBeNull();

      // Memory check: verify that memory doesn't grow excessively
      // Note: Exact memory measurement for large strings is unreliable due to GC timing
      // Instead, verify that parsing completes successfully and doesn't crash
      forceGC();
      const before = getMemoryUsage();

      // Parse again to check memory stability
      const result2 = parseAql(aql);
      expect(result2.expression).not.toBeNull();

      forceGC();
      const after = getMemoryUsage();
      const delta = after - before;

      // Memory delta should be small for repeated parsing of same string
      // (allowing some overhead for GC and measurement)
      expect(Math.abs(delta)).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
