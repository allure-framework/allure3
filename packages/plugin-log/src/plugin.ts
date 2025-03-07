import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import * as console from "node:console";
import { gray } from "yoctocolors";
import type { LogPluginOptions } from "./model.js";
import { printSummary, printTest } from "./utils.js";

export class LogPlugin implements Plugin {
  constructor(readonly options: LogPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore) => {
    const { groupBy = "suite" } = this.options ?? {};
    const allTestResults = await store.allTestResults();

    if (groupBy === "none") {
      allTestResults.forEach((test) => {
        printTest(test, this.options);
      });

      console.log("");

      printSummary(Array.from(allTestResults));
      return;
    }

    const groupedTests = await store.testResultsByLabel(groupBy);

    Object.keys(groupedTests).forEach((key) => {
      const tests = groupedTests[key];

      if (tests.length === 0) {
        // skip empty groups
        return;
      }

      if (key === "_") {
        console.info(gray("uncategorized"));
      } else {
        console.info(key);
      }

      tests.forEach((test) => {
        printTest(test, this.options, 1);
      });

      console.log("");
    });

    printSummary(Array.from(allTestResults));
  };
}
