import { Launch } from '../entities/Launch.js';
import { LaunchId } from '../value-objects/LaunchId.js';

export interface ILaunchRepository {
  save(launch: Launch): Promise<void>;
  findById(id: LaunchId): Promise<Launch | null>;
  findAll(): Promise<Launch[]>;
  findByDateRange(start: Date, end: Date): Promise<Launch[]>;
  findByRunKey(runKey: string): Promise<Launch | null>;
  findChildLaunchIds(parentLaunchId: LaunchId): Promise<LaunchId[]>;
  findChildLaunches(parentLaunchId: LaunchId): Promise<Array<{ id: string; name: string }>>;
  delete(id: LaunchId): Promise<void>;
  exists(id: LaunchId): Promise<boolean>;
}
