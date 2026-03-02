import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';
import type { ExecutorInfo } from '@allurereport/core-api';

@Entity('launches')
@Index('idx_launches_start_time', ['startTime'])
@Index('idx_launches_stop_time', ['stopTime'])
export class LaunchEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'timestamp', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'timestamp', name: 'stop_time', nullable: true })
  stopTime!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  executor!: ExecutorInfo | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  environment!: string | null;

  @Column({ type: 'uuid', name: 'report_uuid', nullable: true })
  reportUuid!: string | null;

  @Column({ type: 'uuid', name: 'parent_launch_id', nullable: true })
  parentLaunchId!: string | null;

  @Column({ type: 'varchar', name: 'run_key', length: 255, nullable: true })
  runKey!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TestResultEntity, (testResult) => testResult.launch)
  testResults!: TestResultEntity[];
}
