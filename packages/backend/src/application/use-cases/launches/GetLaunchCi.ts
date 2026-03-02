import type { CiDescriptor } from '@allurereport/core-api';
import { CiType } from '@allurereport/core-api';
import type { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';

const EXECUTOR_TYPE_TO_CI_TYPE: Record<string, CiType> = {
  amazon: CiType.Amazon,
  azure: CiType.Azure,
  bitbucket: CiType.Bitbucket,
  circle: CiType.Circle,
  drone: CiType.Drone,
  github: CiType.Github,
  gitlab: CiType.Gitlab,
  jenkins: CiType.Jenkins,
  local: CiType.Local,
};

function mapExecutorToCiDescriptor(executor: {
  getName: () => string | null;
  getType: () => string | null;
  getUrl: () => string | null;
  getBuildName: () => string | null;
  getBuildUrl: () => string | null;
  getReportName: () => string | null;
  getReportUrl: () => string | null;
}): CiDescriptor {
  const typeStr = (executor.getType() ?? '').toLowerCase();
  const ciType = EXECUTOR_TYPE_TO_CI_TYPE[typeStr] ?? CiType.Local;

  return {
    type: ciType,
    detected: false,
    repoName: '',
    jobUid: '',
    jobUrl: executor.getUrl() ?? '',
    jobName: executor.getName() ?? '',
    jobRunUid: '',
    jobRunUrl: executor.getBuildUrl() ?? '',
    jobRunName: executor.getBuildName() ?? '',
    jobRunBranch: '',
    pullRequestName: executor.getReportName() ?? '',
    pullRequestUrl: executor.getReportUrl() ?? '',
  };
}

export class GetLaunchCi {
  constructor(private readonly launchRepository: ILaunchRepository) {}

  async execute(launchId: string): Promise<CiDescriptor | null> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      return null;
    }

    let executor = launch.getExecutor();

    if (executor) {
      return mapExecutorToCiDescriptor(executor);
    }

    const parentId = launch.getParentLaunchId();
    if (parentId) {
      const parent = await this.launchRepository.findById(parentId);
      executor = parent?.getExecutor() ?? null;
    } else {
      const childIds = await this.launchRepository.findChildLaunchIds(id);
      for (const childId of childIds) {
        const child = await this.launchRepository.findById(childId);
        if (child?.getExecutor()) {
          executor = child.getExecutor();
          break;
        }
      }
    }

    if (!executor) {
      return null;
    }

    return mapExecutorToCiDescriptor(executor);
  }
}
