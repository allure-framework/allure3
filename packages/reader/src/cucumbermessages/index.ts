import { randomUUID } from "node:crypto";

import {
  BufferResultFile,
  type RawFixtureResult,
  type RawTestAttachment,
  type RawTestParameter,
  type RawTestResult,
  type RawTestStatus,
  type RawTestStepResult,
  type ResultsReader,
  type ResultsVisitor,
} from "@allurereport/reader-api";

import { isNonNullObject } from "../utils.js";
import type {
  CucumberAttachment,
  CucumberGherkinChild,
  CucumberHook,
  CucumberMessage,
  CucumberPickle,
  CucumberPickleStep,
  CucumberScenario,
  CucumberTestCase,
  CucumberTestCaseFinished,
  CucumberTestCaseStarted,
  CucumberTestStepEvent,
  CucumberTestStepFinished,
  CucumberTimestamp,
} from "./model.js";

const readerId = "cucumber-messages";
const statusMap = new Map<string, RawTestStatus>([
  ["PASSED", "passed"],
  ["FAILED", "failed"],
  ["SKIPPED", "skipped"],
  ["PENDING", "skipped"],
  ["UNDEFINED", "broken"],
  ["AMBIGUOUS", "broken"],
]);
const statusOrder: RawTestStatus[] = ["failed", "broken", "unknown", "skipped", "passed"];
const stepKey = (executionId: string, stepId: string) => JSON.stringify([executionId, stepId]);

export const cucumberMessages: ResultsReader = {
  readerId: () => readerId,
  matches: (data) => /\.(jsonl|ndjson)$/.test(data.getOriginalFileName()),
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    try {
      const content = await data.asUtf8String();
      if (!content?.trim()) return false;
      const messages: CucumberMessage[] = content
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      if (!messages.every(isNonNullObject)) return false;
      return await processMessages(visitor, originalFileName, messages);
    } catch (error) {
      console.error("error parsing", originalFileName, error);
      return false;
    }
  },
};

const processMessages = async (visitor: ResultsVisitor, originalFileName: string, messages: CucumberMessage[]) => {
  const pickles = new Map<string, CucumberPickle>();
  const cases = new Map<string, CucumberTestCase>();
  const hooks = new Map<string, CucumberHook>();
  const starts = new Map<string, CucumberTestCaseStarted>();
  const finishes = new Map<string, CucumberTestCaseFinished>();
  const stepStarts = new Map<string, CucumberTestStepEvent>();
  const stepFinishes = new Map<string, CucumberTestStepFinished>();
  const attachments = new Map<string, CucumberAttachment[]>();

  for (const message of messages) {
    if (message.pickle) pickles.set(message.pickle.id, message.pickle);
    if (message.testCase) cases.set(message.testCase.id, message.testCase);
    if (message.hook) hooks.set(message.hook.id, message.hook);
    if (message.testCaseStarted) starts.set(message.testCaseStarted.id, message.testCaseStarted);
    if (message.testCaseFinished) finishes.set(message.testCaseFinished.testCaseStartedId, message.testCaseFinished);
    if (message.testStepStarted) {
      const event = message.testStepStarted;
      stepStarts.set(stepKey(event.testCaseStartedId, event.testStepId), event);
    }
    if (message.testStepFinished) {
      const event = message.testStepFinished;
      stepFinishes.set(stepKey(event.testCaseStartedId, event.testStepId), event);
    }
    const attachment = message.attachment;
    if (
      attachment?.testCaseStartedId &&
      typeof attachment.body === "string" &&
      (attachment.contentEncoding === "IDENTITY" || attachment.contentEncoding === "BASE64")
    ) {
      const group = attachments.get(attachment.testCaseStartedId) ?? [];
      group.push(attachment);
      attachments.set(attachment.testCaseStartedId, group);
    }
  }

  const gherkin = indexGherkin(messages);
  const context = { readerId, metadata: { originalFileName } };
  for (const execution of starts.values()) {
    const testCase = cases.get(execution.testCaseId);
    const pickle = testCase && pickles.get(testCase.pickleId);
    if (!testCase || !pickle) throw new Error(`Missing test case or pickle for execution ${execution.id}`);
    const { scenario, feature } = pickle.astNodeIds.map((id) => gherkin.scenarios.get(id)).find(Boolean) ?? {};
    const example = pickle.astNodeIds.map((id) => gherkin.examples.get(id)).find(Boolean);
    const line = pickle.location?.line ?? example?.line ?? scenario?.location.line;
    const name = pickle.name || "The scenario's name is not defined";
    const finish = finishes.get(execution.id);
    const result: RawTestResult = {
      uuid: randomUUID(),
      name,
      fullName: `${pickle.uri}${line === undefined ? "" : `:${line}`}#${name}`,
      testCaseName: scenario?.name,
      description: scenario?.description,
      parameters: example?.parameters,
      labels: [
        ...(feature ? [{ name: "feature", value: feature }] : []),
        ...pickle.tags.map(({ name: value }) => ({ name: "tag", value })),
      ],
      start: milliseconds(execution.timestamp),
      stop: milliseconds(finish?.timestamp),
      steps: [],
    };
    const pickleSteps = new Map(pickle.steps.map((step) => [step.id, step]));
    const executionAttachments = attachments.get(execution.id) ?? [];
    const allSteps: RawTestStepResult[] = [];
    const fixtures: RawFixtureResult[] = [];
    for (const testStep of testCase.testSteps) {
      const key = stepKey(execution.id, testStep.id);
      const pickleStep = testStep.pickleStepId ? pickleSteps.get(testStep.pickleStepId) : undefined;
      const hook = testStep.hookId ? hooks.get(testStep.hookId) : undefined;
      const keyword = pickleStep?.astNodeIds.map((id) => gherkin.keywords.get(id)).find((value) => value !== undefined);
      const step: RawTestStepResult = {
        ...convertStep(stepStarts.get(key), stepFinishes.get(key)),
        name: pickleStep ? `${keyword ?? ""}${pickleStep.text}` : (hook?.name ?? "Hook"),
        steps: await readAttachments(
          visitor,
          executionAttachments.filter((attachment) => attachment.testStepId === testStep.id),
          pickleStep,
        ),
      };
      allSteps.push(step);
      const fixtureType =
        hook?.type === "BEFORE_TEST_CASE" ? "before" : hook?.type === "AFTER_TEST_CASE" ? "after" : undefined;
      if (fixtureType) {
        fixtures.push({ ...step, type: fixtureType, testResults: [result.uuid!] });
      } else {
        result.steps!.push(step);
      }
    }
    result.steps!.push(
      ...(await readAttachments(
        visitor,
        executionAttachments.filter((attachment) => !attachment.testStepId),
      )),
    );
    const worst = allSteps.sort((a, b) => statusOrder.indexOf(a.status!) - statusOrder.indexOf(b.status!))[0];
    result.status = finish ? (worst?.status ?? "unknown") : "unknown";
    result.message = worst?.message;
    result.trace = worst?.trace;
    await visitor.visitTestResult(result, context);
    for (const fixture of fixtures) await visitor.visitTestFixtureResult(fixture, context);
  }
  return starts.size > 0;
};

