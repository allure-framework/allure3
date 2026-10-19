import process from "node:process";

/** Opt-in lifecycle evidence for diagnosing Windows run shutdown stalls. */
export const logSupervisorDiagnostic = (stage: string) => {
  if (process.platform === "win32" && process.env.ALLURE_SUPERVISOR_DIAGNOSTICS === "1") {
    process.stderr.write(`[AllureSupervisorDiagnostic] ${new Date().toISOString()} node pid=${process.pid} ${stage}\n`);
  }
};
