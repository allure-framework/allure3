import { type AllureStore, type TestResult, createTestPlan, filterUnsuccessful } from "@allurereport/core-api";
import type { Plugin, PluginContext } from "@allurereport/plugin-api";
import console from "node:console";

interface TestPlanPluginOptions {
  fileName?: string;
  filter?: (a: TestResult) => boolean;
}

export class TestPlanPlugin implements Plugin {
  constructor(readonly options: TestPlanPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const { reportFiles } = context;
    const testResults = await store.allTestResults();
    const { filter = filterUnsuccessful, fileName = "testplan.json" } = this.options;
    const included = testResults.filter(filter);

    if (included.length === 0) {
      console.log("no tests included to test plan, skipping the generation");
      return;
    }

    const testPlan = createTestPlan(included);

    const result = Buffer.from(JSON.stringify(testPlan), "utf-8");

    await reportFiles.addFile(fileName, result);
  };
}
