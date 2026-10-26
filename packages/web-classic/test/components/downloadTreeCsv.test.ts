// @vitest-environment jsdom
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { downloadTreeCsv } from "../../src/components/HeaderActions/TreeControls.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("tree csv download");
  await label("coverage", "ui-components");
});

afterEach(() => {
  delete (globalThis as any).allureReportData;
  delete (globalThis as any).allureReportDataReady;
  delete (globalThis as any).allureReportOptions;
  vi.restoreAllMocks();
});

const captureDownload = () => {
  const links: { href: string; download: string }[] = [];

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    links.push({ href: this.href, download: this.download });
  });

  return links;
};

describe("downloadTreeCsv", () => {
  it("downloads the csv file next to the report with the cache key", async () => {
    globalThis.allureReportOptions = { cacheKey: "abc" };

    const links = captureDownload();

    await expect(downloadTreeCsv("suites.csv")).resolves.toBe(true);
    expect(links).toEqual([{ href: "https://localhost/data/suites.csv?v=abc", download: "suites.csv" }]);
    expect(document.querySelector("a")).toBeNull();
  });

  it("downloads the embedded csv file from a data url in single-file mode", async () => {
    globalThis.allureReportDataReady = true;
    globalThis.allureReportData = { "data/behaviors.csv": "U3RhdHVz" };

    const links = captureDownload();

    await expect(downloadTreeCsv("behaviors.csv")).resolves.toBe(true);
    expect(links).toEqual([{ href: "data:text/csv;base64,U3RhdHVz", download: "behaviors.csv" }]);
  });

  it("does not throw when the embedded csv file is missing", async () => {
    globalThis.allureReportDataReady = true;
    globalThis.allureReportData = {};

    const links = captureDownload();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(downloadTreeCsv("packages.csv")).resolves.toBe(false);
    expect(links).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
  });
});
