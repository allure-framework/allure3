const singleFile = process.env.ALLURE2_E2E_SINGLE_FILE === "true";

export default {
  name: "Allure 2 E2E",
  plugins: {
    allure2: {
      options: {
        reportLanguage: "en",
        reportName: "Allure Demo Report",
        singleFile,
      },
    },
  },
};
