import { BufferResultFile } from "@allurereport/reader-api";
import { epic, feature, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CucumberMessage } from "../src/cucumbermessages/model.js";
import { cucumberMessages } from "../src/index.js";
import { mockVisitor, readResults } from "./utils.js";

const messages = (status = "PASSED"): CucumberMessage[] => [
  {
    pickle: {
      id: "pickle",
      uri: "features/example.feature",
      name: "A scenario",
      language: "en",
      location: { line: 5 },
      astNodeIds: ["scenario"],
      tags: [{ name: "@ordinary" }],
      steps: [{ id: "pickle-step", text: "a step", astNodeIds: ["ast-step"] }],
    },
  },
  { testCase: { id: "case", pickleId: "pickle", testSteps: [{ id: "step", pickleStepId: "pickle-step" }] } },
  { testCaseStarted: { id: "execution", testCaseId: "case", attempt: 0, timestamp: { seconds: 1, nanos: 0 } } },
  {
    testStepStarted: {
      testCaseStartedId: "execution",
      testStepId: "step",
      timestamp: { seconds: 1, nanos: 1_000_000 },
    },
  },
  {
    testStepFinished: {
      testCaseStartedId: "execution",
      testStepId: "step",
      timestamp: { seconds: 1, nanos: 10_000_000 },
      testStepResult: { status, duration: { seconds: 0, nanos: 1_250_000 } },
    },
  },
  {
    testCaseFinished: {
      testCaseStartedId: "execution",
      timestamp: { seconds: 1, nanos: 15_000_000 },
      willBeRetried: false,
    },
  },
];

const read = async (input: CucumberMessage[] | string) => {
  const visitor = mockVisitor();
  const content = typeof input === "string" ? input : input.map((message) => JSON.stringify(message)).join("\r\n");
  const accepted = await cucumberMessages.read(visitor, new BufferResultFile(Buffer.from(content), "messages.jsonl"));
  return {
    accepted,
    results: visitor.visitTestResult.mock.calls.map(([result]) => result),
    fixtures: visitor.visitTestFixtureResult.mock.calls.map(([fixture]) => fixture),
    files: visitor.visitAttachmentFile.mock.calls.map(([file]) => file),
  };
};

beforeEach(async () => {
  await epic("coverage");
  await feature("reading");
  await story("cucumber-messages");
});

