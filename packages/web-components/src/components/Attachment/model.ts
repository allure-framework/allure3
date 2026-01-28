import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { AttachmentData } from "@allurereport/web-commons";

export type AttachmentProps = {
    attachment: AttachmentData | null;
    item: AttachmentTestStepResult;
};
