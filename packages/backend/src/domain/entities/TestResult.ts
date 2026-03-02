import { TestResultId } from '../value-objects/TestResultId.js';
import { TestName } from '../value-objects/TestName.js';
import { Status } from '../value-objects/Status.js';
import { HistoryId } from '../value-objects/HistoryId.js';
import { TimeRange } from '../value-objects/TimeRange.js';
import { TestError } from '../value-objects/TestError.js';
import { StatusTransition } from '../value-objects/StatusTransition.js';
import { Label } from '../value-objects/Label.js';
import { Parameter } from '../value-objects/Parameter.js';
import { Link } from '../value-objects/Link.js';
import { Step } from './Step.js';
import type { TestCase } from '../types/TestCase.js';
import type { SourceMetadata } from '../types/SourceMetadata.js';

export class TestResult {
  constructor(
    private readonly id: TestResultId,
    private readonly name: TestName,
    private readonly status: Status,
    private readonly timeRange: TimeRange,
    private readonly fullName: string | null = null,
    private readonly historyId: HistoryId | null = null,
    private readonly testCase: TestCase | null = null,
    private readonly environment: string | null = null,
    private readonly description: string | null = null,
    private readonly descriptionHtml: string | null = null,
    private readonly precondition: string | null = null,
    private readonly preconditionHtml: string | null = null,
    private readonly expectedResult: string | null = null,
    private readonly expectedResultHtml: string | null = null,
    private readonly error: TestError | null = null,
    private readonly flaky: boolean = false,
    private readonly muted: boolean = false,
    private readonly known: boolean = false,
    private readonly hidden: boolean = false,
    private readonly transition: StatusTransition | null = null,
    private readonly hostId: string | null = null,
    private readonly threadId: string | null = null,
    private readonly labels: ReadonlyArray<Label> = [],
    private readonly parameters: ReadonlyArray<Parameter> = [],
    private readonly links: ReadonlyArray<Link> = [],
    private readonly steps: ReadonlyArray<Step> = [],
    private readonly retries: ReadonlyArray<TestResult> = [],
    private readonly sourceMetadata: SourceMetadata,
    private readonly runSelector: string | null = null
  ) {}

  getId(): TestResultId {
    return this.id;
  }

  getName(): TestName {
    return this.name;
  }

  getFullName(): string | null {
    return this.fullName;
  }

  getStatus(): Status {
    return this.status;
  }

  getHistoryId(): HistoryId | null {
    return this.historyId;
  }

  getTestCase(): TestCase | null {
    return this.testCase;
  }

  getEnvironment(): string | null {
    return this.environment;
  }

  getTimeRange(): TimeRange {
    return this.timeRange;
  }

  getDescription(): string | null {
    return this.description;
  }

  getDescriptionHtml(): string | null {
    return this.descriptionHtml;
  }

  getPrecondition(): string | null {
    return this.precondition;
  }

  getPreconditionHtml(): string | null {
    return this.preconditionHtml;
  }

  getExpectedResult(): string | null {
    return this.expectedResult;
  }

  getExpectedResultHtml(): string | null {
    return this.expectedResultHtml;
  }

  getError(): TestError | null {
    return this.error;
  }

  isFlaky(): boolean {
    return this.flaky;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isKnown(): boolean {
    return this.known;
  }

  isHidden(): boolean {
    return this.hidden;
  }

  getTransition(): StatusTransition | null {
    return this.transition;
  }

  getHostId(): string | null {
    return this.hostId;
  }

  getThreadId(): string | null {
    return this.threadId;
  }

  getLabels(): ReadonlyArray<Label> {
    return [...this.labels];
  }

  getParameters(): ReadonlyArray<Parameter> {
    return [...this.parameters];
  }

  getLinks(): ReadonlyArray<Link> {
    return [...this.links];
  }

  getSteps(): ReadonlyArray<Step> {
    return [...this.steps];
  }

  getRetries(): ReadonlyArray<TestResult> {
    return [...this.retries];
  }

  getSourceMetadata(): SourceMetadata {
    return this.sourceMetadata;
  }

  getRunSelector(): string | null {
    return this.runSelector;
  }

  hasRetries(): boolean {
    return this.retries.length > 0;
  }

  getRetriesCount(): number {
    return this.retries.length;
  }

  findLabelByName(name: string): Label | null {
    return this.labels.find((label) => label.getName() === name) || null;
  }

  findLabelsByName(name: string): ReadonlyArray<Label> {
    return this.labels.filter((label) => label.getName() === name);
  }

  hasLabel(name: string, value?: string): boolean {
    const matchingLabels = this.findLabelsByName(name);
    if (matchingLabels.length === 0) {
      return false;
    }
    if (value === undefined) {
      return true;
    }
    return matchingLabels.some((label) => label.getValue() === value);
  }
}
