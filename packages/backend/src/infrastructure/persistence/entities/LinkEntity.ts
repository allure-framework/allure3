import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';

@Entity('links')
@Index('idx_links_test_result_id', ['testResultId'])
export class LinkEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id' })
  testResultId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, (testResult) => testResult.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity;
}
