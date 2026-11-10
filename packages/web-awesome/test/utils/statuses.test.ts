import type { ReportTree, ReportTreeLeaf } from "types";
import { describe, expect, it } from "vite-plus/test";

import { getUnresolvedStatusCounts } from "@/utils/statuses";

const leaf = (
  nodeId: string,
  status: ReportTreeLeaf["status"],
  resolutionStatus?: ReportTreeLeaf["resolutionStatus"],
  resolutionState?: ReportTreeLeaf["resolutionState"],
): ReportTreeLeaf => ({
  nodeId,
  id: nodeId,
  name: nodeId,
  status,
  duration: 1,
  groupOrder: 1,
  flaky: false,
  retry: false,
  resolutionStatus,
  resolutionState,
});

const tree = (leaves: ReportTreeLeaf[]): ReportTree => ({
  root: { groups: [], leaves: leaves.map(({ nodeId }) => nodeId) },
  groupsById: {},
  leavesById: Object.fromEntries(leaves.map((item) => [item.nodeId, item])),
});

describe("utils > statuses", () => {
  it("should count unresolved failed and broken results only", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 6, failed: 4, broken: 1, passed: 1 },
      {
        default: tree([
          leaf("failed-unresolved", "failed", "none"),
          leaf("failed-issue", "failed", "issue"),
          leaf("failed-muted", "failed", "muted"),
          leaf("failed-outdated-muted", "failed", "muted", "outdated"),
          leaf("broken-unresolved", "broken", "none"),
          leaf("passed", "passed"),
        ]),
      },
      "default",
    );

    expect(counts).toEqual({ failed: 2, broken: 1, passed: 1 });
  });

  it("should aggregate counts across environments", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 4, failed: 3, passed: 1 },
      {
        "env-a": tree([leaf("failed-env-a", "failed", "none"), leaf("issue-env-a", "failed", "issue")]),
        "env-b": tree([leaf("failed-env-b", "failed", "none"), leaf("passed-env-b", "passed")]),
      },
    );

    expect(counts).toEqual({ failed: 2, passed: 1 });
  });

  it("should fall back to raw stats until the requested environment tree is available", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 3, failed: 2, broken: 1, passed: undefined },
      { default: tree([leaf("failed-default", "failed", "none")]) },
      "env-a",
    );

    expect(counts).toEqual({ failed: 2, broken: 1, passed: undefined, skipped: undefined, unknown: undefined });
  });
});
