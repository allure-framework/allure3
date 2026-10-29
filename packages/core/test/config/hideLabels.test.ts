import { shouldHideLabel } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import { describe, expect, it } from "vite-plus/test";

import { resolveHideLabels } from "../../src/config/hideLabels.js";

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

  it.each(["${{ name. }}", 42 as unknown as string])("rejects invalid matcher %s during resolution", (matcher) => {
    const resolve = () => resolveHideLabels(["owner", matcher]);

    expect(resolve).toThrow("hideLabels[1]");
  });
});
