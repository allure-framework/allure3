import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { testPlatform } from "../src/platform.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("testPlatform", () => {
  it.each([
    ["macOS", "Win32", true],
    ["Windows", "MacIntel", false],
    ["Linux", "MacIntel", false],
    [undefined, "MacIntel", true],
    [null, "MacIntel", true],
    ["", "MacIntel", false],
    [undefined, "Win32", false],
    [undefined, "Linux x86_64", false],
    [undefined, "", false],
  ])("matches the preferred platform %s with legacy platform %s", (preferred, legacy, expected) => {
    vi.stubGlobal("window", { navigator: { userAgentData: { platform: preferred }, platform: legacy } });
    expect(testPlatform(/^Mac/i)).toBe(expected);
  });

  it("does not read browser globals during import and reads the current platform when called", async () => {
    vi.resetModules();
    const readNavigator = vi.fn(() => ({ platform: "MacIntel" }));
    vi.stubGlobal("window", {
      get navigator() {
        return readNavigator();
      },
    });
    const platform = await import("../src/platform.js");
    expect(readNavigator).not.toHaveBeenCalled();
    expect(platform.testPlatform(/^Mac/i)).toBe(true);
    vi.stubGlobal("window", { navigator: { platform: "Windows" } });
    expect(platform.testPlatform(/^Mac/i)).toBe(false);
    expect(platform.testPlatform(/^Win/i)).toBe(true);
  });
});
