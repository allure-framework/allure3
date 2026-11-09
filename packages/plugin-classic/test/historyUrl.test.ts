import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveClassicHistoryUrl } from "../src/historyUrl.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("history urls");
  await label("coverage", "report-output");
});

describe("resolveClassicHistoryUrl", () => {
  it("opens the historical result by the classic test result route", () => {
    const resolver = vi.fn((historyUrl: string, pluginId: string, id: string) => {
      const url = new URL(historyUrl);

      url.pathname = `${url.pathname}${pluginId}/index.html`;
      url.hash = id;

      return url.toString();
    });

    const url = resolveClassicHistoryUrl({ id: "old-tr", url: "http://reports.example/run-1/" }, "classic", resolver);

    expect(resolver).toHaveBeenCalledWith("http://reports.example/run-1/", "classic", "old-tr");
    expect(url).toBe("http://reports.example/run-1/classic/index.html#testresult/old-tr");
  });

  it("returns an empty url when the history entry has no url", () => {
    const resolver = vi.fn(() => "http://reports.example/#x");

    expect(resolveClassicHistoryUrl({ id: "old-tr", url: "" }, "classic", resolver)).toBe("");
    expect(resolver).not.toHaveBeenCalled();
  });

  it("returns an empty url without a resolver", () => {
    expect(resolveClassicHistoryUrl({ id: "old-tr", url: "http://reports.example/" }, "classic")).toBe("");
  });

  it("returns an empty url when the resolved url is empty or not absolute", () => {
    expect(resolveClassicHistoryUrl({ id: "a", url: "x" }, "classic", () => "")).toBe("");
    expect(resolveClassicHistoryUrl({ id: "a", url: "x" }, "classic", () => "relative/path")).toBe("");
    expect(
      resolveClassicHistoryUrl({ id: "a", url: "x" }, "classic", () => {
        throw new TypeError("Invalid URL");
      }),
    ).toBe("");
  });
});
