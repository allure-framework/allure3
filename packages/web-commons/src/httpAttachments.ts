export const HTTP_EXCHANGE_REDACTED_VALUE = "__ALLURE_REDACTED__";

export type HttpPair = {
  name: string;
  value: string;
  masked: boolean;
};

export type HttpCookie = HttpPair & {
  domain: string;
  expires: string;
  httpOnly: boolean;
  maxAge?: number;
  path: string;
  sameSite: string;
  secure: boolean;
};

export type HttpStream = {
  type: string;
  complete: string;
  chunkCount?: number;
};

export type HttpBodyPart = {
  name: string;
  fileName: string;
  headers: HttpPair[];
  contentType: string;
  encoding: string;
  value: string;
  hasValue: boolean;
  size?: number;
  truncated: boolean;
};

export type HttpBody = {
  contentType: string;
  encoding: string;
  value: string;
  hasValue: boolean;
  size?: number;
  truncated: boolean;
  form: HttpPair[];
  parts: HttpBodyPart[];
  stream: HttpStream | null;
};

export type HttpRequest = {
  method: string;
  url: string;
  httpVersion: string;
  headers: HttpPair[];
  cookies: HttpCookie[];
  query: HttpPair[];
  body: HttpBody | null;
  trailers: HttpPair[];
};

export type HttpInformationalResponse = {
  status: string;
  reason: string;
  headers: HttpPair[];
};

export type HttpResponse = {
  status: string;
  reason: string;
  httpVersion: string;
  headers: HttpPair[];
  cookies: HttpCookie[];
  body: HttpBody | null;
  trailers: HttpPair[];
  informationalResponses: HttpInformationalResponse[];
};

export type HttpError = {
  name: string;
  message: string;
  stack: string;
};

