import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';
import { uploadFile, getSignedUrl, getInternalUrl } from './_lib/storage.js';
import { authenticateUser } from './_lib/auth.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

const GOOGLE_IMAGE_API_KEY = process.env.GOOGLE_API_KEY;
const ANALYSIS_MODEL = 'gemini-3.1-flash-lite-preview';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

// ═══════════════════════════════════════════════════
// GEMINI HELPERS (shared with V1)
// ═══════════════════════════════════════════════════

async function callGeminiAnalysis(opts: {
  prompt: string;
  imageBase64?: string;
  imageBase64s?: string[]; // multiple reference angles
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = GOOGLE_IMAGE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const parts: any[] = [];
  const images = opts.imageBase64s || (opts.imageBase64 ? [opts.imageBase64] : []);
  if (images.length > 1) {
    parts.push({ text: `Analyze this jewelry piece. The following ${images.length} images show the SAME piece from different angles — use ALL angles for a complete analysis.` });
    for (let i = 0; i < images.length; i++) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: images[i] } });
      parts.push({ text: `[Angle ${i + 1}/${images.length}]` });
    }
    parts.push({ text: opts.prompt });
  } else {
    parts.push({ text: opts.prompt });
    if (images[0]) parts.push({ inlineData: { mimeType: 'image/jpeg', data: images[0] } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.1,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini analysis error ${response.status}:`, errText.substring(0, 500));
    throw new Error(`Gemini analysis API error ${response.status}: ${errText.substring(0, 500)}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('Gemini analysis returned no candidates');
  if (candidate.finishReason === 'SAFETY') throw new Error('Gemini analysis blocked by safety filter');

  const text = candidate.content?.parts?.[0]?.text || '{}';
  console.log(`Gemini analysis response: ${text.length} chars`);
  return text;
}

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

async function callGeminiImageGeneration({
  base64Images, prompt, temperature = 0.12, aspectRatio = '3:4',
}: {
  base64Images: string[];
  prompt: string;
  temperature?: number;
  aspectRatio?: string;
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;

  // Build parts: label each reference image, then the generation prompt
  const parts: any[] = [];

  if (base64Images.length === 1) {
    // Single reference: image first, then prompt
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Images[0] } });
    parts.push({ text: `REFERENCE JEWELRY IMAGE (above): This is the exact jewelry piece to reproduce.\n\n${prompt}` });
  } else {
    // Multiple references: label each angle, then prompt
    parts.push({ text: `REFERENCE JEWELRY IMAGES: The following ${base64Images.length} images show the SAME jewelry piece from different angles. Study ALL of them carefully to capture every detail — shape, metal color, stone cuts, engravings, and proportions.` });
    for (let i = 0; i < base64Images.length; i++) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Images[i] } });
      parts.push({ text: `[Reference angle ${i + 1}/${base64Images.length}]` });
    }
    parts.push({ text: `\nUSING ALL ${base64Images.length} REFERENCE IMAGES ABOVE — reproduce this exact jewelry with perfect fidelity:\n\n${prompt}` });
  }

  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(4 * 60 * 1000), // 4 min per image max
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature,
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '4K',
        },
      },
    }),
  });
}

