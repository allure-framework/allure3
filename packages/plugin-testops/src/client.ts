import { ClientRequest } from "http";

import type { AttachmentLink, CiDescriptor, TestError, TestResult, TestStatus } from "@allurereport/core-api";
import { QualityGateValidationResult } from "@allurereport/plugin-api";
import axios, { AxiosError, AxiosInstance } from "axios";
import FormData from "form-data";
import { chunk } from "lodash-es";
import pLimit from "p-limit";
import { bold } from "yoctocolors";

import { Logger } from "./logger.js";
import type {
  AttachmentForUpload,
  AttachmentsResolver,
  TestOpsPluginTestResult,
  FixtureResolver,
  LaunchCategoryBulkItem,
  LaunchCategoryBulkResult,
  TestOpsClientParams,
  TestOpsLaunch,
  TestOpsLaunchQualityGate,
  TestOpsNamedEnv,
  TestOpsSession,
} from "./model.js";

class TestOpsClientError extends AxiosError<{
  message: string;
  timestamp: number;
  status: number;
}> {
  // @ts-expect-error this is for types
  response: AxiosResponse<{
    message: string;
    timestamp: number;
    status: number;
  }>;

  // @ts-expect-error this is for types
  request: ClientRequest;
}

const CHUNK_SIZE = 100;
const BULK_UPLOAD_CHUNK_SIZE = 1000;

export class TestOpsClient {
  #logger = new Logger("TestOpsClient");
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

  isTestOpsClientError(error: unknown): error is TestOpsClientError {
    return (
      error instanceof AxiosError &&
      typeof error.response?.data.status === "number" &&
      typeof error.response?.data.message === "string"
    );
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
    this.#logger.verbose("Closing launch…");
    await this.#client.post(`/api/launch/${launchId}/close`);
    this.#logger.verbose("Launch closed");
  }

