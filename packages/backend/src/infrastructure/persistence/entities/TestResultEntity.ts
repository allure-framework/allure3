import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { LaunchEntity } from './LaunchEntity.js';
import { LabelEntity } from './LabelEntity.js';
import { ParameterEntity } from './ParameterEntity.js';
import { LinkEntity } from './LinkEntity.js';
import { StepEntity } from './StepEntity.js';
import { RetryEntity } from './RetryEntity.js';
import type { TestError, SourceMetadata } from '@allurereport/core-api';

@Entity('test_results')
@Index('idx_test_results_launch_id', ['launchId'])
@Index('idx_test_results_history_id', ['historyId'])
@Index('idx_test_results_status', ['status'])
@Index('idx_test_results_start_time', ['startTime'])
@Index('idx_test_results_environment', ['environment'])
export class TestResultEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'launch_id' })
  launchId!: string;

  @Column({ type: 'varchar', length: 255, name: 'history_id', nullable: true })
  historyId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'test_case_id', nullable: true })
  testCaseId!: string | null;

  @Column({ type: 'varchar', length: 1000 })
  name!: string;

  @Column({ type: 'varchar', length: 2000, name: 'full_name', nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 50 })
  status!: 'failed' | 'broken' | 'passed' | 'skipped' | 'unknown';

  @Column({ type: 'varchar', length: 255, nullable: true })
  environment!: string | null;

  @Column({ type: 'bigint', name: 'start_time', nullable: true })
  startTime!: number | null;

  @Column({ type: 'bigint', name: 'stop_time', nullable: true })
  stopTime!: number | null;

  @Column({ type: 'bigint', nullable: true })
  duration!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'description_html', nullable: true })
  descriptionHtml!: string | null;

  @Column({ type: 'text', nullable: true })
  precondition!: string | null;

  @Column({ type: 'text', name: 'precondition_html', nullable: true })
  preconditionHtml!: string | null;

  @Column({ type: 'text', name: 'expected_result', nullable: true })
  expectedResult!: string | null;

  @Column({ type: 'text', name: 'expected_result_html', nullable: true })
  expectedResultHtml!: string | null;

  @Column({ type: 'boolean', default: false })
  flaky!: boolean;

  @Column({ type: 'boolean', default: false })
  muted!: boolean;

  @Column({ type: 'boolean', default: false })
  known!: boolean;

  @Column({ type: 'boolean', default: false })
  hidden!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    check: "transition IN ('regressed', 'fixed', 'malfunctioned', 'new')"
  })
  transition!: 'regressed' | 'fixed' | 'malfunctioned' | 'new' | null;

  @Column({ type: 'jsonb', nullable: true })
  error!: TestError | null;

  @Column({ type: 'jsonb', name: 'source_metadata' })
  sourceMetadata!: SourceMetadata;

  @Column({ type: 'tsvector', nullable: true, select: false })
  searchVector!: any; // For full-text search

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => LaunchEntity, (launch) => launch.testResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'launch_id' })
  launch!: LaunchEntity;

  @OneToMany(() => LabelEntity, (label) => label.testResult)
  labels!: LabelEntity[];

  @OneToMany(() => ParameterEntity, (parameter) => parameter.testResult)
  parameters!: ParameterEntity[];

  @OneToMany(() => LinkEntity, (link) => link.testResult)
  links!: LinkEntity[];

  @OneToMany(() => StepEntity, (step) => step.testResult)
  steps!: StepEntity[];

  @OneToMany(() => RetryEntity, (retry) => retry.testResult)
  retries!: RetryEntity[];
}
