import { Launch } from '../entities/Launch.js';
import { LaunchId } from '../value-objects/LaunchId.js';
import { ExecutorInfo } from '../value-objects/ExecutorInfo.js';
import { randomUUID } from 'crypto';

export class LaunchFactory {
  /** Creates a root launch (no parent). */
  create(name: string, executor?: ExecutorInfo): Launch {
    return this.createRoot(name, executor);
  }

  /** Creates a root launch with optional run_key for lookup. */
  createRoot(name: string, executor?: ExecutorInfo, runKey?: string | null): Launch {
    const id = new LaunchId(randomUUID());
    return new Launch(
      id,
      name,
      new Date(),
      null,
      executor || null,
      null,
      null,
      null,
      runKey ?? null
    );
  }

  /** Creates a child launch under a parent. */
  createChild(parentLaunchId: LaunchId, name: string, executor?: ExecutorInfo): Launch {
    const id = new LaunchId(randomUUID());
    return new Launch(
      id,
      name,
      new Date(),
      null,
      executor || null,
      null,
      null,
      parentLaunchId,
      null
    );
  }

  fromExisting(
    id: LaunchId,
    name: string,
    startTime: Date,
    stopTime: Date | null = null,
    executor: ExecutorInfo | null = null,
    environment: string | null = null,
    reportUuid: string | null = null,
    parentLaunchId: LaunchId | null = null,
    runKey: string | null = null
  ): Launch {
    return new Launch(id, name, startTime, stopTime, executor, environment, reportUuid, parentLaunchId, runKey);
  }
}
