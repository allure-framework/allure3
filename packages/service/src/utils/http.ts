import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";

/**
 * The error that was explicitly thrown by the service. We can print the error's message as is to the user
 */
export class KnownError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "KnownError";
    this.status = status;
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

export const createServiceHttpClient = (serviceUrl: string, accessToken: string) => {
  const client = axios.create({
    baseURL: serviceUrl,
    withCredentials: true,
    validateStatus: (status) => status < 400,
  });
  const sendRequest =
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: AxiosRequestConfig & { params?: Record<string, any>; body?: any }) => {
      const headers = {
        ...(payload?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      };

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
        const axiosError = isAxiosError(err);

        if (!axiosError) {
          throw err;
        }

        const { status = 500 } = (err as AxiosError).response ?? {};
        const errorMessage = err.response?.data?.error || err.response?.data || err.message;

        if (status < 500) {
          throw new KnownError(errorMessage, status);
        }

        throw new UnknownError(errorMessage, err.stack);
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
