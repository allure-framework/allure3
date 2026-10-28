import { defineConfig } from "allure";

import reportConfig from "../allurerc.mjs";

export default defineConfig({
  name: "Allure Report 3 performance probe",
  plugins: {
    testops: {
      options: {
        ...reportConfig.plugins?.testops?.options,
        autocloseLaunch: false,
      },
    },
    agent: {
      enabled: false,
    },
  },
});
