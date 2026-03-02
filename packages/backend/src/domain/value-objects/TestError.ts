export class TestError {
  constructor(
    private readonly message: string | null = null,
    private readonly trace: string | null = null,
    private readonly actual: string | null = null,
    private readonly expected: string | null = null
  ) {}

  getMessage(): string | null {
    return this.message;
  }

  getTrace(): string | null {
    return this.trace;
  }

  getActual(): string | null {
    return this.actual;
  }

  getExpected(): string | null {
    return this.expected;
  }

  hasError(): boolean {
    return this.message !== null || this.trace !== null || this.actual !== null || this.expected !== null;
  }

  equals(other: TestError): boolean {
    return (
      this.message === other.message &&
      this.trace === other.trace &&
      this.actual === other.actual &&
      this.expected === other.expected
    );
  }
}
