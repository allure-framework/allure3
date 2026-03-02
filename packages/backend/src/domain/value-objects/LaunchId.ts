export class LaunchId {
  constructor(private readonly value: string) {
    if (!value) {
      throw new Error('LaunchId cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: LaunchId): boolean {
    return this.value === other.value;
  }
}
