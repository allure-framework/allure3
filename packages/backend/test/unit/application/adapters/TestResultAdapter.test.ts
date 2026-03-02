import { describe, it, expect } from 'vitest';
import { TestResultAdapter } from '../../../../src/application/adapters/TestResultAdapter.js';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestResultAdapter', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  it('should convert DTO to Domain', () => {
    const dto: TestResultDTO = {
      id: 'test-id',
      name: 'Test Name',
      status: 'passed',
      flaky: false,
      muted: false,
      known: false,
      hidden: false,
      labels: [],
      parameters: [],
      links: [],
      steps: [],
      sourceMetadata
    };

    const domain = TestResultAdapter.toDomain(dto);
    expect(domain.getId().getValue()).toBe('test-id');
    expect(domain.getName().getValue()).toBe('Test Name');
    expect(domain.getStatus().getValue()).toBe('passed');
  });

  it('should convert Domain to DTO', () => {
    const domain = new TestResult(
      new TestResultId('test-id'),
      new TestName('Test Name'),
      new Status('passed'),
      new TimeRange(1000, 2000),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      false,
      false,
      null,
      null,
      null,
      [],
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );

    const dto = TestResultAdapter.toDTO(domain);
    expect(dto.id).toBe('test-id');
    expect(dto.name).toBe('Test Name');
    expect(dto.status).toBe('passed');
  });

  it('should handle full DTO with all fields', () => {
    const dto: TestResultDTO = {
      id: 'test-id',
      name: 'Test Name',
      fullName: 'Full Test Name',
      status: 'failed',
      error: {
        message: 'Error message',
        trace: 'Stack trace'
      },
      flaky: true,
      muted: false,
      known: false,
      hidden: false,
      labels: [{ name: 'suite', value: 'MySuite' }],
      parameters: [{ name: 'param1', value: 'value1', hidden: false, excluded: false, masked: false }],
      links: [{ url: 'https://example.com', name: 'Link', type: 'issue' }],
      steps: [],
      sourceMetadata,
      start: 1000,
      stop: 2000,
      duration: 1000
    };

    const domain = TestResultAdapter.toDomain(dto);
    expect(domain.getFullName()).toBe('Full Test Name');
    expect(domain.isFlaky()).toBe(true);
    expect(domain.getError()?.getMessage()).toBe('Error message');
    expect(domain.getLabels().length).toBe(1);
  });
});
