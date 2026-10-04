import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({ globalLabels: [{ name: "module", value: "plugin-allure2" }] });
