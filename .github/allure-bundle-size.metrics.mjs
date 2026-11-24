/** @type {NonNullable<import("allure").AllureConfig["metrics"]>} */
export const bundleSizeMetrics = {
  groups: { bundleSize: { title: "Bundle size" } },
  metrics: {
    "allure.bundle.size.cliDist": {
      title: "CLI build output (dist)",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "bundleSize",
    },
    "allure.bundle.size.self": {
      title: "Allure code",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "bundleSize",
    },
    "allure.bundle.size.dependencies": {
      title: "Dependencies",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "bundleSize",
    },
    "allure.bundle.dependencies.count": {
      title: "Installed external packages",
      better: "lower",
      timeline: false,
      group: "bundleSize",
    },
    "allure.bundle.size.total": {
      title: "Total installed size",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "bundleSize",
    },
  },
};

/** @type {NonNullable<import("allure").AllureConfig["metrics"]>} */
export const awesomeReportSizeMetrics = {
  groups: { awesomeReportSize: { title: "Awesome report size" } },
  metrics: {
    "allure.report.size.awesome.singleFile.html": {
      title: "Single-file HTML",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "awesomeReportSize",
    },
    "allure.report.size.awesome.directory.initialJs.raw": {
      title: "Directory initial JS (raw)",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "awesomeReportSize",
    },
    "allure.report.size.awesome.directory.initialJs.gzip": {
      title: "Directory initial JS (gzip)",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "awesomeReportSize",
    },
    "allure.report.size.awesome.directory.allJs.raw": {
      title: "Directory all JS (raw)",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "awesomeReportSize",
    },
    "allure.report.size.awesome.directory.allJs.gzip": {
      title: "Directory all JS (gzip)",
      unit: "bytes",
      better: "lower",
      timeline: false,
      group: "awesomeReportSize",
    },
  },
};
