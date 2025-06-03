# Dashboard Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin generates dashboard with trend graphs for Allure reports, allowing you to track test execution statistics over time.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-dashboard
yarn add @allurereport/plugin-dashboard
pnpm add @allurereport/plugin-dashboard
```

Then, add the plugin to the Allure configuration file:

```typescript
import { defineConfig } from "allure";

export default defineConfig({
  plugins: {
    dashboard: {
      options: {
        singleFile: false,
        reportName: "My Dashboard",
        reportLanguage: "en",
        layout: [
          {
            type: "trend",
            dataType: "status",
            mode: "percent"
          },
          {
            type: "pie",
            title: "Test Results"
          }
        ]
      }
    }
  }
});
```

## Features

### Available Widgets

#### Trend Charts

Trend charts allow you to track metrics over time. Available configurations:

```typescript
{
  type: "trend",
  dataType: "status",
  mode: "percent", // optional, default: "raw"
  limit: 10, // optional: limit number of builds, default: 10
  title: "Custom Status Trend", // optional
  metadata: { // optional
    executionIdAccessor: (executionOrder) => `build-${executionOrder}`,
    executionNameAccessor: (executionOrder) => `build #${executionOrder}`
  }
}
```

#### Pie Charts

Pie charts show distribution of test results:

```typescript
{
  type: "pie",
  title: "Custom Pie" // optional
}
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

## License

Apache-2.0 