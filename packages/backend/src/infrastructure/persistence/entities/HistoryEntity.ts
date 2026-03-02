import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';
import { LaunchEntity } from './LaunchEntity.js';

@Entity('history')
@Index('idx_history_history_id', ['historyId', 'startTime'])
@Index('idx_history_test_result_id', ['testResultId'])
@Index('idx_history_launch_id', ['launchId'])
export class HistoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'history_id' })
  historyId!: string;

  @Column({ type: 'uuid', name: 'test_result_id' })
  testResultId!: string;

  @Column({ type: 'uuid', name: 'launch_id' })
  launchId!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: 'failed' | 'broken' | 'passed' | 'skipped' | 'unknown';

  @Column({ type: 'bigint', name: 'start_time', nullable: true })
  startTime!: number | null;

  @Column({ type: 'bigint', nullable: true })
  duration!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity;

  @ManyToOne(() => LaunchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'launch_id' })
  launch!: LaunchEntity;
}
