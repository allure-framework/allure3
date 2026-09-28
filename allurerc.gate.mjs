import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_REQUIRE_NEW_TESTS, ALLURE_SERVICE_ACCESS_TOKEN } = env;
const requireNewTests = ALLURE_REQUIRE_NEW_TESTS === "1";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    log: {
      options: {
        groupBy: "none",
        filter: ({ status }) => status === "failed" || status === "broken",
      },
    },
  },
  ...(requireNewTests
    ? {
        qualityGate: {
          rules: [
            {
              newTests: true,
            },
          ],
        },
      }
    : {}),
  ...(requireNewTests && ALLURE_SERVICE_ACCESS_TOKEN
    ? {
        allureService: {
          accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
        },
      }
    : {}),
});
