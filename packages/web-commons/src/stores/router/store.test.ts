import { label } from "allure-js-commons";
import { computed } from "@preact/signals-core";
import { beforeEach, describe, expect, test } from "vitest";
import { currentUrl, getRouteFromUrl } from "./store.js";

describe("stores > router > store", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
    // Reset currentUrl to default state before each test
    currentUrl.value = new URL("http://localhost/");
  });

  describe("matchPath", () => {
    // Testing matchPath indirectly through getRouteFromUrl
      test("should match exact path", () => {
      const url = new URL("http://localhost/test/path");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/path"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(true);
      expect(route.value.pathname).toBe("/test/path");
    });

      test("should match path with parameters", () => {
      const url = new URL("http://localhost/test/123");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/:id"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(true);
      expect(route.value.pathname).toBe("/test/123");
    });

      test("should not match different path", () => {
      const url = new URL("http://localhost/other/path");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/path"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(false);
    });

      test("should match path with multiple parameters", () => {
      const url = new URL("http://localhost/user/123/post/456");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/user/:userId/post/:postId"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(true);
    });

      test("should not match when pathname is shorter than route", () => {
      const url = new URL("http://localhost/test");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/path"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(false);
    });

      test("should not match when pathname is longer than route", () => {
      const url = new URL("http://localhost/test/path/extra");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(false);
    });

      test("should match root path", () => {
      const url = new URL("http://localhost/");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(true);
    });

      test("should match empty pathname with empty route", () => {
      const url = new URL("http://localhost");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/"));
      currentUrl.value = url;

      expect(route.value.matches).toBe(true);
    });
  });

  describe("extractParams", () => {
    // Testing extractParams indirectly through getRouteFromUrl
      test("should extract single parameter", () => {
      const url = new URL("http://localhost/test/123");
      const route = computed(() => getRouteFromUrl<{ id: string }>(currentUrl.value, "/test/:id"));
      currentUrl.value = url;

      expect(route.value.params).toEqual({ id: "123" });
    });

      test("should extract multiple parameters", () => {
      const url = new URL("http://localhost/user/123/post/456");
      const route = computed(() => getRouteFromUrl<{ userId: string; postId: string }>(currentUrl.value, "/user/:userId/post/:postId"));
      currentUrl.value = url;

      expect(route.value.params).toEqual({ userId: "123", postId: "456" });
    });

      test("should return empty object when no parameters", () => {
      const url = new URL("http://localhost/test/path");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/path"));
      currentUrl.value = url;

      expect(route.value.params).toEqual({});
    });

      test("should extract parameters with special characters", () => {
      const url = new URL("http://localhost/test/abc-123_def");
      const route = computed(() => getRouteFromUrl<{ id: string }>(currentUrl.value, "/test/:id"));
      currentUrl.value = url;

      expect(route.value.params).toEqual({ id: "abc-123_def" });
    });

      test("should extract parameters from nested paths", () => {
      const url = new URL("http://localhost/api/v1/users/42");
      const route = computed(() => getRouteFromUrl<{ version: string; userId: string }>(currentUrl.value, "/api/:version/users/:userId"));
      currentUrl.value = url;

      expect(route.value.params).toEqual({ version: "v1", userId: "42" });
    });
  });

  describe("getRouteFromUrl", () => {
      test("should return correct pathname", () => {
      const url = new URL("http://localhost/test/path");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test/path"));
      currentUrl.value = url;

      expect(route.value.pathname).toBe("/test/path");
    });

      test("should return searchParams", () => {
      const url = new URL("http://localhost/test?foo=bar&baz=qux");
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test"));
      currentUrl.value = url;

      expect(route.value.searchParams.get("foo")).toBe("bar");
      expect(route.value.searchParams.get("baz")).toBe("qux");
    });

      test("should return all route information", () => {
      const url = new URL("http://localhost/user/123?tab=details");
      const route = computed(() => getRouteFromUrl<{ id: string }>(currentUrl.value, "/user/:id"));
      currentUrl.value = url;

      expect(route.value.pathname).toBe("/user/123");
      expect(route.value.params).toEqual({ id: "123" });
      expect(route.value.matches).toBe(true);
      expect(route.value.searchParams.get("tab")).toBe("details");
    });
  });

  describe("useRoute", () => {
      test("should return computed route that updates when currentUrl changes", () => {
      const route = computed(() => getRouteFromUrl<{ id: string }>(currentUrl.value, "/test/:id"));

      // Initial URL
      currentUrl.value = new URL("http://localhost/test/123");
      expect(route.value.matches).toBe(true);
      expect(route.value.params).toEqual({ id: "123" });

      // Change URL
      currentUrl.value = new URL("http://localhost/test/456");
      expect(route.value.matches).toBe(true);
      expect(route.value.params).toEqual({ id: "456" });

      // Change to non-matching URL
      currentUrl.value = new URL("http://localhost/other/path");
      expect(route.value.matches).toBe(false);
      expect(route.value.params).toEqual({});
    });

      test("should react to currentUrl.value changes", () => {
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/dashboard"));

      currentUrl.value = new URL("http://localhost/dashboard");
      expect(route.value.matches).toBe(true);
      expect(route.value.pathname).toBe("/dashboard");

      currentUrl.value = new URL("http://localhost/settings");
      expect(route.value.matches).toBe(false);
      expect(route.value.pathname).toBe("/settings");
    });

      test("should update searchParams when URL changes", () => {
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/search"));

      currentUrl.value = new URL("http://localhost/search?q=test");
      expect(route.value.searchParams.get("q")).toBe("test");

      currentUrl.value = new URL("http://localhost/search?q=updated&page=2");
      expect(route.value.searchParams.get("q")).toBe("updated");
      expect(route.value.searchParams.get("page")).toBe("2");
    });

      test("should handle multiple route instances independently", () => {
      const route1 = computed(() => getRouteFromUrl<{ id: string }>(currentUrl.value, "/user/:id"));
      const route2 = computed(() => getRouteFromUrl<{ slug: string }>(currentUrl.value, "/post/:slug"));

      currentUrl.value = new URL("http://localhost/user/123");
      expect(route1.value.matches).toBe(true);
      expect(route1.value.params).toEqual({ id: "123" });
      expect(route2.value.matches).toBe(false);

      currentUrl.value = new URL("http://localhost/post/my-post");
      expect(route1.value.matches).toBe(false);
      expect(route2.value.matches).toBe(true);
      expect(route2.value.params).toEqual({ slug: "my-post" });
    });

      test("should handle URL with hash", () => {
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/test"));
      currentUrl.value = new URL("http://localhost/test#section");

      expect(route.value.pathname).toBe("/test");
      expect(route.value.matches).toBe(true);
    });

      test("should handle URL with port", () => {
      const route = computed(() => getRouteFromUrl(currentUrl.value, "/api"));
      currentUrl.value = new URL("http://localhost:3000/api");

      expect(route.value.pathname).toBe("/api");
      expect(route.value.matches).toBe(true);
    });
  });
});