async function generateSingleImage(
  base64Images: string[], prompt: string, userId: string,
  imageRecordId: string, index: number, _unused: any,
  jobId: string, aspectRatio: string = '3:4', startTemperature: number = 0.12,
): Promise<string | null> {
  const temperatures = [startTemperature, startTemperature + 0.05, startTemperature + 0.1];
  const OVERLOAD_BACKOFF = [8000, 20000, 45000];
  const NORMAL_BACKOFF = [3000, 5000, 5000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!GOOGLE_IMAGE_API_KEY) return null;

      const genResponse = await callGeminiImageGeneration({
        base64Images, prompt, temperature: temperatures[attempt], aspectRatio,
      });

      if (!genResponse.ok) {
        const errText = await genResponse.text();
        const status = genResponse.status;
        const isOverload = status === 503 || status === 429 || status === 500 || status === 502 || status === 504;
        console.error(`Generation ${index} API error (${status}) attempt ${attempt + 1}${isOverload ? ' [OVERLOAD]' : ''}:`, errText);

        if (attempt >= 2) {
          const friendly = isOverload
            ? 'Gemini modeli şu anda çok yoğun (503 UNAVAILABLE). Lütfen birkaç dakika sonra tekrar deneyin.'
            : `Gemini API hatası ${status}: ${errText.substring(0, 400)}`;
          try { await query('UPDATE processing_jobs SET error_message = $1 WHERE id = $2', [friendly, jobId]); } catch (_) {}
          return null;
        }

        const waitMs = isOverload ? OVERLOAD_BACKOFF[attempt] : NORMAL_BACKOFF[attempt];
        console.log(`Retry ${attempt + 1}/2 for image ${index} in ${waitMs}ms (overload=${isOverload})...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      const genData = await genResponse.json();
      const parts = genData.candidates?.[0]?.content?.parts || [];
      let generatedImage: string | null = null;
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          generatedImage = part.inlineData.data;
          part.inlineData.data = null;
          break;
        }
      }
      if (!generatedImage) {
        const finishReason = genData.candidates?.[0]?.finishReason || 'unknown';
        const blockReason = genData.promptFeedback?.blockReason || 'none';
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join(' ').substring(0, 300);
        console.error(`V2 No image (attempt ${attempt + 1}) — finishReason: ${finishReason}, blockReason: ${blockReason}, text: ${textParts || 'none'}`);
        if (attempt < 2) continue;
        return null;
      }

      const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
      generatedImage = null;

      const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
      const { error: uploadError } = await uploadFile('jewelry-images', filePath, imageBuffer, 'image/png');

      if (!uploadError) {
        const { data: signedUrlData, error: signedUrlError } = await getSignedUrl('jewelry-images', filePath, 7 * 24 * 60 * 60);
        if (!signedUrlError && signedUrlData?.signedUrl) {
          console.log(`Image ${index} uploaded successfully (attempt ${attempt + 1})`);
          return signedUrlData.signedUrl;
        }
      }
      return null;
    } catch (error) {
      console.error(`Generation ${index} error (attempt ${attempt + 1}):`, error);
      if (attempt < 2) continue;
      return null;
    }
  }
  return null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════
// V2: 6-BLOCK JSON PROMPT SYSTEM
// ═══════════════════════════════════════════════════
// Core formula: SHOT + LENS + LIGHT + TEXTURE + COMPOSITION + STYLE REFERENCE
// Each block is explicitly defined for Gemini to parse more effectively.

// ── Aesthetic Styles ──
interface AestheticStyle {
  key: string;
  name: string;
  lightingMod: string;
  colorGrade: string;
  mood: string;
  reference: string;
}

const AESTHETIC_STYLES: AestheticStyle[] = [
  {
    key: 'editorial_luxury',
    name: 'Editorial Luxury',
    lightingMod: 'Hard directional key light, deep shadows, high contrast. Single focused light source with minimal fill.',
    colorGrade: 'Rich blacks, controlled highlights, slight warm lift in midtones. Zero grain. Clean commercial precision.',
    mood: 'Powerful, authoritative, exclusive. The jewelry commands the frame.',
    reference: 'Cartier "Clash" campaign, Mario Sorrenti for Tiffany, Steven Meisel Vogue Italia.',
  },
  {
    key: 'romantic_soft',
    name: 'Romantic Soft',
    lightingMod: 'Soft diffused light from large source. Gentle wrap-around illumination. Minimal shadows, ethereal glow.',
    colorGrade: 'Warm pastel tones, lifted shadows to cream/blush. Soft roll-off on highlights. Slight haze effect.',
    mood: 'Intimate, dreamy, tender. The jewelry feels like a love letter.',
    reference: 'Van Cleef & Arpels "Poetry of Time", Paolo Roversi soft portraits, Dior J\'adore.',
  },
  {
    key: 'modern_minimal',
    name: 'Modern Minimal',
    lightingMod: 'Clean even lighting from overhead softbox. Sharp, controlled. No dramatic shadows.',
    colorGrade: 'Neutral white balance, desaturated background, product at full saturation. Clinical precision.',
    mood: 'Clean, architectural, contemporary. Less is more — the jewelry speaks for itself.',
    reference: 'Celine by Phoebe Philo campaigns, Jil Sander, COS editorial.',
  },
  {
    key: 'bold_colorful',
    name: 'Bold & Colorful',
    lightingMod: 'Vibrant colored gels on accent lights. Strong rim light with complementary color fill.',
    colorGrade: 'Saturated, punchy colors. High contrast with vivid midtones. Bold color blocking.',
    mood: 'Energetic, youthful, daring. The jewelry is a statement piece.',
    reference: 'Bulgari "Magnifica", David LaChapelle color work, Versace campaigns.',
  },
  {
    key: 'vintage_retro',
    name: 'Vintage / Retro',
    lightingMod: 'Warm tungsten-like light. Soft vignette at edges. Slightly diffused through vintage glass.',
    colorGrade: 'Warm sepia undertone, faded blacks to brown, orange-shifted highlights. Film grain 8%. Halation on bright points.',
    mood: 'Nostalgic, timeless, heritage. The jewelry carries stories from another era.',
    reference: 'Helmut Newton 1970s editorial, Peter Lindbergh monochrome, Guy Bourdin color.',
  },
  {
    key: 'futuristic',
    name: 'Futuristic',
    lightingMod: 'Cool neon accents (blue/purple/cyan). Sharp geometric light patterns. Metallic reflections.',
    colorGrade: 'Cool blue-silver base, neon accent colors. High contrast. Chrome-like highlights. Zero warmth.',
    mood: 'Cutting-edge, otherworldly, tech-luxury. The jewelry is from tomorrow.',
    reference: 'Blade Runner 2049 aesthetics, Iris van Herpen campaigns, Zaha Hadid architectural.',
  },
];

// ── Lens Options ──
interface LensOption {
  key: string;
  focal: string;
  description: string;
  bestFor: string[];
}

const LENS_OPTIONS: LensOption[] = [
  {
    key: '35mm',
    focal: '35mm f/2.0',
    description: 'Wide-angle: captures environment context alongside jewelry. Slight perspective distortion adds dynamic energy. Full scene visible.',
    bestFor: ['model_lifestyle', 'editorial'],
  },
  {
    key: '50mm',
    focal: '50mm f/1.8',
    description: 'Standard natural perspective: closest to human eye. No distortion. Balanced framing between subject and environment.',
    bestFor: ['model_lifestyle', 'editorial', 'model'],
  },
  {
    key: '85mm',
    focal: '85mm f/1.4',
    description: 'Portrait lens: beautiful background compression and bokeh. Flattering perspective for model shots. Jewelry sharp, background creamy.',
    bestFor: ['model', 'model_closeup', 'editorial'],
  },
  {
    key: '100mm_macro',
    focal: '100mm f/2.8 Macro (1:1)',
    description: 'Macro lens: extreme detail resolution. Metal grain, stone facets, prong tips all visible. Near 1:1 magnification ratio.',
    bestFor: ['macro', 'ecommerce'],
  },
];

// ── Camera Angles ──
interface CameraAngle {
  key: string;
  description: string;
  effect: string;
}

const CAMERA_ANGLES: CameraAngle[] = [
  { key: 'eye_level', description: 'Eye-level straight-on view, product/model centered', effect: 'Neutral, direct connection. Product appears natural and approachable.' },
  { key: '45_degree', description: '45-degree elevated angle looking down', effect: 'Classic jewelry photography angle. Reveals top surface and dimension simultaneously.' },
  { key: 'birds_eye', description: 'Flat-lay 90° overhead top-down view', effect: 'Graphic, design-focused. Product becomes a pattern element. Instagram-optimized.' },
  { key: 'low_angle', description: 'Low angle looking slightly upward at 15-20°', effect: 'Makes the piece appear grand, monumental, powerful. Dramatic hero shot.' },
  { key: 'pov', description: 'Point-of-view as if looking at own hand/wrist/décolletage', effect: 'Intimate first-person perspective. Viewer imagines wearing the piece.' },
];

// ── Lighting Setups ──
interface LightingSetup {
  key: string;
  name: string;
  description: string;
  temperature: string;
  bestFor: string[];
}

const LIGHTING_SETUPS: LightingSetup[] = [
  {
    key: 'soft_box',
    name: 'Studio Softbox',
    description: 'Large diffused softbox overhead and at 45° key position. Even, controlled illumination. Gentle shadow transitions. Professional studio standard.',
    temperature: '5500K daylight neutral',
    bestFor: ['ecommerce', 'macro', 'modern_minimal'],
  },
  {
    key: 'rim_light',
    name: 'Dramatic Rim Light',
    description: 'Strong backlight creating luminous edge glow around the jewelry silhouette. Minimal front fill. Metal edges glow brilliantly.',
    temperature: '5000K neutral-cool',
    bestFor: ['editorial', 'macro', 'futuristic'],
  },
  {
    key: 'golden_hour',
    name: 'Golden Hour',
    description: 'Warm directional light from low angle (10 o\'clock position). Long shadows, golden highlights. Natural outdoor feeling.',
    temperature: '3200K warm golden',
    bestFor: ['editorial', 'model_lifestyle', 'romantic_soft'],
  },
  {
    key: 'window_light',
    name: 'Natural Window Light',
    description: 'Soft side light from large window source. Beautiful gradient from lit to shadow side. Natural, editorial atmosphere.',
    temperature: '4500K warm neutral',
    bestFor: ['model', 'model_closeup', 'romantic_soft'],
  },
  {
    key: 'dramatic_shadow',
    name: 'Dramatic Shadow (Chiaroscuro)',
    description: 'Single hard point light source. Deep chiaroscuro contrast — jewelry emerges from darkness. Film-noir mood.',
    temperature: '4000K warm-neutral',
    bestFor: ['editorial', 'macro', 'editorial_luxury'],
  },
  {
    key: 'butterfly',
    name: 'Butterfly / Paramount Light',
    description: 'Key light directly above and in front. Classic beauty lighting. Subtle shadow beneath nose/chin on model. Even illumination on jewelry.',
    temperature: '5500K daylight',
    bestFor: ['model', 'model_closeup', 'editorial_luxury'],
  },
  {
    key: 'split',
    name: 'Split Light',
    description: 'Light from exact 90° side — half illuminated, half in deep shadow. Maximum drama and editorial edge.',
    temperature: '5000K neutral',
    bestFor: ['editorial', 'model', 'bold_colorful'],
  },
];

// ═══════════════════════════════════════════════════
// EDITORIAL SCENE POOL (reused from V1)
// ═══════════════════════════════════════════════════
interface EditorialScene {
  name: string;
  category: string;
  prompt: string;
}

const EDITORIAL_SCENE_POOL: EditorialScene[] = [
  { name: 'Golden Hour Rooftop', category: 'outdoor', prompt: 'Luxury rooftop terrace at golden hour. City skyline softly blurred in bokeh behind the jewelry. Warm amber directional light from setting sun. Polished stone ledge as placement surface. Cinematic depth, aspirational metropolitan luxury.' },
  { name: 'Mediterranean Garden Terrace', category: 'outdoor', prompt: 'Olive tree garden terrace in Provence style. Dappled sunlight filtering through leaves creates organic light patterns on the jewelry. Weathered stone table surface. Soft green and warm gold color palette. Editorial travel-luxury atmosphere.' },
  { name: 'Beach at Dawn', category: 'outdoor', prompt: 'Blue hour beach scene at dawn. Jewelry placed on wet sand with mirror-like reflections. Cool blue-silver atmosphere with first warm light on horizon. Gentle wave traces nearby. Serene, ethereal coastal luxury.' },
  { name: 'Autumn Vineyard', category: 'outdoor', prompt: 'Vineyard estate during golden hour in autumn. Wine barrel or aged wood surface. Warm amber and burgundy fall foliage softly blurred behind. Rich harvest atmosphere. European heritage luxury editorial.' },
  { name: 'Desert Dunes Sunset', category: 'outdoor', prompt: 'Desert sand dune at sunset. Jewelry on smooth sand ridge with long dramatic shadows. Warm orange-to-purple gradient sky. Exotic, adventurous luxury. Wind-sculpted sand patterns frame the piece.' },
  { name: 'Snow Alpine Morning', category: 'outdoor', prompt: 'Crisp alpine winter morning. Jewelry on ice crystal surface with snow-capped mountains in soft focus behind. Pure white and pale blue palette. Sharp cold light with prismatic highlights. Clean, pure winter luxury.' },
  { name: 'Cartier Window Display', category: 'campaign', prompt: 'High-end jewelry boutique window display at night. Deep navy blue velvet platform with museum-grade spot lighting. Warm gold accent lights. Dark exterior reflections in glass. Exclusive, prestigious campaign atmosphere.' },
  { name: 'Tiffany Blue Perfection', category: 'campaign', prompt: 'Pristine white lacquered surface with iconic soft blue gradient backdrop. Perfect three-point studio lighting. Immaculate, minimal, aspirational. Luxury brand campaign precision with zero distractions.' },
  { name: 'Van Cleef Garden Fantasy', category: 'campaign', prompt: 'Fresh white peony flowers arranged artfully around the jewelry. Sage green watercolor-wash background. Soft diffused natural light. Romantic garden luxury. Poetic, feminine campaign editorial.' },
  { name: 'Noir Glamour Campaign', category: 'campaign', prompt: 'Single dramatic spotlight on glossy black lacquered surface. Deep chiaroscuro lighting — jewelry emerges from darkness. Strong contrast, film-noir mood. Bold, seductive luxury campaign.' },
  { name: 'Heritage Auction House', category: 'campaign', prompt: 'Antique mahogany display with burgundy leather inlay. Gilt gold frame partially visible. Warm museum lighting with focused spot on jewelry. Rich patina, heritage storytelling. Auction house prestige.' },
  { name: 'Modern Minimalist Campaign', category: 'campaign', prompt: 'Pure white studio cyclorama with three-point professional lighting. Clean infinity curve background. No shadows, no distractions. Surgical precision lighting reveals every facet. Contemporary luxury brand campaign.' },
  { name: 'Backstage Fashion Week', category: 'fashion', prompt: 'Fashion week backstage styling table. Ring light reflections visible. Raw, energetic atmosphere with hairspray mist in air. Professional chaos aesthetic. Behind-the-scenes editorial energy.' },
  { name: 'Editorial Studio Infinity', category: 'fashion', prompt: 'Desaturated mauve seamless backdrop. Profoto beauty dish overhead creating soft wraparound light. Minimal styling. High-fashion editorial simplicity with muted color palette. Magazine cover quality.' },
  { name: 'Haute Couture Atelier', category: 'fashion', prompt: 'Couture atelier cutting table with raw silk organza fabric partially draped nearby. Soft north-facing atelier window light. Pins, thread spools subtly blurred in background. Artisan craftsmanship atmosphere.' },
  { name: 'Vogue Still Life', category: 'fashion', prompt: 'Moody editorial flat-lay composition with luxury accessories. Dark textured surface. Dramatic overhead spotlight with deep shadows. Art-directed styling with negative space. Magazine spread quality.' },
  { name: 'Paris Apartment Morning', category: 'fashion', prompt: 'Haussmann-style Parisian apartment. Jewelry on marble mantelpiece. Sheer tulle curtain diffusing soft morning light. Ornate molding softly blurred. Romantic Parisian editorial lifestyle.' },
  { name: 'Marble Foyer Grand Entrance', category: 'architectural', prompt: 'Grand Calacatta marble foyer. Crystal chandelier creating sparkling highlights overhead. Palatial architecture with arched doorways in soft focus. Warm ambient luxury. Five-star hotel entrance grandeur.' },
  { name: 'Art Gallery White Cube', category: 'architectural', prompt: 'Contemporary art gallery white plinth display. Track lighting from above creating precise illumination. White cube gallery space. Clean, curated, institutional luxury presentation.' },
  { name: 'Silk Cascade', category: 'texture', prompt: 'Jewelry resting on cascading folds of cream silk fabric. Soft diffused overhead light creates delicate shadow-light interplay along the silk curves. Warm champagne and ivory tonal palette. Intimate, sensual, haute couture still life.' },
  { name: 'Raw Marble Quarry', category: 'texture', prompt: 'Jewelry placed on a raw Calacatta marble block, natural gold veins running through white stone. Hard natural daylight from above creates stark shadows. Industrial luxury — raw meets refined.' },
  { name: 'Liquid Gold Pour', category: 'texture', prompt: 'Surreal campaign: jewelry appears to float on a surface of liquid molten gold. Metallic liquid creates rippling reflections and warm golden light from below. Ultra-luxury, avant-garde advertising aesthetic.' },
  { name: 'Underwater Pearl Garden', category: 'creative', prompt: 'Ethereal underwater atmosphere surrounding the jewelry. Tiny air bubbles float upward through blue-green water. Scattered sea shells on sandy bed below. Caustic light patterns dance across the scene. Dreamlike, poetic, otherworldly luxury.' },
  { name: 'Frozen in Crystal', category: 'creative', prompt: 'Jewelry resting upon crystal-clear ice formations. Arctic blue-white color palette with prismatic light refractions creating rainbow spectra. Frost crystals frame the edges. Ultra-clean, pure, winter luxury campaign.' },
  { name: 'Volcanic Obsidian', category: 'creative', prompt: 'Jewelry placed on glossy black obsidian volcanic glass surface. Subtle orange-red volcanic glow in far background. Extreme contrast between deep black surface and brilliantly lit jewelry. Primordial luxury — ancient earth meets refined craftsmanship.' },
  { name: 'Brutalist Concrete Gallery', category: 'architectural_statement', prompt: 'Jewelry displayed on raw exposed concrete in a brutalist gallery space. Single dramatic spotlight from above creates precise circle of light. Contemporary art museum aesthetic — jewelry as sculptural art object.' },
  { name: 'Japanese Zen Garden', category: 'architectural_statement', prompt: 'Jewelry on smooth river stone within miniature Japanese zen garden. Raked white sand with precise parallel lines. Meditative calm, wabi-sabi aesthetic. Muted earth tones.' },
  { name: 'Film Noir Detective Desk', category: 'cinematic', prompt: 'Film noir: jewelry on dark wooden desk. Hard light strips from venetian blinds create dramatic parallel shadow lines. Near-monochromatic palette — deep blacks, bright whites, minimal warm sepia.' },
  { name: 'Baroque Opera Box', category: 'cinematic', prompt: 'Jewelry on gilded velvet railing of baroque opera box seat. Rich red velvet and ornate gold-leaf decorations. Warm theatrical stage lighting creates dramatic golden glow. Theatrical, opulent, grandiose.' },
  { name: 'Cyberpunk Neon Alley', category: 'cinematic', prompt: 'Jewelry on rain-wet dark surface in futuristic neon-lit alleyway. Blue, purple, and hot pink neon reflections off wet ground. Blade Runner aesthetic meets luxury advertising. Future-noir, tech-luxury.' },
  { name: 'Old Hollywood Vanity', category: 'cinematic', prompt: 'Jewelry on classic Old Hollywood vanity table. Makeup mirror with exposed warm bulbs creates soft flattering light. Golden age glamour — 1950s starlet dressing room.' },
  { name: 'Eclipse Horizon', category: 'cinematic', prompt: 'Cosmic backdrop: jewelry in foreground with total solar eclipse on horizon behind. Corona creates dramatic golden rim-light halo illuminating the jewelry from behind. Awe-inspiring, cosmic, mythic scale.' },
];

const COLOR_GRADE_MODIFIERS: Record<string, string> = {
  outdoor: 'Warm natural tones, lifted shadows to deep brown, golden highlights with soft roll-off. Film grain 5%. REFERENCE: Peter Lindbergh outdoor editorial.',
  campaign: 'Precise, controlled commercial. Neutral WB with subtle warmth. Pure blacks, clean whites. Zero grain. REFERENCE: Cartier campaign precision.',
  fashion: 'Moody editorial desaturation. Cool shadows, warm highlights. Muted except jewelry (full saturation). REFERENCE: Vogue Italia, Steven Meisel.',
  architectural: 'Warm amber with cool shadow accents. Rich mid-tones. Subtle vignette. REFERENCE: Architectural Digest meets luxury campaign.',
  surface: 'Deep dramatic. Rich blacks with warm undertone. Jewelry brightest element. High contrast, smooth transitions. REFERENCE: Patek Philippe campaign.',
  texture: 'Rich material emphasis, tactile quality. Warm mid-tones with deep shadows. Jewelry maintains full brilliance. REFERENCE: Celine campaign material study.',
  creative: 'Surreal color grading, heightened saturation on jewelry. Chromatic contrasts between warm jewelry and fantastical surroundings. REFERENCE: Tim Walker meets luxury.',
  architectural_statement: 'Geometric light patterns, structural shadows. Precise architectural lighting with warm accents on jewelry. REFERENCE: Tadao Ando meets Bulgari.',
  cinematic: 'Film-grade color science, anamorphic feel with subtle halation. Rich shadows, cinematic contrast. Warm practicals, cool ambient. REFERENCE: Roger Deakins meets luxury.',
};

// ═══════════════════════════════════════════════════
// CHARACTER SYSTEM (reused from V1)
// ═══════════════════════════════════════════════════

const CHARACTER_GAZE = [
  'Direct eye contact with camera — confident, magnetic, editorial intensity',
  'Looking slightly past camera (10° off-axis) — mysterious, editorial detachment',
  'Downcast eyes with subtle smile — intimate, contemplative luxury moment',
  'Gazing at the jewelry piece with admiration — drawing viewer attention to product',
  'Three-quarter profile gaze toward soft light source — cinematic, painterly',
  'Eyes closed, serene expression — meditative, haute-couture editorial stillness',
];

const CHARACTER_EXPRESSIONS = [
  'Confident and poised — strong jawline, relaxed brow, slight knowing smile',
  'Softly sensual — parted lips, relaxed gaze, effortless allure',
  'Editorial stoic — neutral expression, high-fashion detachment, angular features',
  'Warm and natural — genuine soft smile, approachable luxury',
  'Regal and commanding — chin slightly raised, strong posture, aristocratic bearing',
  'Dreamy and ethereal — soft focus expression, luminous skin, romantic atmosphere',
];

interface CharacterPersona {
  name: string; age: number; heritage: string;
  skinTone: string; skinUndertone: string;
  hairColor: string; hairTexture: string; hairSignature: string;
  eyeColor: string; faceShape: string;
  bodyType: string; height: string;
  signatureLook: string; fashionVibe: string; bestFor: string[];
  postureLanguage: string; editorialEnergy: string; signatureMannerism: string;
  outfitArchetype: string; outfitPalette: string; accessoryStyle: string; fabricPreference: string;
  editorialReference: string; strengthAsModel: string;
}

const CHARACTER_PERSONAS: CharacterPersona[] = [
  {
    name: 'Defne Aydin', age: 27, heritage: 'Turkish-Mediterranean',
    skinTone: 'Olive gold', skinUndertone: 'warm',
    hairColor: 'Dark chestnut with honey highlights', hairTexture: 'waves', hairSignature: 'Loose cascading waves with sun-kissed honey highlights',
    eyeColor: 'Amber-brown', faceShape: 'Oval with elegant jawline',
    bodyType: 'Slim-athletic', height: '175cm',
    signatureLook: 'Cartier & Bulgari campaign warmth', fashionVibe: 'Mediterranean luxury, warm golden tones',
    bestFor: ['yuzuk', 'kolye', 'kupe'],
    postureLanguage: 'Spine elongated, shoulders pulled back and dropped — like a dancer. Weight shifted to one hip creating S-curve.',
    editorialEnergy: 'Quiet Mediterranean confidence — she does not SEEK attention, she RECEIVES it.',
    signatureMannerism: 'One hand always finds a surface or body contact — collarbone, railing, hair.',
    outfitArchetype: 'Structured blazer over silk camisole OR tailored linen separates.',
    outfitPalette: 'Warm neutrals: camel, ivory, terracotta, olive.',
    accessoryStyle: 'Oversized tortoiseshell sunglasses, structured leather bag',
    fabricPreference: 'Silk, linen, cashmere, fine leather — natural fibers catching light',
    editorialReference: 'Pamela Hanson for Vogue Travel, Mario Testino Gucci campaigns',
    strengthAsModel: 'Skin catches golden hour light like bronze. Natural warmth makes jewelry feel personal.',
  },
  {
    name: 'Elif Kara', age: 24, heritage: 'Turkish-Anatolian',
    skinTone: 'Fair porcelain', skinUndertone: 'cool pink',
    hairColor: 'Jet black', hairTexture: 'straight sleek', hairSignature: 'Perfectly sleek straight hair with mirror-like shine',
    eyeColor: 'Green-hazel', faceShape: 'Heart-shaped',
    bodyType: 'Slim', height: '178cm',
    signatureLook: 'Chanel haute couture editorial', fashionVibe: 'Cool-toned elegance, high-fashion precision',
    bestFor: ['kupe', 'kolye', 'saat'],
    postureLanguage: 'Military-precise posture softened by slight forward lean. Shoulders blade-sharp.',
    editorialEnergy: 'Ice-cool haute couture detachment — the kind of beauty that makes people nervous.',
    signatureMannerism: 'Chin micro-tilt downward before looking up through lashes — dramatic reveal.',
    outfitArchetype: 'Minimalist column dress OR sharp black turtleneck with tailored trousers.',
    outfitPalette: 'Black, white, charcoal, midnight navy. No warm tones.',
    accessoryStyle: 'Geometric structured clutch in black patent',
    fabricPreference: 'Heavy silk crepe, cashmere, structured wool — architectural fabrics',
    editorialReference: 'Karl Lagerfeld Chanel campaigns, Peter Lindbergh monochrome',
    strengthAsModel: 'Porcelain skin creates maximum contrast with jewelry metals.',
  },
  {
    name: 'Zeynep Demir', age: 30, heritage: 'Turkish-Aegean',
    skinTone: 'Warm honey-tan', skinUndertone: 'golden',
    hairColor: 'Rich dark brown', hairTexture: 'loose waves', hairSignature: 'Voluminous loose waves with natural movement',
    eyeColor: 'Deep brown', faceShape: 'Angular diamond with high cheekbones',
    bodyType: 'Proportional', height: '173cm',
    signatureLook: 'Piaget & Van Cleef warmth', fashionVibe: 'Warm approachable luxury, natural radiance',
    bestFor: ['bileklik', 'yuzuk', 'genel'],
    postureLanguage: 'Relaxed but present — like someone who just finished yoga and put on couture.',
    editorialEnergy: 'Approachable luxury — the woman at the gala you actually want to talk to.',
    signatureMannerism: 'Unconsciously rotates rings or touches bracelets — organic jewelry interaction.',
    outfitArchetype: 'Flowing Mediterranean linen separates OR cashmere wrap with wide trousers.',
    outfitPalette: 'Sand, honey, soft gold, warm white, muted terracotta.',
    accessoryStyle: 'Woven leather sandals, simple gold-frame sunglasses',
    fabricPreference: 'Washed linen, soft cashmere, raw silk — fabrics that move and breathe',
    editorialReference: 'Cass Bird natural light portraits, Inez & Vinoodh for Van Cleef',
    strengthAsModel: 'High cheekbones create beautiful shadow play. Hands particularly photogenic.',
  },
  {
    name: 'Selin Ozturk', age: 26, heritage: 'Turkish-Balkan',
    skinTone: 'Light olive', skinUndertone: 'neutral',
    hairColor: 'Dark auburn', hairTexture: 'structured updo', hairSignature: 'Architecturally structured updo revealing neck and ears',
    eyeColor: 'Hazel with gold flecks', faceShape: 'Square jawline, strong features',
    bodyType: 'Athletic', height: '176cm',
    signatureLook: 'Tom Ford & Saint Laurent edge', fashionVibe: 'Sharp editorial power, modern edge',
    bestFor: ['saat', 'bileklik', 'yuzuk'],
    postureLanguage: 'Shoulders squared, spine steel-straight. Occupies space unapologetically.',
    editorialEnergy: 'Corporate power meets fashion edge.',
    signatureMannerism: 'Adjusts watch or cuff instinctively — executive gesture.',
    outfitArchetype: 'Sharp leather jacket over turtleneck OR power-cut blazer.',
    outfitPalette: 'Black, charcoal, burgundy, dark olive.',
    accessoryStyle: 'Structured leather portfolio, ankle boots',
    fabricPreference: 'Butter-soft leather, heavy silk, structured wool gabardine',
    editorialReference: 'Tom Ford campaign precision, Hedi Slimane Saint Laurent',
    strengthAsModel: 'Strong jawline and architectural updo create perfect frame for earrings.',
  },
  {
    name: 'Naz Yilmaz', age: 32, heritage: 'Turkish-Persian',
    skinTone: 'Rich warm olive', skinUndertone: 'deep golden',
    hairColor: 'Black voluminous', hairTexture: 'wavy', hairSignature: 'Full voluminous black waves with dramatic body',
    eyeColor: 'Dark brown', faceShape: 'Oval, soft features',
    bodyType: 'Curvy-proportional', height: '170cm',
    signatureLook: 'Dolce & Gabbana Mediterranean glam', fashionVibe: 'Rich, sensual Mediterranean glamour',
    bestFor: ['kolye', 'kupe', 'genel'],
    postureLanguage: 'Languid, feline grace. Head often tilted 10 degrees.',
    editorialEnergy: 'Sensual Mediterranean warmth — like a Fellini actress between takes.',
    signatureMannerism: 'Runs fingers through voluminous hair — dramatic movement, reveals earrings.',
    outfitArchetype: 'Evening column dress with one shoulder OR flowing silk wrap dress.',
    outfitPalette: 'Deep burgundy, emerald, black, champagne gold.',
    accessoryStyle: 'Vintage-style evening clutch, silk hair clip',
    fabricPreference: 'Heavy silk satin, velvet, fine jersey — fabrics that drape around curves',
    editorialReference: 'Dolce & Gabbana Alta Moda, Paolo Roversi soft focus',
    strengthAsModel: 'Voluminous hair creates dramatic frame. Deep skin tone makes gold glow.',
  },
  {
    name: 'Ceren Aksoy', age: 25, heritage: 'Turkish-Circassian',
    skinTone: 'Fair luminous', skinUndertone: 'warm peach',
    hairColor: 'Platinum-highlighted brown', hairTexture: 'tousled', hairSignature: 'Effortlessly tousled platinum-highlighted waves',
    eyeColor: 'Blue-grey', faceShape: 'High cheekbones, delicate features',
    bodyType: 'Slim', height: '177cm',
    signatureLook: 'Dior & Tiffany ethereal', fashionVibe: 'Ethereal, dreamlike, luminous beauty',
    bestFor: ['kupe', 'kolye', 'yuzuk'],
    postureLanguage: 'Weightless, floating quality — as if gravity is optional.',
    editorialEnergy: 'Dreamy ethereal presence — she exists slightly outside of time.',
    signatureMannerism: 'Looks away then slowly turns toward camera — cinematic reveal.',
    outfitArchetype: 'Sheer layered blouse over camisole OR ethereal midi dress.',
    outfitPalette: 'Ivory, blush, pale grey, soft lavender, champagne.',
    accessoryStyle: 'Silk ribbon in hair, vintage porcelain-handle clutch',
    fabricPreference: 'Silk organza, chiffon, fine lace, soft tulle — transparent fabrics',
    editorialReference: 'Tim Walker fantasy editorials, Dior J\'adore romanticism',
    strengthAsModel: 'Luminous fair skin makes diamonds sparkle. Blue-grey eyes create otherworldly contrast.',
  },
  {
    name: 'Asli Korkmaz', age: 29, heritage: 'Turkish-Kurdish',
    skinTone: 'Medium-tan', skinUndertone: 'warm caramel',
    hairColor: 'Very dark brown', hairTexture: 'slicked-back', hairSignature: 'Sleek slicked-back hair emphasizing strong bone structure',
    eyeColor: 'Brown-amber', faceShape: 'Strong angular, defined jawline',
    bodyType: 'Athletic-slim', height: '174cm',
    signatureLook: 'Versace & Boucheron power', fashionVibe: 'Powerful, commanding, bold luxury',
    bestFor: ['saat', 'bileklik', 'genel'],
    postureLanguage: 'Commanding stillness. Chin level, gaze direct. Stands like a monument.',
    editorialEnergy: 'Raw power channeled through stillness — like a panther at rest.',
    signatureMannerism: 'Crosses arms with one wrist forward — natural watch/bracelet showcase.',
    outfitArchetype: 'All-black power ensemble — sharp blazer, silk shirt, tailored trousers.',
    outfitPalette: 'Black, deep charcoal, midnight. Monochromatic power.',
    accessoryStyle: 'Structured leather briefcase-style bag, minimal pointed-toe heels',
    fabricPreference: 'Matte black wool, heavy silk charmeuse, structured leather',
    editorialReference: 'Versace Medusa campaigns, Mert & Marcus high-contrast',
    strengthAsModel: 'Slicked-back hair fully exposes ears/neck — ideal for earring/necklace drama.',
  },
  {
    name: 'Ipek Sahin', age: 28, heritage: 'Turkish-Levantine',
    skinTone: 'Medium olive', skinUndertone: 'neutral-warm',
    hairColor: 'Dark brown', hairTexture: 'side-parted elegant', hairSignature: 'Elegant side-parted dark brown with soft drape',
    eyeColor: 'Warm brown', faceShape: 'Soft round, gentle features',
    bodyType: 'Proportional', height: '171cm',
    signatureLook: 'Chopard & Bvlgari classic', fashionVibe: 'Timeless classic elegance, refined warmth',
    bestFor: ['yuzuk', 'kolye', 'bileklik', 'genel'],
    postureLanguage: 'Classic elegance — spine straight but not stiff, hands always graceful.',
    editorialEnergy: 'Timeless sophistication — era-transcendent.',
    signatureMannerism: 'Delicately touches pendant or necklace — intimate jewelry interaction.',
    outfitArchetype: 'Classic white button-down with premium denim OR cashmere turtleneck.',
    outfitPalette: 'Cream, navy, camel, soft grey, white. Classic neutrals.',
    accessoryStyle: 'Vintage-style leather handbag, silk neck scarf, classic pumps',
    fabricPreference: 'Fine cotton poplin, premium cashmere, brushed wool — heritage fabrics',
    editorialReference: 'Chopard Red Carpet campaigns, Irving Penn classic portraits',
    strengthAsModel: 'Gentle features make jewelry the star. Neutral-warm skin flatters every metal.',
  },
];

// ── Outfit Pool ──
interface OutfitArchetype {
  name: string; description: string; colorPalette: string; fabrics: string;
  neckline: string; sleeveType: string; accessoryNotes: string; bestFor: string[];
}

const OUTFIT_POOL: OutfitArchetype[] = [
  { name: 'Power Tailoring', description: 'Oversized blazer in neutral tone over silk camisole, tailored wide-leg trousers.', colorPalette: 'Charcoal, navy, camel, ivory, black', fabrics: 'Wool crepe blazer, silk charmeuse camisole', neckline: 'Deep V from blazer lapels — ideal for necklace visibility', sleeveType: 'Long blazer sleeves slightly pushed up — wrist partially exposed', accessoryNotes: 'Structured leather clutch. Minimal.', bestFor: ['kolye', 'kupe', 'saat', 'bileklik'] },
  { name: 'Mediterranean Luxe', description: 'Flowing linen blouse with relaxed drape, wide-leg palazzo trousers.', colorPalette: 'White, sand, terracotta, olive, soft gold', fabrics: 'Washed linen, raw silk, light cotton voile', neckline: 'Open collar or boat neck — décolletage visible', sleeveType: 'Rolled-up or three-quarter — full wrist exposure', accessoryNotes: 'Woven straw bag, tortoiseshell sunglasses', bestFor: ['kolye', 'bileklik', 'yuzuk', 'kupe'] },
  { name: 'Evening Minimalist', description: 'One-shoulder or strapless column dress in solid color.', colorPalette: 'Black, midnight navy, champagne, deep burgundy, emerald', fabrics: 'Silk crepe, satin, structured jersey', neckline: 'One-shoulder or strapless — maximum exposure', sleeveType: 'Sleeveless — arms fully exposed', accessoryNotes: 'No bag. Dress is canvas, jewelry is art.', bestFor: ['kupe', 'kolye', 'bileklik', 'yuzuk'] },
  { name: 'Street Luxe Editorial', description: 'Fitted leather jacket over black turtleneck, slim trousers.', colorPalette: 'Black, charcoal, burgundy, dark chocolate', fabrics: 'Soft leather, fine merino wool turtleneck', neckline: 'High turtleneck — frames face for earring focus', sleeveType: 'Jacket sleeves ending at wrist — bracelet peek', accessoryNotes: 'Structured ankle boots, no bag', bestFor: ['kupe', 'saat', 'yuzuk'] },
  { name: 'White Canvas', description: 'Crisp white button-down shirt tucked into classic indigo jeans.', colorPalette: 'Pure white, classic indigo denim', fabrics: 'Crisp cotton poplin, premium denim', neckline: 'Open collar V — versatile for necklaces', sleeveType: 'Sleeves rolled to mid-forearm — ideal wrist exposure', accessoryNotes: 'Simple leather belt. No competing accessories.', bestFor: ['kolye', 'kupe', 'yuzuk', 'bileklik', 'saat', 'genel'] },
];

// ── Model Poses ──
const PRODUCT_TYPE_MODEL_CONFIG: Record<string, { bodyRegion: string; poses: string[] }> = {
  yuzuk: {
    bodyRegion: 'hand and fingers',
    poses: [
      'Model\'s hand gracefully touching collarbone, ring prominently visible on finger. Fingers slightly spread for clarity.',
      'Hand gently framing face near jawline, ring in razor-sharp focus. Dreamy expression with soft eye contact.',
      'Hand running through tousled hair, ring catching a spark of light. Candid editorial moment.',
      'Both hands together near chin in contemplative pose, ring as absolute centerpiece.',
      'Hand resting on bare shoulder, ring visible against luminous skin. Three-quarter profile.',
      'Hand elegantly draped over edge of dark surface, ring catching dramatic side-light.',
      'Model examining ring on her own hand — intimate, admiring moment.',
    ],
  },
  bileklik: {
    bodyRegion: 'wrist',
    poses: [
      'Wrist resting elegantly on marble surface, bracelet draped naturally with golden catch-light.',
      'Arm raised with hand in hair, bracelet sliding naturally on wrist.',
      'Wrist extended forward toward camera, bracelet in sharp macro focus.',
      'Hand reaching for champagne flute — bracelet sliding toward wrist bone. Candid luxury.',
      'Wrist draped over arm of velvet chair — bracelet dangling with gravity.',
      'Forearm resting on window ledge with soft natural light — bracelet glowing.',
    ],
  },
  kupe: {
    bodyRegion: 'ear and profile',
    poses: [
      'Pure side profile with hair swept behind ear. Earring fully visible. Clean jawline, neck elongated.',
      'Three-quarter view looking over shoulder, earring prominent against neck silhouette.',
      'Head tilted 15° toward camera, earring swaying with captured micro-movement.',
      'Hair swept up in elegant chignon, both earrings visible from frontal three-quarter angle.',
      'Extreme close-up of ear and jawline — earring filling the frame. Macro-portrait hybrid.',
      'Model laughing naturally with head tilted — earring caught in mid-swing. Candid warmth.',
    ],
  },
  kolye: {
    bodyRegion: 'neck and décolletage',
    poses: [
      'Straight-on décolletage view, necklace centered. Clean neckline — off-shoulder or strapless.',
      'Slight head tilt with eyes lowered toward necklace — creating viewer gaze path to product.',
      'Profile view showing necklace chain flowing along neck curve. Artistic negative space.',
      'Three-quarter view with hand delicately touching pendant — drawing attention.',
      'Head thrown back slightly, necklace displayed on elongated neck. Sensual luxury.',
      'Standing in doorframe silhouette, necklace catching the only light source.',
    ],
  },
  saat: {
    bodyRegion: 'wrist',
    poses: [
      'Wrist check pose — glancing at watch face with quiet confidence. Business editorial.',
      'Forearm on dark wood surface, watch dial angled toward camera. Relaxed luxury.',
      'Hand adjusting jacket sleeve cuff, revealing watch naturally.',
      'Crossed arms with watch prominently visible on top wrist. Power pose.',
      'Hand writing with fountain pen — watch visible on writing wrist. Intellectual luxury.',
      'Wrist on balcony railing with city skyline bokeh — watch prominent.',
    ],
  },
  genel: {
    bodyRegion: 'full portrait',
    poses: [
      'Elegant three-quarter portrait with jewelry as natural complement.',
      'Editorial fashion pose — angular body position, architectural composition.',
      'Soft natural portrait with genuine expression. Approachable luxury.',
      'Dramatic profile silhouette with jewelry catching rim light.',
      'Close-up portrait from chest up — jewelry framed by clean neckline.',
    ],
  },
};

const EDITORIAL_ENERGY_DIRECTIVE = `
MODEL BEHAVIOR (MANDATORY):
- Model is EXISTING in a moment, not posing for a photo.
- Body tension: 30% — not rigid, not collapsed.
- Every gesture has INTENTION.
- Weight distribution NATURAL — organic S-curve.
- Spine LONG, shoulders DOWN and BACK.
- Eyes have DEPTH — thinking, not staring.
- Overall: "This person has somewhere important to be after this photo."`;

// ═══════════════════════════════════════════════════
// V2 CORE: 6-BLOCK JSON PROMPT BUILDER
// ═══════════════════════════════════════════════════

interface SixBlockPrompt {
  shot: string;
  lens: string;
  light: string;
  texture: string;
  composition: string;
  style_reference: string;
}

function buildSixBlockJSON(blocks: SixBlockPrompt): string {
  return `
═══════════════════════════════════════════════════════════════
V2 PROMPT ENGINE — 6-BLOCK STRUCTURED FORMAT
═══════════════════════════════════════════════════════════════

Parse each block independently. Every block defines a separate creative axis.

{
  "shot": "${blocks.shot}",
  "lens": "${blocks.lens}",
  "light": "${blocks.light}",
  "texture": "${blocks.texture}",
  "composition": "${blocks.composition}",
  "style_reference": "${blocks.style_reference}"
}

Apply ALL six blocks simultaneously to create the final image.
═══════════════════════════════════════════════════════════════`;
}

function selectLens(sceneType: string, userLens?: string): LensOption {
  if (userLens) {
    const found = LENS_OPTIONS.find(l => l.key === userLens);
    if (found) return found;
  }
  const matching = LENS_OPTIONS.filter(l => l.bestFor.includes(sceneType));
  return matching.length > 0 ? pickRandom(matching) : pickRandom(LENS_OPTIONS);
}

function selectAngle(userAngle?: string): CameraAngle {
  if (userAngle) {
    const found = CAMERA_ANGLES.find(a => a.key === userAngle);
    if (found) return found;
  }
  return pickRandom(CAMERA_ANGLES);
}

function selectLighting(sceneType: string, aestheticKey?: string, userLighting?: string): LightingSetup {
  if (userLighting) {
    const found = LIGHTING_SETUPS.find(l => l.key === userLighting);
    if (found) return found;
  }
  // Try matching by aesthetic first, then scene type
  const byAesthetic = aestheticKey ? LIGHTING_SETUPS.filter(l => l.bestFor.includes(aestheticKey)) : [];
  if (byAesthetic.length > 0) return pickRandom(byAesthetic);
  const byScene = LIGHTING_SETUPS.filter(l => l.bestFor.includes(sceneType));
  return byScene.length > 0 ? pickRandom(byScene) : pickRandom(LIGHTING_SETUPS);
}

function selectAesthetic(userAesthetic?: string): AestheticStyle {
  if (userAesthetic) {
    const found = AESTHETIC_STYLES.find(a => a.key === userAesthetic);
    if (found) return found;
  }
  return pickRandom(AESTHETIC_STYLES);
}

// ═══════════════════════════════════════════════════
// PRODUCT IDENTITY & FIDELITY (same as V1)
// ═══════════════════════════════════════════════════

function buildProductIdentityCard(analysisResult: any, imageIndex?: number, totalImages?: number): string {
  const crossImageLine = (imageIndex != null && totalImages != null)
    ? `\nCROSS-IMAGE CONSISTENCY: This is image ${imageIndex} of ${totalImages}. The jewelry MUST be INDISTINGUISHABLE from the same piece in other images.\n`
    : '';

  const visualDna = analysisResult.visual_dna;
  const dnaBlock = visualDna ? `
VISUAL DNA:
- Silhouette: ${visualDna.silhouette_descriptor || 'N/A'}
- Visual Axis: ${visualDna.dominant_visual_axis || 'N/A'}
- Light Signature: ${visualDna.light_signature || 'N/A'}
- Color Map: ${visualDna.color_relationship_map || 'N/A'}
- Scale: ${visualDna.scale_anchor || 'N/A'}
- Asymmetries: ${visualDna.distinguishing_asymmetries || 'none'}
- Optical Weight Center: ${visualDna.optical_weight_center || 'center'}` : '';

  return `
═══════════════════════════════════════════════════════════════
PRODUCT IDENTITY CARD — THIS JEWELRY MUST LOOK IDENTICAL IN EVERY IMAGE
═══════════════════════════════════════════════════════════════
${crossImageLine}
TYPE: ${analysisResult.type || 'jewelry'}
${analysisResult.visual_fingerprint ? `FINGERPRINT: ${analysisResult.visual_fingerprint}` : ''}
${dnaBlock}

STONES: Exactly ${analysisResult.structure?.center_stone_count ?? '?'} center + ${analysisResult.structure?.accent_stone_count ?? '0'} accent stones.
PRONGS: Exactly ${analysisResult.structure?.total_prong_count ?? 'as shown'} prongs in ${analysisResult.structure?.prong_style ?? 'original'} style.
PROPORTIONS: ${analysisResult.proportions?.length_to_width_ratio ?? '1.0'} L:W ratio, ${analysisResult.proportions?.overall_profile ?? 'standard'} profile.

ANY deviation from this identity card is a CRITICAL ERROR.
═══════════════════════════════════════════════════════════════`.trim();
}

// ═══════════════════════════════════════════════════
// V2 PROMPT BUILDERS
// ═══════════════════════════════════════════════════

function buildEditorialPromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  identityCard: string, aesthetic: AestheticStyle,
  userLens?: string, userAngle?: string, userLighting?: string,
): string {
  const categories = Array.from(new Set(EDITORIAL_SCENE_POOL.map(s => s.category)));
  const chosenCategory = pickRandom(categories);
  const scenesInCategory = EDITORIAL_SCENE_POOL.filter(s => s.category === chosenCategory);
  const scene = pickRandom(scenesInCategory);
  const lens = selectLens('editorial', userLens);
  const angle = selectAngle(userAngle);
  const lighting = selectLighting('editorial', aesthetic.key, userLighting);

  console.log(`V2 Editorial — Scene: ${scene.name} [${scene.category}], Aesthetic: ${aesthetic.name}, Lens: ${lens.key}, Angle: ${angle.key}, Light: ${lighting.key}`);

  const sixBlock = buildSixBlockJSON({
    shot: `Editorial luxury jewelry photography. ${scene.prompt}`,
    lens: `${lens.focal} — ${lens.description}`,
    light: `${lighting.name}: ${lighting.description} Color temp: ${lighting.temperature}. AESTHETIC MOD: ${aesthetic.lightingMod}`,
    texture: `Metal: ${analysisResult.metal?.type || 'gold'} ${analysisResult.metal?.finish || 'polished'} — realistic surface reflections and micro-texture. Stone: natural light behavior with fire, brilliance, scintillation. Scene surface: as defined by scene setting.`,
    composition: `${angle.description}. ${angle.effect} The jewelry is the clear focal point — scene complements, never distracts. Shallow depth of field with soft bokeh.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood} ${aesthetic.reference}. COLOR GRADE: ${aesthetic.colorGrade}. SCENE COLOR: ${COLOR_GRADE_MODIFIERS[scene.category] || ''}`,
  });

  return `${identityCard}

EDITORIAL / CREATIVE LUXURY JEWELRY PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

SCENE: ${scene.name}
${scene.prompt}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic — natural look, no CGI artifacts
- Sharp focus on jewelry`;
}

function buildEcommercePromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  identityCard: string,
  userLens?: string, userAngle?: string,
): string {
  const lens = selectLens('ecommerce', userLens);
  const angle = userAngle ? selectAngle(userAngle) : (CAMERA_ANGLES.find(a => a.key === '45_degree') ?? CAMERA_ANGLES[0]);

  const sixBlock = buildSixBlockJSON({
    shot: `E-commerce product photography. Product fills 60-70% of frame. Clean commercial catalog shot.`,
    lens: `${lens.focal} — ${lens.description}. Deep depth of field for maximum detail visibility.`,
    light: `Studio Softbox: Soft omnidirectional studio lighting from all sides. Minimal shadows — just enough for depth/grounding. 5500K neutral daylight. Even, balanced illumination revealing all product details.`,
    texture: `Metal: accurate color-true representation. Stone: precise facet rendering. Surface: pure white to very light grey gradient (RGB 248-255). NO props, NO environment.`,
    composition: `${angle.description}. Product centered. Sharp focus across entire product (deep DOF). No artistic blur. No distractions.`,
    style_reference: `Amazon / Trendyol / Shopify product listing quality. Professional packshot, catalog photography. Zero creative interpretation — pure commercial accuracy. COLOR: Neutral, precise, controlled.`,
  });

  return `${identityCard}

E-COMMERCE PROFESSIONAL PRODUCT PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

BACKGROUND: Pure white to very light grey. NO props, NO model, NO hands. Product only.
STANDARDS: Commercial-grade precision and clarity.

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic studio photography`;
}

function buildModelPromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  productType: string, identityCard: string, aesthetic: AestheticStyle,
  userLens?: string, userAngle?: string, userLighting?: string,
): string {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG['genel'];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const _outfitPool873 = OUTFIT_POOL.filter(o => o.bestFor.includes(productType));
  const outfit = pickRandom(_outfitPool873.length > 0 ? _outfitPool873 : OUTFIT_POOL);
  const lens = selectLens('model', userLens);
  const angle = selectAngle(userAngle);
  const lighting = selectLighting('model', aesthetic.key, userLighting);

  console.log(`V2 Model — Persona: ${persona.name}, Aesthetic: ${aesthetic.name}, Lens: ${lens.key}, Light: ${lighting.key}`);

  const sixBlock = buildSixBlockJSON({
    shot: `Editorial model photography. Real human model wearing jewelry. Focus on ${config.bodyRegion}. Fashion editorial meets luxury advertising.`,
    lens: `${lens.focal} — ${lens.description}. Classic portrait compression and bokeh.`,
    light: `${lighting.name}: ${lighting.description}. ${lighting.temperature}. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone} with ${persona.skinUndertone} undertone. Real skin texture — visible pores, natural micro-imperfections. NO plastic/CGI. Metal: accurate color preservation. Stone: natural light behavior.`,
    composition: `${angle.description}. ${angle.effect} Model supports jewelry — jewelry is the HERO. Sharp focus on jewelry, model slightly softer. Body region: ${config.bodyRegion.toUpperCase()}.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood} ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Model ref: ${persona.editorialReference}.`,
  });

  return `${identityCard}

