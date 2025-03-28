import type { PluginInfo } from "@allurereport/plugin-api";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateSummaryStaticFiles } from "./generators.js";
import type { SummaryPluginOptions } from "./model.js";

export class SummaryPlugin {
  constructor(readonly options: SummaryPluginOptions) {}

  async generate(output: string, summaries: PluginInfo[]) {
    if (!summaries.length) {
      return;
    }

    const summaryHtml = await generateSummaryStaticFiles({ summaries });

    await writeFile(resolve(output, "index.html"), summaryHtml, "utf8");
  }
}
