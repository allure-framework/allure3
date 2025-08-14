import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import * as console from "node:console";
import { exit } from "node:process";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsListCommand } from "../../../src/commands/projects/list.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureServiceClientMock } from "../../utils.js";

const fixtures = {
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

vi.mock("prompts", () => ({
  default: vi.fn(),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    readConfig: vi.fn().mockResolvedValue({
      allureService: {
        url: "https://allure.example.com",
      },
    }),
  };
});
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureServiceClient: utils.AllureServiceClientMock,
  };
});
vi.mock("../../../src/utils/logs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  logError: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projects list command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.projects).not.toHaveBeenCalled();
  });

  it("should log a message if there are no projects", async () => {
    AllureServiceClientMock.prototype.projects.mockResolvedValue([]);

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.projects).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("No projects found. Create a new one"));
  });

  it("should prompt to select a project and log config if selected", async () => {
    AllureServiceClientMock.prototype.projects.mockResolvedValue([{ name: "foo" }, { name: "bar" }]);
    (prompts as unknown as Mock).mockResolvedValue({ project: "foo" });

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.projects).toHaveBeenCalledTimes(1);
    expect(prompts).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "select",
        name: "project",
        message: expect.any(String),
        choices: [
          expect.objectContaining({ title: "foo", value: "foo" }),
          expect.objectContaining({ title: "bar", value: "bar" }),
        ],
      }),
    );
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('project: "foo"'));
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.projects as Mock).mockRejectedValueOnce(
      new KnownError("Failed to list projects", 401),
    );

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to list projects"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (logError as Mock).mockResolvedValueOnce("logs.txt");
    (AllureServiceClientMock.prototype.projects as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Failed to get projects due to unexpected error", expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if no project is selected", async () => {
    AllureServiceClientMock.prototype.projects.mockResolvedValue([{ name: "foo" }]);
    (prompts as unknown as Mock).mockResolvedValue({});

    const command = new ProjectsListCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No project selected"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
