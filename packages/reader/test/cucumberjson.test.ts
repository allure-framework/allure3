import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cucumberjson } from "../src/index.js";
import { readResults } from "./utils.js";

describe("cucumberjson reader", () => {
  // As implemented in https://github.com/cucumber/cucumber-ruby or https://github.com/cucumber/json-formatter (which
  // uses cucumber-ruby as a reference for its tests).
  describe("reference", () => {
    it("should parse a scenario", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/reference/onePassedStep.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        name: "Passed test",
        status: "passed",
        fullName: "features/foo.feature#Passed test",
        labels: [{ name: "feature", value: "Foo" }],
      });
    });

    describe("step statuses", async () => {
      it("should parse a passed step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/onePassedStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "passed",
            }),
          ],
        });
      });

      it("should parse a failed step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneFailedStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "failed",
              message: "The step failed",
            }),
          ],
        });
      });

      it("should parse an unknown step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneUnknownStep.json": "cucumber.json",
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

      it("should parse a skipped step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneSkippedStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "skipped",
              message: "The step was skipped because the previous step hadn't passed",
            }),
          ],
        });
      });

      it("should parse a pending step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/onePendingStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "skipped",
              message: "The step signalled pending during execution",
            }),
          ],
        });
      });

      it("should parse an undefined step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneUndefinedStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "broken",
              message: "The step didn't match any definition",
            }),
          ],
        });
      });

      it("should parse an ambiguous step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneAmbiguousStep.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            expect.objectContaining({
              status: "broken",
              message: "The step matched more than one definition",
            }),
          ],
        });
      });

      it("should treat a missing step status as unknown", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/oneStepWithNoResult.json": "cucumber.json",
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
          "cucumberjsondata/reference/oneScenarioWithNoSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "Step results are missing",
        });
      });

      it("should parse a failed scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/failedScenarioWithMultipleSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "failed",
          message: "The step 'Then fail' failed",
        });
      });

      it("should parse an undefined scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/undefinedScenarioWithMultipleSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "broken",
          message: "The step 'Then undefined' didn't match any definition",
        });
      });

      it("should parse an ambiguous scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/ambiguousScenarioWithMultipleSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "broken",
          message: "The step 'Then ambiguous' matched more than one definition",
        });
      });

      it("should parse an unknown scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/unknownScenarioWithMultipleSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "The result of the step 'Then unknown' is unknown",
        });
      });

      it("should parse a pending scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/pendingScenarioWithMultipleSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "skipped",
          message: "The step 'Then pend' signalled pending during execution",
        });
      });

      it("should parse a skipped scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/skippedScenarioWithMultipleSteps.json": "cucumber.json",
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
          "cucumberjsondata/reference/failedScenarioWithMessage.json": "cucumber.json",
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
          "cucumberjsondata/reference/passedScenarioWithMessage.json": "cucumber.json",
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

    // The reference implementation sets durations in ns
    describe("duration", () => {
      it("should round down a remainder less than 0.5 ms", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/durations/roundDown.json": "cucumber.json",
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
          "cucumberjsondata/reference/durations/roundUp.json": "cucumber.json",
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
          "cucumberjsondata/reference/durations/allDefined.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          duration: 25,
        });
      });

      it("should ignore steps with no duration when calculating the test's duration", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/durations/someDefined.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          duration: 25,
        });
      });

      it("should leave durations undefined if they aren't present", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/durations/noneDefined.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test.duration).toBeUndefined();
        expect(test).toMatchObject({
          steps: [
            expect.not.objectContaining({ duration: expect.anything() }),
            expect.not.objectContaining({ duration: expect.anything() }),
            expect.not.objectContaining({ duration: expect.anything() }),
          ],
        });
      });
    });

    it("should parse a scenario's description", async () => {
      const visitor = await readResults(cucumberjson, {
        "cucumberjsondata/reference/scenarioDescription.json": "cucumber.json",
      });
      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      const test = visitor.visitTestResult.mock.calls[0][0];
      expect(test.description).toEqual("Lorem Ipsum");
    });

    describe("step arguments", () => {
      describe("doc strings", () => {
        it("should parse a step's doc string", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/missingContentType.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const test = visitor.visitTestResult.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual("Lorem Ipsum");
          expect(test).toMatchObject({
            steps: [
              {
                steps: [
                  {
                    type: "attachment",
                    name: "Description",
                    contentType: "text/markdown", // it's markdown by default
                    originalFileName: attachment.getOriginalFileName(),
                  },
                ],
              },
            ],
          });
        });

        it("should ignore a step's empty doc string", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/missingValue.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
          const test = visitor.visitTestResult.mock.calls[0][0];
          expect(test).toMatchObject({
            steps: [
              {
                steps: [],
              },
            ],
          });
        });

        it("should ignore a step's empty doc string", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/emptyValue.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
          const test = visitor.visitTestResult.mock.calls[0][0];
          expect(test).toMatchObject({
            steps: [
              {
                steps: [],
              },
            ],
          });
        });

        it("should ignore a step's whitespace-only doc string", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/whitespaceOnlyValue.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
          const test = visitor.visitTestResult.mock.calls[0][0];
          expect(test).toMatchObject({
            steps: [
              {
                steps: [],
              },
            ],
          });
        });

        it("should parse a step's doc string with a empty content type", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/emptyContentType.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const test = visitor.visitTestResult.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual("Lorem Ipsum");
          expect(test).toMatchObject({
            steps: [
              {
                steps: [
                  {
                    type: "attachment",
                    name: "Description",
                    contentType: "text/markdown", // fallback to markdown
                    originalFileName: attachment.getOriginalFileName(),
                  },
                ],
              },
            ],
          });
        });

        it("should parse a step's doc string with a content type", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/docstrings/explicitContentType.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const test = visitor.visitTestResult.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"Lorem Ipsum"');
          expect(test).toMatchObject({
            steps: [
              {
                steps: [
                  {
                    type: "attachment",
                    name: "Description",
                    contentType: "application/json", // fallback to markdown
                    originalFileName: attachment.getOriginalFileName(),
                  },
                ],
              },
            ],
          });
        });
      });
    });
  });
});
