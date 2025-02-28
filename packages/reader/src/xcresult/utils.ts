import type {
  RawStep,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
} from "@allurereport/reader-api";
import { randomUUID } from "node:crypto";
import { isDefined, isNumber } from "../validation.js";
import type { Unknown } from "../validation.js";
import type {
  AllureApiCall,
  LabelsInputData,
  TargetDescriptor,
  TestRunArgs,
  TestRunCoordinates,
  TestRunLookup,
  TestRunSelector,
} from "./model.js";

export const MS_IN_S = 1_000;
export const ALLURE_API_ACTIVITY_PREFIX = "allure.";

export const statusPriorities = new Map<RawTestStatus, number>([
  ["failed", 0],
  ["broken", 1],
  ["unknown", 2],
  ["skipped", 3],
  ["passed", 4],
]);

/**
 * See https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/UTIRef/Articles/System-DeclaredUniformTypeIdentifiers.html
 */
export const utiToMediaType: Record<string, string> = {
  "public.plain-text": "text/plain",
  "public.utf8-plain-text": "text/plain",
  "public.utf16-external-plain-text": "text/plain",
  "public.utf16-plain-text": "text/plain",
  "public.rtf": "text/rtf",
  "public.html": "text/html",
  "public.xml": "text/xml",
  "public.source-code": "text/plain",
  "public.c-source": "text/plain",
  "public.objective-c-source": "text/plain",
  "public.c-plus-plus-source": "text/plain",
  "public.objective-c-plus-​plus-source": "text/plain",
  "public.c-header": "text/plain",
  "public.c-plus-plus-header": "text/plain",
  "com.sun.java-source": "text/plain",
  "public.script": "text/plain",
  "public.assembly-source": "text/plain",
  "com.apple.rez-source": "text/plain",
  "public.mig-source": "text/plain",
  "com.apple.symbol-export": "text/plain",
  "com.netscape.javascript-​source": "text/plain",
  "public.shell-script": "text/plain",
  "public.csh-script": "text/plain",
  "public.perl-script": "text/plain",
  "public.python-script": "text/plain",
  "public.ruby-script": "text/plain",
  "public.php-script": "text/plain",
  "com.sun.java-web-start": "text/plain",
  "com.apple.applescript.text": "text/plain",
  "com.microsoft.windows-​executable": "application/x-msdownload",
  "com.microsoft.windows-​dynamic-link-library": "application/x-msdownload",
  "com.sun.java-archive": "application/java-archive",
  "com.apple.quartz-​composer-composition": "application/x-quartzcomposer",
  "org.gnu.gnu-tar-archive": "application/x-gtar",
  "public.tar-archive": "application/x-tar",
  "org.gnu.gnu-zip-archive": "application/gzip",
  "org.gnu.gnu-zip-tar-archive": "application/gzip",
  "com.apple.binhex-archive": "application/mac-binhex40",
  "com.apple.macbinary-​archive": "application/x-macbinary",
  "public.jpeg": "image/jpeg",
  "public.jpeg-2000": "image/jp2",
  "public.tiff": "image/tiff",
  "com.apple.pict": "image/x-pict",
  "public.png": "image/png",
  "public.xbitmap-image": "image/x-quicktime",
  "com.apple.quicktime-image": "image/x-quicktime",
  "com.apple.quicktime-movie": "video/quicktime",
  "public.avi": "video/x-msvideo",
  "public.mpeg": "video/mpeg",
  "public.mpeg-4": "video/mp4",
  "public.3gpp": "video/3gpp",
  "public.3gpp2": "video/3gpp2",
  "public.mp3": "audio/mpeg",
  "public.mpeg-4-audio": "audio/mp4",
  "public.ulaw-audio": "audio/basic",
  "public.aifc-audio": "audio/x-aiff",
  "public.aiff-audio": "audio/x-aiff",
  "com.pkware.zip-archive": "application/zip",
  "com.adobe.pdf": "application/pdf",
  "com.adobe.photoshop-image": "image/vnd.adobe.photoshop",
  "com.compuserve.gif": "image/gif",
  "com.microsoft.bmp": "image/bmp",
  "com.microsoft.ico": "image/vnd.microsoft.icon",
  "com.microsoft.word.doc": "application/msword",
  "com.microsoft.excel.xls": "application/vnd.ms-excel",
  "com.microsoft.powerpoint.ppt": "application/vnd.ms-powerpoint",
  "com.microsoft.waveform-audio": "audio/x-wav",
  "com.microsoft.advanced-systems-format": "video/x-ms-asf",
  "com.microsoft.windows-media-wm": "video/x-ms-wm",
  "com.microsoft.windows-media-wmv": "video/x-ms-wmv",
  "com.microsoft.windows-media-wmp": "video/x-ms-wmp",
  "com.microsoft.windows-media-wma": "video/x-ms-wma",
  "com.microsoft.advanced-stream-redirector": "video/x-ms-asx",
  "com.microsoft.windows-media-wmx": "video/x-ms-wmx",
  "com.microsoft.windows-media-wvx": "video/x-ms-wvx",
  "com.microsoft.windows-media-wax": "video/x-ms-wax",
  "com.truevision.tga-image": "image/x-tga",
  "com.sgi.sgi-image": "image/x-sgi",
  "com.kodak.flashpix.image": "image/vnd.fpx",
  "com.real.realmedia": "application/vnd.rn-realmedia",
  "com.real.realaudio": "audio/vnd.rn-realaudio",
  "com.real.smil": "application/smil",
  "com.allume.stuffit-archive": "application/x-stuffit",
};

