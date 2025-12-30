import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTreeFilters,
  setTestTypeFilter,
  setTransitionFilter,
  setTreeDirection,
  setTreeQuery,
  setTreeSortBy,
  setTreeStatus,
  treeDirection,
  treeFilter,
  treeQuery,
  treeSortBy,
  treeStatus,
} from "@/stores/treeFilters";

const defaultFilter = {
  flaky: false,
  retry: false,
  new: false,
  fixed: false,
  regressed: false,
  malfunctioned: false,
};

describe("stores > treeFilters", () => {
  beforeEach(() => {
    // Reset all signals to default state before each test
    treeQuery.value = "";
    treeStatus.value = "total";
    treeSortBy.value = "order";
    treeDirection.value = "asc";
    treeFilter.value = { ...defaultFilter };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("clearTreeFilters", () => {
    it("should reset query, status and filters to default state", () => {
      // Set some non-default values
      treeQuery.value = "test query";
      treeStatus.value = "passed";
      treeFilter.value = {
        flaky: true,
        retry: true,
        new: true,
        fixed: true,
        regressed: true,
        malfunctioned: true,
      };

      clearTreeFilters();

      expect(treeQuery.value).toBe("");
      expect(treeStatus.value).toBe("total");
      expect(treeFilter.value).toEqual(defaultFilter);
    });

    it("should not reset sortBy and direction", () => {
      treeSortBy.value = "duration";
      treeDirection.value = "desc";

      clearTreeFilters();

      expect(treeSortBy.value).toBe("duration");
      expect(treeDirection.value).toBe("desc");
    });
  });

  describe("setTreeQuery", () => {
    it("should update query", () => {
      setTreeQuery("search term");

      expect(treeQuery.value).toBe("search term");
    });

    it("should update query to empty string", () => {
      treeQuery.value = "some query";

      setTreeQuery("");

      expect(treeQuery.value).toBe("");
    });
  });

  describe("setTreeStatus", () => {
    it("should update status to passed", () => {
      setTreeStatus("passed");

      expect(treeStatus.value).toBe("passed");
    });

    it("should update status to failed", () => {
      setTreeStatus("failed");

      expect(treeStatus.value).toBe("failed");
    });

    it("should update status to broken", () => {
      setTreeStatus("broken");

      expect(treeStatus.value).toBe("broken");
    });

    it("should update status to skipped", () => {
      setTreeStatus("skipped");

      expect(treeStatus.value).toBe("skipped");
    });

    it("should update status to total", () => {
      treeStatus.value = "passed";

      setTreeStatus("total");

      expect(treeStatus.value).toBe("total");
    });
  });

  describe("setTreeSortBy", () => {
    it("should update sortBy to duration", () => {
      setTreeSortBy("duration");

      expect(treeSortBy.value).toBe("duration");
    });

    it("should update sortBy to status", () => {
      setTreeSortBy("status");

      expect(treeSortBy.value).toBe("status");
    });

    it("should update sortBy to alphabet", () => {
      setTreeSortBy("alphabet");

      expect(treeSortBy.value).toBe("alphabet");
    });

    it("should update sortBy to order", () => {
      treeSortBy.value = "duration";

      setTreeSortBy("order");

      expect(treeSortBy.value).toBe("order");
    });
  });

  describe("setTreeDirection", () => {
    it("should update direction to desc", () => {
      setTreeDirection("desc");

      expect(treeDirection.value).toBe("desc");
    });

    it("should update direction to asc", () => {
      treeDirection.value = "desc";

      setTreeDirection("asc");

      expect(treeDirection.value).toBe("asc");
    });
  });

  describe("setTestTypeFilter", () => {
    it("should enable flaky filter", () => {
      setTestTypeFilter("flaky", true);

      expect(treeFilter.value.flaky).toBe(true);
    });

    it("should disable flaky filter", () => {
      treeFilter.value = { ...defaultFilter, flaky: true };

      setTestTypeFilter("flaky", false);

      expect(treeFilter.value.flaky).toBe(false);
    });

    it("should enable retry filter", () => {
      setTestTypeFilter("retry", true);

      expect(treeFilter.value.retry).toBe(true);
    });

    it("should disable retry filter", () => {
      treeFilter.value = { ...defaultFilter, retry: true };

      setTestTypeFilter("retry", false);

      expect(treeFilter.value.retry).toBe(false);
    });

    it("should enable both flaky and retry filters independently", () => {
      setTestTypeFilter("flaky", true);
      setTestTypeFilter("retry", true);

      expect(treeFilter.value.flaky).toBe(true);
      expect(treeFilter.value.retry).toBe(true);
    });

    it("should not affect transition filters", () => {
      treeFilter.value = { ...defaultFilter, new: true };

      setTestTypeFilter("flaky", true);

      expect(treeFilter.value.new).toBe(true);
      expect(treeFilter.value.flaky).toBe(true);
    });
  });

  describe("setTransitionFilter", () => {
    it("should enable new filter", () => {
      setTransitionFilter("new", true);

      expect(treeFilter.value.new).toBe(true);
    });

    it("should enable fixed filter", () => {
      setTransitionFilter("fixed", true);

      expect(treeFilter.value.fixed).toBe(true);
    });

    it("should enable regressed filter", () => {
      setTransitionFilter("regressed", true);

      expect(treeFilter.value.regressed).toBe(true);
    });

    it("should enable malfunctioned filter", () => {
      setTransitionFilter("malfunctioned", true);

      expect(treeFilter.value.malfunctioned).toBe(true);
    });

    it("should disable the previous transition when enabling a new one", () => {
      setTransitionFilter("new", true);
      expect(treeFilter.value.new).toBe(true);

      setTransitionFilter("fixed", true);

      expect(treeFilter.value.new).toBe(false);
      expect(treeFilter.value.fixed).toBe(true);
      expect(treeFilter.value.regressed).toBe(false);
      expect(treeFilter.value.malfunctioned).toBe(false);
    });

    it("should disable all other transitions when enabling regressed", () => {
      treeFilter.value = { ...defaultFilter, new: true, fixed: true };

      setTransitionFilter("regressed", true);

      expect(treeFilter.value.new).toBe(false);
      expect(treeFilter.value.fixed).toBe(false);
      expect(treeFilter.value.regressed).toBe(true);
      expect(treeFilter.value.malfunctioned).toBe(false);
    });

    it("should allow only one transition to be enabled at a time", () => {
      setTransitionFilter("new", true);
      setTransitionFilter("fixed", true);
      setTransitionFilter("regressed", true);
      setTransitionFilter("malfunctioned", true);

      expect(treeFilter.value.new).toBe(false);
      expect(treeFilter.value.fixed).toBe(false);
      expect(treeFilter.value.regressed).toBe(false);
      expect(treeFilter.value.malfunctioned).toBe(true);
    });

    it("should disable the transition when value is false", () => {
      treeFilter.value = { ...defaultFilter, new: true };

      setTransitionFilter("new", false);

      expect(treeFilter.value.new).toBe(false);
    });

    it("should disable all transitions when disabling the active one", () => {
      setTransitionFilter("fixed", true);

      setTransitionFilter("fixed", false);

      expect(treeFilter.value.new).toBe(false);
      expect(treeFilter.value.fixed).toBe(false);
      expect(treeFilter.value.regressed).toBe(false);
      expect(treeFilter.value.malfunctioned).toBe(false);
    });

    it("should not affect test type filters (flaky, retry)", () => {
      treeFilter.value = { ...defaultFilter, flaky: true, retry: true };

      setTransitionFilter("new", true);

      expect(treeFilter.value.flaky).toBe(true);
      expect(treeFilter.value.retry).toBe(true);
      expect(treeFilter.value.new).toBe(true);
    });
  });
});
