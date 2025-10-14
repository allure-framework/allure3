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
+        issue: "JIRA-123",
+        uploadReport: true,
+        uploadResults: true
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option          | Description                                          | Type      | Environment Variable         |
| --------------- | ---------------------------------------------------- | --------- | ---------------------------- |
| `webhook`       | Allure Jira Integration Webhook URL                  | `string`  | `ALLURE_JIRA_WEBHOOK`        |
| `token`         | Generated Atlassian API token                        | `string`  | `ALLURE_JIRA_TOKEN`          |
| `issue`         | Jira issue to link report to                         | `string`  | `ALLURE_JIRA_ISSUE`          |
| `uploadReport`  | Whether to upload the report to specified jira issue | `boolean` | `ALLURE_JIRA_UPLOAD_REPORT`  |
| `uploadResults` | Whether to upload the test results to linked issues  | `boolean` | `ALLURE_JIRA_UPLOAD_RESULTS` |

**Note:** Any values set in your `allurerc.mjs` configuration file will take precedence over values defined in environment variables.

### Webhook URL

1. Navigate to your app's "Get Started" page.
2. Copy the webhook URL provided on that page.

### Token

1. Navigate to [Atlassian Account > Security > API Tokens](https://id.atlassian.com/manage/api-tokens).
2. Click the "Create API token with scopes" button.
3. Enter a name for your token and set an expiration date.
4. Select "Jira" as the API token application.
5. Search for and enable the `read:jira-user` scope.
6. Save the token and copy it to your clipboard.
7. Create a string in the format `useremail:api_token`, where `useremail` is your Jira account email and `api_token` is the token you just created. Then, encode this string using BASE64.

- Linux/Unix/MacOS:

```shell
  echo -n "user@example.com:api_token_string" | base64
```

- Windows 7 and later, using Microsoft Powershell:
  ```powershell
  $Text = "user@example.com:api_token_string"
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $EncodedText = [Convert]::ToBase64String($Bytes)
  $EncodedText
  ```

_Access token is required to verify your permissions and to ensure you have edit access for the specified Jira issue(s). It is used only for this verification step and nothing else._

## Usage

### Uploading Test Results and/or Reports to Jira

When you set either the `uploadReport` or `uploadResults` flag to `true`, the plugin will automatically upload the Allure report or test results to Jira during the report generation process.

- Use `uploadReport: true` to attach the full report to a specific Jira issue.
- Use `uploadResults: true` to upload individual test results linked to Jira issues.

Once report generation is finished, the specified data is seamlessly sent to your Jira instance—no extra commands required.

**Note:**

- The user associated with the provided token must have edit permissions for any Jira issues specified in the `issue` option, as well as for any issues linked in your tests.
- Only issues belonging to the Jira instance specified by provided `webhook` URL will be processed or updated by the plugin.

### Clearing Uploaded Data

You can remove previously uploaded test data from Jira using the `allure jira clear` command. This allows you to clear reports, results, or both from one or multiple Jira issues.

#### Clear Uploaded Reports

Use the `--reports` flag to delete uploaded reports for the specified issue(s):

```shell
# Using npm
npx allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --reports

# Using yarn
yarn allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --reports

# Using pnpm
pnpm allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --reports
```

You may specify multiple issues by repeating the `--issue` flag:

```shell
# Using npm
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --reports
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --reports

# Using yarn
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --reports
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --reports

# Using pnpm
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --reports
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --reports
```

#### Clear Uploaded Test Results

Use the `--results` flag to delete test results uploaded to one or more issues:

```shell
# Using npm
npx allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results

# Using yarn
yarn allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results

# Using pnpm
pnpm allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results
```

Examples:

```shell
# Using npm
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results

# Using yarn
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results

# Using pnpm
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results
```

#### Clear Both Reports and Results

To remove both uploaded reports and test results from the specified issues, use both flags together:

```shell
# Using npm
npx allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results --reports

# Using yarn
yarn allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results --reports

# Using pnpm
pnpm allure jira clear --token <token> --webhook <webhook-url> --issue <issue-key> --results --reports
```

Examples:

```shell
# Using npm
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results --reports
npx allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results --reports

# Using yarn
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results --reports
yarn allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results --reports

# Using pnpm
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --results --reports
pnpm allure jira clear --token dmR2dWto... --webhook https://95f453e... --issue JIRA-1 --issue JIRA-2 --results --reports
```

**Tip:**

- You can use the `--issue` flag multiple times in a single command to target several Jira issues at once.
- Always provide a valid `--token` for authentication and correct `--webhook` from the app in your Jira instance.
- Use the flags `--reports`, `--results`, or both based on what you want to clear.
