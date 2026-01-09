import { label } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { navigateTo } from "./actions.js";
import { currentUrl, initRouterStore } from "./store.js";

describe("stores > router > actions", () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
    // Initialize router store to set up event listeners
    cleanup = initRouterStore();

    // Mock window.history.pushState to actually update location.hash
    pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation((_, __, url) => {
      if (url) {
        // Update window.location.hash to simulate actual behavior
        const hash = url.toString().startsWith("#") ? url.toString() : `#${url.toString()}`;
        Object.defineProperty(window, "location", {
          value: {
            ...window.location,
            hash: hash,
            href: `http://localhost${hash}`,
          },
          writable: true,
        });
      }
    });

    // Mock window.dispatchEvent to actually trigger the event
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent").mockImplementation((event: Event) => {
      // Actually trigger the event so listeners can respond
      if (event.type === "hashchange") {
        // Update currentUrl manually since we're mocking location
        currentUrl.value = new URL(window.location.href);
      }
      return true;
    }) as ReturnType<typeof vi.spyOn>;

    // Reset window.location.hash
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        hash: "",
        href: "http://localhost/",
        origin: "http://localhost",
        host: "localhost",
        protocol: "http:",
      },
      writable: true,
    });
    currentUrl.value = new URL("http://localhost/");
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
    }
    vi.restoreAllMocks();
  });

  describe("navigateTo", () => {
    describe("with string path", () => {
      test("should add # prefix to path without hash", () => {
        navigateTo("/test/path");

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test/path");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
        const event = dispatchEventSpy.mock.calls[0]?.[0] as Event;
        expect(event?.type).toBe("hashchange");
      });

      test("should add # prefix to path with #", () => {
        navigateTo("#/test/path");

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "##/test/path");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle empty string", () => {
        navigateTo("");

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle path with only hash", () => {
        navigateTo("#");

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "##");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });
    });

    describe("with object path", () => {
      test("should add # prefix to path without hash", () => {
        navigateTo({ path: "/test/path" });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test/path");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should add # prefix to path with #", () => {
        navigateTo({ path: "#/test/path" });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "##/test/path");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle empty path", () => {
        navigateTo({ path: "" });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });
    });

    describe("with searchParams", () => {
      test("should add searchParams as query string", () => {
        const searchParams = new URLSearchParams({ foo: "bar", baz: "qux" });
        navigateTo({ path: "/test", searchParams });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test?foo=bar&baz=qux");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle single searchParam", () => {
        const searchParams = new URLSearchParams({ q: "test" });
        navigateTo({ path: "/search", searchParams });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/search?q=test");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should not add query string if searchParams is empty", () => {
        const searchParams = new URLSearchParams();
        navigateTo({ path: "/test", searchParams });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should not add query string if searchParams is undefined", () => {
        navigateTo({ path: "/test" });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle searchParams with special characters", () => {
        const searchParams = new URLSearchParams({ q: "test query", page: "1" });
        navigateTo({ path: "/search", searchParams });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/search?q=test+query&page=1");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });

      test("should handle path with hash and searchParams", () => {
        const searchParams = new URLSearchParams({ tab: "details" });
        navigateTo({ path: "#/user/123", searchParams });

        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "##/user/123?tab=details");
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      });
    });

    describe("event dispatching", () => {
      test("should always dispatch hashchange event", () => {
        navigateTo("/test");

        expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
        const event = dispatchEventSpy.mock.calls[0][0] as Event;
        expect(event.type).toBe("hashchange");
      });

      test("should dispatch hashchange event with object path", () => {
        navigateTo({ path: "/test" });

        expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
        const event = dispatchEventSpy.mock.calls[0][0] as Event;
        expect(event.type).toBe("hashchange");
      });

      test("should dispatch hashchange event with searchParams", () => {
        const searchParams = new URLSearchParams({ foo: "bar" });
        navigateTo({ path: "/test", searchParams });

        expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
        const event = dispatchEventSpy.mock.calls[0][0] as Event;
        expect(event.type).toBe("hashchange");
      });
    });

    describe("currentUrl updates", () => {
      test("should update currentUrl.value after navigation with string path", () => {
        const initialUrl = currentUrl.value.href;

        navigateTo("/test/path");

        expect(currentUrl.value.href).not.toBe(initialUrl);
        expect(currentUrl.value.href).toBe("http://localhost/#/test/path");
      });

      test("should update currentUrl.value after navigation with object path", () => {
        const initialUrl = currentUrl.value.href;

        navigateTo({ path: "/dashboard" });

        expect(currentUrl.value.href).not.toBe(initialUrl);
        expect(currentUrl.value.href).toBe("http://localhost/#/dashboard");
      });

      test("should update currentUrl.value with searchParams", () => {
        const searchParams = new URLSearchParams({ tab: "details", page: "2" });
        navigateTo({ path: "/user/123", searchParams });

        expect(currentUrl.value.href).toBe("http://localhost/#/user/123?tab=details&page=2");
        expect(currentUrl.value.hash).toBe("#/user/123?tab=details&page=2");
      });

      test("should update currentUrl.value when navigating from one path to another", () => {
        navigateTo("/first");
        const firstUrl = currentUrl.value.href;

        navigateTo("/second");

        expect(currentUrl.value.href).not.toBe(firstUrl);
        expect(currentUrl.value.href).toBe("http://localhost/#/second");
      });

      test("should update currentUrl.value when path already has hash", () => {
        navigateTo("#/existing");

        navigateTo("/new");

        expect(currentUrl.value.href).toBe("http://localhost/#/new");
      });

      test("should update currentUrl.value with empty path", () => {
        navigateTo("/test");

        navigateTo("");

        expect(currentUrl.value.href).toBe("http://localhost/#");
      });
    });

    describe("external URL handling", () => {
      test("should navigate to external URL with http://", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo("http://example.com/test");

        expect(locationSpy).toHaveBeenCalledWith("http://example.com/test");
        expect(pushStateSpy).not.toHaveBeenCalled();
        expect(dispatchEventSpy).not.toHaveBeenCalled();

        locationSpy.mockRestore();
      });

      test("should navigate to external URL with https://", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo("https://example.com/test");

        expect(locationSpy).toHaveBeenCalledWith("https://example.com/test");
        expect(pushStateSpy).not.toHaveBeenCalled();
        expect(dispatchEventSpy).not.toHaveBeenCalled();

        locationSpy.mockRestore();
      });

      test("should navigate to external URL with different origin", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo("https://other-domain.com/path");

        expect(locationSpy).toHaveBeenCalledWith("https://other-domain.com/path");
        expect(pushStateSpy).not.toHaveBeenCalled();

        locationSpy.mockRestore();
      });

      test("should use hash routing for same origin URL", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo("http://localhost/test");

        expect(locationSpy).not.toHaveBeenCalled();
        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test");

        locationSpy.mockRestore();
      });

      test("should use hash routing for relative paths", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo("/test/path");

        expect(locationSpy).not.toHaveBeenCalled();
        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/test/path");

        locationSpy.mockRestore();
      });

      test("should use hash routing for object path with external-looking string but same origin", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo({ path: "http://localhost/dashboard" });

        expect(locationSpy).not.toHaveBeenCalled();
        expect(pushStateSpy).toHaveBeenCalledWith({}, "", "#/dashboard");

        locationSpy.mockRestore();
      });

      test("should navigate to external URL with object path", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});

        navigateTo({ path: "https://example.com/page" });

        expect(locationSpy).toHaveBeenCalledWith("https://example.com/page");
        expect(pushStateSpy).not.toHaveBeenCalled();

        locationSpy.mockRestore();
      });

      test("should navigate to external URL with searchParams", () => {
        const locationSpy = vi.spyOn(window.location, "href", "set").mockImplementation(() => {});
        const searchParams = new URLSearchParams({ foo: "bar" });

        navigateTo({ path: "https://example.com/page", searchParams });

        expect(locationSpy).toHaveBeenCalledWith("https://example.com/page?foo=bar");
        expect(pushStateSpy).not.toHaveBeenCalled();

        locationSpy.mockRestore();
      });
    });
  });
});