export const getMediaTypeByUti = (uti: string | undefined) => (uti ? utiToMediaType[uti] : undefined);

export const prependTitle = (title: string, text: string, spaces: number) =>
  [title, ...text.split("\n").map((l) => `${" ".repeat(spaces)}${l}`)].join("\n");

export const getWorstStatus = (steps: readonly RawStep[]): RawTestStatus | undefined => {
  const statuses = steps.filter((s): s is RawTestStepResult => "status" in s).map(({ status }) => status ?? "unknown");
  return statuses.sort((a, b) => statusPriorities.get(a)! - statusPriorities.get(b)!)[0];
};

export const DEFAULT_BUNDLE_NAME = "The test bundle name is not defined";
export const DEFAULT_SUITE_NAME = "The test suite name is not defined";
export const DEFAULT_TEST_NAME = "The test name is not defined";
export const DEFAULT_STEP_NAME = "The test name is not defined";
export const DEFAULT_ATTACHMENT_NAME = "Attachment";
export const DEFAULT_EXPECTED_FAILURE_REASON = "Expected failure";

export const SURROGATE_DEVICE_ID = randomUUID();
export const SURROGATE_TEST_PLAN_ID = randomUUID();
export const SURROGATE_ARGS_ID = randomUUID();

export const getArgsKeyByValues = (values: readonly (string | undefined)[]) => values.map(String).join(",");

export const getArgsKey = (args: TestRunArgs) => getArgsKeyByValues(args.map((arg) => arg?.value));

export const createTestRunLookup = <T>(entries: readonly (readonly [TestRunCoordinates, T])[]): TestRunLookup<T> =>
  mappedGroupBy(
    entries,
    ([{ device }]) => device ?? SURROGATE_DEVICE_ID,
    (deviceRuns) =>
      mappedGroupBy(
        deviceRuns,
        ([{ testPlan }]) => testPlan ?? SURROGATE_TEST_PLAN_ID,
        (configRuns) =>
          mappedGroupBy(
            configRuns,
            ([{ args }]) => (args && args.length ? getArgsKey(args) : SURROGATE_ARGS_ID),
            (argRuns) => {
              // Make sure retries are ordered by the repetition index
              argRuns.sort(([{ attempt: attemptA }], [{ attempt: attemptB }]) => (attemptA ?? 0) - (attemptB ?? 0));
              return argRuns.map(([, data]) => data);
            },
          ),
      ),
  );

export const lookupTestAttempts = <T>(lookup: TestRunLookup<T>, { args, device, testPlan }: TestRunSelector) =>
  lookup
    .get(device ?? SURROGATE_DEVICE_ID)
    ?.get(testPlan ?? SURROGATE_TEST_PLAN_ID)
    ?.get(args ? getArgsKeyByValues(args) : SURROGATE_ARGS_ID);

export const lookupTestAttempt = <Data>(lookup: TestRunLookup<Data>, selector: TestRunSelector) => {
  const attempts = lookupTestAttempts(lookup, selector);
  const { attempt = 0 } = selector;
  return attempts?.[attempt];
};

export const lookupNextTestAttempt = <Data>(
  lookup: TestRunLookup<Data>,
  selector: TestRunSelector,
  pred: (data: Data) => boolean,
) => {
  const attempts = lookupTestAttempts(lookup, selector);
  return attempts?.find(pred);
};

