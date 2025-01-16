import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { Spinner } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { modalData } from "@/components/Modal";
import { HtmlAttachmentPreview } from "@/components/TestResult/TestResultSteps/HtmlAttachmentPreview";
import { AttachmentCode } from "@/components/TestResult/TestResultSteps/attachmentCode";
import { AttachmentImage } from "@/components/TestResult/TestResultSteps/attachmentImage";
import { AttachmentVideo } from "@/components/TestResult/TestResultSteps/attachmentVideo";
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
  text: AttachmentCode,
  video: AttachmentVideo,
};
const previewComponentsByAttachmentType: Record<string, any> = {
  html: HtmlAttachmentPreview,
};

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

  // temp solution before modal component refactoring
  if (CurrentPreviewComponent && previewable && modalData.value.preview) {
    return <CurrentPreviewComponent attachment={attachment} item={item} />;
  }

  return CurrentComponent ? <CurrentComponent attachment={attachment} item={item} /> : <EmptyComponent />;
};
