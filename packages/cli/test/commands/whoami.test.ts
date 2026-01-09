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
  // JWT payload: { "iss": "allure-service", "url": "https://allure.example.com", "projectId": "test-project-id" }
  accessToken:
    "header.eyJpc3MiOiJhbGx1cmUtc2VydmljZSIsInVybCI6Imh0dHBzOi8vYWxsdXJlLmV4YW1wbGUuY29tIiwicHJvamVjdElkIjoidGVzdC1wcm9qZWN0LWlkIn0.signature",
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
    readConfig: vi.fn(),
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
  it("should throw an error if there is no allure service access token in the config", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No Allure Service access token is provided"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureServiceClientMock.prototype.profile).not.toHaveBeenCalled();
  });

  it("should print known service-error without logs writing", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        accessToken: fixtures.accessToken,
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
        accessToken: fixtures.accessToken,
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
    (readConfig as Mock).mockResolvedValueOnce({
      allureService: {
        accessToken: fixtures.accessToken,
      },
    });
    AllureServiceClientMock.prototype.profile.mockResolvedValueOnce({
      user: { email: "example@allurereport.org" },
      project: { name: "Test Project" },
    });

    const command = new WhoamiCommand();

    command.cwd = fixtures.cwd;
    command.config = fixtures.config;

    await command.execute();

    expect(AllureServiceClient).toHaveBeenCalledTimes(1);
    expect(AllureServiceClient).toHaveBeenCalledWith({ accessToken: fixtures.accessToken });
    expect(AllureServiceClientMock.prototype.profile).toHaveBeenCalledTimes(1);
  });
});
