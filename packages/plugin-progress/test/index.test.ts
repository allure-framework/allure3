import { describe, expect, it } from "vitest";

import ProgressPlugin, { ProgressConsolePresenter, resolveProgressConsoleMode } from "../src/index.js";

describe("plugin-progress exports", () => {
  it("should expose the plugin as the default export", () => {
    expect(ProgressPlugin).toBeDefined();
  });

  it("should expose shared console helpers", () => {
    expect(ProgressConsolePresenter).toBeDefined();
    expect(resolveProgressConsoleMode(undefined, false)).toBe("rich");
  });
});
