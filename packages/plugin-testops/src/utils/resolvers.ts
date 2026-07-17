import type { TestStepResult } from "@allurereport/core-api";
import { AllureStore } from "@allurereport/plugin-api";

import type {
  AttachmentForUpload,
  AttachmentsResolver,
  FixtureResolver,
  TestOpsFixtureResult,
  TestResultWithAttachments,
} from "../model.js";
import { getAttachmentIdsFromTestStepsResults, uploadFilenameForLink } from "./attachments.js";
import { normalizeTestStepsResults } from "./testResults.js";
import { validateExecutableName } from "./validation.js";

export const unwrapStepsAttachments = (steps: TestStepResult[]): TestStepResult[] =>
  steps.map((step) =>
    step.type === "attachment"
      ? { ...step, attachment: step.link }
      : step.steps
        ? { ...step, steps: unwrapStepsAttachments(step.steps) }
        : step,
  );

export function attachmentsResolverFactory(store: AllureStore) {
  const attachmentsResolver: AttachmentsResolver = async (tr) => {
    const attachments = await store.attachmentsByTrId(tr.id);
    const fixtures = await store.fixturesByTrId(tr.id);
    const allowedAttachmentIds = getAttachmentIdsFromTestStepsResults(normalizeTestStepsResults(tr.steps));

    for (const attachment of (tr as TestResultWithAttachments).attachments ?? []) {
      allowedAttachmentIds.add(attachment.id);
    }

    for (const fixture of fixtures) {
      if (!validateExecutableName(fixture.name)) {
        continue;
      }

      for (const id of getAttachmentIdsFromTestStepsResults(normalizeTestStepsResults(fixture.steps))) {
        allowedAttachmentIds.add(id);
      }
    }

    const result: AttachmentForUpload[] = [];
    const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));

    await Promise.all(
      [...allowedAttachmentIds].map(async (id) => {
        const attachment = (await store.attachmentById(id)) ?? attachmentsById.get(id);

        if (!attachment) {
          return undefined;
        }

        const content = await store.attachmentContentById(attachment.id);
        const body = await content?.readContent(async (s) => s);
        const filename = uploadFilenameForLink(attachment);

        if (filename === undefined || body === undefined) {
          return undefined;
        }

        result.push({
          originalFileName: filename,
          contentType: attachment.contentType ?? "application/octet-stream",
          content: body,
        });
      }),
    );

    return result;
  };

  return attachmentsResolver;
}

export function fixturesResolverFactory(store: AllureStore) {
  const fixturesResolver: FixtureResolver = async (tr) => {
    const fixtures = await store.fixturesByTrId(tr.id);

    return fixtures.map((fxt) => ({
      ...fxt,
      type: fxt.type.toUpperCase() as TestOpsFixtureResult["type"],
      steps: unwrapStepsAttachments(normalizeTestStepsResults(fxt.steps) ?? []),
    }));
  };

  return fixturesResolver;
}
