import type {
  HttpPair,
  HttpCookie,
  HttpStream,
  HttpBodyPart,
  HttpBody,
  HttpRequest,
  HttpInformationalResponse,
  HttpResponse,
  HttpError,
} from "@allurereport/web-commons";
import {
  normalizeHttpExchangePayload,
  isJsonAttachmentContentType,
  normalizeAttachmentContentType,
} from "@allurereport/web-commons";

import "./HttpAttachmentView.scss";

import { fetchReportJson } from "../../../core/services/reportData.mts";
import { createReportLoadErrorView, mountAsyncView } from "../../../core/view/asyncMount.mts";
import { bindDelegatedEvents } from "../../../core/view/domEvents.mts";
import { defineMountableElement } from "../../../core/view/elementView.mts";
import { attachMountable, destroyMountable } from "../../../core/view/mountables.mts";
import { createElement } from "../../../shared/dom.mts";
import { createIconElement } from "../../../shared/icon/index.mts";
import TooltipView from "../../../shared/ui/TooltipView.mts";
import { AttachmentPreviewView } from "../model/attachmentPreviewView.mts";
import attachmentType from "../model/attachmentType.mts";
import { HTTP_EXCHANGE_REDACTED_VALUE } from "../model/httpAttachment.mts";
import {
  createAttachmentSourceUrlPreview,
  type AttachmentPreviewOptions,
  type AttachmentPreviewComponent,
} from "./BaseAttachmentPreviewView.mts";
import { PreviewView } from "./PreviewView.mts";

type Mountable = import("../../../core/view/types.mts").Mountable;
type Attachment = import("../../../types/report.mts").Attachment;
type AttachmentTypeInfo = import("../model/attachmentType.mts").AttachmentTypeInfo;
type DomChild = import("../../../shared/dom.mts").DomChild;
type HttpExchangePayload = import("../model/httpAttachment.mts").HttpExchangePayload;

type HttpAttachmentContentOptions = {
  sourceUrl: string;
};

const DEFAULT_BODY_CONTENT_TYPE = "text/plain";
const DEFAULT_BINARY_CONTENT_TYPE = "application/octet-stream";
const MASKED_VALUE_PLACEHOLDER = "*****";
const MASKED_VALUE_TOOLTIP = "Value is masked";

const maskRedactedText = (value: string) => value.replaceAll(HTTP_EXCHANGE_REDACTED_VALUE, MASKED_VALUE_PLACEHOLDER);

const renderMaskedValue = () =>
  createElement("span", {
    attrs: {
      "aria-label": MASKED_VALUE_TOOLTIP,
      "data-http-masked-value": true,
      "tabindex": 0,
    },
    className: "http-attachment__masked-value",
    text: MASKED_VALUE_PLACEHOLDER,
  });

const renderPairValue = ({ masked, value }: HttpPair): DomChild =>
  masked ? renderMaskedValue() : maskRedactedText(value);

const getRequestTarget = (request: HttpRequest) => request.url || "";

const normalizeContentType = (contentType: string) =>
  normalizeAttachmentContentType(contentType || DEFAULT_BODY_CONTENT_TYPE);

const bodyCodeLanguage = (contentType: string) => {
  const normalized = normalizeContentType(contentType);

  if (isJsonAttachmentContentType(normalized)) {
    return "json";
  }

  return (
    normalized
      .split("/")
      .pop()
      ?.replace(/[^a-z0-9_-]/gi, "-") || ""
  );
};

const createBodyAttachment = (body: HttpBody): Attachment => ({
  name: body.contentType || "body",
  size: body.size,
  source: "",
  type: body.contentType || DEFAULT_BINARY_CONTENT_TYPE,
});

const getSafeBodyAttachmentType = (body: HttpBody): AttachmentTypeInfo => {
  const contentType = normalizeContentType(body.contentType);
  const bodyAttachmentType = attachmentType(contentType);

  if (bodyAttachmentType.view === AttachmentPreviewView.Html) {
    return {
      view: AttachmentPreviewView.Code,
      icon: "lineDevCodeSquare",
    };
  }

  return bodyAttachmentType;
};

const createBase64DataUrl = (body: HttpBody) =>
  `data:${body.contentType || DEFAULT_BINARY_CONTENT_TYPE};base64,${body.value.replace(/\s/g, "")}`;

