import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { joinPosixPath } from "@allurereport/core-api";
import type { ReportFiles, ResultFile } from "@allurereport/plugin-api";

import type { Allure2TestResult } from "./model.js";

export interface ReportFile {
  name: string;
  value: string;
}

export interface Allure2DataWriter {
  writeData(fileName: string, data: any): Promise<void>;

  writeWidget(fileName: string, data: any): Promise<void>;

  writeTestCase(test: Allure2TestResult): Promise<void>;

  writeAttachment(source: string, file: ResultFile): Promise<void>;
}

export class FileSystemReportDataWriter implements Allure2DataWriter {
  readonly #dataDir: string;
  readonly #widgetsDir: string;
  readonly #testCasesDir: string;
  readonly #attachmentsDir: string;
  readonly #dataDirReady: Promise<string | undefined>;
  readonly #widgetsDirReady: Promise<string | undefined>;
  readonly #testCasesDirReady: Promise<string | undefined>;
  readonly #attachmentsDirReady: Promise<string | undefined>;

  constructor(private readonly output: string) {
    this.#dataDir = resolve(this.output, "data");
    this.#widgetsDir = resolve(this.output, "widgets");
    this.#testCasesDir = resolve(this.output, "data", "test-cases");
    this.#attachmentsDir = resolve(this.output, "data", "attachments");
    this.#dataDirReady = mkdir(this.#dataDir, { recursive: true });
    this.#widgetsDirReady = mkdir(this.#widgetsDir, { recursive: true });
    this.#testCasesDirReady = mkdir(this.#testCasesDir, { recursive: true });
    this.#attachmentsDirReady = mkdir(this.#attachmentsDir, { recursive: true });
  }

  async writeData(fileName: string, data: any): Promise<void> {
    await this.#dataDirReady;
    await writeFile(resolve(this.#dataDir, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.#widgetsDirReady;
    await writeFile(resolve(this.#widgetsDir, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    await this.#testCasesDirReady;
    await writeFile(resolve(this.#testCasesDir, `${test.uid}.json`), JSON.stringify(test), { encoding: "utf-8" });
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    await this.#attachmentsDirReady;
    await file.writeTo(resolve(this.#attachmentsDir, source));
  }
}

export class InMemoryReportDataWriter implements Allure2DataWriter {
  #data: Record<string, Buffer> = {};

  async writeData(fileName: string, data: any): Promise<void> {
    const dist = joinPosixPath("data", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    const dist = joinPosixPath("widgets", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    const dist = joinPosixPath("data", "test-cases", `${test.uid}.json`);

    this.#data[dist] = Buffer.from(JSON.stringify(test), "utf-8");
  }

  async writeAttachment(fileName: string, file: ResultFile): Promise<void> {
    const dist = joinPosixPath("data", "attachments", fileName);

    const content = await file.asBuffer();
    if (content) {
      this.#data[dist] = content;
    }
  }

  reportFiles(): ReportFile[] {
    return Object.keys(this.#data).map((key) => ({
      name: key,
      value: this.#data[key].toString("base64"),
    }));
  }
}

export class ReportFileDataWriter implements Allure2DataWriter {
  constructor(
    readonly reportFiles: ReportFiles,
    readonly sharedReportFiles?: ReportFiles,
  ) {}

  async writeData(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosixPath("data", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosixPath("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const contentBuffer = await file.asBuffer();

    if (!contentBuffer) {
      return;
    }

    const target = this.sharedReportFiles ?? this.reportFiles;

    await target.addFile(joinPosixPath("data", "attachments", source), contentBuffer);
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    await this.reportFiles.addFile(
      joinPosixPath("data", "test-cases", `${test.uid}.json`),
      Buffer.from(JSON.stringify(test), "utf8"),
    );
  }
}
