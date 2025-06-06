import { getGitRepoName, readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsCreateCommandAction } from "../../../src/commands/projects/create.js";
import { AllureServiceMock } from "../../utils.js";

vi.mock("prompts", () => ({
  default: vi.fn(),
}));
vi.spyOn(console, "info");
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureService: utils.AllureServiceMock,
  };
});
vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getGitRepoName: vi.fn(),
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

describe("projects create command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await ProjectsCreateCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should create a project with a provided name", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    AllureServiceMock.prototype.createProject.mockResolvedValue({
      name: "foo",
    });

    await ProjectsCreateCommandAction("foo");

    expect(AllureService).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledWith({
      name: "foo",
    });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('project: "foo"'));
  });

  it("should create a project with a name retrieved from git repo", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    AllureServiceMock.prototype.createProject.mockResolvedValue({
      name: "bar",
    });
    (getGitRepoName as Mock).mockResolvedValue("bar");

    await ProjectsCreateCommandAction();

    expect(AllureService).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledWith({
      name: "bar",
    });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('project: "bar"'));
  });

  it("should ask user to enter a project name if it's not provided and can't be retrieved from git repo", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    AllureServiceMock.prototype.createProject.mockResolvedValue({
      name: "baz",
    });
    (getGitRepoName as Mock).mockRejectedValue(new Error("No git repo found"));
    (prompts as unknown as Mock).mockResolvedValue({
      name: "baz",
    });

    await ProjectsCreateCommandAction();

    expect(AllureService).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceMock.prototype.createProject).toHaveBeenCalledWith({
      name: "baz",
    });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('project: "baz"'));
  });

  it("should exit with an error if no project name is provided and can't be retrieved from git repo", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    (getGitRepoName as Mock).mockRejectedValue(new Error("No git repo found"));
    (prompts as unknown as Mock).mockResolvedValue(undefined);

    await ProjectsCreateCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No project name provided!"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
