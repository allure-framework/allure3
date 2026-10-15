import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { serverOptionsFromConfig } from "../../src/utils/serverOptions.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("server-options");
  await label("coverage", "cli-commands");
});

describe("serverOptionsFromConfig", () => {
  it("parses the port and passes the host through", () => {
    expect(serverOptionsFromConfig({ port: "8080", host: "127.0.0.1" })).toEqual({ port: 8080, host: "127.0.0.1" });
  });

  it("leaves port and host unset when the config has none", () => {
    expect(serverOptionsFromConfig({ port: undefined, host: undefined })).toEqual({
      port: undefined,
      host: undefined,
    });
  });
});
