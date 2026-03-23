import type { AttachmentLink, CiDescriptor, TestError, TestResult, TestStatus } from "@allurereport/core-api";
import type { AxiosInstance } from "axios";
import axios from "axios";
import FormData from "form-data";
import chunk from "lodash.chunk";
import pLimit from "p-limit";

import type {
  AttachmentForUpload,
  LaunchCategoryBulkItem,
  LaunchCategoryBulkResult,
  TestOpsClientParams,
  TestOpsLaunch,
  TestOpsNamedEnv,
  TestOpsSession,
  TestResultWithUploadCategory,
  UploadTestResultsParams,
} from "./model.js";
import { log } from "./utils.js";

const toUploadResultPayload = (tr: TestResultWithUploadCategory): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...tr, uuid: tr.id };

  if (tr.category !== undefined && tr.category !== null) {
    payload.category = {
      externalId: tr.category.externalId,
      ...(tr.category.grouping && tr.category.grouping.length > 0 && { grouping: tr.category.grouping }),
    };
  }

  if (tr.error !== undefined && tr.error !== null) {
    if (tr.error.message !== undefined && tr.error.message !== null) payload.message = tr.error.message;
    if (tr.error.trace !== undefined && tr.error.trace !== null) payload.trace = tr.error.trace;
  }

  return payload;
};

export class TestOpsClient {
  #accessToken: string;
  #projectId: string;
  #oauthToken: string = "";
  #client: AxiosInstance;
  #launch?: TestOpsLaunch;
  #session?: TestOpsSession;
  #uploadInProgress: boolean = false;
  #uploadLimit: number = 1;
  #namedEnvsIdsByEnv: Map<string, TestOpsNamedEnv> = new Map();

