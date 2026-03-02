import { describe, it, expect } from 'vitest';
import { StepAdapter } from '../../../../src/application/adapters/StepAdapter.js';
import type { DefaultTestStepResult } from '@allurereport/core-api';
import { Step } from '../../../../src/domain/entities/Step.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('StepAdapter', () => {
  it('should convert DTO to Domain', () => {
    const dto: DefaultTestStepResult = {
      name: 'Step Name',
      status: 'passed',
      type: 'step',
      parameters: [],
      steps: [],
      start: 1000,
      stop: 2000,
      duration: 1000
    };

    const domain = StepAdapter.toDomain(dto);
    expect(domain.getName()).toBe('Step Name');
    expect(domain.getStatus().getValue()).toBe('passed');
  });

  it('should convert Domain to DTO', () => {
    const domain = new Step(
      'step-id',
      'Step Name',
      new Status('passed'),
      null,
      null,
      [],
      []
    );

    const dto = StepAdapter.toDTO(domain);
    expect(dto.name).toBe('Step Name');
    expect(dto.status).toBe('passed');
    expect(dto.type).toBe('step');
  });

  it('should handle nested steps', () => {
    const subStepDto: DefaultTestStepResult = {
      name: 'Sub Step',
      status: 'passed',
      type: 'step',
      parameters: [],
      steps: []
    };

    const dto: DefaultTestStepResult = {
      name: 'Parent Step',
      status: 'passed',
      type: 'step',
      parameters: [],
      steps: [subStepDto]
    };

    const domain = StepAdapter.toDomain(dto);
    expect(domain.hasSubSteps()).toBe(true);
    expect(domain.getSteps().length).toBe(1);
  });
});
