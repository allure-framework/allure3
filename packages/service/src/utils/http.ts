import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { DEFAULT_HISTORY_SERVICE_URL } from "../model.js";
import { readAccessToken } from "./token.js";

/**
 * The error that was explicitly thrown by the service. We can print the error's message as is to the user
 */
export class KnownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnownError";
  }
}

/**
 * Unknown error (such as internal server error or error that was not explicitly thrown by the service)
 * We can't print the error's message directly to the user, so we need to add additionaly logic to handle it
 */
export class UnknownError extends Error {
  stack?: string;

  constructor(message: string, stack?: string) {
    super(message);
    this.name = "UnknownError";
    this.stack = stack;
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
        } else {
          res = await client[method](endpoint, {
            ...payload,
            headers,
          });
        }

        return res.data;
      } catch (err) {
        if (!(err instanceof AxiosError)) {
          throw err;
        }

        const { status = 500 } = (err as AxiosError).response ?? {};

        if (status < 500) {
          throw new KnownError(err.response?.data ?? err.message);
        }

        // @ts-ignore
        const { response, message, errors, stack } = err;

        /**
         * Trying to get axios actual error message
         * Original error message from the server usually locates in the `error.response.data` field
         * But when the error happened somewhere else, the error can be located in `error.errors` field
         * As a fallback, we just use original axios error message
         */
        throw new UnknownError(response?.data ?? errors?.[0]?.message?.trim?.() ?? message, stack);
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
