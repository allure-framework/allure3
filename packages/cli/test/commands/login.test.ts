import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginCommand } from "../../src/commands/login.js";
import { logError } from "../../src/utils/logs.js";
import { AllureServiceClientMock } from "../utils.js";

const fixtures = {
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

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
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn().mockImplementationOnce(() => {}),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
  info: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login command", () => {
  it("should throw an error if there is not allure service url in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new LoginCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service URL is provided"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.login).not.toHaveBeenCalled();
  });

  it("should print known service-error as is without logs writting", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (AllureServiceClientMock.prototype.login as Mock).mockRejectedValueOnce(new KnownError("Failed to login", 401));

    const command = new LoginCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to login"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("should print unknown service-error with logs writting", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        url: "https://allure.example.com",
      },
    });
    (logError as Mock).mockResolvedValueOnce("logs.txt");
    (AllureServiceClientMock.prototype.login as Mock).mockRejectedValueOnce(new UnknownError("Unexpected error"));

    const command = new LoginCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Failed to login due to unexpected error", expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should initialize allure service and call login method", async () => {
    const command = new LoginCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClient).toHaveBeenCalledWith({ url: "https://allure.example.com" });
    // eslint-disable-next-line
    expect(AllureServiceClient.prototype.login).toHaveBeenCalledTimes(1);
  });
});
