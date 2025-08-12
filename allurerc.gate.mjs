import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  qualityGate: {
    rules: [
      {
        minTestsCount: 1000,
      },
      {
        maxFailures: 1,
        fastFail: true
      }
    ]
  },
});
