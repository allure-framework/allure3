import type { TestFixtureResult as TestFixtureResultDTO, TestStepResult } from '@allurereport/core-api';
import { TestFixtureResult } from '../../domain/entities/TestFixtureResult.js';
import { Status } from '../../domain/value-objects/Status.js';
import { TimeRange } from '../../domain/value-objects/TimeRange.js';
import { TestError } from '../../domain/value-objects/TestError.js';
import { TestResultId } from '../../domain/value-objects/TestResultId.js';
import { StepAdapter } from './StepAdapter.js';
import type { SourceMetadata } from '../../domain/types/SourceMetadata.js';

export class TestFixtureAdapter {
  static toDomain(dto: TestFixtureResultDTO): TestFixtureResult {
    const status = new Status(dto.status);
    const timeRange = new TimeRange(dto.start || null, dto.stop || null);

    const error = dto.error
      ? new TestError(
          dto.error.message || null,
          dto.error.trace || null,
          dto.error.actual || null,
          dto.error.expected || null
        )
      : null;

    const steps = dto.steps.map((stepDto) => StepAdapter.toDomain(stepDto));

    const testResultIds = dto.testResultIds.map((id) => new TestResultId(id));

    const sourceMetadata: SourceMetadata = {
      readerId: dto.sourceMetadata.readerId,
      metadata: dto.sourceMetadata.metadata
    };

    return new TestFixtureResult(
      dto.id,
      dto.type,
      dto.name,
      status,
      timeRange,
      error,
      steps,
      testResultIds,
      sourceMetadata
    );
  }

  static toDTO(domain: TestFixtureResult): TestFixtureResultDTO {
    const timeRange = domain.getTimeRange();
    const error = domain.getError();

    return {
      id: domain.getId(),
      testResultIds: domain.getTestResultIds().map((id) => id.getValue()),
      type: domain.getType(),
      name: domain.getName(),
      status: domain.getStatus().getValue(),
      error: error
        ? {
            message: error.getMessage() || undefined,
            trace: error.getTrace() || undefined,
            actual: error.getActual() || undefined,
            expected: error.getExpected() || undefined
          }
        : undefined,
      start: timeRange.getStart() || undefined,
      stop: timeRange.getStop() || undefined,
      duration: timeRange.getDuration() || undefined,
      steps: domain.getSteps().map((step) => StepAdapter.toDTO(step)),
      sourceMetadata: domain.getSourceMetadata()
    };
  }
}
