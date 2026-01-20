import type { TestResult } from "@allurereport/core-api";
import type { AxiosInstance } from "axios";
import axios from "axios";
import chunk from "lodash.chunk";
import FormData from "form-data";
import type { TestOpsLaunch, TestOpsSession } from "./model.js";

export class TestOpsClient {
  #accessToken: string;
  #projectId: string;
  #oauthToken: string = "";
  #client: AxiosInstance;
  #launch?: TestOpsLaunch;
  #session?: TestOpsSession;

  constructor(params: { baseUrl: string; projectId: string; accessToken: string }) {
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
    if (!this.#oauthToken) {
    }

    const formData = new FormData();

    formData.append("grant_type", "apitoken");
    formData.append("scope", "openid");
    formData.append("token", this.#accessToken);

    const { data } = await this.#client.post("/api/uaa/oauth/token", formData);

    this.#oauthToken = data.access_token as string;
  }

  async createLaunch() {
    if (!this.#oauthToken) {
      await this.issueOauthToken();
    }

    const { data } = await this.#client.post<TestOpsLaunch>(
      "/api/launch",
      {
        name: "local test",
        projectId: this.#projectId,
        autoclose: true,
        external: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#launch = data;
  }

  async createSession() {
    if (!this.#oauthToken) {
      await this.issueOauthToken();
    }

    if (!this.#launch) {
      throw new Error("Launch isn't created! Call createLaunch first");
    }

    const { data } = await this.#client.post<TestOpsSession>(
      "/api/rs/upload/session?manual=true",
      {
        launchId: this.#launch.id,
      },
      {
        headers: {
          Authorization: `Bearer ${this.#oauthToken}`,
        },
      },
    );

    this.#session = data;
  }

  async initialize() {
    await this.issueOauthToken();
    await this.createLaunch();
    await this.createSession();
  }

  async uploadTestResults(params: {
    trs: TestResult[];
    attachmentsResolver: (tr: TestResult) => Promise<any>;
    fixturesResolver: (tr: TestResult) => Promise<any>;
  }) {
    if (!this.#oauthToken) {
      await this.issueOauthToken();
    }

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

                  // attachmentsChunk.forEach((attachment: any) => {
                  //   formData.append(
                  //     "file",
                  //     new File([attachment.content], attachment.originalFileName, { type: attachment.contentType }),
                  //   );
                  // });

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
