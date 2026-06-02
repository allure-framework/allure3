import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "colorScheme";

vi.mock("@allurereport/web-commons", () => ({
  themeStore: { value: { current: "light", selected: "auto" } },
}));

describe("stores > colorScheme", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();

    vi.mock("@allurereport/web-commons", () => ({
      themeStore: { value: { current: "light", selected: "auto" } },
    }));
  });

  it("defaults to allure family when localStorage is empty", async () => {
    const { selectedFamily } = await import("../../src/stores/colorScheme/store.js");
    expect(selectedFamily.value).toBe("allure");
  });

  it("restores family from localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "github");
    const { selectedFamily } = await import("../../src/stores/colorScheme/store.js");
    expect(selectedFamily.value).toBe("github");
  });

  it("falls back to allure for unknown localStorage value", async () => {
    localStorage.setItem(STORAGE_KEY, "unknown-theme");
    const { selectedFamily } = await import("../../src/stores/colorScheme/store.js");
    expect(selectedFamily.value).toBe("allure");
  });

  it("setThemeFamily updates selectedFamily", async () => {
    const { selectedFamily, setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("dracula");
    expect(selectedFamily.value).toBe("dracula");
  });

  it("setThemeFamily persists to localStorage", async () => {
    const { setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("nord");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("nord");
  });

  it("colorScheme resolves to light variant in light mode", async () => {
    vi.doMock("@allurereport/web-commons", () => ({
      themeStore: { value: { current: "light", selected: "light" } },
    }));
    const { selectedFamily, colorScheme, setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("github");
    expect(colorScheme.value).toBe("github-light");
  });

  it("colorScheme resolves to dark variant in dark mode", async () => {
    vi.doMock("@allurereport/web-commons", () => ({
      themeStore: { value: { current: "dark", selected: "dark" } },
    }));
    const { selectedFamily, colorScheme, setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("github");
    expect(colorScheme.value).toBe("github-dark");
  });

  it("colorScheme returns default for allure family", async () => {
    const { colorScheme, setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("allure");
    expect(colorScheme.value).toBe("default");
  });

  it("dark-only themes return same scheme regardless of mode", async () => {
    const { colorScheme, setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("tokyo-night");
    expect(colorScheme.value).toBe("tokyo-night");
  });

  it("colorScheme applies data-color-scheme attribute to html", async () => {
    const { setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("dracula");
    expect(document.documentElement.getAttribute("data-color-scheme")).toBe("dracula");
  });

  it("allure family removes data-color-scheme attribute", async () => {
    document.documentElement.setAttribute("data-color-scheme", "dracula");
    const { setThemeFamily } = await import("../../src/stores/colorScheme/store.js");
    setThemeFamily("allure");
    expect(document.documentElement.getAttribute("data-color-scheme")).toBeNull();
  });
});
