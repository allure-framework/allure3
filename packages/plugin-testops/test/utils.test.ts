import type { TestStepResult } from "@allurereport/core-api";
import { beforeEach, describe, expect, it } from "vitest";
import { resolvePluginOptions, unwrapStepsAttachments } from "../src/utils.js";

describe("unwrapStepsAttachments", () => {
  it("should return empty array when given empty array", () => {
    const result = unwrapStepsAttachments([]);

    expect(result).toEqual([]);
  });

  it("should return steps unchanged when they don't have attachments", () => {
    const steps = [
      {
        name: "step 1",
        parameters: [],
        status: "passed",
        steps: [],
      } as unknown as TestStepResult,
      {
        name: "step 2",
        parameters: [],
        status: "failed",
        steps: [],
      } as unknown as TestStepResult,
    ];

    expect(unwrapStepsAttachments(steps)).toEqual(steps);
  });

  it("should transform attachment step by adding attachment field from link", () => {
    const link = {
      id: "attachment-1",
      originalFileName: "screenshot.png",
      contentType: "image/png",
    };
    const steps: TestStepResult[] = [
      {
        type: "attachment",
        link,
      } as unknown as TestStepResult,
    ];

    expect(unwrapStepsAttachments(steps)).toEqual([
      {
        type: "attachment",
        link,
        attachment: link,
      },
    ]);
  });

  it("should recursively process nested steps", () => {
    const link = {
      id: "nested-attachment",
      originalFileName: "nested.txt",
      contentType: "text/plain",
    };
    const steps = [
      {
        name: "parent step",
        parameters: [],
        status: "passed",
        steps: [
          {
            name: "child step",
            parameters: [],
            status: "passed",
            steps: [],
          } as unknown as TestStepResult,
          {
            type: "attachment",
            link,
          } as unknown as TestStepResult,
        ],
      } as unknown as TestStepResult,
    ];

    const result = unwrapStepsAttachments(steps);

    expect(result[0]).toHaveProperty("steps");

    const parentStep = result[0] as any;

    expect(parentStep.steps).toHaveLength(2);
    expect(parentStep.steps[1]).toHaveProperty("attachment", link);
  });
});

describe("resolvePluginOptions", () => {
  beforeEach(() => {
    delete process.env.ALLURE_TESTOPS_ACCESS_TOKEN;
    delete process.env.ALLURE_TESTOPS_ENDPOINT;
    delete process.env.ALLURE_TESTOPS_PROJECT_ID;
  });

  describe("validation", () => {
    it("should throw an error if accessToken is not provided", () => {
      expect(() =>
        resolvePluginOptions({
          endpoint: "http://example.com",
          projectId: "12345",
        } as any),
      ).toThrow("Allure3 TestOps plugin: accessToken is required");
    });

    it("should throw an error if endpoint is not provided", () => {
      expect(() =>
        resolvePluginOptions({
          accessToken: "token",
          projectId: "12345",
        } as any),
      ).toThrow("Allure3 TestOps plugin: endpoint is required");
    });

    it("should throw an error if projectId is not provided", () => {
      expect(() =>
        resolvePluginOptions({
          accessToken: "token",
          endpoint: "http://example.com",
        } as any),
      ).toThrow("Allure3 TestOps plugin: projectId is required");
    });
  });

  describe("options resolution", () => {
    it("should return options when all required fields are provided", () => {
      const options = {
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      };

      const result = resolvePluginOptions(options);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      });
    });

    it("should use environment variable as fallback for accessToken", () => {
      process.env.ALLURE_TESTOPS_ACCESS_TOKEN = "env-token";

      const result = resolvePluginOptions({
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://example.com",
        projectId: "12345",
      });
    });

    it("should use environment variable as fallback for endpoint", () => {
      process.env.ALLURE_TESTOPS_ENDPOINT = "http://env.example.com";

      const result = resolvePluginOptions({
        accessToken: "token",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://env.example.com",
        projectId: "12345",
      });
    });

    it("should use environment variable as fallback for projectId", () => {
      process.env.ALLURE_TESTOPS_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "env-project",
      });
    });

    it("should use all environment variables when no options are provided", () => {
      process.env.ALLURE_TESTOPS_ACCESS_TOKEN = "env-token";
      process.env.ALLURE_TESTOPS_ENDPOINT = "http://env.example.com";
      process.env.ALLURE_TESTOPS_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({} as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://env.example.com",
        projectId: "env-project",
      });
    });

    it("should prefer options over environment variables", () => {
      process.env.ALLURE_TESTOPS_ACCESS_TOKEN = "env-token";
      process.env.ALLURE_TESTOPS_ENDPOINT = "http://env.example.com";
      process.env.ALLURE_TESTOPS_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        accessToken: "option-token",
        endpoint: "http://option.example.com",
        projectId: "option-project",
      });

      expect(result).toEqual({
        accessToken: "option-token",
        endpoint: "http://option.example.com",
        projectId: "option-project",
      });
    });

    it("should merge options and environment variables", () => {
      process.env.ALLURE_TESTOPS_ACCESS_TOKEN = "env-token";
      process.env.ALLURE_TESTOPS_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        endpoint: "http://option.example.com",
      } as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://option.example.com",
        projectId: "env-project",
      });
    });
  });
});
