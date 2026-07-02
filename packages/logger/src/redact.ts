/** Pre-parsed redaction rule used to mask sensitive fields in log records. */
export type RedactPath =
  | { kind: "top"; key: string }
  | { kind: "nested"; segments: string[] }
  | { kind: "wildcard"; key: string };

/**
 * Compiles user-facing redact path strings into executable redaction rules.
 *
 * Supported patterns:
 * - `password` — top-level key
 * - `req.headers.authorization` — nested path
 * - `*.token` — any object key named `token` at any depth
 *
 * @param paths - Redact path patterns from logger configuration.
 */
export const compileRedactPaths = (paths: string[]): RedactPath[] => {
  return paths.map((path) => {
    if (path.startsWith("*.")) {
      return { kind: "wildcard", key: path.slice(2) };
    }

    if (!path.includes(".")) {
      return { kind: "top", key: path };
    }

    return { kind: "nested", segments: path.split(".") };
  });
};

const REDACTED = "[Redacted]";

const cloneRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  try {
    return structuredClone(record);
  } catch {
    try {
      return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
    } catch {
      return { ...record };
    }
  }
};

const redactNested = (value: unknown, segments: string[], depth: number): void => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  const record = value as Record<string, unknown>;
  const segment = segments[depth];

  if (depth === segments.length - 1) {
    if (segment in record) {
      record[segment] = REDACTED;
    }

    return;
  }

  if (segment in record) {
    redactNested(record[segment], segments, depth + 1);
  }
};

const redactWildcard = (value: unknown, key: string): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      redactWildcard(item, key);
    }

    return;
  }

  const record = value as Record<string, unknown>;

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (entryKey === key) {
      record[entryKey] = REDACTED;
    }

    redactWildcard(entryValue, key);
  }
};

/**
 * Returns a deep copy of `record` with configured redaction rules applied.
 *
 * The input record and any shared nested references are not mutated.
 *
 * @param record - Structured log payload before serialization.
 * @param paths - Compiled redaction rules.
 */
export const applyRedaction = (record: Record<string, unknown>, paths: RedactPath[]): Record<string, unknown> => {
  if (paths.length === 0) {
    return record;
  }

  const copy = cloneRecord(record);

  for (const path of paths) {
    if (path.kind === "top") {
      if (path.key in copy) {
        copy[path.key] = REDACTED;
      }

      continue;
    }

    if (path.kind === "nested") {
      redactNested(copy, path.segments, 0);
      continue;
    }

    redactWildcard(copy, path.key);
  }

  return copy;
};
