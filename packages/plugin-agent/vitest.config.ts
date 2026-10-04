import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-agent" },
    { name: "coverage", value: "agent-mode" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "agent-mode" },
  ],
});
