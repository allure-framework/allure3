import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { AttachmentData } from "@allurereport/web-commons";
import type { ComponentProps } from "preact";
import type { ImageDiff } from "../ImageDiff";

export type AttachmentProps = {
  attachment: AttachmentData | null;
  item: AttachmentTestStepResult;
  i18n?: (key: any) => string;
};

export type I18nProp = {
  imageDiff: ComponentProps<typeof ImageDiff>["i18n"];
};
