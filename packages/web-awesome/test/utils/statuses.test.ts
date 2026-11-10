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

    expect(counts).toEqual({ failed: 2, broken: 1, passed: 1, skipped: 0, unknown: 0 });
  });

  it("should aggregate counts across environments", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 4, failed: 3, passed: 1 },
      {
        "env-a": tree([leaf("failed-env-a", "failed", "none"), leaf("issue-env-a", "failed", "issue")]),
        "env-b": tree([leaf("failed-env-b", "failed", "none"), leaf("passed-env-b", "passed")]),
      },
    );

    expect(counts).toEqual({ failed: 2, broken: 0, passed: 1, skipped: 0, unknown: 0 });
  });

  it("should report zero failed and broken when every result of that status is resolved", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 4, failed: 2, broken: 1, passed: 1 },
      {
        default: tree([
          leaf("failed-issue", "failed", "issue"),
          leaf("failed-muted", "failed", "muted", "active"),
          leaf("broken-accepted", "broken", "accepted"),
          leaf("passed", "passed"),
        ]),
      },
      "default",
    );

    expect(counts).toEqual({ failed: 0, broken: 0, passed: 1, skipped: 0, unknown: 0 });
  });

  it("should report zero failed when every failed result is resolved in every environment", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 3, failed: 2, passed: 1 },
      {
        "env-a": tree([leaf("issue-env-a", "failed", "issue")]),
        "env-b": tree([leaf("muted-env-b", "failed", "muted"), leaf("passed-env-b", "passed")]),
      },
    );

    expect(counts.failed).toBe(0);
    expect(counts.passed).toBe(1);
  });

  it("should fall back to raw stats until the requested environment tree is available", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 3, failed: 2, broken: 1, passed: undefined },
      { default: tree([leaf("failed-default", "failed", "none")]) },
      "env-a",
    );

    expect(counts).toEqual({ failed: 2, broken: 1, passed: undefined, skipped: undefined, unknown: undefined });
  });

  it("should fall back to raw stats for all environments until every environment tree is loaded", () => {
    // Only the passing environment tree is loaded, the failing one is not fetched yet
    const counts = getUnresolvedStatusCounts(
      { total: 2, failed: 1, passed: 1 },
      { "env-pass": tree([leaf("passed-env-pass", "passed")]) },
      "",
      ["env-pass", "env-fail"],
    );

    expect(counts).toEqual({ failed: 1, broken: undefined, passed: 1, skipped: undefined, unknown: undefined });
  });

  it("should count unresolved results across all environments once every environment tree is loaded", () => {
    const counts = getUnresolvedStatusCounts(
      { total: 3, failed: 2, passed: 1 },
      {
        "env-pass": tree([leaf("passed-env-pass", "passed")]),
        "env-fail": tree([leaf("failed-env-fail", "failed", "none"), leaf("muted-env-fail", "failed", "muted")]),
      },
      "",
      ["env-pass", "env-fail"],
    );

    expect(counts).toEqual({ failed: 1, broken: 0, passed: 1, skipped: 0, unknown: 0 });
  });
});
