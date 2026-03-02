import type { ILaunchGlobalsRepository } from '../../../domain/repositories/ILaunchGlobalsRepository.js';
import type { ILaunchVariablesRepository } from '../../../domain/repositories/ILaunchVariablesRepository.js';
import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';

export interface LaunchEnvironmentItem {
  id: string;
  name: string;
}

/** Extract human-readable display name from allureEnvironment or variables. */
function displayNameFromAllureEnvironment(
  allureEnv: Array<{ name: string; values?: string[] }> | undefined
): string | undefined {
  if (!allureEnv?.length) return undefined;
  const envEntry = allureEnv.find(
    (e) =>
      e.name?.toLowerCase() === 'environment' ||
      e.name?.toLowerCase() === 'name' ||
      e.name?.toLowerCase() === 'job_name' ||
      e.name?.toLowerCase() === 'env'
  );
  const val = envEntry?.values?.[0];
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

function displayNameFromVariables(vars: Record<string, string> | undefined): string | undefined {
  if (!vars || typeof vars !== 'object') return undefined;
  const keys = ['ENVIRONMENT', 'Environment', 'JOB_NAME', 'JobName', 'ENV_NAME', 'Name'];
  for (const k of keys) {
    const v = vars[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export class GetLaunchEnvironments {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly launchGlobalsRepository?: ILaunchGlobalsRepository,
    private readonly launchVariablesRepository?: ILaunchVariablesRepository
  ) {}

  async execute(launchId: string): Promise<LaunchEnvironmentItem[] | null> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);
    if (!launch) {
      return null;
    }

    const children = await this.launchRepository.findChildLaunches(id);
    if (children.length > 0) {
      const items: LaunchEnvironmentItem[] = [];
      for (const child of children) {
        let displayName = child.name;
        if (this.launchGlobalsRepository) {
          const globals = await this.launchGlobalsRepository.findByLaunchId(child.id);
          const fromEnv = displayNameFromAllureEnvironment(globals?.allureEnvironment);
          if (fromEnv) displayName = fromEnv;
        }
        if (displayName === child.name && this.launchVariablesRepository) {
          const vars = await this.launchVariablesRepository.findByLaunchId(child.id);
          const fromVars = displayNameFromVariables(vars ?? undefined);
          if (fromVars) displayName = fromVars;
        }
        items.push({ id: child.id, name: displayName });
      }
      return items;
    }

    return [{ id: launch.getId().getValue(), name: launch.getName() }];
  }
}
