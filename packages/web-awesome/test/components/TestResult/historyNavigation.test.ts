import { describe, expect, it } from "vitest";

import { getHistoryNavigationUrl } from "@/components/TestResult/historyNavigation";

describe("components > TestResult > historyNavigation", () => {
  it.each([
    [
      "path-hosted report",
      "http://127.0.0.1:58888/build-1",
      "http://127.0.0.1:58888/build-1/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
    [
      "root-hosted report",
      "http://127.0.0.1:58888",
      "http://127.0.0.1:58888/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
    [
      "report that already points to the awesome directory",
      "http://127.0.0.1:58888/build-1/awesome/",
      "http://127.0.0.1:58888/build-1/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
    [
      "report that already points to the awesome directory without a trailing slash",
      "http://127.0.0.1:58888/build-1/awesome",
      "http://127.0.0.1:58888/build-1/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    ],
  ])("should build a stable history navigation url for a %s", (_name, url, expected) => {
    expect(getHistoryNavigationUrl(url, "awesome", "5bd0de6d8fe94b75be93ae8ee778dd9e")).toBe(expected);
  });

  it("should preserve query parameters when building a history navigation url", () => {
    expect(getHistoryNavigationUrl("http://127.0.0.1:58888/build-1?job=demo", "awesome", "test-id")).toBe(
      "http://127.0.0.1:58888/build-1/awesome/?job=demo#test-id",
    );
  });

  it("should return undefined for empty or invalid history urls", () => {
    expect(getHistoryNavigationUrl(undefined, "awesome", "test-id")).toBeUndefined();
    expect(getHistoryNavigationUrl("", "awesome", "test-id")).toBeUndefined();
    expect(getHistoryNavigationUrl("not-a-url", "awesome", "test-id")).toBeUndefined();
  });
});
