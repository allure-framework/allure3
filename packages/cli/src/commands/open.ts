import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";

export class OpenCommand extends Command {
  static paths = [["open"]];

  static usage = Command.Usage({
    description: "Serves specified directory",
    details: "This command serves the specified report directory and opens it in the default browser.",
    examples: [
      ["open", "Serve the default report directory"],
      ["open custom-report --port 8080 --live", "Serve the custom-report directory on port 8080 with live reload"],
    ],
  });

  reportDir = Option.String({ required: false, name: "The directory with Allure results" });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  live = Option.Boolean("--live", {
    description: "Reload pages on any file change in the served directory",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const config = await readConfig(this.cwd, this.config, { output: this.reportDir });

    await serve({
      port: this.port ? parseInt(this.port, 10) : undefined,
      servePath: config.output,
      live: this.live ?? false,
      open: true,
    });
  }
}
