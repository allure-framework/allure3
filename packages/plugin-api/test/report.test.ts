import type {
  AttachmentTestStepResult,
  AttachmentLink,
  DefaultTestStepResult,
  HistoryDataPoint,
  TestFixtureResult,
} from "@allurereport/core-api";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ResultFile } from "../src/resultFile.js";
import {
  convertFixtureResult,
  generateAttachmentsFiles,
  categoryMatch,
  generateHistoryDataPoints,
  mapConcurrently,
  writeConcurrently,
} from "../src/utils/report.js";

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

  it("maps batches of eight in input order even when items finish in reverse order", async () => {
    const releases: (() => void)[] = [];
    const started: number[] = [];
    const items = Array.from({ length: 9 }, (_, i) => i);
    const mapping = mapConcurrently(items, async (item) => {
      started.push(item);
      if (item < 8) {
        await new Promise<void>((resolve) => releases.push(resolve));
      }
      return `value-${item}`;
    });

    expect(started).toEqual(items.slice(0, 8));
    releases
      .slice(1)
      .reverse()
      .forEach((release) => release());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(started).toHaveLength(8);
    releases[0]();
    expect(await mapping).toEqual(items.map((item) => `value-${item}`));
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

  it("keeps the fixture error so reports can show why a setup or teardown failed", () => {
    const error = { message: "connection refused", trace: "at setup (db.ts:1)", expected: "1", actual: "2" };
    const fixture: TestFixtureResult = {
      id: "broken-fixture",
      type: "after",
      name: "teardown",
      status: "broken",
      error,
      testResultIds: ["test"],
      sourceMetadata: { readerId: "system", metadata: {} },
      steps: [],
    };

    expect(convertFixtureResult(fixture)).toMatchObject({ id: "broken-fixture", status: "broken", error });
  });

  it("marks a fixture whose error repeats a nested step error", () => {
    const failedStep: DefaultTestStepResult = {
      type: "step",
      stepId: "outer",
      name: "outer",
      status: "passed",
      parameters: [],
      steps: [
        {
          type: "step",
          stepId: "inner",
          name: "connect",
          status: "broken",
          message: "connection refused",
          parameters: [],
          steps: [],
        },
      ],
    };
    const makeFixture = (message: string): TestFixtureResult => ({
      id: "fixture",
      type: "before",
      name: "setup",
      status: "broken",
      error: { message },
      testResultIds: ["test"],
      sourceMetadata: { readerId: "system", metadata: {} },
      steps: [failedStep],
    });

    expect(convertFixtureResult(makeFixture("connection refused")).hasSimilarErrorInSubSteps).toBe(true);
    expect(convertFixtureResult(makeFixture("timeout")).hasSimilarErrorInSubSteps).toBe(false);
    expect(convertFixtureResult({ ...makeFixture("x"), error: undefined }).hasSimilarErrorInSubSteps).toBeUndefined();
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

describe("attachment writing", () => {
  const links: AttachmentLink[] = [
    { id: "missed", ext: ".txt", missed: true, used: true, name: "missed", originalFileName: "missed.txt" },
    ...["missing", "one", "two"].map((id) => ({
      id,
      ext: ".txt",
      missed: false,
      used: true,
      name: id,
      originalFileName: `${id}.txt`,
    })),
  ];

  it("skips missed/missing content and waits for each write before loading the next", async () => {
    const content = {} as ResultFile;
    const events: string[] = [];
    let release!: () => void;
    const writer = {
      writeAttachment: vi.fn(async (name: string, received: ResultFile) => {
        expect(received).toBe(content);
        events.push(`write:${name}`);
        if (name === "one.txt")
          await new Promise<void>((resolve) => {
            release = resolve;
          });
      }),
    };
    const writing = generateAttachmentsFiles(writer, links, async (id) => {
      events.push(`load:${id}`);
      return id === "missing" ? undefined : content;
    });
    await vi.waitFor(() => expect(events).toContain("write:one.txt"));
    expect(events).toEqual(["load:missing", "load:one", "write:one.txt"]);
    release();
    expect(await writing).toEqual(
      new Map([
        ["one", "one.txt"],
        ["two", "two.txt"],
      ]),
    );
    expect(events).toEqual(["load:missing", "load:one", "write:one.txt", "load:two", "write:two.txt"]);
  });

  it.each(["read", "write"])(
    "preserves earlier writes and propagates %s failure without loading later content",
    async (failure) => {
      const content = {} as ResultFile;
      const error = new Error("write failed");
      const written: string[] = [];
      const load = vi.fn(async (id: string) => {
        if (failure === "read" && id === "two") throw error;
        return content;
      });
      const writer = {
        writeAttachment: async (name: string) => {
          if (failure === "write" && name === "two.txt") throw error;
          written.push(name);
        },
      };
      await expect(generateAttachmentsFiles(writer, [links[2], links[3], links[2]], load)).rejects.toBe(error);
      expect(written).toEqual(["one.txt"]);
      expect(load).toHaveBeenCalledTimes(2);
    },
  );
});

it("matches legacy category fields without changing regex or flaky semantics", () => {
  const result = { status: "failed" as const, flaky: false, statusMessage: "first\nlast", statusTrace: "trace" };
  expect(categoryMatch({}, result)).toBe(true);
  expect(
    categoryMatch({ matchedStatuses: [], messageRegex: "first.last", traceRegex: "trace", flaky: false }, result),
  ).toBe(true);
  for (const category of [
    { matchedStatuses: ["passed"] as const },
    { flaky: true },
    { messageRegex: "[" },
    { messageRegex: "absent" },
  ]) {
    expect(categoryMatch(category, result)).toBe(false);
  }
  expect(categoryMatch({ messageRegex: ".*" }, { status: "failed", flaky: false })).toBe(false);
  expect(categoryMatch({ traceRegex: ".*" }, { ...result, statusTrace: "" })).toBe(false);
  expect(categoryMatch({ messageRegex: "" }, result)).toBe(true);
});