  async createLaunchCategoriesBulk(
    launchId: number,
    items: LaunchCategoryBulkItem[],
  ): Promise<LaunchCategoryBulkResult[]> {
    if (items.length === 0) {
      return [];
    }

    const results: LaunchCategoryBulkResult[] = [];

    const uploadChunk = async (chunk: LaunchCategoryBulkItem[], currentRequestIndex: number, totalChunks: number) => {
      const body = { launchId, items: chunk };

      if (totalChunks === 1) {
        this.#logger.debug(`POST /api/launch/category/bulk request (items: ${chunk.length})`);
      } else {
        this.#logger.debug(
          `POST /api/launch/category/bulk request (${currentRequestIndex + 1}/${totalChunks}, items: ${chunk.length})`,
        );
      }

      this.#logger.debug(body);

      const { data } = await this.#client.post<LaunchCategoryBulkResult[]>("/api/launch/category/bulk", body, {
        headers: { "Content-Type": "application/json" },
      });

      if (Array.isArray(data)) {
        results.push(...data);
      }
    };

    if (items.length <= BULK_UPLOAD_CHUNK_SIZE) {
      this.#logger.verbose(`Creating ${bold(items.length.toString())} launch categories…`);
      await uploadChunk(items, 0, 1);
    } else {
      const chunks = chunk(items, BULK_UPLOAD_CHUNK_SIZE);
      this.#logger.verbose(
        `Creating ${bold(items.length.toString())} launch categories in ${bold(chunks.length.toString())} request(s)…`,
      );

      for (let i = 0; i < chunks.length; i += 1) {
        await uploadChunk(chunks[i], i, chunks.length);
      }
    }

    return results;
  }

  async issueOauthToken() {
    const base = this.#client.defaults.baseURL;
    this.#logger.debug(`Endpoint: ${base}`);
    this.#logger.verbose("Issuing OAuth token…");
    const formData = new FormData();

    formData.append("grant_type", "apitoken");
    formData.append("scope", "openid");
    formData.append("token", this.#accessToken);

    const { data } = await this.#client.post("/api/uaa/oauth/token", formData);

    this.#oauthToken = data.access_token as string;
    this.#logger.verbose("OAuth token received");
  }

  async startUpload(ci: CiDescriptor) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    this.#logger.verbose(`Starting CI upload (${ci.type})…`);
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
    this.#logger.verbose("CI upload started");
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
    this.#logger.verbose(`CI upload stopped (status: ${status})`);
  }

  async createLaunch(launchName: string, launchTags: string[]) {
    this.#logger.verbose("Creating launch…");
    const { data } = await this.#client.post<TestOpsLaunch>("/api/launch", {
      name: launchName,
      projectId: this.#projectId,
      autoclose: true,
      external: true,
      tags: launchTags.map((tag) => ({ name: tag })),
    });

    this.#launch = data;
    this.#logger.debug(`Launch created: id=${bold(data.id.toString())}`);
  }

  async createSession(environment: Record<string, any> = {}) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<TestOpsSession>(
      "/api/upload/session",
      {
        launchId: this.#launch.id,
        environment: Object.entries(environment).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      },
      {
        params: {
          manual: "true",
        },
      },
    );

    this.#session = data;
  }

  get namedEnvs() {
    return this.#namedEnvsIdsByEnv.values();
  }

  #getNamedEnv(cb: (env: TestOpsNamedEnv) => boolean) {
    for (const [, env] of this.#namedEnvsIdsByEnv) {
      if (cb(env)) {
        return env;
      }
    }

    return undefined;
  }

  async createNamedEnvs(environments: string[], onProgress?: (percent: number, total: number) => void) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<Pick<TestOpsNamedEnv, "id" | "externalId">[]>(
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
        onUploadProgress(progressEvent) {
          const total = progressEvent.total ?? 100;
          const percent = total > 0 ? Math.min(100, Math.max(0, (progressEvent.loaded / total) * 100)) : 0;
          onProgress?.(percent, total);
        },
      },
    );

    data.forEach((env) => {
      this.#namedEnvsIdsByEnv.set(env.externalId, {
        ...env,
        // @TODO: CHANGE TO IDS
        name: environments.find((e) => e === env.externalId)!,
      });
    });
  }

  async uploadGlobalAttachments(params: {
    attachments: AttachmentLink[];
    attachmentsResolver: (attachment: AttachmentLink) => Promise<AttachmentForUpload | undefined>;
    onProgress?: (percent: number, total: number) => void;
  }) {
    const { attachments, attachmentsResolver, onProgress } = params;

    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const formData = new FormData();

    for (const attachmentLink of attachments) {
      const attachment = await attachmentsResolver(attachmentLink);

      if (!attachment) {
        continue;
      }

      formData.append("file", attachment.content, {
        filename: attachment.originalFileName,
        contentType: attachment.contentType,
      });
    }

    await this.#client.post("/api/launch/attachment", formData, {
      onUploadProgress(progressEvent) {
        const total = progressEvent.total ?? 100;
        const percent = total > 0 ? Math.min(100, Math.max(0, (progressEvent.loaded / total) * 100)) : 0;
        onProgress?.(percent, total);
      },
      params: { launchId: this.#launch.id },
    });
  }

  async uploadGlobalErrors(errors: TestError[], onProgress?: (percent: number, total: number) => void) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    await this.#client.post(
      "/api/launch/error/bulk",
      {
        launchId: this.#launch.id,
        items: errors,
      },
      {
        onUploadProgress(progressEvent) {
          const total = progressEvent.total ?? 100;
          const percent = total > 0 ? Math.min(100, Math.max(0, (progressEvent.loaded / total) * 100)) : 0;
          onProgress?.(percent, total);
        },
      },
    );
  }

  async uploadTestResults(params: {
    trs: TestOpsPluginTestResult[];
    attachmentsResolver: AttachmentsResolver;
    fixturesResolver: FixtureResolver;
    onProgress?: () => void;
  }) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    const { trs, attachmentsResolver, fixturesResolver, onProgress } = params;
    const trsChunks = chunk(trs, CHUNK_SIZE);
    const uploadLimitFn = pLimit(this.#uploadLimit);
    const uploadedTrs: TestResult[] = [];

    try {
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

        uploadedTrs.push(...trsChunk);
      }

      this.#logger.verbose("Test results upload completed");
    } catch (error) {
      if (this.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload test results: ${error.response?.data.message}`);
        this.#logger.debug(error.response.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload test results: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload test results");
      }
    }

    return uploadedTrs;
  }

  async #postTestResultsChunk(trsChunk: TestResult[]): Promise<Record<string, number>> {
    const { data } = await this.#client.post<{ results: { id: number; uuid: string }[] }>(
      "/api/upload/test-result",
      {
        testSessionId: this.#session!.id,
        results: trsChunk.map((testResult) => {
          const extendedTestResult: TestOpsPluginTestResult = { ...testResult };

          const namedEnvironment =
            !!testResult.environment &&
            // @TODO: USE IDS HERE
            this.#getNamedEnv((env) => env.externalId === testResult.environment);

          if (namedEnvironment) {
            extendedTestResult.namedEnv = { id: namedEnvironment.id };
          }

          if (
            typeof extendedTestResult.category?.externalId === "string" ||
            typeof extendedTestResult.category?.externalId === "number"
          ) {
            const category = extendedTestResult.category;

            extendedTestResult.category = {
              externalId: category.externalId,
            };

            if (category.grouping && category.grouping.length > 0) {
              extendedTestResult.category.grouping = category.grouping;
            }
          }

          const error = extendedTestResult.error;

          if (typeof error?.message === "string") {
            extendedTestResult.message = error.message;
          }

          if (typeof error?.trace === "string") {
            extendedTestResult.trace = error.trace;
          }

          return extendedTestResult;
        }),
      },
      { headers: { "Content-Type": "application/json" } },
    );

    return (data.results ?? []).reduce((acc, { id, uuid }) => ({ ...acc, [uuid]: id }), {} as Record<string, number>);
  }

  async #uploadChunkAttachmentsAndFixtures(
    trsChunk: TestOpsPluginTestResult[],
    resultIdsByUuid: Record<string, number>,
    attachmentsResolver: AttachmentsResolver,
    fixturesResolver: FixtureResolver,
    uploadLimitFn: (fn: () => Promise<void>) => Promise<void>,
    onProgress?: () => void,
  ): Promise<void> {
    await Promise.all(
      trsChunk.map((tr) =>
        uploadLimitFn(async () => {
          const testOpsId = resultIdsByUuid[tr.id];
          const attachments = await attachmentsResolver(tr);
          const fixtures = await fixturesResolver(tr);

          await this.#uploadAttachmentsForResult(testOpsId, attachments as AttachmentForUpload[]);
          await this.#uploadFixturesForResult(testOpsId, fixtures);
          onProgress?.();
        }),
      ),
    );
  }

  async #uploadAttachmentsForResult(testOpsResultId: number, attachments: AttachmentForUpload[]): Promise<void> {
    if (attachments.length === 0) {
      return;
    }

    const attachmentsChunks = chunk(attachments, 100);

    for (const attachmentsChunk of attachmentsChunks) {
      const formData = new FormData();

      for (const att of attachmentsChunk) {
        formData.append("file", att.content, {
          filename: att.originalFileName,
          contentType: att.contentType,
        });
      }

      try {
        await this.#client.post(`/api/upload/test-result/${testOpsResultId}/attachment`, formData, {
          headers: formData.getHeaders(),
        });
      } catch (error) {
        if (this.isTestOpsClientError(error)) {
          this.#logger.error(
            `Failed to upload attachments for result ${testOpsResultId}: ${error.response?.data.message}`,
          );
        } else if (error instanceof Error) {
          this.#logger.error(`Failed to upload attachments for result ${testOpsResultId}: ${error.message}`);
        } else {
          this.#logger.error(`Failed to upload attachments for result ${testOpsResultId}`);
        }

        this.#logger.inspect(formData);
      }
    }
  }

  async #uploadFixturesForResult(testOpsResultId: number, fixtures: unknown[]): Promise<void> {
    if (fixtures.length === 0) return;

    await this.#client.post(`/api/upload/test-result/${testOpsResultId}/test-fixture-result`, {
      fixtures,
    });
  }

  async uploadQualityGateResults(
    results: QualityGateValidationResult[],
    onProgress?: (percent: number, total: number) => void,
  ) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    // @TODO: USE IDS HERE
    const getNamedEnvForEnv = (envName: string) => this.#getNamedEnv((env) => env.externalId === envName);

    const items: Omit<TestOpsLaunchQualityGate, "id" | "launchId">[] = results.map((result) => {
      const item: Omit<TestOpsLaunchQualityGate, "id" | "launchId"> = {
        name: result.rule,
        message: result.message,
      };

      const namedEnvId = !!result.environment && getNamedEnvForEnv(result.environment!)?.id;

      if (typeof namedEnvId === "number") {
        item.namedEnvId = namedEnvId;
      }

      return item;
    });

    await this.#client.post(
      "/api/launch/quality-gate/bulk",
      {
        launchId: this.#launch.id,
        items,
      },
      {
        onUploadProgress(progressEvent) {
          const total = progressEvent.total ?? 100;
          const percent = total > 0 ? Math.min(100, Math.max(0, (progressEvent.loaded / total) * 100)) : 0;
          onProgress?.(percent, total);
        },
      },
    );
  }
}
