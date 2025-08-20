import { defineConfig } from "allure";

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
  // qualityGate: {
  //   rules: [
  //     {
  //       minTestsCount: 1000,
  //       maxFailures: 0,
  //       successRate: 0.98,
  //     },
  //   ]
  // },
});
