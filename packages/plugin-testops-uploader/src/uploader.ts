import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, ResultFile } from "@allurereport/plugin-api";
import * as fs from "node:fs";
import * as path from "node:path";

const isResult = (file: string) => file.endsWith("-result.json");
const isContainer = (file: string) => file.endsWith("-container.json");
const isAttachment = (file: string) => /-attachment\.[A-Za-z0-9]+$/.test(file);

type UploadPart = { filename: string; buffer: Buffer; contentType?: string };

const guessContentType = (name: string): string => {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".json") {
    return "application/json";
  }
  if (ext === ".xml") {
    return "application/xml";
  }
  if (ext === ".txt" || ext === ".log") {
    return "text/plain";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  if (ext === ".zip") {
    return "application/zip";
  }
  return "application/octet-stream";
};

export const readAllureDir = (
  dir: string,
): {
  files: UploadPart[];
  archives: UploadPart[];
} => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: UploadPart[] = [];
  const archives: UploadPart[] = [];

  for (const e of entries) {
    if (!e.isFile()) {
      continue;
    }
    const name = e.name;
    const full = path.join(dir, name);
    const buffer = fs.readFileSync(full);
    const item: UploadPart = { filename: name, buffer, contentType: guessContentType(name) };

    if (name.toLowerCase().endsWith(".zip")) {
      archives.push(item);
    } else {
      files.push(item);
    }
  }

  return { files, archives };
};

export const pushAllureResults = async (
  endpoint: string,
  jwt: string,
  results: TestResult[],
  allureDir: string,
  projectId: number,
  sessionId: number,
) => {
  const base = endpoint.replace(/\/+$/, "");

  const body = JSON.stringify({ results, testSessionId: sessionId });
  const res = await fetch(`${base}/api/upload/test-result`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (res.status !== 202) {
    console.log(res);
  }
  return res.json();
};

export const pushAttachments = async (
  endpoint: string,
  jwt: string,
  attachments: any[],
  projectId: number,
  store: AllureStore,
) => {
  const base = endpoint.replace(/\/+$/, "");

  console.log(attachments);
  const form = new FormData();
  for (const a of attachments) {
    console.log("attachment", a, await store.attachmentById(a.id));
    const content = (await store.attachmentContentById(a.id)) as ResultFile;
    console.log(await content.asBuffer());

    const buf = await content.asBuffer();
    if (!buf) {
      return;
    }
    const blob = new Blob([buf], { type: a.contentType });

    form.append(a.name, blob, a.originalFileName);
  }

  const body = form;
  const res = await fetch(`${base}/api/upload/test-result/${projectId}/attachment`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "multipart/form-data",
    },
    body,
  });

  if (res.status !== 202) {
    console.log(res);
  }
  return;
};

//   const res = await fetch(`${base}/api/launch/${projectId}/upload`, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${jwt}`,
//       Accept: "application/json",
//     },
//     body: form,
//   });
//
//   if (res.status !== 202) {
//     console.log(res);
//   }
//
//   return { uploadedFiles: files.length, uploadedArchives: archives.length };
// };

export const getJwtToken = async (endpoint: string, userToken: string): Promise<string> => {
  const formData = new FormData();
  formData.append("grant_type", "apitoken");
  formData.append("scope", "openid");
  formData.append("token", userToken);

  const res = await fetch(`${endpoint}/api/uaa/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });

  console.log(endpoint, res);

  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  console.log(data);

  // @ts-ignore
  return data.access_token as string;
};

export const getUserInfo = async (endpoint: string, jwt: string) => {
  const res = await fetch(`${endpoint}/api/uaa/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText}`);
  }

  return res.json();
};

export type LaunchResponse = {
  id: number;
  name: string;
  closed: boolean;
  external: boolean;
  autoclose: boolean;
  projectId: number;
  tags: [];
  links: [];
  issues: [];
  createdDate: number;
  lastModifiedDate: number;
};

export const createLaunch = async (endpoint: string, jwt: string): Promise<LaunchResponse | undefined> => {
  const res = await fetch(`${endpoint}/api/launch`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      name: "kek",
      projectId: 13737,
      autoclose: true,
      external: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create launch: ${res.status} ${res.statusText}`);
  }
  if (res.ok) {
    const result = (await res.json()) as Promise<LaunchResponse>;
    console.log("Launch was created", `${endpoint}/launch/${(await result).id}`);

    return result;
  }

  return;
};

export type SessionResponse = {
  id: number;
  jobId: number;
  jobRunId: number;
  launchId: number;
  projectId: number;
};

export const createSession = async (
  endpoint: string,
  jwt: string,
  launchId: number,
): Promise<SessionResponse | undefined> => {
  // const res = await fetch(`${endpoint}/api/upload/session`, {
  const res = await fetch(`${endpoint}/api/rs/upload/session?manual=true`, {
    method: "POST",
    headers: {
      // "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify({ launchId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create session: ${res.status} ${res.statusText}\n${text}`);
  }

  const result = (await res.json()) as SessionResponse;
  console.log("Session was created", result.id);
  return result;
};
// export const uploadTRs = async (endpoint: string, jwt: string, testResults: TestResult[]) => {
//   const res = await fetch(`${endpoint}/api/upload?id=2862`, {
//     method: "POST",
//     headers: {
//       "Accept": "application/json",
//       "Content-Type": "application/json",
//       "Authorization": `Bearer ${jwt}`,
//     },
//     body: JSON.stringify(testResults),
//   });
//
//   if (!res.ok) {
//     throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText}`);
//   }
//
//   return res.json();
// };
