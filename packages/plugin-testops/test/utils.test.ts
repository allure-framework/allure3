import type { TestStepResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePluginOptions } from "../src/utils/options.js";
import { attachmentsResolverFactory, unwrapStepsAttachments } from "../src/utils/resolvers.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("utils");
  await label("coverage", "testops-integration");
});

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

describe("attachmentsResolverFactory", () => {
  it("does not read attachments from removed step subtrees", async () => {
    const attachmentContentById = vi.fn().mockResolvedValue({
      readContent: vi.fn().mockResolvedValue(Buffer.from("content")),
      getContentLength: vi.fn().mockReturnValue(7),
    });
    const resolver = attachmentsResolverFactory({
      attachmentsByTrId: vi.fn().mockResolvedValue([
        { id: "removed", originalFileName: "removed.txt" },
        { id: "kept", originalFileName: "kept.txt" },
      ]),
      attachmentById: vi.fn().mockResolvedValue(undefined),
      fixturesByTrId: vi.fn().mockResolvedValue([
        {
          name: "fixture",
          steps: [
            { type: "step", name: "bad\u0000step", steps: [{ type: "attachment", link: { id: "removed" } }] },
            { type: "attachment", link: { id: "kept" } },
          ],
        },
      ]),
      attachmentContentById,
    } as any);

    await resolver({
      id: "result",
      steps: [],
    } as any);

    expect(attachmentContentById).toHaveBeenCalledTimes(1);
    expect(attachmentContentById).toHaveBeenCalledWith("kept");
  });

  it("excludes attachments from invalid fixture trees", async () => {
    const attachmentContentById = vi.fn().mockResolvedValue({
      readContent: vi.fn().mockResolvedValue(Buffer.from("content")),
      getContentLength: vi.fn().mockReturnValue(7),
    });
    const resolver = attachmentsResolverFactory({
      attachmentsByTrId: vi.fn().mockResolvedValue([{ id: "invalid", originalFileName: "invalid.txt" }]),
      attachmentById: vi.fn().mockResolvedValue({ id: "invalid", originalFileName: "invalid.txt" }),
      fixturesByTrId: vi.fn().mockResolvedValue([
        {
          name: "bad\u0000fixture",
          steps: [{ type: "attachment", link: { id: "invalid" } }],
        },
      ]),
      attachmentContentById,
    } as any);

    await expect(resolver({ id: "result", steps: [] } as any)).resolves.toEqual([]);
    expect(attachmentContentById).not.toHaveBeenCalled();
  });

  it("retains attachments referenced only by valid fixtures", async () => {
    const attachmentContentById = vi.fn().mockResolvedValue({
      readContent: vi.fn().mockResolvedValue(Buffer.from("content")),
      getContentLength: vi.fn().mockReturnValue(7),
    });
    const resolver = attachmentsResolverFactory({
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      attachmentById: vi.fn().mockResolvedValue({
        id: "fixture-only",
        originalFileName: "fixture.txt",
        contentType: "text/plain",
      }),
      fixturesByTrId: vi.fn().mockResolvedValue([
        {
          name: "setup",
          steps: [{ type: "attachment", link: { id: "fixture-only" } }],
        },
      ]),
      attachmentContentById,
    } as any);

    await expect(resolver({ id: "result", steps: [] } as any)).resolves.toEqual([
      expect.objectContaining({ originalFileName: "fixture.txt" }),
    ]);
    expect(attachmentContentById).toHaveBeenCalledWith("fixture-only");
  });

  it("retains attachments listed directly on test results", async () => {
    const attachmentContentById = vi.fn().mockResolvedValue({
      readContent: vi.fn().mockResolvedValue(Buffer.from("content")),
      getContentLength: vi.fn().mockReturnValue(7),
    });
    const resolver = attachmentsResolverFactory({
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      attachmentById: vi.fn().mockResolvedValue({ id: "result-only", originalFileName: "result.txt" }),
      fixturesByTrId: vi.fn().mockResolvedValue([]),
      attachmentContentById,
    } as any);

    await expect(resolver({ id: "result", steps: [], attachments: [{ id: "result-only" }] } as any)).resolves.toEqual([
      expect.objectContaining({ originalFileName: "result.txt" }),
    ]);
    expect(attachmentContentById).toHaveBeenCalledWith("result-only");
  });
});

describe("resolvePluginOptions", () => {
  beforeEach(() => {
    delete process.env.ALLURE_TOKEN;
    delete process.env.ALLURE_ENDPOINT;
    delete process.env.ALLURE_PROJECT_ID;
    delete process.env.ALLURE_LAUNCH_TAGS;
    delete process.env.ALLURE_LAUNCH_NAME;
    delete process.env.ALLURE_LAUNCH_ID;
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
      });
    });

    it("should take a positive integer launchId from ALLURE_LAUNCH_ID", () => {
      process.env.ALLURE_LAUNCH_ID = "555";

      expect(resolvePluginOptions({} as any).launchId).toBe(555);
    });

    it.each(["0", "-5", "1.5", "abc", ""])("should ignore the invalid launchId %o", (value) => {
      process.env.ALLURE_LAUNCH_ID = value;

      expect(resolvePluginOptions({} as any)).not.toHaveProperty("launchId");
    });

    it("should ignore an invalid launchId passed as an option, not just from env", () => {
      expect(resolvePluginOptions({ launchId: -5 } as any)).not.toHaveProperty("launchId");
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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
        reopenClosedLaunch: false,
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

    it("should not set launchId when not provided", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.launchId).toBeUndefined();
    });

    it("should accept launchId from options", () => {
      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchId: 42,
      } as any);

      expect(result.launchId).toBe(42);
    });

    it("should use ALLURE_LAUNCH_ID as fallback for launchId", () => {
      process.env.ALLURE_LAUNCH_ID = "99";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
      } as any);

      expect(result.launchId).toBe(99);

      delete process.env.ALLURE_LAUNCH_ID;
    });

    it("should prefer launchId from options over ALLURE_LAUNCH_ID", () => {
      process.env.ALLURE_LAUNCH_ID = "99";

      const result = resolvePluginOptions({
        accessToken: "token",
        endpoint: "http://example.com",
        projectId: "12345",
        launchId: 7,
      } as any);

      expect(result.launchId).toBe(7);

      delete process.env.ALLURE_LAUNCH_ID;
    });
  });
});
