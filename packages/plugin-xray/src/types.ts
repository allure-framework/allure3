export type XrayStatus = "PASS" | "FAIL" | "TODO";

export interface XrayTestRun {
  id: number;
  key: string;
  status: string;
}
