import { describe, expect, it, vi } from "vitest";

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
    });

    expect(tooltip).toHaveBeenCalledWith("resolution.issue");
    expect(leaf.tooltips?.resolution).toBe("localized:resolution.issue");
  });
});