const createUtf8DataUrl = (body: HttpBody) =>
  `data:${body.contentType || DEFAULT_BODY_CONTENT_TYPE};charset=utf-8,${encodeURIComponent(body.value)}`;

const bodyDownloadExtension = (body: HttpBody) => {
  const contentType = normalizeContentType(body.contentType);
  const attachmentInfo = getSafeBodyAttachmentType(body);

  if (isJsonAttachmentContentType(contentType)) {
    return "json";
  }

  const extensionByContentType: Record<string, string> = {
    "application/xhtml+xml": "html",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "text/tab-separated-values": "tsv",
  };
  if (extensionByContentType[contentType]) {
    return extensionByContentType[contentType];
  }

  if (attachmentInfo.view) {
    const subtype = contentType
      .split("/")
      .pop()
      ?.split("+")
      .pop()
      ?.replace(/[^a-z0-9_-]/gi, "");

    if (subtype) {
      return subtype;
    }
  }

  return body.encoding === "base64" ? "bin" : "txt";
};

const createBodyDownloadUrl = (body: HttpBody) =>
  body.encoding === "base64" ? createBase64DataUrl(body) : createUtf8DataUrl(body);

const renderBodyDownload = (body: HttpBody | null, name: "request" | "response") =>
  body?.hasValue
    ? createElement("a", {
        attrs: {
          download: `${name}-body.${bodyDownloadExtension(body)}`,
          href: createBodyDownloadUrl(body),
        },
        className: "http-attachment__download",
        children: [
          createIconElement("lineGeneralDownloadCloud", {
            inline: true,
            size: "s",
          }),
          createElement("span", {
            text: `Download ${name}`,
          }),
        ],
      })
    : null;

const renderBodyFallbackCode = (value: string) =>
  renderBodyPreviewView({
    attachment: {
      name: "body",
      source: "",
      type: DEFAULT_BODY_CONTENT_TYPE,
    },
    fullScreen: false,
    previewData: value,
    view: AttachmentPreviewView.Code,
  });

const renderNoBodyView = (body: HttpBody) =>
  createElement("div", {
    className: "http-attachment__body-message",
    text: `No inline view for ${body.contentType || "this content type"}.`,
  });

const renderBodyPreviewView = (options: AttachmentPreviewOptions) => {
  const previewContainer = createElement("div");
  // Keep this call deferred: PreviewView imports HttpAttachmentView for the top-level HTTP preview.
  attachMountable(previewContainer, PreviewView(options));

  return previewContainer;
};

const renderBodyValue = (body: HttpBody) => {
  const attachmentInfo = getSafeBodyAttachmentType(body);

  if (!attachmentInfo.view) {
    return renderNoBodyView(body);
  }

  return renderBodyPreviewView({
    attachment: createBodyAttachment(body),
    codeLanguage: bodyCodeLanguage(body.contentType),
    fullScreen: false,
    previewData: maskRedactedText(body.value),
    sourceUrl: createBodyDownloadUrl(body),
    view: attachmentInfo.view,
  });
};

const renderInlinePairs = (pairs: HttpPair[]): DomChild[] =>
  pairs.flatMap((pair, index) => [
    index > 0 ? "; " : null,
    createElement("span", {
      children: [`${pair.name}: `, renderPairValue(pair)],
    }),
  ]);

