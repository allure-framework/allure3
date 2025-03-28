import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
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
  variables: {},
  environments: {
    chromium: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "chromium"),
    },
    firefox: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "firefox"),
    },
    safari: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "webkit"),
    }
  },
});
