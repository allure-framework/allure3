import type { Plugin } from "@allurereport/plugin-api";
import { type AllureStaticServer } from "@allurereport/static-server";

export class ServerReloadPlugin implements Plugin {
  constructor(
    readonly options: {
      server: AllureStaticServer;
      timeout?: number;
    },
  ) {}

  update = async () => {
    this.options.server.reload();
  };
}
