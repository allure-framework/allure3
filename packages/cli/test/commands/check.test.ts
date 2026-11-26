import { mkdir, writeFile } from "node:fs/promises";

import { readConfig } from "@allurereport/core";
import { epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { CheckCommand } from "../../src/commands/check.js";
import { runProcess, terminationOf } from "../../src/utils/index.js";

const { exitMock, stdoutWriteMock, stderrWriteMock, childProcess } = vi.hoisted(() => {
  const createOutputStream = () => {
    const handlers: Record<string, ((data: string) => void)[]> = {};
    const stream = {
      setEncoding: vi.fn(() => stream),
      on: vi.fn((event: string, handler: (data: string) => void) => {
        handlers[event] = [...(handlers[event] ?? []), handler];

        return stream;
      }),
      emit: (event: string, data: string) => {
        for (const handler of handlers[event] ?? []) {
          handler(data);
        }
      },
      reset: () => {
        for (const key of Object.keys(handlers)) {
          delete handlers[key];
        }
        stream.setEncoding.mockClear();
        stream.on.mockClear();
      },
    };

    return stream;
  };
  const exitMock = vi.fn();
  const stdoutWriteMock = vi.fn();
  const stderrWriteMock = vi.fn();
  const childProcess = {
    pid: 123,
    stdout: createOutputStream(),
    stderr: createOutputStream(),
  };

  return {
    exitMock,
    stdoutWriteMock,
    stderrWriteMock,
    childProcess,
  };
});

vi.mock("node:process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:process") & { default: typeof import("node:process") }>();
  const processMock = {
    cwd: actual.default.cwd.bind(actual.default),
    stdout: {
      write: (...args: unknown[]) => stdoutWriteMock(...args),
    },
    stderr: {
      write: (...args: unknown[]) => stderrWriteMock(...args),
    },
  };

  return {
    ...actual,
    default: processMock,
    exit: (...args: unknown[]) => exitMock(...args),
  };
});
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    readConfig: vi.fn(),
  };
});
vi.mock("../../src/utils/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/index.js")>()),
  runProcess: vi.fn(() => childProcess),
  terminationOf: vi.fn().mockResolvedValue(0),
}));

const readWrittenCheckResult = () => {
  const [, content] = vi.mocked(writeFile).mock.calls[0];

  return JSON.parse(String(content));
};

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("check");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  childProcess.stdout.reset();
  childProcess.stderr.reset();

  (readConfig as Mock).mockResolvedValue({
    output: "/report-output",
  });

  const { AllureReportMock } = await import("../utils.js");

  AllureReportMock.prototype.store = {
    failedTestResults: vi.fn().mockResolvedValue([]),
    allTestResults: vi.fn().mockResolvedValue([]),
    addQualityGateResult: vi.fn().mockResolvedValue(undefined),
    qualityGateResults: vi.fn().mockResolvedValue([]),
  };
});

describe("check command", () => {
  it("should run a check command and write a passed result to output", async () => {
    await run(CheckCommand, ["check", "--name", "Lint", "--output", "./checks", "--", "npm", "run", "lint"]);

    expect(readConfig).toHaveBeenCalledWith("/cwd", undefined, {
      output: "./checks",
      plugins: {},
    });
    expect(runProcess).toHaveBeenCalledWith({
      command: "npm",
      commandArgs: ["run", "lint"],
      cwd: "/cwd",
      logs: "pipe",
      shell: false,
    });
    const writtenCheckResult = readWrittenCheckResult();

    expect(mkdir).toHaveBeenCalledWith("/report-output", { recursive: true });
    expect(vi.mocked(writeFile).mock.calls[0][0]).toMatch(/-quality-gate\.json$/);
    expect(writtenCheckResult).toEqual({
      status: "passed",
      key: "Lint",
      source: {
        type: "command",
        command: "npm run lint",
      },
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should run a single string check command through the shell in the resolved cwd", async () => {
    await run(CheckCommand, ["check", "--name", "List", "--", "ls ."]);

    expect(runProcess).toHaveBeenCalledWith({
      command: "ls .",
      commandArgs: [],
      cwd: "/cwd",
      logs: "pipe",
      shell: true,
    });
    expect(readWrittenCheckResult()).toEqual({
      status: "passed",
      key: "List",
      source: {
        type: "command",
        command: "ls .",
      },
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should write a failed result and exit with the check command code", async () => {
    vi.mocked(terminationOf).mockImplementationOnce(async () => {
      childProcess.stdout.emit("data", "running lint\n");
      childProcess.stderr.emit("data", "lint failed\n");

      return 2;
    });

    await run(CheckCommand, [
      "check",
      "--name",
      "Lint",
      "--message",
      "Run configured lint policy",
      "--tag",
      "ci",
      "--tag",
      "lint",
      "--",
      "npm",
      "run",
      "lint",
    ]);

    expect(readWrittenCheckResult()).toEqual({
      status: "failed",
      key: "Lint",
      tags: ["ci", "lint"],
      source: {
        type: "command",
        command: "npm run lint",
      },
      details: {
        message: "Run configured lint policy",
        stdout: "running lint\n",
        stderr: "lint failed\n",
      },
    });
    expect(stdoutWriteMock).toHaveBeenCalledWith("running lint\n");
    expect(stderrWriteMock).toHaveBeenCalledWith("lint failed\n");
    expect(exitMock).toHaveBeenCalledWith(2);
  });

  it("should write a manual result", async () => {
    await run(CheckCommand, ["check", "--name", "Manual approval", "--status", "passed", "--message", "approved"]);

    expect(runProcess).not.toHaveBeenCalled();
    expect(readWrittenCheckResult()).toEqual({
      status: "passed",
      key: "Manual approval",
      source: { type: "manual" },
      details: {
        message: "approved",
      },
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should put the result into a dump instead of writing to output", async () => {
    const { AllureReportMock } = await import("../utils.js");

    await run(CheckCommand, ["check", "--name", "Manual approval", "--status", "passed", "--dump", "checks"]);

    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "/report-output",
        dump: "checks",
        realTime: false,
        plugins: [],
      }),
    );
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.store.addQualityGateResult).toHaveBeenCalledWith({
      status: "passed",
      key: "Manual approval",
      source: { type: "manual" },
    });
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should fail with usage error when neither status nor command is provided", async () => {
    const command = new CheckCommand();

    command.name = "Lint";
    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should reject invalid manual statuses", async () => {
    const command = new CheckCommand();

    command.name = "Lint";
    command.status = "broken";
    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });
});
