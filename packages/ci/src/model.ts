export interface Detector {
  type: string;
  detected: boolean;
  jobUID: string;
  jobURL: string;
  jobName: string;
  jobRunUID: string;
  jobRunURL: string;
  jobRunName: string;
  jobRunBranch: string;
}
