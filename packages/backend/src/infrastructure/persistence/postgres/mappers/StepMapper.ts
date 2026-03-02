import { Step } from '../../../../domain/entities/Step.js';
import { StepEntity } from '../../entities/StepEntity.js';
import { StepAdapter } from '../../../../application/adapters/StepAdapter.js';
import type { DefaultTestStepResult } from '@allurereport/core-api';
import { randomUUID } from 'crypto';

export class StepMapper {
  static toEntity(domain: Step, testResultId: string, parentStepId: string | null = null): StepEntity {
    const entity = new StepEntity();
    entity.id = randomUUID();
    entity.testResultId = testResultId;
    entity.parentStepId = parentStepId;
    entity.name = domain.getName();
    entity.status = domain.getStatus().getValue();
    entity.stepId = domain.getStepId();
    const timeRange = domain.getTimeRange();
    entity.startTime = timeRange?.getStart() ?? null;
    entity.stopTime = timeRange?.getStop() ?? null;
    entity.duration = timeRange?.getDuration() ?? null;

    const error = domain.getError();
    entity.error = error
      ? {
          message: error.getMessage() || undefined,
          trace: error.getTrace() || undefined,
          actual: error.getActual() || undefined,
          expected: error.getExpected() || undefined
        }
      : null;

    entity.message = domain.getMessage();
    entity.trace = domain.getTrace();

    entity.steps = domain.getSteps().map((subStep) => StepAdapter.toDTO(subStep));
    entity.parameters = domain.getParameters().map((param) => ({
      name: param.getName(),
      value: param.getValue(),
      hidden: param.isHidden(),
      excluded: param.isExcluded(),
      masked: param.isMasked()
    }));

    return entity;
  }

  static toDomain(entity: StepEntity): Step {
    const nestedDtos = (entity.steps as DefaultTestStepResult[] | null) ?? [];
    const stepDtos = Array.isArray(nestedDtos) ? nestedDtos : [];
    return StepAdapter.toDomain({
      name: entity.name,
      parameters: entity.parameters ?? [],
      status: entity.status,
      error: entity.error,
      start: entity.startTime ?? undefined,
      stop: entity.stopTime ?? undefined,
      duration: entity.duration ?? undefined,
      steps: stepDtos,
      stepId: entity.stepId ?? undefined,
      type: 'step',
      message: entity.message ?? undefined,
      trace: entity.trace ?? undefined
    } as DefaultTestStepResult);
  }
}
