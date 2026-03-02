import type { TestStepResult, DefaultTestStepResult, TestError as TestErrorDTO } from '@allurereport/core-api';
import { Step } from '../../domain/entities/Step.js';
import { Status } from '../../domain/value-objects/Status.js';
import { TimeRange } from '../../domain/value-objects/TimeRange.js';
import { TestError } from '../../domain/value-objects/TestError.js';
import { Parameter } from '../../domain/value-objects/Parameter.js';

export class StepAdapter {
  static toDomain(dto: TestStepResult): Step {
    if (dto.type === 'attachment') {
      throw new Error('Attachment steps are not supported in domain model');
    }

    const defaultStep = dto as DefaultTestStepResult;
    const status = new Status(defaultStep.status);
    const timeRange = defaultStep.start !== undefined && defaultStep.stop !== undefined
      ? new TimeRange(defaultStep.start, defaultStep.stop)
      : null;

    const error = defaultStep.error
      ? new TestError(
          defaultStep.error.message || null,
          defaultStep.error.trace || null,
          defaultStep.error.actual || null,
          defaultStep.error.expected || null
        )
      : null;

    const parameters = (defaultStep.parameters || []).map(
      (param) => new Parameter(param.name, param.value, param.hidden, param.excluded, param.masked)
    );

    const steps = (defaultStep.steps || []).map((subStep) => StepAdapter.toDomain(subStep));

    // Generate ID if not provided
    const id = defaultStep.stepId || `step-${Date.now()}-${Math.random()}`;

    return new Step(
      id,
      defaultStep.name,
      status,
      timeRange,
      error,
      parameters,
      steps,
      defaultStep.stepId || null,
      defaultStep.message || null,
      defaultStep.trace || null,
      defaultStep.hasSimilarErrorInSubSteps || false
    );
  }

  static toDTO(domain: Step): DefaultTestStepResult {
    const timeRange = domain.getTimeRange();
    const error = domain.getError();

    const errorDto: TestErrorDTO | undefined = error
      ? {
          message: error.getMessage() || undefined,
          trace: error.getTrace() || undefined,
          actual: error.getActual() || undefined,
          expected: error.getExpected() || undefined
        }
      : undefined;

    return {
      name: domain.getName(),
      parameters: domain.getParameters().map((param) => ({
        name: param.getName(),
        value: param.getValue(),
        hidden: param.isHidden(),
        excluded: param.isExcluded(),
        masked: param.isMasked()
      })),
      status: domain.getStatus().getValue(),
      error: errorDto,
      start: timeRange?.getStart() || undefined,
      stop: timeRange?.getStop() || undefined,
      duration: timeRange?.getDuration() || undefined,
      steps: domain.getSteps().map((subStep) => StepAdapter.toDTO(subStep)),
      stepId: domain.getStepId() || undefined,
      type: 'step',
      message: domain.getMessage() || undefined,
      trace: domain.getTrace() || undefined,
      hasSimilarErrorInSubSteps: domain.getHasSimilarErrorInSubSteps()
    };
  }
}
