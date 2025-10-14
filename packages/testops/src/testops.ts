import { type HistoryDataPoint, TestCase, TestResult } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import { type HttpClient, createTestOpsHttpClient } from "./utils/http.js";

/**
 * 1. User friendly API will work, but it's not optimal to create bunch of test results
 * 2. "Flat API" less friendly, but it's more optimal
 */

// TODO:

export class AllureTestOpsTestResult {
  trId: number | undefined;
  tr: TestResult | undefined;
  readonly #client: HttpClient;

  constructor(client: HttpClient, readonly params: { id: number, tr: TestResult }) {
    const { id, tr } = params;

    this.#client = client;
    this.trId = id;
    this.tr = tr;
  }

  async mapAttachments(cb: (attachmentId: string) => Promise<any>) {
    if (!this.tr) {
      throw new Error("Test result hasn't been initialized! Call init() first");
    }

    console.log("mapAttachments", this.tr);
  }
}

export class AllureTestOpsLaunch {
  readonly #client: HttpClient;

  launchId: number | undefined;
  sessionId: number | undefined;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  async init() {
    const launch = await this.#client.post<{ id: number }>("/api/launch", {
      body: {
        external: true,
        name: `Sample allure3 integration name – ${Date.now()}`,
      },
    });
    const session = await this.#client.post<{ id: number }>("/api/upload/session?manual=true", {
      body: {
        environment: [],
        launchId: launch.id,
      },
    });

    this.launchId = launch.id;
    this.sessionId = session.id;
  }

  async close() {
    if (!this.launchId) {
      throw new Error("Launch hasn't been initialized! Call init() first");
    }

    try {
      await this.#client.post(`/api/launch/${this.launchId}/close`);
    } catch (err) {
      console.log(err)
    }
  }

  // async addTestResult(tr: TestResult) {
  //   if (!this.launchId || !this.sessionId) {
  //     throw new Error("Launch hasn't been initialized! Call init() first");
  //   }
  //
  //   const testResult = new AllureTestOpsTestResult(this.#client);
  //
  //   await testResult.init(tr);
  //
  //   return testResult;
  // }

  async addTestResults(trs: TestResult[]) {
    if (!this.launchId || !this.sessionId) {
      throw new Error("Launch hasn't been initialized! Call init() first");
    }

    try {
      const { resultIds } = await this.#client.post<{ resultIds: number[] }>("/api/upload/test-result", {
        body: {
          results: trs.map((tr) => ({
            ...tr,
            status: tr.status.toUpperCase(),
          })),
          testSessionId: this.sessionId,
        },
      });

      return resultIds.map((id, i) => new AllureTestOpsTestResult(this.#client, {
        id,
        tr: trs[i],
      }));
    } catch (err) {
      console.log(err)
    }

  }
}

export class AllureTestOps {
  readonly #client: HttpClient;

  constructor(readonly config: Config["allureTestOps"]) {
    if (!config?.token) {
      throw new Error("Allure TestOps token is required!");
    }

    if (!config?.project) {
      throw new Error("Allure TestOps project is required!");
    }

    this.#client = createTestOpsHttpClient({
      allureTestOpsURL: config.url,
      accessToken: config.token,
      project: config.project,
    });
  }

  async startLaunch() {
    // const launch = await this.#client.post<{ id: number }>("/api/launch", {
    //   body: {
    //     external: true,
    //     name: `Sample allure3 integration name – ${Date.now()}`,
    //     projectId: this.config!.project,
    //   }
    // })
    //
    // return launch.id;

    const launch = new AllureTestOpsLaunch(this.#client);

    await launch.init();

    return launch;
  }

  // async closeLaunch(launchId: number) {
  //   try {
  //     await this.#client.post(`/api/launch/${launchId}/close`)
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }

  // async createSession(launchId: number) {
  //   const session = await this.#client.post<{ id: number }>("/api/upload/session?manual=true", {
  //     body: {
  //       environment: [],
  //       projectId: this.config!.project,
  //       launchId,
  //     }
  //   })
  //
  //   return session.id;
  // }

  // async uploadTestResults(sessionId: number, trs: TestResult[]) {
  //   try {
  //     const res = await this.#client.post("/api/integration/upload/test-result", {
  //       body: {
  //         results: trs.map((tr) => ({
  //           ...tr,
  //           status: tr.status.toUpperCase(),
  //         })),
  //         testSessionId: sessionId,
  //       }
  //     })
  //
  //     console.log("uploaded results", trs.length, res);
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }

  // async uploadTestCases(tcs: TestCase[]) {
  //   await Promise.all(
  //     tcs.map(async (tc) => {
  //       console.log("start testcase uploading: ", tc.id)
  //
  //       await this.#client.post("/api/integration/upload/test-case", {
  //         body: {
  //           ...tc,
  //           projectId: this.config!.project,
  //         },
  //       });
  //
  //       console.log("finishing testcase uploading: ", tc.id)
  //     }),
  //   );
  // }
}
