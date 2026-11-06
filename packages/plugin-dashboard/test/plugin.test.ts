import type { AllureStore, PluginContext, ReportFiles } from "@allurereport/plugin-api";
import { readReportStaticAssets } from "@allurereport/plugin-api/static-assets";
import { feature, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vite-plus/test";

import DashboardPlugin from "../src/index.js";

beforeEach(async () => {
  await feature("selective-single-file-assets");
  await story("dashboard-live-lifecycle");
});
it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "keeps complete live scripts through done and resets selection on start (realTime=%s, singleFile=%s)",
  async (realTime, singleFile) => {
    const files = new Map<string, Buffer>();
    const reportFiles: ReportFiles = {
      addFile: async (name, data) => {
        files.set(name, data);
        return name;
      },
    };
    const context = {
      id: "dashboard",
      reportFiles,
      reportUuid: "run",
      reportName: "run",
      allureVersion: "test",
      realTime,
    } as PluginContext;
    const store = {
      allEnvironmentIdentities: async () => [],
      allHistoryDataPoints: async () => [],
      allTestResults: async () => [],
    } as unknown as AllureStore;
    const plugin = new DashboardPlugin({ singleFile, layout: [] });
    const archive = await readReportStaticAssets(new URL("../dist/static/report.tar", import.meta.url));
    const scripts = () =>
      !singleFile
        ? [...files.keys()].filter((name) => name.endsWith(".js")).sort()
        : Object.keys(
            JSON.parse(
              files
                .get("index.html")!
                .toString()
                .match(/<script id="allure-single-file-assets" type="application\/json">([^<]+)<\/script>/)![1],
            ),
          ).sort();
    const all = [...archive.files.keys()].filter((name) => name.endsWith(".js")).sort();
    const base = archive.featureAssets!.base.filter((name) => name.endsWith(".js")).sort();
    await plugin.start(context);
    await plugin.done(context, store);
    expect(scripts()).toEqual(realTime ? all : base);
    await plugin.update(context, store);
    expect(scripts()).toEqual(all);
    await plugin.done(context, store);
    expect(scripts()).toEqual(all);
    files.clear();
    await plugin.start({ ...context, realTime: false });
    await plugin.done({ ...context, realTime: false }, store);
    expect(scripts()).toEqual(base);
  },
);
