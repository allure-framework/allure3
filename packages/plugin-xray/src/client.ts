import axios, { type AxiosInstance, isAxiosError } from "axios";

import type { XrayStatus, XrayTestRun } from "./types.js";

/**
 * Maximum number of test runs Xray returns per page of a Test Execution
 */
export const XRAY_PAGE_SIZE = 1000;

export interface XrayClientOptions {
  endpoint: string;
  username?: string;
  password?: string;
  token?: string;
}

export const formatXrayError = (error: unknown): string => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return status ? `${error.message} (HTTP ${status})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Minimal client for Xray Server/Data Center REST API (`rest/raven/1.0`) and Jira REST API v2
 */
export class XrayClient {
  readonly #http: AxiosInstance;

  constructor({ endpoint, username, password, token }: XrayClientOptions) {
    this.#http = axios.create({
      baseURL: `${endpoint.replace(/\/+$/, "")}/rest/`,
      ...(token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : { auth: { username: username!, password: password! } }),
    });
  }

  async getTestRuns(executionKey: string): Promise<XrayTestRun[]> {
    const result: XrayTestRun[] = [];
    let page = 1;
    let pageRuns: XrayTestRun[];

    do {
      const { data } = await this.#http.get<XrayTestRun[]>(`raven/1.0/api/testexec/${executionKey}/test`, {
        params: { page: page++ },
      });
      pageRuns = data;
      result.push(...pageRuns);
    } while (pageRuns.length === XRAY_PAGE_SIZE);

    return result;
  }

  async updateTestRunStatus(testRunId: number, status: XrayStatus): Promise<void> {
    await this.#http.put(`raven/1.0/api/testrun/${testRunId}/status`, undefined, { params: { status } });
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    await this.#http.post(`api/2/issue/${issueKey}/comment`, { body });
  }
}