EDITORIAL MODEL PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

⚠️ MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY ⚠️

CHARACTER DNA — ${persona.name.toUpperCase()} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Age: ${persona.age}, Body: ${persona.bodyType}, ${persona.height}
- Fashion: ${persona.fashionVibe}
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Strength: ${persona.strengthAsModel}

OUTFIT — ${outfit.name.toUpperCase()}:
- ${outfit.description}
- Palette: ${outfit.colorPalette}
- Fabrics: ${outfit.fabrics}
- Neckline: ${outfit.neckline}
- Sleeves: ${outfit.sleeveType}

POSE: ${pose}
EXPRESSION: ${expression}
GAZE: ${gaze}

${EDITORIAL_ENERGY_DIRECTIVE}

TECHNICAL:
- 4K ultra-high resolution
- Ultra photorealistic portrait photography`;
}

function buildMacroPromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  identityCard: string, aesthetic: AestheticStyle,
  userLighting?: string,
): string {
  const lighting = selectLighting('macro', aesthetic.key, userLighting);

  const sixBlock = buildSixBlockJSON({
    shot: `Extreme macro close-up at near 1:1 magnification. Focus on the most visually striking detail area. Metal grain, stone facets, prong tips all visible.`,
    lens: `100mm f/2.8 Macro (1:1) — extreme detail resolution. Individual metal surface texture and tooling marks become visible art.`,
    light: `${lighting.name}: ${lighting.description}. Single focused key light to reveal surface micro-texture. Specular highlights on metal edges create luminous outlines.`,
    texture: `Metal: ${analysisResult.metal?.type || 'gold'} ${analysisResult.metal?.finish || 'polished'} — grain texture, reflection patterns, surface characteristics at microscopic level. Stone: individual facet edges visible, internal light refraction paths, natural inclusions. HYPER-REAL material rendering.`,
    composition: `Camera extremely close — filling 90% of frame with detail. Off-center rule of thirds. Very shallow DOF (f/2.8-4) — only center detail plane sharp. Beautiful bokeh transition. Dark gradient background.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. COLOR: ${aesthetic.colorGrade}. Macro jewelry photography at its finest — Graff Diamonds campaign detail shots, Harry Winston close-up studies.`,
  });

  return `${identityCard}

