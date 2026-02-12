import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SELECTED_THEMES, THEME_AUTO, THEME_DARK, THEME_LIGHT } from "../../src/stores/theme/constants.js";

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

const getMockSetAttribute = () => {
  return vi.spyOn(document.documentElement, "setAttribute");
};

const getMockMatchMedia = () => {
  return vi.spyOn(window, "matchMedia").mockReturnValue(mockMediaQuery);
};

describe("theme actions", () => {
  let mockSetAttribute: ReturnType<typeof getMockSetAttribute>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    mockSetAttribute = getMockSetAttribute();

    getMockMatchMedia();

    // Reset modules to get fresh state
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("setUserTheme", () => {
    it("should set userTheme to the provided theme", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { setUserTheme } = await import("../../src/stores/theme/actions.js");

      setUserTheme(THEME_LIGHT);

      expect(userTheme.value).toBe(THEME_LIGHT);
    });

    it("should set userTheme to dark", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { setUserTheme } = await import("../../src/stores/theme/actions.js");

      setUserTheme(THEME_DARK);

      expect(userTheme.value).toBe(THEME_DARK);
    });

    it("should set userTheme to auto", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { setUserTheme } = await import("../../src/stores/theme/actions.js");
      userTheme.value = THEME_LIGHT;

      setUserTheme(THEME_AUTO);

      expect(userTheme.value).toBe(THEME_AUTO);
    });
  });

  describe("toggleUserTheme", () => {
    it("should toggle from light to dark", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { toggleUserTheme } = await import("../../src/stores/theme/actions.js");
      userTheme.value = THEME_LIGHT;

      toggleUserTheme();

      expect(userTheme.value).toBe(THEME_DARK);
    });

    it("should toggle from dark to auto", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { toggleUserTheme } = await import("../../src/stores/theme/actions.js");
      userTheme.value = THEME_DARK;

      toggleUserTheme();

      expect(userTheme.value).toBe(THEME_AUTO);
    });

    it("should toggle from auto to light", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { toggleUserTheme } = await import("../../src/stores/theme/actions.js");
      userTheme.value = THEME_AUTO;

      toggleUserTheme();

      expect(userTheme.value).toBe(THEME_LIGHT);
    });

    it("should cycle through all themes", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { toggleUserTheme } = await import("../../src/stores/theme/actions.js");

      // Start from light
      userTheme.value = THEME_LIGHT;

      // Toggle through all themes
      for (let i = 0; i < SELECTED_THEMES.length; i++) {
        const expectedTheme = SELECTED_THEMES[(i + 1) % SELECTED_THEMES.length];
        toggleUserTheme();
        expect(userTheme.value).toBe(expectedTheme);
      }
    });

    it("should handle multiple toggles correctly", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      const { toggleUserTheme } = await import("../../src/stores/theme/actions.js");
      userTheme.value = THEME_LIGHT;

      toggleUserTheme();
      expect(userTheme.value).toBe(THEME_DARK);

      toggleUserTheme();
      expect(userTheme.value).toBe(THEME_AUTO);

      toggleUserTheme();
      expect(userTheme.value).toBe(THEME_LIGHT);
    });
  });

  describe("initThemeStore", () => {
    it("should set data-theme attribute on document.documentElement", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      await import("../../src/stores/theme/actions.js"); // Trigger initialization
      userTheme.value = THEME_LIGHT;

      // Wait for effect to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetAttribute).toHaveBeenCalledWith("data-theme", THEME_LIGHT);
    });

    it("should update data-theme when currentTheme changes", async () => {
      const { userTheme } = await import("../../src/stores/theme/store.js");
      await import("../../src/stores/theme/actions.js"); // Trigger initialization
      userTheme.value = THEME_LIGHT;

      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSetAttribute.mockClear();

      userTheme.value = THEME_DARK;

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetAttribute).toHaveBeenCalledWith("data-theme", THEME_DARK);
    });

    it("should update data-theme when userTheme is auto and preferredTheme changes", async () => {
      const { userTheme, preferredTheme } = await import("../../src/stores/theme/store.js");
      await import("../../src/stores/theme/actions.js"); // Trigger initialization
      userTheme.value = THEME_AUTO;
      preferredTheme.value = THEME_LIGHT;

      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSetAttribute.mockClear();

      preferredTheme.value = THEME_DARK;

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetAttribute).toHaveBeenCalledWith("data-theme", THEME_DARK);
    });

    it("should add event listener to media query", async () => {
      await import("../../src/stores/theme/actions.js"); // Trigger initialization

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("should update preferredTheme when media query changes to dark", async () => {
      const { preferredTheme } = await import("../../src/stores/theme/store.js");
      await import("../../src/stores/theme/actions.js"); // Trigger initialization
      preferredTheme.value = THEME_LIGHT;

      // Get the event listener callback
      const addEventListenerCall = (mockMediaQuery.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "change",
      );
      const changeHandler = addEventListenerCall?.[1];

      expect(changeHandler).toBeDefined();

      // Simulate media query change to dark
      const mockEvent = {
        matches: true,
      } as MediaQueryListEvent;

      changeHandler(mockEvent);

      expect(preferredTheme.value).toBe(THEME_DARK);
    });

    it("should update preferredTheme when media query changes to light", async () => {
      const { preferredTheme } = await import("../../src/stores/theme/store.js");
      await import("../../src/stores/theme/actions.js"); // Trigger initialization
      preferredTheme.value = THEME_DARK;

      // Get the event listener callback
      const addEventListenerCall = (mockMediaQuery.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "change",
      );
      const changeHandler = addEventListenerCall?.[1];

      expect(changeHandler).toBeDefined();

      // Simulate media query change to light
      const mockEvent = {
        matches: false,
      } as MediaQueryListEvent;

      changeHandler(mockEvent);

      expect(preferredTheme.value).toBe(THEME_LIGHT);
    });
  });
});
