import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runGit } from "../src/runGit.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = vi.mocked(spawnSync);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runGit", () => {
  it("writes stderr hint when ALLURE_DEBUG is set and git fails", () => {
    vi.stubEnv("ALLURE_DEBUG", "true");
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    spawnSyncMock.mockReturnValue({
      status: 128,
      stdout: "",
      stderr: "fatal: not a git repository",
      pid: 1,
      output: ["", "fatal: not a git repository", ""],
      signal: null,
      error: undefined,
    } as ReturnType<typeof spawnSync>);

    expect(runGit(["rev-parse", "HEAD"])).toBeUndefined();
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("[allurereport/git] git rev-parse HEAD failed (status=128): fatal: not a git repository"),
    );
  });

  it("blocks --upload-pack and does not spawn git", () => {
    expect(runGit(["ls-remote", "--upload-pack=evil"])).toBeUndefined();
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("writes stderr hint when ALLURE_DEBUG is set and unsafe args are blocked", () => {
    vi.stubEnv("ALLURE_DEBUG", "true");
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(runGit(["--upload-pack"])).toBeUndefined();
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("[allurereport/git] blocked unsafe git arguments: --upload-pack"),
    );
  });

  it("does not write stderr hint when ALLURE_DEBUG is unset", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error",
      pid: 1,
      output: ["", "error", ""],
      signal: null,
      error: undefined,
    } as ReturnType<typeof spawnSync>);

    expect(runGit(["status"])).toBeUndefined();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
