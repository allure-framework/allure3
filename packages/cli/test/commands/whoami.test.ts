import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureServiceMock } from "../utils.js";

const service = await import("@allurereport/service");
const { WhoamiCommandAction } = await import("../../src/commands/whoami.js");

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
    AllureServiceMock.prototype.profile.mockResolvedValueOnce({
      email: "example@allurereport.org",
    });

    await WhoamiCommandAction();

    expect(service.AllureService).toHaveBeenCalledTimes(1);
    expect(service.AllureService).toHaveBeenCalledWith(undefined);
    // eslint-disable-next-line
    expect(service.AllureService.prototype.profile).toHaveBeenCalledTimes(1);
  });
});
