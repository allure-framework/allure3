import type { InfluxDbPushOptions, PrometheusPushgatewayOptions } from "./model.js";
import { redactUrl } from "./utils.js";

type Fetch = typeof fetch;

export const DEFAULT_PUSH_TIMEOUT = 10_000;

const ensureOk = async (response: Response, target: string): Promise<void> => {
  if (response.ok) {
    return;
  }

  const details = await response.text().catch(() => "");

  throw new Error(
    `Failed to push metrics to ${redactUrl(target)}: ${response.status} ${response.statusText} ${details}`.trim(),
  );
};

// Pushgateway treats even an encoded slash as a path separator, so such values (and empty ones) have to use
// the `<label>@base64/<url-safe base64 without padding>` form. A single `=` stands for an empty value.
const groupingSegment = (label: string, value: string): string => {
  if (value === "" || value.includes("/")) {
    return `${encodeURIComponent(label)}@base64/${value === "" ? "=" : Buffer.from(value).toString("base64url")}`;
  }

  return `${encodeURIComponent(label)}/${encodeURIComponent(value)}`;
};

export const pushgatewayUrl = ({ url, job = "allure", grouping = {} }: PrometheusPushgatewayOptions): string => {
  const segments = [["job", job], ...Object.entries(grouping)]
    .map(([label, value]) => groupingSegment(label, value))
    .join("/");

  return `${url.replace(/\/+$/, "")}/metrics/${segments}`;
};

export const pushToPushgateway = async (
  options: PrometheusPushgatewayOptions,
  body: string,
  env: NodeJS.ProcessEnv = process.env,
  doFetch: Fetch = fetch,
  timeout: number = DEFAULT_PUSH_TIMEOUT,
): Promise<void> => {
  const authorization = options.authorization ?? (options.authorizationEnv ? env[options.authorizationEnv] : undefined);
  const target = pushgatewayUrl(options);
  // PUT replaces the whole group, so stale series from previous runs do not stay in the Pushgateway
  const response = await doFetch(target, {
    method: "PUT",
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body,
    signal: AbortSignal.timeout(timeout),
  });

  await ensureOk(response, target);
};

export const influxDbWriteUrl = ({ url, org, bucket, db }: InfluxDbPushOptions): string => {
  const base = url.replace(/\/+$/, "");

  if (bucket) {
    // InfluxDB 2.x rejects a write without an organization (name or id)
    if (!org) {
      throw new Error("InfluxDB 2.x push requires the `org` option together with `bucket`");
    }

    return `${base}/api/v2/write?${new URLSearchParams({ bucket, org, precision: "ns" })}`;
  }

  if (db) {
    return `${base}/write?${new URLSearchParams({ db, precision: "ns" })}`;
  }

  throw new Error("InfluxDB push requires either `bucket` (InfluxDB 2.x) or `db` (InfluxDB 1.x) option");
};

export const pushToInfluxDb = async (
  options: InfluxDbPushOptions,
  body: string,
  env: NodeJS.ProcessEnv = process.env,
  doFetch: Fetch = fetch,
  timeout: number = DEFAULT_PUSH_TIMEOUT,
): Promise<void> => {
  const token = options.token ?? (options.tokenEnv ? env[options.tokenEnv] : undefined);
  const password = options.password ?? (options.passwordEnv ? env[options.passwordEnv] : undefined);
  const target = influxDbWriteUrl(options);
  // `Token` is the InfluxDB 2.x scheme, authenticated 1.x instances expect Basic auth
  const authorization = token
    ? `Token ${token}`
    : options.username
      ? `Basic ${Buffer.from(`${options.username}:${password ?? ""}`).toString("base64")}`
      : undefined;
  const response = await doFetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body,
    signal: AbortSignal.timeout(timeout),
  });

  await ensureOk(response, target);
};
