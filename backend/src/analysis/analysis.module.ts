import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { ProductsModule } from '../products/products.module';
import { ReferencesModule } from '../references/references.module';

@Module({
  imports: [ProductsModule, ReferencesModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
