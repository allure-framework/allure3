export enum CiType {
  Amazon = "amazon",
  Azure = "azure",
  Bitbucket = "bitbucket",
  Circle = "circle",
  Drone = "drone",
  Github = "github",
  Gitlab = "gitlab",
  Jenkins = "jenkins",
  Local = "local",
}

export interface CiDescriptor {
  type: CiType;
  detected: boolean;
  repoName: string;
  jobUid: string;
  jobUrl: string;
  jobName: string;
  jobRunUid: string;
  jobRunUrl: string;
  jobRunName: string;
  jobRunBranch: string;
  pullRequestName: string;
  pullRequestUrl: string;
}
