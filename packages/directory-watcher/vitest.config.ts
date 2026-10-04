import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "directory-watcher" },
    { name: "coverage", value: "watcher" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "watcher" },
  ],
});