MACRO DETAIL PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic macro photography`;
}

function buildModelCloseUpPromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  productType: string, identityCard: string, aesthetic: AestheticStyle,
  userLighting?: string,
): string {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG['genel'];
  const pose = pickRandom(config.poses);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const _outfitPool970 = OUTFIT_POOL.filter(o => o.bestFor.includes(productType));
  const outfit = pickRandom(_outfitPool970.length > 0 ? _outfitPool970 : OUTFIT_POOL);
  const lighting = selectLighting('model_closeup', aesthetic.key, userLighting);

  console.log(`V2 Model Close-Up — Persona: ${persona.name}, Aesthetic: ${aesthetic.name}`);

  const sixBlock = buildSixBlockJSON({
    shot: `Tight crop intimate detail shot of jewelry on real model. Extreme close-up on ${config.bodyRegion}. Jewelry fills 60-70% of frame. Model skin visible as context.`,
    lens: `85mm f/1.4 — portrait compression, beautiful bokeh. Very shallow DOF: f/1.8-2.0, only jewelry plane sharp.`,
    light: `${lighting.name}: ${lighting.description}. Soft, warm directional light from one side. Gentle skin glow with natural highlights on jewelry. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone} — real texture, visible pores, natural warmth. NO plastic/CGI. Metal and stone: maximum detail at close range.`,
    composition: `Extreme close-up / tight crop on ${config.bodyRegion}. Natural relaxed interaction with jewelry. Body region fills frame.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Intimate luxury close-up photography.`,
  });

  return `${identityCard}

