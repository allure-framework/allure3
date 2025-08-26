import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_SERVICE_URL, ALLURE_SERVICE_ACCESS_TOKEN } = env;

const config = {
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
        filter: ({ status }) => status === "failed" || status === "broken",
      },
    },
  },
  variables: {},
  environments: {
    windows: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "Windows"),
    },
    macos: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "macOS"),
    },
    linux: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "Linux"),
    },
  },
};

if (ALLURE_SERVICE_URL && ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    url: ALLURE_SERVICE_URL,
    project: "allure3",
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
    publish: true,
  };
}

export default defineConfig(config);
