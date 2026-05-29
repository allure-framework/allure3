import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType, isSyntaxHighlightSupported } from "@allurereport/web-commons";
import { ArrowButton, Attachment, Code, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { TrAttachmentInfo } from "@/components/TestResult/TrSteps/TrAttachmentInfo";
import { useI18n } from "@/stores";
import { openModal } from "@/stores/modal";
import { isTreeOpened, toggleTree } from "@/stores/tree";
import { trOverviewFocusAttrs, trOverviewHeaderFocusClass } from "@/utils/trOverviewFocus";

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
  "application/vnd.allure.http+json": lineFilesFileAttachment2,
};

const HAS_PREVIEW_COMPONENT = new Set(["html", "markdown"]);
const DEFAULT_PREVIEW_TYPES = new Set(["markdown", "html"]);

export const TrAttachment: FunctionComponent<{
  item: AttachmentTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const { link } = item;
  const attachmentTreeId = item.link?.id !== null ? `attachment-${item.link.id}` : null;
  const isOpened = attachmentTreeId !== null ? isTreeOpened(attachmentTreeId, false) : false;
  const componentTypeForPreview = attachmentType(link.contentType);
  const [showPreview, setShowPreview] = useState(() => DEFAULT_PREVIEW_TYPES.has(componentTypeForPreview ?? ""));
  const [highlightCode, setHighlightCode] = useState(true);
  const { t: tAttachments } = useI18n("attachments");
  const { missed } = link;
  const componentType = componentTypeForPreview;
  const isValidComponentType = !["archive", null].includes(componentType);
  const isPreviewable = HAS_PREVIEW_COMPONENT.has(componentType ?? "");
  const isImageAttachment = componentType === "image";
  const isSyntaxHighlightable = isSyntaxHighlightSupported({
    contentType: link.contentType,
    ext: link.ext,
    name: link.name,
    originalFileName: link.originalFileName,
  });
  const supportsSyntaxHighlightToggle =
    isSyntaxHighlightable &&
    (componentType === "code" || componentType === "text" || componentType === "markdown" || componentType === "html");

  const handleHighlightToggle = () => {
    if (isPreviewable && showPreview) {
      setShowPreview(false);
    }
    setHighlightCode((highlight) => !highlight);
  };

  const toggleAttachment = (event: Event) => {
    event.stopPropagation();
    if (attachmentTreeId !== null) {
      toggleTree(attachmentTreeId, false);
    }
  };

  const expandAttachment = (event: Event) => {
    event.stopPropagation();
    openModal({
      data: item,
      component: <Attachment item={item} previewable={true} />,
    });
  };

  const content = (
    <Attachment
      item={item}
      previewable={showPreview}
      highlightCode={highlightCode}
      i18n={{ imageDiff: (key: string) => tAttachments(`imageDiff.${key}`) }}
    />
  );

  const attachmentHeaderContent = (
    <>
      {isValidComponentType ? (
        <ArrowButton isOpened={isOpened} tag="span" />
      ) : (
        <span className={styles["test-result-strut"]} />
      )}
      <span className={styles["test-result-attachment-icon"]}>
        <SvgIcon size="s" id={iconMap[link.contentType] ?? lineFilesFileAttachment2} />
      </span>

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
    </>
  );

  return (
    <div data-testid={"test-result-attachment"} className={styles["test-result-step"]}>
      <div
        data-testid={"test-result-attachment-header"}
        className={cx(styles["test-result-attachment-header"], trOverviewHeaderFocusClass(item.link.id), {
          [styles.empty]: !isValidComponentType,
        })}
        {...trOverviewFocusAttrs(item.link.id)}
      >
        {isValidComponentType ? (
          <button className={styles["test-result-attachment-toggle"]} onClick={toggleAttachment} type="button">
            {attachmentHeaderContent}
          </button>
        ) : (
          attachmentHeaderContent
        )}
        <div>
          <TrAttachmentInfo
            item={item}
            shouldExpand={isValidComponentType}
            isPreviewable={isPreviewable}
            showPreview={showPreview}
            onPreviewToggle={isPreviewable ? () => setShowPreview((p) => !p) : undefined}
            highlightCode={highlightCode}
            onHighlightToggle={supportsSyntaxHighlightToggle ? handleHighlightToggle : undefined}
          />
        </div>
      </div>
      {isOpened && isValidComponentType && (
        <div className={styles["test-result-attachment-content-wrapper"]}>
          {isImageAttachment ? (
            <button className={styles["test-result-attachment-content"]} onClick={expandAttachment} type="button">
              {content}
            </button>
          ) : (
            <div className={styles["test-result-attachment-content"]}>{content}</div>
          )}
        </div>
      )}
    </div>
  );
};
