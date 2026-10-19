import process from "node:process";

export const supervisorDiagnosticsEnabled = () =>
  process.env.ALLURE_SUPERVISOR_DIAGNOSTICS === undefined ||
  /^(1|true)$/i.test(process.env.ALLURE_SUPERVISOR_DIAGNOSTICS);
