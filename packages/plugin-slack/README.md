# Slack Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin sends notifications about failed tests to a given Slack channel.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-slack
yarn add @allurereport/plugin-slack
pnpm add @allurereport/plugin-slack
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    slack: {
+      options: {
+        channel: "my_channel",
+        token: "my_token",
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option    | Description                                                     | Type     |
| --------- | --------------------------------------------------------------- | -------- |
| `channel` | Name or ID of the target channel. Used together with `token`    | `string` |
| `token`   | Slack API token. Used together with `channel`                   | `string` |
| `webhook` | Slack incoming webhook URL. Takes precedence over token/channel | `string` |

The options can also be set with the `ALLURE_SLACK_CHANNEL`, `ALLURE_SLACK_TOKEN`, and
`ALLURE_SLACK_WEBHOOK` environment variables. Use either a webhook or the token/channel pair.

For example, to use an incoming webhook:

```diff
export default defineConfig({
  plugins: {
    slack: {
      options: {
+        webhook: process.env.ALLURE_SLACK_WEBHOOK,
      },
    },
  },
});
```
