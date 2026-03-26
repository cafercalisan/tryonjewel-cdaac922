import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductType } from '../../common/enums';

export class UploadProductDto {
  @IsString()
  imageBase64: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @IsOptional()
  @IsString()
  setGroupId?: string;
}
