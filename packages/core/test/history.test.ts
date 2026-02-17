import { constants } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path/posix";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AllureLocalHistory, writeHistory } from "../src/history.js";
import { getDataPath } from "./utils.js";

describe("legacy", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "allure3-core-tests-"));
  });

  afterEach(async () => {
    if (tmp) {
      await rm(tmp, { recursive: true });
    }
  });

  it("should read empty file", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
    });

    await writeFile(historyPath, "", { encoding: "utf8" });

    const result = await history.readHistory();

    expect(result).toEqual([]);
  });

  it("should process file that doesn't exists", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
    });
    const result = await history.readHistory();

    expect(result).toEqual([]);
  });

  it("should create history file", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
    });
    const data = {
      uuid: randomUUID(),
      timestamp: new Date().getTime(),
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: [],
      metrics: {},
      url: "",
    };

    await writeHistory(historyPath, data);

    const stats = await stat(historyPath);

    expect(stats.isFile()).toBeTruthy();

    const result = await history.readHistory();

    expect(result).toEqual([expect.objectContaining(data)]);
  });

  it("should append data to existing history file", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
    });

    await writeFile(historyPath, "", { encoding: "utf8" });

    const data = {
      uuid: randomUUID(),
      timestamp: new Date().getTime(),
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: [],
      metrics: {},
      url: "",
    };
    await writeHistory(historyPath, data);

    const stats = await stat(historyPath);

    expect(stats.isFile()).toBeTruthy();

    const result = await history.readHistory();

    expect(result).toEqual([expect.objectContaining(data)]);
  });

  it("should read multiple data points from history file", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
    });

    await writeFile(historyPath, "", { encoding: "utf8" });

    const data1 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime() - 1000,
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a"],
      metrics: {},
      url: "",
    };
    const data2 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime() - 500,
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a", "b"],
      metrics: {},
      url: "",
    };
    const data3 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime(),
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a", "c"],
      metrics: {},
      url: "",
    };

    await writeHistory(historyPath, data1);
    await writeHistory(historyPath, data2);
    await writeHistory(historyPath, data3);

    const stats = await stat(historyPath);

    expect(stats.isFile()).toBeTruthy();

    const result = await history.readHistory();

    expect(result).toEqual([
      expect.objectContaining(data1),
      expect.objectContaining(data2),
      expect.objectContaining(data3),
    ]);
  });

  it("should limit data points from history file when limit is specified", async () => {
    const fileName = `${randomUUID()}.json`;
    const historyPath = join(tmp, fileName);
    const history = new AllureLocalHistory({
      historyPath,
      limit: 1,
    });

    await writeFile(historyPath, "", { encoding: "utf8" });

    const data1 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime() - 1000,
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a"],
      metrics: {},
      url: "",
    };
    const data2 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime() - 500,
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a", "b"],
      metrics: {},
      url: "",
    };
    const data3 = {
      uuid: randomUUID(),
      timestamp: new Date().getTime(),
      name: "Allure Report",
      testResults: {},
      knownTestCaseIds: ["a", "c"],
      metrics: {},
      url: "",
    };

    await writeHistory(historyPath, data1);
    await writeHistory(historyPath, data2);
    await writeHistory(historyPath, data3);

    const stats = await stat(historyPath);

    expect(stats.isFile()).toBeTruthy();

    const result = await history.readHistory();

    expect(result).toEqual([expect.objectContaining(data3)]);
  });
});

