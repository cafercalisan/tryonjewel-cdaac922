import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Reference } from './reference.entity';
import { Scene } from './scene.entity';
import { UserModel } from './user-model.entity';
import { GenerationMode } from '../common/enums';

@Entity('generated_images')
export class GeneratedImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'set_group_id', nullable: true })
  setGroupId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'model_id', nullable: true })
  modelId: string;

  @Column({ name: 'scene_id', nullable: true })
  sceneId: string;

  @Column({ name: 'job_id', nullable: true })
  jobId: string;

  @Column({ name: 'image_type', nullable: true })
  imageType: string;

  @Column({ type: 'enum', enum: GenerationMode, nullable: true })
  mode: GenerationMode;

  @Column({ name: 'output_url' })
  outputUrl: string;

  @Column({ name: 'preview_url', nullable: true })
  previewUrl: string;

  @Column({ nullable: true })
  resolution: string;

  @Column({ name: 'qc_score', type: 'numeric', nullable: true })
  qcScore: number;

  @Column({ name: 'qc_verdict', nullable: true })
  qcVerdict: string;

  @Column({ name: 'prompt_snapshot_json', type: 'jsonb', nullable: true })
  promptSnapshotJson: Record<string, any>;

  @Column({ name: 'is_favorite', default: false })
  isFavorite: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Reference, { nullable: true })
  @JoinColumn({ name: 'reference_id' })
  reference: Reference;

  @ManyToOne(() => Scene, { nullable: true })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene;

  @ManyToOne(() => UserModel, { nullable: true })
  @JoinColumn({ name: 'model_id' })
  model: UserModel;
}
