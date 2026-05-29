export type DefaultLabelsConfig = Record<string, string | string[]>;

export type AllureServiceConfig = {
  accessToken?: string;
  private?: boolean;
  uploadConcurrency?: number;
  uploadMaxAttempts?: number;
  uploadMaxSimultaneousFailures?: number;
};

export type ResolvedAllureServiceConfig = AllureServiceConfig &
  Required<Pick<AllureServiceConfig, "uploadConcurrency" | "uploadMaxAttempts" | "uploadMaxSimultaneousFailures">>;
