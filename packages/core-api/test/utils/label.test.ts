import { describe, expect, it } from "vitest";

import { shouldHideLabel } from "../../src/utils/label.js";

describe("label utils", () => {
  it("should hide underscore-prefixed labels by default", () => {
    expect(shouldHideLabel("_fallbackTestCaseId")).toBe(true);
    expect(shouldHideLabel("owner")).toBe(false);
  });

  it("should hide labels by exact string matcher", () => {
    expect(shouldHideLabel("owner", ["owner"])).toBe(true);
    expect(shouldHideLabel("tag", ["owner"])).toBe(false);
  });

  it("should hide labels by regexp matcher", () => {
    expect(shouldHideLabel("package", [/^pack/])).toBe(true);
    expect(shouldHideLabel("owner", [/^pack/])).toBe(false);
  });

  it("should handle stateful regexp matchers deterministically", () => {
    const matcher = /^owner$/g;

    expect(shouldHideLabel("owner", [matcher])).toBe(true);
    expect(shouldHideLabel("owner", [matcher])).toBe(true);
    expect(matcher.lastIndex).toBe(0);
  });
});
