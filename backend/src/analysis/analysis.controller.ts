import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { AnalysisService } from './analysis.service';
import { ProductsService } from '../products/products.service';
import { ReferencesService } from '../references/references.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(
    private analysisService: AnalysisService,
    private productsService: ProductsService,
    private referencesService: ReferencesService,
  ) {}

  @Post('products/:id/analyze')
  async analyzeProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const product = await this.productsService.findOne(id, user.id);

    // Get image as base64
    const imageBase64 = await this.productsService.getImageBase64(product);
    const result = await this.analysisService.analyzeProduct(imageBase64);

    // Update product with analysis results
    const updated = await this.productsService.updateAnalysis(id, {
      productType: result.product_type,
      metalColor: result.metal_color,
      dominantShape: result.dominant_shape,
      stonePresence: result.stone_presence,
      stoneLayoutSummary: result.stone_layout_summary,
      complexityScore: result.complexity_score,
      analysisJson: result as any,
    });

    return { data: { product: updated, analysis: result } };
  }

  @Post('references/:id/analyze')
  async analyzeReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const reference = await this.referencesService.findOne(id, user.id);

    // Get image as base64
    const imageBase64 = await this.referencesService.getImageBase64(reference);
    const result = await this.analysisService.analyzeReference(imageBase64);

    // Update reference with analysis results
    const updated = await this.referencesService.updateAnalysis(id, {
      referenceType: result.reference_type as any,
      environmentType: result.environment_type,
      compositionType: result.composition_type,
      lightType: result.light_type,
      colorPalette: result.color_palette,
      wardrobeStyle: result.wardrobe_style,
      moodClass: result.mood_class,
      cameraPerspective: result.camera_perspective,
      subjectPresence: result.subject_presence,
      luxuryIntensityScore: result.luxury_intensity_score,
      suggestedFusionStrategy: result.suggested_fusion_strategy as any,
      moodTags: [result.mood_class, result.wardrobe_style].filter(Boolean),
      analysisJson: result as any,
    });

    return { data: { reference: updated, analysis: result } };
  }
}
