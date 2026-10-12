import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  register: vi.fn(),
  run: vi.fn().mockResolvedValue(0),
  updateNotifier: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({ name: "allure", description: "Allure Commandline Tool", version: "3.20.1" }),
  ),
}));

vi.mock("node:process", () => {
  const processMock = {
    argv: ["node", "allure"],
    exitCode: undefined,
    stdout: { write: vi.fn() },
  };

  return { ...processMock, default: processMock };
});

vi.mock("clipanion", () => ({
  Builtins: { HelpCommand: class {}, VersionCommand: class {} },
  Cli: vi.fn(function CliMock() {
    return { register: mocks.register, run: mocks.run };
  }),
}));

vi.mock("update-notifier", () => ({ default: mocks.updateNotifier }));

vi.mock("../src/commands/index.js", () => {
  const command = class {};

  return {
    AgentCommand: command,
    AGENT_TASK_MAP_HELP: "",
    AgentCapabilitiesCommand: command,
    AgentInspectCommand: command,
    AgentLatestCommand: command,
    AgentQueryCommand: command,
    AgentSelectCommand: command,
    AgentStateDirCommand: command,
    Allure2Command: command,
    AwesomeCommand: command,
    CheckCommand: command,
    ClassicCommand: command,
    CsvCommand: command,
    DashboardCommand: command,
    GenerateCommand: command,
    GitlabGenerateCommand: command,
    HistoryCommand: command,
    JiraClearCommand: command,
    LogCommand: command,
    OpenCommand: command,
    QualityGateCommand: command,
    ResultsPackCommand: command,
    ResultsUnpackCommand: command,
    RunCommand: command,
    SlackCommand: command,
    TestOpsPlanCommand: command,
    TestPlanCommand: command,
    WatchCommand: command,
    isAgentTaskMapHelpRequest: vi.fn(() => false),
  };
});

describe("CLI update notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateNotifier.mockReturnValue({ notify: mocks.notify });
  });

  it("checks for a newer published Allure version on startup", async () => {
    await import("../src/index.js");

    expect(mocks.updateNotifier).toHaveBeenCalledWith({
      pkg: { name: "allure", description: "Allure Commandline Tool", version: "3.20.1" },
      shouldNotifyInNpmScript: true,
    });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });
});