const renderBodyPartSummary = (part: HttpBodyPart) =>
  [
    part.contentType || null,
    part.encoding && part.encoding !== "utf8" ? part.encoding : null,
    typeof part.size === "number" ? `${part.size} bytes` : null,
    part.truncated ? "truncated" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");

const renderBodyPartsTable = (parts: HttpBodyPart[]) =>
  parts.length
    ? createElement("div", {
        className: "http-attachment__subsection",
        children: [
          createElement("h4", {
            className: "http-attachment__subsection-title",
            text: "Parts",
          }),
          createElement("table", {
            className: "http-attachment__table",
            children: createElement("tbody", {
              children: parts.map((part) =>
                createElement("tr", {
                  children: [
                    createElement("td", {
                      className: "http-attachment__pair-name",
                      text: [part.name, part.fileName].filter(Boolean).join(" | "),
                    }),
                    createElement("td", {
                      className: "http-attachment__pair-value",
                      children: [
                        createElement("div", {
                          text: renderBodyPartSummary(part),
                        }),
                        part.headers.length
                          ? createElement("div", {
                              children: renderInlinePairs(part.headers),
                            })
                          : null,
                        part.hasValue
                          ? createElement("pre", {
                              className: "http-attachment__part-value",
                              children:
                                part.value === HTTP_EXCHANGE_REDACTED_VALUE
                                  ? renderMaskedValue()
                                  : maskRedactedText(part.value),
                            })
                          : null,
                      ],
                    }),
                  ],
                }),
              ),
            }),
          }),
        ],
      })
    : null;

const renderStreamTable = (stream: HttpStream | null) => {
  if (!stream) {
    return null;
  }

  return renderPairsTable(
    "Stream",
    [
      stream.type
        ? {
            name: "type",
            value: stream.type,
            masked: false,
          }
        : null,
      stream.complete
        ? {
            name: "complete",
            value: stream.complete,
            masked: false,
          }
        : null,
      typeof stream.chunkCount === "number"
        ? {
            name: "chunkCount",
            value: String(stream.chunkCount),
            masked: false,
          }
        : null,
    ].filter((pair): pair is HttpPair => pair !== null),
  );
};

const renderStructuredBodyContent = (body: HttpBody) => {
  if (body.form.length) {
    return renderPairsTable("Form", body.form);
  }

  if (body.parts.length) {
    return renderBodyPartsTable(body.parts);
  }

  if (body.stream) {
    return createElement("div", {
      className: "http-attachment__structured-body",
      children: [renderStreamTable(body.stream), body.hasValue ? renderBodyValue(body) : null],
    });
  }

  return null;
};

const renderBodyContent = (body: HttpBody) =>
  createElement("div", {
    className: "http-attachment__body-content",
    children: renderStructuredBodyContent(body) || renderBodyValue(body),
  });

const renderMetaRow = (name: string, value: string | null | undefined) =>
  value
    ? createElement("div", {
        className: "http-attachment__meta-row",
        children: [
          createElement("div", {
            className: "http-attachment__label",
            text: name,
          }),
          createElement("div", {
            className: "http-attachment__value",
            text: value,
          }),
        ],
      })
    : null;

const renderPairsTable = (title: string, pairs: HttpPair[]) =>
  pairs.length
    ? createElement("div", {
        className: "http-attachment__subsection",
        children: [
          createElement("h4", {
            className: "http-attachment__subsection-title",
            text: title,
          }),
          createElement("table", {
            className: "http-attachment__table",
            children: createElement("tbody", {
              children: pairs.map(({ masked, name, value }) =>
                createElement("tr", {
                  children: [
                    createElement("td", {
                      className: "http-attachment__pair-name",
                      text: name,
                    }),
                    createElement("td", {
                      className: masked
                        ? "http-attachment__pair-value http-attachment__pair-value_masked"
                        : "http-attachment__pair-value",
                      children: renderPairValue({ masked, name, value }),
                    }),
                  ],
                }),
              ),
            }),
          }),
        ],
      })
    : null;

const cookieAttributes = (cookie: HttpCookie) =>
  [
    cookie.domain ? `Domain=${cookie.domain}` : null,
    cookie.path ? `Path=${cookie.path}` : null,
    cookie.expires ? `Expires=${cookie.expires}` : null,
    typeof cookie.maxAge === "number" ? `Max-Age=${cookie.maxAge}` : null,
    cookie.sameSite ? `SameSite=${cookie.sameSite}` : null,
    cookie.secure ? "Secure" : null,
    cookie.httpOnly ? "HttpOnly" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");

const renderCookiesTable = (title: string, cookies: HttpCookie[]) =>
  cookies.length
    ? createElement("div", {
        className: "http-attachment__subsection",
        children: [
          createElement("h4", {
            className: "http-attachment__subsection-title",
            text: title,
          }),
          createElement("table", {
            className: "http-attachment__table",
            children: createElement("tbody", {
              children: cookies.map((cookie) =>
                createElement("tr", {
                  children: [
                    createElement("td", {
                      className: "http-attachment__pair-name",
                      text: cookie.name,
                    }),
                    createElement("td", {
                      className: cookie.masked
                        ? "http-attachment__pair-value http-attachment__pair-value_masked"
                        : "http-attachment__pair-value",
                      children: renderPairValue(cookie),
                    }),
                    createElement("td", {
                      className: "http-attachment__cookie-attrs",
                      text: cookieAttributes(cookie),
                    }),
                  ],
                }),
              ),
            }),
          }),
        ],
      })
    : null;

const renderInformationalResponses = (responses: HttpInformationalResponse[]) =>
  responses.length
    ? createElement("div", {
        className: "http-attachment__subsection",
        children: [
          createElement("h4", {
            className: "http-attachment__subsection-title",
            text: "Informational responses",
          }),
          createElement("table", {
            className: "http-attachment__table",
            children: createElement("tbody", {
              children: responses.map(({ headers, reason, status }) =>
                createElement("tr", {
                  children: [
                    createElement("td", {
                      className: "http-attachment__pair-name",
                      text: [status, reason].filter(Boolean).join(" "),
                    }),
                    createElement("td", {
                      className: "http-attachment__pair-value",
                      children: renderInlinePairs(headers),
                    }),
                  ],
                }),
              ),
            }),
          }),
        ],
      })
    : null;

const bodyMeta = (body: HttpBody) =>
  [
    body.contentType || "body",
    body.encoding && body.encoding !== "utf8" ? body.encoding : null,
    typeof body.size === "number" ? `${body.size} bytes` : null,
    body.truncated ? "truncated" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");

const renderBody = (body: HttpBody | null) => {
  if (!body) {
    return null;
  }

  const canRenderBody = body.hasValue;
  const hasStructuredBody = Boolean(body.form.length || body.parts.length || body.stream);

  return createElement("div", {
    className: "http-attachment__subsection http-attachment__body",
    children: [
      createElement("div", {
        className: "http-attachment__body-toolbar",
        children: createElement("div", {
          className: "http-attachment__body-meta",
          text: bodyMeta(body),
        }),
      }),
      canRenderBody || hasStructuredBody
        ? renderBodyContent(body)
        : createElement("div", {
            className: "http-attachment__body-message",
            text: "No body captured.",
          }),
    ],
  });
};

const renderSectionHeader = (title: "Request" | "Response" | "Error", action: HTMLElement | null = null) =>
  createElement("div", {
    className: "http-attachment__section-header",
    children: [
      createElement("h3", {
        className: "http-attachment__section-title",
        text: title,
      }),
      action,
    ],
  });

const renderRequestSection = (request: HttpRequest) =>
  createElement("section", {
    className: "http-attachment__section",
    children: [
      renderSectionHeader("Request", renderBodyDownload(request.body, "request")),
      request.httpVersion
        ? createElement("div", {
            className: "http-attachment__meta",
            children: renderMetaRow("HTTP version", request.httpVersion),
          })
        : null,
      renderPairsTable("Query", request.query),
      renderPairsTable("Headers", request.headers),
      renderCookiesTable("Cookies", request.cookies),
      renderPairsTable("Trailers", request.trailers),
      renderBody(request.body),
    ],
  });

const renderResponseSection = (response: HttpResponse | null) => {
  if (!response) {
    return createElement("section", {
      className: "http-attachment__section",
      children: [
        renderSectionHeader("Response"),
        createElement("div", {
          className: "http-attachment__empty",
          text: "No response captured.",
        }),
      ],
    });
  }

  const statusLine = [response.status, response.reason].filter(Boolean).join(" ");

  return createElement("section", {
    className: "http-attachment__section",
    children: [
      renderSectionHeader("Response", renderBodyDownload(response.body, "response")),
      createElement("div", {
        className: "http-attachment__meta",
        children: [renderMetaRow("Status", statusLine), renderMetaRow("HTTP version", response.httpVersion)],
      }),
      renderInformationalResponses(response.informationalResponses),
      renderPairsTable("Headers", response.headers),
      renderCookiesTable("Cookies", response.cookies),
      renderPairsTable("Trailers", response.trailers),
      renderBody(response.body),
    ],
  });
};

const renderErrorSection = (error: HttpError | null) => {
  if (!error) {
    return null;
  }

  return createElement("section", {
    className: "http-attachment__section",
    children: [
      renderSectionHeader("Error"),
      createElement("div", {
        className: "http-attachment__meta",
        children: [renderMetaRow("Name", error.name), renderMetaRow("Message", error.message)],
      }),
      error.stack
        ? createElement("div", {
            className: "http-attachment__subsection",
            children: [
              createElement("h4", {
                className: "http-attachment__subsection-title",
                text: "Stack",
              }),
              createElement("div", {
                className: "http-attachment__body-content",
                children: renderBodyFallbackCode(error.stack),
              }),
            ],
          })
        : null,
    ],
  });
};

const renderSummary = (request: HttpRequest, response: HttpResponse | null, durationMs: string) => {
  const statusLine = response ? [response.status, response.reason].filter(Boolean).join(" ") : "";

  return createElement("div", {
    className: "http-attachment__summary",
    children: [
      createElement("span", {
        className: "http-attachment__method",
        text: request.method,
      }),
      createElement("span", {
        className: "http-attachment__url",
        text: getRequestTarget(request),
      }),
      statusLine
        ? createElement("span", {
            className: "http-attachment__status",
            text: statusLine,
          })
        : null,
      durationMs
        ? createElement("span", {
            className: "http-attachment__duration",
            text: durationMs,
          })
        : null,
    ],
  });
};

// Keep null payloads on Allure2's existing load-error path.
const createHttpAttachmentContent = ({ request, response, error, start, stop }: HttpExchangePayload) => {
  const normalized = normalizeHttpExchangePayload({ request, response, error, start, stop });
  const el = defineMountableElement(document.createElement("div"), {
    onMaskedValueHover(event: Event) {
      tooltip.show(MASKED_VALUE_TOOLTIP, event.currentTarget as HTMLElement);
    },
    onTooltipLeave() {
      tooltip.hide();
    },
  });
  const tooltip = new TooltipView({ position: "bottom" });
  let releaseEvents = () => {};

  Object.assign(el, {
    render() {
      releaseEvents();
      el.className = "http-attachment";

      if (!normalized.request) {
        el.replaceChildren(
          createElement("div", {
            className: "http-attachment__empty",
            text: "Invalid HTTP Exchange attachment: request is missing.",
          }),
        );
        return el;
      }

      el.replaceChildren(
        ...[
          renderSummary(normalized.request, normalized.response, normalized.durationMs),
          renderRequestSection(normalized.request),
          renderResponseSection(normalized.response),
          renderErrorSection(normalized.error),
        ].filter((node): node is HTMLElement => node !== null),
      );

      releaseEvents = bindDelegatedEvents({
        root: el,
        events: {
          "mouseenter [data-http-masked-value]": "onMaskedValueHover",
          "focusin [data-http-masked-value]": "onMaskedValueHover",
          "mouseleave [data-http-masked-value]": "onTooltipLeave",
          "focusout [data-http-masked-value]": "onTooltipLeave",
        },
        context: el,
      });

      return el;
    },
    destroy() {
      releaseEvents();
      tooltip.hide();
      el.remove();
    },
  });

  return el;
};

const HttpAttachmentContentView = (options: HttpAttachmentContentOptions) => {
  const el = defineMountableElement(document.createElement("div"), {});
  let requestId = 0;
  let subView: Mountable | null = null;

  const destroySubView = () => {
    if (!subView) {
      return;
    }

    destroyMountable(subView);
    subView = null;
  };

  const mountSubView = (view: Mountable) => {
    const container = el.querySelector(".http-attachment-view");
    if (!(container instanceof Element)) {
      return;
    }

    destroySubView();
    subView = attachMountable(container, view);
  };

  Object.assign(el, {
    render() {
      destroySubView();
      el.replaceChildren(createElement("div", { className: "http-attachment-view" }));
      const currentRequestId = ++requestId;
      void mountAsyncView({
        createError: (error) => createReportLoadErrorView(error),
        createSuccess: createHttpAttachmentContent,
        load: () => fetchReportJson<HttpExchangePayload>(options.sourceUrl),
        mount: mountSubView,
        shouldIgnore: () => currentRequestId !== requestId || !el.isConnected,
      });
      return el;
    },
    attachToDom() {
      subView?.attachToDom?.();
    },
    detachFromDom() {
      subView?.detachFromDom?.();
    },
    destroy() {
      el.detachFromDom?.();
      requestId += 1;
      destroySubView();
      el.remove();
    },
  });

  return el;
};

export const HttpAttachmentView: AttachmentPreviewComponent = (options) =>
  createAttachmentSourceUrlPreview(options, (sourceUrl) =>
    HttpAttachmentContentView({
      sourceUrl,
    }),
  );
