import { shouldHideLabel } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveHideLabels } from "../../src/config/hideLabels.js";

afterEach(() => vi.restoreAllMocks());

describe("resolveHideLabels", () => {
  it("leaves omitted configuration unset", () => {
    const resolved = resolveHideLabels(undefined);

    expect(resolved).toBeUndefined();
  });

  it("combines exact names, expressions and native regex without mutating inputs", () => {
    const native = /^tag$/g;
    native.lastIndex = 2;
    const input = [
      "owner",
      native,
      "${{ name.matches('^internal_') }}",
      "${{ name.endsWith('_secret') }}",
      "/owner/",
      "$${{ literal }}",
    ];

    const resolved = resolveHideLabels(input);
    const hidden = [
      "owner",
      "OWNER",
      "tag",
      "internal_id",
      "a_secret",
      "public",
      "_private",
      "/owner/",
      "${{ literal }}",
    ].map((name) => shouldHideLabel(name, resolved));

    expect(resolved?.[1]).toBe(native);
    expect(native.lastIndex).toBe(2);
    expect(input[2]).toBe("${{ name.matches('^internal_') }}");
    expect(hidden).toEqual([true, false, true, true, true, false, true, true, true]);
  });

  it("rejects a non-array hidden-label configuration", () => {
    const input = "owner" as unknown as Config["hideLabels"];

    const resolve = () => resolveHideLabels(input);

    expect(resolve).toThrow("hideLabels must be an array");
  });

  it("warns and disables malformed entries while retaining valid predicates", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resolved = resolveHideLabels([
      "owner",
      "${{ name. }}",
      "${{ name.startsWith('internal_') }}",
      42 as unknown as string,
    ]);
    const hidden = ["owner", "internal_id", "public"].map((name) => shouldHideLabel(name, resolved));

    expect(hidden).toEqual([true, true, false]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("hideLabels[1]"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("hideLabels[3]"));
  });
});
