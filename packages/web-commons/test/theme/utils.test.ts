import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrefersColorSchemeMQ } from "../../src/stores/theme/utils.js";

const mockMediaQueryDark = {
  matches: true,
  media: "(prefers-color-scheme: dark)",
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as MediaQueryList;

const getMockMatchMedia = (mockReturnValue: MediaQueryList) => {
  const mockMatchMedia = vi.fn().mockReturnValue(mockReturnValue);
  return vi.spyOn(window, "matchMedia").mockImplementation(mockMatchMedia);
};

describe("theme utils", () => {
  describe("getPrefersColorSchemeMQ", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return window.matchMedia result when window is defined", () => {
      const mockMatchMedia = getMockMatchMedia(mockMediaQueryDark);

      const result = getPrefersColorSchemeMQ();

      expect(mockMatchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
      expect(result.matches).toBe(true);
      expect(result.media).toBe("(prefers-color-scheme: dark)");
    });
  });
});
