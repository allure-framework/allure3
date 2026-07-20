import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { MarkdownPreview, Spinner } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";

import { modalData } from "@/components/Modal";
import { AttachmentCode } from "@/components/TestResult/TestResultSteps/attachmentCode";
import { AttachmentImage } from "@/components/TestResult/TestResultSteps/attachmentImage";
import { AttachmentVideo } from "@/components/TestResult/TestResultSteps/attachmentVideo";
import { HtmlAttachmentPreview } from "@/components/TestResult/TestResultSteps/HtmlAttachmentPreview";
import { EmptyComponent } from "@/components/TestResult/TestResultSteps/wrongAttachment";
import { type Attachments, attachmentType, fetchAttachment } from "@/utils/attachments";

import * as styles from "./styles.scss";

const componentsByAttachmentType: Record<string, any> = {
  image: AttachmentImage,
  svg: AttachmentImage,
  json: AttachmentCode,
  code: AttachmentCode,
  uri: AttachmentCode,
  css: AttachmentCode,
  table: AttachmentCode,
  html: AttachmentCode,
  markdown: AttachmentCode,
  text: AttachmentCode,
  video: AttachmentVideo,
};
const previewComponentsByAttachmentType: Record<string, any> = {
  html: HtmlAttachmentPreview,
  markdown: MarkdownPreview,
};

const DUAL_VIEW_ATTACHMENT_TYPES = new Set(["html", "markdown"]);

export interface AttachmentTestStepResultProps {
  item: AttachmentTestStepResult;
  previewable?: boolean;
}

export const Attachment: FunctionalComponent<AttachmentTestStepResultProps> = ({ item, previewable }) => {
  const {
    link: { contentType, id, ext },
  } = item;
  const [attachment, setAttachment] = useState<Attachments>(null);
  const [loaded, setLoaded] = useState(false);
  const attachmentComponent = attachmentType(contentType);
  const CurrentComponent = componentsByAttachmentType[attachmentComponent.type];
  const CurrentPreviewComponent = previewComponentsByAttachmentType[attachmentComponent.type];

  useEffect(() => {
    const fetchData = async () => {
      const result: Attachments = await fetchAttachment(id, ext, contentType);
      setLoaded(true);
      setAttachment(result);
    };
    fetchData();
  }, [contentType, id, ext]);

  if (!loaded) {
    return (
      <div className={styles["test-result-spinner"]}>
        <Spinner />
      </div>
    );
  }

  const defaultRenderedPreview = attachmentComponent.type === "markdown" || attachmentComponent.type === "html";
  const showPreview =
    !!CurrentPreviewComponent &&
    (defaultRenderedPreview ? !previewable || modalData.value.preview : !!(previewable && modalData.value.preview));

  if (DUAL_VIEW_ATTACHMENT_TYPES.has(attachmentComponent.type) && CurrentPreviewComponent && CurrentComponent) {
    return (
      <div className={styles.attachmentViewStack}>
        <div className={styles.attachmentViewPane} hidden={showPreview}>
          <CurrentComponent attachment={attachment} item={item} />
        </div>
        <div className={styles.attachmentViewPane} hidden={!showPreview}>
          <CurrentPreviewComponent attachment={attachment} item={item} />
        </div>
      </div>
    );
  }

  // temp solution before modal component refactoring
  if (showPreview) {
    return <CurrentPreviewComponent attachment={attachment} item={item} />;
  }

  return CurrentComponent ? <CurrentComponent attachment={attachment} item={item} /> : <EmptyComponent />;
};
