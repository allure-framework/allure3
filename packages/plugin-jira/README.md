# Jira Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at [allurereport.org](https://allurereport.org)
- 📚 [Documentation](https://allurereport.org/docs/) – Discover the official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – Get help from the team and community
- 📢 [Official Announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – Stay up to date with the latest updates
- 💬 [General Discussion](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – Engage in casual conversations, share insights, and ideas with the community

---

## Overview

This plugin allows you to send Allure reports to Jira.

## Installation

Use your preferred package manager to install the package:

```shell
npm add @allurereport/plugin-jira
yarn add @allurereport/plugin-jira
pnpm add @allurereport/plugin-jira
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    jira: {
+      options: {
+        webhook: "https://95f453e...",
+        token: "dmR2dWto...",
+        issue: "JIRA-123"
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option    | Description                         | Type     |
| --------- | ----------------------------------- | -------- |
| `webhook` | Allure Jira Integration Webhook URL | `string` |
| `token`   | Generated Atlassian API token       | `string` |
| `issue`   | Jira issue to link report to        | `string` |

### Webhook URL

1. Navigate to your app's "Get Started" page.
2. Copy the webhook URL provided on that page.

### Token

1. Navigate to [Atlassian Account > Security > API Tokens](https://id.atlassian.com/manage/api-tokens).
2. Click the "Create API token with scopes" button.
3. Enter a name for your token and set an expiration date.
4. Select "Jira" as the API token application.
5. Search for and enable the `read:user:jira` scope.
6. Save the token and copy it to your clipboard.
7. Create a string in the format `useremail:api_token`, where `useremail` is your Jira account email and `api_token` is the token you just created. Then, encode this string using BASE64.

- Linux/Unix/MacOS:

```shell
  echo -n "useremail:api_token" | base64
```

- Windows 7 and later, using Microsoft Powershell:
  ```powershell
  $Text = "user@example.com:api_token_string"
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $EncodedText = [Convert]::ToBase64String($Bytes)
  $EncodedText
  ```

_Access token is required to verify your permissions and to ensure you have access to upload results to the target Jira project(s). It is used only for this verification step and nothing else._

### Webhook

1. Navigate to Get Started page of Allure Report App in your instance
2. Find a webhook url and copy it
