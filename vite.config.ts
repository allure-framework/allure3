import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    printWidth: 120,
    trailingComma: "all",
    singleQuote: false,
    arrowParens: "always",
    quoteProps: "consistent",
    sortImports: {},
    ignorePatterns: [
      // Keep traversal open, then select the source and hook file scopes.
      "**/*",
      "!**/",
      "!package.json",
      "!vite.config.ts",
      "!**/package.json",
      "!{.github,packages,scripts}/**/*.{js,mjs,ts,tsx}",
      "!packages/*/{src,test,features}/**/*.json",
      "!packages/web-allure2/src/main/javascript/**/*.{mts,css,scss}",
      "!packages/web-allure2/scripts/*.mts",
      "!packages/web-allure2/tests/e2e/**/*.mts",
      "!packages/web-allure2/tsconfig{,.e2e}.json",
      "!packages/web-allure2/{vite.config,playwright.config}.mts",
      "!packages/web-allure2/allurerc-{dev,e2e}.mjs",
      "**/.yarn/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/allure-report/**",
      "packages/*/src/assets/data/test-results/**",
      "packages/plugin-allure2/static/**",
      "packages/web-allure2/{build,coverage}/**",
      "**/*.hbs",
    ],
  },
  lint: {
    plugins: ["typescript", "react", "import", "jsdoc", "jsx-a11y", "node"],
    env: {
      browser: true,
      node: true,
    },
    ignorePatterns: [
      "**/*",
      "!**/",
      "!{.github,packages,scripts}/**/*.{js,mjs,ts,tsx}",
      "**/.yarn/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/allure-report/**",
      "packages/*/src/assets/data/test-results/**",
    ],
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
});
