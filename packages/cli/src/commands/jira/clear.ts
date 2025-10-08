import { getPluginInstance, readConfig } from "@allurereport/core";
import JiraPlugin from "@allurereport/plugin-jira";
import { Command, Option, UsageError } from "clipanion";
import { realpath } from "node:fs/promises";
import process, { exit } from "node:process";
import { green, red } from "yoctocolors";

abstract class BaseJiraCommand extends Command {
  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  token = Option.String("--token,-t", {
    description: "Atlassian User OAuth Token (default: ALLURE_JIRA_TOKEN environment variable)",
    required: false,
  });

  webhook = Option.String("--webhook", {
    description: "Allure Jira Integration Webhook URL (default: ALLURE_JIRA_WEBHOOK environment variable)",
    required: false,
  });
}

export class JiraClearCommand extends BaseJiraCommand {
  static paths = [["jira", "clear"]];

  static usage = Command.Usage({
    category: "Integrations",
    description: "Unlink test results or reports in Jira",
    details: "This command posts test results from the provided Allure Results directory to a Jira.",
    examples: [
      [
        "Clear linked test results for the specified Jira issue",
        "jira clear --token xoxb-token --webhook C12345 --issue JIRA-123 --results",
      ],
      [
        "Clear linked reports for the specified Jira issue",
        "jira clear --token xoxb-token --webhook C12345 --issue JIRA-123 --reports",
      ],
      [
        "Clear linked test results and reports for the specified Jira issue",
        "jira clear --token xoxb-token --webhook C12345 --issue JIRA-123 --results --reports",
      ],
      ["Clear from multiple Jira issues", "jira clear --issue JIRA-123 --issue JIRA-456 ..."],
    ],
  });

  issues = Option.Array("--issue", {
    description: "Jira issue key(s)",
    required: true,
    arity: 1,
  });

  clearReports = Option.Boolean("--reports", {
    description: "Unlink reports from the specified Jira issue",
    required: false,
  });

  clearResults = Option.Boolean("--results", {
    description: "Unlink results from the specified Jira issue",
    required: false,
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());

    const config = await readConfig(cwd, this.config);

    const pluginFromConfig = getPluginInstance(config, ({ plugin }) => plugin instanceof JiraPlugin);

    const jiraPlugin = new JiraPlugin({
      token: this.token ?? pluginFromConfig?.options?.token,
      webhook: this.webhook ?? pluginFromConfig?.options?.webhook,
    });

    if (!jiraPlugin.options.token) {
      throw new UsageError("Token is not provided");
    }
    if (!jiraPlugin.options.webhook) {
      throw new UsageError("Webhook url is not provided");
    }

    if (!this.clearReports && !this.clearResults) {
      throw new UsageError("Either --reports or --results must be provided");
    }

    const operation =
      this.clearReports && this.clearResults ? "clearAll" : this.clearReports ? "clearReports" : "clearResults";

    if (operation === "clearAll") {
      try {
        await jiraPlugin.clearAll(this.issues);
        this.context.stdout.write(
          green("All reports and test results have been unlinked from the specified Jira issue"),
        );
      } catch (error) {
        this.context.stderr.write(red("Failed to unlink reports and test results from the specified Jira issue"));
        exit(1);
      }
    }

    if (operation === "clearReports") {
      try {
        await jiraPlugin.clearReports(this.issues);
        this.context.stdout.write(green("All reports have been unlinked from the specified Jira issue"));
      } catch (error) {
        this.context.stderr.write(red("Failed to unlink reports from the specified Jira issue"));
        exit(1);
      }
    }

    if (operation === "clearResults") {
      try {
        await jiraPlugin.clearResults(this.issues);
        this.context.stdout.write(green("All test results have been unlinked from the specified Jira issue"));
      } catch (error) {
        this.context.stderr.write(red("Failed to unlink test results from the specified Jira issue"));
        exit(1);
      }
    }
  }
}
