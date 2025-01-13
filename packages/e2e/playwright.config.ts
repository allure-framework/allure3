import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./test",
  reporter: [["line"], ["allure-playwright", {
    resultsDir: "./out/allure-results",
  }]],
})
