import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GenerationJob } from './generation-job.entity';
import { JobItemStatus } from '../common/enums';

@Entity('generation_job_items')
export class GenerationJobItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id' })
  jobId: string;

  @Column({ name: 'item_type' })
  itemType: string; // 'image' | 'video'

  @Column({ name: 'mode', nullable: true })
  mode: string; // specific mode for this item in master package

  @Column({ name: 'pose_key', nullable: true })
  poseKey: string;

  @Column({ name: 'motion_key', nullable: true })
  motionKey: string;

  @Column({ type: 'enum', enum: JobItemStatus, default: JobItemStatus.QUEUED })
  status: JobItemStatus;

  @Column({ name: 'worker_attempt_count', default: 0 })
  workerAttemptCount: number;

  @Column({ name: 'output_image_id', nullable: true })
  outputImageId: string;

  @Column({ name: 'output_video_id', nullable: true })
  outputVideoId: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => GenerationJob, (j) => j.items)
  @JoinColumn({ name: 'job_id' })
  job: GenerationJob;
}
