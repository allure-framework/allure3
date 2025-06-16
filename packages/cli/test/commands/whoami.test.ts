import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { WhoamiCommandAction } from "../../src/commands/whoami.js";
import { logError } from "../../src/utils/logs.js";
import { AllureServiceClientMock } from "../utils.js";

vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("../utils.js");

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
vi.mock("../../src/utils/logs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  logError: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logout command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const consoleErrorSpy = vi.spyOn(console, "error");
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    await WhoamiCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.profile).not.toHaveBeenCalled();
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

    (AllureServiceClientMock.prototype.profile as Mock).mockRejectedValueOnce(
      new KnownError("Failed to get profile", 401),
    );

    await WhoamiCommandAction();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get profile"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writing", async () => {
    // @ts-ignore
    const processExitSpy = vi.spyOn(process, "exit").mockImplementationOnce(() => {});

    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (logError as Mock).mockResolvedValueOnce("logs.txt");
    (AllureServiceClientMock.prototype.profile as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    await WhoamiCommandAction();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Failed to get profile due to unexpected error", expect.any(Error));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should initialize allure service and call logout method", async () => {
    AllureServiceClientMock.prototype.profile.mockResolvedValueOnce({
      email: "example@allurereport.org",
    });

    await WhoamiCommandAction();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClient).toHaveBeenCalledWith({ url: "https://allure.example.com" });
    expect(AllureServiceClientMock.prototype.profile).toHaveBeenCalledTimes(1);
  });
});
