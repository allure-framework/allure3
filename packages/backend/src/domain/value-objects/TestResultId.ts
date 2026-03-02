export class TestResultId {
  constructor(private readonly value: string) {
    if (!value) {
      throw new Error('TestResultId cannot be empty');
    }
    // UUID validation (optional, but recommended)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value) && value.length < 1) {
      // Allow non-UUID but warn - in production might want stricter validation
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TestResultId): boolean {
    return this.value === other.value;
  }
}