describe("AllureLocalHistory", () => {
  describe("readHistory", () => {
    it("should return empty array if file does not exist", async () => {
      const historyPath = getDataPath("non-existing.jsonl");
      const history = new AllureLocalHistory({ historyPath });

      expect(await history.readHistory()).toEqual([]);
    });

    it("should return empty array if file is empty", async () => {
      const historyPath = getDataPath("empty.jsonl");
      const history = new AllureLocalHistory({ historyPath });

      expect(await history.readHistory()).toEqual([]);
    });

    describe("a single-entry file", () => {
      const historyPath = getDataPath("one-entry.jsonl");

      it("should return all entries if no limit specified", async () => {
        const history = new AllureLocalHistory({ historyPath });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 1",
          }),
        ]);
      });

      it("should throw if limit is negative", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: -1 });

        await expect(history.readHistory()).rejects.toThrowError(
          "Invalid history limit -1. A history limit must be a positive integer number",
        );
      });

      it("should return all entries if limit equals 1", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 1 });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 1",
          }),
        ]);
      });

      it("should return all entries if limit is greater than 1", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 2 });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 1",
          }),
        ]);
      });

      it("should return empty array if limit is zero", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 0 });

        expect(await history.readHistory()).toEqual([]);
      });
    });

    describe("a two-entry file", () => {
      const historyPath = getDataPath("two-entries.jsonl");

      it("should return all entries if no limit specified", async () => {
        const history = new AllureLocalHistory({ historyPath });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 1",
          }),
          expect.objectContaining({
            name: "Entry 2",
          }),
        ]);
      });

      it("should return the second entry if limit is 1", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 1 });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 2",
          }),
        ]);
      });

      it("should return an empty array if limit is zero", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 0 });

        expect(await history.readHistory()).toEqual([]);
      });
    });

    describe("a three-entry file", () => {
      const historyPath = getDataPath("three-entries.jsonl");

      it("should return all entries if no limit specified", async () => {
        const history = new AllureLocalHistory({ historyPath });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 1",
          }),
          expect.objectContaining({
            name: "Entry 2",
          }),
          expect.objectContaining({
            name: "Entry 3",
          }),
        ]);
      });

      it("should return the latest two entries if limit is 2", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 2 });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 2",
          }),
          expect.objectContaining({
            name: "Entry 3",
          }),
        ]);
      });

      it("should return the last entry if limit is 1", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 1 });

        expect(await history.readHistory()).toEqual([
          expect.objectContaining({
            name: "Entry 3",
          }),
        ]);
      });

      it("should return an empty array if limit is zero", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 0 });

        expect(await history.readHistory()).toEqual([]);
      });
    });

    describe("performance guarantees", () => {
      it("should not read entries that are trimmed by the limit", async () => {
        const historyPath = getDataPath("invalid-first-entry.jsonl");
        const history = new AllureLocalHistory({ historyPath, limit: 1 });

        await expect(history.readHistory()).resolves.toEqual([
          expect.objectContaining({
            name: "A valid entry",
          }),
        ]);
      });

      // If the node.js devs weaken the MAX_STRING_LENGTH limitation, the test file might get way too big.
      // The current limitation (in v24.13.1) is slightly less than 2^29.
      describe.skipIf(constants.MAX_STRING_LENGTH > Math.pow(2, 29))("large file", () => {
        let historyPath: string;
        const entries: any[] = [];

        beforeAll(async () => {
          // Prepare a file that, if read as a single string, guarantees to throw RangeError
          const oneEntryHistoryPath = getDataPath("one-entry.jsonl");
          const line = await readFile(oneEntryHistoryPath, { encoding: "utf-8" });
          const entry = JSON.parse(line.split("\n")[0]);
          const entryLength = line.length - 1;
          const entriesToPrepare = Math.floor(constants.MAX_STRING_LENGTH / entryLength) + 1;
          historyPath = join(tmpdir(), randomUUID());
          const historyFile = await open(historyPath, "wx");
          try {
            for (let i = 1; i <= entriesToPrepare; i++) {
              entries.push({ ...entry });
              const json = JSON.stringify(entry);
              await historyFile.writeFile(`${json}\n`, { encoding: "utf-8" });
            }
          } finally {
            await historyFile.close();
          }
        }, 100_000);

        afterAll(async () => {
          await rm(historyPath);
        });

        it("should not hit MAX_STRING_LENGTH", { timeout: 100_000 }, async () => {
          const history = new AllureLocalHistory({ historyPath });

          // The file should be read line-by-line. Hence, no RangeError should be thrown.
          expect(await history.readHistory()).toEqual(entries.map((e) => expect.objectContaining({ name: e.name })));
        });

        it("should get the last entry only if limit is 1", { timeout: 100_000 }, async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 1 });

          expect(await history.readHistory()).toEqual([
            expect.objectContaining({
              name: entries.at(-1).name,
            }),
          ]);
        });
      });
    });
  });
});
