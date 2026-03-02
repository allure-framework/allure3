export type TestStatus = 'failed' | 'broken' | 'passed' | 'skipped' | 'unknown';

export class Status {
  private static readonly VALID_STATUSES: TestStatus[] = ['failed', 'broken', 'passed', 'skipped', 'unknown'];
  private static readonly PRIORITIES: Record<TestStatus, number> = {
    failed: 0,
    broken: 1,
    passed: 2,
    skipped: 3,
    unknown: 4
  };

  constructor(private readonly value: TestStatus) {
    if (!Status.VALID_STATUSES.includes(value)) {
      throw new Error(`Invalid status: ${value}`);
    }
  }

  getValue(): TestStatus {
    return this.value;
  }

  isPassed(): boolean {
    return this.value === 'passed';
  }

  isFailed(): boolean {
    return this.value === 'failed' || this.value === 'broken';
  }

  isBroken(): boolean {
    return this.value === 'broken';
  }

  isSkipped(): boolean {
    return this.value === 'skipped';
  }

  isUnknown(): boolean {
    return this.value === 'unknown';
  }

  isWorseThan(other: Status): boolean {
    return Status.PRIORITIES[this.value] < Status.PRIORITIES[other.value];
  }

  getPriority(): number {
    return Status.PRIORITIES[this.value];
  }

  equals(other: Status): boolean {
    return this.value === other.value;
  }
}
