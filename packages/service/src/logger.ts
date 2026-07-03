import { createLogger } from "@allurereport/logger";

export const log = createLogger({
  name: "service",
  redact: [
    "password",
    "secret",
    "authorization",
    "accessToken",
    "apiToken",
    "*.token",
    "*.password",
    "*.secret",
    "*.authorization",
    "*.Authorization",
    "*.Cookie",
    "*.cookie",
  ],
});
