import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Reference } from './reference.entity';
import { GenerationMode } from '../common/enums';

@Entity('videos_v2')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'source_image_id', nullable: true })
  sourceImageId: string;

  @Column({ name: 'job_id', nullable: true })
  jobId: string;

  @Column({ type: 'enum', enum: GenerationMode, nullable: true })
  mode: GenerationMode;

  @Column({ name: 'output_url' })
  outputUrl: string;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds: number;

  @Column({ nullable: true })
  resolution: string;

  @Column({ name: 'motion_preset', nullable: true })
  motionPreset: string;

  @Column({ name: 'qc_score', type: 'numeric', nullable: true })
  qcScore: number;

  @Column({ name: 'prompt_snapshot_json', type: 'jsonb', nullable: true })
  promptSnapshotJson: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Reference, { nullable: true })
  @JoinColumn({ name: 'reference_id' })
  reference: Reference;
}
