import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { DEFAULT_TESTOPS_URL } from "../model.js";

export type TestOpsHttpClientOptions = {
  allureTestOpsURL?: string;
  accessToken?: string;
  project: string
}

export const createTestOpsHttpClient = (params: TestOpsHttpClientOptions) => {
  const { allureTestOpsURL = DEFAULT_TESTOPS_URL, accessToken, project } = params;
  const client = axios.create({
    baseURL: allureTestOpsURL,
    withCredentials: true,
    validateStatus: (status) => status < 400,
  });
  const sendRequest =
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: AxiosRequestConfig & { params?: Record<string, any>; body?: any }) => {
      const headers = {
        ...(payload?.headers ?? {}),
      };

      headers.Authorization = `Api-Token ${accessToken}`;

      let res: AxiosResponse<T>;

      if (payload?.body) {
        res = await client[method](endpoint, {
          ...payload.body,
          projectId: project,
        }, {
          ...payload,
          headers,
        });
      } else {
        res = await client[method](endpoint, {
          ...payload,
          headers,
        });
      }

      return res.data;
    };

  return {
    get: sendRequest("get"),
    post: sendRequest("post"),
    put: sendRequest("put"),
    delete: sendRequest("delete"),
  };
};

export type HttpClient = ReturnType<typeof createTestOpsHttpClient>;