  constructor(params: TestOpsClientParams) {
    if (!params.accessToken) {
      throw new Error("accessToken is required");
    }

    if (!params.projectId) {
      throw new Error("projectId is required");
    }

    if (!params.baseUrl) {
      throw new Error("baseUrl is required");
    }

    if (params.limit && params.limit > 5) {
      throw new Error("limit can't be greater than 5");
    }

    this.#accessToken = params.accessToken;
    this.#projectId = params.projectId;
    this.#client = axios.create({
      baseURL: params.baseUrl,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    this.#client.interceptors.request.use((config) => {
      if (this.#oauthToken) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${this.#oauthToken}`;
      }
      return config;
    });

    if (params.limit) {
      this.#uploadLimit = params.limit;
    }
  }

  get launchUrl() {
    if (!this.#launch) {
      return undefined;
    }

    return new URL(`launch/${this.#launch.id}`, this.#client.defaults.baseURL).toString();
  }

  get launchId() {
    return this.#launch?.id;
  }

  async closeLaunch(launchId: number): Promise<void> {
    log("Closing launch…");
    await this.#client.post(`/api/launch/${launchId}/close`);
    log("Launch closed");
  }

  async createLaunchCategoriesBulk(
    launchId: number,
    items: LaunchCategoryBulkItem[],
  ): Promise<LaunchCategoryBulkResult[]> {
    if (items.length === 0) {
      return [];
    }

    const maxBulkItems = 1000;
    const itemChunks = chunk(items, maxBulkItems);
    const results: LaunchCategoryBulkResult[] = [];

    log(`Creating ${items.length} launch categories in ${itemChunks.length} request(s)…`);
    for (let i = 0; i < itemChunks.length; i += 1) {
      const chunkItems = itemChunks[i]!;
      const body = { launchId, items: chunkItems };
      log(
        `POST /api/launch/category/bulk request (${i + 1}/${itemChunks.length}, items: ${chunkItems.length})`,
        JSON.stringify(body, null, 2),
      );
      const { data } = await this.#client.post<LaunchCategoryBulkResult[]>("/api/launch/category/bulk", body, {
        headers: { "Content-Type": "application/json" },
      });
      if (Array.isArray(data)) {
        results.push(...data);
      }
    }

    return results;
  }

  async issueOauthToken() {
    const base = this.#client.defaults.baseURL;
    log(`Endpoint: ${base}`);
    log("Issuing OAuth token…");
    const formData = new FormData();

    formData.append("grant_type", "apitoken");
    formData.append("scope", "openid");
    formData.append("token", this.#accessToken);

    const { data } = await this.#client.post("/api/uaa/oauth/token", formData);

    this.#oauthToken = data.access_token as string;
    log("OAuth token received");
  }

  async startUpload(ci: CiDescriptor) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    log(`Starting CI upload (${ci.type})…`);
    await this.#client.post<any>("/api/upload/start", {
      projectId: this.#projectId,
      ci: {
        name: ci.type,
      },
      job: {
        name: ci.jobUid,
        uid: ci.jobUid,
      },
      jobRun: {
        uid: ci.jobRunUid,
      },
      launch: {
        id: this.#launch.id,
      },
    });

    this.#uploadInProgress = true;
    log("CI upload started");
  }

  async stopUpload(ci: CiDescriptor, status: TestStatus) {
    if (!this.#uploadInProgress) {
      throw new Error("Upload isn't started! Call startUpload first");
    }

    await this.#client.post("/api/upload/stop", {
      jobRunUid: ci.jobRunUid,
      jobUid: ci.jobUid,
      projectId: this.#projectId,
      status,
    });

    this.#uploadInProgress = false;
    log(`CI upload stopped (status: ${status})`);
  }

  async createLaunch(launchName: string, launchTags: string[]) {
    log("Creating launch…");
    const { data } = await this.#client.post<TestOpsLaunch>("/api/launch", {
      name: launchName,
      projectId: this.#projectId,
      autoclose: true,
      external: true,
      tags: launchTags.map((tag) => ({ name: tag })),
    });

    this.#launch = data;
    log(`Launch created: id=${data.id}`);
  }

  async createSession(environment: Record<string, any> = {}) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<TestOpsSession>("/api/upload/session?manual=true", {
      launchId: this.#launch.id,
      environment: Object.entries(environment).map(([key, value]) => ({ key, value: String(value) })),
    });

    this.#session = data;
  }

  async createNamedEnvs(environments: string[]) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<TestOpsNamedEnv[]>(
      "/api/launch/named-env/bulk",
      {
        launchId: this.#launch.id,
        items: environments.map((env) => ({
          externalId: env,
          // TODO: complete once https://github.com/allure-framework/allure3/pull/536 will be done
          name: env,
        })),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    data.forEach((env) => {
      this.#namedEnvsIdsByEnv.set(env.externalId, env);
    });
  }

  async uploadGlobalAttachments(params: {
    attachments: AttachmentLink[];
    attachmentsResolver: (attachment: AttachmentLink) => Promise<AttachmentForUpload | undefined>;
  }) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const formData = new FormData();

    for (const attachmentLink of params.attachments) {
      const attachment = await params.attachmentsResolver(attachmentLink);

      if (!attachment) {
        continue;
      }

      formData.append("file", attachment.content, {
        filename: attachment.originalFileName,
        contentType: attachment.contentType,
      });
    }

    await this.#client.post(`/api/launch/attachment?launchId=${this.#launch.id}`, formData);
  }

  async uploadGlobalErrors(errors: TestError[]) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    await this.#client.post("/api/launch/error/bulk", {
      launchId: this.#launch.id,
      items: errors,
    });
  }

  async uploadTestResults(params: {
    trs: TestResult[];
    attachmentsResolver: UploadTestResultsParams["attachmentsResolver"];
    fixturesResolver: UploadTestResultsParams["fixturesResolver"];
    onProgress?: () => void;
  }) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    const { trs, attachmentsResolver, fixturesResolver, onProgress } = params;
    const trsChunks = chunk(trs, 100);
    const uploadLimitFn = pLimit(this.#uploadLimit);

    for (const trsChunk of trsChunks) {
      const resultIdsByUuid = await this.#postTestResultsChunk(trsChunk);
      await this.#uploadChunkAttachmentsAndFixtures(
        trsChunk,
        resultIdsByUuid,
        attachmentsResolver,
        fixturesResolver,
        uploadLimitFn,
        onProgress,
      );
    }

    log("Test results upload completed");
  }
  async #postTestResultsChunk(trsChunk: TestResult[]): Promise<Record<string, number>> {
    const missingNamedEnvironments: Set<string> = new Set();
    for (const testResult of trsChunk) {
      if (testResult.environment && !this.#namedEnvsIdsByEnv.has(testResult.environment)) {
        missingNamedEnvironments.add(testResult.environment);
      }
    }

    if (missingNamedEnvironments.size > 0) {
      await this.createNamedEnvs(Array.from(missingNamedEnvironments));
    }

    const { data } = await this.#client.post<{ results: { id: number; uuid: string }[] }>(
      "/api/upload/test-result",
      {
        testSessionId: this.#session!.id,
        results: trsChunk.map((testResult) => {
          const namedEnvironment = testResult.environment
            ? this.#namedEnvsIdsByEnv.get(testResult.environment)
            : undefined;
          return toUploadResultPayload({
            ...(testResult as TestResultWithUploadCategory),
            ...(namedEnvironment ? { namedEnv: { id: namedEnvironment.id } } : {}),
          });
        }),
      },
      { headers: { "Content-Type": "application/json" } },
    );
    return (data.results ?? []).reduce((acc, { id, uuid }) => ({ ...acc, [uuid]: id }), {} as Record<string, number>);
  }

  async #uploadChunkAttachmentsAndFixtures(
    trsChunk: TestResult[],
    resultIdsByUuid: Record<string, number>,
    attachmentsResolver: UploadTestResultsParams["attachmentsResolver"],
    fixturesResolver: UploadTestResultsParams["fixturesResolver"],
    uploadLimitFn: (fn: () => Promise<void>) => Promise<void>,
    onProgress?: () => void,
  ): Promise<void> {
    await Promise.all(
      trsChunk.map((tr) =>
        uploadLimitFn(async () => {
          const testOpsId = resultIdsByUuid[tr.id];
          const attachments = await attachmentsResolver(tr);
          const fixtures = await fixturesResolver(tr);

          await this.#uploadAttachmentsForResult(testOpsId, attachments);
          await this.#uploadFixturesForResult(testOpsId, fixtures);
          onProgress?.();
        }),
      ),
    );
  }

  async #uploadAttachmentsForResult(testOpsResultId: number, attachments: AttachmentForUpload[]): Promise<void> {
    if (attachments.length === 0) return;

    const attachmentsChunks = chunk(attachments, 100);
    for (const attachmentsChunk of attachmentsChunks) {
      const formData = new FormData();
      for (const att of attachmentsChunk) {
        formData.append("file", att.content, {
          filename: att.originalFileName,
          contentType: att.contentType,
        });
      }
      await this.#client.post(`/api/upload/test-result/${testOpsResultId}/attachment`, formData, {
        headers: formData.getHeaders(),
      });
    }
  }

  async #uploadFixturesForResult(testOpsResultId: number, fixtures: unknown[]): Promise<void> {
    if (fixtures.length === 0) return;

    await this.#client.post(`/api/upload/test-result/${testOpsResultId}/test-fixture-result`, { fixtures });
  }
}
