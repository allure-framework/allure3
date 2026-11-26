import type { AttachmentLink, TestResult } from "@allurereport/core-api";
import type { UploadCategoryGrouping, UploadRateLimit } from "@allurereport/service/testops";

export type TestResultWithCategories = Pick<
  TestResult,
  "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment"
> &
  Partial<Pick<TestResult, "id" | "name" | "testCase" | "fullName" | "parameters" | "sourceMetadata">> & {
    historyId?: string;
    categories?: {
      id?: string;
      name: string;
      grouping?: UploadCategoryGrouping[];
      hide?: boolean;
      expand?: boolean;
    }[];
  };

export type TestOpsUploaderOptions = {
  endpoint: string;
  accessToken: string;
  projectId: string;
  launchName: string;
  launchTags: string[];
  autocloseLaunch?: boolean;
  reopenClosedLaunch?: boolean;
  launchId?: number;
  /** When false, Git Flow metadata is never collected or sent. Default: false */
  gitFlow?: boolean;
  /** First-parent ancestor limit (server N). Default: 100 */
  ancestorLimit?: number;
  filter?: (testResult: TestResult) => boolean;
  limit?: number;
  uploadRateLimit?: UploadRateLimit | false;
};

export type TestOpsPluginOptions = TestOpsUploaderOptions;

export interface TestResultWithAttachments extends TestResult {
  attachments: AttachmentLink[];
}
