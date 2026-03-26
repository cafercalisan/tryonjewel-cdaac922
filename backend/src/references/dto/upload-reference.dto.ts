import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ReferenceType } from '../../common/enums';

export class UploadReferenceDto {
  @IsString()
  imageBase64: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsEnum(ReferenceType)
  referenceType?: ReferenceType;
}
