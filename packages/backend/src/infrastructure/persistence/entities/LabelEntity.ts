import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';

@Entity('labels')
@Index('idx_labels_test_result_id', ['testResultId'])
@Index('idx_labels_name_value', ['name', 'value'])
export class LabelEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id' })
  testResultId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  value!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, (testResult) => testResult.labels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity;
}
