import type { ReportFiles, ResultFile } from "@allurereport/plugin-api";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";
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
  constructor(private readonly output: string) {}

  async writeData(fileName: string, data: any): Promise<void> {
    const distFolder = resolve(this.output, "data");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    const distFolder = resolve(this.output, "widgets");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    const distFolder = resolve(this.output, "data", "test-cases");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, `${test.uid}.json`), JSON.stringify(test), { encoding: "utf-8" });
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const distFolder = resolve(this.output, "data", "attachments");
    await mkdir(distFolder, { recursive: true });
    await file.writeTo(resolve(distFolder, source));
  }
}

export class InMemoryReportDataWriter implements Allure2DataWriter {
  #data: Record<string, Buffer> = {};

  async writeData(fileName: string, data: any): Promise<void> {
    const dist = join("data", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    const dist = join("widgets", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    const dist = join("data", "test-cases", `${test.uid}.json`);

    this.#data[dist] = Buffer.from(JSON.stringify(test), "utf-8");
  }

  async writeAttachment(fileName: string, file: ResultFile): Promise<void> {
    const dist = join("data", "attachments", fileName);

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
    /**
     * Root-level store files shared across all plugins.
     * Attachments should go here to avoid duplicating them per plugin.
     */
    readonly reportStoreFiles: ReportFiles = reportFiles,
  ) {}

  async writeData(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosix("data", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosix("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const contentBuffer = await file.asBuffer();

    if (!contentBuffer) {
      // simply ignore missing files
      return;
    }

    await this.reportStoreFiles.addFile(joinPosix("data", "attachments", source), contentBuffer);
  }

  async writeTestCase(test: Allure2TestResult): Promise<void> {
    // Store-derived test cases are shared across plugins; write them once at report root.
    await this.reportStoreFiles.addFile(
      joinPosix("data", "test-cases", `${test.uid}.json`),
      Buffer.from(JSON.stringify(test), "utf8"),
    );
  }
}