export const groupBy = <T, K>(values: readonly T[], keyFn: (v: T) => K): Map<K, T[]> =>
  values.reduce((m, v) => {
    const key = keyFn(v);
    if (!m.get(key)?.push(v)) {
      m.set(key, [v]);
    }
    return m;
  }, new Map<K, T[]>());

export const mappedGroupBy = <T, K, G>(
  values: readonly T[],
  keyFn: (v: T) => K,
  groupMapFn: (group: T[]) => G,
): Map<K, G> => {
  const result = new Map<K, G>();
  for (const [k, g] of groupBy(values, keyFn)) {
    result.set(k, groupMapFn(g));
  }
  return result;
};

export const getTargetDetails = ({ architecture, model, platform, osVersion }: TargetDescriptor = {}) => {
  const osPart = platform ? (osVersion ? `${platform} ${osVersion}` : platform) : undefined;

  return [model, architecture, osPart].filter(isDefined).join(", ") || undefined; // coerce empty string to undefined
};

export const compareChronologically = (
  { start: startA, stop: stopA }: RawStep,
  { start: startB, stop: stopB }: RawStep,
) => (startA ?? 0) - (startB ?? 0) || (stopA ?? 0) - (stopB ?? 0);

export const toSortedSteps = (...stepArrays: readonly (readonly RawStep[])[]) => {
  const allSteps = stepArrays.reduce<RawStep[]>((result, steps) => {
    result.push(...steps);
    return result;
  }, []);
  allSteps.sort(compareChronologically);
  return allSteps;
};

export const secondsToMilliseconds = (seconds: Unknown<number>) =>
  isNumber(seconds) ? Math.round(MS_IN_S * seconds) : undefined;

export const parseAsAllureApiActivity = (title: string | undefined): AllureApiCall | undefined => {
  if (isPotentialAllureApiActivity(title)) {
    const maybeApiCall = title.slice(ALLURE_API_ACTIVITY_PREFIX.length);
    const apiValueSeparatorIndex = indexOfAny(maybeApiCall, ":", "=");
    if (apiValueSeparatorIndex !== -1) {
      const apiCall = maybeApiCall.slice(0, apiValueSeparatorIndex).trim();
      const value = maybeApiCall.slice(apiValueSeparatorIndex + 1);
      switch (apiCall) {
        case "id":
          return { type: "label", value: { name: "ALLURE_ID", value } };
        case "name":
          return { type: "name", value };
        case "description":
          return { type: "description", value };
        case "precondition":
          return { type: "precondition", value };
        case "expectedResult":
          return { type: "expectedResult", value };
        case "flaky":
          return { type: "flaky", value: parseBooleanApiArg(value) };
        case "muted":
          return { type: "muted", value: parseBooleanApiArg(value) };
        case "known":
          return { type: "known", value: parseBooleanApiArg(value) };
        default:
          return parseComplexAllureApiCall(apiCall, value);
      }
    }
  }
};

export const applyApiCalls = (testResult: RawTestResult, apiCalls: readonly AllureApiCall[]) => {
  const groupedApiCalls = mappedGroupBy(
    apiCalls,
    (v) => v.type,
    (g) => g.map(({ value }) => value),
  );

  for (const [type, values] of groupedApiCalls) {
    applyApiCallGroup(testResult, type, values);
  }
};

const applyApiCallGroup = (
  testResult: RawTestResult,
  type: AllureApiCall["type"],
  values: readonly AllureApiCall["value"][],
) => {
  switch (type) {
    case "name":
      testResult.name = values.at(-1) as string;
      break;
    case "flaky":
      testResult.flaky = values.at(-1) as boolean;
      break;
    case "muted":
      testResult.muted = values.at(-1) as boolean;
      break;
    case "known":
      testResult.known = values.at(-1) as boolean;
      break;
    case "description":
      testResult.description = mergeMarkdownBlocks(testResult.description, ...(values as string[]));
      break;
    case "precondition":
      testResult.precondition = mergeMarkdownBlocks(testResult.precondition, ...(values as string[]));
      break;
    case "expectedResult":
      testResult.expectedResult = mergeMarkdownBlocks(testResult.expectedResult, ...(values as string[]));
      break;
    case "label":
      testResult.labels = [...(testResult.labels ?? []), ...(values as RawTestLabel[])];
      break;
    case "link":
      testResult.links = [...(testResult.links ?? []), ...(values as RawTestLink[])];
      break;
    case "parameter":
      testResult.parameters = [...(testResult.parameters ?? []), ...(values as RawTestParameter[])];
      break;
  }
};

