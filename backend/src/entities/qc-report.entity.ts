import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { QCVerdict, AssetType } from '../common/enums';

@Entity('qc_reports')
export class QCReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_type', type: 'enum', enum: AssetType })
  assetType: AssetType;

  @Column({ name: 'image_id', nullable: true })
  imageId: string;

  @Column({ name: 'video_id', nullable: true })
  videoId: string;

  @Column({ name: 'visibility_score', type: 'numeric', nullable: true })
  visibilityScore: number;

  @Column({ name: 'fidelity_score', type: 'numeric', nullable: true })
  fidelityScore: number;

  @Column({ name: 'artifact_score', type: 'numeric', nullable: true })
  artifactScore: number;

  @Column({ name: 'temporal_score', type: 'numeric', nullable: true })
  temporalScore: number;

  @Column({ type: 'enum', enum: QCVerdict, nullable: true })
  verdict: QCVerdict;

  @Column({ name: 'notes_json', type: 'jsonb', nullable: true })
  notesJson: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
