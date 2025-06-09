import { getGitRepoName, readConfig } from "@allurereport/core";
import { AllureService, KnownError, UnknownError } from "@allurereport/service";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsCreateCommandAction } from "../../../src/commands/projects/create.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureServiceMock } from "../../utils.js";

vi.spyOn(console, "info");
vi.mock("prompts", () => ({
  default: vi.fn(),
}));
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureService: utils.AllureServiceMock,
  };
});
vi.mock("@allurereport/core", async (importOriginal) => ({
  ...(await importOriginal()),
  getGitRepoName: vi.fn(),
  readConfig: vi.fn().mockResolvedValue({
    allureService: {
      url: "https://allure.example.com",
    },
  }),
}));
vi.mock("../../../src/utils/logs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  logError: vi.fn(),
}));

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

  it("should print known service-error without logs writing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceMock.prototype.createProject as Mock).mockRejectedValueOnce(
      new KnownError("Failed to create project", 401),
    );

    await ProjectsCreateCommandAction("foo");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to create project"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (logError as Mock).mockResolvedValueOnce("logs.txt");
    (AllureServiceMock.prototype.createProject as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    await ProjectsCreateCommandAction("foo");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to create project due to unexpected error"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).toHaveBeenCalled();
  });

  it("should throw an error if the service throws an unknown error", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceMock.prototype.createProject as Mock).mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(ProjectsCreateCommandAction("foo")).rejects.toThrow("Unexpected error");
  });

  it("should create a project with a provided name", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    AllureServiceMock.prototype.createProject.mockResolvedValueOnce({
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

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    AllureServiceMock.prototype.createProject.mockResolvedValueOnce({
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

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    AllureServiceMock.prototype.createProject.mockResolvedValueOnce({
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
