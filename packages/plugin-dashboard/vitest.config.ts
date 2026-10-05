import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-dashboard" },
    { name: "coverage", value: "plugin-dashboard" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-dashboard" },
  ],
});
