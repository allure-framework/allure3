import { describe, expect, it } from "vitest";
import type { Statistic, TestStatus } from "../../src/index.js";
import { nullsDefault, nullsFirst, nullsLast } from "../../src/index.js";
import { alphabetically, byName, byStatistic, byStatus, ordinal } from "../../src/index.js";

const randomInt = (max: number = 1000): number => {
  return Math.floor(Math.random() * max);
};

const randomIntOrUndefined = (max: number = 1000): number | undefined => {
  const rnd = randomInt(3);
  if (rnd === 0) {
    return undefined;
  }
  if (rnd === 1) {
    return 0;
  }
  return randomInt(max);
};

describe("comparator", () => {
  describe("alphabetically", () => {
    it("should sort correctly", () => {
      const result = ["abacaba", "xzad", "iahfds"].sort(alphabetically());
      expect(result).toEqual(["abacaba", "iahfds", "xzad"]);
    });

    it("should sort case sensitive", () => {
      const result = ["A", "B", "C", "a", "b", "c"].sort(alphabetically());
      expect(result).toEqual(["a", "A", "b", "B", "c", "C"]);
    });

    it("should sort with numbers", () => {
      const result = ["A", "B3", "C", "1a", "b", "c"].sort(alphabetically());
      expect(result).toEqual(["1a", "A", "b", "B3", "c", "C"]);
    });

    it("should sort undefined last", () => {
      const result = ["A", "B3", "C", undefined, "1a"].sort(alphabetically());
      expect(result).toEqual(["1a", "A", "B3", "C", undefined]);
    });

    it("should sort null last", () => {
      const result = ["A", "B3", "C", null as any as string, "1a"].sort(alphabetically());
      expect(result).toEqual(["1a", "A", "B3", "C", null]);
    });
  });

  describe("by status", () => {
    it("should sort correctly", () => {
      const array: TestStatus[] = ["passed", "broken", "skipped", "failed", "unknown"];
      const result = array.sort(byStatus());
      const expected: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];
      expect(result).toEqual(expected);
    });

    it("should sort undefined last", () => {
      const array: (TestStatus | undefined)[] = ["passed", "broken", undefined, "skipped", "failed", "unknown"];
      const result = array.sort(byStatus());
      const expected: (TestStatus | undefined)[] = ["failed", "broken", "passed", "skipped", "unknown", undefined];
      expect(result).toEqual(expected);
    });
  });

  describe("ordinal", () => {
    it("should sort correctly", () => {
      const result = [123, 43, 155, 24].sort(ordinal());
      expect(result).toEqual([24, 43, 123, 155]);
    });

    it("should sort undefined last", () => {
      const result = [123, 43, 155, undefined as unknown as number, 24].sort(ordinal());
      expect(result).toEqual([24, 43, 123, 155, undefined]);
    });
  });

  describe("nullsLast", () => {
    it("should sort undefined last", () => {
      const result = [123, 43, 155, null as unknown as number, 24].sort(nullsLast<number>((a, b) => a - b));
      expect(result).toEqual([24, 43, 123, 155, null]);
    });
  });

  describe("nullsFirst", () => {
    it("should sort undefined first", () => {
      const result = [123, 43, 155, null as unknown as number, 24].sort(nullsFirst<number>((a, b) => a - b));
      expect(result).toEqual([null, 24, 43, 123, 155]);
    });
  });

  describe("nullsDefault", () => {
    it("should sort undefined with specified default value correctly", () => {
      const result = [123, 43, 155, null as unknown as number, 24].sort(nullsDefault<number>((a, b) => a - b, 50));
      expect(result).toEqual([24, 43, null, 123, 155]);
    });
  });

  describe("by name", () => {
    it("should sort correctly", () => {
      const e1 = { name: "hello" };
      const e2 = { name: "123 asd" };
      const e3 = { name: "abacaba" };

      const result = [e1, e2, e3].sort(byName());
      expect(result).toEqual([e2, e3, e1]);
    });

    it("should sort undefined last", () => {
      const e1 = { name: "hello" };
      const e2 = { name: "123 asd" };
      const e3 = { name: "abacaba" };

      const result = [e1, e2, undefined as any as { name: string }, e3].sort(byName());
      expect(result).toEqual([e2, e3, e1, undefined]);
    });
  });

  describe("by statistic", () => {
    it("should sort by failed", () => {
      const statistic1: Statistic = {
        failed: 12,
        broken: randomIntOrUndefined(),
        passed: randomIntOrUndefined(),
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed: 123,
        broken: randomIntOrUndefined(),
        passed: randomIntOrUndefined(),
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const result = [statistic1, statistic1, statistic2].sort(byStatistic());
      expect(result).toEqual([statistic2, statistic1, statistic1]);
    });
    it("should sort by broken", () => {
      const failed = randomIntOrUndefined();
      const statistic1: Statistic = {
        failed,
        broken: 32,
        passed: randomIntOrUndefined(),
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed,
        broken: 12,
        passed: randomIntOrUndefined(),
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic3: Statistic = {
        failed,
        broken: 234,
        passed: randomIntOrUndefined(),
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const result = [statistic1, statistic1, statistic2, statistic3].sort(byStatistic());
      expect(result).toEqual([statistic3, statistic1, statistic1, statistic2]);
    });
    it("should sort by passed", () => {
      const failed = randomIntOrUndefined();
      const broken = randomIntOrUndefined();
      const statistic1: Statistic = {
        failed,
        broken,
        passed: 32,
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed,
        broken,
        passed: 14,
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic3: Statistic = {
        failed,
        broken,
        passed: 234,
        skipped: randomIntOrUndefined(),
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const result = [statistic1, statistic2, statistic3, statistic1].sort(byStatistic());
      expect(result).toEqual([statistic3, statistic1, statistic1, statistic2]);
    });
    it("should sort by skipped", () => {
      const failed = randomIntOrUndefined();
      const broken = randomIntOrUndefined();
      const passed = randomIntOrUndefined();
      const statistic1: Statistic = {
        failed,
        broken,
        passed,
        skipped: 123,
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed,
        broken,
        passed,
        skipped: 7,
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const statistic3: Statistic = {
        failed,
        broken,
        passed,
        skipped: 4325,
        unknown: randomIntOrUndefined(),
        total: randomInt(),
      };
      const result = [statistic1, statistic2, statistic1, statistic3].sort(byStatistic());
      expect(result).toEqual([statistic3, statistic1, statistic1, statistic2]);
    });
    it("should sort by unknown", () => {
      const failed = randomIntOrUndefined();
      const broken = randomIntOrUndefined();
      const passed = randomIntOrUndefined();
      const skipped = randomIntOrUndefined();
      const statistic1: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 234,
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 34,
        total: randomInt(),
      };
      const statistic3: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 834,
        total: randomInt(),
      };
      const result = [statistic1, statistic2, statistic3, statistic1].sort(byStatistic());
      expect(result).toEqual([statistic3, statistic1, statistic1, statistic2]);
    });
    it("should sort undefined last", () => {
      const failed = randomIntOrUndefined();
      const broken = randomIntOrUndefined();
      const passed = randomIntOrUndefined();
      const skipped = randomIntOrUndefined();
      const statistic1: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 234,
        total: randomInt(),
      };
      const statistic2: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 34,
        total: randomInt(),
      };
      const statistic3: Statistic = {
        failed,
        broken,
        passed,
        skipped,
        unknown: 834,
        total: randomInt(),
      };
      const result = [statistic1, undefined as any as Statistic, statistic3, statistic2].sort(byStatistic());
      expect(result).toEqual([statistic3, statistic1, statistic2, undefined]);
    });

    it("should compare undefined with zero", () => {
      const statistic1: Statistic = {
        failed: 0,
        passed: 3,
        total: randomInt(),
      };
      const statistic2: Statistic = {
        broken: 12,
        total: randomInt(),
      };
      const result = [statistic1, statistic1, statistic2].sort(byStatistic());
      expect(result).toEqual([statistic2, statistic1, statistic1]);
    });
  });
});
