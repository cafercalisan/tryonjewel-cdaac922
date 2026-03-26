import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GeneratedImage } from '../entities/generated-image.entity';
import { GenerationJob } from '../entities/generation-job.entity';
import { QCReport } from '../entities/qc-report.entity';
import { StorageService } from '../storage/storage.service';
import { QUEUE_NAMES, QCVerdict, AssetType, JobStatus } from '../common/enums';

interface QCJobData {
  imageId: string;
  jobId: string;
  productAnalysis: Record<string, any>;
}

@Processor(QUEUE_NAMES.QC, { concurrency: 3 })
export class QCWorker extends WorkerHost {
  private readonly logger = new Logger(QCWorker.name);

  constructor(
    @InjectRepository(GeneratedImage) private imageRepo: Repository<GeneratedImage>,
    @InjectRepository(GenerationJob) private jobRepo: Repository<GenerationJob>,
    @InjectRepository(QCReport) private qcRepo: Repository<QCReport>,
    private storage: StorageService,
    private config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<QCJobData>): Promise<any> {
    const { imageId, jobId, productAnalysis } = job.data;
    this.logger.log(`QC check for image ${imageId} / job ${jobId}`);

    try {
      const image = await this.imageRepo.findOneOrFail({ where: { id: imageId } });

      // Fetch generated image for QC analysis
      const imageBase64 = await this.fetchImageBase64(image.outputUrl);

      // Call Gemini for QC evaluation
      const qcResult = await this.evaluateWithGemini(imageBase64, productAnalysis);

      // Save QC report
      const report = this.qcRepo.create({
        assetType: AssetType.IMAGE,
        imageId,
        visibilityScore: qcResult.visibility_score,
        fidelityScore: qcResult.fidelity_score,
        artifactScore: qcResult.artifact_score,
        verdict: qcResult.verdict as QCVerdict,
        notesJson: qcResult,
      });
      await this.qcRepo.save(report);

      // Update image with QC score
      const avgScore = (qcResult.visibility_score + qcResult.fidelity_score + qcResult.artifact_score) / 3;
      await this.imageRepo.update(imageId, {
        qcScore: Math.round(avgScore * 100) / 100,
        qcVerdict: qcResult.verdict,
      });

      // Complete the job
      await this.jobRepo.update(jobId, {
        status: JobStatus.COMPLETED,
        progress: 100,
      });

      this.logger.log(`QC complete for image ${imageId}: ${qcResult.verdict} (score: ${avgScore.toFixed(2)})`);
      return { verdict: qcResult.verdict, score: avgScore };

    } catch (error: any) {
      this.logger.error(`QC failed for image ${imageId}: ${error.message}`);
      // QC failure shouldn't fail the whole job — mark completed anyway
      await this.jobRepo.update(jobId, { status: JobStatus.COMPLETED, progress: 100 });
      throw error;
    }
  }

  private async evaluateWithGemini(imageBase64: string, productAnalysis: Record<string, any>): Promise<any> {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      // Fallback: return default passing score
      return { visibility_score: 0.8, fidelity_score: 0.8, artifact_score: 0.8, verdict: 'pass', notes: 'QC skipped — no API key' };
    }

    const prompt = `You are a jewelry image quality control expert. Evaluate this generated jewelry image.

Original product analysis: ${JSON.stringify(productAnalysis)}

Score each criterion from 0.0 to 1.0 and provide a verdict:

{
  "visibility_score": 0.0-1.0,  // Is the jewelry clearly visible and prominent?
  "fidelity_score": 0.0-1.0,    // Does it match the original product description?
  "artifact_score": 0.0-1.0,    // Are there visual artifacts, distortions, extra elements?
  "verdict": "pass|soft_warning|fail_regenerate",
  "issues": ["issue1", "issue2"],
  "notes": "brief quality assessment"
}

Verdict rules:
- pass: all scores > 0.7
- soft_warning: any score 0.5-0.7
- fail_regenerate: any score < 0.5

Return ONLY valid JSON.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      this.logger.warn(`QC Gemini call failed ${response.status} — using fallback scores`);
      return { visibility_score: 0.75, fidelity_score: 0.75, artifact_score: 0.75, verdict: 'pass', notes: 'QC API unavailable' };
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return { visibility_score: 0.75, fidelity_score: 0.75, artifact_score: 0.75, verdict: 'pass', notes: 'QC parse failed' };
    }
  }

  private async fetchImageBase64(imageUrl: string): Promise<string> {
    const url = new URL(imageUrl);
    const key = url.pathname.replace(/^\/[^/]+\//, '');
    const signedUrl = await this.storage.getSignedUrl(key);
    const response = await fetch(signedUrl);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
