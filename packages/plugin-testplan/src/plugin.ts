import console from "node:console";

import { type TestResult, createTestPlan, filterUnsuccessful } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";

interface TestPlanPluginOptions {
  fileName?: string;
  mutedOnly?: boolean;
  filter?: (a: TestResult) => boolean;
}

export class TestPlanPlugin implements Plugin {
  constructor(readonly options: TestPlanPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const { reportFiles } = context;
    const testResults = await store.allTestResults();
    const { filter = filterUnsuccessful, fileName = "testplan.json", mutedOnly = false } = this.options;
    const included = mutedOnly ? [] : testResults.filter(filter);
    const muted = testResults.filter((result) => result.muted === true);

    if ((included.length === 0 && muted.length === 0) || (mutedOnly && muted.length === 0)) {
      const msg = mutedOnly ? "no muted tests found" : "no tests included in test plan";
      console.log(`${msg}, skipping the generation`);
      return;
    }

    const testPlan = createTestPlan(included, muted);
    const result = Buffer.from(JSON.stringify(testPlan), "utf-8");

    await reportFiles.addFile(fileName, result);
  };
}
