import type { ResultsVisitor } from "@allurereport/reader-api";
import console from "node:console";
import { IS_MAC, XCRESULTTOOL_MISSING_MESSAGE, isXcResultBundle } from "./bundle.js";
import { version } from "./xcresulttool/cli.js";
import newApi from "./xcresulttool/index.js";
import { legacyApiUnavailable } from "./xcresulttool/legacy/cli.js";
import legacyApi from "./xcresulttool/legacy/index.js";
import type { ApiParseFunction, ParsingContext } from "./xcresulttool/model.js";
import { parseWithExportedAttachments } from "./xcresulttool/utils.js";

const readerId = "xcresult";

export const readXcResultBundle = async (visitor: ResultsVisitor, directory: string) => {
  if (await isXcResultBundle(directory)) {
    if (!IS_MAC) {
      console.warn(
        `It looks like ${directory} is a Mac OS bundle. Allure 3 can only parse such bundles on a Mac OS machine.`,
      );

      // There is a small chance we're dealing with a proper allure results directory that just by accident has a
      // bundle-like layout.
      // In such a case, allow the directory to be read (if it's really a bundle, the user will see an empty report).
      return false;
    }

    if (await xcResultToolAvailable()) {
      return await parseBundleWithXcResultTool(visitor, directory);
    }

    return true;
  }

  return false;
};

const xcResultToolAvailable = async () => {
  try {
    await version();
    return true;
  } catch (e) {
    console.error(XCRESULTTOOL_MISSING_MESSAGE, e);
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
