import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { Meta, StoryObj } from "@storybook/preact-vite";

import {
  AttachmentCode,
  AttachmentEmpty,
  AttachmentImage,
  AttachmentTable,
  HtmlPreview,
  HttpAttachment,
  MarkdownPreview,
} from "@/components/Attachment";

const attachmentItem = (name: string, ext: string, contentType: string): AttachmentTestStepResult => ({
  type: "attachment",
  link: {
    id: name,
    name,
    originalFileName: `${name}${ext}`,
    ext,
    contentType,
    used: true,
    missed: false,
  },
});

const imageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#5b8def"/><text x="160" y="96" font-size="24" fill="#fff" text-anchor="middle">Screenshot</text></svg>',
)}`;

const meta: Meta = {
  title: "Components/Attachment",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const Code: Story = {
  render: () => (
    <AttachmentCode
      attachment={{ text: "const answer = 42;\n\nexport const greet = (name: string) => `Hello, ${name}`;\n" }}
      item={attachmentItem("snippet", ".ts", "text/typescript")}
    />
  ),
};

export const Json: Story = {
  render: () => (
    <AttachmentCode
      attachment={{ text: JSON.stringify({ id: 42, name: "demo", tags: ["a", "b"], nested: { ok: true } }, null, 2) }}
      item={attachmentItem("payload", ".json", "application/json")}
    />
  ),
};

export const PlainText: Story = {
  render: () => (
    <AttachmentCode
      attachment={{ text: "Just a log line\nAnd another one" }}
      item={attachmentItem("log", ".txt", "text/plain")}
    />
  ),
};

export const Table: Story = {
  render: () => (
    <AttachmentTable
      attachment={{ text: "name,status,duration\nlogin,passed,120\ncheckout,failed,860\nsearch,passed,95" }}
      item={attachmentItem("results", ".csv", "text/csv")}
    />
  ),
};

export const Html: Story = {
  render: () => (
    <HtmlPreview
      attachment={{ text: "<html><body><h1>Rendered HTML</h1><p>Sanitized attachment preview.</p></body></html>" }}
    />
  ),
};

export const Markdown: Story = {
  render: () => (
    <MarkdownPreview
      attachment={{ text: "# Heading\n\nSome **bold** text and a [link](https://allurereport.org).\n\n- one\n- two" }}
    />
  ),
};

export const Image: Story = {
  render: () => (
    <AttachmentImage attachment={{ img: imageDataUrl }} item={attachmentItem("screenshot", ".svg", "image/svg+xml")} />
  ),
};

export const Http: Story = {
  render: () => (
    <HttpAttachment
      attachment={{
        http: {
          schemaVersion: 1,
          start: 1710000186400,
          stop: 1710000186487,
          request: {
            method: "POST",
            url: "https://api.example.com/v1/orders/42?dryRun=true",
            httpVersion: "HTTP/1.1",
            query: [{ name: "dryRun", value: "true" }],
            headers: [
              { name: "authorization", value: "__ALLURE_REDACTED__" },
              { name: "content-type", value: "application/json" },
            ],
            body: { contentType: "application/json", encoding: "utf8", value: '{"name":"demo"}', size: 15 },
          },
          response: {
            status: 201,
            statusText: "Created",
            headers: [{ name: "content-type", value: "application/json" }],
            body: { contentType: "application/json", encoding: "utf8", value: '{"id":42}', size: 9 },
          },
        },
      }}
      item={attachmentItem("HTTP exchange", ".httpexchange", "application/vnd.allure.http+json")}
    />
  ),
};

export const Empty: Story = {
  render: () => <AttachmentEmpty>Preview is not available for this attachment</AttachmentEmpty>,
};
