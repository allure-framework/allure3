import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType } from "@allurereport/web-commons";
import { Attachment, Code, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { ArrowButton } from "@/components/ArrowButton";
import { hasAttachmentPreview } from "@/components/TestResult/TestResultSteps/attachmentPreview";
import { TestResultAttachmentInfo } from "@/components/TestResult/TestResultSteps/testResultAttachmentInfo";
import { useAttachmentI18n } from "@/components/TestResult/TestResultSteps/useAttachmentI18n";
import { useI18n } from "@/stores/locale";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

const { lineImagesImage, lineFilesFileAttachment2 } = allureIcons;

const imageAttachmentTypes = new Set(["image", "svg", "video", "image-diff"]);

export const TestResultAttachment: FunctionComponent<{
  item: AttachmentTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const [isOpened, setIsOpen] = useState(false);
  const { link } = item;
  const { missed } = link;
  const componentType = attachmentType(link.contentType);
  const isValidComponentType = !["archive", null].includes(componentType);
  const isPreviewable = hasAttachmentPreview(link.contentType);
  const [showPreview, setShowPreview] = useState(isPreviewable);
  const i18n = useAttachmentI18n();
  const { t: errors } = useI18n("errors");

  return (
    <div data-testid="test-result-attachment" className={styles["test-result-step"]}>
      <div
        data-testid="test-result-attachment-header"
        className={styles["test-result-attachment-header"]}
        onClick={(e) => {
          e.stopPropagation();
          if (isValidComponentType) {
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {isValidComponentType ? <ArrowButton isOpened={isOpened} /> : <div className={styles["test-result-strut"]} />}
        <div className={styles["test-result-attachment-icon"]}>
          <SvgIcon
            size="s"
            id={
              componentType !== null && imageAttachmentTypes.has(componentType)
                ? lineImagesImage
                : lineFilesFileAttachment2
            }
          />
        </div>

        <Code size="s" className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>

        <Text className={styles["test-result-attachment-text"]}>{link.name || link.originalFileName}</Text>
        {missed && (
          <Text size={"s"} className={styles["test-result-attachment-missed"]}>
            {errors("missedAttachment")}
          </Text>
        )}
        <TestResultAttachmentInfo
          item={item}
          shouldExpand={isValidComponentType}
          isPreviewable={isPreviewable}
          showPreview={showPreview}
          onPreviewToggle={() => setShowPreview((preview) => !preview)}
        />
      </div>
      {isOpened && isValidComponentType && (
        <div className={styles["test-result-attachment-content-wrapper"]}>
          <div data-testid="test-result-attachment-content" className={styles["test-result-attachment-content"]}>
            <Attachment item={item} previewable={showPreview} i18n={i18n} />
          </div>
        </div>
      )}
    </div>
  );
};
