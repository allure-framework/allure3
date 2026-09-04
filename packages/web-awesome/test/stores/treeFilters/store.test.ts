import { buildFilterPredicate } from "@allurereport/web-commons";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { AwesomeFilterGroupSimple } from "../../../src/stores/treeFilters/model.js";
import {
  hasActiveTreeFilters,
  setTreeFilter,
  treeNonQueryFilters,
  treeQuickFilters,
} from "../../../src/stores/treeFilters/store.js";
import { isSeverityFilter, isTransitionFilter } from "../../../src/stores/treeFilters/utils.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("severity");
  await label("coverage", "filters");
});

const setSearch = (search: string) => {
  window.history.replaceState(null, "", `/${search}`);
  window.dispatchEvent(new Event("replaceState"));
};

const severityQuickFilter = () => {
  const filter = treeQuickFilters.value.find(isSeverityFilter);

  expect(filter).toBeDefined();

  return filter as AwesomeFilterGroupSimple;
};

const selectedSeverities = (group: AwesomeFilterGroupSimple) =>
  group.value.map((v) => (v.type === "field" && v.value.type === "string" ? v.value.value : undefined));

describe("stores > treeFilters > severity", () => {
  beforeEach(() => {
    setSearch("");
  });

  it("should always expose the severity quick filter", () => {
    expect(selectedSeverities(severityQuickFilter())).toEqual([]);
  });

  it("should read selected severities from the url", () => {
    setSearch("?severity=blocker&severity=none");

    expect(selectedSeverities(severityQuickFilter())).toEqual(["blocker", "none"]);
    expect(hasActiveTreeFilters.value).toBe(true);
  });

  it("should drop unknown severity values", () => {
    setSearch("?severity=urgent&severity=critical");

    expect(selectedSeverities(severityQuickFilter())).toEqual(["critical"]);
  });

  it("should not apply the severity filter when nothing is selected", () => {
    expect(treeNonQueryFilters.value.filter(isSeverityFilter)).toHaveLength(0);
    expect(hasActiveTreeFilters.value).toBe(false);
  });

  it("should apply the severity filter when values are selected", () => {
    setSearch("?severity=blocker");

    expect(treeNonQueryFilters.value.filter(isSeverityFilter)).toHaveLength(1);
  });

  it("should write the selected severities back to the url", () => {
    const group = severityQuickFilter();

    setTreeFilter({
      ...group,
      value: [
        {
          type: "field",
          value: { key: "severity", value: "minor", type: "string", strict: true },
          logicalOperator: "OR",
        },
      ],
    });

    expect(new URL(window.location.href).searchParams.getAll("severity")).toEqual(["minor"]);
    expect(selectedSeverities(severityQuickFilter())).toEqual(["minor"]);
  });

  describe("filter predicate", () => {
    const leaves = [
      { nodeId: "1", severity: "blocker" },
      { nodeId: "2", severity: "critical" },
      { nodeId: "3", severity: "normal" },
      { nodeId: "4", severity: "none" },
    ];

    const matchingNodeIds = () => {
      const predicate = buildFilterPredicate(treeNonQueryFilters.value);

      return leaves.filter(predicate).map(({ nodeId }) => nodeId);
    };

    it("should match a single selected severity", () => {
      setSearch("?severity=blocker");

      expect(matchingNodeIds()).toEqual(["1"]);
    });

    it("should match any of the selected severities", () => {
      setSearch("?severity=blocker&severity=critical");

      expect(matchingNodeIds()).toEqual(["1", "2"]);
    });

    it("should match test results without a severity label", () => {
      setSearch("?severity=none");

      expect(matchingNodeIds()).toEqual(["4"]);
    });

    it("should combine the severity filter with other filters", () => {
      setSearch("?severity=blocker&severity=none&status=failed");

      const predicate = buildFilterPredicate(treeNonQueryFilters.value);
      const statusLeaves = [
        { nodeId: "1", severity: "blocker", status: "failed" },
        { nodeId: "2", severity: "blocker", status: "passed" },
        { nodeId: "3", severity: "none", status: "failed" },
        { nodeId: "4", severity: "normal", status: "failed" },
      ];

      expect(statusLeaves.filter(predicate).map(({ nodeId }) => nodeId)).toEqual(["1", "3"]);
    });
  });
});

describe("stores > treeFilters > transition", () => {
  beforeEach(() => {
    setSearch("");
  });

  const leaves = [
    { nodeId: "1", transition: "new" },
    { nodeId: "2", transition: "fixed" },
    { nodeId: "3", transition: "regressed" },
  ];

  const matchingNodeIds = () => {
    const predicate = buildFilterPredicate(treeNonQueryFilters.value);

    return leaves.filter(predicate).map(({ nodeId }) => nodeId);
  };

  it("should match a single selected transition", () => {
    setSearch("?transition=new");

    expect(matchingNodeIds()).toEqual(["1"]);
  });

  it("should match any of the selected transitions", () => {
    setSearch("?transition=new&transition=fixed");

    expect(treeNonQueryFilters.value.filter(isTransitionFilter)).toHaveLength(1);
    expect(matchingNodeIds()).toEqual(["1", "2"]);
  });
});
