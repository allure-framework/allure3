import { describe, expect, it } from "vitest";
import { cucumberjson } from "../src/index.js";
import { readResults } from "./utils.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("cucumberjson reader", () => {
  // As implemented in https://github.com/cucumber/cucumber-ruby or https://github.com/cucumber/json-formatter (which
  // uses cucumber-ruby as a reference for its tests).
  describe("reference", () => {
    describe("names", () => {
      it("should parse names", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/wellDefined.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          name: "Passed test",
          fullName: "features/foo.feature#Passed test",
          labels: [{ name: "feature", value: "Foo" }],
        });
      });

      it("should handle missing scenario name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          name: "The scenario's name is not defined",
          fullName: "features/foo.feature#foo;passed-test",
        });
      });
      
      it("should handle an ill-formed scenario name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameInvalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          name: "The scenario's name is not defined",
          fullName: "features/foo.feature#foo;passed-test",
        });
      });

      it("should generate random fullName if scenario name and id are missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameIdMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          name: "The scenario's name is not defined",
          fullName: expect.stringMatching(UUID_PATTERN),
        });
      });

      it("should generate random fullName if scenario name and id are ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameIdInvalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          name: "The scenario's name is not defined",
          fullName: expect.stringMatching(UUID_PATTERN),
        });
      });

      it("should not add a feature label if the feature's name is missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureNameMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          labels: [],
        });
      });

      it("should not add a feature label if the feature's name is ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureNameInvalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          labels: [],
        });
      });

      it("should not add a feature label if the feature's name is empty", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureNameEmpty.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          labels: [],
        });
      });

      it("should use feature name if the uri is missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Foo#Passed test",
        });
      });

      it("should use feature name if the uri is ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriInvalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Foo#Passed test",
        });
      });

      it("should handle missing feature uri and scenario name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriScenarioNameMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Foo#foo;passed-test",
        });
      });

      it("should use feature id if uri and name are missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "foo#Passed test",
        });
      });

      it("should handle missing feature uri and name, and scenario name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameScenarioNameMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "foo#foo;passed-test",
        });
      });

      it("should set fullName to scenario id if feature uri, name, and id are missing", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameIdMissing.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "foo;passed-test",
        });
      });

      it("should set fullName to scenario id if feature uri and name are missing and id is ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameMissingIdInvalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "foo;passed-test",
        });
      });

      it("should set fullName to scenario name if no other id exists", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameOnly.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Passed test",
        });
      });

      it("should handle empty feature uri", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriEmpty.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Foo#Passed test",
        });
      });

      it("should handle empty feature uri and name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameEmpty.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "foo#Passed test",
        });
      });

      it("should handle empty scenario name", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/scenarioNameEmpty.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "features/foo.feature#foo;passed-test",
        });
      });

      it("should handle empty feature uri, name, and id and empty scenario id", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/names/featureUriNameIdScenarioIdEmpty.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          fullName: "Passed test",
        });
      });
    });

    describe("step statuses", async () => {
      it("should parse a passed step", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/stepStatuses/passed.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/failed.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/unknown.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/skipped.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/pending.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/undefined.json": "cucumber.json",
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
          "cucumberjsondata/reference/stepStatuses/ambiguous.json": "cucumber.json",
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

      it("should treat a step with a missing result as unknown", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/stepStatuses/missingResult.json": "cucumber.json",
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

      it("should treat a step with a missing status as unknown", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/stepStatuses/missingStatus.json": "cucumber.json",
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

      it("should treat an invalid step status as unknown", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/stepStatuses/invalidStatus.json": "cucumber.json",
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
          "cucumberjsondata/reference/scenarioStatuses/noSteps.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "Step results are missing",
        });
      });

      it("should parse a failed scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/failed.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "failed",
          message: "The step 'Then fail' failed",
        });
      });

      it("should parse an undefined scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/undefined.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "broken",
          message: "The step 'Then undefined' didn't match any definition",
        });
      });

      it("should parse an ambiguous scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/ambiguous.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "broken",
          message: "The step 'Then ambiguous' matched more than one definition",
        });
      });

      it("should parse an unknown scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/unknown.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "The result of the step 'Then unknown' is unknown",
        });
      });

      it("should parse a pending scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/pending.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "skipped",
          message: "The step 'Then pend' signalled pending during execution",
        });
      });

      it("should parse a skipped scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/skipped.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "skipped",
          message: "One or more steps of the scenario were skipped",
        });
      });

      it("should parse a passed scenario with multiple steps", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/passed.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test.message).toBeUndefined();
        expect(test).toMatchObject({
          status: "passed",
        });
      });

      it("should parse a scenario with a step that has no result", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/noStepResult.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "The result of the step 'Then unknown' is unknown",
        });
      });

      it("should parse a scenario with a step that has no status", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/noStepStatus.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "The result of the step 'Then unknown' is unknown",
        });
      });

      it("should parse a scenario with a step that has an invalid status", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/scenarioStatuses/invalidStepStatus.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          status: "unknown",
          message: "The result of the step 'Then unknown' is unknown",
        });
      });
    });

    describe("traces", () => {
      it("should set trace from error_message", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/traces/failed.json": "cucumber.json",
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
          "cucumberjsondata/reference/traces/passed.json": "cucumber.json",
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
    describe("durations", () => {
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

    describe("descriptions", () => {
      it("should parse a scenario's description", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/descriptions/valid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test.description).toEqual("Lorem Ipsum");
      });

      it("should ignore an invalid description of a scenario", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/descriptions/invalid.json": "cucumber.json",
        });
        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test.description).toBeUndefined();
      });
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

      describe("data tables", () => {
        it("should parse a step's data table", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/wellDefined.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const test = visitor.visitTestResult.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"\r\n"val1","val2"');
          expect(test).toMatchObject({
            steps: [
              {
                steps: [
                  {
                    type: "attachment",
                    name: "Data",
                    contentType: "text/csv",
                    originalFileName: attachment.getOriginalFileName(),
                  },
                ],
              },
            ],
          });
        });

        it("should escape quotes", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/quotes.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"\r\n"va""l1","""val2"""');
        });

        it("should ignore the ill-formed rows property", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/rowsInvalid.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).not.toHaveBeenCalled();
          const test = visitor.visitTestResult.mock.calls[0][0];
          expect(test).toMatchObject({
            steps: [
              {
                steps: [],
              },
            ],
          });
        });

        it("should ignore an ill-formed row", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/rowInvalid.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"');
        });

        it("should ignore a row with no cells property", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/cellsMissing.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"');
        });

        it("should ignore a row with the ill-formed cells property", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/cellsInvalid.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"');
        });

        it("should treat an ill-formed cell as an empty string", async () => {
          const visitor = await readResults(cucumberjson, {
            "cucumberjsondata/reference/dataTables/cellInvalid.json": "cucumber.json",
          });

          expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
          expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
          const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
          const content = await attachment.asUtf8String();
          expect(content).toEqual('"col1","col2"\r\n"val1",""');
        });
      });
    });

    describe("embeddings", () => {
      it("should parse an embedding", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/wellDefined.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const test = visitor.visitTestResult.mock.calls[0][0];
        const content = await attachment.asUtf8String();
        expect(content).toEqual('Hello!');
        expect(test).toMatchObject({
          steps: [
            {
              steps: [
                {
                  type: "attachment",
                  name: "Embedding",
                  contentType: "text/plain",
                  originalFileName: attachment.getOriginalFileName(),
                },
              ],
            },
          ],
        });
      });

      it("should ignore the ill-formed embeddings property", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/embeddingsInvalid.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).not.toHaveBeenCalled();
      });

      it("should ignore an ill-formed embeddings element", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/embeddingsElementInvalid.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).not.toHaveBeenCalled();
      });

      it("should use application/octet-stream if no mime_type specified", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/mediaTypeMissing.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          steps: [
            {
              steps: [
                {
                  contentType: "application/octet-stream",
                },
              ],
            },
          ],
        });
      });

      it("should use application/octet-stream if the mime_type is ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/mediaTypeInvalid.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          steps: [
            {
              steps: [
                {
                  contentType: "application/octet-stream",
                },
              ],
            },
          ],
        });
      });

      it("should attach an empty file if no data is specified", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/dataMissing.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const content = await attachment.asBuffer();
        expect(content).toHaveLength(0);
      });

      it("should attach an empty file if the data is ill-formed", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/dataInvalid.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const content = await attachment.asBuffer();
        expect(content).toHaveLength(0);
      });

      it("should attach an empty file if the data is an ill-formed base64 string", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/dataInvalidBase64.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const content = await attachment.asBuffer();
        expect(content).toHaveLength(0);
      });

      it("should include an embedding's number if more than one", async () => {
        const visitor = await readResults(cucumberjson, {
          "cucumberjsondata/reference/embeddings/twoEmbeddings.json": "cucumber.json",
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(2);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({
          steps: [
            {
              steps: [
                { name: "Embedding 1" },
                { name: "Embedding 2" },
              ],
            },
          ],
        });
      });
    });
  });
});
