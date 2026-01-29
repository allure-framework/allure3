import { describe, expect, it } from "vitest";
import { createRecursiveTree, filterLeaves } from "../../src/utils/treeFilters.js";
import type { AwesomeTestResult } from "../../types.js";

// Predicate that always returns true (no filtering)
const alwaysTruePredicate = () => true;

describe("utils > treeFilters", () => {
  describe("filterLeaves", () => {
    it("sorts leave by duration in ascending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
          duration: 1000,
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          duration: 2000,
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          duration: 3000,
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "duration,asc");

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });

    it("sorts leave by duration in descending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
          duration: 1000,
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          duration: 2000,
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          duration: 3000,
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "duration,desc");

      expect(result).toEqual([
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "a1" }),
      ]);
    });

    it("sorts leaves by title in ascending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
        } as AwesomeTestResult,
        b2: {
          name: "b2",
        } as AwesomeTestResult,
        c3: {
          name: "c3",
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "name,asc");

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });

    it("sorts leaves by title in descending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
        } as AwesomeTestResult,
        b2: {
          name: "b2",
        } as AwesomeTestResult,
        c3: {
          name: "c3",
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "name,desc");

      expect(result).toEqual([
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "a1" }),
      ]);
    });

    it("sorts leaves by status in ascending order", () => {
      const leaves = ["a1", "b2", "c3", "d4", "e5"];
      const leavesById = {
        a1: {
          name: "a1",
          status: "passed",
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          status: "failed",
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          status: "broken",
        } as AwesomeTestResult,
        d4: {
          name: "d4",
          status: "unknown",
        } as AwesomeTestResult,
        e5: {
          name: "e5",
          status: "skipped",
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "status,asc");

      expect(result).toEqual([
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "e5" }),
        expect.objectContaining({ name: "d4" }),
      ]);
    });

    it("sorts leaves by status in descending order", () => {
      const leaves = ["a1", "b2", "c3", "d4", "e5"];
      const leavesById = {
        a1: {
          name: "a1",
          status: "passed",
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          status: "failed",
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          status: "broken",
        } as AwesomeTestResult,
        d4: {
          name: "d4",
          status: "unknown",
        } as AwesomeTestResult,
        e5: {
          name: "e5",
          status: "skipped",
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "status,desc");

      expect(result).toEqual([
        expect.objectContaining({ name: "d4" }),
        expect.objectContaining({ name: "e5" }),
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
      ]);
    });

    it("sorts leaves by order number in ascending order", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
          start: baseDate + 2000,
          groupOrder: 3,
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "order,asc");

      expect(result).toEqual([
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "a1" }),
      ]);
    });

    it("sorts leaves by order number in descending order", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
          start: baseDate + 2000,
          groupOrder: 3,
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        } as AwesomeTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "order,desc");

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });
  });

  describe("createRecursiveTree", () => {
    it("creates recursive tree with sorted leaves objects", () => {
      const baseDate = Date.now();
      const group = {
        leaves: ["a1"],
        groups: ["a1"],
      };
      const leavesById = {
        a1: {
          name: "a1",
          start: baseDate,
        } as AwesomeTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
        } as AwesomeTestResult,
        c3: {
          name: "c3",
          start: baseDate + 2000,
        } as AwesomeTestResult,
      };
      const groupsById = {
        a1: {
          leaves: ["b2"],
          groups: ["b2"],
        },
        b2: {
          leaves: ["c3"],
          groups: [] as string[],
        },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "name,asc",
      });

      expect(result).toEqual(
        expect.objectContaining({
          leaves: [expect.objectContaining({ name: "a1" })],
          trees: [
            expect.objectContaining({
              leaves: [expect.objectContaining({ name: "b2" })],
              trees: [
                expect.objectContaining({
                  leaves: [expect.objectContaining({ name: "c3" })],
                  trees: [],
                }),
              ],
            }),
          ],
        }),
      );
    });
  });
});
