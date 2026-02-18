import type { CiDescriptor, TestResult, TestStatus } from "@allurereport/core-api";
import type { AxiosInstance } from "axios";
import axios from "axios";
import FormData from "form-data";
import chunk from "lodash.chunk";
import type { TestOpsLaunch, TestOpsSession } from "./model.js";

export class TestOpsClient {
  #accessToken: string;
  #projectId: string;
  #oauthToken: string = "";
  #client: AxiosInstance;
  #launch?: TestOpsLaunch;
  #session?: TestOpsSession;
  #uploadInProgress: boolean = false;

  constructor(params: { baseUrl: string; projectId: string; accessToken: string }) {
    if (!params.accessToken) {
      throw new Error("accessToken is required");
    }

    if (!params.projectId) {
      throw new Error("projectId is required");
    }

    if (!params.baseUrl) {
      throw new Error("baseUrl is required");
    }

    this.#accessToken = params.accessToken;
    this.#projectId = params.projectId;
    this.#client = axios.create({
      baseURL: params.baseUrl,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  get launchUrl() {
    if (!this.#launch) {
      return undefined;
    }

    return new URL(`launch/${this.#launch.id}`, this.#client.defaults.baseURL).toString();
  }

  async issueOauthToken() {
    const formData = new FormData();

    formData.append("grant_type", "apitoken");
    formData.append("scope", "openid");
    formData.append("token", this.#accessToken);

    const { data } = await this.#client.post("/api/uaa/oauth/token", formData);

    this.#oauthToken = data.access_token as string;
  }

  async startUpload(ci: CiDescriptor) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    await this.#client.post<any>(
      "/api/upload/start",
      {
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
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#uploadInProgress = true;
  }

  async stopUpload(ci: CiDescriptor, status: TestStatus) {
    if (!this.#uploadInProgress) {
      throw new Error("Upload isn't started! Call startUpload first");
    }

    await this.#client.post(
      "/api/upload/stop",
      {
        jobRunUid: ci.jobRunUid,
        jobUid: ci.jobUid,
        projectId: this.#projectId,
        status,
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#uploadInProgress = false;
  }

  async createLaunch(launchName: string, launchTags: string[]) {
    const { data } = await this.#client.post<TestOpsLaunch>(
      "/api/launch",
      {
        name: launchName,
        projectId: this.#projectId,
        autoclose: true,
        external: true,
        tags: launchTags.map((tag) => ({ name: tag })),
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#launch = data;
  }

  async createSession(environment: Record<string, any> = {}) {
    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<TestOpsSession>(
      "/api/upload/session?manual=true",
      {
        launchId: this.#launch.id,
        environment: Object.entries(environment).map(([key, value]) => ({ key, value: String(value) })),
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#session = data;
  }

  async uploadTestResults(params: {
    trs: TestResult[];
    attachmentsResolver: (tr: TestResult) => Promise<any>;
    fixturesResolver: (tr: TestResult) => Promise<any>;
  }) {
    if (!this.#session) {
      throw new Error("Session isn't created! Call createSession first");
    }

    const { trs, attachmentsResolver, fixturesResolver } = params;
    const trsChunks = chunk(trs, 100);

    await Promise.all(
      trsChunks.map(async (trsChunk) => {
        const { data } = await this.#client.post<{ results: { id: number; uuid: string }[] }>(
          "/api/upload/test-result",
          {
            testSessionId: this.#session!.id,
            results: trsChunk.map((tr) => ({
              ...tr,
              // need to assign uuid explicitly because it's not provided by default
              uuid: tr.id,
            })),
          },
          {
            headers: {
              "Authorization": `Bearer ${this.#oauthToken}`,
              "Content-Type": "application/json",
            },
          },
        );
        const trsTestOpsIdsByUuid: Record<string, number> = data.results.reduce(
          (acc, { id, uuid }) => ({ ...acc, [uuid]: id }),
          {},
        );

        await Promise.all(
          trsChunk.map(async (tr) => {
            const trTestOpsId = trsTestOpsIdsByUuid[tr.id];
            const attachments = await attachmentsResolver(tr);
            const fixtures = await fixturesResolver(tr);

            if (attachments.length > 0) {
              const attachmentsChunks = chunk(attachments, 100);

              await Promise.all(
                attachmentsChunks.map(async (attachmentsChunk) => {
                  const formData = new FormData();

                  attachmentsChunk.forEach((attachment: any) => {
                    formData.append("file", attachment.content, {
                      filename: attachment.originalFileName,
                      contentType: attachment.contentType,
                    });
                  });
                  await this.#client.post(`/api/upload/test-result/${trTestOpsId}/attachment`, formData, {
                    headers: {
                      Authorization: `Bearer ${this.#oauthToken}`,
                      ...formData.getHeaders(),
                    },
                  });
                }),
              );
            }

            if (fixtures.length > 0) {
              await this.#client.post(
                `/api/upload/test-result/${trTestOpsId}/test-fixture-result`,
                {
                  fixtures,
                },
                {
                  headers: {
                    Authorization: `Bearer ${this.#oauthToken}`,
                  },
                },
              );
            }
          }),
        );
      }),
    );
  }
}
