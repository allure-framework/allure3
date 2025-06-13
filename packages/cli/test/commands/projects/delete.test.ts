import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import prompts from "prompts";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsDeleteCommandAction } from "../../../src/commands/projects/delete.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureServiceClientMock } from "../../utils.js";

vi.mock("prompts", () => ({
  default: vi.fn(),
}));
vi.spyOn(console, "info");
vi.spyOn(console, "error");
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

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await ProjectsDeleteCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.deleteProject).not.toHaveBeenCalled();
  });

  it("should delete a project with a provided name and force option", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");
    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});

    await ProjectsDeleteCommandAction("foo", { force: true });

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: "foo" });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });

  it("should ask for confirmation before deleting if force is not set", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    (prompts as unknown as Mock).mockResolvedValue({ value: true });
    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});

    await ProjectsDeleteCommandAction("bar");

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: "bar" });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });

  it("should exit with code 0 and not delete the project if user cancels confirmation", async () => {
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    (prompts as unknown as Mock).mockResolvedValue({ value: false });

    await ProjectsDeleteCommandAction("baz");

    expect(processExitSpy).toHaveBeenCalledWith(0);
    expect(AllureServiceClientMock.prototype.deleteProject).not.toHaveBeenCalled();
  });

  it("should exit with an error if no project name is provided", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await ProjectsDeleteCommandAction(undefined);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No project name is provided"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.deleteProject).not.toHaveBeenCalled();
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
    (AllureServiceClientMock.prototype.deleteProject as Mock).mockRejectedValueOnce(
      new KnownError("Failed to delete project", 401),
    );
    (prompts as unknown as Mock).mockResolvedValueOnce({ value: true });
    (logError as Mock).mockResolvedValueOnce("logs.txt");

    await ProjectsDeleteCommandAction("qux");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to delete project"));
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
    (AllureServiceClientMock.prototype.deleteProject as Mock).mockRejectedValueOnce(
      new UnknownError("Unexpected error"),
    );
    (prompts as unknown as Mock).mockResolvedValueOnce({ value: true });

    await ProjectsDeleteCommandAction("qux");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete project due to unexpected error"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).toHaveBeenCalled();
  });

  it("should just throw if unknown error is not instance of KnownError or UnknownError", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (prompts as unknown as Mock).mockResolvedValueOnce({ value: true });
    (AllureServiceClientMock.prototype.deleteProject as Mock).mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(ProjectsDeleteCommandAction("qux")).rejects.toThrow("Unexpected error");
  });

  it("should print unknown service-error with logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
  });

  it("should print unknown service-error with logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
  });

  it("should forcily delete a project without confirmation", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info");

    AllureServiceClientMock.prototype.deleteProject.mockResolvedValue({});
    (prompts as unknown as Mock).mockResolvedValue({ value: false });

    await ProjectsDeleteCommandAction("qux", { force: true });

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.deleteProject).toHaveBeenCalledWith({ name: "qux" });
    expect(prompts).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining("Project has been deleted"));
  });
});
