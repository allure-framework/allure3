import type { ResultsVisitor } from "@allurereport/reader-api";
import { DirectoryResultsReader } from "@allurereport/reader-api";
import console from "node:console";
import { version } from "./xcresulttool/cli.js";
import newApi from "./xcresulttool/index.js";
import { legacyApiUnavailable } from "./xcresulttool/legacy/cli.js";
import legacyApi from "./xcresulttool/legacy/index.js";
import type { ApiParseFunction, ParsingContext } from "./xcresulttool/model.js";
import { parseWithExportedAttachments } from "./xcresulttool/utils.js";

class XcResultReader extends DirectoryResultsReader {
  constructor() {
    super("xcresult");
  }

  override async readDirectory(visitor: ResultsVisitor, resultDir: string): Promise<boolean> {
    if (resultDir.endsWith(".xcresult")) {
      if (await this.#xcResultToolAvailable()) {
        return await this.#parseBundleWithXcResultTool(visitor, resultDir);
      }
    }
    return false;
  }

  #xcResultToolAvailable = async () => {
    try {
      await version();
      return true;
    } catch (e) {
      console.error(
        "xcresulttool is unavailable on this machine. Please, make sure XCode is installed. The original error:",
        e,
      );
    }

    return false;
  };

  #parseBundleWithXcResultTool = async (visitor: ResultsVisitor, xcResultPath: string) => {
    try {
      await parseWithExportedAttachments(xcResultPath, async (createAttachmentFile) => {
        const context = { xcResultPath: xcResultPath, createAttachmentFile };

        try {
          await this.#tryApi(visitor, legacyApi, context);
          return;
        } catch (e) {
          console.error(e);
          if (!legacyApiUnavailable()) {
            // The legacy API available but some other error has occured. We should not attempt using the new API in
            // that case because the results may've been partially created.
            throw e;
          }
        }

        // The legacy API is not available. Fallback to the new API (as paradoxical as it may sound; the new API is
        // much less convenient to consume, lacks some important information, and hides test results that share the
        // same test id.
        await this.#tryApi(visitor, newApi, context);
      });

      return true;
    } catch (e) {
      console.error("error parsing", xcResultPath, e);
    }

    return false;
  };

  #tryApi = async (visitor: ResultsVisitor, generator: ApiParseFunction, context: ParsingContext) => {
    const { xcResultPath: originalFileName } = context;
    const readerId = this.readerId();
    for await (const x of generator(context)) {
      if ("readContent" in x) {
        await visitor.visitAttachmentFile(x, { readerId });
      } else {
        visitor.visitTestResult(x, { readerId, metadata: { originalFileName } });
      }
    }
  };
}

export const xcresult = new XcResultReader();
