import type { ResultsVisitor } from "@allurereport/reader-api";
import { DirectoryResultsReader } from "@allurereport/reader-api";
import console from "node:console";
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
    if (resultDir.endsWith(".xfresult")) {
      try {
        await parseWithExportedAttachments(resultDir, async (createAttachmentFile) => {
          const context = { xcResultPath: resultDir, createAttachmentFile };

          try {
            this.#tryApi(visitor, legacyApi, context);
            return;
          } catch (e) {
            if (!legacyApiUnavailable()) {
              throw e;
            }
          }

          this.#tryApi(visitor, newApi, context);
        });

        return true;
      } catch (e) {
        console.error("error parsing", resultDir, e);
      }
    }
    return false;
  }

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
