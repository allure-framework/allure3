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
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
  variables: {},
  environments: {
    browser: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "browser"),
      variables: {}
    },
  },
});
