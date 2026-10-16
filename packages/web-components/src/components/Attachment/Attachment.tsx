import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { AttachmentData, AttachmentType } from "@allurereport/web-commons";
import { attachmentType, fetchAttachment } from "@allurereport/web-commons";
import { batch, useSignal } from "@preact/signals";
import type { ComponentChildren, ComponentType } from "preact";
import { lazy, Suspense } from "preact/compat";
import { useCallback, useEffect, useErrorBoundary } from "preact/hooks";

import { Spinner } from "@/components/Spinner";

import { IconButton } from "../Button";
import { EmptyView } from "../EmptyView";
import { allureIcons } from "../SvgIcon";
import { AttachmentImage } from "./AttachmentImage";
import { AttachmentVideo } from "./AttachmentVideo";
import type { AttachmentProps, I18nProp } from "./model";

import styles from "./styles.scss";

const AttachmentCode = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-code" */ "./AttachmentCode").then((module) => ({
    default: module.AttachmentCode,
  })),
);
const AttachmentImageDiff = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-image-diff" */ "./AttachmentImageDiff").then((module) => ({
    default: module.AttachmentImageDiff,
  })),
);
const AttachmentTable = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-table" */ "./AttachmentTable").then((module) => ({
    default: module.AttachmentTable,
  })),
);
const HtmlPreview = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-html" */ "./HtmlPreview").then((module) => ({ default: module.HtmlPreview })),
);
const HttpAttachment = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-http" */ "./HttpAttachment").then((module) => ({
    default: module.HttpAttachment,
  })),
);
const MarkdownPreview = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-markdown" */ "./MarkdownPreview").then((module) => ({
    default: module.MarkdownPreview,
  })),
);
const MermaidPreview = /*#__PURE__*/ lazy(() =>
  import(/* webpackChunkName: "attachment-mermaid" */ "./MermaidPreview").then((module) => ({
    default: module.MermaidPreview,
  })),
);

const componentsByAttachmentType: Record<AttachmentType, ((props: AttachmentProps) => ComponentChildren) | null> = {
  "image": AttachmentImage,
  "svg": AttachmentImage,
  "json": AttachmentCode,
  "code": AttachmentCode,
  "uri": AttachmentCode,
  "css": AttachmentCode,
  "table": AttachmentTable,
  "html": AttachmentCode,
  "markdown": AttachmentCode,
  "text": AttachmentCode,
  "video": AttachmentVideo,
  "image-diff": AttachmentImageDiff,
  "http": HttpAttachment,
  "mermaid": AttachmentCode,
  "archive": null,
};

const previewComponentsByAttachmentType: Partial<
  Record<AttachmentType, ComponentType<{ attachment: { text: string } }>>
> = {
  html: HtmlPreview,
  markdown: MarkdownPreview,
  mermaid: MermaidPreview,
};

const DUAL_VIEW_ATTACHMENT_TYPES = new Set<AttachmentType>(["html", "markdown", "mermaid"]);

export interface AttachmentTestStepResultProps {
  item: AttachmentTestStepResult;
  previewable?: boolean;
  highlightCode?: boolean;
  i18n?: I18nProp;
}

const AttachmentViewer = ({ children }: { children: ComponentChildren }) => {
  const [error] = useErrorBoundary();
  if (error) return <EmptyView description="Failed to load attachment viewer" size="xs" />;
  return (
    <Suspense
      fallback={
        <div className={styles["test-result-spinner"]}>
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  );
};

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

  const CurrentPreviewComponent = previewComponentsByAttachmentType[componentType];
  const CurrentComponent = componentsByAttachmentType[componentType];
  const previewAttachment = attachment.value && "text" in attachment.value ? attachment.value : undefined;
  // @ts-expect-error TODO: add all translations for attachment types
  const typeI18n = i18n?.[componentType === "image-diff" ? "imageDiff" : componentType];
  const i18nFor = (Component: unknown) => (Component === AttachmentCode ? i18n?.controls : typeI18n);

  if (
    DUAL_VIEW_ATTACHMENT_TYPES.has(componentType) &&
    CurrentPreviewComponent &&
    CurrentComponent &&
    previewAttachment
  ) {
    const isCodeComponent = CurrentComponent === AttachmentCode;
    const showPreview = !!previewable;

    return (
      <div className={styles.attachmentViewStack}>
        <div className={styles.attachmentViewPane} hidden={showPreview}>
          <AttachmentViewer key={viewerKey}>
            <CurrentComponent
              attachment={attachment.value}
              item={item}
              i18n={i18nFor(CurrentComponent)}
              {...(isCodeComponent ? { highlight: highlightCode } : {})}
            />
          </AttachmentViewer>
        </div>
        <div className={styles.attachmentViewPane} hidden={!showPreview}>
          <AttachmentViewer key={viewerKey}>
            <CurrentPreviewComponent attachment={previewAttachment} />
          </AttachmentViewer>
        </div>
      </div>
    );
  }

  if (!CurrentComponent) {
    return null;
  }

  const isCodeComponent = CurrentComponent === AttachmentCode;

  return (
    <AttachmentViewer key={viewerKey}>
      <CurrentComponent
        attachment={attachment.value}
        item={item}
        i18n={i18nFor(CurrentComponent)}
        {...(isCodeComponent ? { highlight: highlightCode } : {})}
      />
    </AttachmentViewer>
  );
};
