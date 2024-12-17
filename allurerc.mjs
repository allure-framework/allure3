import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: "en",
      },
    },
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
});
