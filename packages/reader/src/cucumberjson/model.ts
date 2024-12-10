export type CucumberFeature = {
  description: string;
  elements: CucumberFeatureElement[];
  id: string;
  keyword: string;
  line: number;
  name: string;
  tags?: CucumberTag[];
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
  tags?: CucumberTag[];
  type: string;
};

export type CucumberStep = {
  doc_string?: CucumberDocString;
  embeddings?: CucumberEmbedding[];
  keyword?: string;
  line?: number;
  match?: CucumberStepMatch;
  name?: string;
  output?: string[];
  result: CucumberStepResult;
  rows?: CucumberDatatableRow[];
};

export type CucumberDocString = {
  content_type?: string;
  line?: number;
  value?: string;
};

export type CucumberDatatableRow = {
  cells: string[];
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
  name: string;
};

export type CucumberEmbedding = {
  data: string;
  mime_type: string;
};
