# Allure Summary

**Allure Summary** provides a short overview of a plugin execution. It also can be used to represent any 
test run data outside of Allure Report plugins, to make it compatible with the Allure ecosystem.

Now, Allure Summary is utilized for the following purposes:

- displaying plugins on the Allure Report Summary page
- producing output by [Allure Github Action](https://github.com/allure-framework/allure-action)
- building another kind of integration that may require brief test information

## Structure of the Allure Summary

```ts
// it's a short test result format that contains enough data to represent a test in the summary
export type SummaryTestResult = {
  name: string;
  id: string;
  status: "passed" | "failed" | "broken" | "skipped" | "unknown";
  duration: number;
}

export interface AllureSummary {
  // link to the hosted report (for example, published to Allure Service)
  remoteHref?: string;
  // link to the job that produced the report (for example, CI job)
  jobHref?: string;
  // link to the pull request that triggered the job
  pullRequestHref?: string;
  // the report's name which displays on the summary page
  name: string;
  // overall statistics
  stats: {
    regressed?: number;
    fixed?: number;
    malfunctioned?: number;
    new?: number;
    failed?: number;
    broken?: number;
    passed?: number;
    skipped?: number;
    unknown?: number;
    total: number;
    retries?: number;
    flaky?: number;
  };
  // the worst test result status
  status: "passed" | "failed" | "broken" | "skipped" | "unknown";
  // total test run duration in milliseconds
  duration: number;
  // the id of the plugin that generated the summary
  plugin?: string;
  // brief description of the test run
  newTests?: SummaryTestResult[];
  flakyTests?: SummaryTestResult[];
  retryTests?: SummaryTestResult[];
  // date when the plugin generated the output
  createdAt?: number;
}
```

## Displaying the plugin's summary information

To make your plugin visible on the Allure Report Summary page or in the Allure GitHub action comment, you need to 
Implement the `info` method in the plugin class that returns the `AllureSummary` object:

```ts
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type AllureSummary,
} from "@allurereport/plugin-api";

export class MyPlugin implements Plugin {
  // ...
  
  // typical implementation of the info method
  async info(context: PluginContext, store: AllureStore): Promise<AllureSummary> {
    const allTrs = (await store.allTestResults()).filter((tr) =>
      this.options.filter ? this.options.filter(tr) : true,
    );
    const newTrs = await store.allNewTestResults();
    const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
    const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

    return {
      plugin: "My plugin",
      name: this.options.reportName || context.reportName,
      stats: await store.testsStatistic(this.options.filter),
      status: getWorstStatus(allTrs.map(({ status }) => status)) ?? "passed",
      newTests: newTrs.map(convertToSummaryTestResult),
      flakyTests: flakyTrs.map(convertToSummaryTestResult),
      retryTests: retryTrs.map(convertToSummaryTestResult),
      duration,
      createdAt,
    };
  }
}
```
