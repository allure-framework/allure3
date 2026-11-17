import { describe, expect, it, vi } from "vite-plus/test";

import { createLeafLocalizer } from "../../src/utils/tree";

describe("utils > tree", () => {
  it("should localize resolution tooltip with the resolution description key", () => {
    const tooltip = vi.fn((key: string) => `localized:${key}`);
    const localizeLeaf = createLeafLocalizer({ tooltip });
    const leaf = localizeLeaf({
      id: "history-1",
      nodeId: "tr-1",
      name: "failed test",
      resolution: "issue",
      status: "failed",
      flaky: false,
      retry: false,
    });

    expect(tooltip).toHaveBeenCalledWith("resolution.issue");
    expect(leaf.tooltips?.resolution).toBe("localized:resolution.issue");
  });

  it("should put the leaf's own start and stop on the duration tooltip", () => {
    const timeRange = vi.fn((start?: number, stop?: number) => `range:${start}-${stop}`);
    const localizeLeaf = createLeafLocalizer({ tooltip: (key: string) => key, timeRange });
    const leaf = localizeLeaf({
      nodeId: "tr-1",
      name: "slow test",
      status: "passed",
      start: 1779887536194,
      stop: 1779887537802,
      duration: 1608,
      flaky: false,
      retry: false,
    });

    expect(timeRange).toHaveBeenCalledWith(1779887536194, 1779887537802);
    expect(leaf.tooltips?.duration).toBe("range:1779887536194-1779887537802");
  });

  it("should leave the duration tooltip empty when no formatter is supplied", () => {
    const localizeLeaf = createLeafLocalizer({ tooltip: (key: string) => key });
    const leaf = localizeLeaf({
      nodeId: "tr-1",
      name: "slow test",
      status: "passed",
      duration: 1608,
      flaky: false,
      retry: false,
    });

    expect(leaf.tooltips?.duration).toBeUndefined();
  });
});
