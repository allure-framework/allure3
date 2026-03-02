export class Parameter {
  constructor(
    private readonly name: string,
    private readonly value: string,
    private readonly hidden: boolean = false,
    private readonly excluded: boolean = false,
    private readonly masked: boolean = false
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Parameter name cannot be empty');
    }
  }

  getName(): string {
    return this.name;
  }

  getValue(): string {
    return this.value;
  }

  isHidden(): boolean {
    return this.hidden;
  }

  isExcluded(): boolean {
    return this.excluded;
  }

  isMasked(): boolean {
    return this.masked;
  }

  equals(other: Parameter): boolean {
    return (
      this.name === other.name &&
      this.value === other.value &&
      this.hidden === other.hidden &&
      this.excluded === other.excluded &&
      this.masked === other.masked
    );
  }
}
