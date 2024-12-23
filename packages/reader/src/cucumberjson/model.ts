export const TEST_NAME_PLACEHOLDER = "The scenario's name is not defined";
export const STEP_NAME_PLACEHOLDER = "The step's name is not defined";

// TODO: fix known/unknown typings

export type CucumberFeature = {
  description: string;
  elements: CucumberFeatureElement[];
  id: string;
  keyword: string;
  line: number;
  name: string;
  tags?: unknown; // CucumberTag[]
  uri: string;
};

export type CucumberFeatureElement = {
  after?: CucumberStep[];
  before?: CucumberStep[];
  description: string;
  id?: string;
  keyword: string;
  line: number;
  name: string;
  steps?: CucumberStep[];
  tags?: unknown; // CucumberTag[]
  type: string;
};

export type CucumberStep = {
  doc_string?: CucumberDocString;
  embeddings?: unknown; // CucumberEmbedding[]
  keyword?: string;
  line?: number;
  match?: CucumberStepMatch;
  name?: string;
  output?: string[];
  result: CucumberStepResult;
  rows?: unknown; // CucumberDatatableRow[]
  arguments?: unknown; // CucumberJsStepArgument[]; Cucumber-JS
};

export type CucumberDocString = {
  content_type?: string;
  line?: number;
  value?: string;
  content?: string; // Cucumber-JS
};

export type CucumberDatatableRow = {
  cells: unknown; // string[]
};

export type CucumberStepResult = {
  duration?: number;
  error_message?: string;
  status: string;
};

export type CucumberStepMatch = {
  location: string;
};

export type CucumberTag = {
  line: number;
  name: unknown; // string
};

export type CucumberEmbedding = {
  data: unknown; // string
  mime_type: unknown; // string
  name?: unknown; // string; Cucumber-JVM: https://github.com/cucumber/cucumber-jvm/pull/1693
};

export type CucumberJsStepArgument = CucumberDocString | { rows: CucumberDatatableRow[] };
