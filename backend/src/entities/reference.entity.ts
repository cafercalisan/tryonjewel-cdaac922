import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ReferenceType, FusionStrategy } from '../common/enums';

@Entity('references')
export class Reference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'original_image_url' })
  originalImageUrl: string;

  @Column({ name: 'reference_type', type: 'enum', enum: ReferenceType, nullable: true })
  referenceType: ReferenceType;

  @Column({ name: 'analysis_json', type: 'jsonb', nullable: true })
  analysisJson: Record<string, any>;

  @Column({ name: 'mood_tags', type: 'text', array: true, default: '{}' })
  moodTags: string[];

  // PRD Section 10.4 — reference analyzer fields
  @Column({ name: 'environment_type', nullable: true })
  environmentType: string;

  @Column({ name: 'composition_type', nullable: true })
  compositionType: string;

  @Column({ name: 'light_type', nullable: true })
  lightType: string;

  @Column({ name: 'color_palette', type: 'jsonb', nullable: true })
  colorPalette: Record<string, any>;

  @Column({ name: 'wardrobe_style', nullable: true })
  wardrobeStyle: string;

  @Column({ name: 'mood_class', nullable: true })
  moodClass: string;

  @Column({ name: 'camera_perspective', nullable: true })
  cameraPerspective: string;

  @Column({ name: 'subject_presence', default: false })
  subjectPresence: boolean;

  @Column({ name: 'luxury_intensity_score', type: 'numeric', nullable: true })
  luxuryIntensityScore: number;

  @Column({ name: 'suggested_fusion_strategy', type: 'enum', enum: FusionStrategy, nullable: true })
  suggestedFusionStrategy: FusionStrategy;

  @Column({ default: 'uploaded' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
