export type TestStatusTransition = 'regressed' | 'fixed' | 'malfunctioned' | 'new';

export class StatusTransition {
  private static readonly VALID_TRANSITIONS: TestStatusTransition[] = [
    'regressed',
    'fixed',
    'malfunctioned',
    'new'
  ];

  constructor(private readonly value: TestStatusTransition) {
    if (!StatusTransition.VALID_TRANSITIONS.includes(value)) {
      throw new Error(`Invalid status transition: ${value}`);
    }
  }

  getValue(): TestStatusTransition {
    return this.value;
  }

  equals(other: StatusTransition): boolean {
    return this.value === other.value;
  }
}
