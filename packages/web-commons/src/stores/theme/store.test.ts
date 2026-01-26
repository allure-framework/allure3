import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { THEME_AUTO, THEME_DARK, THEME_LIGHT, STORAGE_KEY } from "./constants.js";
import * as dataModule from "../../data.js";
import * as utilsModule from "./utils.js";

const mockMediaQuery = {
  matches: false,
  media: "(prefers-color-scheme: dark)",
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as MediaQueryList;

const getMockMatchMedia = () => {
  return vi.spyOn(window, "matchMedia").mockReturnValue(mockMediaQuery);
};

const getMockGetPrefersColorSchemeMQ = () =>  {
  return vi.spyOn(utilsModule, "getPrefersColorSchemeMQ").mockReturnValue(mockMediaQuery);
};

describe("theme store", () => {
  let mockGetPrefersColorSchemeMQ: ReturnType<typeof getMockGetPrefersColorSchemeMQ>;
  let mockMatchMedia: ReturnType<typeof getMockMatchMedia>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();


    mockMatchMedia = getMockMatchMedia();

    vi.spyOn(dataModule, "getReportOptions").mockReturnValue({});

    mockGetPrefersColorSchemeMQ = getMockGetPrefersColorSchemeMQ();

    // Reset modules to get fresh state
    vi.resetModules();
});

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("userTheme signal", () => {
    it("should initialize with THEME_AUTO", async () => {
      const { userTheme } = await import("./store.js");
      expect(userTheme.value).toBe(THEME_AUTO);
    });

    it("should restore from localStorage", async () => {
      localStorage.setItem(STORAGE_KEY, THEME_DARK);

      // Reset modules to clear imported state before import
      vi.resetModules();

      // Re-import after localStorage was set and modules were reset
      const { userTheme } = await import("./store.js");
      expect(userTheme.value).toBe(THEME_DARK);
    });

    it("should fallback to THEME_AUTO when invalid value in localStorage", async () => {
      localStorage.setItem(STORAGE_KEY, "invalid");
      vi.resetModules();

      const { userTheme } = await import("./store.js");
      // When invalid value, onRestore returns reportConfigTheme ?? THEME_AUTO
      // Since reportConfigTheme is undefined by default, it should be THEME_AUTO
      expect(userTheme.value).toBe(THEME_AUTO);
    });
  });

  describe("preferredTheme signal", () => {
    it("should initialize with light theme when prefers-color-scheme is light", async () => {
      const anotherMockMediaQuery = {
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;

      mockMatchMedia.mockReturnValue(anotherMockMediaQuery);
      mockGetPrefersColorSchemeMQ.mockReturnValue(anotherMockMediaQuery);

      const { preferredTheme } = await import("./store.js");
      expect(preferredTheme.value).toBe(THEME_LIGHT);
    });

    it("should initialize with dark theme when prefers-color-scheme is dark", async () => {
      const anotherMockMediaQuery = {
        matches: true,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;

      mockMatchMedia.mockReturnValue(anotherMockMediaQuery);
      mockGetPrefersColorSchemeMQ.mockReturnValue(anotherMockMediaQuery);

      const { preferredTheme } = await import("./store.js");
      expect(preferredTheme.value).toBe(THEME_DARK);
    });

    it("should initialize with light theme when window is undefined", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - intentionally removing window for test
      delete globalThis.window;

      const { preferredTheme } = await import("./store.js");
      expect(preferredTheme.value).toBe(THEME_LIGHT);

      globalThis.window = originalWindow;
    });
  });

  describe("currentTheme computed", () => {
    it("should return userTheme when userTheme is not auto", async () => {
      const { userTheme, currentTheme } = await import("./store.js");
      userTheme.value = THEME_DARK;

      expect(currentTheme.value).toBe(THEME_DARK);
    });

    it("should return preferredTheme when userTheme is auto", async () => {
      const { userTheme, preferredTheme, currentTheme } = await import("./store.js");
      userTheme.value = THEME_AUTO;
      preferredTheme.value = THEME_DARK;

      expect(currentTheme.value).toBe(THEME_DARK);
    });

    it("should update when preferredTheme changes and userTheme is auto", async () => {
      const { userTheme, preferredTheme, currentTheme } = await import("./store.js");
      userTheme.value = THEME_AUTO;
      preferredTheme.value = THEME_LIGHT;

      expect(currentTheme.value).toBe(THEME_LIGHT);

      preferredTheme.value = THEME_DARK;

      expect(currentTheme.value).toBe(THEME_DARK);
    });
  });

  describe("themeStore computed", () => {
    it("should return current and selected theme", async () => {
      const { userTheme, themeStore } = await import("./store.js");
      userTheme.value = THEME_LIGHT;

      expect(themeStore.value.current).toBe(THEME_LIGHT);
      expect(themeStore.value.selected).toBe(THEME_LIGHT);
    });

    it("should return auto as selected and preferred as current when userTheme is auto", async () => {
      const { userTheme, preferredTheme, themeStore } = await import("./store.js");
      userTheme.value = THEME_AUTO;
      preferredTheme.value = THEME_DARK;

      expect(themeStore.value.current).toBe(THEME_DARK);
      expect(themeStore.value.selected).toBe(THEME_AUTO);
    });

    it("should update when userTheme changes", async () => {
      const { userTheme, themeStore } = await import("./store.js");
      userTheme.value = THEME_LIGHT;

      expect(themeStore.value.selected).toBe(THEME_LIGHT);

      userTheme.value = THEME_DARK;

      expect(themeStore.value.selected).toBe(THEME_DARK);
    });
  });
});