MODEL CLOSE-UP PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

⚠️ MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY ⚠️

MODEL — ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Age ${persona.age}, ${persona.heritage}
- Strength: ${persona.strengthAsModel}

OUTFIT: ${outfit.name} — ${outfit.description}

POSE: ${pose}

${EDITORIAL_ENERGY_DIRECTIVE}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic close-up portrait photography`;
}

function buildModelLifestylePromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  productType: string, identityCard: string, aesthetic: AestheticStyle,
  userLens?: string, userLighting?: string,
): string {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG['genel'];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const _outfitPool1026 = OUTFIT_POOL.filter(o => o.bestFor.includes(productType));
  const outfit = pickRandom(_outfitPool1026.length > 0 ? _outfitPool1026 : OUTFIT_POOL);
  const lens = selectLens('model_lifestyle', userLens);
  const lighting = selectLighting('model_lifestyle', aesthetic.key, userLighting);

  const lifestyleScenes = [
    { setting: 'Parisian café terrace at golden hour', mood: 'warm, romantic, European luxury' },
    { setting: 'Luxury hotel suite with soft morning light through sheer curtains', mood: 'intimate, serene, private luxury' },
    { setting: 'Art gallery opening with warm ambient lighting', mood: 'sophisticated, cultural, modern elegance' },
    { setting: 'Rooftop bar at sunset with city skyline bokeh', mood: 'urban, cosmopolitan, aspirational' },
    { setting: 'Mediterranean seaside restaurant with natural daylight', mood: 'effortless, sun-kissed, resort luxury' },
  ];
  const lifestyleScene = pickRandom(lifestyleScenes);

  console.log(`V2 Model Lifestyle — Persona: ${persona.name}, Aesthetic: ${aesthetic.name}, Scene: ${lifestyleScene.setting.substring(0, 30)}`);

  const sixBlock = buildSixBlockJSON({
    shot: `Lifestyle photography. Real model wearing jewelry in natural luxury setting: ${lifestyleScene.setting}. Candid editorial moment captured mid-life.`,
    lens: `${lens.focal} — ${lens.description}. Natural perspective, soft background.`,
    light: `${lighting.name}: ${lighting.description}. Natural warm lighting appropriate to setting. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone}, natural real texture. Environment: authentic setting materials. Metal/stone: preserved accurately.`,
    composition: `Body region: ${config.bodyRegion}. Jewelry prominent but scene feels authentic, not staged. Background softly blurred (f/2.0-2.8 bokeh). Environment adds context without competing.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Scene mood: ${lifestyleScene.mood}.`,
  });

  return `${identityCard}

MODEL LIFESTYLE PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

⚠️ MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY ⚠️

CHARACTER — ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Expression: ${expression}
- Gaze: ${gaze}
- Age ${persona.age}, Body: ${persona.bodyType}, ${persona.height}
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Strength: ${persona.strengthAsModel}

OUTFIT: ${outfit.name} — ${outfit.description}

POSE: ${pose}

${EDITORIAL_ENERGY_DIRECTIVE}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic lifestyle photography`;
}

function buildCustomPromptV2(
  analysisResult: any, fidelityBlock: string, productExtractionBlock: string,
  identityCard: string, customText: string, aesthetic: AestheticStyle,
): string {
  const sixBlock = buildSixBlockJSON({
    shot: `Custom user-directed creative vision: ${customText}`,
    lens: `Automatically selected based on scene requirements`,
    light: `As appropriate for user's creative direction. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Metal and stone: preserved exactly as analyzed. Scene textures as described by user.`,
    composition: `As directed by user. Jewelry is the hero of the image.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. COLOR: ${aesthetic.colorGrade}.`,
  });

  return `${identityCard}

CUSTOM JEWELRY PHOTOGRAPHY — V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

USER CREATIVE DIRECTION:
${customText}

CONSTRAINTS:
- Jewelry MUST be the hero
- Preserve ALL jewelry details exactly
- Maintain photorealistic quality — 4K, no CGI artifacts

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic professional photography`;
}

// ═══════════════════════════════════════════════════
// STYLE REFERENCE ANALYSIS (same as V1)
// ═══════════════════════════════════════════════════

interface StyleReferenceAnalysis {
  scene: { setting: string; background_elements: string; surface: string; season_time: string; };
  lighting: { type: string; direction: string; quality: string; color_temperature: string; };
  composition: { framing: string; camera_angle: string; depth_of_field: string; };
  model: { present: boolean; pose_description: string; body_parts_visible: string; expression_mood: string; clothing: string; skin_tone: string; };
  mood: { overall_atmosphere: string; color_palette: string; style_reference: string; editorial_genre: string; };
  existing_jewelry: { present: boolean; description: string; location: string; };
  pose_detail: { hand_position: string; body_angle: string; head_tilt: string; weight_distribution: string; gesture: string; };
  brand_aesthetic: { luxury_tier: string; visual_language: string; dominant_colors: string[]; texture_quality: string; reference_brand: string; };
  technical: { negative_space: string; focal_point: string; blur_level: string; color_grading: string; contrast_style: string; };
}

async function analyzeStyleReference(styleBase64: string): Promise<StyleReferenceAnalysis | null> {
  try {
    const stylePrompt = `You are a world-class luxury jewelry photography art director and brand strategist. Analyze this style reference image with extreme precision — every detail matters for recreating its exact visual language in a new jewelry photograph.

Study the image as if you need to brief a photographer and stylist to recreate this EXACT visual style with a different jewelry piece.

Return JSON:
{
  "scene": { "setting": "detailed environment description", "background_elements": "every visible background element", "surface": "surface material and texture under/around subject", "season_time": "time of day, season, weather if visible" },
  "lighting": { "type": "key light type and modifier (softbox/beauty dish/natural/ring/etc)", "direction": "precise light direction (45-deg front-left, overhead, backlit, etc)", "quality": "hard/soft/diffused/specular — describe shadow edges", "color_temperature": "warm/cool/neutral with approximate Kelvin" },
  "composition": { "framing": "tight crop/medium/wide — what is included and excluded", "camera_angle": "exact angle (eye-level/15-deg above/bird's eye/etc)", "depth_of_field": "shallow f/1.4 bokeh / medium f/4 / deep f/11 — describe blur transition" },
  "model": { "present": true, "pose_description": "detailed full body pose description", "body_parts_visible": "list all visible body parts", "expression_mood": "facial expression and emotional tone", "clothing": "detailed clothing description with colors and materials", "skin_tone": "skin tone and undertone" },
  "mood": { "overall_atmosphere": "emotional atmosphere in 2-3 sentences", "color_palette": "dominant and accent colors with hex approximations", "style_reference": "photographer/brand this resembles", "editorial_genre": "luxury editorial/campaign/lifestyle/e-commerce/etc" },
  "existing_jewelry": { "present": true, "description": "describe any jewelry visible", "location": "where on body/scene" },
  "pose_detail": { "hand_position": "exact hand and finger placement description", "body_angle": "body rotation in degrees from camera (frontal/three-quarter/profile)", "head_tilt": "head angle and direction of tilt", "weight_distribution": "how weight is distributed — which hip, lean direction, S-curve", "gesture": "overall gesture quality — relaxed/dynamic/static/elegant/powerful" },
  "brand_aesthetic": { "luxury_tier": "haute_couture|high_luxury|accessible_luxury|fashion|artisan", "visual_language": "describe the brand's visual DNA in 1-2 sentences", "dominant_colors": ["#hex1", "#hex2", "#hex3"], "texture_quality": "describe dominant textures (matte/glossy/silk/leather/natural)", "reference_brand": "closest luxury brand aesthetic match (Cartier/Tiffany/Bulgari/Van Cleef/etc)" },
  "technical": { "negative_space": "describe use of negative space — minimal/balanced/generous", "focal_point": "where the eye is drawn first and the visual flow path", "blur_level": "background blur description with approximate f-stop", "color_grading": "color grade style — warm lift/cool shadows/film emulation/clean neutral/etc", "contrast_style": "low-key dramatic/high-key bright/balanced/matte/crushed blacks" }
}
ONLY valid JSON.`;

    const content = await callGeminiAnalysis({ prompt: stylePrompt, imageBase64: styleBase64 });
    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    return result as StyleReferenceAnalysis;
  } catch (err) {
    console.error('Style reference analysis failed:', err);
    return null;
  }
}

