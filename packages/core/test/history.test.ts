import type { HistoryDataPoint } from "@allurereport/core-api";
import { constants } from "node:buffer";
import { randomUUID } from "node:crypto";
import { appendFile, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path/posix";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AllureLocalHistory } from "../src/history.js";
import { getDataPath } from "./utils.js";

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
          const entry = JSON.parse(line);
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

  describe("appendHistory", () => {
    let historyPath: string;
    let entry: HistoryDataPoint;

    const checkHistoryFile = async (expectedNames: readonly string[]) => {
      const content = await readFile(historyPath, { encoding: "utf-8" });
      const actualNames = content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line).name);
      expect(actualNames).toEqual(expectedNames);
    };

    beforeEach(async () => {
      historyPath = join(tmpdir(), randomUUID());
      const oneEntryHistoryPath = getDataPath("one-entry.jsonl");
      const line = await readFile(oneEntryHistoryPath, { encoding: "utf-8" });
      entry = JSON.parse(line);
      entry.name = "New entry";
    });

    afterEach(async () => {
      await rm(historyPath);
    });

    it("should create empty file if limit is zero", async () => {
      const history = new AllureLocalHistory({ historyPath, limit: 0 });

      await history.appendHistory(entry);

      await checkHistoryFile([]);
    });

    it("should write entry to new file if limit is not defined", async () => {
      const history = new AllureLocalHistory({ historyPath });

      await history.appendHistory(entry);

      await checkHistoryFile(["New entry"]);
    });

    it("should write entry to new file if limit is positive", async () => {
      const history = new AllureLocalHistory({ historyPath, limit: 1 });

      await history.appendHistory(entry);

      await checkHistoryFile(["New entry"]);
    });

    describe("existing file", () => {
      beforeEach(async () => {
        await writeFile(historyPath, "", { encoding: "utf-8", flag: "wx" });
      });

      it("should keep file empty if limit is zero", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 0 });

        await history.appendHistory(entry);

        await checkHistoryFile([]);
      });

      it("should append entry to existing file if limit is not defined", async () => {
        const history = new AllureLocalHistory({ historyPath });

        await history.appendHistory(entry);

        await checkHistoryFile(["New entry"]);
      });

      it("should append entry to existing file if limit is positive", async () => {
        const history = new AllureLocalHistory({ historyPath, limit: 1 });

        await history.appendHistory(entry);

        await checkHistoryFile(["New entry"]);
      });

      describe("single entry", () => {
        beforeEach(async () => {
          await appendFile(historyPath, `${JSON.stringify({ ...entry, name: "Entry 1" })}\n`, "utf-8");
        });

        it("should make file empty if limit is zero", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 0 });

          await history.appendHistory(entry);

          await checkHistoryFile([]);
        });

        it("should overwrite the entry if limit is one", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 1 });

          await history.appendHistory(entry);

          await checkHistoryFile(["New entry"]);
        });

        it("should append the entry if limit is greater than one", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 2 });

          await history.appendHistory(entry);

          await checkHistoryFile(["Entry 1", "New entry"]);
        });
      });

      describe("two entries", () => {
        beforeEach(async () => {
          await appendFile(historyPath, `${JSON.stringify({ ...entry, name: "Entry 1" })}\n`, "utf-8");
          await appendFile(historyPath, `${JSON.stringify({ ...entry, name: "Entry 2" })}\n`, "utf-8");
        });

        it("should make file empty if limit is zero", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 0 });

          await history.appendHistory(entry);

          await checkHistoryFile([]);
        });

        it("should overwrite file with single entry if limit is one", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 1 });

          await history.appendHistory(entry);

          await checkHistoryFile(["New entry"]);
        });

        it("should rotate the entries if limit is two", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 2 });

          await history.appendHistory(entry);

          await checkHistoryFile(["Entry 2", "New entry"]);
        });

        it("should append the entry if limit is greater than two", async () => {
          const history = new AllureLocalHistory({ historyPath, limit: 3 });

          await history.appendHistory(entry);

          await checkHistoryFile(["Entry 1", "Entry 2", "New entry"]);
        });
      });

      describe("performance guarantees", () => {
        it("should not parse the existing content when rotating", async () => {
          await appendFile(
            historyPath,
            "This line is not a valid JSON. If passed to JSON.parse, SyntaxError is thrown.\n",
            "utf-8",
          );
          await appendFile(
            historyPath,
            "This line is also not a valid JSON. If passed to JSON.parse, SyntaxError is thrown.\n",
            "utf-8",
          );
          const history = new AllureLocalHistory({ historyPath, limit: 2 });

          await history.appendHistory(entry);

          // Each line ends with \n, hence, an extra empty line appears when calling .split("\n")
          expect((await readFile(historyPath, "utf-8")).split("\n")).toEqual([
            "This line is also not a valid JSON. If passed to JSON.parse, SyntaxError is thrown.",
            expect.stringContaining('"name":"New entry"'),
            "",
          ]);
        });

        describe("no extra decoding", () => {
          beforeEach(async () => {
            // 0x80 and 0x81 are not valid UTF-8 sequences. If decoded, they're replaced with 0xFFFD.
            // If then encoded back, each produces a three-byte sequence [0xEF, 0xBF, 0xBD].
            // The tests checks if no binary-to-string encoding is involved, in which case the bytes must
            // remain in the file as is.
            // Note: 0x0a is '\n'
            await appendFile(historyPath, Buffer.from([0x80, 0x0a]), "utf-8");
            await appendFile(historyPath, Buffer.from([0x81, 0x0a]), "utf-8");
          });

          it("should rotate without decoding if limit is 2", async () => {
            const history = new AllureLocalHistory({ historyPath, limit: 2 });

            await history.appendHistory(entry);

            const buffer = await readFile(historyPath);
            const jsonBytes = buffer.subarray(2);
            const json = jsonBytes.toString("utf-8");
            const parsed = JSON.parse(json);
            expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x81, 0x0a]));
            expect(parsed.name).toEqual("New entry");
          });

          it("should append without decoding if limit is greater than 2", async () => {
            const history = new AllureLocalHistory({ historyPath, limit: 3 });

            await history.appendHistory(entry);

            const buffer = await readFile(historyPath);
            const jsonBytes = buffer.subarray(4);
            const json = jsonBytes.toString("utf-8");
            const parsed = JSON.parse(json);
            expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x80, 0x0a, 0x81, 0x0a]));
            expect(parsed.name).toEqual("New entry");
          });
        });
      });
    });
  });
});
