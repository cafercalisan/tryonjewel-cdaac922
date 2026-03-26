import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'name_tr', default: '' })
  nameTr: string;

  @Column({ default: '' })
  description: string;

  @Column({ name: 'description_tr', default: '' })
  descriptionTr: string;

  @Column({ default: '' })
  prompt: string;

  @Column({ default: 'studio' })
  category: string;

  @Column({ name: 'sub_category', default: 'general' })
  subCategory: string;

  @Column({ name: 'product_type_category', default: 'genel' })
  productTypeCategory: string;

  @Column({ name: 'preview_image_url', nullable: true })
  previewImageUrl: string;

  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
