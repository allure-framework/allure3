import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { WhoamiCommand } from "../../src/commands/whoami.js";
import { logError } from "../../src/utils/logs.js";
import { AllureServiceClientMock } from "../utils.js";

const fixtures = {
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

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
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("whoami command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.profile).not.toHaveBeenCalled();
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.profile as Mock).mockRejectedValueOnce(
      new KnownError("Failed to get profile", 401),
    );

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to get profile"));
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
    (AllureServiceClientMock.prototype.profile as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Failed to get profile due to unexpected error", expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should initialize allure service and call profile method", async () => {
    AllureServiceClientMock.prototype.profile.mockResolvedValueOnce({
      email: "example@allurereport.org",
    });

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClient).toHaveBeenCalledWith({ url: "https://allure.example.com" });
    expect(AllureServiceClientMock.prototype.profile).toHaveBeenCalledTimes(1);
  });
});
