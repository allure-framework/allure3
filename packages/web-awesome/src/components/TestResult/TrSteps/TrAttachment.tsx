import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType, isPreviewableContentType, isSyntaxHighlightSupported } from "@allurereport/web-commons";
import { ArrowButton, Attachment, Code, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { TrAttachmentInfo } from "@/components/TestResult/TrSteps/TrAttachmentInfo";
import { useI18n } from "@/stores";
import { openModal } from "@/stores/modal";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

const { lineImagesImage, lineFilesFileAttachment2, playwrightLogo } = allureIcons;

const iconMap: Record<string, string> = {
  "text/plain": lineFilesFileAttachment2,
  "application/xml": lineFilesFileAttachment2,
  "text/html": lineFilesFileAttachment2,
  "text/csv": lineFilesFileAttachment2,
  "text/markdown": lineFilesFileAttachment2,
  "text/javascript": lineFilesFileAttachment2,
  "text/typescript": lineFilesFileAttachment2,
  "text/ruby": lineFilesFileAttachment2,
  "text/python": lineFilesFileAttachment2,
  "text/php": lineFilesFileAttachment2,
  "text/java": lineFilesFileAttachment2,
  "text/csharp": lineFilesFileAttachment2,
  "text/cpp": lineFilesFileAttachment2,
  "text/c": lineFilesFileAttachment2,
  "text/go": lineFilesFileAttachment2,
  "text/rust": lineFilesFileAttachment2,
  "text/swift": lineFilesFileAttachment2,
  "text/kotlin": lineFilesFileAttachment2,
  "text/scala": lineFilesFileAttachment2,
  "text/perl": lineFilesFileAttachment2,
  "text/r": lineFilesFileAttachment2,
  "text/dart": lineFilesFileAttachment2,
  "text/lua": lineFilesFileAttachment2,
  "text/haskell": lineFilesFileAttachment2,
  "text/sql": lineFilesFileAttachment2,
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
  "application/vnd.allure.playwright-trace": playwrightLogo,
};

const HAS_PREVIEW_COMPONENT = new Set(["html"]);

export const TrAttachment: FunctionComponent<{
  item: AttachmentTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const attachmentTreeId = item.link?.id !== null ? `attachment-${item.link.id}` : null;
  const isOpened = !collapsedTrees.value.has(attachmentTreeId);
  const [showPreview, setShowPreview] = useState(false);
  const [highlightCode, setHighlightCode] = useState(true);
  const { t: tAttachments } = useI18n("attachments");
  const { link } = item;
  const { missed } = link;
  const componentType = attachmentType(link.contentType);
  const isValidComponentType = !["archive", null].includes(componentType);
  const isPreviewable = HAS_PREVIEW_COMPONENT.has(componentType ?? "");
  const isCodeView = (componentType === "code" || componentType === "text") && (!isPreviewable || !showPreview);
  const isSyntaxHighlightable = isSyntaxHighlightSupported({
    contentType: link.contentType,
    ext: link.ext,
    name: link.name,
    originalFileName: link.originalFileName,
  });

  const expandAttachment = (event: Event) => {
    event.stopPropagation();
    if (componentType !== "image") {
      return;
    }
    openModal({
      data: item,
      component: <Attachment item={item} previewable={true} />,
    });
  };

  return (
    <div data-testid={"test-result-attachment"} className={styles["test-result-step"]}>
      <div
        data-testid={"test-result-attachment-header"}
        className={cx(styles["test-result-attachment-header"], {
          [styles.empty]: !isValidComponentType,
        })}
        onClick={(e) => {
          e.stopPropagation();
          if (attachmentTreeId !== null) {
            toggleTree(attachmentTreeId);
          }
        }}
      >
        {isValidComponentType ? <ArrowButton isOpened={isOpened} /> : <div className={styles["test-result-strut"]} />}
        <div className={styles["test-result-attachment-icon"]}>
          <SvgIcon size="s" id={iconMap[link.contentType] ?? lineFilesFileAttachment2} />
        </div>

        <Code size="s" className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>
        <Text className={styles["test-result-attachment-text"]}>{link.name || link.originalFileName}</Text>
        {missed && (
          <Text
            size={"s"}
            className={styles["test-result-attachment-missed"]}
            data-testid={"test-result-attachment-missed"}
          >
            missed
          </Text>
        )}
        <div>
          <TrAttachmentInfo
            item={item}
            shouldExpand={isValidComponentType}
            isPreviewable={isPreviewable}
            showPreview={showPreview}
            onPreviewToggle={isPreviewable ? () => setShowPreview((p) => !p) : undefined}
            isCodeView={isCodeView && isSyntaxHighlightable}
            highlightCode={highlightCode}
            onHighlightToggle={isCodeView && isSyntaxHighlightable ? () => setHighlightCode((h) => !h) : undefined}
          />
        </div>
      </div>
      {isOpened && isValidComponentType && (
        <div className={styles["test-result-attachment-content-wrapper"]}>
          <div className={styles["test-result-attachment-content"]} role={"button"} onClick={expandAttachment}>
            <Attachment
              item={item}
              previewable={showPreview}
              highlightCode={highlightCode}
              i18n={{ imageDiff: (key: string) => tAttachments(`imageDiff.${key}`) }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
