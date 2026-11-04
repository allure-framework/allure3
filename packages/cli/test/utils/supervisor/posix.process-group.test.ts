import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  PROCESS_GROUP_SCAN_INTERVAL_MS,
  createProcessGroupCompletionPoller,
  scanProcessGroup,
} from "../../../src/utils/supervisor/posix/processGroup.js";
import type {
  ProcessGroupCompletionPoller,
  ProcessGroupCompletionPollResult,
  ProcessGroupScanner,
  ProcessListReader,
} from "../../../src/utils/supervisor/posix/processGroup.js";

const PGID = 42;

const psOutput = (...processes: ReadonlyArray<readonly [pid: number, pgid: number, stat: string]>) =>
  processes.map(([pid, pgid, stat]) => `${pid} ${pgid} ${stat}`).join("\n");

describe("POSIX process-group completion", () => {
  let now: number;
  let readProcessList: ReturnType<typeof vi.fn<ProcessListReader>>;
  let reportError: ReturnType<typeof vi.fn<(error: unknown) => void>>;
  let scan: ProcessGroupScanner;

  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("posix-process-supervisor");
    await label("coverage", "cli-run");

    now = 1_000;
    readProcessList = vi.fn<ProcessListReader>();
    reportError = vi.fn<(error: unknown) => void>();
    scan = (processGroupId) => scanProcessGroup(processGroupId, readProcessList);
  });

  const advanceToNextScan = () => {
    now += PROCESS_GROUP_SCAN_INTERVAL_MS;
  };

  const createPoller = () =>
    createProcessGroupCompletionPoller({
      processGroupId: PGID,
      scanProcessGroup: scan,
      reportError,
      now: () => now,
    });

  const collectPolls = async (poll: ProcessGroupCompletionPoller, count: number) => {
    const result: ProcessGroupCompletionPollResult[] = [];
    for (let i = 0; i < count - 1; i++) {
      result.push(await poll());
      advanceToNextScan();
    }
    result.push(await poll());
    return result;
  };

  it("returns pending if a living process detected", async () => {
    readProcessList.mockResolvedValueOnce(psOutput([101, PGID, "Z"], [102, PGID, "S"]));
    const poll = createPoller();

    await expect(poll()).resolves.toBe("pending");

    expect(readProcessList).toHaveBeenCalledTimes(1);
  });

  it("performs no scan if not enough time passed", async () => {
    readProcessList.mockResolvedValueOnce(psOutput([102, PGID, "S"]));
    const poll = createPoller();
    const originalNow = now;

    await expect(poll()).resolves.toBe("pending");
    now += Math.floor(PROCESS_GROUP_SCAN_INTERVAL_MS / 5);
    await expect(poll()).resolves.toBe("pending");
    now += Math.floor(PROCESS_GROUP_SCAN_INTERVAL_MS / 5);
    await expect(poll()).resolves.toBe("pending");
    now = originalNow + PROCESS_GROUP_SCAN_INTERVAL_MS - 1;
    await expect(poll()).resolves.toBe("pending");

    expect(readProcessList).toHaveBeenCalledTimes(1);
  });

  it("completes after no new zombies for three consecutive polls and no living processes", async () => {
    readProcessList.mockResolvedValue(psOutput([101, PGID, "Z+"]));
    const poll = createPoller();

    await expect(collectPolls(poll, 4)).resolves.toStrictEqual(["pending", "pending", "pending", "complete"]);

    expect(readProcessList).toHaveBeenCalledTimes(4);
  });

  it("restarts confirmation when a living process detected", async () => {
    readProcessList
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "Z+"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "S"]))
      .mockResolvedValue(psOutput());
    const poll = createPoller();

    await expect(collectPolls(poll, 6)).resolves.toStrictEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "complete",
    ]);

    expect(readProcessList).toHaveBeenCalledTimes(6);
  });

  it("restarts confirmation when a new zombie appears", async () => {
    readProcessList
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"], [102, PGID, "Z"]));
    readProcessList.mockResolvedValue(psOutput([101, PGID, "Z"], [102, PGID, "Z"]));
    const poll = createPoller();

    await expect(collectPolls(poll, 6)).resolves.toStrictEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "complete",
    ]);

    expect(readProcessList).toHaveBeenCalledTimes(6);
  });

  it("keeps accumulated confirmation when zombies are reaped", async () => {
    readProcessList
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"], [102, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"], [102, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([102, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput());
    const poll = createPoller();

    await expect(collectPolls(poll, 4)).resolves.toStrictEqual(["pending", "pending", "pending", "complete"]);

    expect(readProcessList).toHaveBeenCalledTimes(4);
  });

  it("recognizes Z, X, and x process states as exited", async () => {
    readProcessList.mockResolvedValue(
      psOutput([101, PGID, "Z+"], [102, PGID, "X"], [103, PGID, "x<"], [201, PGID + 1, "R"]),
    );

    await expect(scanProcessGroup(PGID, readProcessList)).resolves.toEqual({
      status: "no-live-members-found",
      exitedPids: [101, 102, 103],
    });
  });

  it("confirmations still required when ps lists no members", async () => {
    readProcessList.mockResolvedValue(psOutput());
    const poll = createPoller();

    await expect(collectPolls(poll, 4)).resolves.toStrictEqual(["pending", "pending", "pending", "complete"]);

    expect(readProcessList).toHaveBeenCalledTimes(4);
  });

  it("reports failed and malformed ps probes and retries them after the scan interval", async () => {
    readProcessList
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"]))
      .mockResolvedValueOnce(psOutput([101, PGID, "Z"]))
      .mockRejectedValueOnce(new Error("ps unavailable"))
      .mockResolvedValueOnce("malformed")
      .mockResolvedValue(psOutput([101, PGID, "Z"]));
    const poll = createPoller();

    await expect(collectPolls(poll, 2)).resolves.toStrictEqual(["pending", "pending"]);
    expect(reportError).not.toHaveBeenCalled();

    advanceToNextScan();
    await expect(poll()).resolves.toBe("pending");

    expect(readProcessList).toHaveBeenCalledTimes(3);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "ps unavailable" }));
    reportError.mockClear();

    advanceToNextScan();
    await expect(poll()).resolves.toBe("pending");

    expect(readProcessList).toHaveBeenCalledTimes(4);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: "Unexpected format of ps output: malformed" }),
    );

    advanceToNextScan();
    await expect(collectPolls(poll, 3)).resolves.toStrictEqual(["pending", "pending", "complete"]);

    expect(readProcessList).toHaveBeenCalledTimes(7);
  });

  it("reuses an in-flight ps probe", async () => {
    let resolveProbe!: (value: string) => void;
    const pendingProbe = new Promise<string>((resolve) => {
      resolveProbe = resolve;
    });
    readProcessList.mockReturnValue(pendingProbe);
    const poll = createPoller();

    const firstProbe = poll();
    const secondProbe = poll();

    expect(secondProbe).toBe(firstProbe);
    expect(readProcessList).toHaveBeenCalledTimes(1);

    resolveProbe(psOutput([101, PGID, "Z"]));
    await expect(firstProbe).resolves.toBe("pending");
  });
});
