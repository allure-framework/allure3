import { realpath } from "node:fs/promises";
import process from "node:process";

import { readConfig } from "@allurereport/core";
import { Command, Option, UsageError } from "clipanion";

import { buildGhWorkflowYaml, configuredEnvironmentIds, normalizeEnvironmentIds } from "../utils/ghWorkflow.js";

const describeError = (error: unknown) => {
  if (error instanceof UsageError) {
    return error.message;
  }

  return error instanceof Error ? (error.stack ?? error.message) : String(error);
};

export class GhWorkflowCommand extends Command {
  static paths = [["gh-workflow"]];

  static usage = Command.Usage({
    category: "Integrations",
    description: "Prints GitHub Actions jobs that run tests per environment and build one Allure report",
    details: `
      Prints a \`test\` job (a matrix over the environments: \`allure run\` with a dump, then the dump is uploaded)
      and a \`report\` job (downloads all dumps and runs \`allure generate\`). Paste the output under \`jobs:\` of a
      workflow file and fill in the TODO steps. The names of the environment, the dump file, the artifact and the
      download pattern are kept consistent for you.
      Environments come from \`--env\`; without it, the \`environments\` declared in the Allure config are used.
      Errors are written to stderr and the exit code is non-zero. Command-line syntax errors are reported by the CLI
      parser on stdout. Versions of the GitHub actions in the output are examples, pin the ones you use.
    `,
    examples: [
      ["gh-workflow --env foo --env bar --env baz", "Print the jobs for three environments (test command: npm test)"],
      ["gh-workflow --env linux --env windows -- yarn test", "Use a custom test command"],
      ["gh-workflow --config ./allurerc.mjs", "Use the environments declared in the config"],
    ],
  });

  // Unlike `run --environment` (forces one environment on a run), here the option builds the list of environments
  environments = Option.Array("--environment,--env", {
    description: "Environment id to include. Can be repeated. Default: every environment from the config",
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file. Also passed to the generated allure commands",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  testCommand = Option.Rest({
    name: "Test command to run. Pass it after `--` (default: npm test)",
  });

  async execute() {
    try {
      const environmentIds =
        this.environments !== undefined && this.environments.length > 0
          ? normalizeEnvironmentIds(this.environments)
          : await this.#readConfiguredEnvironmentIds();
      const yaml = buildGhWorkflowYaml({
        environmentIds,
        testCommand: this.testCommand.length > 0 ? this.testCommand : undefined,
        config: this.config,
      });

      this.context.stdout.write(yaml);

      return 0;
    } catch (error) {
      this.context.stderr.write(`${describeError(error)}\n`);

      return 1;
    }
  }

  async #readConfiguredEnvironmentIds() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    // only `environments` is needed, so skip plugin loading: plugins can print to stdout or fail to resolve
    const config = await readConfig(cwd, this.config, { plugins: {} });

    return configuredEnvironmentIds(config.environments);
  }
}
