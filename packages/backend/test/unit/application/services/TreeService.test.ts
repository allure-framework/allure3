import { describe, it, expect } from 'vitest';
import { TreeService } from '../../../../src/application/services/TreeService.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { Label } from '../../../../src/domain/value-objects/Label.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TreeService', () => {
  const service = new TreeService();
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  function createTestResult(name: string, labels: Label[] = []): TestResult {
    return new TestResult(
      new TestResultId(`test-${name}`),
      new TestName(name),
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
      labels,
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
  }

  it('should build suites tree', () => {
    const results = [
      createTestResult('Test1', [new Label('suite', 'Suite1')]),
      createTestResult('Test2', [new Label('suite', 'Suite1')])
    ];
    const tree = service.buildSuitesTree(results);
    expect(tree.name).toBe('Suites');
    expect(tree.children).toBeDefined();
    expect(tree.children!.length).toBeGreaterThan(0);
  });

  it('should build packages tree', () => {
    const results = [
      createTestResult('Test1', [new Label('package', 'com.example')]),
      createTestResult('Test2', [new Label('package', 'com.example')])
    ];
    const tree = service.buildPackagesTree(results);
    expect(tree.name).toBe('Packages');
    expect(tree.children).toBeDefined();
  });

  it('should build behaviors tree', () => {
    const results = [
      createTestResult('Test1', [new Label('epic', 'Epic1'), new Label('story', 'Story1')]),
      createTestResult('Test2', [new Label('epic', 'Epic1'), new Label('story', 'Story1')])
    ];
    const tree = service.buildBehaviorsTree(results);
    expect(tree.name).toBe('Behaviors');
    expect(tree.children).toBeDefined();
  });
});
