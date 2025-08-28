import { lstat } from "node:fs/promises";
import { platform } from "node:os";
import path from "node:path";
import { invokeStdoutCliTool } from "../toolRunner.js";
import { isDefined } from "../validation.js";

const XCODE_INSTALL_URL =
  "https://developer.apple.com/documentation/safari-developer-tools/installing-xcode-and-simulators";

const XCODE_SWITCH_COMMAND = "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer";

export const XCRESULTTOOL_MISSING_MESSAGE = `'xcresulttool' is required to parse Xcode Result bundles, but we can't \
access it on this machine. This tool is a part of Xcode. Please make sure Xcode is installed. Visit this page to learn \
more about the installation:

    ${XCODE_INSTALL_URL}

Note that 'xcresulttool' doesn't come with Command Line Tools for Xcode. You need to install the full Xcode package to \
get it. If you have both installed, make sure the full installation is selected. Switch to it with xcode-select if \
necessary (the path to Xcode's Developer directory might be different on your machine):

    ${XCODE_SWITCH_COMMAND}

The original error that led to this message is shown below.
`;

const MDLS_CONTENT_TYPE_PATTERN = /\s*"(?<uti>[^"]+)"/;

const bundleInfoFilePaths = new Set([
  "Info.plist",
  "Contents/Info.plist",
  "Support Files/Info.plist",
  "Resources/Info.plist",
]);

export const IS_MAC = platform() === "darwin";

/**
 * On Mac OS returns `true` if and only if the path points to a directory that has the `"com.apple.xcode.resultbundle"`
 * uniform type identifier in its content type tree.
 * On other platforms return `false`.
 */
export const isXcResultBundle = async (directory: string) => {
  const hasXcResultUti = IS_MAC
    ? await checkUniformTypeIdentifier(directory, "com.apple.xcode.resultbundle")
    : undefined;
  return hasXcResultUti ?? (await isMostProbablyXcResultBundle(directory));
};

/**
 * Checks if an item has a specific uniform type identifier (UTI) in its content type tree.
 * It uses `mdls` under the hood, which requires Spotlight.
 *
 * If Spotlight is enabled and the path is properly indexed, the result of the check is reliable. Otherwise,
 * the function returns `undefined`, which means a heuristic check should be performed instead.
 */
export const checkUniformTypeIdentifier = async (itemPath: string, uti: string) => {
  const mdlsArgs = ["-raw", "-attr", "kMDItemContentTypeTree", itemPath];
  let contentTypeTreeAvailable = false;

  try {
    for await (const line of invokeStdoutCliTool("mdls", mdlsArgs, { encoding: "utf-8" })) {
      const match = MDLS_CONTENT_TYPE_PATTERN.exec(line);
      if (match) {
        contentTypeTreeAvailable = true;
        const [, matchedUti] = match;
        if (matchedUti === uti) {
          return true;
        }
      }
    }
  } catch {
    // If mdls fails for some reason, resort to heuristics.
    // We don't show messages here as there might be circumstances where a well-formed results directory (not a bundle)
    // is parsed on a machine without Spotlight.
    return undefined;
  }

  // Not a single match means the content type tree can't be accessed. That may happen on Mac OS machines if
  // the path is not indexed by Spotlight, or the indexing is disabled. We resort to heuristics in such a case.
  return contentTypeTreeAvailable ? false : undefined;
};

export const isMostProbablyXcResultBundle = async (directory: string) =>
  isDefined(await findBundleInfoFile(directory)) || followsXcResultNaming(directory);

export const followsXcResultNaming = (directory: string) => directory.endsWith(".xcresult");

/**
 * If the provided directory contains an Info.plist file in one of the well-known locations, the function returns the
 * absolute path of that file. Otherwise, it returns `undefined`.
 * If such a directory is fed to Allure, it's most probably a Mac OS bundle and should be treated accordingly.
 *
 * NOTE: Not all bundles contain an Info.plist file. But the ones we're interested in (XCResult bundles, specifically)
 * certainly do.
 */
export const findBundleInfoFile = async (directory: string) => {
  for (const infoFilePath of bundleInfoFilePaths) {
    const infoFileAbsPath = path.join(directory, infoFilePath);

    try {
      const stat = await lstat(infoFileAbsPath);

      if (stat.isFile()) {
        return infoFileAbsPath;
      }
    } catch {}
  }
};
