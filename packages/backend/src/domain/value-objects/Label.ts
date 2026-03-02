export class Label {
  constructor(
    private readonly name: string,
    private readonly value: string | null = null
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Label name cannot be empty');
    }
  }

  getName(): string {
    return this.name;
  }

  getValue(): string | null {
    return this.value;
  }

  equals(other: Label): boolean {
    return this.name === other.name && this.value === other.value;
  }
}