function buildStyleTransferPromptV2(
  styleAnalysis: StyleReferenceAnalysis | null, productType: string | null,
  fidelityBlock: string, productExtractionBlock: string, identityCard: string,
  aesthetic: AestheticStyle, analysisResult?: any,
): string {
  const placementMap: Record<string, { bodyPart: string; placement: string; removal: string }> = {
    'yuzuk': { bodyPart: 'hand/finger', placement: 'Place the ring on the finger as shown in style reference.', removal: 'Remove any existing rings.' },
    'bileklik': { bodyPart: 'wrist', placement: 'Place the bracelet on the wrist.', removal: 'Remove any existing bracelets.' },
    'kupe': { bodyPart: 'ear', placement: 'Place the earring on the ear. If only one ear visible, render ONE earring.', removal: 'Remove any existing earrings.' },
    'kolye': { bodyPart: 'neck/décolletage', placement: 'Place the necklace around the neck.', removal: 'Remove any existing necklaces.' },
    'saat': { bodyPart: 'wrist', placement: 'Place the watch on the wrist with dial visible.', removal: 'Remove any existing watches.' },
  };
  const pl = placementMap[productType || ''] || { bodyPart: 'appropriate body part', placement: 'Place the jewelry naturally.', removal: 'Remove any existing jewelry from target.' };

  // Scene & environment from reference
  const sceneBlock = styleAnalysis ? `SCENE: ${styleAnalysis.scene.setting}. BG: ${styleAnalysis.scene.background_elements}. Surface: ${styleAnalysis.scene.surface}. Time: ${styleAnalysis.scene.season_time}.` : '';

  // Lighting from reference + product stone optics interaction
  const stoneOpticsHint = analysisResult?.stone_optics
    ? `STONE LIGHT BEHAVIOR: Brilliance=${analysisResult.stone_optics.brilliance_pattern}, Fire=${analysisResult.stone_optics.fire_dispersion}, Luster=${analysisResult.stone_optics.surface_luster}. Render stone optical properties accurately under the reference lighting.`
    : '';
  const lightBlock = styleAnalysis ? `LIGHT: ${styleAnalysis.lighting.type}, direction: ${styleAnalysis.lighting.direction}, quality: ${styleAnalysis.lighting.quality}, temperature: ${styleAnalysis.lighting.color_temperature}. ${stoneOpticsHint}` : '';

  // Composition + pose detail from reference
  const compBlock = styleAnalysis ? `FRAMING: ${styleAnalysis.composition.framing}. CAMERA: ${styleAnalysis.composition.camera_angle}. DOF: ${styleAnalysis.composition.depth_of_field}.` : '';
  const poseBlock = styleAnalysis?.pose_detail ? `POSE DETAIL: Hands: ${styleAnalysis.pose_detail.hand_position}. Body angle: ${styleAnalysis.pose_detail.body_angle}. Head: ${styleAnalysis.pose_detail.head_tilt}. Weight: ${styleAnalysis.pose_detail.weight_distribution}. Gesture: ${styleAnalysis.pose_detail.gesture}.` : '';
  const modelBlock = styleAnalysis?.model?.present ? `MODEL: ${styleAnalysis.model.pose_description}. Visible: ${styleAnalysis.model.body_parts_visible}. Expression: ${styleAnalysis.model.expression_mood}. Clothing: ${styleAnalysis.model.clothing}. Skin: ${styleAnalysis.model.skin_tone}.` : '';

  // Brand aesthetic from reference
  const brandBlock = styleAnalysis?.brand_aesthetic ? `BRAND LANGUAGE: ${styleAnalysis.brand_aesthetic.visual_language}. Tier: ${styleAnalysis.brand_aesthetic.luxury_tier}. Reference: ${styleAnalysis.brand_aesthetic.reference_brand}. Dominant colors: ${styleAnalysis.brand_aesthetic.dominant_colors?.join(', ') || 'N/A'}. Textures: ${styleAnalysis.brand_aesthetic.texture_quality}.` : '';

  // Technical composition from reference
  const techBlock = styleAnalysis?.technical ? `TECHNICAL STYLE: Negative space: ${styleAnalysis.technical.negative_space}. Focal point: ${styleAnalysis.technical.focal_point}. Blur: ${styleAnalysis.technical.blur_level}. Color grading: ${styleAnalysis.technical.color_grading}. Contrast: ${styleAnalysis.technical.contrast_style}.` : '';

  // Mood from reference
  const moodBlock = styleAnalysis ? `MOOD: ${styleAnalysis.mood.overall_atmosphere}. Palette: ${styleAnalysis.mood.color_palette}. Style: ${styleAnalysis.mood.style_reference}. Genre: ${styleAnalysis.mood.editorial_genre}.` : '';

  // Product craftsmanship detail for texture rendering
  const craftBlock = analysisResult?.craftsmanship
    ? `CRAFTSMANSHIP RENDER: ${analysisResult.craftsmanship.setting_technique_detail}. Quality: ${analysisResult.craftsmanship.quality_grade}. Edge: ${analysisResult.craftsmanship.edge_treatment}. Finish zones: ${JSON.stringify(analysisResult.craftsmanship.finish_zones || [])}.`
    : '';
  const chainBlock = analysisResult?.chain_clasp && analysisResult.chain_clasp.chain_style !== 'none'
    ? `CHAIN: ${analysisResult.chain_clasp.chain_style} ${analysisResult.chain_clasp.chain_thickness}. Clasp: ${analysisResult.chain_clasp.clasp_type} (${analysisResult.chain_clasp.clasp_visibility}).`
    : '';

  const sixBlock = buildSixBlockJSON({
    shot: `Style reference transfer — recreate the reference image's EXACT visual style, pose, scene, and atmosphere with the analyzed jewelry piece. ${sceneBlock} ${brandBlock}`,
    lens: `Match reference exactly: ${compBlock} ${techBlock}`,
    light: `Match reference lighting precisely: ${lightBlock}`,
    texture: `PRODUCT SURFACES: ${craftBlock} ${chainBlock} Metal and stone surfaces from product reference preserved with absolute fidelity — render every finish zone, edge treatment, and stone optical property exactly. SCENE TEXTURES: Match reference image surfaces and material quality.`,
    composition: `${compBlock} ${poseBlock} ${modelBlock} Jewelry must be the visual focal point — scene complements, never competes.`,
    style_reference: `${moodBlock} ${brandBlock} ${techBlock} AESTHETIC: ${aesthetic.name} — ${aesthetic.colorGrade}`,
  });

  return `${identityCard}

[STYLE REFERENCE TRANSFER — V2 ENHANCED ENGINE]

⚠️ PRE-PROCESSING: ACCESSORY REMOVAL ⚠️
1. REMOVE all existing jewelry from target: ${pl.bodyPart}
2. ${pl.removal}

IMAGE 1 = STYLE REFERENCE — Recreate this image's EXACT visual style:
  - Scene/environment, lighting setup, camera angle, color grading
  - Model pose (body angle, hand position, head tilt, gesture)
  - Brand aesthetic (luxury tier, visual language, mood)
  - Technical qualities (blur, negative space, contrast, color grade)

IMAGE 2+ = PRODUCT REFERENCE — Transfer this EXACT jewelry piece:
  - Every stone, prong, setting detail must be pixel-perfect
  - Metal finish zones preserved exactly
  - Stone optical properties (brilliance, fire, luster) rendered accurately

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

PRODUCT TYPE: ${productType?.toUpperCase() || 'JEWELRY'}
TARGET: ${pl.bodyPart.toUpperCase()}
PLACEMENT: ${pl.placement}

CRITICAL RULES:
- The OUTPUT must look like it belongs to the SAME PHOTOSHOOT as the style reference
- The JEWELRY must be IDENTICAL to the product reference — zero deviation
- Combine reference style + product fidelity seamlessly

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.`;
}

// ═══════════════════════════════════════════════════
// PROMPT ENHANCER (V2 adapted)
// ═══════════════════════════════════════════════════

async function enhanceScenePromptV2(
  templatePrompt: string, analysisResult: any, sceneType: string,
): Promise<string> {
  try {
    const prompt = `You are a world-class luxury jewelry photography art director. Enhance this V2 6-block structured prompt.

RULES:
- Keep ALL product identity, fidelity constraints, and 6-block structure EXACTLY
- NEVER modify product description, stone counts, prong counts, metal details
- ONLY enhance: scene vividness, lighting nuances, mood depth, creative details
- Add specific sensory details that make the scene cinematic and real
- Add lighting nuances based on the jewelry's metal type and stone characteristics
- Keep output as enhanced prompt text — same format, richer and more detailed
- Output ONLY as JSON: {"enhanced_prompt": "..."}
- Keep under 2000 words

Scene type: ${sceneType}
Jewelry: ${analysisResult.type || 'jewelry'}, Metal: ${analysisResult.metal?.type || 'unknown'} ${analysisResult.metal?.finish || ''}, Stones: ${JSON.stringify(analysisResult.stones?.map((s: any) => `${s.count}x ${s.type} ${s.cut}`) || ['none'])}

Original prompt:
${templatePrompt}`;

    const text = await callGeminiAnalysis({ prompt, temperature: 0.4, maxTokens: 3000 });
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    const enhanced = parsed.enhanced_prompt || parsed.prompt || text;
    if (typeof enhanced === 'string' && enhanced.length > 100) {
      console.log(`V2 enhanced ${sceneType} prompt (${enhanced.length} chars)`);
      return enhanced;
    }
    return templatePrompt;
  } catch (err: any) {
    console.error(`V2 prompt enhancement failed for ${sceneType}:`, err?.message || err);
    return templatePrompt;
  }
}

// ═══════════════════════════════════════════════════
// PROCESS GENERATION (V2 adapted)
// ═══════════════════════════════════════════════════

