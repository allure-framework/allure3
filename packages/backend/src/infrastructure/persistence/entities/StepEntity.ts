import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';
import type { DefaultTestStepResult, TestError, TestParameter } from '@allurereport/core-api';

@Entity('steps')
@Index('idx_steps_test_result_id', ['testResultId'])
@Index('idx_steps_parent_step_id', ['parentStepId'])
export class StepEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id', nullable: true })
  testResultId!: string | null;

  @Column({ type: 'uuid', name: 'parent_step_id', nullable: true })
  parentStepId!: string | null;

  @Column({ type: 'varchar', length: 1000 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: 'failed' | 'broken' | 'passed' | 'skipped' | 'unknown';

  @Column({ type: 'varchar', length: 255, name: 'step_id', nullable: true })
  stepId!: string | null;

  @Column({ type: 'bigint', name: 'start_time', nullable: true })
  startTime!: number | null;

  @Column({ type: 'bigint', name: 'stop_time', nullable: true })
  stopTime!: number | null;

  @Column({ type: 'bigint', nullable: true })
  duration!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  error!: TestError | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'text', nullable: true })
  trace!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  steps!: DefaultTestStepResult[] | null; // Nested steps stored as JSONB

  @Column({ type: 'jsonb', nullable: true })
  parameters!: TestParameter[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, (testResult) => testResult.steps, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity | null;

  @ManyToOne(() => StepEntity, (step) => step.childSteps, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_step_id' })
  parentStep!: StepEntity | null;

  @OneToMany(() => StepEntity, (step) => step.parentStep)
  childSteps!: StepEntity[];
}
