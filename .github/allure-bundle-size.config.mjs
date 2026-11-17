import { readFileSync } from "node:fs";

const baselinePath =
  process.env.ALLURE_BUNDLE_BASELINE ?? new URL("./allure-bundle-size.baseline.json", import.meta.url);
const { rootPackage, measuredAt, internalClosureCount, selfBytes, depsBytes, totalBytes } = JSON.parse(
  readFileSync(baselinePath, "utf8"),
);
const mib = 1024 ** 2;
const maxSelfBytes = selfBytes + Math.round(0.25 * mib);
const maxDepsBytes = depsBytes + Math.round(0.15 * mib);

if (
  rootPackage !== "allure" ||
  typeof measuredAt !== "string" ||
  !Number.isFinite(Date.parse(measuredAt)) ||
  ![internalClosureCount, selfBytes, depsBytes, totalBytes, maxSelfBytes, maxDepsBytes].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  ) ||
  totalBytes !== selfBytes + depsBytes
) {
  throw new Error("Invalid Allure bundle size baseline");
}

const self = "allure.bundle.size.self";
const dependencies = "allure.bundle.size.dependencies";
const total = "allure.bundle.size.total";

/** @type {import("allure").AllureConfig} */
export default {
  name: "Allure CLI bundle size",
  metrics: {
    groups: { bundleSize: { title: "Bundle size" } },
    metrics: {
      [self]: { title: "Allure code", unit: "bytes", better: "lower", group: "bundleSize" },
      [dependencies]: { title: "Dependencies", unit: "bytes", better: "lower", group: "bundleSize" },
      [total]: { title: "Total installed size", unit: "bytes", better: "lower", group: "bundleSize" },
    },
  },
  qualityGate: {
    rules: [
      { id: "allure-code", metricMax: { key: self, title: "Allure code", value: maxSelfBytes } },
      { id: "dependencies", metricMax: { key: dependencies, title: "Dependencies", value: maxDepsBytes } },
    ],
  },
  plugins: { awesome: { options: { singleFile: true } } },
};
