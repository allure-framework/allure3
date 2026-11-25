import { vi } from "vite-plus/test";

export const BASE_URL = "http://allurereport.org";

export const AxiosMock = {
  defaults: {
    baseURL: BASE_URL,
  },
  interceptors: {
    request: {
      use: vi.fn(),
    },
  },
  get: vi.fn().mockResolvedValue({ data: { closed: false } }),
  post: vi.fn(),
  postForm: vi.fn(),
  patch: vi.fn(),
};

export const AxiosCreateMock = vi.fn(() => AxiosMock);
