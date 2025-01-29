import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
    "classic-legacy": {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    classic: {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    awesome: {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
        open: false,
      },
    },
    csv: {
      options: {
        fileName: "allure-report.csv",
      },
    },
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
});
