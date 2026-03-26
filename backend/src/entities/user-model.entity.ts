import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_models')
export class UserModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string; // null = system default model

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ name: 'persona_tags', type: 'text', array: true, default: '{}' })
  personaTags: string[];

  @Column({ name: 'dna_json', type: 'jsonb', nullable: true })
  dnaJson: Record<string, any>;

  @Column({ name: 'preview_image_url', nullable: true })
  previewImageUrl: string;

  @Column({ name: 'gender', default: 'female' })
  gender: string;

  @Column({ name: 'age_range', default: '25-30' })
  ageRange: string;

  @Column({ name: 'ethnicity', default: 'Turkish' })
  ethnicity: string;

  @Column({ name: 'skin_tone', default: 'medium' })
  skinTone: string;

  @Column({ name: 'hair_color', default: 'brown' })
  hairColor: string;

  @Column({ name: 'hair_style', nullable: true })
  hairStyle: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
