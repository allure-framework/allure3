import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import * as console from "node:console";
import { exit } from "node:process";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsCreateCommand } from "../../../src/commands/projects/create.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureServiceClientMock } from "../../utils.js";

const fixtures = {
  config: "./custom/allurerc.mjs",
  cwd: ".",
  projectName: "foo",
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
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureServiceClient: utils.AllureServiceClientMock,
  };
});
vi.mock("@allurereport/core", async (importOriginal) => ({
  ...(await importOriginal()),
  readConfig: vi.fn().mockResolvedValue({
    allureService: {
      url: "https://allure.example.com",
    },
  }),
}));
vi.mock("@allurereport/ci", () => ({
  detect: vi.fn(),
}));
vi.mock("../../../src/utils/logs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  logError: vi.fn(),
}));

const { detect } = await import("@allurereport/ci");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projects create command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.createProject as Mock).mockRejectedValueOnce(
      new KnownError("Failed to create project", 401),
    );

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = fixtures.projectName;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to create project"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should create a project with a provided name", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    AllureServiceClientMock.prototype.createProject.mockResolvedValueOnce({
      id: "foo-id",
      name: "foo",
    });

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = fixtures.projectName;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledWith({
      name: "foo",
    });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('project: "foo-id"'));
  });

  it("should create a project with a name retrieved from git repo", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (detect as Mock).mockReturnValue({
      repoName: "bar",
    });
    AllureServiceClientMock.prototype.createProject.mockResolvedValueOnce({
      id: "bar-id",
      name: "bar",
    });

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = undefined;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledWith({
      name: "bar",
    });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('project: "bar-id"'));
  });

  it("should ask user to enter a project name if it's not provided and can't be retrieved from git repo", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (detect as Mock).mockReturnValue({
      repoName: "",
    });
    (prompts as unknown as Mock).mockResolvedValue({
      name: "baz",
    });
    AllureServiceClientMock.prototype.createProject.mockResolvedValueOnce({
      id: "baz-id",
      name: "baz",
    });

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = undefined;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.createProject).toHaveBeenCalledWith({
      name: "baz",
    });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('project: "baz-id"'));
  });

  it("should exit with an error if no project name is provided and can't be retrieved from git repo", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (detect as Mock).mockReturnValue({
      repoName: "",
    });
    (prompts as unknown as Mock).mockResolvedValue(undefined);

    const command = new ProjectsCreateCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = undefined;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No project name provided!"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
