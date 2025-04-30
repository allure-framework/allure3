import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureServiceMock } from "../utils.js";

const service = await import("@allurereport/service");
const { LogoutCommandAction } = await import("../../src/commands/logout.js");

vi.mock("@allurereport/service", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AllureService: AllureServiceMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logout command", () => {
  it("should initialize allure service and call logout method", async () => {
    await LogoutCommandAction();

    expect(service.AllureService).toHaveBeenCalledTimes(1);
    expect(service.AllureService).toHaveBeenCalledWith(undefined);
    // eslint-disable-next-line
    expect(service.AllureService.prototype.logout).toHaveBeenCalledTimes(1);
  });
});
