import { TestResult } from '../entities/TestResult.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { TestName } from '../value-objects/TestName.js';
import { Status } from '../value-objects/Status.js';
import { TimeRange } from '../value-objects/TimeRange.js';
import { Label } from '../value-objects/Label.js';
import { Step } from '../entities/Step.js';
import type { SourceMetadata } from '../types/SourceMetadata.js';

export class TestResultBuilder {
  private id?: TestResultId;
  private name?: TestName;
  private status?: Status;
  private timeRange?: TimeRange;
  private fullName: string | null = null;
  private historyId = null;
  private testCase = null;
  private environment: string | null = null;
  private description: string | null = null;
  private descriptionHtml: string | null = null;
  private precondition: string | null = null;
  private preconditionHtml: string | null = null;
  private expectedResult: string | null = null;
  private expectedResultHtml: string | null = null;
  private error = null;
  private flaky = false;
  private muted = false;
  private known = false;
  private hidden = false;
  private transition = null;
  private hostId: string | null = null;
  private threadId: string | null = null;
  private labels: ReadonlyArray<Label> = [];
  private parameters: ReadonlyArray<any> = [];
  private links: ReadonlyArray<any> = [];
  private steps: ReadonlyArray<Step> = [];
  private retries: ReadonlyArray<TestResult> = [];
  private sourceMetadata?: SourceMetadata;
  private runSelector: string | null = null;

  withId(id: TestResultId): TestResultBuilder {
    this.id = id;
    return this;
  }

  withName(name: TestName): TestResultBuilder {
    this.name = name;
    return this;
  }

  withStatus(status: Status): TestResultBuilder {
    this.status = status;
    return this;
  }

  withTimeRange(timeRange: TimeRange): TestResultBuilder {
    this.timeRange = timeRange;
    return this;
  }

  withLabels(labels: ReadonlyArray<Label>): TestResultBuilder {
    this.labels = labels;
    return this;
  }

  withSteps(steps: ReadonlyArray<Step>): TestResultBuilder {
    this.steps = steps;
    return this;
  }

  withSourceMetadata(metadata: SourceMetadata): TestResultBuilder {
    this.sourceMetadata = metadata;
    return this;
  }

  build(): TestResult {
    if (!this.id) {
      throw new Error('TestResultId is required');
    }
    if (!this.name) {
      throw new Error('TestName is required');
    }
    if (!this.status) {
      throw new Error('Status is required');
    }
    if (!this.timeRange) {
      throw new Error('TimeRange is required');
    }
    if (!this.sourceMetadata) {
      throw new Error('SourceMetadata is required');
    }

    return new TestResult(
      this.id,
      this.name,
      this.status,
      this.timeRange,
      this.fullName,
      this.historyId,
      this.testCase,
      this.environment,
      this.description,
      this.descriptionHtml,
      this.precondition,
      this.preconditionHtml,
      this.expectedResult,
      this.expectedResultHtml,
      this.error,
      this.flaky,
      this.muted,
      this.known,
      this.hidden,
      this.transition,
      this.hostId,
      this.threadId,
      this.labels,
      this.parameters,
      this.links,
      this.steps,
      this.retries,
      this.sourceMetadata,
      this.runSelector
    );
  }
}