export type NormalizedHttpPayload = {
  request: HttpRequest | null;
  response: HttpResponse | null;
  error: HttpError | null;
  durationMs: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toOptionalString = (value: unknown): string =>
  value === null || typeof value === "undefined" ? "" : String(value);

const toFiniteNumber = (value: unknown): number | undefined => {
  const num = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(num) ? num : undefined;
};

const headerValue = (headers: HttpPair[], name: string) => {
  const normalizedName = name.toLowerCase();
  return headers.find((header) => header.name.toLowerCase() === normalizedName)?.value ?? "";
};

const normalizeArray = <T>(value: unknown, normalize: (item: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(normalize).filter((item): item is T => item !== null) : [];

const normalizePair = (value: unknown): HttpPair | null => {
  if (!isRecord(value)) {
    return null;
  }

  const name = toOptionalString(value.name).trim();
  const pairValue = toOptionalString(value.value);
  const masked = pairValue === HTTP_EXCHANGE_REDACTED_VALUE;

  if (!name && !pairValue) {
    return null;
  }

  return { name, value: pairValue, masked };
};

const normalizePairs = (value: unknown): HttpPair[] => normalizeArray(value, normalizePair);

const normalizeCookie = (value: unknown): HttpCookie | null => {
  if (!isRecord(value)) {
    return null;
  }

  const pair = normalizePair(value);
  if (!pair) {
    return null;
  }

  return {
    ...pair,
    domain: toOptionalString(value.domain).trim(),
    expires: toOptionalString(value.expires).trim(),
    httpOnly: value.httpOnly === true,
    maxAge: toFiniteNumber(value.maxAge),
    path: toOptionalString(value.path).trim(),
    sameSite: toOptionalString(value.sameSite).trim(),
    secure: value.secure === true,
  };
};

const normalizeCookies = (value: unknown): HttpCookie[] => normalizeArray(value, normalizeCookie);

const normalizeStream = (value: unknown): HttpStream | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    type: toOptionalString(value.type).trim(),
    complete: typeof value.complete === "boolean" ? String(value.complete) : "",
    chunkCount: toFiniteNumber(value.chunkCount),
  };
};

const normalizeBodyPart = (value: unknown): HttpBodyPart | null => {
  if (!isRecord(value)) {
    return null;
  }

  const headers = normalizePairs(value.headers);
  const hasValue = typeof value.value !== "undefined" && value.value !== null;

  return {
    name: toOptionalString(value.name).trim(),
    fileName: toOptionalString(value.fileName).trim(),
    headers,
    contentType: toOptionalString(value.contentType).trim() || headerValue(headers, "content-type"),
    encoding: toOptionalString(value.encoding).trim().toLowerCase() || "utf8",
    value: hasValue ? String(value.value) : "",
    hasValue,
    size: toFiniteNumber(value.size),
    truncated: value.truncated === true,
  };
};

const normalizeBodyParts = (value: unknown): HttpBodyPart[] => normalizeArray(value, normalizeBodyPart);

const normalizeBody = (value: unknown, fallbackContentType = ""): HttpBody | null => {
  if (!isRecord(value)) {
    return null;
  }

  const hasValue = typeof value.value !== "undefined" && value.value !== null;

  return {
    contentType: toOptionalString(value.contentType).trim() || fallbackContentType,
    encoding: toOptionalString(value.encoding).trim().toLowerCase() || "utf8",
    value: hasValue ? String(value.value) : "",
    hasValue,
    size: toFiniteNumber(value.size),
    truncated: value.truncated === true,
    form: normalizePairs(value.form),
    parts: normalizeBodyParts(value.parts),
    stream: normalizeStream(value.stream),
  };
};

const normalizeRequest = (value: unknown): HttpRequest | null => {
  if (!isRecord(value)) {
    return null;
  }

  const headers = normalizePairs(value.headers);

  return {
    method: toOptionalString(value.method).trim().toUpperCase() || "GET",
    url: toOptionalString(value.url).trim(),
    httpVersion: toOptionalString(value.httpVersion).trim(),
    headers,
    cookies: normalizeCookies(value.cookies),
    query: normalizePairs(value.query),
    body: normalizeBody(value.body, headerValue(headers, "content-type")),
    trailers: normalizePairs(value.trailers),
  };
};

const normalizeInformationalResponse = (value: unknown): HttpInformationalResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    status: toOptionalString(value.status).trim(),
    reason: toOptionalString(value.statusText).trim(),
    headers: normalizePairs(value.headers),
  };
};

const normalizeInformationalResponses = (value: unknown): HttpInformationalResponse[] =>
  normalizeArray(value, normalizeInformationalResponse);

const normalizeResponse = (value: unknown): HttpResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const headers = normalizePairs(value.headers);

  return {
    status: toOptionalString(value.status).trim(),
    reason: toOptionalString(value.statusText).trim(),
    httpVersion: toOptionalString(value.httpVersion).trim(),
    headers,
    cookies: normalizeCookies(value.cookies),
    body: normalizeBody(value.body, headerValue(headers, "content-type")),
    trailers: normalizePairs(value.trailers),
    informationalResponses: normalizeInformationalResponses(value.informationalResponses),
  };
};

const normalizeError = (value: unknown): HttpError | null => {
  if (!isRecord(value)) {
    return null;
  }

  const name = toOptionalString(value.name).trim();
  const message = toOptionalString(value.message).trim();
  const stack = toOptionalString(value.stack).trim();

  if (!name && !message && !stack) {
    return null;
  }

  return { name, message, stack };
};

export const normalizeHttpExchangePayload = (payload: unknown): NormalizedHttpPayload => {
  if (!isRecord(payload)) {
    return { request: null, response: null, error: null, durationMs: "" };
  }

  const start = toFiniteNumber(payload.start);
  const stop = toFiniteNumber(payload.stop);
  const durationMs = start !== undefined && stop !== undefined && stop >= start ? `${stop - start} ms` : "";

  return {
    request: normalizeRequest(payload.request),
    response: normalizeResponse(payload.response),
    error: normalizeError(payload.error),
    durationMs,
  };
};
