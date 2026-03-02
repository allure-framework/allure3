import { Status } from '../value-objects/Status.js';
import { StatusTransition } from '../value-objects/StatusTransition.js';

export class StatusTransitionCalculator {
  calculate(current: Status, previous: Status | null): StatusTransition | null {
    if (previous === null) {
      return new StatusTransition('new');
    }

    // Check malfunctioned first (passed -> broken) before regressed (passed -> failed/broken)
    if (this.isMalfunctioned(current, previous)) {
      return new StatusTransition('malfunctioned');
    }

    if (this.isRegressed(current, previous)) {
      return new StatusTransition('regressed');
    }

    if (this.isFixed(current, previous)) {
      return new StatusTransition('fixed');
    }

    return null;
  }

  isRegressed(current: Status, previous: Status): boolean {
    return previous.isPassed() && current.isFailed();
  }

  isFixed(current: Status, previous: Status): boolean {
    return previous.isFailed() && current.isPassed();
  }

  isMalfunctioned(current: Status, previous: Status): boolean {
    return previous.isPassed() && current.isBroken();
  }

  isNew(previous: Status | null): boolean {
    return previous === null;
  }
}
