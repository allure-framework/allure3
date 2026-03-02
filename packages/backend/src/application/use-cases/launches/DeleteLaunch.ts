import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { IAttachmentRepository } from '../../../domain/repositories/IAttachmentRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { NotFoundError } from '../../../presentation/api/middleware/errorHandler.js';

export class DeleteLaunch {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly testResultRepository: ITestResultRepository,
    private readonly attachmentRepository: IAttachmentRepository
  ) {}

  async execute(launchId: string): Promise<void> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      throw new NotFoundError('Launch', launchId);
    }

    // Get all test results for this launch
    const testResults = await this.testResultRepository.findByLaunchId(id);

    // Delete all test results (cascade will handle related data)
    for (const result of testResults) {
      await this.testResultRepository.delete(result.getId());
    }

    // Delete launch (cascade will handle attachments if needed)
    await this.launchRepository.delete(id);
  }
}
