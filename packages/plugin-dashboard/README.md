# Allure Dashboard Plugin

Plugin for generating dashboard with trend graphs for Allure reports.

## Installation

```bash
npm install @allurereport/plugin-dashboard
```

## Usage

```typescript
import { DashboardPlugin } from "@allurereport/plugin-dashboard";

// Create plugin instance
const dashboardPlugin = new DashboardPlugin({
  // Plugin options
  singleFile: false
});

// Add plugin to Allure configuration
const allure = new AllureReport({
  // ...
  plugins: [
    // ...
    dashboardPlugin
  ]
});
```

## Chart Types

### Status Trends

Status trend charts show how test statuses change over time.

### Severity Trends

Severity trend charts show how the distribution of tests by severity levels changes over time.

## API

### DashboardPlugin

Main plugin class.

#### Options

- `singleFile` - if `true`, dashboard data will be stored in memory instead of files.

## License

Apache-2.0 