import { randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import type { AllureCheckResult, AllureCheckStatus } from "@allurereport/core-api";
import { Command, Option, UsageError } from "clipanion";

import { runProcess, terminationOf } from "../utils/index.js";

const checkStatuses: AllureCheckStatus[] = ["passed", "failed"];

const parseCheckStatus = (status: string | undefined): AllureCheckStatus | undefined => {
  if (status === undefined) {
    return undefined;
  }

  if (checkStatuses.includes(status as AllureCheckStatus)) {
    return status as AllureCheckStatus;
  }

  throw new UsageError(`Invalid --status value ${JSON.stringify(status)}. Expected one of: passed, failed`);
};

type CheckCommandOutput = {
  stdout: string;
  stderr: string;
};

const normalizeOutput = (value: string | undefined) => {
  const trimmed = value?.trimEnd();

  return trimmed ? trimmed : undefined;
};

const quoteCommandArg = (arg: string) => {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg)) {
    return arg;
  }

  return `'${arg.replace(/'/g, "'\\''")}'`;
};

const resolveCheckCommand = (args: string[]) => {
  if (args.length === 1) {
    return {
      command: args[0],
      commandArgs: [],
      commandLine: args[0],
      shell: true,
    };
  }

  return {
    command: args[0],
    commandArgs: args.slice(1),
    commandLine: args.map(quoteCommandArg).join(" "),
    shell: false,
  };
};

const buildCheckResult = (
  name: string,
  status: AllureCheckStatus,
  tags: string[] | undefined,
  command: string,
  message: string | undefined,
  error: string | undefined,
): AllureCheckResult => ({
  name,
  status,
  ...(tags?.length ? { tags } : {}),
  details: {
    command,
    ...(message ? { message } : {}),
    ...(error ? { error } : {}),
  },
});

const collectCheckCommandOutput = (checkProcess: ReturnType<typeof runProcess>): CheckCommandOutput => {
  const output = {
    stdout: "",
    stderr: "",
  };

  checkProcess.stdout?.setEncoding("utf8").on?.("data", (data: string) => {
    output.stdout += data;
    process.stdout.write(data);
  });
  checkProcess.stderr?.setEncoding("utf8").on?.("data", (data: string) => {
    output.stderr += data;
    process.stderr.write(data);
  });

  return output;
};

const writeCheckResultFile = async (output: string, result: AllureCheckResult) => {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, `${randomUUID()}-check.json`), `${JSON.stringify(result)}\n`, "utf-8");
};

const dumpCheckResult = async (
  config: Awaited<ReturnType<typeof readConfig>>,
  result: AllureCheckResult,
  dump: string,
) => {
  const allureReport = new AllureReport({
    ...config,
    dump,
    realTime: false,
    plugins: [],
  });

  await allureReport.start();
  await allureReport.store.addCheckResult(result);
  await allureReport.done();
};

export class CheckCommand extends Command {
  static paths = [["check"]];

  static usage = Command.Usage({
    description: "Run a check command or record a manual check result",
    details: "This command records an Allure check result based on a command exit code or an explicit status.",
    examples: [
      ['check --name "Lint" -- npm run lint', "Run npm run lint and record the check result"],
      ['check --name "Manual approval" --status passed --tag release', "Record a manual passed check result"],
      ['check --name "Lint" --dump=checks -- npm run lint', "Store the check result in checks.zip instead of output"],
    ],
  });

  name = Option.String("--name", {
    description: "The check name",
  });

  status = Option.String("--status", {
    description: "The manual check status: passed or failed",
  });

  message = Option.String("--message", {
    description: "The manual check message",
  });

  tag = Option.Array("--tag", {
    description: "Add a tag to the check result. Repeat the option for multiple tags",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well",
  });

  dump = Option.String("--dump", {
    description: "Write the check result to a dump archive with the provided name instead of output",
  });

  commandToRun = Option.Rest();

  async execute() {
    const args = this.commandToRun.filter((arg) => arg !== "--");
    const manualStatus = parseCheckStatus(this.status);

    if (this.name === undefined) {
      throw new UsageError("--name is required");
    }

    if (manualStatus && args.length > 0) {
      throw new UsageError("Use either --status for a manual check or a command after --, not both");
    }

    if (!manualStatus && args.length === 0) {
      throw new UsageError(
        "expecting --status or command to be specified after --, e.g. allure check --name Lint -- npm run lint",
      );
    }

    const cwd = await realpath(this.cwd ?? process.cwd());
    let originalExitCode = manualStatus === "failed" ? 1 : 0;
    let status = manualStatus;
    let commandOutput: CheckCommandOutput | undefined;
    const checkCommand = args.length ? resolveCheckCommand(args) : undefined;

    if (!status) {
      const checkProcess = runProcess({
        command: checkCommand!.command,
        commandArgs: checkCommand!.commandArgs,
        cwd,
        logs: "pipe",
        shell: checkCommand!.shell,
      });
      commandOutput = collectCheckCommandOutput(checkProcess);
      const code = await terminationOf(checkProcess);

      originalExitCode = code ?? 1;
      status = originalExitCode === 0 ? "passed" : "failed";
    }

    const message = normalizeOutput(commandOutput ? commandOutput.stdout : this.message);
    const error = normalizeOutput(commandOutput?.stderr);
    const result = buildCheckResult(this.name, status, this.tag, checkCommand?.commandLine ?? "", message, error);
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      plugins: {},
    });
    const checkConfig = {
      ...config,
      plugins: [],
    };

    if (this.dump) {
      await dumpCheckResult(checkConfig, result, this.dump);
    } else {
      await writeCheckResultFile(checkConfig.output, result);
    }

    exit(status === "passed" ? 0 : originalExitCode || 1);
  }
}
