import type { AttachmentLink, TestResult } from "@allurereport/core-api";
import type { TestOpsUploadOptions, UploadCategoryGrouping } from "@allurereport/service/testops";

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

export type TestOpsUploaderOptions = TestOpsUploadOptions;
export type TestOpsPluginOptions = TestOpsUploaderOptions;

export interface TestResultWithAttachments extends TestResult {
  attachments: AttachmentLink[];
}