async function processGeneration(params: {
  userId: string; imageRecordId: string; jobId: string;
  imagePaths: string[]; validAdditionalPaths: string[];
  sceneId: string | null; packageType: string; productType: string | null;
  metalColorOverride: string | null; styleReferencePath: string | null;
  aspectRatio: string; creditsNeeded: number; isAdminUser: boolean;
  selectedScenes?: string[]; customPrompt?: string;
  // V2 params
  aesthetic?: string; lens?: string; cameraAngle?: string; lighting?: string;
}) {
  const {
    userId, imageRecordId, jobId, imagePaths, validAdditionalPaths,
    sceneId, packageType, productType,
    metalColorOverride, styleReferencePath, aspectRatio, creditsNeeded, isAdminUser,
    selectedScenes: paramSelectedScenes, customPrompt: paramCustomPrompt,
    aesthetic: userAesthetic, lens: userLens, cameraAngle: userAngle, lighting: userLighting,
  } = params;

  console.log(`V2 ENGINE — Analysis=${ANALYSIS_MODEL}, Generation=${IMAGE_GEN_MODEL} (4K), Package=${packageType}`);

  const isRetouchPackage = packageType === 'retouch';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Select aesthetic for this generation
  const aesthetic = selectAesthetic(userAesthetic);
  console.log(`V2 Aesthetic: ${aesthetic.name} (${aesthetic.key})`);

  try {
    await query('UPDATE processing_jobs SET status = $1, current_step = $2, progress = $3 WHERE id = $4', ['generating', 'downloading', 2, jobId]);

    // Get internal URLs for all images (server-side fetch)
    const allImagePaths = [imagePaths[0], ...validAdditionalPaths];
    const imageUrls: string[] = [];
    for (const path of allImagePaths) {
      imageUrls.push(getInternalUrl('jewelry-images', path));
    }
    if (imageUrls.length === 0) throw new Error('Failed to access images');

    await query('UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3', [5, 'downloading', jobId]);

    // Style reference
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    let styleReferenceBase64: string | null = null;
    if (hasStyleReference) {
      try {
        const styleUrl = getInternalUrl('jewelry-images', styleReferencePath!);
        const styleResponse = await fetch(styleUrl);
        const styleBuffer = await styleResponse.arrayBuffer();
        if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
          styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
        }
      } catch (err) { console.error('Failed to fetch style reference:', err); }
    }

    let styleAnalysis: StyleReferenceAnalysis | null = null;
    if (styleReferenceBase64) {
      await query('UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3', ['analyzing_style', 12, jobId]);
      styleAnalysis = await analyzeStyleReference(styleReferenceBase64);
    }

    // Scene from DB
    let scene: any = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
      scene = await queryOne('SELECT * FROM scenes WHERE id = $1', [sceneId]);
    }

    // Fetch images to base64
    await query('UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3', ['analyzing', 10, jobId]);
    const base64Images: string[] = [];
    let lastFetchError: string | null = null;
    for (const url of imageUrls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          lastFetchError = `Image download failed: HTTP ${resp.status}`;
          console.warn(lastFetchError);
          continue;
        }
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_SIZE) {
          lastFetchError = `Image too large: ${(buf.byteLength / (1024 * 1024)).toFixed(2)}MB (max 1.5MB)`;
          console.warn(lastFetchError);
          continue;
        }
        base64Images.push(arrayBufferToBase64(buf));
      } catch (err: any) {
        lastFetchError = `Image fetch error: ${err?.message || 'network error'}`;
        console.warn(lastFetchError);
      }
    }
    if (base64Images.length === 0) throw new Error(lastFetchError || 'No images could be loaded');
    const base64Image = base64Images[0];

    // ── ANALYZE JEWELRY ──
    console.log('V2 Step 1: Analyzing jewelry...');
    await query('UPDATE processing_jobs SET progress = $1 WHERE id = $2', [15, jobId]);

    const analysisPrompt = `You are a master gemologist and bench jeweler. Examine this jewelry piece with extreme precision — focus on stone optical properties (brilliance, fire, luster), setting craftsmanship quality, and construction details that define the piece's character.

Return JSON:
{
  "type": "ring|necklace|bracelet|earring|pendant|brooch|watch|choker|piercing",
  "metal": { "type": "gold|silver|platinum|rose_gold|white_gold|mixed", "karat": "24k|22k|18k|14k|10k|sterling|unknown", "finish": "polished|matte|brushed|hammered|textured|satin", "color_hex": "#hex" },
  "stones": [{ "type": "diamond|ruby|emerald|sapphire|pearl|other", "count": 0, "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette", "color": "", "setting": "prong|bezel|channel|pave|tension|cluster|halo", "position": "center|side|halo|band|accent", "relative_size": "dominant|medium|small|tiny" }],
  "structure": { "center_stone_count": 0, "accent_stone_count": 0, "total_prong_count": 0, "prong_style": "classic_4|classic_6|shared|cathedral|basket|tension", "band_width_mm": 0, "band_profile": "flat|domed|knife_edge|comfort_fit", "shank_design": "plain|split|tapered|twisted|pave_set", "gallery_detail": "open|closed|basket|cathedral" },
  "proportions": { "length_to_width_ratio": 1.0, "stone_to_metal_ratio": "stone_dominant|balanced|metal_dominant", "overall_profile": "low_set|medium_set|high_set", "symmetry_grade": "excellent|very_good|good|fair" },
  "surface_details": { "engravings": false, "engraving_description": "", "milgrain": false, "filigree": false, "texture_zones": "", "hallmarks_visible": false },
  "watch_details": { "dial_color": "", "dial_finish": "", "complications": [], "case_shape": "", "strap_type": "", "bezel_style": "", "crystal_type": "" },
  "design_elements": { "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian|sports|dress", "patterns": [], "symmetry": "symmetric|asymmetric", "complexity": "simple|moderate|intricate" },
  "unique_identifiers": "",
  "visual_fingerprint": "5-7 DETAILED sentences as VERBAL PHOTOGRAPH",
  "visual_dna": { "silhouette_descriptor": "", "dominant_visual_axis": "", "light_signature": "", "color_relationship_map": "", "scale_anchor": "", "distinguishing_asymmetries": "", "optical_weight_center": "" },
  "craftsmanship": { "setting_technique_detail": "detailed description of setting technique quality (pave precision, bezel forming, prong tip finish)", "finish_zones": [{"zone": "band|gallery|bezel|prong_tips|clasp", "finish": "mirror_polish|satin|matte|brushed|hammered|sandblasted"}], "edge_treatment": "knife_edge|beveled|rounded|raw|milgrain_edge", "quality_grade": "haute_joaillerie|fine_jewelry|fashion_jewelry|artisan" },
  "stone_optics": { "brilliance_pattern": "describe how light reflects internally and externally — arrows pattern, hearts pattern, or diffused", "fire_dispersion": "none|subtle|moderate|exceptional — rainbow spectral flashes", "transparency_level": "transparent|translucent|opaque", "surface_luster": "adamantine|vitreous|waxy|pearly|silky|metallic" },
  "chain_clasp": { "chain_style": "cable|curb|rope|box|snake|figaro|wheat|singapore|none", "chain_thickness": "delicate|medium|chunky|none", "clasp_type": "lobster|spring_ring|toggle|magnetic|hook|box|barrel|none", "clasp_visibility": "hidden|subtle|decorative|none" }
}

CRITICAL: Count EVERY stone precisely. "visual_fingerprint" = 5-7 sentences. "visual_dna" = reconstruction blueprint. Examine stone optical behavior under light — brilliance, fire, scintillation. Assess craftsmanship quality — setting precision, finish consistency, edge work.
ONLY valid JSON.`;

    let analysisResult: any = { type: 'jewelry', design_elements: { style: 'classic' } };
    try {
      const analysisContent = await callGeminiAnalysis({ prompt: analysisPrompt, imageBase64s: base64Images });
      analysisResult = JSON.parse(analysisContent.replace(/```json\n?|\n?```/g, '').trim());
    } catch (err: any) {
      console.error('V2 Jewelry analysis failed:', err?.message || err);
      await query('UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5', ['failed', `Analiz hatası: ${err?.message?.substring(0, 200) || 'parse error'}`, 100, 'failed', jobId]);
      await query('UPDATE images SET status = $1, error_message = $2 WHERE id = $3', ['failed', `Analiz hatası: ${err?.message?.substring(0, 200) || 'parse error'}`, imageRecordId]);
      if (!isAdminUser) {
        try { await queryOne('SELECT refund_credits($1, $2) as result', [userId, creditsNeeded]); } catch {}
      }
      throw new Error(`Jewelry analysis failed: ${err?.message || 'parse error'}`);
    }

    console.log('V2 Analysis result:', JSON.stringify(analysisResult, null, 2));
    await query('UPDATE images SET status = $1, analysis_data = $2 WHERE id = $3', ['generating', JSON.stringify(analysisResult), imageRecordId]);
    await query('UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3', ['generating', 25, jobId]);

    // ── BUILD FIDELITY BLOCK ──
    const metalColorOverrideMap: Record<string, { type: string; category: string }> = {
      'yellow_gold': { type: 'gold', category: 'YELLOW GOLD' },
      'white_gold': { type: 'white_gold', category: 'WHITE GOLD' },
      'rose_gold': { type: 'rose_gold', category: 'ROSE GOLD' },
      'platinum': { type: 'platinum', category: 'PLATINUM' },
      'silver': { type: 'silver', category: 'SILVER' },
    };

    const userMetalOverride = metalColorOverride ? metalColorOverrideMap[metalColorOverride] : null;
    const metalType = userMetalOverride?.type || analysisResult.metal?.type || 'gold';
    const metalFinish = analysisResult.metal?.finish || 'polished';
    const metalKarat = analysisResult.metal?.karat || '18k';
    const metalColorHex = analysisResult.metal?.color_hex || '';

    let metalColorCategory = userMetalOverride?.category || 'YELLOW GOLD';
    if (!userMetalOverride) {
      if (metalType === 'white_gold' || metalType === 'platinum' || metalType === 'silver') metalColorCategory = 'WHITE/SILVER METAL';
      else if (metalType === 'rose_gold') metalColorCategory = 'ROSE GOLD';
      else if (metalType === 'gold') metalColorCategory = 'YELLOW GOLD';
    }

    const metalDesc = `${metalFinish} ${metalType.replace('_', ' ')} (${metalKarat})`;
    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) => `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`).join(', ')
      : '';
    const stoneDetailBlock = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any, i: number) => `Stone ${i + 1}: ${s.count || 1}x ${s.color || ''} ${s.type || 'gemstone'}, ${s.cut || 'round'} cut, ${s.setting || 'prong'} setting, position: ${s.position || 'center'}, size: ${s.relative_size || 'medium'}`).join('\n  ')
      : 'No gemstones';
    const structureBlock = analysisResult.structure ? `
STRUCTURAL IDENTITY:
- Center stones: ${analysisResult.structure.center_stone_count ?? 'unknown'}
- Accent stones: ${analysisResult.structure.accent_stone_count ?? 0}
- Total prongs: ${analysisResult.structure.total_prong_count ?? 'standard'}
- Prong style: ${analysisResult.structure.prong_style ?? 'classic'}
- Band: ${analysisResult.structure.band_width_mm ?? '?'}mm ${analysisResult.structure.band_profile ?? 'standard'}
- Shank: ${analysisResult.structure.shank_design ?? 'plain'}
- Gallery: ${analysisResult.structure.gallery_detail ?? 'standard'}` : '';
    const proportionsBlock = analysisResult.proportions ? `
PROPORTIONS:
- L:W ratio: ${analysisResult.proportions.length_to_width_ratio ?? '1.0'}
- Stone/Metal: ${analysisResult.proportions.stone_to_metal_ratio ?? 'balanced'}
- Profile: ${analysisResult.proportions.overall_profile ?? 'medium_set'}
- Symmetry: ${analysisResult.proportions.symmetry_grade ?? 'good'}` : '';
    const surfaceBlock = analysisResult.surface_details ? [
      '\nSURFACE DETAILS:',
      analysisResult.surface_details.milgrain ? '- Milgrain edge detail PRESENT' : '',
      analysisResult.surface_details.filigree ? '- Filigree work PRESENT' : '',
      analysisResult.surface_details.engravings ? `- Engraving: ${analysisResult.surface_details.engraving_description}` : '',
      analysisResult.surface_details.texture_zones ? `- Texture: ${analysisResult.surface_details.texture_zones}` : '',
    ].filter(Boolean).join('\n') : '';
    const fingerprintBlock = analysisResult.visual_fingerprint
      ? `\nVISUAL FINGERPRINT:\n${analysisResult.visual_fingerprint}` : '';
    const userOverrideNote = metalColorOverride
      ? `\n⚠️ USER METAL COLOR: ${metalColorCategory} — ABSOLUTE PRIORITY ⚠️\n` : '';

    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === 'watch' ? `
WATCH SPECS:
- Dial: ${watchDetails.dial_color || 'classic'} ${watchDetails.dial_finish || ''} finish
- Case: ${watchDetails.case_shape || 'round'}, Bezel: ${watchDetails.bezel_style || 'smooth'}
- Strap: ${watchDetails.strap_type || 'metal_bracelet'}, Crystal: ${watchDetails.crystal_type || 'sapphire'}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(', ')}` : ''}` : '';

    const productExtractionBlock = `
═══════════════════════════════════════════════════════════════
PRODUCT EXTRACTION MODE
═══════════════════════════════════════════════════════════════
Extract ONLY the jewelry from reference image(s).
IGNORE: hands, skin, background, reflections, shadows, environment.
Reconstruct as STANDALONE OBJECT, then place into scene.
═══════════════════════════════════════════════════════════════`.trim();

    const fidelityBlock = `
