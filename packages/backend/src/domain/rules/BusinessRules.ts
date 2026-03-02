import { Launch } from '../entities/Launch.js';
import { TestResult } from '../entities/TestResult.js';
import { Status } from '../value-objects/Status.js';

export class BusinessRules {
  static validateLaunchCompletion(launch: Launch): void {
    if (launch.isCompleted()) {
      throw new Error('Launch is already completed');
    }
  }

  static validateTestResultAddition(launch: Launch, result: TestResult): void {
    if (launch.isCompleted()) {
      throw new Error('Cannot add test result to completed launch');
    }
  }

  static validateStatusTransition(from: Status, to: Status): boolean {
    // All status transitions are valid, but we can add business rules here
    // For example, we might want to prevent certain transitions
    return true;
  }
}
