import { Status } from '../value-objects/Status.js';
import { TimeRange } from '../value-objects/TimeRange.js';
import { TestError } from '../value-objects/TestError.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { Step } from './Step.js';
import type { SourceMetadata } from '../types/SourceMetadata.js';

export class TestFixtureResult {
  constructor(
    private readonly id: string,
    private readonly type: 'before' | 'after',
    private readonly name: string,
    private readonly status: Status,
    private readonly timeRange: TimeRange,
    private readonly error: TestError | null = null,
    private readonly steps: ReadonlyArray<Step> = [],
    private readonly testResultIds: ReadonlyArray<TestResultId> = [],
    private readonly sourceMetadata: SourceMetadata
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('TestFixtureResult ID cannot be empty');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('TestFixtureResult name cannot be empty');
    }
    if (type !== 'before' && type !== 'after') {
      throw new Error(`Invalid TestFixtureResult type: ${type}`);
    }
  }

  getId(): string {
    return this.id;
  }

  getType(): 'before' | 'after' {
    return this.type;
  }

  getName(): string {
    return this.name;
  }

  getStatus(): Status {
    return this.status;
  }

  getTimeRange(): TimeRange {
    return this.timeRange;
  }

  getError(): TestError | null {
    return this.error;
  }

  getSteps(): ReadonlyArray<Step> {
    return [...this.steps];
  }

  getTestResultIds(): ReadonlyArray<TestResultId> {
    return [...this.testResultIds];
  }

  getSourceMetadata(): SourceMetadata {
    return this.sourceMetadata;
  }

  isBefore(): boolean {
    return this.type === 'before';
  }

  isAfter(): boolean {
    return this.type === 'after';
  }
}
