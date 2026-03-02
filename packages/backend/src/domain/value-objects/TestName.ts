export class TestName {
  private static readonly MAX_LENGTH = 10000; // Reasonable limit

  constructor(
    private readonly value: string,
    private readonly fullName: string | null = null
  ) {
    if (!value || value.trim().length === 0) {
      throw new Error('TestName cannot be empty');
    }
    if (value.length > TestName.MAX_LENGTH) {
      throw new Error(`TestName exceeds maximum length of ${TestName.MAX_LENGTH}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  getFullName(): string | null {
    return this.fullName;
  }

  equals(other: TestName): boolean {
    return this.value === other.value && this.fullName === other.fullName;
  }
}
