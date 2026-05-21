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

const ERROR_MESSAGE_FIELDS = ["message", "error_description", "error", "detail", "title", "description"];

const stringifyErrorObject = (value: Record<string, unknown>) => {
  try {
    return JSON.stringify(value);
  } catch {
    const entries = Object.entries(value).map(([key, entryValue]) => `${key}=${String(entryValue)}`);

    return entries.length > 0 ? `{ ${entries.join(", ")} }` : undefined;
  }
};

export const formatResponseErrorData = (data: unknown): string | undefined => {
  if (data === undefined || data === null || data === "") {
    return undefined;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean" || typeof data === "bigint") {
    return String(data);
  }

  if (Array.isArray(data)) {
    const items = data.map(formatResponseErrorData).filter(Boolean);

    return items.length > 0 ? items.join("; ") : undefined;
  }

  if (typeof data !== "object") {
    return String(data);
  }

  const errorData = data as Record<string, unknown>;

  for (const field of ERROR_MESSAGE_FIELDS) {
    const message = formatResponseErrorData(errorData[field]);

    if (message) {
      return message;
    }
  }

  return stringifyErrorObject(errorData);
};

export const formatServiceHttpErrorMessage = (payload: {
  method: string;
  endpoint: string;
  status?: number;
  statusText?: string;
  data?: unknown;
  fallbackMessage?: string;
}) => {
  const { method, endpoint, status, statusText, data, fallbackMessage } = payload;
  const request = `${method.toUpperCase()} ${endpoint}`;
  const statusMessage = status ? ` responded with ${status}${statusText ? ` ${statusText}` : ""}` : " failed";
  const details = formatResponseErrorData(data) || fallbackMessage;

  return `Allure service request failed: ${request}${statusMessage}${details ? `: ${details}` : ""}`;
};

export const createServiceHttpClient = (
  serviceUrl: string,
  params?: {
    accessToken?: string;
    apiToken?: string;
  },
) => {
  const client = axios.create({
    baseURL: serviceUrl,
    validateStatus: (status) => status < 400,
  });
  const sendRequest =
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: AxiosRequestConfig & { params?: Record<string, any>; body?: any }) => {
      const headers = {
        ...(payload?.headers ?? {}),
      };

      if (params?.accessToken) {
        headers.Authorization = `Bearer ${params.accessToken}`;
      }

      if (params?.apiToken) {
        headers.Authorization = `api-token ${params.apiToken}`;
      }

      try {
        let res: AxiosResponse<T>;

        if (method === "get" || method === "delete") {
          res = await client[method](endpoint, {
            ...payload,
            headers,
          });
        } else {
          res = await client[method](endpoint, payload?.body, {
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

        const { data, status, statusText } = (err as AxiosError).response ?? {};
        const responseStatus = status ?? 500;
        const errorMessage = formatServiceHttpErrorMessage({
          method,
          endpoint,
          status,
          statusText,
          data,
          fallbackMessage: err.message,
        });

        if (responseStatus < 500) {
          throw new KnownError(errorMessage, responseStatus);
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
