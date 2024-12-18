export type LogPluginOptions = {
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suites" | "features" | "packages" | "none";
};
