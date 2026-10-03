import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-progress" },
    { name: "coverage", value: "plugin-progress" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-progress" },
  ],
});
