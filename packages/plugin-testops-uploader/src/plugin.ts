import type { AttachmentTestStepResult, TestResult, TestStepResult } from "@allurereport/core-api";
import { type AllureStore, type Plugin, type PluginContext } from "@allurereport/plugin-api";
import type { TestopsUploaderPluginOptions } from "./model.js";
import { createLaunch, createSession, getJwtToken, pushAllureResults, pushAttachments } from "./uploader.js";

// TOKEN HERE
const EXAMPLE_TOKEN = "iamtokenhere";
const EXAMPLE_ENDPOINT = "https://testing.testops.cloud";

export class TestopsUploaderPlugin implements Plugin {
  constructor(readonly options: TestopsUploaderPluginOptions = {}) {}
  private jwt: string | undefined;

  // start = async (context: PluginContext, store: AllureStore) => {
  //   // await Promise.resolve();
  // };

  // update = async (context: PluginContext, store: AllureStore) => {
  //   // throw new Error("call start first");
  // };

  done = async (context: PluginContext, store: AllureStore) => {
    this.jwt = await getJwtToken(EXAMPLE_ENDPOINT, EXAMPLE_TOKEN);
    console.log("start end");
    console.log("DONE");
    const allTRs = await store.allTestResults();
    const attachments = await store.allAttachments();
    // console.log("allTRs", allTRs);

    if (!this.jwt) {
      console.log("No jwt");
      return;
    }
    console.log("jwt", this.jwt);
    // const uploader = await uploadTRs(EXAMPLE_ENDPOINT, this.jwt, allTRs);
    const launch = await createLaunch(EXAMPLE_ENDPOINT, this.jwt);
    console.log("LAUNCH", launch);
    if (!launch) {
      console.log("No launch id found");
      return;
    }

    // const session = await createSession(EXAMPLE_ENDPOINT, this.jwt, launch?.id);
    const session = await createSession(EXAMPLE_ENDPOINT, this.jwt, launch.id);

    if (!session) {
      console.log("No id found");
      return;
    }

    interface AttachmentWithoutLink extends AttachmentTestStepResult {
      attachment?: {
        contentLength?: number;
        contentType?: string;
        name: string;
        originalFileName: string | undefined;
      };
    }

    const fixStep = (step: TestStepResult): TestStepResult => {
      if ("steps" in step && Array.isArray(step.steps)) {
        step.steps = step.steps.map(fixStep);
      }

      if (step.type === "attachment" && step.link && typeof step.link === "object") {
        const { contentType, name, originalFileName } = step.link;
        (step as AttachmentWithoutLink).attachment = {
          // contentLength,
          contentType,
          name,
          originalFileName,
        };
        // @ts-ignore
        delete step.link;
      }

      console.log("step ----------------------------", step);
      return step;
    };

    const normalizeResultsPayload = (payload: TestResult[]): TestResult[] => {
      if (!payload) {
        return payload;
      }

      payload = payload.map((test: TestResult) => {
        if (Array.isArray(test.steps)) {
          test.steps = test.steps.map(fixStep);
        }
        return test;
      });

      return payload;
    };

    const clearedTRs = normalizeResultsPayload(allTRs);
    const result = await pushAllureResults(
      EXAMPLE_ENDPOINT,
      this.jwt,
      clearedTRs,
      "./allure-results",
      launch.id,
      session.id,
    );
    console.log("Sucessfully uploaded Test results \n", result);
    const pushAttach = await pushAttachments(EXAMPLE_ENDPOINT, this.jwt, attachments, launch.id, store);
    console.log("pushAttach", pushAttach);
  };

  async #getReportDate(store: AllureStore) {
    const trs = await store.allTestResults();
    return trs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);
  }
}
