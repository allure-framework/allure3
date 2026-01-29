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
    delete process.env.ALLURE_TOKEN;
    delete process.env.ALLURE_ENDPOINT;
    delete process.env.ALLURE_PROJECT_ID;
    delete process.env.ALLURE_LAUNCH_TAGS;
    delete process.env.ALLURE_LAUNCH_NAME;
  });

  describe("validation", () => {
    it("should return empty string for accessToken when not provided", () => {
      const result = resolvePluginOptions({
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.accessToken).toBe("");
    });

    it("should return empty string for endpoint when not provided", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        projectId: "12345",
      } as any);

      expect(result.endpoint).toBe("");
    });

    it("should return empty string for projectId when not provided", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
      } as any);

      expect(result.projectId).toBe("");
    });
  });

  describe("options resolution", () => {
    it("should return options when all required fields are provided", () => {
      const options = {
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "",
        launchTags: [],
      };
      const result = resolvePluginOptions(options);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should use environment variable as fallback for accessToken", () => {
      process.env.ALLURE_TOKEN = "env-token";

      const result = resolvePluginOptions({
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should use environment variable as fallback for endpoint", () => {
      process.env.ALLURE_ENDPOINT = "http://env.example.com";

      const result = resolvePluginOptions({
        accessToken: "token",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://env.example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should use environment variable as fallback for projectId", () => {
      process.env.ALLURE_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "env-project",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should use all environment variables when no options are provided", () => {
      process.env.ALLURE_TOKEN = "env-token";
      process.env.ALLURE_ENDPOINT = "http://env.example.com";
      process.env.ALLURE_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({} as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://env.example.com",
        projectId: "env-project",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should prefer options over environment variables", () => {
      process.env.ALLURE_TOKEN = "env-token";
      process.env.ALLURE_ENDPOINT = "http://env.example.com";
      process.env.ALLURE_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        accessToken: "option-token",
        endpoint: "http://option.example.com",
        projectId: "option-project",
        launchName: "",
        launchTags: [],
      });

      expect(result).toEqual({
        accessToken: "option-token",
        endpoint: "http://option.example.com",
        projectId: "option-project",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should merge options and environment variables", () => {
      process.env.ALLURE_TOKEN = "env-token";
      process.env.ALLURE_PROJECT_ID = "env-project";

      const result = resolvePluginOptions({
        endpoint: "http://option.example.com",
      } as any);

      expect(result).toEqual({
        accessToken: "env-token",
        endpoint: "http://option.example.com",
        projectId: "env-project",
        launchName: "Allure Report",
        launchTags: [],
      });
    });

    it("should use environment variable as fallback for launchName", () => {
      process.env.ALLURE_LAUNCH_NAME = "Environment Launch";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Environment Launch",
        launchTags: [],
      });
    });

    it("should use environment variable as fallback for launchTags", () => {
      process.env.ALLURE_LAUNCH_TAGS = "tag1,tag2,tag3";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: ["tag1", "tag2", "tag3"],
      });
    });

    it("should trim whitespace from tags when parsing comma-separated string", () => {
      process.env.ALLURE_LAUNCH_TAGS = "tag1 , tag2 ,  tag3";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.launchTags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should accept launchTags as array in options", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchTags: ["tag1", "tag2"],
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: ["tag1", "tag2"],
      });
    });

    it("should accept launchTags as comma-separated string in options", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchTags: "tag1,tag2,tag3",
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Allure Report",
        launchTags: ["tag1", "tag2", "tag3"],
      });
    });

    it("should prefer options over environment variables for launchName and launchTags", () => {
      process.env.ALLURE_LAUNCH_NAME = "Environment Launch";
      process.env.ALLURE_LAUNCH_TAGS = "env-tag1,env-tag2";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Option Launch",
        launchTags: ["option-tag1", "option-tag2"],
      } as any);

      expect(result).toEqual({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchName: "Option Launch",
        launchTags: ["option-tag1", "option-tag2"],
      });
    });

    it("should return default launchName when not provided", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.launchName).toBe("Allure Report");
    });

    it("should return empty array for launchTags when not provided", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.launchTags).toEqual([]);
    });
  });
});
