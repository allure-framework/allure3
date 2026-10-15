import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";

import { collectMailData } from "./data.js";
import type { MailPluginOptions } from "./model.js";
import { renderMail } from "./render.js";

export class MailPlugin implements Plugin {
  constructor(readonly options: MailPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const { filename = "mail.html" } = this.options;
    const data = await collectMailData(context, store, this.options);

    await context.reportFiles.addFile(filename, Buffer.from(await renderMail(data), "utf-8"));
  };
}