export const createTestLabels = ({
  hostName,
  projectName,
  bundle,
  suites,
  className,
  functionName,
  tags,
}: LabelsInputData) => {
  const labels: RawTestLabel[] = [];

  if (hostName) {
    labels.push({ name: "host", value: hostName });
  }

  const packageName = [projectName, bundle].filter(isDefined).join(".");
  if (packageName) {
    labels.push({ name: "package", value: packageName });
  }
  if (className) {
    labels.push({ name: "testClass", value: className });
  }
  if (functionName) {
    labels.push({ name: "testMethod", value: functionName });
  }

  if (bundle) {
    labels.push({ name: "parentSuite", value: bundle });
  }

  const [suite, ...subSuites] = suites;

  if (suite) {
    labels.push({ name: "suite", value: suite });
  }

  const subSuite = subSuites.join(" > ");
  if (subSuite) {
    labels.push({ name: "subSuite", value: subSuite });
  }

  labels.push(...tags.map((value) => ({ name: "tag", value })));

  return labels;
};

export const getDefaultAttachmentName = (index: number, length: number) => {
  return length > 1 ? `${DEFAULT_ATTACHMENT_NAME} ${index + 1}` : DEFAULT_ATTACHMENT_NAME;
};

const mergeMarkdownBlocks = (...blocks: readonly (string | undefined)[]) =>
  blocks.filter(isDefined).reduce((a, b) => `${a}\n\n${b}`);

const isPotentialAllureApiActivity = (title: string | undefined): title is `allure.${string}` =>
  isDefined(title) && title.startsWith(ALLURE_API_ACTIVITY_PREFIX);

const parseComplexAllureApiCall = (apiCall: string, value: string): AllureApiCall | undefined => {
  const apiFnEnd = apiCall.indexOf(".");
  if (apiFnEnd !== -1) {
    const apiFn = apiCall.slice(0, apiFnEnd);
    const { primary: primaryOption, secondary: secondaryOptions } = parseAllureApiCallOptions(
      apiCall.slice(apiFnEnd + 1),
    );
    switch (apiFn) {
      case "label":
        return parseAllureLabelApiCall(primaryOption, value);
      case "link":
        return parseAllureLinkApiCall(primaryOption, secondaryOptions, value);
      case "parameter":
        return parseAllureParameterApiCall(primaryOption, secondaryOptions, value);
    }
  }
};

const parseAllureLabelApiCall = (name: string, value: string): AllureApiCall | undefined =>
  name ? { type: "label", value: { name, value } } : undefined;

const parseAllureLinkApiCall = (name: string, [type]: string[], url: string): AllureApiCall | undefined => {
  return { type: "link", value: { name, type, url } };
};

const parseAllureParameterApiCall = (name: string, options: string[], value: string): AllureApiCall | undefined => {
  const parameter: RawTestParameter = { name, value };
  options.forEach((option) => {
    switch (option.toLowerCase()) {
      case "hidden":
        parameter.hidden = true;
        break;
      case "excluded":
        parameter.excluded = true;
        break;
      case "masked":
        parameter.masked = true;
        break;
    }
  });
  return { type: "parameter", value: parameter };
};

const parseAllureApiCallOptions = (options: string): { primary: string; secondary: string[] } => {
  const primaryEnd = options.indexOf("[");
  if (primaryEnd !== -1) {
    const primary = decodeURIComponentSafe(options.slice(0, primaryEnd));
    const secondaryEnd = options.indexOf("]");
    if (secondaryEnd === options.length) {
      return {
        primary,
        secondary: options
          .slice(primaryEnd + 1, -1)
          .split(",")
          .map((v) => decodeURIComponentSafe(v.trim())),
      };
    }
    return { primary, secondary: [] };
  }
  return { primary: decodeURIComponentSafe(options), secondary: [] };
};

const indexOfAny = (input: string, ...searchStrings: readonly string[]) =>
  searchStrings.reduce((a, e) => {
    const indexOfE = input.indexOf(e);
    return a === -1 ? indexOfE : Math.min(a, indexOfE);
  }, 0);

const parseBooleanApiArg = (value: string) => !value || value.toLowerCase() === "true";

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
