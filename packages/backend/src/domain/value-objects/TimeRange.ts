export class TimeRange {
  constructor(
    private readonly start: number | null,
    private readonly stop: number | null
  ) {
    if (start !== null && start < 0) {
      throw new Error('Start time cannot be negative');
    }
    if (stop !== null && stop < 0) {
      throw new Error('Stop time cannot be negative');
    }
    if (start !== null && stop !== null && start > stop) {
      throw new Error('Start time cannot be greater than stop time');
    }
  }

  getStart(): number | null {
    return this.start;
  }

  getStop(): number | null {
    return this.stop;
  }

  getDuration(): number | null {
    if (this.start === null || this.stop === null) {
      return null;
    }
    return this.stop - this.start;
  }

  isValid(): boolean {
    if (this.start === null && this.stop === null) {
      return true;
    }
    if (this.start === null || this.stop === null) {
      return true; // Partial range is valid
    }
    return this.start <= this.stop;
  }

  equals(other: TimeRange): boolean {
    return this.start === other.start && this.stop === other.stop;
  }
}
