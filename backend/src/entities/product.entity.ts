import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ProductType, MetalColor } from '../common/enums';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'original_image_url' })
  originalImageUrl: string;

  @Column({ type: 'enum', enum: ProductType, nullable: true })
  productType: ProductType;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'metal_color', type: 'enum', enum: MetalColor, nullable: true })
  metalColor: MetalColor;

  @Column({ name: 'dominant_shape', nullable: true })
  dominantShape: string;

  @Column({ name: 'stone_presence', default: false })
  stonePresence: boolean;

  @Column({ name: 'stone_layout_summary', nullable: true })
  stoneLayoutSummary: string;

  @Column({ name: 'set_group_id', nullable: true })
  setGroupId: string;

  @Column({ name: 'complexity_score', type: 'numeric', nullable: true })
  complexityScore: number;

  @Column({ name: 'analysis_json', type: 'jsonb', nullable: true })
  analysisJson: Record<string, any>;

  @Column({ default: 'uploaded' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
