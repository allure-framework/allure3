import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { DEFAULT_HISTORY_SERVICE_URL } from "../model.js";
import { readAccessToken } from "./token.js";

// 404
export class NotFoundError extends Error {
  constructor() {
    super("Not found");
    this.name = "NotFoundError";
  }
}

// 401
export class AuthenticationError extends Error {
  constructor() {
    super("Authentication failed");
    this.name = "AuthenticationError";
  }
}

// 400
export class BadRequestError extends Error {
  constructor() {
    super("Bad request");
    this.name = "BadRequestError";
  }
}

// 500
export class InternalServerError extends Error {
  constructor() {
    super("Internal server error");
    this.name = "InternalServerError";
  }
}

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
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: AxiosRequestConfig & { params?: Record<string, any>; body?: any }) => {
      const actualAccessToken = accessToken || (await readAccessToken());
      const headers = {
        ...(payload?.headers ?? {}),
      };

      if (actualAccessToken) {
        headers.Authorization = `Bearer ${actualAccessToken}`;
      }

      try {
        let res: AxiosResponse<T>;

        if (payload?.body) {
          res = await client[method](endpoint, payload.body, {
            ...payload,
            headers,
          });
        }

        res = await client[method](endpoint, {
          ...payload,
          headers,
        });

        return res.data;
      } catch (err) {
        if (err instanceof AxiosError) {
          switch (err.response?.status) {
            case 401:
              throw new AuthenticationError();
            case 400:
              throw new BadRequestError();
            case 500:
              throw new InternalServerError();
          }
        }

        throw err;
      }
    };

  return {
    get: sendRequest("get"),
    post: sendRequest("post"),
    put: sendRequest("put"),
    delete: sendRequest("delete"),
  };
};

export type HttpClient = ReturnType<typeof createServiceHttpClient>;
