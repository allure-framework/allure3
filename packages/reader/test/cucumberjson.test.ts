import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cucumberjson } from "../src/index.js";
import { readResults } from "./utils.js";

describe("cucumberjson reader", () => {
  it("should parse the simplest scenario", async () => {
    const visitor = await readResults(cucumberjson, {
      "cucumberjsondata/simple.json": "cucumber.json",
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Passed test",
      status: "passed",
      fullName: "features/foo.feature#Passed test",
      labels: [{ name: "feature", value: "Foo" }],
      steps: [
        expect.objectContaining({
          name: "Then the step passes",
          status: "passed",
        }),
      ],
    });
  });

  describe("step statuses", async () => {
    it("should parse a failed scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/failed.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "failed",
        message: "The step 'Then fail' failed",
        steps: [
          expect.objectContaining({
            status: "failed",
            message: "The step failed",
          }),
        ],
      });
    });

    it("should parse an unknown scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/unknown.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "unknown",
        message: "The result of the step 'Then nothing' is unknown",
        steps: [
          expect.objectContaining({
            status: "unknown",
            message: "The result of the step is unknown",
          }),
        ],
      });
    });

    it("should parse a skipped scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/skipped.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "skipped",
        message: "One or more steps of the scenario were skipped",
        steps: [
          expect.objectContaining({
            status: "skipped",
            message: "The step was skipped because the previous step hadn't passed",
          }),
        ],
      });
    });

    it("should parse a pending scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/pending.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "skipped",
        message: "The step 'Then signal pending' signalled pending during execution",
        steps: [
          expect.objectContaining({
            status: "skipped",
            message: "The step signalled pending during execution",
          }),
        ],
      });
    });

    it("should parse an undefined scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/undefined.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "broken",
        message: "The step 'Then undefined' didn't match any definition",
        steps: [
          expect.objectContaining({
            status: "broken",
            message: "The step didn't match any definition",
          }),
        ],
      });
    });

    it("should parse an ambiguous scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/ambiguous.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "broken",
        message: "The step 'Then multiple' matched more than one definition",
        steps: [
          expect.objectContaining({
            status: "broken",
            message: "The step matched more than one definition",
          }),
        ],
      });
    });

    it("should treat missing status as unknown", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/missingStatus.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [
          expect.objectContaining({
            status: "unknown",
            message: "The result of the step is unknown",
          }),
        ],
      });
    });
  });

  describe("test statuses", () => {
    it("should parse a scenario with no steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/noSteps.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "unknown",
        message: "Step results are missing",
      });
    });

    it("should parse a failed scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesFailed.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "failed",
        message: "The step 'Then fail' failed",
      });
    });

    it("should parse an undefined scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesUndefined.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "broken",
        message: "The step 'Then undefined' didn't match any definition",
      });
    });

    it("should parse an ambiguous scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesAmbiguous.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "broken",
        message: "The step 'Then ambiguous' matched more than one definition",
      });
    });

    it("should parse an unknown scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesUnknown.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "unknown",
        message: "The result of the step 'Then unknown' is unknown",
      });
    });

    it("should parse a pending scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesPending.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "skipped",
        message: "The step 'Then pend' signalled pending during execution",
      });
    });

    it("should parse a skipped scenario with multiple steps", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/mixedStepStatusesSkipped.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        status: "skipped",
        message: "One or more steps of the scenario were skipped",
      });
    });
  });

  describe("trace", () => {
    it("should set trace from error_message", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/failedWithErrorMessage.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        message: "The step 'Then fail' failed",
        trace: "Lorem Ipsum",
        steps: [
          expect.objectContaining({
            message: "The step failed",
            trace: "Lorem Ipsum",
          }),
        ],
      });
    });

    it("should not set passed step trace at test level", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/passedWithErrorMessage.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      const test = visitor.visitTestResult.mock.calls[0][0];
      expect(test).toMatchObject({
        steps: [
          expect.objectContaining({
            message: "The step passed",
            trace: "Lorem Ipsum",
          }),
        ],
      });
      expect(test).not.toHaveProperty("message");
      expect(test).not.toHaveProperty("trace");
    });
  });

  describe("duration", () => {
    describe("in ns", () => {
      it("should round down a remainder less than 0.5 ms", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/durationsNsRoundDown.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          steps: [
            expect.objectContaining({
              duration: 12,
            }),
          ],
        });
      });

      it("should round up a remainder greater than or equal to 0.5 ms", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/durationsNsRoundUp.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          steps: [
            expect.objectContaining({
              duration: 13,
            }),
          ],
        });
      });

      it("should sum durations of steps at the test level", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/durationsNsMultiple.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          duration: 25,
        });
      });

      it("should ignore steps with no duration when calculating the test's duration", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/durationsNsOptional.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          duration: 25,
        });
      });

      it("should not set test duration if it's missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/durationsMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).not.toHaveProperty("duration");
        expect(test).toMatchObject({
          steps: [
            expect.not.objectContaining({ duration: expect.anything() }),
            expect.not.objectContaining({ duration: expect.anything() }),
            expect.not.objectContaining({ duration: expect.anything() }),
          ],
        });
      });
    });
  });
});
