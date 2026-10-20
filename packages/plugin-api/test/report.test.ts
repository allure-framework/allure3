import type {
  AttachmentTestStepResult,
  DefaultTestStepResult,
  HistoryDataPoint,
  TestFixtureResult,
} from "@allurereport/core-api";
import { describe, expect, it, vi } from "vite-plus/test";

import { convertFixtureResult, generateHistoryDataPoints, writeConcurrently } from "../src/index.js";

describe("report writing", () => {
  it("waits for the entire batch of 64 before starting the next batch", async () => {
    const releases: (() => void)[] = [];
    const started: number[] = [];
    const items = Array.from({ length: 65 }, (_, i) => i);
    const writing = writeConcurrently(items, async (item) => {
      started.push(item);
      if (item < 64) {
        await new Promise<void>((resolve) => releases.push(resolve));
      }
    });

    expect(started).toEqual(items.slice(0, 64));
    releases.slice(0, 63).forEach((release) => release());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(started).toHaveLength(64);
    releases[63]();
    await writing;
    expect(started).toEqual(items);
  });

  it("rejects without starting later batches or waiting for the remaining writes", async () => {
    const error = new Error("write failed");
    let release!: () => void;
    const write = vi.fn(async (item: number) => {
      if (item === 0) {
        throw error;
      }
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });

    try {
      await expect(writeConcurrently([0, 1, 2], write, 2)).rejects.toBe(error);
      expect(write.mock.calls.map(([item]) => item)).toEqual([0, 1]);
    } finally {
      release();
    }
  });
});

describe("report fixture projection", () => {
  it("projects fixtures and redacts nested steps without mutating inputs or copying attachments", () => {
    const attachment: AttachmentTestStepResult = {
      type: "attachment",
      link: { id: "log", name: "log", originalFileName: "log.txt", ext: ".txt", used: true, missed: true },
    };
    const token = { name: "token", value: "secret", hidden: false, masked: true, excluded: false };
    const hidden = { ...token, name: "internal", value: "hidden", hidden: true };
    const step: DefaultTestStepResult = {
      type: "step",
      name: "setup step",
      status: "passed",
      parameters: [token, hidden],
      steps: [attachment],
    };
    const outer = { ...step, name: "outer", parameters: [], steps: [step] };
    const fixture: TestFixtureResult = {
      id: "fixture",
      type: "before",
      name: "setup",
      status: "passed",
      duration: 30,
      start: 10,
      stop: 40,
      testResultIds: ["test"],
      sourceMetadata: { readerId: "system", metadata: {} },
      steps: [outer, attachment],
    };

    const result = convertFixtureResult(fixture);

    expect(result).toEqual({
      id: "fixture",
      type: "before",
      name: "setup",
      status: "passed",
      duration: 30,
      steps: [{ ...outer, steps: [{ ...step, parameters: [{ ...token, value: "<masked>" }] }] }, attachment],
    });
    expect(result.steps[0]).not.toBe(outer);
    expect(result.steps[1]).toBe(attachment);
    expect(fixture.steps[0]).toBe(outer);
    expect(step.parameters).toEqual([token, hidden]);
    expect(token.value).toBe("secret");
  });
});

describe("report history writing", () => {
  const history = (): HistoryDataPoint[] =>
    Array.from({ length: 8 }, (_, i) => ({
      uuid: `point-${i}`,
      name: `run-${i}`,
      timestamp: 100 - i,
      knownTestCaseIds: [],
      testResults: {},
      metrics: {},
      url: `https://example.org/run-${i}`,
    }));

  it("writes only the first six history points in store order, one at a time", async () => {
    const points = history();
    const allHistoryDataPoints = vi.fn().mockResolvedValue(points);
    const releases: (() => void)[] = [];
    const writeData = vi.fn<(fileName: string, data: HistoryDataPoint) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );
    const writing = generateHistoryDataPoints({ writeData }, { allHistoryDataPoints });

    for (let i = 0; i < 6; i++) {
      await vi.waitFor(() => expect(writeData).toHaveBeenCalledTimes(i + 1));
      expect(writeData.mock.calls[i]).toEqual([`history/point-${i}.json`, points[i]]);
      releases[i]();
    }

    await writing;
    expect(writeData).toHaveBeenCalledTimes(6);
    expect(allHistoryDataPoints).toHaveBeenCalledTimes(1);
    expect(points).toHaveLength(8);
  });

  it("stops writing history after a failure and preserves the rejection", async () => {
    const error = new Error("history write failed");
    const writeData = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const allHistoryDataPoints = vi.fn().mockResolvedValue(history());

    await expect(generateHistoryDataPoints({ writeData }, { allHistoryDataPoints })).rejects.toBe(error);
    expect(writeData.mock.calls.map(([name]) => name)).toEqual(["history/point-0.json", "history/point-1.json"]);
  });
});
