import type { ResultsReader, ResultsVisitor } from "@allurereport/reader-api";
import console from "node:console";
import newApi from "./xcresulttool/index.js";
import { legacyApiUnavailable } from "./xcresulttool/legacy/cli.js";
import legacyApi from "./xcresulttool/legacy/index.js";
import type { ApiParseFunction, ParsingContext } from "./xcresulttool/model.js";
import { parseWithExportedAttachments } from "./xcresulttool/utils.js";

const readerId = "xcresult";

export const xcresult: ResultsReader = {
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    if (originalFileName.endsWith(".xfresult")) {
      try {
        await parseWithExportedAttachments(originalFileName, async (createAttachmentFile) => {
          const context = { xcResultPath: originalFileName, createAttachmentFile };

          try {
            tryApi(visitor, legacyApi, context);
            return;
          } catch (e) {
            if (!legacyApiUnavailable()) {
              throw e;
            }
          }

          tryApi(visitor, newApi, context);
        });

        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
      }
    }
    return false;
  },

  readerId: () => readerId,
};

const tryApi = async (visitor: ResultsVisitor, generator: ApiParseFunction, context: ParsingContext) => {
  const { xcResultPath: originalFileName } = context;
  for await (const x of generator(context)) {
    if ("readContent" in x) {
      await visitor.visitAttachmentFile(x, { readerId });
    } else {
      visitor.visitTestResult(x, { readerId, metadata: { originalFileName } });
    }
  }
};
