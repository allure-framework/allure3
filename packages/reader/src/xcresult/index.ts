import type { ResultFile } from "@allurereport/plugin-api";
import type { ResultsReader, ResultsVisitor } from "@allurereport/reader-api";
import console from "node:console";
import { version } from "./xcresulttool/cli.js";
import newApi from "./xcresulttool/index.js";
import { legacyApiUnavailable } from "./xcresulttool/legacy/cli.js";
import legacyApi from "./xcresulttool/legacy/index.js";
import type { ApiParseFunction, ParsingContext } from "./xcresulttool/model.js";
import { parseWithExportedAttachments } from "./xcresulttool/utils.js";

const readerId = "xcresult";

export const xcresult: ResultsReader = {
  read: async (visitor: ResultsVisitor, data: ResultFile): Promise<boolean> => {
    const resultDir = data.getOriginalFileName();

    // TODO: move the check to core; replace with structural check
    if (resultDir.endsWith(".xcresult")) {
      if (await xcResultToolAvailable()) {
        return await parseBundleWithXcResultTool(visitor, resultDir);
      }
    }
    return false;
  },

  readerId: () => readerId,
};

const xcResultToolAvailable = async () => {
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

const parseBundleWithXcResultTool = async (visitor: ResultsVisitor, xcResultPath: string) => {
  try {
    await parseWithExportedAttachments(xcResultPath, async (createAttachmentFile) => {
      const context = { xcResultPath: xcResultPath, createAttachmentFile };

      try {
        await tryApi(visitor, legacyApi, context);
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
      await tryApi(visitor, newApi, context);
    });

    return true;
  } catch (e) {
    console.error("error parsing", xcResultPath, e);
  }

  return false;
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
