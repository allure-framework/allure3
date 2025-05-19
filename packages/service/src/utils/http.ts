import axios, { type AxiosRequestConfig } from "axios";
import { DEFAULT_HISTORY_SERVICE_URL } from "../model.js";
import { readAccessToken } from "./token.js";

export const createServiceHttpClient = (
  historyServiceURL: string = DEFAULT_HISTORY_SERVICE_URL,
  accessToken?: string,
) => {
  const client = axios.create({
    baseURL: historyServiceURL,
    withCredentials: true,
    validateStatus: (status) => status < 400,
  });
  const sendRequest =
    (method: "get" | "delete") =>
    async (endpoint: string, params?: Record<string, any>, options?: AxiosRequestConfig) => {
      const actualAccessToken = accessToken || (await readAccessToken());
      const headers = {
        ...(options?.headers ?? {}),
      };

      if (actualAccessToken) {
        headers.Authorization = actualAccessToken;
      }

      return client[method](endpoint, {
        ...options,
        headers,
        params,
      });
    };
  const sendRequestWithBody =
    (method: "post" | "put") => async (endpoint: string, body?: any, options?: AxiosRequestConfig) => {
      const actualAccessToken = accessToken || (await readAccessToken());
      const headers = {
        ...(options?.headers ?? {}),
      };

      if (actualAccessToken) {
        headers.Authorization = actualAccessToken;
      }

      return client[method](endpoint, body, {
        ...(options ?? {}),
        headers,
      });
    };

  return {
    get: sendRequest("get"),
    post: sendRequestWithBody("post"),
    put: sendRequestWithBody("put"),
    delete: sendRequest("delete"),
  };
};

export type HttpClient = ReturnType<typeof createServiceHttpClient>;
