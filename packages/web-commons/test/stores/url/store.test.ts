import { label } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as helpers from "../../../src/stores/url/helpers.js";
import { getParamValue, getParamValues, hasParam } from "../../../src/stores/url/store.js";

describe("stores > url > store", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("getParamValue", () => {
    test("should return first value for parameter with multiple values", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1&test=value2&single=solo");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      const value = getParamValue("test");
      expect(value).toBe("value1");
    });

    test("should return value for single parameter", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1&test=value2&single=solo");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      const value = getParamValue("single");
      expect(value).toBe("solo");
    });

    test("should return null for non-existent parameter", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1&test=value2&single=solo");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      const value = getParamValue("nonexistent");
      expect(value).toBeNull();
    });
  });

  describe("getParamValues", () => {
    test("should return all values for parameter with multiple values", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1&test=value2&test=value3");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      const values = getParamValues("test");
      expect(values).toEqual(["value1", "value2", "value3"]);
    });

    test("should return array with single value for single parameter", () => {
      const getCurrentUrlSpy = vi
        .spyOn(helpers, "getCurrentUrl")
        .mockReturnValue("http://localhost/?test=value1&test=value2&test=value3");
      vi.spyOn(helpers, "goTo");
      let urlChangeCallback: (() => void) | undefined;
      vi.spyOn(helpers, "subscribeToUrlChange").mockImplementation((callback) => {
        urlChangeCallback = callback;
        return () => {
          urlChangeCallback = undefined;
        };
      });

      getCurrentUrlSpy.mockReturnValue("http://localhost/?single=solo");
      urlChangeCallback?.();

      const values = getParamValues("single");
      expect(values).toEqual(["solo"]);
    });

    test("should return empty array for non-existent parameter", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1&test=value2&test=value3");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      const values = getParamValues("nonexistent");
      expect(values).toEqual([]);
    });
  });

  describe("hasParam", () => {
    test("should return true for existing parameter", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      expect(hasParam("test")).toBe(true);
    });

    test("should return false for non-existent parameter", () => {
      vi.spyOn(helpers, "getCurrentUrl").mockReturnValue("http://localhost/?test=value1");
      vi.spyOn(helpers, "goTo");
      vi.spyOn(helpers, "subscribeToUrlChange").mockReturnValue(() => {});

      expect(hasParam("nonexistent")).toBe(false);
    });
  });
});
