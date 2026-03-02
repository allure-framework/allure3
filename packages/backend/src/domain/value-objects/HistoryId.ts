export class HistoryId {
  constructor(private readonly value: string) {
    if (!value) {
      throw new Error('HistoryId cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: HistoryId): boolean {
    return this.value === other.value;
  }
}
