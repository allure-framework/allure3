import TestOpsPlugin from "@allurereport/core/testops";
import { expect, it } from "vite-plus/test";

import LegacyTestOpsPlugin, { type TestOpsUploaderPluginOptions } from "../src/index.js";

it("forwards the legacy default export and options to the core plugin", () => {
  const options: TestOpsUploaderPluginOptions = {
    accessToken: "test-token",
    endpoint: "https://example.com",
    projectId: "1",
    launchName: "Compatibility launch",
    launchTags: [],
  };

  expect(LegacyTestOpsPlugin).toBe(TestOpsPlugin);
  const plugin = new LegacyTestOpsPlugin(options, { enabled: false });
  expect(plugin.options).toBe(options);
  expect(plugin.enabled).toBe(false);
});
