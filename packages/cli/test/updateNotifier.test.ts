import * as fs from "node:fs";
import process from "node:process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { isNewerVersion, notifyAboutUpdate, parseUpdateNotifierArgs } from "../src/utils/updateNotifier.js";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");

describe("CLI update notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: true });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "999.0.0" }) }));
    for (const key of ["CI", "NODE_ENV", "NO_UPDATE_NOTIFIER", "npm_config_user_agent", "npm_execpath"])
      vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (ttyDescriptor) Object.defineProperty(process.stderr, "isTTY", ttyDescriptor);
    else Reflect.deleteProperty(process.stderr, "isTTY");
  });

  it("consumes opt-out flags only before the nested command separator", () => {
    expect(parseUpdateNotifierArgs(["--no-update-notifier", "generate", "--no-update-notifier"])).toEqual({
      args: ["generate"],
      disabled: true,
    });
    expect(parseUpdateNotifierArgs(["run", "--", "npm", "--no-update-notifier"])).toEqual({
      args: ["run", "--", "npm", "--no-update-notifier"],
      disabled: false,
    });
  });

  it.each(
    [["agent"], ["agent", "inspect"], ["--help"], ["generate", "-h"], ["--version"], ["-v"], []].map((args) => ({
      args,
    })),
  )("does not check or notify for excluded arguments %j", async ({ args }) => {
    await notifyAboutUpdate(args);
    expect(fetch).not.toHaveBeenCalled();
    expect(process.stderr.write).not.toHaveBeenCalled();
  });

  it.each(["CI", "NODE_ENV", "NO_UPDATE_NOTIFIER", "npm_config_user_agent", "npm_execpath"])(
    "respects the %s environment exclusion",
    async (key) => {
      vi.stubEnv(key, key === "NODE_ENV" ? "test" : "1");
      await notifyAboutUpdate(["generate"]);
      expect(fetch).not.toHaveBeenCalled();
      expect(process.stderr.write).not.toHaveBeenCalled();
    },
  );

  it("honors explicit opt-out and skips non-interactive terminals", async () => {
    await notifyAboutUpdate(["generate"], true);
    Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: false });
    await notifyAboutUpdate(["generate"]);
    expect(fetch).not.toHaveBeenCalled();
    expect(process.stderr.write).not.toHaveBeenCalled();
  });

  it("uses installed package metadata and ignores nested version flags", async () => {
    vi.mocked(fs.readFileSync).mockReturnValueOnce('{"name":"allure","version":"3.21.0-beta.2"}');
    await notifyAboutUpdate(["run", "--", "pytest", "-v"]);
    expect(fetch).toHaveBeenCalledWith("https://registry.npmjs.org/allure/beta", { signal: expect.any(AbortSignal) });
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("Update available 3.21.0-beta.2 → 999.0.0"),
    );
  });

  it.each(["missing", "malformed", "invalid version"])("ignores %s package metadata", async (kind) => {
    const readPackage = vi.mocked(fs.readFileSync);
    if (kind === "missing")
      readPackage.mockImplementationOnce(() => {
        throw new Error("missing package.json");
      });
    else readPackage.mockReturnValueOnce(kind === "malformed" ? "{" : '{"name":"allure","version":"invalid"}');
    await expect(notifyAboutUpdate(["generate"])).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(process.stderr.write).not.toHaveBeenCalled();
  });

  it.each([
    ["4.0.0", "3.99.99", true],
    ["3.99.99", "4.0.0", false],
    ["3.21.0", "3.20.99", true],
    ["3.20.99", "3.21.0", false],
    ["3.20.2", "3.20.1", true],
    ["3.20.1", "3.20.1", false],
    ["3.21.0-beta.10", "3.21.0-beta.2", true],
    ["3.21.0-beta.2", "3.21.0-beta.10", false],
    ["3.21.0", "3.21.0-beta.10", true],
    ["3.21.0-beta.10", "3.21.0", false],
    ["3.20.1", "3.21.0-beta.2", false],
    ["3.21.0-rc.1", "3.21.0-beta.2", false],
    ["invalid", "3.20.1", false],
    ["3.21.0-beta", "3.20.1", false],
  ])("compares %s with %s: newer = %s", (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });

  it("checks the registry directly on each eligible invocation", async () => {
    await notifyAboutUpdate(["generate"]);
    await notifyAboutUpdate(["generate"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(process.stderr.write).toHaveBeenCalledTimes(2);
  });

  it.each(["offline", "http", "invalid", "malformed", "timeout"])(
    "stays silent on %s registry failures",
    async (failure) => {
      vi.mocked(fetch).mockImplementationOnce(async () => {
        if (failure === "offline") throw new Error("offline");
        if (failure === "timeout") throw new DOMException("timed out", "TimeoutError");
        return {
          ok: failure !== "http",
          json: async () => {
            if (failure === "malformed") throw new SyntaxError("invalid JSON");
            return { version: "invalid" };
          },
        } as Response;
      });
      await expect(notifyAboutUpdate(["generate"])).resolves.toBeUndefined();
      expect(process.stderr.write).not.toHaveBeenCalled();
    },
  );
});
