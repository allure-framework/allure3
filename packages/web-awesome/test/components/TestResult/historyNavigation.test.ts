import { describe, expect, it } from "vitest";

import { getHistoryNavigationUrl } from "@/components/TestResult/historyNavigation";

describe("components > TestResult > historyNavigation", () => {
  it.each([
    [
      "single-plugin path-hosted report",
      "http://127.0.0.1:58888/build-1",
      "http://127.0.0.1:58888/build-1/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
    ["root-hosted report", "http://127.0.0.1:58888", "http://127.0.0.1:58888/#5bd0de6d8fe94b75be93ae8ee778dd9e"],
    [
      "multi-plugin report root",
      "http://127.0.0.1:58888/build-1/awesome/",
      "http://127.0.0.1:58888/build-1/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
    [
      "multi-plugin report root without a trailing slash",
      "http://127.0.0.1:58888/build-1/awesome",
      "http://127.0.0.1:58888/build-1/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
  ])("should build a stable history navigation url for a %s", (_name, url, expected) => {
    expect(getHistoryNavigationUrl(url, "5bd0de6d8fe94b75be93ae8ee778dd9e")).toBe(expected);
  });

  it("should preserve query parameters when building a history navigation url", () => {
    expect(getHistoryNavigationUrl("http://127.0.0.1:58888/build-1?job=demo", "test-id")).toBe(
      "http://127.0.0.1:58888/build-1/?job=demo#test-id",
    );
  });

  it("should return undefined for empty or invalid history urls", () => {
    expect(getHistoryNavigationUrl(undefined, "test-id")).toBeUndefined();
    expect(getHistoryNavigationUrl("", "test-id")).toBeUndefined();
    expect(getHistoryNavigationUrl("not-a-url", "test-id")).toBeUndefined();
  });
});
