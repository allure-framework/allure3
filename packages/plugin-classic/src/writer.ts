import type { ReportFiles, ResultFile } from "@allurereport/plugin-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface ReportFile {
  name: string;
  value: string;
}

export interface AwesomeDataWriter {
  writeData(fileName: string, data: any): Promise<void>;

  writeWidget(fileName: string, data: any): Promise<void>;

  writeTestCase(test: AwesomeTestResult): Promise<void>;

  writeAttachment(source: string, file: ResultFile): Promise<void>;
}

export class FileSystemReportDataWriter implements AwesomeDataWriter {
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

  async writeTestCase(test: AwesomeTestResult): Promise<void> {
    const distFolder = resolve(this.output, "data", "test-results");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, `${test.id}.json`), JSON.stringify(test), { encoding: "utf-8" });
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const distFolder = resolve(this.output, "data", "attachments");
    await mkdir(distFolder, { recursive: true });
    await file.writeTo(resolve(distFolder, source));
  }
}

export class InMemoryReportDataWriter implements AwesomeDataWriter {
  #data: Record<string, Buffer> = {};

  async writeData(fileName: string, data: any): Promise<void> {
    const dist = join("data", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    const dist = join("widgets", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeTestCase(test: AwesomeTestResult): Promise<void> {
    const dist = join("data", "test-results", `${test.id}.json`);

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
    return Object.keys(this.#data).map((key) => ({ name: key, value: this.#data[key].toString("base64") }));
  }
}

export class ReportFileDataWriter implements AwesomeDataWriter {
  constructor(readonly reportFiles: ReportFiles) {}

  async writeData(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(join("data", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(join("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const contentBuffer = await file.asBuffer();

    if (!contentBuffer) {
      // simply ignore missing files
      return;
    }

    await this.reportFiles.addFile(join("data", "attachments", source), contentBuffer);
  }

  async writeTestCase(test: AwesomeTestResult): Promise<void> {
    await this.reportFiles.addFile(
      join("data", "test-results", `${test.id}.json`),
      Buffer.from(JSON.stringify(test), "utf8"),
    );
  }
}
