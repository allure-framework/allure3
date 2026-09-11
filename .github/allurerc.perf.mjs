import { defineConfig } from "allure";

import reportConfig from "../allurerc.mjs";

export default defineConfig({
  name: "Allure Report 3 performance probe",
  plugins: {
    awesome: {
      options: {
        ...reportConfig.plugins?.awesome?.options,
        reportName: "Allure 3 performance probe",
        publish: false,
      },
    },
    agent: {
      enabled: false,
    },
  },
});