JEWELRY SPECS (PRESERVE EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}, Category: ${metalColorCategory}
${metalColorHex ? `- Hex: ${metalColorHex}` : ''}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique: ${analysisResult.unique_identifiers}` : ''}
${watchDesc}${userOverrideNote}

STONE MAP:
  ${stoneDetailBlock}
${structureBlock}${proportionsBlock}${surfaceBlock}${fingerprintBlock}

⚠️ METAL COLOR: ${metalColorCategory} — MUST PRESERVE ⚠️
YELLOW GOLD → YELLOW GOLD | WHITE GOLD/PLATINUM/SILVER → WHITE/SILVER | ROSE GOLD → ROSE GOLD

FIDELITY: EXACT metal color, EXACT stone count, EXACT setting, EXACT proportions, EXACT surface finish.
DIAMOND REALISM: fire, brilliance, scintillation, natural inclusions, depth.
ANTI-HALLUCINATION: No stone additions/removals, no prong changes, no silhouette changes, no invention, no simplification.
FORBIDDEN: ❌ Metal color change ❌ Text/watermarks ❌ Design alterations ❌ Additional jewelry ❌ CGI gemstones`.trim();

    // Brand DNA
    let brandDnaBlock = '';
    try {
      const brandProfile = await queryOne<{ brand_dna_prompt: string; is_active: boolean }>(
        'SELECT brand_dna_prompt, is_active FROM brand_profiles WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]
      );
      if (brandProfile?.brand_dna_prompt) {
        brandDnaBlock = `\n\n${brandProfile.brand_dna_prompt}\n`;
        console.log('V2 Brand DNA applied');
      }
    } catch { /* no brand profile */ }

    const fidelityBlockWithBrand = brandDnaBlock ? `${fidelityBlock}\n${brandDnaBlock}` : fidelityBlock;

    const generatedUrls: string[] = [];

    // ── GENERATION LOGIC ──

    if (isRetouchPackage) {
      console.log('V2 Retouch Package...');
      const retouchPrompt = `
PROFESSIONAL JEWELRY RETOUCHING — 8-STEP MASTER WORKFLOW (V2)

ABSOLUTE PRODUCT INTEGRITY — Do NOT change geometry, proportions, stones, metal structure.

STEP 1 — DUST & DEFECT REMOVAL: Remove dust, fingerprints, scratches, lint.
STEP 2 — FREQUENCY SEPARATION: Preserve real metal grain. NO plastic look.
STEP 3 — BACKGROUND ISOLATION: Pure white (255,255,255). Sub-pixel edge accuracy.
STEP 4 — COLOR CORRECTION: D65 (6500K). Metal accuracy. Stone color true-to-life.
STEP 5 — METAL SURFACE: Remove handling marks. Enhance specular highlights naturally.
STEP 6 — GEMSTONE: Increase facet definition, brilliance, fire. NO artificial sparkle.
STEP 7 — SHADOW & DIMENSION: Subtle ground shadow (10-15% opacity). Dodge & burn.
STEP 8 — SHARPENING: Selective high-pass on edges. Avoid noise on smooth surfaces.

OUTPUT: Commercially clean, catalog-ready image on pure white. Ultra high resolution.`.trim();

      await query('UPDATE processing_jobs SET progress = $1 WHERE id = $2', [28, jobId]);
      const retouchUrl = await generateSingleImage(base64Images, retouchPrompt, userId, imageRecordId, 0, null, jobId, aspectRatio);
      if (retouchUrl) generatedUrls.push(retouchUrl);
      await query('UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3', [generatedUrls.length, 90, jobId]);

    } else if (packageType === 'single') {
      console.log('V2 Single Package...');
      const identityCard = buildProductIdentityCard(analysisResult);
      let singlePrompt: string;
      let singleImages: string[];

      if (hasStyleReference && styleReferenceBase64) {
        singlePrompt = buildStyleTransferPromptV2(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic, analysisResult);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, 'style_transfer');
        singleImages = [styleReferenceBase64, ...base64Images];
      } else if (paramCustomPrompt) {
        singlePrompt = buildCustomPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard, paramCustomPrompt, aesthetic);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, 'custom');
        singleImages = base64Images;
      } else {
        singlePrompt = buildEditorialPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic, userLens, userAngle, userLighting);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, 'editorial');
        singleImages = base64Images;
      }

      await query('UPDATE processing_jobs SET progress = $1, current_step = $2, total_images = $3 WHERE id = $4', [28, 'generating', 1, jobId]);
      const url = await generateSingleImage(singleImages, singlePrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query('UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3', [generatedUrls.length, 90, jobId]);

    } else if (hasStyleReference && styleReferenceBase64 && packageType !== 'standard') {
      console.log('V2 Standalone style reference...');
      const identityCard = buildProductIdentityCard(analysisResult);
      let styleTransferPrompt = buildStyleTransferPromptV2(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic, analysisResult);
      styleTransferPrompt = await enhanceScenePromptV2(styleTransferPrompt, analysisResult, 'style_transfer');

      await query('UPDATE processing_jobs SET progress = $1 WHERE id = $2', [28, jobId]);
      const url = await generateSingleImage([styleReferenceBase64, ...base64Images], styleTransferPrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query('UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3', [generatedUrls.length, 90, jobId]);

    } else {
      // MASTER PAKET
      const resolvedProductType = productType || (() => {
        const t = analysisResult?.type?.toLowerCase() || '';
        const map: Record<string, string> = {
          ring: 'yuzuk', necklace: 'kolye', bracelet: 'bileklik',
          earring: 'kupe', pendant: 'kolye', watch: 'saat',
          choker: 'kolye', brooch: 'genel', piercing: 'kupe',
        };
        return map[t] || 'genel';
      })();

      console.log(`V2 Master Paket — Product: ${resolvedProductType}, Aesthetic: ${aesthetic.name}`);

      const buildIdentityCardForStep = (i: number, total: number) => buildProductIdentityCard(analysisResult, i + 1, total);

      const masterSteps = [
        { key: 'editorial', step: 'generating_editorial', label: 'Editorial',
          buildPrompt: (ic: string) => {
            if (hasStyleReference && styleReferenceBase64) return buildStyleTransferPromptV2(styleAnalysis, resolvedProductType, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic, analysisResult);
            return buildEditorialPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic, userLens, userAngle, userLighting);
          },
          getImages: () => hasStyleReference && styleReferenceBase64 ? [styleReferenceBase64, ...base64Images] : base64Images,
          startTemperature: 0.12,
        },
        { key: 'ecommerce', step: 'generating_ecommerce', label: 'E-Commerce',
          buildPrompt: (ic: string) => buildEcommercePromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, userLens, userAngle),
          startTemperature: 0.10,
        },
        { key: 'model', step: 'generating_model', label: 'Model',
          buildPrompt: (ic: string) => buildModelPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLens, userAngle, userLighting),
          startTemperature: 0.12,
        },
        { key: 'macro', step: 'generating_macro', label: 'Macro Detail',
          buildPrompt: (ic: string) => buildMacroPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic, userLighting),
          startTemperature: 0.12,
        },
        { key: 'model_closeup', step: 'generating_model_closeup', label: 'Model Close-Up',
          buildPrompt: (ic: string) => buildModelCloseUpPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLighting),
          startTemperature: 0.12,
        },
        { key: 'model_lifestyle', step: 'generating_model_lifestyle', label: 'Model Lifestyle',
          buildPrompt: (ic: string) => buildModelLifestylePromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLens, userLighting),
          startTemperature: 0.12,
        },
      ];

      const filteredSteps = paramSelectedScenes && paramSelectedScenes.length > 0
        ? masterSteps.filter(s => paramSelectedScenes.includes(s.key))
        : masterSteps;

      console.log(`V2 Generating ${filteredSteps.length} scenes: ${filteredSteps.map(s => s.key).join(', ')}`);

      await query('UPDATE processing_jobs SET total_images = $1 WHERE id = $2', [filteredSteps.length, jobId]);

      for (let i = 0; i < filteredSteps.length; i++) {
        const ms = filteredSteps[i];
        console.log(`V2 Generating ${ms.label} (${i + 1}/${filteredSteps.length})...`);

        const perStep = 65 / filteredSteps.length;
        const startProgress = Math.round(25 + (i * perStep));
        const endProgress = Math.round(25 + ((i + 1) * perStep));

        await query('UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3', [startProgress, ms.step, jobId]);

        const stepIdentityCard = buildIdentityCardForStep(i, filteredSteps.length);
        const basePrompt = ms.buildPrompt(stepIdentityCard);
        const prompt = await enhanceScenePromptV2(basePrompt, analysisResult, ms.key);
        const images = (ms as any).getImages ? (ms as any).getImages() : base64Images;
        const temperature = ms.startTemperature ?? 0.12;
        const url = await generateSingleImage(images, prompt, userId, imageRecordId, i + 1, null, jobId, aspectRatio, temperature);

        if (url) generatedUrls.push(url);

        await query('UPDATE processing_jobs SET completed_images = $1, current_step = $2, progress = $3 WHERE id = $4', [generatedUrls.length, i < filteredSteps.length - 1 ? filteredSteps[i + 1].step : 'saving', endProgress, jobId]);
      }
    }

    // ── FINALIZE ──
    await query('UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3', [90, 'saving', jobId]);

    if (generatedUrls.length === 0) {
      if (!isAdminUser) {
        try {
          await queryOne('SELECT refund_credits($1, $2) as result', [userId, creditsNeeded]);
          console.log(`Credits refunded: ${creditsNeeded}`);
        } catch {}
      }
      await query('UPDATE images SET status = $1, error_message = $2 WHERE id = $3', ['failed', 'Görsel oluşturulamadı', imageRecordId]);
      await query('UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5', ['failed', 'Görsel oluşturulamadı', 100, 'failed', jobId]);
      return;
    }

    // images.generated_image_urls is text[] — pass JS array directly (pg driver serialises it)
    // processing_jobs.result_urls is jsonb — must pass a JSON string
    await query('UPDATE images SET status = $1, generated_image_urls = $2 WHERE id = $3', ['completed', generatedUrls, imageRecordId]);
    await query('UPDATE processing_jobs SET status = $1, progress = $2, current_step = $3, result_urls = $4::jsonb, completed_images = $5 WHERE id = $6', ['completed', 100, 'completed', JSON.stringify(generatedUrls), generatedUrls.length, jobId]);

    console.log('V2 Generation complete:', generatedUrls.length, 'images');

  } catch (error) {
    console.error('V2 Processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (!isAdminUser) {
      try { await queryOne('SELECT refund_credits($1, $2) as result', [userId, creditsNeeded]); } catch {}
    }
    await query('UPDATE images SET status = $1, error_message = $2 WHERE id = $3', ['failed', errorMessage, imageRecordId]);
    await query('UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5', ['failed', errorMessage, 100, 'failed', jobId]);
  }
}

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId = '';
  let creditsNeeded = 0;
  let creditsDeducted = false;

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) return sendCorsResponse(res, authResult.status, { error: authResult.error });
    userId = authResult.userId;
    console.log('V2 Authenticated user:', userId);

    const {
      imagePath, additionalImagePaths, sceneId, packageType, productType,
      metalColorOverride, styleReferencePath,
      aspectRatio: requestedRatio, selectedScenes, customPrompt,
      // V2 params
      aesthetic, lens, cameraAngle, lighting,
    } = req.body;

    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const aspectRatio = validRatios.includes(requestedRatio) ? requestedRatio : '3:4';

    console.log('V2 Generate request:', {
      imagePath, sceneId, packageType, productType, aspectRatio, userId,
      selectedScenes, aesthetic, lens, cameraAngle, lighting,
      customPrompt: customPrompt?.substring(0, 50),
    });

    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return sendCorsResponse(res, 400, { error: 'Invalid image path' });
    }

    const validAdditionalPaths: string[] = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === 'string' && path.startsWith(`${userId}/originals/`)) validAdditionalPaths.push(path);
      }
    }

    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRetouchPackage = packageType === 'retouch';
    const isStandardPackage = packageType === 'standard' || !packageType;
    const isSinglePackage = packageType === 'single';
    if (!hasStyleReference && !isRetouchPackage && !isStandardPackage && !isSinglePackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return sendCorsResponse(res, 400, { error: 'Invalid scene ID' });
    }

    // Validate V2 params
    const validAesthetics = AESTHETIC_STYLES.map(a => a.key);
    const validLenses = LENS_OPTIONS.map(l => l.key);
    const validAngles = CAMERA_ANGLES.map(a => a.key);
    const validLights = LIGHTING_SETUPS.map(l => l.key);

    const validatedAesthetic = validAesthetics.includes(aesthetic) ? aesthetic : undefined;
    const validatedLens = validLenses.includes(lens) ? lens : undefined;
    const validatedAngle = validAngles.includes(cameraAngle) ? cameraAngle : undefined;
    const validatedLighting = validLights.includes(lighting) ? lighting : undefined;

    const validSceneKeys = ['editorial', 'ecommerce', 'model', 'macro', 'model_closeup', 'model_lifestyle'];
    let validatedSelectedScenes: string[] | undefined;
    if (Array.isArray(selectedScenes) && selectedScenes.length > 0) {
      validatedSelectedScenes = selectedScenes.filter((s: string) => validSceneKeys.includes(s));
      if (validatedSelectedScenes.length === 0) validatedSelectedScenes = undefined;
    }

    const validatedCustomPrompt = isSinglePackage && typeof customPrompt === 'string' ? customPrompt.trim().substring(0, 500) : undefined;

    // Auto-clean stuck jobs (15 min — Pro model can take up to 4min per image × 3 scenes)
    const stuckResult = await query<{id: string, image_record_id: string}>(
      'SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[]) AND updated_at < $3',
      [userId, ['pending', 'generating'], new Date(Date.now() - 15 * 60 * 1000).toISOString()]
    );
    const stuckJobs = stuckResult.rows;
    if (stuckJobs && stuckJobs.length > 0) {
      await query('UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])', ['failed', 'Auto-cleaned: stuck job', stuckJobs.map(j => j.id)]);
      const stuckImageIds = stuckJobs.map(j => j.image_record_id).filter(Boolean);
      if (stuckImageIds.length > 0) await query('UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])', ['failed', 'Auto-cleaned: timeout', stuckImageIds]);
    }

    // Cancel previous active jobs
    const activeResult = await query<{id: string, image_record_id: string}>(
      'SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[])',
      [userId, ['pending', 'generating']]
    );
    const activeJobsList = activeResult.rows;
    if (activeJobsList && activeJobsList.length > 0) {
      await query('UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])', ['cancelled', 'Yeni üretim başlatıldı', activeJobsList.map(j => j.id)]);
      const activeImageIds = activeJobsList.map(j => j.image_record_id).filter(Boolean);
      if (activeImageIds.length > 0) await query('UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])', ['failed', 'Yeni üretim başlatıldı', activeImageIds]);
    }

    // Admin check
    const adminRow = await queryOne<{ result: boolean }>('SELECT has_role($1, $2) as result', [userId, 'admin']);
    const isAdminUser = adminRow?.result === true;
    creditsNeeded = 10;

    if (!isAdminUser) {
      const deductRow = await queryOne<{ result: any }>('SELECT deduct_credits($1, $2) as result', [userId, creditsNeeded]);
      const deductResult = deductRow?.result;
      if (!deductRow) return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu.' });
      if (!deductResult?.success) return sendCorsResponse(res, 402, { error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` });
      console.log(`V2 Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
      creditsDeducted = true;
    }

    // Create records
    const imageRecord = await queryOne(
      'INSERT INTO images (user_id, scene_id, original_image_url, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, sceneId || null, imagePath, 'analyzing']
    );
    if (!imageRecord) throw new Error('Failed to create image record');

    const totalImages = isSinglePackage || isRetouchPackage ? 1 : (validatedSelectedScenes && validatedSelectedScenes.length > 0) ? validatedSelectedScenes.length : 6;

    const jobRecord = await queryOne(
      'INSERT INTO processing_jobs (user_id, image_record_id, status, total_images, completed_images, progress, current_step, credits_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, imageRecord.id, 'pending', totalImages, 0, 0, 'pending', isAdminUser ? 0 : creditsNeeded]
    );
    if (!jobRecord) throw new Error('Failed to create processing job');

    console.log(`V2 Job: ${jobRecord.id}, Image: ${imageRecord.id}`);

    // Fire-and-forget
    processGeneration({
      userId, imageRecordId: imageRecord.id, jobId: jobRecord.id,
      imagePaths: [imagePath, ...validAdditionalPaths], validAdditionalPaths,
      sceneId: sceneId || null, packageType: packageType || 'standard',
      productType: productType || null, metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null, aspectRatio,
      creditsNeeded, isAdminUser,
      selectedScenes: validatedSelectedScenes, customPrompt: validatedCustomPrompt,
      aesthetic: validatedAesthetic, lens: validatedLens,
      cameraAngle: validatedAngle, lighting: validatedLighting,
    }).catch(async (err) => {
      console.error('V2 Background generation error:', err);
      try {
        const errorMsg = err instanceof Error ? err.message : 'Background generation failed';
        await query('UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5', ['failed', errorMsg, 100, 'failed', jobRecord.id]);
        await query('UPDATE images SET status = $1, error_message = $2 WHERE id = $3', ['failed', errorMsg, imageRecord.id]);
        if (!isAdminUser) {
          try { await queryOne('SELECT refund_credits($1, $2) as result', [userId, creditsNeeded]); } catch {}
        }
      } catch (cleanupErr) {
        console.error('V2 Failed to cleanup after background error:', cleanupErr);
      }
    });

    return sendCorsResponse(res, 200, {
      success: true,
      jobId: jobRecord.id,
      imageId: imageRecord.id,
      status: 'pending',
      engine: 'v2',
    });

  } catch (error) {
    console.error('V2 Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (creditsDeducted) {
      try {
        await queryOne('SELECT refund_credits($1, $2) as result', [userId, creditsNeeded]);
      } catch (refundErr) {
        console.error('CRITICAL: Failed to refund credits:', refundErr);
      }
    }
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}
