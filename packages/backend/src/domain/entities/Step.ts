import { Status } from '../value-objects/Status.js';
import { TimeRange } from '../value-objects/TimeRange.js';
import { TestError } from '../value-objects/TestError.js';
import { Parameter } from '../value-objects/Parameter.js';

export class Step {
  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly status: Status,
    private readonly timeRange: TimeRange | null = null,
    private readonly error: TestError | null = null,
    private readonly parameters: ReadonlyArray<Parameter> = [],
    private readonly steps: ReadonlyArray<Step> = [],
    private readonly stepId: string | null = null,
    private readonly message: string | null = null,
    private readonly trace: string | null = null,
    private readonly hasSimilarErrorInSubSteps: boolean = false
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('Step ID cannot be empty');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Step name cannot be empty');
    }
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getStatus(): Status {
    return this.status;
  }

  getTimeRange(): TimeRange | null {
    return this.timeRange;
  }

  getError(): TestError | null {
    return this.error;
  }

  getParameters(): ReadonlyArray<Parameter> {
    return [...this.parameters];
  }

  getSteps(): ReadonlyArray<Step> {
    return [...this.steps];
  }

  getStepId(): string | null {
    return this.stepId;
  }

  getMessage(): string | null {
    return this.message;
  }

  getTrace(): string | null {
    return this.trace;
  }

  hasSubSteps(): boolean {
    return this.steps.length > 0;
  }

  getDepth(): number {
    if (!this.hasSubSteps()) {
      return 0;
    }
    return 1 + Math.max(...this.steps.map((step) => step.getDepth()));
  }

  getHasSimilarErrorInSubSteps(): boolean {
    return this.hasSimilarErrorInSubSteps;
  }
}
