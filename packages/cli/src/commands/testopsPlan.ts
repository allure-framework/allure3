import * as console from "node:console";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env, exit } from "node:process";

import { applyAllureCiEnv } from "@allurereport/ci";
import type { TestPlan } from "@allurereport/core-api";
import { createServiceHttpClient } from "@allurereport/service";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

type TestOpsTestCaseInfo = {
  id?: number;
  selector?: string;
};

export class TestOpsPlanCommand extends Command {
  static paths = [["testops-plan"]];

  static usage = Command.Usage({
    description: "Fetches a testplan.json for the current TestOps job run",
    details:
      "Reads ALLURE_JOB_RUN_ID and, when it's set, downloads the test cases selected for that job run " +
      "from TestOps and writes them as a testplan.json compatible with ALLURE_TESTPLAN_PATH. " +
      "Does nothing when ALLURE_JOB_RUN_ID isn't set, which covers every run TestOps didn't trigger itself.",
    examples: [
      ["testops-plan", "Write ./testplan.json from the current job run, if any"],
      ["testops-plan --output custom-testplan.json", "Write to a custom path instead"],
    ],
  });

  output = Option.String("--output,-o", {
    description: "The output file name. Absolute paths are accepted as well (default: ./testplan.json)",
  });

  async execute() {
    applyAllureCiEnv();

    const jobRunId = Number(env.ALLURE_JOB_RUN_ID);

    if (!Number.isInteger(jobRunId) || jobRunId <= 0) {
      console.log("ALLURE_JOB_RUN_ID isn't set, skipping test plan generation");
      return;
    }

    const endpoint = env.ALLURE_ENDPOINT;
    const accessToken = env.ALLURE_TOKEN;

    if (!endpoint || !accessToken) {
      console.error(red("ALLURE_ENDPOINT and ALLURE_TOKEN are required to fetch a test plan from TestOps"));
      exit(1);
      return;
    }

    const client = createServiceHttpClient(endpoint, { apiToken: accessToken });
    let tests: TestOpsTestCaseInfo[] | undefined;

    try {
      tests = await client.get<TestOpsTestCaseInfo[]>(`/api/rs/jobrun/${jobRunId}/plan`, {
        params: { expected: "true" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(red(`Could not fetch the test plan for job run ${jobRunId}, continuing without one: ${message}`));
      return;
    }

    const testPlan: TestPlan = {
      version: "1.0",
      tests: (tests ?? []).map(({ id, selector }) => ({
        ...(id !== undefined ? { id: String(id) } : {}),
        ...(selector !== undefined ? { selector } : {}),
      })),
    };

    const output = resolve(this.output ?? "./testplan.json");

    await writeFile(output, JSON.stringify(testPlan), "utf-8");

    console.log(`test plan for job run ${jobRunId} written to ${output} (${testPlan.tests.length} test(s))`);
  }
}
