// The subset of the Cucumber messages schema used by this reader:
// https://github.com/cucumber/messages/blob/main/jsonschema/messages.schema.json

export type CucumberTimestamp = {
  seconds: number | string;
  nanos: number;
};

export type CucumberLocation = { line: number };
export type CucumberTableRow = { cells: { value: string }[] };

export type CucumberPickleStep = {
  id: string;
  text: string;
  astNodeIds: string[];
  argument?: {
    docString?: { content: string; mediaType?: string };
    dataTable?: { rows: CucumberTableRow[] };
  };
};

export type CucumberPickle = {
  id: string;
  uri: string;
  name: string;
  language: string;
  location?: CucumberLocation;
  astNodeIds: string[];
  tags: { name: string }[];
  steps: CucumberPickleStep[];
};

export type CucumberGherkinStep = { id: string; keyword: string };

export type CucumberScenario = {
  id: string;
  name: string;
  description: string;
  location: CucumberLocation;
  steps: CucumberGherkinStep[];
  examples: {
    tableHeader?: CucumberTableRow;
    tableBody: (CucumberTableRow & { id: string; location: CucumberLocation })[];
  }[];
};

export type CucumberGherkinChild = {
  scenario?: CucumberScenario;
  background?: { steps: CucumberGherkinStep[] };
  rule?: { children: CucumberGherkinChild[] };
};

export type CucumberGherkinDocument = {
  uri?: string;
  feature?: { name: string; children: CucumberGherkinChild[] };
};

export type CucumberHook = {
  id: string;
  name?: string;
  type?: string;
};

export type CucumberTestCase = {
  id: string;
  pickleId: string;
  testSteps: { id: string; pickleStepId?: string; hookId?: string }[];
};

export type CucumberTestCaseStarted = {
  id: string;
  testCaseId: string;
  attempt: number;
  timestamp: CucumberTimestamp;
};

export type CucumberTestCaseFinished = {
  testCaseStartedId: string;
  timestamp: CucumberTimestamp;
  willBeRetried: boolean;
};

export type CucumberTestStepEvent = {
  testCaseStartedId: string;
  testStepId: string;
  timestamp: CucumberTimestamp;
};

export type CucumberTestStepResult = {
  status: string;
  duration?: CucumberTimestamp;
  message?: string;
  exception?: { type: string; message?: string; stackTrace?: string };
};

export type CucumberTestStepFinished = CucumberTestStepEvent & {
  testStepResult: CucumberTestStepResult;
};

export type CucumberAttachment = {
  body: string;
  contentEncoding: "IDENTITY" | "BASE64";
  mediaType: string;
  fileName?: string;
  testCaseStartedId?: string;
  testStepId?: string;
};

export type CucumberMessage = {
  gherkinDocument?: CucumberGherkinDocument;
  pickle?: CucumberPickle;
  hook?: CucumberHook;
  testCase?: CucumberTestCase;
  testCaseStarted?: CucumberTestCaseStarted;
  testCaseFinished?: CucumberTestCaseFinished;
  testStepStarted?: CucumberTestStepEvent;
  testStepFinished?: CucumberTestStepFinished;
  attachment?: CucumberAttachment;
};
