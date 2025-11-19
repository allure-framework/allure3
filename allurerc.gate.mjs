import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    log: {
      options: {
        groupBy: "none",
        filter: ({ status }) => status === "failed" || status === "broken",
      },
    },
  },
  qualityGate: {
    rules: [
      {
        maxFailures: 0,
        fastFail: true,
      },
    ],
    use: [...qualityGateDefaultRules],
  },
});
