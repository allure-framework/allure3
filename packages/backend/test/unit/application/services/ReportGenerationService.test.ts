import { describe, it, expect } from 'vitest';
import { ReportGenerationService } from '../../../../src/application/services/ReportGenerationService.js';
import { PluginService } from '../../../../src/application/services/PluginService.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('ReportGenerationService', () => {
  const pluginService = new PluginService();
  const service = new ReportGenerationService(pluginService);
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  function createTestResult(): TestResult {
    return new TestResult(
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
  }

  it('should prepare AllureStore from test results', async () => {
    const results = [createTestResult()];
    const store = await service.prepareAllureStore(results);
    const allResults = await store.allTestResults();
    expect(allResults.length).toBe(1);
    expect(allResults[0].id).toBe('test-id');
  });

  it('should find test result by ID', async () => {
    const results = [createTestResult()];
    const store = await service.prepareAllureStore(results);
    const result = await store.testResultById('test-id');
    expect(result).toBeDefined();
    expect(result?.id).toBe('test-id');
  });
});
