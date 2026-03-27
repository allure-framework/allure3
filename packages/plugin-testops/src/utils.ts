import { env } from "node:process";

import type { TestStepResult } from "@allurereport/core-api";
import { AllureStore } from "@allurereport/plugin-api";

import type {
  AttachmentForUpload,
  AttachmentsResolver,
  FixtureResolver,
  TestOpsFixtureResult,
  TestOpsPluginOptions,
} from "./model.js";

export const unwrapStepsAttachments = (steps: TestStepResult[]): TestStepResult[] => {
  return steps.map((step) => {
    if (step.type === "attachment") {
      return {
        ...step,
        attachment: step.link,
      };
    }

    if (step.steps) {
      return {
        ...step,
        steps: unwrapStepsAttachments(step.steps),
      };
    }

    return step;
  });
};

export const resolvePluginOptions = (options: TestOpsPluginOptions): Omit<TestOpsPluginOptions, "filter"> => {
  const { ALLURE_TOKEN, ALLURE_ENDPOINT, ALLURE_PROJECT_ID, ALLURE_LAUNCH_TAGS, ALLURE_LAUNCH_NAME } = env;
  const {
    accessToken = ALLURE_TOKEN,
    endpoint = ALLURE_ENDPOINT,
    projectId = ALLURE_PROJECT_ID,
    launchTags = ALLURE_LAUNCH_TAGS,
    launchName = ALLURE_LAUNCH_NAME,
    autocloseLaunch,
  } = options;
  const tags = !launchTags
    ? []
    : Array.isArray(launchTags)
      ? launchTags
      : launchTags.split(",").map((tag) => tag.trim());

  return {
    launchName: launchName || "Allure Report",
    launchTags: tags,
    accessToken: accessToken || "",
    endpoint: endpoint || "",
    projectId: projectId || "",
    ...(autocloseLaunch !== undefined ? { autocloseLaunch } : {}),
  };
};

export function attachmentsResolverFactory(store: AllureStore) {
  const attachmentsResolver: AttachmentsResolver = async (tr) => {
    const attachments = await store.attachmentsByTrId(tr.id);
    const result: AttachmentForUpload[] = [];

    await Promise.all(
      attachments.map(async (attachment) => {
        const content = await store.attachmentContentById(attachment.id);
        const body = await content?.readContent(async (s) => s);
        const name = attachment.originalFileName ?? attachment.name;

        if (name === undefined || body === undefined) {
          return undefined;
        }

        result.push({
          originalFileName: name,
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
      steps: unwrapStepsAttachments(fxt.steps),
    }));
  };

  return fixturesResolver;
}
