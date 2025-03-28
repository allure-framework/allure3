import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: "en",
        reportName: "Allure 3 Report",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
      },
    },
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
});
