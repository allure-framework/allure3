import { beforeEach, describe, expect, it } from "vite-plus/test";

import { redirectLegacyTestResultRoute, rootTabRoute, testResultRoute } from "@/stores/router";

const setUrl = (url: string) => {
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("replaceState"));
};

beforeEach(() => {
  setUrl("/");
});

describe("stores > router > legacy test result redirects", () => {
  it("redirects a legacy test result hash to the Results tab", () => {
    setUrl("/?query=kept#test-result-uuid");

    expect(testResultRoute.value.matches).toBe(true);
    expect(redirectLegacyTestResultRoute()).toBe(true);
    expect(window.location.hash).toBe("#results/test-result-uuid");
    expect(window.location.search).toBe("?query=kept");
    expect(rootTabRoute.value).toMatchObject({
      matches: true,
      params: { rootTab: "results", testResultId: "test-result-uuid" },
    });
  });

  it("preserves a legacy test result sub-tab", () => {
    setUrl("/#test-result-uuid/history");

    expect(redirectLegacyTestResultRoute()).toBe(true);
    expect(window.location.hash).toBe("#results/test-result-uuid/history");
  });

  it("leaves canonical and non-test-result routes unchanged", () => {
    setUrl("/#results/test-result-uuid");

    expect(redirectLegacyTestResultRoute()).toBe(false);
    expect(window.location.hash).toBe("#results/test-result-uuid");

    setUrl("/#metrics");

    expect(redirectLegacyTestResultRoute()).toBe(false);
    expect(window.location.hash).toBe("#metrics");
  });
});
