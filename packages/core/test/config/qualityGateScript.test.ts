import type { QualityGateRule } from "@allurereport/plugin-api";
import { describe, expect, it } from "vite-plus/test";

import { compileQualityGateScript } from "../../src/config/qualityGateScript.js";

const payload = (): Parameters<QualityGateRule["validate"]>[0] => ({
  expected: 2,
  trs: [],
  state: { getResult: () => 1, setResult: () => {} },
  metrics: [],
  previousHistory: [],
  environment: "qa",
});

describe("inline quality-gate JavaScript", () => {
  it("executes an async body with the existing validator arguments and state", async () => {
    let saved: unknown;
    const input = payload();
    input.state.setResult = (value) => {
      saved = value;
    };
    const validate = compileQualityGateScript(
      `
      const actual = await Promise.resolve(state.getResult() + expected);
      state.setResult(actual, []);
      return { success: trs.length === 0 && metrics.length === 0 && previousHistory.length === 0 && environment === 'qa', actual, testResults: ['earlier'] };
    `,
      "qualityGate.use[0].validate",
    );

    const result = await validate(input);

    expect(saved).toBe(3);
    expect(result).toEqual({ success: true, actual: 3, testResults: ["earlier"] });
  });

  it("reports script syntax errors at configuration resolution", () => {
    const compile = () => compileQualityGateScript("return {", "qualityGate.use[2].validate");

    expect(compile).toThrow("qualityGate.use[2].validate");
  });

  it("includes the configuration path and original cause in runtime failures", async () => {
    const validate = compileQualityGateScript("throw new Error('bad validator')", "qualityGate.use[1].validate");

    const result = validate(payload());

    await expect(result).rejects.toMatchObject({
      message: "Invalid JavaScript at qualityGate.use[1].validate: bad validator",
      cause: expect.objectContaining({ message: "bad validator" }),
    });
  });

  it.each([
    "return null",
    "return { success: 1, actual: 0, testResults: [] }",
    "return { success: true, testResults: [] }",
    "return { success: true, actual: 0, testResults: [1] }",
    "return { success: true, actual: Infinity, testResults: [] }",
    "const actual = {}; actual.self = actual; return { success: true, actual, testResults: [] }",
  ])("rejects malformed or non-reportable results: %s", async (source) => {
    const validate = compileQualityGateScript(source, "qualityGate.use[0].validate");

    const result = validate(payload());

    await expect(result).rejects.toThrow("qualityGate.use[0].validate");
  });
});
