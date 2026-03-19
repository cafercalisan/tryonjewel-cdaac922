import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';

/**
 * Internal endpoint for n8n to trigger jewelry generation.
 * This replaces the fire-and-forget processGeneration() call.
 * n8n calls this endpoint and the Express server runs the generation.
 *
 * POST /api/n8n/trigger-generation
 * Header: X-N8N-Secret: <shared secret>
 * Body: { userId, imageRecordId, jobId, imagePaths, ... }
 */

const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || 'n8n-tryonjewel-secret-2026';

export default async function handler(req: Request, res: Response) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify n8n secret
  const secret = req.headers['x-n8n-secret'] as string;
  if (secret !== N8N_SECRET) {
    return res.status(401).json({ error: 'Invalid n8n secret' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'update-job': {
        const { jobId, status, currentStep, progress, completedImages, totalImages, errorMessage, resultUrls } = req.body;
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (status) { updates.push(`status = $${idx++}`); values.push(status); }
        if (currentStep) { updates.push(`current_step = $${idx++}`); values.push(currentStep); }
        if (progress !== undefined) { updates.push(`progress = $${idx++}`); values.push(progress); }
        if (completedImages !== undefined) { updates.push(`completed_images = $${idx++}`); values.push(completedImages); }
        if (totalImages !== undefined) { updates.push(`total_images = $${idx++}`); values.push(totalImages); }
        if (errorMessage) { updates.push(`error_message = $${idx++}`); values.push(errorMessage); }
        if (resultUrls) { updates.push(`result_urls = $${idx++}`); values.push(JSON.stringify(resultUrls)); }

        if (updates.length > 0) {
          values.push(jobId);
          await query(`UPDATE processing_jobs SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        }
        return res.json({ success: true });
      }

      case 'update-image': {
        const { imageRecordId, status: imgStatus, analysisData, generatedImageUrls, errorMessage: imgError } = req.body;
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (imgStatus) { updates.push(`status = $${idx++}`); values.push(imgStatus); }
        if (analysisData) { updates.push(`analysis_data = $${idx++}`); values.push(JSON.stringify(analysisData)); }
        if (generatedImageUrls) { updates.push(`generated_image_urls = $${idx++}`); values.push(generatedImageUrls); }
        if (imgError) { updates.push(`error_message = $${idx++}`); values.push(imgError); }

        if (updates.length > 0) {
          values.push(imageRecordId);
          await query(`UPDATE images SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        }
        return res.json({ success: true });
      }

      case 'download-images': {
        // Download images from MinIO and return base64
        const { getInternalUrl } = await import('./_lib/storage.js');
        const { imagePaths } = req.body;
        const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
        const base64Images: string[] = [];

        for (const path of imagePaths) {
          try {
            const url = getInternalUrl('jewelry-images', path);
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const buf = await resp.arrayBuffer();
            if (buf.byteLength <= MAX_IMAGE_SIZE) {
              base64Images.push(Buffer.from(buf).toString('base64'));
            }
          } catch (err: any) {
            console.warn('Failed to fetch image:', err?.message);
          }
        }

        if (base64Images.length === 0) {
          return res.status(400).json({ error: 'No images could be loaded' });
        }
        return res.json({ success: true, base64Images });
      }

      case 'analyze-jewelry': {
        // Run Gemini analysis on images
        const { base64Images } = req.body;
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        const ANALYSIS_MODEL = 'gemini-3.1-flash-lite-preview';

        const parts: any[] = [];
        if (base64Images.length > 1) {
          parts.push({ text: `Analyze this jewelry piece. The following ${base64Images.length} images show the SAME piece from different angles — use ALL angles for a complete analysis.` });
          for (let i = 0; i < base64Images.length; i++) {
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Images[i] } });
            parts.push({ text: `[Angle ${i + 1}/${base64Images.length}]` });
          }
        } else if (base64Images[0]) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Images[0] } });
        }

        // The full analysis prompt
        parts.push({ text: `You are an expert jewelry and luxury watch analyst. Analyze this piece with extreme precision.

Return JSON:
{
  "type": "ring|necklace|bracelet|earring|pendant|brooch|watch|choker|piercing",
  "metal": { "type": "gold|silver|platinum|rose_gold|white_gold|mixed", "karat": "24k|22k|18k|14k|10k|sterling|unknown", "finish": "polished|matte|brushed|hammered|textured|satin", "color_hex": "#hex" },
  "stones": [{ "type": "diamond|ruby|emerald|sapphire|pearl|other", "count": 0, "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette", "color": "", "setting": "prong|bezel|channel|pave|tension|cluster|halo", "position": "center|side|halo|band|accent", "relative_size": "dominant|medium|small|tiny" }],
  "structure": { "center_stone_count": 0, "accent_stone_count": 0, "total_prong_count": 0, "prong_style": "classic_4|classic_6|shared|cathedral|basket|tension", "band_width_mm": 0, "band_profile": "flat|domed|knife_edge|comfort_fit", "shank_design": "plain|split|tapered|twisted|pave_set", "gallery_detail": "open|closed|basket|cathedral" },
  "proportions": { "length_to_width_ratio": 1.0, "stone_to_metal_ratio": "stone_dominant|balanced|metal_dominant", "overall_profile": "low_set|medium_set|high_set", "symmetry_grade": "excellent|very_good|good|fair" },
  "surface_details": { "engravings": false, "engraving_description": "", "milgrain": false, "filigree": false, "texture_zones": "", "hallmarks_visible": false },
  "design_elements": { "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian|sports|dress", "patterns": [], "symmetry": "symmetric|asymmetric", "complexity": "simple|moderate|intricate" },
  "unique_identifiers": "",
  "visual_fingerprint": "5-7 DETAILED sentences as VERBAL PHOTOGRAPH",
  "visual_dna": { "silhouette_descriptor": "", "dominant_visual_axis": "", "light_signature": "", "color_relationship_map": "", "scale_anchor": "", "distinguishing_asymmetries": "", "optical_weight_center": "" }
}

CRITICAL: Count EVERY stone precisely. "visual_fingerprint" = 5-7 sentences. "visual_dna" = reconstruction blueprint.
ONLY valid JSON.` });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(500).json({ error: `Gemini analysis error ${response.status}`, details: errText.substring(0, 500) });
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) return res.status(500).json({ error: 'No candidates returned' });
        if (candidate.finishReason === 'SAFETY') return res.status(500).json({ error: 'Blocked by safety filter' });

        const text = candidate.content?.parts?.[0]?.text || '{}';
        try {
          const analysisResult = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
          return res.json({ success: true, analysisResult });
        } catch {
          return res.json({ success: true, analysisResult: { type: 'jewelry', design_elements: { style: 'classic' } } });
        }
      }

      case 'generate-scene': {
        // Generate a single scene image using full prompt building + Gemini
        // This reuses the existing generateSingleImage logic
        const { base64Images, sceneType, analysisResult, userId, imageRecordId, jobId, aspectRatio, productType, metalColorOverride, customPrompt, brandDna } = req.body;

        // Dynamic import to access the generation functions
        const mod = await import('./generate-jewelry.js');

        // If the module exports a generateScene function, use it
        if (typeof (mod as any).generateSceneForN8N === 'function') {
          const result = await (mod as any).generateSceneForN8N({
            base64Images, sceneType, analysisResult, userId, imageRecordId, jobId, aspectRatio, productType, metalColorOverride, customPrompt, brandDna,
          });
          return res.json(result);
        }

        return res.status(501).json({ error: 'generateSceneForN8N not exported yet' });
      }

      case 'refund-credits': {
        const { userId, amount } = req.body;
        const result = await queryOne('SELECT refund_credits($1, $2) as result', [userId, amount]);
        return res.json({ success: true, result });
      }

      case 'fetch-brand-dna': {
        const { userId } = req.body;
        const brand = await queryOne<{ brand_dna_prompt: string }>(
          'SELECT brand_dna_prompt FROM brand_profiles WHERE user_id = $1 AND is_active = true LIMIT 1',
          [userId]
        );
        return res.json({ success: true, brandDna: brand?.brand_dna_prompt || null });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`n8n trigger error (${req.body?.action}):`, err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
