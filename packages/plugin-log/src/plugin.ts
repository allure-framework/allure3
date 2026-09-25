import * as console from "node:console";

import type { AllureStore, Plugin, PluginContext, QualityGateValidationResult } from "@allurereport/plugin-api";
import { gray } from "yoctocolors";

import type { LogPluginOptions } from "./model.js";
import { printQualityGateResults, printSummary, printTest } from "./utils.js";

const defaultQualityGateFilter = ({ success }: QualityGateValidationResult) => !success;

export class LogPlugin implements Plugin {
  constructor(readonly options: LogPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore) => {
    const {
      groupBy = "suite",
      filter = () => true,
      qualityGateResults = true,
      qualityGateFilter = defaultQualityGateFilter,
    } = this.options ?? {};
    const allTestResults = await store.allTestResults();
    const filteredTestResults = allTestResults.filter(filter);
    const qualityGateResultsToPrint = qualityGateResults
      ? (await store.qualityGateResults()).filter(qualityGateFilter)
      : [];

    if (groupBy === "none") {
      filteredTestResults.forEach((test) => {
        printTest(test, this.options);
      });

      console.log("");
    } else {
      const groupedTests = await store.testResultsByLabel(groupBy);

      Object.keys(groupedTests).forEach((key) => {
        const tests = groupedTests[key].filter(filter);

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
    }

    printSummary(filteredTestResults, {
      total: allTestResults.length,
      filtered: filteredTestResults.length,
    });
    if (qualityGateResults) {
      printQualityGateResults(qualityGateResultsToPrint);
    }
  };
}
