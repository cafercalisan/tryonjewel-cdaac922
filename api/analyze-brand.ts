import type { Request, Response } from 'express';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ANALYSIS_MODEL = 'gemini-3.1-flash-lite-preview';

async function callGeminiForBrand(prompt: string): Promise<string> {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}

export default async function handler(req: Request, res: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    const {
      brandName,
      primaryColor,
      secondaryColor,
      accentColor,
      styleKeywords,
      lightingPreference,
      backgroundPreference,
      moodDescription,
      referenceImageUrls,
    } = req.body;

    if (!brandName || typeof brandName !== 'string') {
      return sendCorsResponse(res, 400, { error: 'Brand name is required' });
    }

    // Build the analysis prompt
    const analysisPrompt = `You are an expert brand identity consultant specializing in luxury jewelry brands. Analyze the following brand profile and create a Brand DNA summary that can be used to maintain visual consistency across AI-generated jewelry photography.

BRAND PROFILE:
- Name: ${brandName}
- Primary Color: ${primaryColor || 'not specified'}
- Secondary Color: ${secondaryColor || 'not specified'}
- Accent Color: ${accentColor || 'not specified'}
- Style Keywords: ${(styleKeywords || []).join(', ') || 'not specified'}
- Lighting Preference: ${lightingPreference || 'not specified'}
- Background Preference: ${backgroundPreference || 'not specified'}
- Mood Description: ${moodDescription || 'not specified'}
- Number of Reference Images: ${(referenceImageUrls || []).length}

Return JSON:
{
  "analysis": {
    "dominant_mood": "...",
    "color_harmony_type": "...",
    "recommended_scene_types": ["..."],
    "lighting_direction": "...",
    "texture_preferences": ["..."],
    "composition_style": "...",
    "consistency_score": 85
  },
  "brand_dna_prompt": "BRAND IDENTITY LAYER:\\nBrand: [name]\\nColor DNA: Primary [hex], Secondary [hex], Accent [hex]\\nLighting: [specific description matching brand warmth]\\nMood: [mood keywords]\\nBackground Tendency: [preference with texture notes]\\nStyle Signature: [composition and styling notes]\\nCRITICAL: All brand colors, lighting mood, and style must be consistent across every generated image."
}

The brand_dna_prompt should be a ready-to-use prompt block that can be inserted into image generation prompts. It should be specific, actionable, and reference the exact colors and style preferences. Keep it under 200 words.`;

    const rawResult = await callGeminiForBrand(analysisPrompt);
    let parsed: any;
    try {
      parsed = JSON.parse(rawResult.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      // If parsing fails, create a basic brand DNA prompt manually
      parsed = {
        analysis: {
          dominant_mood: moodDescription || 'luxury',
          consistency_score: 75,
        },
        brandDnaPrompt: null,
      };
    }

    // Ensure brand_dna_prompt exists (fallback generation)
    const brandDnaPrompt = parsed.brand_dna_prompt || parsed.brandDnaPrompt || `BRAND IDENTITY LAYER:
Brand: ${brandName}
Color DNA: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}
Lighting: ${lightingPreference === 'warm_golden' ? 'Warm golden with soft fill, matching brand warmth' :
  lightingPreference === 'cool_studio' ? 'Cool precise studio lighting, clinical luxury' :
  lightingPreference === 'natural' ? 'Natural window light, organic and authentic' :
  lightingPreference === 'dramatic' ? 'High contrast dramatic lighting, bold shadows' :
  'Soft diffused lighting, gentle and refined'}
Mood: ${moodDescription || (styleKeywords || []).join(', ') || 'elegant, sophisticated'}
Background Tendency: ${backgroundPreference === 'dark' ? 'Dark, moody with subtle texture' :
  backgroundPreference === 'light' ? 'Light, airy, clean' :
  backgroundPreference === 'neutral' ? 'Neutral tones, understated' :
  'Rich and colorful'}
Style Signature: ${(styleKeywords || []).includes('minimal') ? 'Minimal composition, centered product, clean negative space' :
  (styleKeywords || []).includes('dramatic') ? 'Bold composition, strong shadows, theatrical presence' :
  (styleKeywords || []).includes('vintage') ? 'Vintage-inspired, warm patina, heritage feel' :
  'Balanced composition, refined styling'}
CRITICAL: All brand colors, lighting mood, and style must be consistent across every generated image.`;

    return sendCorsResponse(res, 200, {
      success: true,
      analysis: parsed.analysis || null,
      brandDnaPrompt,
    });

  } catch (error) {
    console.error('Brand analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Brand analysis failed';
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}
