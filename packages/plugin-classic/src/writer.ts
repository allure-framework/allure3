import { joinPosixPath } from "@allurereport/core-api";
import type { ReportTestResult, ReportFiles, ResultFile } from "@allurereport/plugin-api";

export interface ReportFile {
  name: string;
  value: string;
}

export interface ClassicDataWriter {
  writeData(fileName: string, data: any): Promise<void>;

  /**
   * Writes the content as is (without JSON serialization) to the `data` directory
   */
  writeRawData(fileName: string, content: string | Buffer): Promise<void>;

  writeWidget(fileName: string, data: any): Promise<void>;

  writeTestCase(test: ReportTestResult): Promise<void>;

  writeAttachment(source: string, file: ResultFile): Promise<void>;
}

export class InMemoryReportDataWriter implements ClassicDataWriter {
  #data: Record<string, Buffer> = {};

  async writeData(fileName: string, data: any): Promise<void> {
    const dist = joinPosixPath("data", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeRawData(fileName: string, content: string | Buffer): Promise<void> {
    const dist = joinPosixPath("data", fileName);

    this.#data[dist] = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    const dist = joinPosixPath("widgets", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  async writeTestCase(test: ReportTestResult): Promise<void> {
    const dist = joinPosixPath("data", "test-results", `${test.id}.json`);

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

export class ReportFileDataWriter implements ClassicDataWriter {
  constructor(readonly reportFiles: ReportFiles) {}

  async writeData(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosixPath("data", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeRawData(fileName: string, content: string | Buffer): Promise<void> {
    await this.reportFiles.addFile(
      joinPosixPath("data", fileName),
      typeof content === "string" ? Buffer.from(content, "utf-8") : content,
    );
  }

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosixPath("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }

  async writeAttachment(source: string, file: ResultFile): Promise<void> {
    const contentBuffer = await file.asBuffer();

    if (!contentBuffer) {
      // simply ignore missing files
      return;
    }

    await this.reportFiles.addFile(joinPosixPath("data", "attachments", source), contentBuffer);
  }

  async writeTestCase(test: ReportTestResult): Promise<void> {
    await this.reportFiles.addFile(
      joinPosixPath("data", "test-results", `${test.id}.json`),
      Buffer.from(JSON.stringify(test), "utf8"),
    );
  }
}
