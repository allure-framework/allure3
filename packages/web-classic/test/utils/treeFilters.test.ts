import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createRecursiveTree, filterLeaves } from "../../src/utils/treeFilters.js";
import type { ReportTreeLeaf, ReportTreeGroup } from "../../types.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("treeFilters");
  await label("coverage", "filters");
});

const makeLeaf = (overrides: Partial<ReportTreeLeaf>): ReportTreeLeaf => ({
  nodeId: overrides.name ?? "leaf",
  name: "leaf",
  status: "unknown",
  flaky: false,
  retry: false,
  ...overrides,
});
const makeGroup = (overrides: Partial<ReportTreeGroup>): ReportTreeGroup => ({
  nodeId: overrides.name ?? "group",
  name: "group",
  statistic: { total: 0 },
  ...overrides,
});

describe("utils > treeFilters", () => {
  describe("filterLeaves", () => {
    it("returns the leaves as is when no filter options are provided", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          start: baseDate,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate + 2000,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: {
          flaky: false,
          retry: false,
          new: false,
        },
        sortBy: "order",
        direction: "asc",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });

    it("returns the leaves only matched the status filter", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          status: "passed",
          start: baseDate,
        }),
        b2: makeLeaf({
          name: "b2",
          status: "failed",
          start: baseDate + 1000,
        }),
        c3: makeLeaf({
          name: "c3",
          status: "passed",
          start: baseDate + 2000,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "passed",
        filter: {
          flaky: false,
          retry: false,
          new: false,
        },
        sortBy: "order",
        direction: "asc",
      });

      expect(result).toEqual([expect.objectContaining({ name: "a1" }), expect.objectContaining({ name: "c3" })]);
    });

    it("returns the flaky leaves", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          start: baseDate,
          flaky: true,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
          flaky: false,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate + 2000,
          flaky: true,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: {
          flaky: true,
          retry: false,
          new: false,
        },
        sortBy: "order",
        direction: "asc",
      });

      expect(result).toEqual([expect.objectContaining({ name: "a1" }), expect.objectContaining({ name: "c3" })]);
    });

    it("returns leaves which contains retries", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          start: baseDate,
          retry: true,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
          retry: false,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate + 2000,
          retry: false,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        sortBy: "order",
        direction: "asc",
        filter: {
          flaky: false,
          new: false,
          retry: true,
        },
      });

      expect(result).toEqual([expect.objectContaining({ name: "a1" })]);
    });

    it("returns only new leaves when the new filter is enabled", () => {
      const baseDate = Date.now();
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({ name: "a1", start: baseDate, transition: "new" }),
        b2: makeLeaf({ name: "b2", start: baseDate + 1000, transition: "fixed" }),
        c3: makeLeaf({ name: "c3", start: baseDate + 2000 }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        sortBy: "order",
        direction: "asc",
        filter: {
          flaky: false,
          retry: false,
          new: true,
        },
      });

      expect(result).toEqual([expect.objectContaining({ name: "a1" })]);
    });

    it("keeps every leaf when the new filter is disabled", () => {
      const leavesById = {
        a1: makeLeaf({ name: "a1", start: 1, transition: "new" }),
        b2: makeLeaf({ name: "b2", start: 2 }),
      };
      const result = filterLeaves(["a1", "b2"], leavesById, {
        query: "",
        status: "total",
        filter: {
          flaky: false,
          retry: false,
          new: false,
        },
        sortBy: "order",
        direction: "asc",
      });

      expect(result.map(({ name }) => name)).toEqual(["a1", "b2"]);
    });

    it("sorts leave by duration in ascending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          duration: 1000,
        }),
        b2: makeLeaf({
          name: "b2",
          duration: 2000,
        }),
        c3: makeLeaf({
          name: "c3",
          duration: 3000,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "asc",
        sortBy: "duration",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });

    it("sorts leave by duration in descending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          duration: 1000,
        }),
        b2: makeLeaf({
          name: "b2",
          duration: 2000,
        }),
        c3: makeLeaf({
          name: "c3",
          duration: 3000,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "desc",
        sortBy: "duration",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "a1" }),
      ]);
    });

    it("sorts leaves by title in ascending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
        }),
        b2: makeLeaf({
          name: "b2",
        }),
        c3: makeLeaf({
          name: "c3",
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "asc",
        sortBy: "alphabet",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });

    it("sorts leaves by title in descending order", () => {
      const leaves = ["a1", "b2", "c3"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
        }),
        b2: makeLeaf({
          name: "b2",
        }),
        c3: makeLeaf({
          name: "c3",
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "desc",
        sortBy: "alphabet",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "c3" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "a1" }),
      ]);
    });

    it("sorts leaves by status in ascending order", () => {
      const leaves = ["a1", "b2", "c3", "d4", "e5"];
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          status: "passed",
        }),
        b2: makeLeaf({
          name: "b2",
          status: "failed",
        }),
        c3: makeLeaf({
          name: "c3",
          status: "broken",
        }),
        d4: makeLeaf({
          name: "d4",
          status: "unknown",
        }),
        e5: makeLeaf({
          name: "e5",
          status: "skipped",
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "asc",
        sortBy: "status",
      });

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
        a1: makeLeaf({
          name: "a1",
          status: "passed",
        }),
        b2: makeLeaf({
          name: "b2",
          status: "failed",
        }),
        c3: makeLeaf({
          name: "c3",
          status: "broken",
        }),
        d4: makeLeaf({
          name: "d4",
          status: "unknown",
        }),
        e5: makeLeaf({
          name: "e5",
          status: "skipped",
        }),
        f6: makeLeaf({
          name: "f6",
          status: "failed",
        }),
        z9: makeLeaf({
          name: "z9",
          status: "passed",
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "desc",
        sortBy: "status",
      });

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
        a1: makeLeaf({
          name: "a1",
          start: baseDate + 2000,
          groupOrder: 3,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "asc",
        sortBy: "order",
      });

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
        a1: makeLeaf({
          name: "a1",
          start: baseDate + 2000,
          groupOrder: 3,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
          groupOrder: 2,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate,
          groupOrder: 1,
        }),
      };
      const result = filterLeaves(leaves, leavesById, {
        query: "",
        status: "total",
        filter: { flaky: false, retry: false, new: false },
        direction: "desc",
        sortBy: "order",
      });

      expect(result).toEqual([
        expect.objectContaining({ name: "a1" }),
        expect.objectContaining({ name: "b2" }),
        expect.objectContaining({ name: "c3" }),
      ]);
    });
  });

  describe("createRecursiveTree", () => {
    it("creates recursive tree with filtered and sorted leaves objects", () => {
      const baseDate = Date.now();
      const group = makeGroup({
        leaves: ["a1"],
        groups: ["a1"],
      });
      const leavesById = {
        a1: makeLeaf({
          name: "a1",
          start: baseDate,
        }),
        b2: makeLeaf({
          name: "b2",
          start: baseDate + 1000,
        }),
        c3: makeLeaf({
          name: "c3",
          start: baseDate + 2000,
        }),
      };
      const groupsById = {
        a1: makeGroup({
          leaves: ["b2"],
          groups: ["b2"],
        }),
        b2: makeGroup({
          leaves: ["c3"],
          groups: [],
        }),
      };
      const result = createRecursiveTree({
        group,
        leavesById,
        groupsById,
        filterOptions: {
          query: "",
          status: "total",
          filter: { flaky: false, retry: false, new: false },
          sortBy: "alphabet",
          direction: "asc",
        },
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

    it("keeps problem-heavy groups first when sorting by status in descending order", () => {
      const group = makeGroup({
        leaves: [],
        groups: ["passedHeavy", "failedAlpha", "brokenGroup", "failedZulu"],
      });
      const leavesById = {
        failedAlphaTest: makeLeaf({
          name: "failedAlphaTest",
          status: "failed",
        }),
        failedZuluTest: makeLeaf({
          name: "failedZuluTest",
          status: "failed",
        }),
        brokenTest1: makeLeaf({
          name: "brokenTest1",
          status: "broken",
        }),
        brokenTest2: makeLeaf({
          name: "brokenTest2",
          status: "broken",
        }),
        passedTest1: makeLeaf({
          name: "passedTest1",
          status: "passed",
        }),
        passedTest2: makeLeaf({
          name: "passedTest2",
          status: "passed",
        }),
      };
      const groupsById = {
        passedHeavy: makeGroup({
          name: "passedHeavy",
          leaves: ["passedTest1", "passedTest2"],
          groups: [],
        }),
        brokenGroup: makeGroup({
          name: "brokenGroup",
          leaves: ["brokenTest1", "brokenTest2"],
          groups: [],
        }),
        failedAlpha: makeGroup({
          name: "failedAlpha",
          leaves: ["failedAlphaTest"],
          groups: [],
        }),
        failedZulu: makeGroup({
          name: "failedZulu",
          leaves: ["failedZuluTest"],
          groups: [],
        }),
      };
      const result = createRecursiveTree({
        group,
        leavesById,
        groupsById,
        filterOptions: {
          query: "",
          status: "total",
          filter: {
            flaky: false,
            retry: false,
            new: false,
          },
          sortBy: "status",
          direction: "desc",
        },
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
