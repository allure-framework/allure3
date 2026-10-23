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
  HTTP_EXCHANGE_REDACTED_VALUE,
  copyToClipboard,
  normalizeHttpExchangePayload,
  normalizeAttachmentContentType,
  isJsonAttachmentContentType,
  isHtmlAttachmentContentType,
} from "@allurereport/web-commons";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import type { AttachmentProps } from "./model";

import styles from "./styles.scss";
export { HTTP_EXCHANGE_REDACTED_VALUE } from "@allurereport/web-commons";

const DEFAULT_BODY_CONTENT_TYPE = "text/plain";
const DEFAULT_BINARY_CONTENT_TYPE = "application/octet-stream";
const MASKED_VALUE_PLACEHOLDER = "*****";
const MASKED_VALUE_TOOLTIP = "Value is masked";

const maskRedactedText = (value: string) => value.replaceAll(HTTP_EXCHANGE_REDACTED_VALUE, MASKED_VALUE_PLACEHOLDER);

const tryBeautifyJson = (value: string): string => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

const MaskedValue = () => (
  <span
    aria-label={MASKED_VALUE_TOOLTIP}
    className={styles["http-attachment__masked-value"]}
    data-http-masked-value="true"
    title={MASKED_VALUE_TOOLTIP}
  >
    {MASKED_VALUE_PLACEHOLDER}
  </span>
);

const PairValue = ({ pair }: { pair: HttpPair }) =>
  pair.masked ? <MaskedValue /> : <>{maskRedactedText(pair.value)}</>;

const TableHead = ({ columns }: { columns: string[] }) => (
  <thead>
    <tr>
      {columns.map((column, index) => (
        <th key={`${column}-${index}`}>{column}</th>
      ))}
    </tr>
  </thead>
);

const DisclosureGroup = ({
  children,
  count,
  defaultOpen,
  title,
  variant = "metadata",
}: {
  children: ComponentChildren;
  count?: number;
  defaultOpen?: boolean;
  title: string;
  variant?: "body" | "metadata";
}) => (
  <details
    className={`${styles["http-attachment__group"]} ${styles[`http-attachment__group--${variant}`]}`}
    data-http-group={title.toLowerCase().replace(/\s+/g, "-")}
    open={defaultOpen}
  >
    <summary className={styles["http-attachment__group-summary"]}>
      <span className={styles["http-attachment__group-title"]}>
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </span>
    </summary>
    <div className={styles["http-attachment__group-content"]}>{children}</div>
  </details>
);

