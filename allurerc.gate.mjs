import { defineConfig } from "allure";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

console.log("gate config")

const config = {
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    "quality-gate": {
      import: require.resolve("./packages/plugin-quality-gate"),
      options: {
        rules: [
          {
            minTestsCount: 1000,
          }
        ]
      },
    },
  },
};

export default defineConfig(config);
