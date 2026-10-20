import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { OpenCommand } from "../../src/commands/open.js";
import { notifySignals } from "../../src/utils/signals.js";

vi.mock("../../src/utils/signals.js", async (importOriginal) => ({
  ...(await importOriginal()),
  notifySignals: vi.fn(),
}));

let shutdown: AbortController;

vi.mock("node:fs", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    existsSync: vi.fn(),
  };
});
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}));
vi.mock("node:os", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    tmpdir: vi.fn(),
  };
});
vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async () => {
  return {
    readConfig: vi.fn(),
  };
});
vi.mock("@allurereport/static-server", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    serve: vi.fn(),
  };
});
vi.mock("../../src/commands/commons/generate.js", () => ({
  generate: vi.fn(),
}));

const mockServe = () => {
  const stop = vi.fn().mockResolvedValue(undefined);
  return {
    serve: (serve as Mock).mockImplementation(() => {
      shutdown.abort();
      return { stop };
    }),
    stop,
  };
};

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("open");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  shutdown = new AbortController();
  vi.mocked(notifySignals).mockReturnValue({
    signal: shutdown.signal,
    info: () => ({ signal: "SIGINT", code: 130, receivedAt: 0, deadline: 0 }),
    dispose: vi.fn(),
  });
});

describe("open command", () => {
  it("should open a generated report", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    vi.mocked(tmpdir).mockReturnValue("tmp");
    vi.mocked(mkdtemp).mockResolvedValue("temporary-report");
    (readConfig as Mock).mockResolvedValue({ output: "temporary-report" });
    const { serve } = mockServe();

    const exitCode = await run(OpenCommand, ["open", "results"]);

    expect(exitCode).toBe(0);
    expect(serve).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it("should open an existing report", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["summary.json"]);
    vi.mocked(tmpdir).mockReturnValue("tmp");
    (readConfig as Mock).mockResolvedValue({ output: "existing-report" });
    const { serve } = mockServe();

    const exitCode = await run(OpenCommand, ["open", "results"]);

    expect(exitCode).toBe(0);
    expect(serve).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it("should reject --open", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    vi.mocked(tmpdir).mockReturnValue("tmp");
    vi.mocked(mkdtemp).mockResolvedValue("temporary-report");
    (readConfig as Mock).mockResolvedValue({ output: "temporary-report" });

    const exitCode = await run(OpenCommand, ["open", "--open=false", "results"]);

    expect(exitCode).toBe(1);
  });
});
