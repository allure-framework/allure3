import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-testplan" },
    { name: "coverage", value: "plugin-testplan" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-testplan" },
  ],
});
