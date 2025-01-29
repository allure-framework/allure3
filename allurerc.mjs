import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
      },
    },
    classic: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
      },
    },
    "classic-legacy": {
      options: {
        singleFile: false,
        reportLanguage: "en",
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
