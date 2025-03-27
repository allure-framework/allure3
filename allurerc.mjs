import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome1: {
      import: "@allurereport/plugin-awesome",
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Without layers",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
        filter: ({ labels }) => !labels.some(({ name }) => name === "layer")
      },
    },
    awesome2: {
      import: "@allurereport/plugin-awesome",
      options: {
        singleFile: true,
        reportLanguage: "en",
        reportName: "Layers only",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
        filter: ({ labels }) => labels.some(({ name }) => name === "layer")
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
