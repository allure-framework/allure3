import { readConfig } from "@allurereport/core";
import { AllureService, KnownError, UnknownError } from "@allurereport/service";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutCommandAction } from "../../src/commands/logout.js";
import { logError } from "../../src/utils/logs.js";
import { AllureServiceMock } from "../utils.js";

vi.mock("../../src/utils/logs.js", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    logError: vi.fn(),
  };
});
vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    AllureService: utils.AllureServiceMock,
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

describe("logout command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await LogoutCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(AllureServiceMock.prototype.logout).not.toHaveBeenCalled();
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceMock.prototype.logout as Mock).mockRejectedValueOnce(new KnownError("Failed to logout", 401));

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await LogoutCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to logout: Failed to logout"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (logError as Mock).mockResolvedValueOnce("logs.txt");
    (AllureServiceMock.prototype.logout as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await LogoutCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to logout due to unexpected error"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).toHaveBeenCalled();
  });

  it("should just throw if unknown error is not instance of KnownError or UnknownError", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceMock.prototype.logout as Mock).mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(LogoutCommandAction()).rejects.toThrow("Unexpected error");
  });

  it("should initialize allure service and call logout method", async () => {
    await LogoutCommandAction();

    expect(AllureService).toHaveBeenCalledTimes(1);
    expect(AllureService).toHaveBeenCalledWith({ url: "https://allure.example.com" });
    // eslint-disable-next-line
    expect(AllureService.prototype.logout).toHaveBeenCalledTimes(1);
  });
});
