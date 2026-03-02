import { describe, it, expect } from 'vitest';
import { TestFixtureAdapter } from '../../../../src/application/adapters/TestFixtureAdapter.js';
import type { TestFixtureResult as TestFixtureResultDTO } from '@allurereport/core-api';
import { TestFixtureResult } from '../../../../src/domain/entities/TestFixtureResult.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestFixtureAdapter', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  it('should convert DTO to Domain', () => {
    const dto: TestFixtureResultDTO = {
      id: 'fixture-id',
      testResultIds: ['test-result-1'],
      type: 'before',
      name: 'Before Hook',
      status: 'passed',
      steps: [],
      sourceMetadata
    };

    const domain = TestFixtureAdapter.toDomain(dto);
    expect(domain.getId()).toBe('fixture-id');
    expect(domain.getType()).toBe('before');
    expect(domain.getName()).toBe('Before Hook');
  });

  it('should convert Domain to DTO', () => {
    const domain = new TestFixtureResult(
      'fixture-id',
      'after',
      'After Hook',
      new Status('passed'),
      new TimeRange(1000, 2000),
      null,
      [],
      [],
      sourceMetadata
    );

    const dto = TestFixtureAdapter.toDTO(domain);
    expect(dto.id).toBe('fixture-id');
    expect(dto.type).toBe('after');
    expect(dto.name).toBe('After Hook');
  });
});
