import type { Config } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../../src/config.js";

const resolve = (allureService: Config["allureService"]) => resolveConfig({ allureService }, { plugins: {} });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Allure Service configuration", () => {
  it("resolves an environment expression and preserves service settings", async () => {
    vi.stubEnv("REPORT_TOKEN", "token-from-env");

    const config = await resolve({
      accessToken: "${{ env.REPORT_TOKEN }}",
      private: true,
      uploadConcurrency: 2,
      uploadMaxAttempts: 3,
    });

    expect(config.allureService).toEqual({
      accessToken: "token-from-env",
      private: true,
      uploadConcurrency: 2,
      uploadMaxAttempts: 3,
      uploadMaxSimultaneousFailures: 5,
    });
  });

  it.each(["literal-token", "", undefined])("preserves literal access token %j", async (accessToken) => {
    const config = await resolve({ accessToken });

    expect(config.allureService).toMatchObject({ accessToken, uploadMaxAttempts: 5, uploadMaxSimultaneousFailures: 5 });
  });

  it.each(["${{ unknown }}", "${{ true }}"])("reports invalid token expression %s at its path", async (accessToken) => {
    const resolution = resolve({ accessToken });

    await expect(resolution).rejects.toThrow("allureService.accessToken");
  });
});
