import { currentEnvironment } from "@/stores/env";

export type ReportEnvSection = "variables" | "metadata";

export const getReportEnvSectionId = (section: ReportEnvSection, envId = currentEnvironment.value ?? "default") =>
  `report-${envId}-${section}`;
