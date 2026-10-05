import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "ci" },
    { name: "coverage", value: "ci-detection" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "ci-detection" },
  ],
});
