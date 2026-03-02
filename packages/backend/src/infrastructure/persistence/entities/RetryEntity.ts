import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index, Unique } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';

@Entity('retries')
@Index('idx_retries_test_result_id', ['testResultId'])
@Unique(['testResultId', 'retryTestResultId'])
export class RetryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id' })
  testResultId!: string;

  @Column({ type: 'uuid', name: 'retry_test_result_id' })
  retryTestResultId!: string;

  @Column({ type: 'integer', name: 'order_index' })
  orderIndex!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, (testResult) => testResult.retries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity;

  @ManyToOne(() => TestResultEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'retry_test_result_id' })
  retryTestResult!: TestResultEntity;
}