describe("Cucumber messages", () => {
  it("matches .jsonl and .ndjson files", () => {
    for (const [name, expected] of [
      ["messages.jsonl", true],
      ["messages.ndjson", true],
      ["cucumber.json", false],
    ] as const) {
      expect(cucumberMessages.matches!(new BufferResultFile(Buffer.from(""), name))).toBe(expected);
    }
  });

  it("reads scenarios, parameters, fixtures, and attachments from a message file", async () => {
    const visitor = await readResults(cucumberMessages, { "cucumbermessages/sample.jsonl": "messages.jsonl" });
    const results = visitor.visitTestResult.mock.calls.map(([result]) => result);
    expect(results).toHaveLength(6);
    expect(results.map(({ status }) => status)).toEqual(["failed", "failed", "failed", "passed", "passed", "passed"]);
    expect(results[1].parameters).toEqual([{ name: "search_term", value: "pizza" }]);
    expect(results[2].parameters).toEqual([{ name: "search_term", value: "banana" }]);
    expect(results[1].fullName).not.toBe(results[2].fullName);
    expect(results[1].steps?.[1]).toMatchObject({ name: 'When I enter "pizza"', status: "failed" });
    expect(visitor.visitTestFixtureResult.mock.calls).toHaveLength(18);
    expect(visitor.visitTestFixtureResult.mock.calls.filter(([fixture]) => fixture.type === "before")).toHaveLength(12);
    expect(visitor.visitAttachmentFile.mock.calls).toHaveLength(5);
  });

  it.each([
    ["PASSED", "passed"],
    ["FAILED", "failed"],
    ["SKIPPED", "skipped"],
    ["PENDING", "skipped"],
    ["UNDEFINED", "broken"],
    ["AMBIGUOUS", "broken"],
    ["UNKNOWN", "unknown"],
    ["FUTURE", "unknown"],
  ])("maps the %s status to %s", async (input, expected) => {
    const { results } = await read(messages(input));
    expect(results[0].status).toBe(expected);
    expect(results[0].steps?.[0]).toMatchObject({ status: expected });
  });

  it("preserves source identity and measured timing", async () => {
    const { results } = await read(messages());
    expect(results[0]).toMatchObject({
      name: "A scenario",
      fullName: "features/example.feature:5#A scenario",
      start: 1000,
      stop: 1015,
      labels: [{ name: "tag", value: "@ordinary" }],
    });
    expect(results[0].steps?.[0]).toMatchObject({ name: "a step", start: 1001, duration: 1.25 });
  });

  it("maps exception messages and stack traces to error details", async () => {
    const input = messages("FAILED");
    input[4].testStepFinished!.testStepResult.exception = {
      type: "Error",
      message: "Cannot open file",
      stackTrace: "Error: Cannot open file\n  at source:12",
    };
    const { results } = await read(input);
    expect(results[0]).toMatchObject({
      status: "failed",
      message: "Cannot open file",
      trace: "Error: Cannot open file\n  at source:12",
    });
  });

  it("maps step-result messages to error details", async () => {
    const input = messages("FAILED");
    input[4].testStepFinished!.testStepResult.message = "Operation failed\n  at feature:12";
    const { results } = await read(input);
    expect(results[0]).toMatchObject({
      message: "Operation failed\n  at feature:12",
      trace: "Operation failed\n  at feature:12",
    });
  });

  it("maps Cucumber tags to Allure tag labels", async () => {
    const input = messages();
    input[0].pickle!.tags = [{ name: "@smoke" }, { name: "@search" }];
    const { results } = await read(input);
    expect(results[0].labels).toEqual([
      { name: "tag", value: "@smoke" },
      { name: "tag", value: "@search" },
    ]);
  });

  it("correlates interleaved executions by ID and emits every attempt", async () => {
    const input = messages("FAILED");
    const retry = messages()
      .slice(2)
      .map((message) => JSON.parse(JSON.stringify(message).replaceAll("execution", "retry")) as CucumberMessage);
    retry[0].testCaseStarted!.attempt = 1;
    const interleaved = [input[0], input[1], ...input.slice(2).flatMap((message, index) => [message, retry[index]])];
    const { results } = await read(interleaved.reverse());
    expect(results).toHaveLength(2);
    expect(results.map(({ status }) => status).sort()).toEqual(["failed", "passed"]);
    expect(results[0].fullName).toBe(results[1].fullName);
    expect(results[0].uuid).not.toBe(results[1].uuid);
  });

  it("uses unknown for unfinished executions and missing step results", async () => {
    expect((await read(messages().slice(0, -1))).results[0].status).toBe("unknown");
    expect((await read(messages().filter((message) => !message.testStepFinished))).results[0].status).toBe("unknown");
  });

  it("maps before hooks to setup fixtures and includes their outcome", async () => {
    const input = messages("FAILED");
    input[1].testCase!.testSteps[0] = { id: "step", hookId: "hook" };
    const hook = { id: "hook", name: "Prepare", type: "BEFORE_TEST_CASE", sourceReference: {} };
    input.push({ hook });
    const { results, fixtures } = await read(input);
    expect(results[0].status).toBe("failed");
    expect(results[0].steps).toEqual([]);
    expect(fixtures).toEqual([
      expect.objectContaining({
        type: "before",
        name: "Prepare",
        status: "failed",
        testResults: [results[0].uuid],
      }),
    ]);
  });

  it("maps hooks without a type to named steps", async () => {
    const input = messages("FAILED");
    input[1].testCase!.testSteps[0] = { id: "step", hookId: "hook" };
    const hook = { id: "hook", name: "Prepare", sourceReference: {} };
    input.push({ hook });
    const { results, fixtures } = await read(input);
    expect(fixtures).toEqual([]);
    expect(results[0].steps).toEqual([expect.objectContaining({ type: "step", name: "Prepare", status: "failed" })]);
  });

  it("reads scenario descriptions and background keywords inside a rule", async () => {
    const input = messages();
    input.unshift({
      gherkinDocument: {
        uri: "features/example.feature",
        feature: {
          name: "Example",
          children: [
            {
              rule: {
                children: [
                  { background: { steps: [{ id: "ast-step", keyword: "Given " }] } },
                  {
                    scenario: {
                      id: "scenario",
                      name: "A scenario",
                      description: "Original description",
                      location: { line: 5 },
                      steps: [],
                      examples: [],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
    const { results } = await read(input);
    expect(results[0].description).toBe("Original description");
    expect(results[0].labels).toContainEqual({ name: "feature", value: "Example" });
    expect(results[0].steps?.[0].name).toBe("Given a step");
  });

  it("decodes base64 image attachments on steps", async () => {
    const input = messages();
    input.push({
      attachment: {
        testCaseStartedId: "execution",
        testStepId: "step",
        body: "AP8=",
        contentEncoding: "BASE64",
        mediaType: "image/png",
        fileName: "../../image.png",
      },
    });
    const { results, files } = await read(input);
    expect(files).toHaveLength(1);
    expect(results[0].steps).toEqual([
      expect.objectContaining({
        type: "step",
        steps: [
          {
            type: "attachment",
            name: "../../image.png",
            contentType: "image/png",
            originalFileName: files[0].getOriginalFileName(),
          },
        ],
      }),
    ]);
    expect(files[0].getOriginalFileName()).not.toContain("/");
    expect(await files[0].asBuffer()).toEqual(Buffer.from([0, 255]));
  });

  it("reads identity-encoded text attachments on scenarios", async () => {
    const input = messages();
    input.push({
      attachment: {
        testCaseStartedId: "execution",
        body: "plain log",
        contentEncoding: "IDENTITY",
        mediaType: "text/plain",
        fileName: "log.txt",
      },
    });
    const { results, files } = await read(input);
    expect(files).toHaveLength(1);
    expect(results[0].steps).toEqual([
      expect.objectContaining({ type: "step", steps: [] }),
      {
        type: "attachment",
        name: "log.txt",
        contentType: "text/plain",
        originalFileName: files[0].getOriginalFileName(),
      },
    ]);
    expect(await files[0].asUtf8String()).toBe("plain log");
  });

  it("attaches doc strings with their declared media type", async () => {
    const input = messages();
    input[0].pickle!.steps[0].argument = {
      docString: { content: '{"ready":true}', mediaType: "application/json" },
    };
    const { results, files } = await read(input);
    expect(files).toHaveLength(1);
    expect(results[0].steps).toEqual([
      expect.objectContaining({
        type: "step",
        steps: [
          {
            type: "attachment",
            name: "Description",
            contentType: "application/json",
            originalFileName: files[0].getOriginalFileName(),
          },
        ],
      }),
    ]);
    expect(await files[0].asUtf8String()).toBe('{"ready":true}');
  });

  it("serializes data tables as CSV attachments", async () => {
    const input = messages();
    input[0].pickle!.steps[0].argument = {
      dataTable: {
        rows: [
          { cells: [{ value: "key" }, { value: "value" }] },
          { cells: [{ value: 'a,"b"' }, { value: "line\nbreak" }] },
        ],
      },
    };
    const { results, files } = await read(input);
    expect(files).toHaveLength(1);
    expect(results[0].steps).toEqual([
      expect.objectContaining({
        type: "step",
        steps: [
          {
            type: "attachment",
            name: "Data",
            contentType: "text/csv",
            originalFileName: files[0].getOriginalFileName(),
          },
        ],
      }),
    ]);
    expect(await files[0].asUtf8String()).toBe('"key","value"\n"a,""b""","line\nbreak"');
  });

  it("reads executions from streams containing unsupported envelopes", async () => {
    const input = [
      JSON.stringify({ futureMessage: {} }),
      ...messages().map((message) => JSON.stringify(message)),
      "",
      "",
    ].join("\n");
    const result = await read(input);
    expect(result.accepted).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ name: "A scenario", status: "passed" });
  });

  it("rejects malformed JSON without emitting results", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await read(
        `${messages()
          .map((message) => JSON.stringify(message))
          .join("\n")}\n{invalid`,
      );
      expect(result.accepted).toBe(false);
      expect(result.results).toEqual([]);
      const missingPickle = await read(messages().filter((message) => !message.pickle));
      expect(missingPickle.accepted).toBe(false);
      expect(missingPickle.results).toEqual([]);
    } finally {
      error.mockRestore();
    }
    expect((await read("\n\n")).accepted).toBe(false);
    expect((await read('{"unrelated":true}')).accepted).toBe(false);
  });
});
