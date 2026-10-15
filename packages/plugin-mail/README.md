# Slack Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin generates a ready-to-send HTML email with the run summary, like the `mail.html` of Allure 2. The layout is written in [MJML](https://mjml.io), so it renders consistently across email clients (Gmail, Outlook, Apple Mail, etc.).

The email contains:

- the report name, pass rate, total number of tests and run duration;
- the number of tests per status (failed, broken, passed, skipped, unknown);
- a link to the report (when its URL is known);
- the CI build, branch and pull request (when a CI environment is detected);
- the list of failed and broken tests with short error messages.

The plugin only generates the file. Sending it is up to you (for example, with your CI mail step).

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-mail
yarn add @allurereport/plugin-mail
pnpm add @allurereport/plugin-mail
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    mail: {
+      import: "@allurereport/plugin-mail",
+      options: {
+        reportUrl: "https://example.org/reports/42",
+      },
+    },
  },
});
```

After the report is generated, the email is available as `mail.html` in the report output directory.

## Options

The plugin accepts the following options:

| Option      | Description                                                                | Type     | Default                  |
|-------------|----------------------------------------------------------------------------|----------|--------------------------|
| `title`     | Title of the email                                                         | `string` | The report name          |
| `reportUrl` | Link to the published report                                               | `string` | The report url, if known |
| `maxFailed` | Max number of failed tests listed in the email; the rest is shown as a count | `number` | `20`                     |
| `filename`  | Name of the generated file                                                 | `string` | `mail.html`              |
