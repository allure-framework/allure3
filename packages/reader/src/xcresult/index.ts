import type { ResultsVisitor } from "@allurereport/reader-api";
import console from "node:console";
import { IS_MAC, XCRESULTTOOL_MISSING_MESSAGE, isXcResultBundle } from "./bundle.js";
import { version } from "./xcresulttool/cli.js";
import LegacyApiParser from "./xcresulttool/legacy/index.js";
import type { XcresultParser } from "./xcresulttool/model.js";
import { parseWithExportedAttachments } from "./xcresulttool/utils.js";

const readerId = "xcresult";

export const readXcResultBundle = async (visitor: ResultsVisitor, directory: string) => {
  if (await isXcResultBundle(directory)) {
    if (!IS_MAC) {
      console.warn(
        `It looks like ${directory} is a Mac OS bundle. Allure 3 can only parse such bundles on a Mac OS machine.`,
      );

      // There is a small chance we're dealing with a proper allure results directory that just by accident has a
      // bundle-like layout (e.g., an attachment named `Info.plist`).
      // In such a case, allow the directory to be read (if it's really a bundle, the user will see an empty report).
      return false;
    }

    const xcResultToolVersion = await maybeGetXcResultToolVersion();

    if (xcResultToolVersion) {
      return await parseBundleWithXcResultTool(visitor, directory, xcResultToolVersion);
    }

    return true;
  }

  return false;
};

const maybeGetXcResultToolVersion = async () => {
  try {
    return await version();
  } catch (e) {
    console.error(XCRESULTTOOL_MISSING_MESSAGE);
    console.error(e);
  }
};

const parseBundleWithXcResultTool = async (
  visitor: ResultsVisitor,
  xcResultPath: string,
  xcResultToolVersion: string,
) => {
  try {
    if (isXcode16OrNewer(xcResultToolVersion)) {
      await parseWithXcode16OrNewer(visitor, xcResultPath, xcResultToolVersion);
    } else {
      await parseWithXcode15OrOlder(visitor, xcResultPath);
    }
    return true;
  } catch (e) {
    console.error("error parsing", xcResultPath, e);
  }

  return false;
};

const parseWithXcode15OrOlder = async (visitor: ResultsVisitor, xcResultPath: string) => {
  const legacyApiParser = new LegacyApiParser({
    xcResultPath,
    xcode16Plus: false,
  });

  await tryApi(visitor, xcResultPath, legacyApiParser);
};

const parseWithXcode16OrNewer = async (visitor: ResultsVisitor, xcResultPath: string, xcResultToolVersion: string) => {
  await parseWithExportedAttachments(xcResultPath, async (createAttachmentFile) => {
    const legacyApiParser = new LegacyApiParser({
      xcResultPath,
      createAttachmentFile,
      xcode16Plus: true,
    });

    try {
      await tryApi(visitor, xcResultPath, legacyApiParser);
      return;
    } catch (e) {
      console.error(e);
      if (legacyApiParser.legacyApiSucceeded()) {
        // The legacy API available but some other error has occured. We should not attempt using the new API in
        // that case because the results may've been partially created.
        throw e;
      }
    }

    // TODO: fallback to the new API here. See https://github.com/allure-framework/allure3/issues/110
    throw new Error(
      `The legacy xcresulttool API can't be accessed in ${xcResultToolVersion}. ` +
        "The new API is not yet supported by the reader. " +
        "Please, see https://github.com/allure-framework/allure3/issues/110 for more details",
    );
  });
};

const tryApi = async (visitor: ResultsVisitor, originalFileName: string, apiParser: XcresultParser) => {
  for await (const x of apiParser.parse()) {
    if ("readContent" in x) {
      await visitor.visitAttachmentFile(x, { readerId });
    } else {
      visitor.visitTestResult(x, { readerId, metadata: { originalFileName } });
    }
  }
};

const isXcode16OrNewer = (versionText: string) => {
  const versionMatch = versionText.match(/xcresulttool version (\d+)/);
  if (versionMatch) {
    const xcResultToolVersion = parseInt(versionMatch[1], 10);
    return xcResultToolVersion >= 23000;
  }

  return false;
};
