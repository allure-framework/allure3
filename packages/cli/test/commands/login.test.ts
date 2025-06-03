import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureServiceMock } from "../utils.js";

const service = await import("@allurereport/service");
const { LoginCommandAction } = await import("../../src/commands/login.js");

vi.mock("@allurereport/service", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AllureService: AllureServiceMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login command", () => {
  it("should initialize allure service and call login method", async () => {
    await LoginCommandAction();

    expect(service.AllureService).toHaveBeenCalledTimes(1);
    expect(service.AllureService).toHaveBeenCalledWith(undefined);
    // eslint-disable-next-line
    expect(service.AllureService.prototype.login).toHaveBeenCalledTimes(1);
  });
});
