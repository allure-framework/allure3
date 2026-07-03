# @allurereport/logger

Zero-dependency structured logger for Allure.

## Usage

```ts
import { createLogger, consoleTransport, fileTransport } from "@allurereport/logger";

const log = createLogger({
  name: "allure",
  level: "info",
  redact: ["password", "req.headers.authorization", "*.token"],
  transports: [consoleTransport({ pretty: true }), fileTransport({ path: "/tmp/app.log" })],
});

log.info("started");
log.info({ userId: 1 }, "user logged in");

const child = log.child({ component: "upload" });
child.trace("starting chunk upload");
```

## Levels

`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`.

Environment resolution: `level` option → `LOG_LEVEL` → `ALLURE_LOG_LEVEL` → `debug` when `NODE_ENV=development` → `info`.

`verbose` in env vars is accepted as a deprecated alias for `trace`.

## Redaction

Path patterns:

| Pattern | Matches |
| --- | --- |
| `password` | top-level `password` |
| `req.headers.authorization` | nested path |
| `*.token` | any object key named `token` at any depth |

## Performance

Use `isLevelEnabled` before building expensive log payloads:

```ts
if (log.isLevelEnabled("debug")) {
  log.debug({ payload: buildHugePayload() }, "details");
}
```

## File transport shutdown

Call `close()` before process exit to flush buffered NDJSON lines:

```ts
const file = fileTransport({ path: "/tmp/app.log" });

createLogger({ transports: [file] }).info("done");

await file.close();
```
