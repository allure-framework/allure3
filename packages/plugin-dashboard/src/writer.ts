import type { ReportFiles } from "@allurereport/plugin-api";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

export type ReportFile = {
  name: string;
  value: string;
};

export interface DashboardDataWriter {
  writeWidget<T>(fileName: string, data: T): Promise<void>;
}

export class FileSystemReportDataWriter implements DashboardDataWriter {
  constructor(private readonly output: string) {}

  async writeWidget<T>(fileName: string, data: T): Promise<void> {
    const distFolder = resolve(this.output, "widgets");
    await mkdir(distFolder, { recursive: true });
    await writeFile(resolve(distFolder, fileName), JSON.stringify(data), { encoding: "utf-8" });
  }
}

export class InMemoryDashboardDataWriter implements DashboardDataWriter {
  #data: Record<string, Buffer> = {};

  async writeWidget<T>(fileName: string, data: T): Promise<void> {
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

export class ReportFileDashboardDataWriter implements DashboardDataWriter {
  constructor(readonly reportFiles: ReportFiles) {}

  async writeWidget<T>(fileName: string, data: T): Promise<void> {
    await this.reportFiles.addFile(joinPosix("widgets", fileName), Buffer.from(JSON.stringify(data), "utf-8"));
  }
}
