import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-awesome" },
    { name: "coverage", value: "summary" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "summary" },
  ],
});
