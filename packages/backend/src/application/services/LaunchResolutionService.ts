import { ILaunchRepository } from '../../domain/repositories/ILaunchRepository.js';
import { LaunchId } from '../../domain/value-objects/LaunchId.js';

/**
 * Resolves launch_id (and optional environment) to the list of launch ids
 * whose test results should be aggregated for read operations.
 * - If launch has children: returns child launch ids (or [environment] when environment is specified).
 * - If launch has no children: returns [launchId].
 */
export class LaunchResolutionService {
  constructor(private readonly launchRepository: ILaunchRepository) {}

  async resolveLaunchIdsForRead(launchId: string, environment?: string): Promise<string[]> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);
    if (!launch) {
      throw new Error(`Launch not found: ${launchId}`);
    }

    const childIds = await this.launchRepository.findChildLaunchIds(id);
    if (childIds.length > 0) {
      // "default" or no env = aggregate all children; specific env = filter to that child
      if (environment && environment !== "default") {
        const childIdValues = childIds.map((cid) => cid.getValue());
        if (childIdValues.includes(environment)) {
          return [environment];
        }
        return [];
      }
      return childIds.map((cid) => cid.getValue());
    }

    // No children: use launch itself (environment "default" or launchId both mean "this launch")
    return [launchId];
  }
}
