import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";

export interface SlackPluginOptions {
  channel?: string;
  token?: string;
  webhook?: string;
}

// TODO sort by status first?
const defaultSort = (a: TestResult, b: TestResult): number => (a.fullName ?? "").localeCompare(b.fullName ?? "");

export class SlackPlugin implements Plugin {
  constructor(readonly options: SlackPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const statistic = await store.testsStatistic();
    if (statistic.total === 0) {
      throw new Error("no test results found");
    }

    const stat = (status: TestStatus) => {
      if (statistic[status]) {
        return [
          {
            type: "text",
            text: `${status} tests: `,
            style: {
              bold: true,
            },
          },
          {
            type: "text",
            text: `${statistic[status]}\n`,
          },
        ];
      }
      return [];
    };

    const t = (result: TestResult) => {
      return {
        type: "rich_text_section",
        elements: [
          {
            type: "text",
            text: result.fullName ?? "unknown test",
          },
        ],
      };
    };

    const testResults = await store.failedTestResults();

    const tests = testResults.sort(defaultSort).map(t);

    const blocks = [
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [...stat("failed"), ...stat("broken"), ...stat("passed"), ...stat("skipped"), ...stat("unknown")],
          },
          {
            type: "rich_text_list",
            style: "bullet",
            elements: [...tests],
          },
        ],
      },
    ];

    const {
      token = process.env.ALLURE_SLACK_TOKEN,
      channel = process.env.ALLURE_SLACK_CHANNEL,
      webhook = process.env.ALLURE_SLACK_WEBHOOK,
    } = this.options;

    if (webhook) {
      const response = await fetch(webhook, {
        method: "POST",
        body: JSON.stringify({ blocks }),
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
      });

      if (!response.ok) {
        throw new Error(`slack error: ${await response.text()}`);
      }

      return;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      body: JSON.stringify({
        channel,
        blocks,
      }),
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Authorization": `Bearer ${token}`,
      },
    });

    const { ok, error } = (await response.json()) as { ok: boolean; error?: string };
    if (!ok) {
      throw new Error(`slack error: ${error}`);
    }
  };
}
