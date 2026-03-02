import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import type { ILaunchVariablesRepository } from '../../../domain/repositories/ILaunchVariablesRepository.js';
import { LaunchFactory } from '../../../domain/factories/LaunchFactory.js';
import { LaunchAdapter } from '../../adapters/LaunchAdapter.js';
import { LaunchResponse } from '../../dto/responses/LaunchResponse.js';
import { CreateLaunchRequest } from '../../dto/requests/CreateLaunchRequest.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { DomainError } from '../../../presentation/api/middleware/errorHandler.js';

export class CreateLaunch {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly launchFactory: LaunchFactory,
    private readonly launchVariablesRepository: ILaunchVariablesRepository
  ) {}

  async execute(request: CreateLaunchRequest): Promise<LaunchResponse> {
    const { name, executor, environment, parentLaunchId, runKey, environmentName } = LaunchAdapter.fromDTO(request);
    const executorInfo = executor || undefined;
    const variables = request.variables && Object.keys(request.variables).length > 0 ? request.variables : undefined;

    if (parentLaunchId) {
      const parentId = new LaunchId(parentLaunchId);
      const parent = await this.launchRepository.findById(parentId);
      if (!parent) {
        throw new Error('Parent launch not found');
      }
      if (parent.getParentLaunchId() !== null) {
        throw new Error('Parent must be a root launch (only one level of nesting allowed)');
      }
      const childName = environmentName ?? name ?? 'Launch';
      const child = this.launchFactory.createChild(parentId, childName, executorInfo);
      await this.launchRepository.save(child);
      if (variables) {
        await this.launchVariablesRepository.save(child.getId().getValue(), variables);
      }
      return LaunchAdapter.toDTO(child);
    }

    if (runKey) {
      if (environmentName) {
        let root = await this.launchRepository.findByRunKey(runKey);
        if (!root) {
          root = this.launchFactory.createRoot(name ?? runKey, executorInfo, runKey);
          await this.launchRepository.save(root);
        }
        const children = await this.launchRepository.findChildLaunches(root.getId());
        if (children.some((c) => c.name === environmentName)) {
          throw new DomainError(`Duplicate environment_name '${environmentName}' for run_key '${runKey}'`);
        }
        const child = this.launchFactory.createChild(root.getId(), environmentName, executorInfo);
        await this.launchRepository.save(child);
        if (variables) {
          await this.launchVariablesRepository.save(child.getId().getValue(), variables);
        }
        return LaunchAdapter.toDTO(child);
      }
      const root = this.launchFactory.createRoot(name ?? runKey, executorInfo, runKey);
      await this.launchRepository.save(root);
      if (variables) {
        await this.launchVariablesRepository.save(root.getId().getValue(), variables);
      }
      return LaunchAdapter.toDTO(root);
    }

    if (!name) {
      throw new Error('name is required when not using parent_launch_id or run_key');
    }
    const launch = this.launchFactory.create(name, executorInfo);
    await this.launchRepository.save(launch);
    if (variables) {
      await this.launchVariablesRepository.save(launch.getId().getValue(), variables);
    }
    return LaunchAdapter.toDTO(launch);
  }
}
