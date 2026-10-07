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

export const pushgatewayUrl = ({ url, job = "allure", grouping = {} }: PrometheusPushgatewayOptions): string => {
  const segments = [["job", job], ...Object.entries(grouping)]
    .map(([key, value]) => `${encodeURIComponent(key)}/${encodeURIComponent(value)}`)
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
    const params = new URLSearchParams({ bucket, precision: "ns" });

    if (org) {
      params.set("org", org);
    }

    return `${base}/api/v2/write?${params}`;
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
  const target = influxDbWriteUrl(options);
  const response = await doFetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body,
    signal: AbortSignal.timeout(timeout),
  });

  await ensureOk(response, target);
};
