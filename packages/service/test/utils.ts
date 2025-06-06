import { vi } from "vitest";
import { type HttpClient } from "../src/utils/http.js";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const HttpClientMock = vi.fn(function () {});

HttpClientMock.prototype.get = vi.fn();

HttpClientMock.prototype.post = vi.fn();

HttpClientMock.prototype.put = vi.fn();

HttpClientMock.prototype.delete = vi.fn();

export const createHttpClientMock = (): HttpClient => {
  return new HttpClientMock() as unknown as HttpClient;
};
