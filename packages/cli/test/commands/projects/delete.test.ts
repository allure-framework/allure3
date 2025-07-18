import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import * as console from "node:console";
import { exit } from "node:process";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsDeleteCommand } from "../../../src/commands/projects/delete.js";
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
vi.mock("../../../src/utils/logs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  logError: vi.fn(),
}));
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureServiceClient: utils.AllureServiceClientMock,
  };
});
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projects delete command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.deleteProject).not.toHaveBeenCalled();
  });

  it("should delete a project with a provided name and force option", async () => {
    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = fixtures.projectName;
    command.force = true;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: fixtures.projectName });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });

  it("should ask for confirmation before deleting if force is not set", async () => {
    (prompts as unknown as Mock).mockResolvedValue({ value: true });
    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = "bar";
    command.force = false;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: "bar" });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });

  it("should exit with code 0 and not delete the project if user cancels confirmation", async () => {
    (prompts as unknown as Mock).mockResolvedValue({ value: false });

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = "baz";
    command.force = false;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
    expect(AllureServiceClientMock.prototype.deleteProject).not.toHaveBeenCalled();
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.deleteProject as Mock).mockRejectedValueOnce(
      new KnownError("Failed to delete project", 401),
    );
    (prompts as unknown as Mock).mockResolvedValueOnce({ value: true });
    (logError as Mock).mockResolvedValueOnce("logs.txt");

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = "qux";
    command.force = false;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to delete project"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.deleteProject as Mock).mockRejectedValueOnce(
      new UnknownError("Unexpected error"),
    );
    (prompts as unknown as Mock).mockResolvedValueOnce({ value: true });

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = "qux";
    command.force = false;

    await command.execute();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Failed to delete project due to unexpected error", expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should forcily delete a project without confirmation", async () => {
    (prompts as unknown as Mock).mockResolvedValue({ value: false });
    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});

    const command = new ProjectsDeleteCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;
    command.projectName = "qux";
    command.force = true;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: "qux" });
    expect(prompts).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });
});
