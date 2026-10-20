import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { AttachmentData, AttachmentType } from "@allurereport/web-commons";
import { attachmentType, fetchAttachment } from "@allurereport/web-commons";
import { batch, useSignal } from "@preact/signals";
import { useCallback, useEffect } from "preact/hooks";

import { Spinner } from "@/components/Spinner";

import { IconButton } from "../Button";
import { EmptyView } from "../EmptyView";
import { LazyComponent, type ComponentLoader } from "../LazyComponent";
import { allureIcons } from "../SvgIcon";
import { AttachmentImage } from "./AttachmentImage";
import { AttachmentVideo } from "./AttachmentVideo";
import type { AttachmentProps, I18nProp } from "./model";

import styles from "./styles.scss";

const loadCode = () =>
  import(/* webpackChunkName: "attachment-code" */ "./AttachmentCode").then((module) => ({
    default: module.AttachmentCode,
  }));
const loadImageDiff = () =>
  import(/* webpackChunkName: "attachment-image-diff" */ "./AttachmentImageDiff").then((module) => ({
    default: module.AttachmentImageDiff,
  }));
const loadTable = () =>
  import(/* webpackChunkName: "attachment-table" */ "./AttachmentTable").then((module) => ({
    default: module.AttachmentTable,
  }));
const loadHtml = () =>
  import(/* webpackChunkName: "attachment-html" */ "./HtmlPreview").then((module) => ({ default: module.HtmlPreview }));
const loadHttp = () =>
  import(/* webpackChunkName: "attachment-http" */ "./HttpAttachment").then((module) => ({
    default: module.HttpAttachment,
  }));
const loadMarkdown = () =>
  import(/* webpackChunkName: "attachment-markdown" */ "./MarkdownPreview").then((module) => ({
    default: module.MarkdownPreview,
  }));
const loadMermaid = () =>
  import(/* webpackChunkName: "attachment-mermaid" */ "./MermaidPreview").then((module) => ({
    default: module.MermaidPreview,
  }));

const loadersByAttachmentType: Record<AttachmentType, ComponentLoader<AttachmentProps> | null> = {
  "image": null,
  "svg": null,
  "video": null,
  "archive": null,
  "json": loadCode,
  "code": loadCode,
  "uri": loadCode,
  "css": loadCode,
  "html": loadCode,
  "markdown": loadCode,
  "text": loadCode,
  "mermaid": loadCode,
  "table": loadTable,
  "image-diff": loadImageDiff,
  "http": loadHttp,
};
const previewLoaders: Partial<Record<AttachmentType, ComponentLoader<{ attachment: { text: string } }>>> = {
  html: loadHtml,
  markdown: loadMarkdown,
  mermaid: loadMermaid,
};

const DUAL_VIEW_ATTACHMENT_TYPES = new Set<AttachmentType>(["html", "markdown", "mermaid"]);

export interface AttachmentTestStepResultProps {
  item: AttachmentTestStepResult;
  previewable?: boolean;
  highlightCode?: boolean;
  i18n?: I18nProp;
}

export const Attachment = (props: AttachmentTestStepResultProps) => {
  const { item, previewable, highlightCode = true, i18n } = props;
  const {
    link: { contentType, id, ext },
  } = item;
  const attachment = useSignal<AttachmentData | null>(null);
  const isLoading = useSignal<boolean>(true);
  const isError = useSignal<boolean>(false);
  const componentType = attachmentType(contentType);
  const viewerKey = `${id}:${ext}:${contentType}`;

  const fetchData = useCallback(async () => {
    isLoading.value = true;
    isError.value = false;
    try {
      const result = await fetchAttachment(id, ext, contentType);
      batch(() => {
        isLoading.value = false;
        attachment.value = result;
      });
    } catch {
      batch(() => {
        isLoading.value = false;
        isError.value = true;
      });
    }
  }, [id, ext, contentType, isLoading, attachment, isError]);

  useEffect(() => {
    if (!componentType) {
      return;
    }

    fetchData();
  }, [componentType, fetchData]);

  if (!componentType) {
    return null;
  }

  if (isLoading.value) {
    return (
      <div className={styles["test-result-spinner"]}>
        <Spinner />
      </div>
    );
  }

  if (isError.value) {
    return (
      <EmptyView description="Failed to load attachment" size="xs">
        <IconButton style="flat" icon={allureIcons.lineArrowsRefreshCcw1} onClick={fetchData} />
      </EmptyView>
    );
  }

  const loader = loadersByAttachmentType[componentType];
  const previewLoader = previewLoaders[componentType];
  const previewAttachment = attachment.value && "text" in attachment.value ? attachment.value : undefined;
  // @ts-expect-error TODO: add all translations for attachment types
  const typeI18n = i18n?.[componentType === "image-diff" ? "imageDiff" : componentType];
  const isCode = loader === loadCode;
  const componentProps = {
    attachment: attachment.value,
    item,
    i18n: isCode ? i18n?.controls : typeI18n,
    ...(isCode ? { highlight: highlightCode } : {}),
  };
  const fallback = (
    <div className={styles["test-result-spinner"]}>
      <Spinner />
    </div>
  );
  const errorMessage = i18n?.controls?.("loadAttachmentViewerError") ?? "Failed to load attachment viewer";
  const retryLabel = i18n?.controls?.("retry") ?? "Retry";
  const source = loader ? (
    <LazyComponent
      key={viewerKey}
      loader={loader}
      componentProps={componentProps}
      fallback={fallback}
      errorMessage={errorMessage}
      retryLabel={retryLabel}
    />
  ) : componentType === "video" ? (
    <AttachmentVideo {...componentProps} />
  ) : componentType === "image" || componentType === "svg" ? (
    <AttachmentImage {...componentProps} />
  ) : null;

  if (DUAL_VIEW_ATTACHMENT_TYPES.has(componentType) && previewLoader && previewAttachment) {
    const showPreview = !!previewable;
    return (
      <div className={styles.attachmentViewStack}>
        <div className={styles.attachmentViewPane} hidden={showPreview}>
          {source}
        </div>
        <div className={styles.attachmentViewPane} hidden={!showPreview}>
          <LazyComponent
            key={viewerKey}
            loader={previewLoader}
            componentProps={{ attachment: previewAttachment }}
            fallback={fallback}
            errorMessage={errorMessage}
            retryLabel={retryLabel}
          />
        </div>
      </div>
    );
  }
  return source;
};
