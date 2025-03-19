import type { ReportFiles } from "@allurereport/plugin-api";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

export type ReportFile = {
  name: string;
  value: string;
};

export interface ChartsDataWriter {
  writeWidget<T>(fileName: string, data: T): Promise<void>;
}

export class FileSystemReportDataWriter implements ChartsDataWriter {
  constructor(private readonly output: string) {}

  async writeWidget(fileName: string, data: any): Promise<void> {
    const distFolder = resolve(this.output, "widgets");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }
}

export class InMemoryChartsDataWriter implements ChartsDataWriter {
  #data: Record<string, Buffer> = {};

  async writeWidget(fileName: string, data: any): Promise<void> {
    const dist = joinPosix("widgets", fileName);

    this.#data[dist] = Buffer.from(JSON.stringify(data), "utf-8");
  }

  reportFiles(): ReportFile[] {
    return Object.keys(this.#data).map((key) => ({
      name: key,
      value: this.#data[key].toString("base64"),
    }));
  }
}

export class ReportFileChartsDataWriter implements ChartsDataWriter {
  constructor(readonly reportFiles: ReportFiles) {}

  async writeWidget(fileName: string, data: any): Promise<void> {
    await this.reportFiles.addFile(joinPosix("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }
}
