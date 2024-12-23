import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { SvgIcon } from "@allurereport/web-components";
import { Code, Text } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import LineFilesFileAttachment from "@/assets/svg/line-files-file-attachment-2.svg";
import LineImagesImage from "@/assets/svg/line-images-image.svg";
import { ArrowButton } from "@/components/ArrowButton";
import { Attachment } from "@/components/TestResult/TestResultSteps/attachment";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachmentInfo } from "@/components/TestResult/TestResultSteps/testResultAttachmentInfo";
import { attachmentType } from "@/utils/attachments";

const iconMap = {
  "text/plain": LineFilesFileAttachment.id,
  "application/xml": LineFilesFileAttachment.id,
  "text/html": LineFilesFileAttachment.id,
  "text/csv": LineFilesFileAttachment.id,
  "text/tab-separated-values": LineFilesFileAttachment.id,
  "text/css": LineFilesFileAttachment.id,
  "text/uri-list": LineFilesFileAttachment.id,
  "image/svg+xml": LineImagesImage.id,
  "image/png": LineImagesImage.id,
  "application/json": LineFilesFileAttachment.id,
  "application/zip": LineFilesFileAttachment.id,
  "video/webm": LineImagesImage.id,
  "image/jpeg": LineImagesImage.id,
  "video/mp4": LineImagesImage.id,
  "application/vnd.allure.image.diff": LineImagesImage.id,
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
        <ArrowButton isOpened={isOpened} icon={arrowsChevronDown.id} />
        <div className={styles["test-result-attachment-icon"]}>
          <SvgIcon size="s" id={iconMap[link.contentType] || LineFilesFileAttachment.id} />
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
