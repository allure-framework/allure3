import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { glob } from "glob";
import { expect, test, vi } from "vite-plus/test";

import { readConfig } from "../../src/config.js";
import { AllureReport } from "../../src/report.js";
import { measurePerf, PERF_METRIC_NAMES } from "../../src/utils/perf.js";

test("generates a report from CI dumps with native performance measures", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const dumps = await glob(process.env.ALLURE_PERF_DUMPS ?? "allure-results-*/*.zip", {
    cwd: root,
    absolute: true,
  });
  expect(dumps.length, "CI performance probe requires at least one dump archive").toBeGreaterThan(0);

  const config = await readConfig(root, ".github/allurerc.perf.mjs", {
    output: resolve(root, "out/performance-probe"),
  });
  const report = new AllureReport(config);
  vi.stubEnv("ALLURE_PERF_METRICS", "1");
  try {
    await measurePerf(PERF_METRIC_NAMES.allureTotal, async () => {
      await report.restoreState(dumps.sort());
      await report.start();
      await report.done();
    });
    expect(await report.store.allTestResults()).not.toHaveLength(0);
  } finally {
    vi.unstubAllEnvs();
  }
});
