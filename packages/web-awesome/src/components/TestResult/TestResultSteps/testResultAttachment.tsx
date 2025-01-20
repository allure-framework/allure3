import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { Code, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import { ArrowButton } from "@/components/ArrowButton";
import { Attachment } from "@/components/TestResult/TestResultSteps/attachment";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachmentInfo } from "@/components/TestResult/TestResultSteps/testResultAttachmentInfo";
import { attachmentType } from "@/utils/attachments";

const { lineImagesImage, lineFilesFileAttachment2 } = allureIcons;

const iconMap: Record<string, string> = {
  "text/plain": lineFilesFileAttachment2,
  "application/xml": lineFilesFileAttachment2,
  "text/html": lineFilesFileAttachment2,
  "text/csv": lineFilesFileAttachment2,
  "text/tab-separated-values": lineFilesFileAttachment2,
  "text/css": lineFilesFileAttachment2,
  "text/uri-list": lineFilesFileAttachment2,
  "image/svg+xml": lineImagesImage,
  "image/png": lineImagesImage,
  "application/json": lineFilesFileAttachment2,
  "application/zip": lineFilesFileAttachment2,
  "video/webm": lineImagesImage,
  "image/jpeg": lineImagesImage,
  "video/mp4": lineImagesImage,
  "application/vnd.allure.image.diff": lineImagesImage,
};

export const TestResultAttachment: FunctionComponent<{
  item: AttachmentTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const [isOpened, setIsOpen] = useState(false);
  const { link } = item;
  const { missed } = link;
  const componentType = attachmentType(link.contentType);
  const isValidComponentType = !["archive", null].includes(componentType.type as string);

  return (
    <div className={styles["test-result-step"]}>
      <div
        className={styles["test-result-attachment-header"]}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
      >
        <ArrowButton isOpened={isOpened} />
        <div className={styles["test-result-attachment-icon"]}>
          <SvgIcon size="s" id={iconMap[link.contentType] ?? lineFilesFileAttachment2} />
        </div>

        <Code size="s" className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>

        <Text className={styles["test-result-attachment-text"]}>{link.name || link.originalFileName}</Text>
        {missed && (
          <Text size={"s"} className={styles["test-result-attachment-missed"]}>
            missed
          </Text>
        )}
        <TestResultAttachmentInfo item={item} shouldExpand={isValidComponentType} />
      </div>
      {isOpened && isValidComponentType && (
        <div className={styles["test-result-attachment-content-wrapper"]}>
          <div className={styles["test-result-attachment-content"]}>
            <Attachment item={item} />
          </div>
        </div>
      )}
    </div>
  );
};
