import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-log" },
    { name: "coverage", value: "plugin-log" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-log" },
  ],
});
