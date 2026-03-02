import { HistoryEntry } from '../entities/HistoryEntry.js';
import { HistoryId } from '../value-objects/HistoryId.js';
import { TestResultId } from '../value-objects/TestResultId.js';

export interface IHistoryRepository {
  save(entry: HistoryEntry): Promise<void>;
  findByHistoryId(historyId: HistoryId): Promise<HistoryEntry[]>;
  findByTestResultId(testResultId: TestResultId): Promise<HistoryEntry[]>;
  findLatestByHistoryId(historyId: HistoryId): Promise<HistoryEntry | null>;
  delete(id: string): Promise<void>;
}
