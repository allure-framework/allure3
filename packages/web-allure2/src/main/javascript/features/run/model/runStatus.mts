type ExitCode = import("../../../types/report.mts").ExitCode;
type GlobalsData = import("../../../types/report.mts").GlobalsData;

export const effectiveExitCode = (exitCode?: ExitCode): number | undefined => exitCode?.actual ?? exitCode?.original;

export const hasBadExitCode = (exitCode?: ExitCode): boolean => {
  const code = effectiveExitCode(exitCode);
  return code !== undefined && code !== 0;
};

export const hasRunFailureSignal = (globals: Pick<GlobalsData, "errors" | "exitCode">): boolean =>
  globals.errors.length > 0 || hasBadExitCode(globals.exitCode);
