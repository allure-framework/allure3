export type ReportVariables = Record<string, string>;

export interface ILaunchVariablesRepository {
  findByLaunchId(launchId: string): Promise<ReportVariables | null>;
  save(launchId: string, variables: ReportVariables): Promise<void>;
}
