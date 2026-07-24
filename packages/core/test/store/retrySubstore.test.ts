import type { TestResult } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import { RetrySubstore } from "../../src/store/retrySubstore.js";

const sourceMetadata = { readerId: "retrySubstore.test.ts", metadata: {} };

const makeTr = (id: string, retryHash = "same-retry"): TestResult => ({
  id,
  name: id,
  status: "passed",
  flaky: false,
  muted: false,
  known: false,
  quarantine: false,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata,
  titlePath: [],
  retryHash,
});

const upsertInOrder = (rs: RetrySubstore, ...attempts: TestResult[]) => {
  for (const attempt of attempts) {
    rs.recordIngestOrder(attempt.id);
    rs.upsert(attempt);
  }
};

const latest = (...attempts: TestResult[]) => {
  const found = attempts.find((attempt) => !attempt.isRetry);

  expect(found).toBeDefined();

  return found!;
};

describe("RetrySubstore", () => {
  describe("compare by start (both have number start and values differ)", () => {
    it("picks the max start as latest among three attempts", () => {
      const rs = new RetrySubstore();
      const low = { ...makeTr("low"), start: 500 };
      const mid = { ...makeTr("mid"), start: 1000 };
      const high = { ...makeTr("high"), start: 3000 };

      upsertInOrder(rs, low, mid, high);

      expect(latest(low, mid, high).id).toBe("high");
    });

    it("picks the later start as latest for a pair", () => {
      const rs = new RetrySubstore();
      const earlier = { ...makeTr("earlier"), start: 100 };
      const later = { ...makeTr("later"), start: 200 };

      upsertInOrder(rs, earlier, later);

      expect(latest(earlier, later).id).toBe("later");
      expect(earlier.isRetry).toBe(true);
    });
  });

  describe("compare by ingest (no start comparison branch)", () => {
    it("uses ingest order when both attempts lack start", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      upsertInOrder(rs, first, second);

      expect(latest(first, second).id).toBe("second");
    });

    it("uses ingest order for three attempts without start", () => {
      const rs = new RetrySubstore();
      const a = makeTr("a");
      const b = makeTr("b");
      const c = makeTr("c");

      upsertInOrder(rs, a, b, c);

      expect(latest(a, b, c).id).toBe("c");
      expect(a.isRetry).toBe(true);
      expect(b.isRetry).toBe(true);
    });

    it("uses ingest order when both attempts share the same start", () => {
      const rs = new RetrySubstore();
      const first = { ...makeTr("first"), start: 1000 };
      const second = { ...makeTr("second"), start: 1000 };

      upsertInOrder(rs, first, second);

      expect(latest(first, second).id).toBe("second");
    });

    it("uses ingest order when three attempts share the same start", () => {
      const rs = new RetrySubstore();
      const a = { ...makeTr("a"), start: 42 };
      const b = { ...makeTr("b"), start: 42 };
      const c = { ...makeTr("c"), start: 42 };

      upsertInOrder(rs, a, b, c);

      expect(latest(a, b, c).id).toBe("c");
    });

    it("ignores stop and uses ingest when start is missing", () => {
      const rs = new RetrySubstore();
      const withLaterStop = { ...makeTr("later-stop"), start: undefined, stop: 200 };
      const withEarlierStop = { ...makeTr("earlier-stop"), start: undefined, stop: 100 };

      upsertInOrder(rs, withLaterStop, withEarlierStop);

      expect(latest(withEarlierStop, withLaterStop).id).toBe("earlier-stop");
    });

    it("keeps insertion order when ingest index is unknown for both attempts", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      rs.upsert(first);
      rs.upsert(second);

      expect(latest(first, second).id).toBe("first");
    });
  });

  describe("started vs no-start", () => {
    it("treats null start like missing and prefers it over a started attempt", () => {
      const rs = new RetrySubstore();
      const withNull = { ...makeTr("null"), start: null as unknown as number } as TestResult;
      const withStart = { ...makeTr("ok"), start: 1 };

      upsertInOrder(rs, withNull, withStart);

      expect(latest(withNull, withStart).id).toBe("null");
    });

    it("prefers no-start over with-start regardless of ingest order", () => {
      const rs = new RetrySubstore();
      const noStart = makeTr("no-start");
      const withStart = { ...makeTr("with-start"), start: 1 };

      upsertInOrder(rs, noStart, withStart);
      expect(latest(noStart, withStart).id).toBe("no-start");

      const rsReversed = new RetrySubstore();
      const noStartLater = makeTr("no-start-later");
      const withStartEarlier = { ...makeTr("with-start-earlier"), start: 1 };

      upsertInOrder(rsReversed, withStartEarlier, noStartLater);
      expect(latest(withStartEarlier, noStartLater).id).toBe("no-start-later");
    });

    it("orders started attempts by start when mixed with no-start among three attempts", () => {
      const rs = new RetrySubstore();
      const earlyStart = { ...makeTr("early-start"), start: 100 };
      const noStart = makeTr("no-start");
      const lateStart = { ...makeTr("late-start"), start: 300 };

      upsertInOrder(rs, earlyStart, noStart, lateStart);

      expect(latest(earlyStart, noStart, lateStart).id).toBe("no-start");
      expect(rs.retriesByTr(noStart).map(({ id }) => id)).toEqual(["late-start", "early-start"]);
    });

    it("keeps started-vs-no-start ordering transitive for A=1, B=undefined, C=0", () => {
      const rs = new RetrySubstore();
      const a = { ...makeTr("a"), start: 1 };
      const b = makeTr("b");
      const c = { ...makeTr("c"), start: 0 };

      upsertInOrder(rs, a, b, c);

      expect(latest(a, b, c).id).toBe("b");
      expect(rs.retriesByTr(b).map(({ id }) => id)).toEqual(["a", "c"]);
    });
  });

  describe("retriesByTr", () => {
    it("returns retries latest-first after sorting by start", () => {
      const rs = new RetrySubstore();
      const latestAttempt = { ...makeTr("latest"), start: 3000 };
      const midRetry = { ...makeTr("mid"), start: 2000 };
      const oldRetry = { ...makeTr("old"), start: 1000 };

      upsertInOrder(rs, latestAttempt, oldRetry, midRetry);

      expect(rs.retriesByTr(latestAttempt).map(({ id }) => id)).toEqual(["mid", "old"]);
    });

    it("returns retries latest-first by ingest when start is equal", () => {
      const rs = new RetrySubstore();
      const latestAttempt = { ...makeTr("latest"), start: 1 };
      const midRetry = { ...makeTr("mid"), start: 1 };
      const oldRetry = { ...makeTr("old"), start: 1 };

      upsertInOrder(rs, oldRetry, midRetry, latestAttempt);

      expect(rs.retriesByTr(latestAttempt).map(({ id }) => id)).toEqual(["mid", "old"]);
    });

    it("returns no retries for a non-latest attempt", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      upsertInOrder(rs, first, second);

      expect(rs.retriesByTr(first)).toEqual([]);
    });

    it("returns no retries without retryHash", () => {
      const rs = new RetrySubstore();
      const tr = { ...makeTr("solo"), retryHash: undefined };

      rs.recordIngestOrder(tr.id);
      rs.upsert(tr);

      expect(rs.retriesByTr(tr)).toEqual([]);
      expect(tr.isRetry).toBe(false);
    });
  });

  describe("upsert", () => {
    it("marks a single attempt as non-retry", () => {
      const rs = new RetrySubstore();
      const solo = makeTr("solo");

      upsertInOrder(rs, solo);

      expect(solo.isRetry).toBe(false);
    });

    it("re-sorts when the same id is upserted again with a newer start", () => {
      const rs = new RetrySubstore();
      const first = { ...makeTr("same"), start: 100 };
      const other = { ...makeTr("other"), start: 200 };

      upsertInOrder(rs, first, other);

      expect(latest(first, other).id).toBe("other");

      const updated = { ...first, start: 500 };

      rs.upsert(updated);

      expect(latest(updated, other).id).toBe("same");
      expect(other.isRetry).toBe(true);
    });

    it("does not index attempts without retryHash", () => {
      const rs = new RetrySubstore();
      const tr = { ...makeTr("solo"), retryHash: undefined };

      upsertInOrder(rs, tr);

      expect(tr.isRetry).toBe(false);
    });
  });

  describe("ingest order persistence", () => {
    it("records ingest order once per id", () => {
      const rs = new RetrySubstore();

      rs.recordIngestOrder("a");
      rs.recordIngestOrder("a");
      rs.recordIngestOrder("b");

      expect(rs.ingestOrderIdsForDump()).toEqual(["a", "b"]);
    });

    it("restores ingest order from dump ids", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      rs.restoreIngestOrder([second.id, first.id], () => true);
      upsertInOrder(rs, first, second);

      expect(rs.ingestOrderIdsForDump()).toEqual([second.id, first.id]);
      expect(latest(first, second).id).toBe("first");
    });

    it("skips unknown and duplicate ids when restoring ingest order", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      rs.restoreIngestOrder([second.id, "missing", second.id, first.id], (id) => id !== "missing");
      upsertInOrder(rs, first, second);

      expect(rs.ingestOrderIdsForDump()).toEqual([second.id, first.id]);
    });

    it("resetIngestOrder clears recorded ingest order", () => {
      const rs = new RetrySubstore();

      rs.recordIngestOrder("a");
      rs.resetIngestOrder();

      expect(rs.ingestOrderIdsForDump()).toEqual([]);
    });

    it("accumulates ingest order across multiple restoreIngestOrder calls", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");
      const third = makeTr("third");

      rs.restoreIngestOrder([first.id], () => true);
      rs.restoreIngestOrder([second.id, third.id], () => true);

      expect(rs.ingestOrderIdsForDump()).toEqual([first.id, second.id, third.id]);
    });

    it("keeps ingest order across retry substore reset", () => {
      const rs = new RetrySubstore();
      const first = makeTr("first");
      const second = makeTr("second");

      upsertInOrder(rs, first, second);
      rs.reset();
      upsertInOrder(rs, first, second);

      expect(latest(first, second).id).toBe("second");
    });
  });
});
