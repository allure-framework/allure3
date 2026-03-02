import { TestResult } from '../../../domain/entities/TestResult.js';
import { TreeService } from '../../services/TreeService.js';
import { LaunchResolutionService } from '../../services/LaunchResolutionService.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { TreeResponse } from '../../dto/responses/TreeResponse.js';

export type TreeType = 'suites' | 'packages' | 'behaviors' | 'categories';

export class GetTreeData {
  private readonly treeService: TreeService;

  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchResolutionService: LaunchResolutionService
  ) {
    this.treeService = new TreeService();
  }

  async execute(type: TreeType, launchId?: string, environment?: string): Promise<TreeResponse> {
    let results: TestResult[];

    if (launchId) {
      const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment);
      results = await this.testResultRepository.findByLaunchIds(launchIds);
    } else {
      results = [];
    }

    let root;
    switch (type) {
      case 'suites':
        root = this.treeService.buildSuitesTree(results);
        break;
      case 'packages':
        root = this.treeService.buildPackagesTree(results);
        break;
      case 'behaviors':
        root = this.treeService.buildBehaviorsTree(results);
        break;
      case 'categories':
        root = this.treeService.buildCategoriesTree(results);
        break;
      default:
        throw new Error(`Invalid tree type: ${type}`);
    }

    return {
      type,
      root
    };
  }
}
