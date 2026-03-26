import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { GenerationMode, FusionStrategy } from '../../common/enums';

export class CreateGenerationDto {
  @IsString()
  productId: string;

  @IsEnum(GenerationMode)
  mode: GenerationMode;

  @IsOptional()
  @IsString()
  sceneId?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsEnum(FusionStrategy)
  referenceStrategy?: FusionStrategy;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  outputRatio?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsBoolean()
  withVideo?: boolean;

  @IsOptional()
  @IsString()
  packageType?: string;
}
