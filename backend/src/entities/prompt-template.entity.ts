import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { GenerationMode } from '../common/enums';

@Entity('prompt_templates')
export class PromptTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: GenerationMode })
  mode: GenerationMode;

  @Column()
  version: string;

  @Column({ name: 'template_json', type: 'jsonb' })
  templateJson: Record<string, any>;

  @Column({ name: 'image_model_name', nullable: true })
  imageModelName: string;

  @Column({ name: 'video_model_name', nullable: true })
  videoModelName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
