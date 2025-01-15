export interface TestLabel {
  name: string;
  value?: string;
}

export interface TestLink {
  name?: string;
  url: string;
  type?: string;
}

export interface TestParameter {
  name: string;
  value: string;
  hidden: boolean;
  excluded: boolean;
  masked: boolean;
}
