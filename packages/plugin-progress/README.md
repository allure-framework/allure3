# Progress Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This plugin owns Allure's realtime terminal output.

- In report or watch flows, the plugin prints progress updates while results are being processed.
- In `allure run`, the CLI reuses the same package for the built-in console reporter modes like `rich`, `progress`, and `errors`.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-progress
yarn add @allurereport/plugin-progress
pnpm add @allurereport/plugin-progress
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    progress: {
+      options: {
+      },
+    },
  },
});
```
