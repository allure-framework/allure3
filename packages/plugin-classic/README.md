# Classic Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin generates brand new Allure Report with modern design and new features.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-classic
yarn add @allurereport/plugin-classic
pnpm add @allurereport/plugin-classic
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    classic: {
+      options: {
+        reportName: "HelloWorld",
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option           | Description                                     | Type                                                         | Default         |
|------------------|-------------------------------------------------|--------------------------------------------------------------|-----------------|
| `reportName`     | Name of the report                              | `string`                                                     | `Allure Report` |
| `singleFile`     | Writes the report as a single `index.html` file | `boolean`                                                    | `false`         |
| `logo`           | Path to the logo image                          | `string`                                                     | `null`          |
| `theme`          | Default color theme of the report               | `light \| dark`                                              | OS theme        |
| `reportLanguage` | Default language of the report                  | `string`                                                     | OS language     |
| `ci`             | CI data which will be rendered in the report    | `{ type: "github" \| "jenkins", url: string, name: string }` | `undefined`     |
