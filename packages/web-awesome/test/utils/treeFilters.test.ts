import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { createRecursiveTree, filterLeaves } from "../../src/utils/treeFilters.js";
import type { ReportTestResult } from "../../types.js";

// Predicate that always returns true (no filtering)
const alwaysTruePredicate = () => true;

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("treeFilters");
  await label("coverage", "filters");
});

describe("utils > treeFilters", () => {
  describe("filterLeaves", () => {
    it("sorts leave by duration in ascending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: {
          name: "a1",
          duration: 1000,
        } as ReportTestResult,
        b2: {
          name: "b2",
          duration: 2000,
        } as ReportTestResult,
        c3: {
          name: "c3",
          duration: 3000,
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
          duration: 2000,
        } as ReportTestResult,
        c3: {
          name: "c3",
          duration: 3000,
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
        } as ReportTestResult,
        c3: {
          name: "c3",
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
        } as ReportTestResult,
        c3: {
          name: "c3",
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
          status: "failed",
        } as ReportTestResult,
        c3: {
          name: "c3",
          status: "broken",
        } as ReportTestResult,
        d4: {
          name: "d4",
          status: "unknown",
        } as ReportTestResult,
        e5: {
          name: "e5",
          status: "skipped",
        } as ReportTestResult,
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
      const leaves = ["a1", "b2", "c3", "d4", "e5", "f6", "z9"];
      const leavesById = {
        a1: {
          name: "a1",
          status: "passed",
        } as ReportTestResult,
        b2: {
          name: "b2",
          status: "failed",
        } as ReportTestResult,
        c3: {
          name: "c3",
          status: "broken",
        } as ReportTestResult,
        d4: {
          name: "d4",
          status: "unknown",
        } as ReportTestResult,
        e5: {
          name: "e5",
          status: "skipped",
        } as ReportTestResult,
        f6: {
          name: "f6",
          status: "failed",
        } as ReportTestResult,
        z9: {
          name: "z9",
          status: "passed",
        } as ReportTestResult,
      };
      const result = filterLeaves(leaves, leavesById as any, alwaysTruePredicate, "status,desc");

      expect(result).toEqual([
        expect.objectContaining({ name: "f6" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "z9" }),
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "e5" }),
        expect.objectContaining({ name: "d4" }),
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
        } as ReportTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        } as ReportTestResult,
        c3: {
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        } as ReportTestResult,
        c3: {
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        } as ReportTestResult,
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
        } as ReportTestResult,
        b2: {
          name: "b2",
          start: baseDate + 1000,
        } as ReportTestResult,
        c3: {
          name: "c3",
          start: baseDate + 2000,
        } as ReportTestResult,
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

    it("ignores missing nested group references", () => {
      const group = {
        leaves: ["a1"],
        groups: ["exists", "missing"],
      };
      const leavesById = {
        a1: {
          name: "a1",
          status: "passed",
        } as ReportTestResult,
        b2: {
          name: "b2",
          status: "failed",
        } as ReportTestResult,
      };
      const groupsById = {
        exists: {
          leaves: ["b2"],
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

      expect(result.trees).toHaveLength(1);
      expect(result.trees[0]).toEqual(
        expect.objectContaining({
          leaves: [expect.objectContaining({ name: "b2" })],
          trees: [],
        }),
      );
    });

    it("sorts groups by earliest leaf groupOrder when sorting by order ascending", () => {
      const group = {
        leaves: [],
        groups: ["groupA", "groupB", "groupC"],
      };
      const leavesById = {
        t1: { name: "t1", status: "passed", groupOrder: 5 } as ReportTestResult,
        t2: { name: "t2", status: "passed", groupOrder: 2 } as ReportTestResult,
        t3: { name: "t3", status: "passed", groupOrder: 8 } as ReportTestResult,
      };
      const groupsById = {
        groupA: { name: "groupA", leaves: ["t1"], groups: [] as string[] },
        groupB: { name: "groupB", leaves: ["t2"], groups: [] as string[] },
        groupC: { name: "groupC", leaves: ["t3"], groups: [] as string[] },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "order,asc",
      });

      expect(result.trees.map((t) => t.name)).toEqual(["groupB", "groupA", "groupC"]);
    });

    it("uses earliest descendant start as a tie-breaker for groups with the same leaf groupOrder", () => {
      const group = {
        leaves: [],
        groups: ["groupA", "groupB"],
      };
      const leavesById = {
        late: { name: "late", status: "passed", groupOrder: 1, start: 5000 } as ReportTestResult,
        early: { name: "early", status: "passed", groupOrder: 1, start: 1000 } as ReportTestResult,
      };
      const groupsById = {
        groupA: { name: "groupA", leaves: [], groups: ["groupALeaves"] },
        groupB: { name: "groupB", leaves: [], groups: ["groupBLeaves"] },
        groupALeaves: { name: "groupALeaves", leaves: ["late"], groups: [] as string[] },
        groupBLeaves: { name: "groupBLeaves", leaves: ["early"], groups: [] as string[] },
      };

      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "order,asc",
      });

      expect(result.trees.map((t) => t.name)).toEqual(["groupB", "groupA"]);
    });

    it("sorts groups by earliest leaf groupOrder when sorting by order descending", () => {
      const group = {
        leaves: [],
        groups: ["groupA", "groupB", "groupC"],
      };
      const leavesById = {
        t1: { name: "t1", status: "passed", groupOrder: 5 } as ReportTestResult,
        t2: { name: "t2", status: "passed", groupOrder: 2 } as ReportTestResult,
        t3: { name: "t3", status: "passed", groupOrder: 8 } as ReportTestResult,
      };
      const groupsById = {
        groupA: { name: "groupA", leaves: ["t1"], groups: [] as string[] },
        groupB: { name: "groupB", leaves: ["t2"], groups: [] as string[] },
        groupC: { name: "groupC", leaves: ["t3"], groups: [] as string[] },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "order,desc",
      });

      expect(result.trees.map((t) => t.name)).toEqual(["groupC", "groupA", "groupB"]);
    });

    it("sorts groups by aggregated duration when sorting by duration ascending", () => {
      const group = {
        leaves: [],
        groups: ["groupA", "groupB", "groupC"],
      };
      const leavesById = {
        t1: { name: "t1", status: "passed", duration: 3000 } as ReportTestResult,
        t2: { name: "t2", status: "passed", duration: 1000 } as ReportTestResult,
        t3: { name: "t3", status: "passed", duration: 5000 } as ReportTestResult,
      };
      const groupsById = {
        groupA: { name: "groupA", leaves: ["t1"], groups: [] as string[] },
        groupB: { name: "groupB", leaves: ["t2"], groups: [] as string[] },
        groupC: { name: "groupC", leaves: ["t3"], groups: [] as string[] },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "duration,asc",
      });

      expect(result.trees.map((t) => t.name)).toEqual(["groupB", "groupA", "groupC"]);
    });

    it("sorts groups by aggregated duration when sorting by duration descending", () => {
      const group = {
        leaves: [],
        groups: ["groupA", "groupB", "groupC"],
      };
      const leavesById = {
        t1: { name: "t1", status: "passed", duration: 3000 } as ReportTestResult,
        t2: { name: "t2", status: "passed", duration: 1000 } as ReportTestResult,
        t3: { name: "t3", status: "passed", duration: 5000 } as ReportTestResult,
      };
      const groupsById = {
        groupA: { name: "groupA", leaves: ["t1"], groups: [] as string[] },
        groupB: { name: "groupB", leaves: ["t2"], groups: [] as string[] },
        groupC: { name: "groupC", leaves: ["t3"], groups: [] as string[] },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "duration,desc",
      });

      expect(result.trees.map((t) => t.name)).toEqual(["groupC", "groupA", "groupB"]);
    });

    it("keeps problem-heavy groups first when sorting by status in descending order", () => {
      const group = {
        leaves: [],
        groups: ["passedHeavy", "failedAlpha", "brokenGroup", "failedZulu"],
      };
      const leavesById = {
        failedAlphaTest: {
          name: "failedAlphaTest",
          status: "failed",
        } as ReportTestResult,
        failedZuluTest: {
          name: "failedZuluTest",
          status: "failed",
        } as ReportTestResult,
        brokenTest1: {
          name: "brokenTest1",
          status: "broken",
        } as ReportTestResult,
        brokenTest2: {
          name: "brokenTest2",
          status: "broken",
        } as ReportTestResult,
        passedTest1: {
          name: "passedTest1",
          status: "passed",
        } as ReportTestResult,
        passedTest2: {
          name: "passedTest2",
          status: "passed",
        } as ReportTestResult,
      };
      const groupsById = {
        passedHeavy: {
          name: "passedHeavy",
          leaves: ["passedTest1", "passedTest2"],
          groups: [] as string[],
        },
        brokenGroup: {
          name: "brokenGroup",
          leaves: ["brokenTest1", "brokenTest2"],
          groups: [] as string[],
        },
        failedAlpha: {
          name: "failedAlpha",
          leaves: ["failedAlphaTest"],
          groups: [] as string[],
        },
        failedZulu: {
          name: "failedZulu",
          leaves: ["failedZuluTest"],
          groups: [] as string[],
        },
      };
      const result = createRecursiveTree({
        group: group as any,
        leavesById: leavesById as any,
        groupsById: groupsById as any,
        filterPredicate: alwaysTruePredicate,
        sortBy: "status,desc",
      });

      expect(result.trees).toEqual([
        expect.objectContaining({ name: "failedZulu" }),
        expect.objectContaining({ name: "failedAlpha" }),
        expect.objectContaining({ name: "brokenGroup" }),
        expect.objectContaining({ name: "passedHeavy" }),
      ]);
    });
  });
});
