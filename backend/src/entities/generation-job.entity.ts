import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Reference } from './reference.entity';
import { Scene } from './scene.entity';
import { UserModel } from './user-model.entity';
import { GenerationJobItem } from './generation-job-item.entity';
import { GenerationMode, JobStatus } from '../common/enums';

@Entity('generation_jobs')
export class GenerationJob {
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

  @Column({ name: 'job_mode', type: 'enum', enum: GenerationMode })
  jobMode: GenerationMode;

  @Column({ name: 'requested_package', nullable: true })
  requestedPackage: string;

  @Column({ name: 'model_id', nullable: true })
  modelId: string;

  @Column({ name: 'scene_id', nullable: true })
  sceneId: string;

  @Column({ name: 'reference_strategy', nullable: true })
  referenceStrategy: string;

  @Column({ name: 'output_ratio', default: '3:4' })
  outputRatio: string;

  @Column({ nullable: true })
  resolution: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.QUEUED })
  status: JobStatus;

  @Column({ default: 0 })
  progress: number;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'prompt_version', nullable: true })
  promptVersion: string;

  @Column({ name: 'image_model_name', nullable: true })
  imageModelName: string;

  @Column({ name: 'video_model_name', nullable: true })
  videoModelName: string;

  @Column({ name: 'credits_used', default: 0 })
  creditsUsed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

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

  @OneToMany(() => GenerationJobItem, (item) => item.job)
  items: GenerationJobItem[];
}