const indexGherkin = (messages: CucumberMessage[]) => {
  const scenarios = new Map<string, { scenario: CucumberScenario; feature: string }>();
  const examples = new Map<string, { line: number; parameters: RawTestParameter[] }>();
  const keywords = new Map<string, string>();
  const visit = (children: CucumberGherkinChild[], feature: string) => {
    for (const child of children) {
      if (child.rule) visit(child.rule.children, feature);
      for (const step of child.scenario?.steps ?? child.background?.steps ?? []) keywords.set(step.id, step.keyword);
      if (!child.scenario) continue;
      const scenario = child.scenario;
      scenarios.set(scenario.id, { scenario, feature });
      for (const example of scenario.examples) {
        for (const row of example.tableBody) {
          examples.set(row.id, {
            line: row.location.line,
            parameters:
              example.tableHeader?.cells.map((cell, index) => ({ name: cell.value, value: row.cells[index]?.value })) ??
              [],
          });
        }
      }
    }
  };
  for (const message of messages) {
    const feature = message.gherkinDocument?.feature;
    if (feature) visit(feature.children, feature.name);
  }
  return { scenarios, examples, keywords };
};

const milliseconds = (timestamp: CucumberTimestamp | undefined) => {
  if (!timestamp) return undefined;
  const value = Number(timestamp.seconds) * 1000 + timestamp.nanos / 1_000_000;
  return Number.isFinite(value) ? value : undefined;
};

const convertStep = (
  started: CucumberTestStepEvent | undefined,
  finished: CucumberTestStepFinished | undefined,
): RawTestStepResult => {
  const result = finished?.testStepResult;
  const start = milliseconds(started?.timestamp);
  const duration = milliseconds(result?.duration);
  return {
    type: "step",
    start,
    // Let core derive stop without recalculating the measured duration from rounded timestamps.
    stop: start !== undefined && duration !== undefined ? undefined : milliseconds(finished?.timestamp),
    duration,
    status: statusMap.get(result?.status ?? "UNKNOWN") ?? "unknown",
    message: result?.exception?.message ?? result?.message,
    trace: result?.exception?.stackTrace ?? result?.message,
  };
};

const readAttachments = async (
  visitor: ResultsVisitor,
  attachments: CucumberAttachment[],
  step?: CucumberPickleStep,
) => {
  const result: RawTestAttachment[] = [];
  const docString = step?.argument?.docString;
  if (docString) {
    result.push(
      await visitAttachment(
        visitor,
        "Description",
        Buffer.from(docString.content),
        docString.mediaType ?? "text/plain",
      ),
    );
  }
  const table = step?.argument?.dataTable;
  if (table) {
    const csv = table.rows
      .map(({ cells }) => cells.map(({ value }) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    result.push(await visitAttachment(visitor, "Data", Buffer.from(csv), "text/csv"));
  }
  for (const attachment of attachments) {
    result.push(
      await visitAttachment(
        visitor,
        attachment.fileName ?? "Attachment",
        Buffer.from(attachment.body, attachment.contentEncoding === "BASE64" ? "base64" : "utf8"),
        attachment.mediaType,
      ),
    );
  }
  return result;
};

const visitAttachment = async (
  visitor: ResultsVisitor,
  name: string,
  content: Buffer,
  contentType: string,
): Promise<RawTestAttachment> => {
  const file = new BufferResultFile(content, randomUUID());
  await visitor.visitAttachmentFile(file, { readerId });
  return { type: "attachment", name, contentType, originalFileName: file.getOriginalFileName() };
};
