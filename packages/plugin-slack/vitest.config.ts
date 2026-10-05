import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-slack" },
    { name: "coverage", value: "plugin-slack" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-slack" },
  ],
});
