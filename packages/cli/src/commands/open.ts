import { Command } from "clipanion";

import { BaseServeCommand } from "./serve.js";

export class OpenCommand extends BaseServeCommand {
  static paths = [["open"]];

  static usage = Command.Usage({
    description: "Serves a report and opens it in the default browser, generating it from test results if necessary.",
    details:
      "This command starts a report server and opens the report in the default browser. If test results are" +
      " provided, it generates the report in a temporary directory before serving and opening it. With no arguments," +
      " it serves the configured output directory or, if no report exists there, generates a report from the" +
      " configured test results.",
    examples: [
      ["open ./allure-results", "Generate, serve, and open the report from the given test results directory"],
      ["open --port 8080 ./allure-report", "Serve the report on port 8080 and open it"],
      [
        "open --host 127.0.0.1 ./allure-report",
        "Serve the report on the loopback interface only and open it in the default browser.",
      ],
      [
        "open ./packages/*/allure-results",
        "Generate, serve, and open the report from all test results directories matching the pattern",
      ],
      [
        "open ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate, serve, and open the report from two test results directories",
      ],
    ],
  });

  protected override get shouldOpen() {
    return true;
  }
}
