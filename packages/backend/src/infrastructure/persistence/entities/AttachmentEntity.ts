import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';
import { StepEntity } from './StepEntity.js';
import { LaunchEntity } from './LaunchEntity.js';

@Entity('attachments')
@Index('idx_attachments_test_result_id', ['testResultId'])
@Index('idx_attachments_uid', ['uid'], { unique: true })
@Index('idx_attachments_launch_id', ['launchId'])
export class AttachmentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id', nullable: true })
  testResultId!: string | null;

  @Column({ type: 'uuid', name: 'step_id', nullable: true })
  stepId!: string | null;

  @Column({ type: 'uuid', name: 'launch_id', nullable: true })
  launchId!: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  uid!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'content_type', nullable: true })
  contentType!: string | null;

  @Column({ type: 'bigint', name: 'content_length', nullable: true })
  contentLength!: number | null;

  @Column({ type: 'text', name: 'storage_path', nullable: true })
  storagePath!: string | null;

  @Column({ type: 'varchar', length: 1000, name: 'original_file_name', nullable: true })
  originalFileName!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity | null;

  @ManyToOne(() => StepEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'step_id' })
  step!: StepEntity | null;

  @ManyToOne(() => LaunchEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'launch_id' })
  launch!: LaunchEntity | null;
}
