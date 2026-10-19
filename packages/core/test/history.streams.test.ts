import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

import type { HistoryDataPoint } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openedStreams: (Readable | Writable)[] = [];

// track every stream the history implementation opens on a file handle: a stream that isn't
// destroyed keeps the handle referenced and makes `FileHandle.close()` hang forever
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const trackStreams = (handle: FileHandle) => {
    const { createReadStream, createWriteStream } = handle;

    handle.createReadStream = (...args: Parameters<FileHandle["createReadStream"]>) => {
      const stream = createReadStream.apply(handle, args);

      openedStreams.push(stream);

      return stream;
    };
    handle.createWriteStream = (...args: Parameters<FileHandle["createWriteStream"]>) => {
      const stream = createWriteStream.apply(handle, args);

      openedStreams.push(stream);

      return stream;
    };

    return handle;
  };

  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => trackStreams(await actual.open(...args)),
  };
});

const { AllureLocalHistory } = await import("../src/history.js");

const dataPoint = (uuid: string): HistoryDataPoint => ({
  uuid,
  name: `Report ${uuid}`,
  timestamp: 1,
  knownTestCaseIds: [],
  testResults: {},
  metrics: {},
});

let historyPath: string;

beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("history");
  await label("coverage", "history");

  openedStreams.length = 0;
  historyPath = join(tmpdir(), randomUUID(), "history.jsonl");
});

afterEach(() => {
  openedStreams.length = 0;
});

describe("AllureLocalHistory", () => {
  describe("file handle lifecycle", () => {
    it("should close every stream it opens while writing a new history file", async () => {
      const history = new AllureLocalHistory({ historyPath });

      await history.appendHistory(dataPoint("1"));

      expect(openedStreams.length).toBeGreaterThan(0);
      expect(openedStreams.map((stream) => stream.closed)).not.toContain(false);
    });

    it("should close every stream it opens while appending to an existing history file", async () => {
      await new AllureLocalHistory({ historyPath, limit: 2 }).appendHistory(dataPoint("1"));

      openedStreams.length = 0;

      await new AllureLocalHistory({ historyPath, limit: 2 }).appendHistory(dataPoint("2"));

      expect(openedStreams.length).toBeGreaterThan(0);
      expect(openedStreams.map((stream) => stream.closed)).not.toContain(false);
    });

    it("should close every stream it opens while reading the history file", async () => {
      await new AllureLocalHistory({ historyPath }).appendHistory(dataPoint("1"));

      openedStreams.length = 0;

      const entries = await new AllureLocalHistory({ historyPath }).readHistory();

      expect(entries).toHaveLength(1);
      expect(openedStreams.length).toBeGreaterThan(0);
      expect(openedStreams.map((stream) => stream.closed)).not.toContain(false);
    });
  });
});
