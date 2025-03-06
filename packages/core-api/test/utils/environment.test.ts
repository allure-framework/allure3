import { describe, expect, it } from "vitest";
import type { EnvironmentsConfig } from "../../src/index.js";
import type { TestResult } from "../../src/model.js";
import { matchEnvironment } from "../../src/utils/environment.js";

const fixtures = {
  envConfig: {
    foo: {
      variables: {
        foo: "bar",
      },
      matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "foo" && value === "bar"),
    },
  } as EnvironmentsConfig,
};

describe("matchEnvironment", () => {
  it("should return matched environment", () => {
    const result = matchEnvironment(fixtures.envConfig, {
      labels: [
        {
          name: "foo",
          value: "bar",
        },
      ],
    } as TestResult);

    expect(result).toEqual(Object.keys(fixtures.envConfig)[0]);
  });

  it("should return default when no environment is matched", () => {
    const result = matchEnvironment(fixtures.envConfig, {
      labels: [
        {
          name: "foo",
          value: "baz",
        },
      ],
    } as TestResult);

    expect(result).toEqual("default");
  });
});
