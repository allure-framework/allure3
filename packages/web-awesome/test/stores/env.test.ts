import { expect, it } from "vitest";

import { testEnvGroupId } from "../../src/stores/env.js";

it("builds environment-neutral group ids from canonical components", () => {
  expect(
    testEnvGroupId({
      testCaseHash: "test-case-hash",
      parametersHash: "parameters-hash",
    }),
  ).toBe("test-case-hash.parameters-hash");
  expect(
    testEnvGroupId({
      testCaseHash: null,
      parametersHash: "parameters-hash",
    }),
  ).toBeNull();
});
