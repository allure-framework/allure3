import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-csv" },
    { name: "coverage", value: "plugin-csv" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-csv" },
  ],
});