const PairsTable = ({ pairs }: { pairs: HttpPair[] }) => (
  <table className={styles["http-attachment__table"]}>
    <TableHead columns={["Name", "Value"]} />
    <tbody>
      {pairs.map((pair, index) => (
        <tr key={`${pair.name}-${index}`}>
          <td className={styles["http-attachment__pair-name"]}>{pair.name}</td>
          <td className={styles["http-attachment__pair-value"]}>
            <PairValue pair={pair} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const PairsGroup = ({ defaultOpen, pairs, title }: { defaultOpen?: boolean; pairs: HttpPair[]; title: string }) =>
  pairs.length ? (
    <DisclosureGroup count={pairs.length} defaultOpen={defaultOpen} title={title}>
      <PairsTable pairs={pairs} />
    </DisclosureGroup>
  ) : null;

const cookieAttributes = (cookie: HttpCookie) =>
  [
    cookie.domain && `Domain=${cookie.domain}`,
    cookie.path && `Path=${cookie.path}`,
    cookie.expires && `Expires=${cookie.expires}`,
    typeof cookie.maxAge === "number" && `Max-Age=${cookie.maxAge}`,
    cookie.sameSite && `SameSite=${cookie.sameSite}`,
    cookie.secure && "Secure",
    cookie.httpOnly && "HttpOnly",
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");

const CookiesGroup = ({
  cookies,
  defaultOpen,
  title,
}: {
  cookies: HttpCookie[];
  defaultOpen?: boolean;
  title: string;
}) =>
  cookies.length ? (
    <DisclosureGroup count={cookies.length} defaultOpen={defaultOpen} title={title}>
      <table className={styles["http-attachment__table"]}>
        <TableHead columns={["Name", "Value", "Attributes"]} />
        <tbody>
          {cookies.map((cookie, index) => (
            <tr key={`${cookie.name}-${index}`}>
              <td className={styles["http-attachment__pair-name"]}>{cookie.name}</td>
              <td className={styles["http-attachment__pair-value"]}>
                <PairValue pair={cookie} />
              </td>
              <td className={styles["http-attachment__cookie-attrs"]}>{cookieAttributes(cookie)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DisclosureGroup>
  ) : null;

const MetaRow = ({ name, value }: { name: string; value?: string }) =>
  value ? (
    <div className={styles["http-attachment__meta-row"]}>
      <div className={styles["http-attachment__label"]}>{name}</div>
      <div className={styles["http-attachment__value"]}>{value}</div>
    </div>
  ) : null;

const nonEmptyLineValue = (value: string | number | undefined) => value !== undefined && value !== "";

const statusText = (status?: string, reason?: string) => [status, reason].filter(nonEmptyLineValue).join(" ");

const firstAvailableGroup = (groups: [string, number][]) => groups.find(([, count]) => count > 0)?.[0] ?? null;

const InformationalResponsesGroup = ({
  defaultOpen,
  responses,
}: {
  defaultOpen?: boolean;
  responses: HttpInformationalResponse[];
}) =>
  responses.length ? (
    <DisclosureGroup count={responses.length} defaultOpen={defaultOpen} title="Informational responses">
      <table className={styles["http-attachment__table"]}>
        <TableHead columns={["Status", "Headers"]} />
        <tbody>
          {responses.map(({ headers, reason, status }, index) => (
            <tr key={`${status}-${index}`}>
              <td className={styles["http-attachment__pair-name"]}>{statusText(status, reason)}</td>
              <td className={styles["http-attachment__pair-value"]}>
                {headers.map((header, headerIndex) => (
                  <span key={`${header.name}-${headerIndex}`}>
                    {headerIndex > 0 ? "; " : null}
                    {header.name}: <PairValue pair={header} />
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DisclosureGroup>
  ) : null;

const MetaChips = ({ values }: { values: string[] }) =>
  values.length ? (
    <div className={styles["http-attachment__meta-chips"]}>
      {values.map((value) => (
        <span className={styles["http-attachment__meta-chip"]} key={value}>
          {value}
        </span>
      ))}
    </div>
  ) : null;

const bodyMeta = (body: HttpBody) =>
  [
    body.contentType || "body",
    body.encoding !== "utf8" && body.encoding,
    typeof body.size === "number" && `${body.size} bytes`,
    body.truncated && "truncated",
  ].filter((value): value is string => Boolean(value));

const bodyCodeLanguage = (contentType: string) => {
  const normalized = normalizeAttachmentContentType(contentType || DEFAULT_BODY_CONTENT_TYPE);

  if (isJsonAttachmentContentType(normalized)) {
    return "json";
  }

  if (isHtmlAttachmentContentType(normalized)) {
    return "html";
  }

  return (
    normalized
      .split("/")
      .pop()
      ?.replace(/[^a-z0-9_-]/gi, "-") || "text"
  );
};

const bodyKind = (contentType: string) => {
  const normalized = normalizeAttachmentContentType(contentType || DEFAULT_BODY_CONTENT_TYPE);

  if (normalized.startsWith("image/")) {
    return "image";
  }

  if (normalized.startsWith("video/")) {
    return "video";
  }

  if (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/xml" ||
    normalized.endsWith("+json")
  ) {
    return "text";
  }

  return "binary";
};

const canRenderBodyValueAsText = (body: HttpBody) =>
  body.hasValue && body.encoding !== "base64" && bodyKind(body.contentType) === "text";

const createBase64DataUrl = (body: HttpBody) =>
  `data:${body.contentType || DEFAULT_BINARY_CONTENT_TYPE};base64,${body.value.replace(/\s/g, "")}`;

const createUtf8DataUrl = (body: HttpBody) =>
  `data:${body.contentType || DEFAULT_BODY_CONTENT_TYPE};charset=utf-8,${encodeURIComponent(body.value)}`;

const BodyValue = ({ body, beautify }: { body: HttpBody; beautify?: boolean }) => {
  const kind = bodyKind(body.contentType);

  if (kind === "image" || kind === "video") {
    const src = body.encoding === "base64" ? createBase64DataUrl(body) : createUtf8DataUrl(body);

    if (kind === "image") {
      return (
        <div data-testid="image-attachment-content" className={styles["test-result-attachment-image"]}>
          <img alt="HTTP body" src={src} />
        </div>
      );
    }

    return (
      <video
        data-testid="video-attachment-content"
        className={styles["test-result-attachment-video"]}
        aria-label="HTTP body video"
        controls
        loop
        muted
      >
        <source src={src} type={body.contentType} />
      </video>
    );
  }

  if (body.encoding === "base64") {
    return (
      <div className={styles["http-attachment__body-message"]}>
        No inline view for {body.contentType || "this content type"}.
      </div>
    );
  }

  if (kind === "text") {
    const language = bodyCodeLanguage(body.contentType);
    const value = beautify && isJsonAttachmentContentType(body.contentType) ? tryBeautifyJson(body.value) : body.value;

    return (
      <pre data-testid="code-attachment-content" className={`language-${language} line-numbers`}>
        <code>{maskRedactedText(value)}</code>
      </pre>
    );
  }

  return (
    <div className={styles["http-attachment__body-message"]}>
      No inline view for {body.contentType || "this content type"}.
    </div>
  );
};

const partMeta = (part: HttpBodyPart) =>
  [
    part.contentType,
    part.encoding !== "utf8" && part.encoding,
    typeof part.size === "number" && `${part.size} bytes`,
    part.truncated && "truncated",
  ].filter((value): value is string => Boolean(value));

const partTitle = (part: HttpBodyPart) => [part.name, part.fileName].filter(Boolean).join(" | ") || "unnamed";

const PartHeaders = ({ headers }: { headers: HttpPair[] }) =>
  headers.length ? (
    <div className={styles["http-attachment__part-section"]} data-http-part-headers="true">
      <div className={styles["http-attachment__part-section-title"]}>Headers</div>
      <div className={styles["http-attachment__part-header-list"]}>
        {headers.map((header, index) => (
          <div className={styles["http-attachment__part-header-row"]} key={`${header.name}-${index}`}>
            <span className={styles["http-attachment__part-header-name"]}>{header.name}</span>
            <span className={styles["http-attachment__part-header-value"]}>
              <PairValue pair={header} />
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

const BodyPartsGroup = ({ defaultOpen, parts }: { defaultOpen?: boolean; parts: HttpBodyPart[] }) =>
  parts.length ? (
    <DisclosureGroup count={parts.length} defaultOpen={defaultOpen} title="Parts" variant="body">
      <div className={styles["http-attachment__part-list"]}>
        {parts.map((part, index) => (
          <div
            className={styles["http-attachment__part-card"]}
            data-http-part="true"
            key={`${part.name}-${part.fileName}-${index}`}
          >
            <div className={styles["http-attachment__part-card-header"]}>
              <div className={styles["http-attachment__part-title"]}>{partTitle(part)}</div>
              <MetaChips values={partMeta(part)} />
            </div>
            <PartHeaders headers={part.headers} />
            {part.hasValue ? (
              <pre className={styles["http-attachment__part-value"]}>
                {part.value === HTTP_EXCHANGE_REDACTED_VALUE ? <MaskedValue /> : maskRedactedText(part.value)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </DisclosureGroup>
  ) : null;

const streamPairs = (stream: HttpStream): HttpPair[] =>
  [
    stream.type && { name: "type", value: stream.type, masked: false },
    stream.complete && { name: "complete", value: stream.complete, masked: false },
    typeof stream.chunkCount === "number" && {
      name: "chunkCount",
      value: String(stream.chunkCount),
      masked: false,
    },
  ].filter(Boolean) as HttpPair[];

const StreamGroup = ({ defaultOpen, stream }: { defaultOpen?: boolean; stream: HttpStream | null }) => {
  if (!stream) {
    return null;
  }

  const pairs = streamPairs(stream);

  return (
    <DisclosureGroup
      count={pairs.length || undefined}
      defaultOpen={defaultOpen || !pairs.length}
      title="Stream"
      variant="body"
    >
      {pairs.length ? (
        <PairsTable pairs={pairs} />
      ) : (
        <div className={styles["http-attachment__body-message"]}>Stream metadata captured.</div>
      )}
    </DisclosureGroup>
  );
};

const StructuredBody = ({ body, beautify }: { body: HttpBody; beautify?: boolean }) => {
  if (body.form.length) {
    return (
      <DisclosureGroup count={body.form.length} defaultOpen title="Form" variant="body">
        <PairsTable pairs={body.form} />
      </DisclosureGroup>
    );
  }

  if (body.parts.length) {
    return <BodyPartsGroup defaultOpen parts={body.parts} />;
  }

  if (body.stream) {
    return (
      <>
        <StreamGroup defaultOpen stream={body.stream} />
        {body.hasValue ? <BodyValue body={body} beautify={beautify} /> : null}
      </>
    );
  }

  return <BodyValue body={body} beautify={beautify} />;
};

const Body = ({ body }: { body: HttpBody | null }) => {
  const [beautify, setBeautify] = useState(false);

  if (!body) {
    return null;
  }

  const hasStructuredBody = Boolean(body.form.length || body.parts.length || body.stream);
  const hasTextBody = canRenderBodyValueAsText(body);
  const canBeautify = hasTextBody && isJsonAttachmentContentType(body.contentType);
  const canCopy = hasTextBody;

  return (
    <div className={styles["http-attachment__body"]}>
      <div className={styles["http-attachment__body-toolbar"]}>
        <div className={styles["http-attachment__body-heading"]}>
          <h4 className={styles["http-attachment__body-title"]}>Body</h4>
          <MetaChips values={bodyMeta(body)} />
        </div>
        {(canCopy || canBeautify) && (
          <div className={styles["http-attachment__body-actions"]}>
            {canBeautify && (
              <button
                className={styles["http-attachment__body-action"]}
                onClick={() => setBeautify((b) => !b)}
                type="button"
              >
                {beautify ? "Original" : "Pretty"}
              </button>
            )}
            {canCopy && (
              <button
                className={styles["http-attachment__body-action"]}
                onClick={() => copyToClipboard(body.value)}
                type="button"
              >
                Copy
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className={`${styles["http-attachment__body-content"]} ${
          hasStructuredBody ? styles["http-attachment__body-content--structured"] : ""
        }`}
      >
        {body.hasValue || hasStructuredBody ? (
          <StructuredBody body={body} beautify={beautify} />
        ) : (
          <div className={styles["http-attachment__body-message"]}>No body captured.</div>
        )}
      </div>
    </div>
  );
};

const MethodLine = ({ method, url }: { method: string; url: string }) => (
  <>
    <span className={styles["http-attachment__method"]} data-http-method="true">
      {method}
    </span>
    <span className={styles["http-attachment__url"]}>{url}</span>
  </>
);

const StatusLine = ({ durationMs, response }: { durationMs?: string; response: HttpResponse }) => {
  const statusLine = statusText(response.status, response.reason);

  return (
    <>
      {statusLine ? <span className={styles["http-attachment__status"]}>{statusLine}</span> : null}
      {durationMs ? <span className={styles["http-attachment__duration"]}>{durationMs}</span> : null}
    </>
  );
};

const PanelHeader = ({
  children,
  title,
}: {
  children?: ComponentChildren;
  title: "Request" | "Response" | "Error";
}) => (
  <div className={styles["http-attachment__panel-header"]}>
    <div className={styles["http-attachment__panel-title"]}>{title}</div>
    {children ? <div className={styles["http-attachment__panel-line"]}>{children}</div> : null}
  </div>
);

const hasRequestDetails = (request: HttpRequest) =>
  Boolean(
    request.httpVersion ||
    request.query.length ||
    request.headers.length ||
    request.cookies.length ||
    request.trailers.length ||
    request.body,
  );

const RequestSection = ({ request }: { request: HttpRequest }) => {
  const hasBody = Boolean(request.body);
  const firstGroup = !hasBody
    ? firstAvailableGroup([
        ["query", request.query.length],
        ["headers", request.headers.length],
        ["cookies", request.cookies.length],
        ["trailers", request.trailers.length],
      ])
    : null;
  const hasGroups = Boolean(
    request.query.length || request.headers.length || request.cookies.length || request.trailers.length,
  );

  return hasRequestDetails(request) ? (
    <section className={styles["http-attachment__panel"]} data-http-panel="request">
      <PanelHeader title="Request">
        {request.httpVersion ? <span className={styles["http-attachment__version"]}>{request.httpVersion}</span> : null}
      </PanelHeader>
      <Body body={request.body} />
      {hasGroups ? (
        <div className={styles["http-attachment__groups"]}>
          <PairsGroup defaultOpen={firstGroup === "query"} pairs={request.query} title="Query" />
          <PairsGroup defaultOpen={firstGroup === "headers"} pairs={request.headers} title="Headers" />
          <CookiesGroup defaultOpen={firstGroup === "cookies"} cookies={request.cookies} title="Cookies" />
          <PairsGroup defaultOpen={firstGroup === "trailers"} pairs={request.trailers} title="Trailers" />
        </div>
      ) : null}
    </section>
  ) : null;
};

const hasResponseDetails = (response: HttpResponse) =>
  Boolean(
    response.status ||
    response.reason ||
    response.httpVersion ||
    response.headers.length ||
    response.cookies.length ||
    response.trailers.length ||
    response.informationalResponses.length ||
    response.body,
  );

const ResponseSection = ({ durationMs, response }: { durationMs: string; response: HttpResponse | null }) => {
  if (!response) {
    return (
      <section className={styles["http-attachment__panel"]} data-http-panel="response">
        <PanelHeader title="Response" />
        <div className={styles["http-attachment__empty"]}>No response captured.</div>
      </section>
    );
  }

  if (!hasResponseDetails(response)) {
    return null;
  }

  const hasBody = Boolean(response.body);
  const firstGroup = !hasBody
    ? firstAvailableGroup([
        ["informational", response.informationalResponses.length],
        ["headers", response.headers.length],
        ["cookies", response.cookies.length],
        ["trailers", response.trailers.length],
      ])
    : null;
  const hasGroups = Boolean(
    response.informationalResponses.length ||
    response.headers.length ||
    response.cookies.length ||
    response.trailers.length,
  );

  return (
    <section className={styles["http-attachment__panel"]} data-http-panel="response">
      <PanelHeader title="Response">
        <StatusLine durationMs={durationMs} response={response} />
        {response.httpVersion ? (
          <span className={styles["http-attachment__version"]}>{response.httpVersion}</span>
        ) : null}
      </PanelHeader>
      <Body body={response.body} />
      {hasGroups ? (
        <div className={styles["http-attachment__groups"]}>
          <InformationalResponsesGroup
            defaultOpen={firstGroup === "informational"}
            responses={response.informationalResponses}
          />
          <PairsGroup defaultOpen={firstGroup === "headers"} pairs={response.headers} title="Headers" />
          <CookiesGroup defaultOpen={firstGroup === "cookies"} cookies={response.cookies} title="Cookies" />
          <PairsGroup defaultOpen={firstGroup === "trailers"} pairs={response.trailers} title="Trailers" />
        </div>
      ) : null}
    </section>
  );
};

const ErrorSection = ({ error }: { error: HttpError | null }) =>
  error ? (
    <section
      className={`${styles["http-attachment__panel"]} ${styles["http-attachment__panel--error"]}`}
      data-http-panel="error"
    >
      <PanelHeader title="Error" />
      <div className={styles["http-attachment__meta"]}>
        <MetaRow name="Name" value={error.name} />
        <MetaRow name="Message" value={error.message} />
      </div>
      {error.stack ? (
        <DisclosureGroup defaultOpen title="Stack">
          <div className={styles["http-attachment__body-content"]}>
            <pre data-testid="code-attachment-content" className="language-text line-numbers">
              <code>{error.stack}</code>
            </pre>
          </div>
        </DisclosureGroup>
      ) : null}
    </section>
  ) : null;

const Summary = ({
  durationMs,
  request,
  response,
}: {
  durationMs: string;
  request: HttpRequest;
  response: HttpResponse | null;
}) => {
  const statusLine = response ? statusText(response.status, response.reason) : "";

  return (
    <div className={styles["http-attachment__summary"]}>
      <MethodLine method={request.method} url={request.url} />
      {statusLine || durationMs ? <span className={styles["http-attachment__exchange-arrow"]}>→</span> : null}
      {statusLine ? <span className={styles["http-attachment__status"]}>{statusLine}</span> : null}
      {durationMs ? <span className={styles["http-attachment__duration"]}>{durationMs}</span> : null}
    </div>
  );
};

export const HttpAttachment = ({ attachment }: AttachmentProps) => {
  const payload = attachment && "http" in attachment ? attachment.http : null;
  const normalized = normalizeHttpExchangePayload(payload);

  if (!normalized.request) {
    return (
      <div className={styles["http-attachment"]} data-testid="http-attachment-content">
        <div className={styles["http-attachment__empty"]}>Invalid HTTP Exchange attachment: request is missing.</div>
      </div>
    );
  }

  return (
    <div className={styles["http-attachment"]} data-testid="http-attachment-content">
      <Summary request={normalized.request} response={normalized.response} durationMs={normalized.durationMs} />
      <RequestSection request={normalized.request} />
      <ResponseSection response={normalized.response} durationMs={normalized.durationMs} />
      <ErrorSection error={normalized.error} />
    </div>
  );
};
