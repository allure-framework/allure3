import type { ReportFiles } from "@allurereport/plugin-api";
import { ALLURE_NO_ANALYTICS_ENV } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it } from "vitest";

import { generateStaticFiles } from "../src/generators.js";

const GTAG_SNIPPET = "googletagmanager.com/gtag/js?id=G-LNDJ3J7WT0";

const captureIndexHtml = async (options: {
  analyticsEnable?: boolean;
}): Promise<string> => {
  const files = new Map<string, Buffer>();
  const reportFiles: ReportFiles = {
    addFile: async (name, content) => {
      files.set(name, content);
    },
  };

  await generateStaticFiles({
    allureVersion: "3.6.2",
    reportName: "Analytics test",
    reportLanguage: "en",
    singleFile: true,
    analyticsEnable: options.analyticsEnable,
    reportFiles,
    reportDataFiles: [],
    reportUuid: "uuid-analytics-test",
  });

  const html = files.get("index.html");
  if (!html) {
    throw new Error("index.html was not generated");
  }
  return html.toString("utf8");
};

describe("allure2 analytics embedding (#476)", () => {
  const original = process.env[ALLURE_NO_ANALYTICS_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ALLURE_NO_ANALYTICS_ENV];
    } else {
      process.env[ALLURE_NO_ANALYTICS_ENV] = original;
    }
  });

  it("embeds Google Analytics by default", async () => {
    delete process.env[ALLURE_NO_ANALYTICS_ENV];
    const html = await captureIndexHtml({});
    expect(html).toContain(GTAG_SNIPPET);
  });

  it("omits Google Analytics when analyticsEnable is false", async () => {
    delete process.env[ALLURE_NO_ANALYTICS_ENV];
    const html = await captureIndexHtml({ analyticsEnable: false });
    expect(html).not.toContain(GTAG_SNIPPET);
  });

  it("omits Google Analytics when ALLURE_NO_ANALYTICS=true even if option is true", async () => {
    process.env[ALLURE_NO_ANALYTICS_ENV] = "true";
    const html = await captureIndexHtml({ analyticsEnable: true });
    expect(html).not.toContain(GTAG_SNIPPET);
  });
});
