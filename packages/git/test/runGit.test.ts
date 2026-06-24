import { spawnSync } from "node:child_process";

import { afterEach, describe, it, vi, expect } from "vitest";

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

    const result = runGit(["rev-parse", "HEAD"]);

    expect(
      {
        result,
        stderr: writeSpy.mock.calls[0]?.[0],
      },
      "returns undefined and logs a debug hint when git command fails",
    ).toEqual({
      result: undefined,
      stderr: expect.stringContaining(
        "[allurereport/git] git rev-parse HEAD failed (status=128): fatal: not a git repository",
      ),
    });
  });

  it("blocks --upload-pack and does not spawn git", () => {
    const result = runGit(["ls-remote", "--upload-pack=evil"]);

    expect(
      {
        result,
        spawned: spawnSyncMock.mock.calls,
      },
      "blocks unsafe --upload-pack arguments without spawning git",
    ).toEqual({
      result: undefined,
      spawned: [],
    });
  });

  it("writes stderr hint when ALLURE_DEBUG is set and unsafe args are blocked", () => {
    vi.stubEnv("ALLURE_DEBUG", "true");
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const result = runGit(["--upload-pack"]);

    expect(
      {
        result,
        spawned: spawnSyncMock.mock.calls,
        stderr: writeSpy.mock.calls.map((call) => call[0]),
      },
      "blocks unsafe arguments, avoids spawning git, and logs a debug hint",
    ).toEqual({
      result: undefined,
      spawned: [],
      stderr: [expect.stringContaining("[allurereport/git] blocked unsafe git arguments: --upload-pack")],
    });
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

    const result = runGit(["status"]);

    expect(
      {
        result,
        stderrWrites: writeSpy.mock.calls,
      },
      "returns undefined without debug stderr output when ALLURE_DEBUG is unset",
    ).toEqual({
      result: undefined,
      stderrWrites: [],
    });
  });
});
