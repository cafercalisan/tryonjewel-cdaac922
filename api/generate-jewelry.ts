import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';

export const config = {
  maxDuration: 300,
};

const GOOGLE_ANALYSIS_API_KEY = process.env.GOOGLE_ANALYSIS_API_KEY;
const GOOGLE_IMAGE_API_KEY = process.env.GOOGLE_API_KEY;

const ANALYSIS_MODEL = 'models/gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

// ═══════════════════════════════════════════════════
// EDITORIAL SCENE POOL (~25 scenes)
// ═══════════════════════════════════════════════════
const EDITORIAL_SCENE_POOL = [
  // Fabric
  { name: 'Black Velvet', prompt: 'Placed on rich black velvet fabric with deep texture folds, creating luxurious depth. Soft overhead lighting reveals velvet fiber texture. Dark, moody atmosphere with subtle warm highlights on the jewelry.' },
  { name: 'Champagne Silk', prompt: 'Resting on flowing champagne silk fabric with elegant draping and soft luminous sheen. Gentle side lighting creates silky highlights and delicate shadows. Warm, romantic atmosphere.' },
  { name: 'Burgundy Velvet', prompt: 'Displayed on deep burgundy velvet with rich wine-colored tones. Dramatic directional lighting creates contrast between velvet pile and jewelry brilliance. Opulent, regal mood.' },
  { name: 'Ivory Satin', prompt: 'Placed on smooth ivory satin fabric with subtle pearl-like sheen. Even soft lighting enhances the pristine, bridal quality. Clean elegance with warm undertones.' },
  { name: 'Dark Leather', prompt: 'Resting on premium dark leather surface with visible grain texture. Warm amber side lighting creates masculine, sophisticated atmosphere. Raw luxury aesthetic.' },
  // Stone surfaces
  { name: 'White Carrara Marble', prompt: 'Placed on polished white Carrara marble surface with subtle grey veining. Clean overhead lighting with soft reflections on marble. Bright, airy, gallery-like presentation.' },
  { name: 'Black Marble Gold Veins', prompt: 'Displayed on polished black marble with dramatic gold veining. Targeted spotlight creates striking contrast. Ultra-premium, exclusive atmosphere.' },
  { name: 'Travertine', prompt: 'Resting on warm travertine stone surface with natural pits and warm cream tones. Soft golden hour lighting creates organic warmth. Mediterranean luxury feel.' },
  { name: 'Dark Granite', prompt: 'Placed on polished dark granite surface with subtle crystalline sparkle. Cool-toned lighting with sharp reflections. Modern, architectural luxury.' },
  // Natural elements
  { name: 'Rose Petals Dew', prompt: 'Nestled among fresh rose petals with morning dew droplets catching light. Soft diffused natural lighting. Romantic, delicate, and feminine atmosphere with organic beauty.' },
  { name: 'Wet River Stones', prompt: 'Placed on smooth wet river stones with water droplets and subtle reflections. Cool natural lighting creating zen-like tranquility. Spa-luxury aesthetic.' },
  { name: 'Desert Sand', prompt: 'Resting on fine golden desert sand with gentle wind-sculpted ripples. Warm sunset lighting creates long dramatic shadows. Exotic, adventurous luxury mood.' },
  { name: 'Ice Crystal', prompt: 'Displayed on crystalline ice surface with frost patterns and cool blue refractions. Crisp cold lighting with prismatic highlights. Ethereal, winter wonderland luxury.' },
  { name: 'Autumn Leaves', prompt: 'Placed among dried autumn leaves in warm amber, rust, and gold tones. Soft dappled golden light filtering through. Cozy seasonal warmth with organic texture.' },
  { name: 'Seashell Sand', prompt: 'Resting on fine white sand with delicate seashells and coral fragments. Bright natural coastal lighting. Beach luxury, vacation elegance aesthetic.' },
  // Artificial surfaces
  { name: 'Brushed Concrete', prompt: 'Placed on smooth brushed concrete surface with subtle industrial texture. Cool directional lighting with architectural shadows. Modern minimalist luxury, urban sophistication.' },
  { name: 'Reflective Black Glass', prompt: 'Displayed on polished black glass surface creating mirror-like reflections of the jewelry. Dramatic rim lighting. Ultra-modern, sleek, high-tech luxury presentation.' },
  { name: 'Aged Bronze', prompt: 'Resting on aged bronze surface with beautiful green-blue patina. Warm side lighting reveals metallic texture contrasts. Heritage luxury, timeless craftsmanship feel.' },
  { name: 'Kintsugi Ceramic', prompt: 'Placed on a white ceramic surface with golden kintsugi repair lines. Soft warm lighting emphasizes gold-filled cracks. Japanese-inspired luxury, wabi-sabi beauty.' },
  { name: 'Dark Walnut Wood', prompt: 'Displayed on rich dark walnut wood surface with visible grain patterns. Warm ambient lighting creates cozy atmosphere. Classic, refined luxury with natural warmth.' },
  // Artistic
  { name: 'Water Surface Ripples', prompt: 'Floating on a still water surface with gentle concentric ripples. Overhead lighting creates sparkling water reflections on the jewelry. Dreamy, ethereal, meditative luxury.' },
  { name: 'Smoke', prompt: 'Suspended in wispy smoke tendrils with dramatic backlighting. Dark background with atmospheric haze. Mysterious, avant-garde, fashion-forward presentation.' },
  { name: 'Dried Botanicals', prompt: 'Arranged among dried botanical elements: lavender sprigs, eucalyptus leaves, dried flowers. Soft natural overhead lighting. Artisanal, organic luxury aesthetic.' },
  { name: 'Liquid Gold Drops', prompt: 'Placed near artful drops of liquid gold on a dark matte surface. Warm spotlight creates molten metallic reflections. Opulent, artistic, haute-couture presentation.' },
  { name: 'Crystal Cluster', prompt: 'Nestled among natural clear quartz crystal clusters with prismatic light refractions. Cool ethereal lighting with rainbow highlights. Mystical, high-fashion editorial aesthetic.' },
];

const LIGHTING_ANGLES = [
  'Golden hour warm directional light from upper-left (10 o\'clock), soft diffused fill',
  'Dramatic rim lighting from behind with subtle front fill, creating luminous edge glow',
  'Overhead butterfly lighting with subtle shadow beneath, classic beauty light setup',
  'Soft 45-degree key light from right with reflector fill, studio portrait style',
  'Cool-toned window light from left side, natural and editorial atmosphere',
  'Low-angle warm light creating long shadows and dramatic depth',
  'Split lighting: half illuminated, half in shadow, high-fashion editorial contrast',
  'Broad soft lighting from both sides with subtle top accent, even luxury illumination',
];

const CAMERA_PERSPECTIVES = [
  'Flat-lay, perfectly top-down 90° overhead view',
  '45-degree macro angle, shallow depth of field with creamy bokeh',
  'Eye-level straight-on view, product centered in frame',
  'Low-angle looking slightly upward, making the piece appear grand and monumental',
];

// ═══════════════════════════════════════════════════
// CHARACTER IDENTITY DNA (for Model prompt)
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
  'Warm and natural — genuine soft smile, crow\'s feet visible, approachable luxury',
  'Regal and commanding — chin slightly raised, strong posture, aristocratic bearing',
  'Dreamy and ethereal — soft focus expression, luminous skin, romantic atmosphere',
];

const CHARACTER_SKIN_TONES = [
  'Mediterranean olive with warm golden undertones — sun-kissed radiance',
  'Fair porcelain with subtle rosy undertones — luminous, translucent quality',
  'Rich warm tan with honey undertones — bronze goddess glow',
  'Light olive with neutral undertones — sophisticated, versatile canvas',
];

const CHARACTER_HAIR_STYLES = [
  'Sleek pulled-back hair with clean lines — emphasizing facial structure and jewelry',
  'Loose natural waves cascading over one shoulder — romantic, effortless',
  'Structured updo revealing neck and ears — classic editorial elegance',
  'Tousled windswept texture — editorial movement, editorial dynamism',
  'Smooth straight hair tucked behind ear on jewelry side — focused reveal',
];

// ═══════════════════════════════════════════════════
// MODEL POSE CONFIG BY PRODUCT TYPE
// ═══════════════════════════════════════════════════
const PRODUCT_TYPE_MODEL_CONFIG: Record<string, { bodyRegion: string; poses: string[] }> = {
  yuzuk: {
    bodyRegion: 'hand and fingers',
    poses: [
      'Model\'s hand gracefully touching collarbone, ring prominently visible on finger. Fingers slightly spread for clarity. Natural hand curvature, visible knuckle detail, elegant wrist angle.',
      'Hand gently framing face near jawline, ring in razor-sharp focus. Ring finger positioned at eye-level. Dreamy expression with soft eye contact. Skin texture visible on fingers.',
      'Hand running through tousled hair, ring catching a spark of light. Candid editorial moment frozen in time. Natural finger spacing shows ring from optimal angle.',
      'Both hands together near chin in contemplative pose, ring as absolute centerpiece. Interlocked fingers create elegant geometry. Ring positioned toward camera for maximum visibility.',
      'Hand resting on bare shoulder, ring visible against luminous skin. Three-quarter profile with chin slightly raised. Ring catches rim light creating a golden highlight.',
      'Hand elegantly draped over the edge of a dark surface, fingers cascading downward, ring catching dramatic side-light. Architectural hand pose, editorial precision.',
      'Model examining the ring on her own hand at close range — intimate, admiring moment. Ring is the sharp focus point. Background softly blurred.',
    ],
  },
  bileklik: {
    bodyRegion: 'wrist',
    poses: [
      'Wrist resting elegantly on a marble surface, bracelet draped naturally with golden catch-light. Relaxed confidence, fingers slightly curled. Bracelet chain follows wrist contour perfectly.',
      'Arm raised with hand in hair, bracelet sliding naturally on wrist. Gravity pulls bracelet to optimal viewing angle. Light catches each link/stone. Editorial movement frozen.',
      'Both wrists crossed casually at collarbone level, bracelet as focal point. One wrist stacked, editorial symmetry. Bracelet creates visual anchor.',
      'Hand touching neckline from below, wrist and bracelet naturally framed against décolletage. Bracelet catches warm skin-reflected light. Intimate gesture.',
      'Wrist extended gracefully forward toward camera, bracelet in sharp macro focus. Arm angle creates depth. Background model face softly blurred. Product hero shot.',
      'Forearm resting on knee in seated editorial pose, bracelet centered in frame. Natural wrist angle, visible skin texture around bracelet. Sophisticated luxury moment.',
    ],
  },
  kupe: {
    bodyRegion: 'ear and profile',
    poses: [
      'Pure side profile with hair swept completely behind ear. Earring fully visible from lobe to lowest point. Clean jawline, neck elongated. Earring catches dramatic rim light. Magazine cover composition.',
      'Three-quarter view looking over shoulder, earring prominent against neck silhouette. Chin slightly raised. Earring creates elegant line from ear to shoulder. Mysterious editorial gaze.',
      'Head tilted 15° toward camera, earring swaying with captured micro-movement. Natural motion blur on hair tips, earring frozen sharp. Editorial action moment.',
      'Profile with chin raised at 20°, earring creating sculptural silhouette against negative space. Strong jawline emphasized. Architectural, fashion-forward composition.',
      'Hair swept up in elegant chignon, both earrings visible from frontal three-quarter angle. Neck fully exposed. Earrings frame the face symmetrically. Classic portrait.',
      'Close-up profile from behind, showing ear and earring with shoulder and neck. Hair pulled to opposite side. Intimate, revealing angle that showcases earring construction.',
    ],
  },
  kolye: {
    bodyRegion: 'neck and décolletage',
    poses: [
      'Straight-on décolletage view, necklace centered on chest. Clean neckline — off-shoulder or strapless to maximize visibility. Pendant rests at natural drape point. Even skin tone, collar bones visible.',
      'Slight head tilt with eyes lowered toward necklace, creating viewer\'s gaze path from face to product. Soft smile. Necklace draping naturally following gravity. Warm editorial portrait.',
      'Profile view showing necklace chain line flowing along neck curve. Artistic negative space composition. Chain catches light creating a golden path. Sculptural beauty.',
      'Looking directly at camera, chin slightly lowered, necklace pendant catching spotlight. Intimate eye contact draws viewer in, then gaze falls to jewelry. Power editorial.',
      'Three-quarter view with one hand delicately touching pendant — drawing attention to it. Fingers gentle, not gripping. Natural interaction between model and jewelry.',
      'Head thrown back slightly with closed eyes, necklace displayed on elongated neck. Sensual, luxury fragrance campaign aesthetic. Necklace catches overhead light beautifully.',
    ],
  },
  saat: {
    bodyRegion: 'wrist',
    poses: [
      'Wrist check pose — glancing at watch face with quiet confidence. Business editorial. Watch dial readable, crystal catching overhead light. Subtle smile of satisfaction.',
      'Forearm resting on dark wood surface, watch dial angled toward camera for maximum readability. Crown and pushers visible. Relaxed luxury lifestyle moment.',
      'Hand adjusting jacket sleeve cuff, revealing watch in a natural, unposed moment. Sophisticated lifestyle editorial. Watch partially emerging from fabric creates anticipation.',
      'Wrist resting on knee in seated pose, watch dial facing outward. Full watch visible — crystal, bezel, bracelet links all sharp. Executive editorial power.',
      'Crossed arms with watch prominently visible on top wrist, facing camera. Power pose, confident direct gaze. Watch as status symbol, editorial authority.',
      'Hand gripping steering wheel or armrest, watch visible at natural wrist angle. Luxury lifestyle context. Watch catches dashboard ambient light.',
    ],
  },
  genel: {
    bodyRegion: 'full portrait',
    poses: [
      'Elegant three-quarter portrait with jewelry as natural complement to minimal styling. Strong posture, confident expression. Jewelry catches light and draws eye naturally.',
      'Editorial fashion pose — angular body position, architectural composition. Jewelry as statement piece creating visual focal point. High-fashion magazine aesthetic.',
      'Soft natural portrait with genuine expression, jewelry adding sophistication. Approachable luxury — like a brand ambassador campaign. Warm, inviting, aspirational.',
      'Dramatic profile silhouette with jewelry catching rim light. Dark background, moody atmosphere. Jewelry creates luminous accent in shadow. Art-house editorial.',
    ],
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════
// THREE PROMPT BUILDER FUNCTIONS
// ═══════════════════════════════════════════════════

function buildEditorialPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
): string {
  const scene = pickRandom(EDITORIAL_SCENE_POOL);
  const lighting = pickRandom(LIGHTING_ANGLES);
  const camera = pickRandom(CAMERA_PERSPECTIVES);

  console.log(`Editorial scene: ${scene.name}, Lighting: ${lighting.substring(0, 40)}..., Camera: ${camera.substring(0, 30)}...`);

  return `EDITORIAL / CREATIVE LUXURY JEWELRY PHOTOGRAPHY — Magazine campaign quality, high-fashion editorial.

${productExtractionBlock}

${fidelityBlock}

SCENE: ${scene.name}
${scene.prompt}

LIGHTING: ${lighting}

CAMERA: ${camera}

CREATIVE DIRECTION:
- Magazine cover / double-page spread quality
- Dramatic depth of field with cinematic bokeh
- Rich texture realism on both the jewelry and the scene surface
- Hyper-detailed macro-level rendering of every facet, prong, and metal grain
- The jewelry must be the hero element — scene supports but never competes
- Color grading: rich, moody, luxury fashion editorial palette

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic — no CGI look
- Macro photography quality with perfect focus on the jewelry`;
}

function buildEcommercePrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
): string {
  return `E-COMMERCE PROFESSIONAL PRODUCT PHOTOGRAPHY — Clean, commercial, marketplace-ready.

${productExtractionBlock}

${fidelityBlock}

BACKGROUND:
- Pure white to very light grey gradient background (RGB 248-255)
- Absolutely NO props, NO environment elements, NO decorations
- NO model, NO hands, NO skin — product only
- Clean infinity curve / seamless white backdrop

LIGHTING:
- Soft omnidirectional studio lighting from all sides
- Minimal shadows — just enough for depth/grounding
- No harsh highlights, no dramatic shadows
- Even, balanced illumination revealing all product details

COMPOSITION:
- Product centered in frame, occupying 60-70% of the frame
- Straight-on or very slight angle for maximum detail visibility
- Sharp focus across entire product (deep depth of field)
- No artistic blur or bokeh

STANDARDS:
- Amazon / Trendyol / Shopify product listing quality
- Professional packshot / catalog photography style
- Color-accurate representation of metals and stones
- Commercial-grade precision and clarity

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic
- Studio product photography with maximum sharpness`;
}

function buildModelPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
  productType: string,
): string {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG['genel'];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const skinTone = pickRandom(CHARACTER_SKIN_TONES);
  const hairStyle = pickRandom(CHARACTER_HAIR_STYLES);

  console.log(`Model prompt — Type: ${productType}, Region: ${config.bodyRegion}, Gaze: ${gaze.substring(0, 40)}..., Expression: ${expression.substring(0, 40)}...`);

  return `EDITORIAL MODEL PHOTOGRAPHY — High-fashion portrait with real human model wearing the jewelry piece.

${productExtractionBlock}

${fidelityBlock}

⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️
- A real, photographic human model MUST be visible and wearing the jewelry
- NO product-only output — the model IS required
- NO mannequins, NO floating jewelry, NO disembodied body parts

═══════════════════════════════════════════════════════════════
CHARACTER DNA — UNIQUE IDENTITY FOR THIS SHOT
═══════════════════════════════════════════════════════════════

SKIN & COMPLEXION:
- ${skinTone}
- Real skin texture mandatory: visible pores, natural micro-imperfections, subtle vein patterns on hands/wrists
- Absolutely NO plastic/CGI/airbrushed/beauty-filtered look
- Natural skin sheen — not matte, not oily, just healthy luminous skin
- Subsurface scattering visible in ear lobes, fingertips, and thin skin areas

HAIR:
- Dark hair (black to deep brunette), natural and healthy
- Style: ${hairStyle}
- Individual hair strands visible, natural flyaways for realism
- Hair must not obstruct the jewelry — styled to reveal it

EXPRESSION & GAZE:
- ${expression}
- ${gaze}
- Micro-expression details: subtle muscle tension, natural lip position
- Eyes: realistic iris detail with natural catch-lights

BODY & ANATOMY:
- Age range: 25-35, natural beauty
- Turkish / Mediterranean aesthetic
- Anatomical accuracy: correct finger count (5 per hand), natural proportions
- Natural body weight — realistic, not idealized
- Visible collarbone definition, natural neck length

═══════════════════════════════════════════════════════════════
POSE & JEWELRY PLACEMENT
═══════════════════════════════════════════════════════════════

BODY REGION: ${config.bodyRegion.toUpperCase()}
POSE: ${pose}

JEWELRY INTERACTION:
- The jewelry must be the HERO — model supports, never competes
- Sharp focus on jewelry, model slightly softer (but still detailed)
- Natural jewelry-skin interaction: realistic weight, drape, and contact
- Light must highlight the jewelry more than the model's features

ENVIRONMENT:
- Soft editorial lighting — cinematic and flattering
- Neutral to warm luxury setting (not distracting)
- Shallow depth of field — f/1.8 to f/2.8 bokeh
- Background suggestion: soft gradient, architectural detail out of focus, or natural light source

COLOR GRADING:
- Warm, rich tones — luxury editorial palette
- Skin tones accurate and flattering
- Metal color of jewelry preserved exactly

TECHNICAL:
- 4K ultra-high resolution output
- Ultra photorealistic portrait photography
- Fashion editorial meets luxury advertising campaign quality
- Shot on 85mm f/1.4 — classic portrait compression and bokeh`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function callGeminiImageGeneration({
  base64Images,
  prompt,
  temperature = 0.15,
  aspectRatio = '3:4',
}: {
  base64Images: string[];
  prompt: string;
  temperature?: number;
  aspectRatio?: string;
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;

  const parts: any[] = [{ text: prompt }];
  for (const base64Image of base64Images) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Image } });
  }

  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature,
        imageConfig: {
          aspectRatio,
          imageSize: '4K',
        },
      },
    }),
  });
}

// Retry-enabled single image generation
async function generateSingleImage(
  base64Images: string[],
  prompt: string,
  userId: string,
  imageRecordId: string,
  index: number,
  supabase: any,
  jobId: string,
  aspectRatio: string = '3:4',
): Promise<string | null> {
  const temperatures = [0.15, 0.2, 0.25];
  const delays = [0, 3000, 5000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!GOOGLE_IMAGE_API_KEY) {
        console.error('Missing GOOGLE_API_KEY');
        return null;
      }

      if (attempt > 0) {
        console.log(`Retry ${attempt}/2 for image ${index} with temperature ${temperatures[attempt]}...`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }

      const genResponse = await callGeminiImageGeneration({
        base64Images,
        prompt,
        temperature: temperatures[attempt],
        aspectRatio,
      });

      if (!genResponse.ok) {
        const errText = await genResponse.text();
        console.error(`Generation ${index} API error (${genResponse.status}) attempt ${attempt + 1}:`, errText);
        if (attempt < 2) continue;
        return null;
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
        console.error(`No image in generation response (attempt ${attempt + 1})`);
        if (attempt < 2) continue;
        return null;
      }

      const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
      generatedImage = null; // Free memory

      const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
      const { error: uploadError } = await supabase.storage
        .from('jewelry-images')
        .upload(filePath, imageBuffer, { contentType: 'image/png' });

      if (!uploadError) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('jewelry-images')
          .createSignedUrl(filePath, 7 * 24 * 60 * 60);

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

async function processGeneration(params: {
  userId: string;
  imageRecordId: string;
  jobId: string;
  imagePaths: string[];
  validAdditionalPaths: string[];
  sceneId: string | null;
  packageType: string;
  productType: string | null;
  metalColorOverride: string | null;
  styleReferencePath: string | null;
  aspectRatio: string;
  creditsNeeded: number;
  isAdminUser: boolean;
}) {
  const supabase = getServiceClient();
  const {
    userId, imageRecordId, jobId, imagePaths, validAdditionalPaths,
    sceneId, packageType, productType,
    metalColorOverride, styleReferencePath, aspectRatio, creditsNeeded, isAdminUser,
  } = params;

  console.log(`Using model: Analysis=Gemini 2.5 Flash, Generation=Gemini 3 Pro (4K), Package=${packageType}`);

  const isRetouchPackage = packageType === 'retouch';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    // Update job: started
    await supabase.from('processing_jobs').update({
      status: 'generating',
      current_step: 'downloading',
      started_at: new Date().toISOString(),
      progress: 2,
    }).eq('id', jobId);

    // Get signed URLs for all images
    const allImagePaths = [imagePaths[0], ...validAdditionalPaths];
    const imageUrls: string[] = [];

    for (const path of allImagePaths) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(path, 3600);

      if (!signedUrlError && signedUrlData?.signedUrl) {
        imageUrls.push(signedUrlData.signedUrl);
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Failed to access images');
    }

    await supabase.from('processing_jobs').update({
      progress: 5,
      current_step: 'downloading',
    }).eq('id', jobId);

    // Check if style reference is provided
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    let styleReferenceBase64: string | null = null;

    if (hasStyleReference) {
      const { data: styleSignedData, error: styleSignedError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(styleReferencePath!, 3600);

      if (!styleSignedError && styleSignedData?.signedUrl) {
        try {
          const styleResponse = await fetch(styleSignedData.signedUrl);
          const styleBuffer = await styleResponse.arrayBuffer();
          if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
            styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
            console.log('Style reference converted to base64');
          }
        } catch (err) {
          console.error('Failed to fetch style reference:', err);
        }
      }
    }

    // Get scene if needed
    let scene: any = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
      const { data: sceneData } = await supabase
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .single();
      scene = sceneData;
    }

    // Fetch and convert first image to base64
    await supabase.from('processing_jobs').update({
      current_step: 'analyzing',
      progress: 10,
    }).eq('id', jobId);

    const base64Images: string[] = [];
    const firstUrl = imageUrls[0];
    const imageResponse = await fetch(firstUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength <= MAX_IMAGE_SIZE) {
      base64Images.push(arrayBufferToBase64(imageBuffer));
    }

    if (base64Images.length === 0) {
      throw new Error('Image too large. Max 1.5MB.');
    }

    const base64Image = base64Images[0];

    // ═══════════════════════════════════════════════════
    // ANALYZE JEWELRY
    // ═══════════════════════════════════════════════════
    console.log('Step 1: Analyzing jewelry...');
    await supabase.from('processing_jobs').update({ progress: 15 }).eq('id', jobId);

    const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_ANALYSIS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are an expert jewelry and luxury watch analyst. Analyze this piece with extreme precision.

Return JSON:
{
  "type": "ring|necklace|bracelet|earring|pendant|brooch|watch|choker|piercing",
  "metal": {
    "type": "gold|silver|platinum|rose_gold|white_gold|mixed",
    "karat": "24k|22k|18k|14k|10k|sterling|unknown",
    "finish": "polished|matte|brushed|hammered|textured|satin",
    "color_hex": "#hex"
  },
  "stones": [
    {
      "type": "diamond|ruby|emerald|sapphire|pearl|amethyst|topaz|mother_of_pearl|other",
      "count": number,
      "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette",
      "color": "description",
      "size_mm": "size",
      "setting": "prong|bezel|channel|pave|tension|cluster|halo"
    }
  ],
  "watch_details": {
    "dial_color": "white|black|blue|champagne|mother_of_pearl|other",
    "dial_finish": "sunburst|guilloché|enamel|textured|plain",
    "complications": ["date", "chronograph", "moon_phase", "tourbillon", "none"],
    "case_shape": "round|square|rectangular|tonneau|cushion",
    "strap_type": "metal_bracelet|leather|rubber|fabric|ceramic",
    "bezel_style": "smooth|fluted|diamond_set|ceramic",
    "crystal_type": "sapphire|mineral|acrylic"
  },
  "dimensions": {
    "estimated_width_mm": number,
    "estimated_height_mm": number
  },
  "design_elements": {
    "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian|sports|dress",
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "guilloché", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "unique features including brand indicators, logo placement, signature design elements"
}

NOTE: If analyzing a WATCH, pay special attention to:
- Pearl/mother-of-pearl dial details
- Diamond-set bezel or indices
- Metal bracelet link patterns
- Crown and pusher designs
- Visible mechanical movement details

ONLY valid JSON.`
            },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      }),
    });

    let analysisResult: any = { type: 'jewelry', design_elements: { style: 'classic' } };

    if (analysisResponse.ok) {
      try {
        const analysisData = await analysisResponse.json();
        const content = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        console.error('Failed to parse analysis');
      }
    }

    console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));

    await supabase.from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      current_step: 'generating',
      progress: 25,
    }).eq('id', jobId);

    // ═══════════════════════════════════════════════════
    // BUILD FIDELITY BLOCK
    // ═══════════════════════════════════════════════════
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
      if (metalType === 'white_gold' || metalType === 'platinum' || metalType === 'silver') {
        metalColorCategory = 'WHITE/SILVER METAL';
      } else if (metalType === 'rose_gold') {
        metalColorCategory = 'ROSE GOLD';
      } else if (metalType === 'gold') {
        metalColorCategory = 'YELLOW GOLD';
      }
    }

    console.log('Metal color decision:', { userOverride: metalColorOverride, finalType: metalType, finalCategory: metalColorCategory });

    const metalDesc = `${metalFinish} ${metalType.replace('_', ' ')} (${metalKarat})`;

    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) =>
          `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`
        ).join(', ')
      : '';

    const userOverrideNote = metalColorOverride
      ? `\n⚠️ USER SPECIFIED METAL COLOR: ${metalColorCategory} - THIS TAKES ABSOLUTE PRIORITY ⚠️\nThe user has explicitly specified that this jewelry is ${metalColorCategory}. Ignore any visual ambiguity and render as ${metalColorCategory}.\n`
      : '';

    const productExtractionBlock = `
═══════════════════════════════════════════════════════════════
SYSTEM INSTRUCTION — PRODUCT EXTRACTION MODE
═══════════════════════════════════════════════════════════════

The uploaded image is used STRICTLY to extract the jewelry product.

EXTRACTION RULES (MANDATORY):
- Extract ONLY the jewelry object from the reference image(s)
- IGNORE and DISCARD all non-jewelry elements including:
  • hands, skin, fingers, nails
  • background, reflections, shadows, environment
  • camera angle, lighting conditions
  • any contextual elements

THE OUTPUT MUST CONTAIN:
- ✔ ONLY the jewelry piece detected in the image
- ✔ Accurate geometry, proportions, stone placement, metal structure
- ✔ Neutralized reference orientation (product isolated)

The jewelry must be reconstructed as a STANDALONE OBJECT, as if scanned in a vacuum.

═══════════════════════════════════════════════════════════════
STAGE 2 — SCENE APPLICATION
═══════════════════════════════════════════════════════════════

Using the ISOLATED jewelry object:
- Place the product into the selected scene
- Lighting, background, camera, and composition must be defined ONLY by the scene prompt
- The product's intrinsic properties (metal color, stone type, design) are preserved
═══════════════════════════════════════════════════════════════`.trim();

    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === 'watch' ? `
LUXURY WATCH SPECIFICATIONS:
- Dial: ${watchDetails.dial_color || 'classic'} ${watchDetails.dial_finish || ''} finish
- Case Shape: ${watchDetails.case_shape || 'round'}
- Bezel: ${watchDetails.bezel_style || 'smooth'}
- Strap/Bracelet: ${watchDetails.strap_type || 'metal_bracelet'}
- Crystal: ${watchDetails.crystal_type || 'sapphire'}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(', ')}` : ''}
` : '';

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
- Metal Color Category: ${metalColorCategory}
${metalColorHex ? `- Exact Metal Color Hex: ${metalColorHex}` : ''}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}
${watchDesc}
${userOverrideNote}
⚠️ ABSOLUTE METAL COLOR PRESERVATION (HIGHEST PRIORITY) ⚠️
THE METAL COLOR MUST BE: ${metalColorCategory}
- Metal type: ${metalType.replace('_', ' ').toUpperCase()}
- Metal color: ${metalColorCategory}
${metalColorHex ? `- Hex color: ${metalColorHex}` : ''}

STRICT METAL RULES:
- If the original is YELLOW GOLD → output MUST be YELLOW GOLD (warm golden hue)
- If the original is WHITE GOLD/PLATINUM/SILVER → output MUST be WHITE/SILVER metal
- If the original is ROSE GOLD → output MUST be ROSE GOLD (pinkish golden hue)
- NEVER convert yellow gold to white gold or vice versa

CRITICAL FIDELITY REQUIREMENTS:
1. EXACT metal color - THIS IS THE MOST IMPORTANT RULE
2. EXACT stone count - no more, no less
3. EXACT setting structure and prong positions
4. EXACT metal surface finish (${metalFinish})
5. EXACT proportions - do not resize
6. EXACT design elements - preserve all patterns
7. Natural realistic scale

DIAMOND AND GEMSTONE REALISM (CRITICAL):
- Real diamond light behavior: fire, brilliance, scintillation
- Authentic internal light refraction patterns
- Natural inclusions visible in realistic diamonds
- Depth and three-dimensionality inside the stone
- No artificial HDR glow, no CGI-like perfection

FORBIDDEN:
- ❌ CHANGING METAL COLOR - ABSOLUTELY FORBIDDEN
- ❌ No text, watermarks, logos
- ❌ No design alterations
- ❌ No additional jewelry pieces
- ❌ No artificial CGI gemstones`.trim();

    const generatedUrls: string[] = [];

    // ═══════════════════════════════════════════════════
    // GENERATION LOGIC
    // ═══════════════════════════════════════════════════

    if (isRetouchPackage) {
      console.log('Retouch Package: Professional photo enhancement...');

      const retouchPrompt = `
═══════════════════════════════════════════════════════════════
PROFESSIONAL JEWELRY PHOTO RETOUCH
═══════════════════════════════════════════════════════════════

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.

CORE RETOUCH PHILOSOPHY:
- Work like an experienced jewelry retoucher using Photoshop/Capture One workflows
- Goal: Clean, premium, realistic, commercially usable jewelry image

ABSOLUTE PRODUCT INTEGRITY RULES (CRITICAL):
- Do NOT change product geometry, proportions, or scale
- Do NOT add, remove, resize or reshape stones
- Do NOT modify stone count, cut, setting or prong structure
- Do NOT change metal structure, engravings or design language

BACKGROUND & MASKING:
- Isolate the jewelry using precision masking techniques
- Apply a pure white background (RGB 255,255,255)
- Remove all shadows, reflections, stands, wires or supports

LIGHTING & COLOR CORRECTION:
- Correct white balance to reflect true material properties
- Simulate professional studio lighting from upper-left (10–11 o'clock)
- Soft, diffuse light with controlled highlights

STONE ENHANCEMENT:
- Improve clarity while preserving natural inclusions
- Enhance facet definition and internal light paths
- Avoid artificial sparkle, glow or exaggerated refraction
- NEVER change stone shape, size, count or position

METAL SURFACE REFINEMENT:
- Remove dust, scratches, fingerprints and micro defects
- Preserve natural metal texture (polished, matte, brushed)
- Metal must look premium, clean and physically real

OUTPUT: Single professionally retouched jewelry image on pure white background.
Ultra high resolution output.`.trim();

      await supabase.from('processing_jobs').update({ progress: 28 }).eq('id', jobId);
      const retouchUrl = await generateSingleImage(base64Images, retouchPrompt, userId, imageRecordId, 0, supabase, jobId, aspectRatio);

      if (retouchUrl) {
        generatedUrls.push(retouchUrl);
        console.log('Retouch complete');
      }

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

    } else if (hasStyleReference && styleReferenceBase64) {
      // STYLE REFERENCE MODE
      console.log('Style reference generation mode...');

      const productTypePlacement: Record<string, { bodyPart: string; placement: string; removal: string }> = {
        'yuzuk': { bodyPart: 'hand/finger', placement: 'Place the ring on the finger in the exact position shown in the style reference.', removal: 'Remove any existing rings from the style reference model.' },
        'bileklik': { bodyPart: 'wrist', placement: 'Place the bracelet on the wrist as shown in the style reference.', removal: 'Remove any existing bracelets or wrist accessories.' },
        'kupe': { bodyPart: 'ear', placement: 'Place the earring on the ear. If only one ear visible, render only ONE earring.', removal: 'Remove any existing earrings.' },
        'kolye': { bodyPart: 'neck/décolletage', placement: 'Place the necklace around the neck/décolletage area.', removal: 'Remove any existing necklaces.' },
        'saat': { bodyPart: 'wrist', placement: 'Place the watch on the wrist with dial face clearly visible.', removal: 'Remove any existing watches or wrist accessories.' },
      };

      const selectedPlacement = productTypePlacement[productType || ''] || {
        bodyPart: 'appropriate body part',
        placement: 'Place the jewelry on the model naturally.',
        removal: 'Remove any existing jewelry from the target body part.'
      };

      const styleTransferPrompt = `[STYLE REFERENCE TRANSFER - PRODUCT INJECTION MODE]

⚠️ PRE-PROCESSING: ACCESSORY REMOVAL ⚠️
1. REMOVE all existing jewelry from target: ${selectedPlacement.bodyPart}
2. ${selectedPlacement.removal}

IMAGE 1 = STYLE REFERENCE (pose, scene, lighting, atmosphere)
IMAGE 2+ = PRODUCT REFERENCE (jewelry to transfer)

${productExtractionBlock}

${fidelityBlock}

PRODUCT TYPE: ${productType?.toUpperCase() || 'JEWELRY'}
TARGET: ${selectedPlacement.bodyPart.toUpperCase()}
PLACEMENT: ${selectedPlacement.placement}

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.
Ultra high resolution output.`;

      await supabase.from('processing_jobs').update({ progress: 28 }).eq('id', jobId);
      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      const url = await generateSingleImage(styleTransferImages, styleTransferPrompt, userId, imageRecordId, 1, supabase, jobId, aspectRatio);
      if (url) generatedUrls.push(url);

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

    } else {
      // MASTER PAKET: 3 fundamentally different images
      // 1) Editorial/Creative  2) E-Commerce  3) Model/Lifestyle
      console.log('Master Paket generation (Editorial + E-Commerce + Model, 4K)...');

      // Resolve productType: use analysis if not provided
      const resolvedProductType = productType || (() => {
        const analysisType = analysisResult?.type?.toLowerCase() || '';
        const typeMap: Record<string, string> = {
          ring: 'yuzuk', necklace: 'kolye', bracelet: 'bileklik',
          earring: 'kupe', pendant: 'kolye', watch: 'saat',
          choker: 'kolye', brooch: 'genel', piercing: 'kupe',
        };
        return typeMap[analysisType] || 'genel';
      })();

      console.log(`Resolved product type: ${resolvedProductType}`);

      const masterSteps = [
        { key: 'editorial', step: 'generating_editorial', label: 'Editorial',
          buildPrompt: () => buildEditorialPrompt(analysisResult, fidelityBlock, productExtractionBlock) },
        { key: 'ecommerce', step: 'generating_ecommerce', label: 'E-Commerce',
          buildPrompt: () => buildEcommercePrompt(analysisResult, fidelityBlock, productExtractionBlock),
          temperature: 0.1 },
        { key: 'model', step: 'generating_model', label: 'Model',
          buildPrompt: () => buildModelPrompt(analysisResult, fidelityBlock, productExtractionBlock, resolvedProductType) },
      ];

      for (let i = 0; i < masterSteps.length; i++) {
        const ms = masterSteps[i];
        console.log(`Generating ${ms.label} image (${i + 1}/3)...`);

        const startProgress = 28 + (i * 20);
        await supabase.from('processing_jobs').update({
          progress: startProgress,
          current_step: ms.step,
        }).eq('id', jobId);

        const prompt = ms.buildPrompt();

        let url: string | null = null;

        if (ms.temperature !== undefined) {
          // Override temperature for e-commerce by using callGeminiImageGeneration directly with retry
          const temperatures = [ms.temperature, ms.temperature + 0.02, ms.temperature + 0.05];
          const delays = [0, 3000, 5000];

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (!GOOGLE_IMAGE_API_KEY) break;
              if (attempt > 0) {
                console.log(`E-commerce retry ${attempt}/2...`);
                await new Promise(r => setTimeout(r, delays[attempt]));
              }

              const genResponse = await callGeminiImageGeneration({
                base64Images,
                prompt,
                temperature: temperatures[attempt],
                aspectRatio,
              });

              if (!genResponse.ok) {
                const errText = await genResponse.text();
                console.error(`E-commerce gen error (${genResponse.status}) attempt ${attempt + 1}:`, errText);
                if (attempt < 2) continue;
                break;
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
                if (attempt < 2) continue;
                break;
              }

              const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
              generatedImage = null;

              const filePath = `${userId}/generated/${imageRecordId}-${i + 1}.png`;
              const { error: uploadError } = await supabase.storage
                .from('jewelry-images')
                .upload(filePath, imageBuffer, { contentType: 'image/png' });

              if (!uploadError) {
                const { data: signedUrlData } = await supabase.storage
                  .from('jewelry-images')
                  .createSignedUrl(filePath, 7 * 24 * 60 * 60);
                if (signedUrlData?.signedUrl) {
                  url = signedUrlData.signedUrl;
                }
              }
              break;
            } catch (error) {
              console.error(`E-commerce gen error (attempt ${attempt + 1}):`, error);
              if (attempt < 2) continue;
            }
          }
        } else {
          url = await generateSingleImage(base64Images, prompt, userId, imageRecordId, i + 1, supabase, jobId, aspectRatio);
        }

        if (url) generatedUrls.push(url);

        const endProgress = 45 + (i * 20);
        await supabase.from('processing_jobs').update({
          completed_images: generatedUrls.length,
          progress: endProgress,
        }).eq('id', jobId);

        console.log(`${ms.label} image done. Progress: ${endProgress}%`);
      }
    }

    // ═══════════════════════════════════════════════════
    // FINALIZE
    // ═══════════════════════════════════════════════════

    await supabase.from('processing_jobs').update({ progress: 90, current_step: 'saving' }).eq('id', jobId);

    if (generatedUrls.length === 0) {
      // Refund credits
      if (!isAdminUser) {
        const { error: refundError } = await supabase
          .rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
        if (refundError) console.error('Refund error:', refundError);
        else console.log(`Credits refunded: ${creditsNeeded}`);
      }

      await supabase.from('images').update({
        status: 'failed',
        error_message: 'Görsel oluşturulamadı'
      }).eq('id', imageRecordId);

      await supabase.from('processing_jobs').update({
        status: 'failed',
        error_message: 'Görsel oluşturulamadı',
        progress: 100,
        current_step: 'failed',
      }).eq('id', jobId);

      return;
    }

    // Partial success: at least 1 image generated
    await supabase.from('images').update({
      status: 'completed',
      generated_image_urls: generatedUrls,
    }).eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'completed',
      result_urls: generatedUrls,
      completed_images: generatedUrls.length,
    }).eq('id', jobId);

    console.log('Generation complete:', generatedUrls.length, 'images');

  } catch (error) {
    console.error('Processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (!isAdminUser) {
      try {
        await supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
        console.log(`Credits refunded on error: ${creditsNeeded}`);
      } catch (refundErr) {
        console.error('Refund on error failed:', refundErr);
      }
    }

    await supabase.from('images').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      status: 'failed',
      error_message: errorMessage,
      progress: 100,
      current_step: 'failed',
    }).eq('id', jobId);
  }
}

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    const userId = authResult.userId;
    console.log('Authenticated user:', userId);

    const { imagePath, additionalImagePaths, sceneId, packageType, productType, metalColorOverride, styleReferencePath, aspectRatio: requestedRatio } = req.body;
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const aspectRatio = validRatios.includes(requestedRatio) ? requestedRatio : '3:4';
    console.log('Generate request:', { imagePath, sceneId, packageType, productType, aspectRatio, userId });

    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return sendCorsResponse(res, 400, { error: 'Invalid image path' });
    }

    const validAdditionalPaths: string[] = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === 'string' && path.startsWith(`${userId}/originals/`)) {
          validAdditionalPaths.push(path);
        }
      }
    }

    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRetouchPackage = packageType === 'retouch';

    // Standard (Master) package doesn't need sceneId — only style-reference-less, non-retouch, non-standard needs it
    const isStandardPackage = packageType === 'standard' || !packageType;
    if (!hasStyleReference && !isRetouchPackage && !isStandardPackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return sendCorsResponse(res, 400, { error: 'Invalid scene ID' });
    }

    const supabase = getServiceClient();

    // Auto-clean stuck jobs older than 3 minutes
    const { data: stuckJobs } = await supabase
      .from('processing_jobs')
      .select('id, image_record_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'generating'])
      .lt('updated_at', new Date(Date.now() - 3 * 60 * 1000).toISOString());

    if (stuckJobs && stuckJobs.length > 0) {
      const stuckJobIds = stuckJobs.map(j => j.id);
      const stuckImageIds = stuckJobs.map(j => j.image_record_id).filter(Boolean);

      await supabase
        .from('processing_jobs')
        .update({ status: 'failed', error_message: 'Auto-cleaned: stuck job (timeout)' })
        .in('id', stuckJobIds);

      if (stuckImageIds.length > 0) {
        await supabase
          .from('images')
          .update({ status: 'failed', error_message: 'Auto-cleaned: generation timed out' })
          .in('id', stuckImageIds);
      }
      console.log(`Auto-cleaned ${stuckJobs.length} stuck jobs`);
    }

    // Check for active jobs
    const { count: activeJobs } = await supabase
      .from('processing_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'generating']);

    if (activeJobs && activeJobs > 0) {
      return sendCorsResponse(res, 409, { error: 'Zaten devam eden bir üretim var. Lütfen bekleyin.', code: 'ACTIVE_JOB_EXISTS' });
    }

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const isAdminUser = isAdmin === true;

    const creditsNeeded = 10;

    // Deduct credits
    if (!isAdminUser) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: userId, _amount: creditsNeeded });

      if (deductError) {
        return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu.' });
      }

      if (!deductResult?.success) {
        return sendCorsResponse(res, 402, {
          error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.`
        });
      }

      console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
    }

    // Create image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        scene_id: sceneId || null,
        original_image_url: imagePath,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    const imageRecordId = imageRecord.id;

    // Create processing job
    const { data: jobRecord, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        user_id: userId,
        image_record_id: imageRecordId,
        status: 'pending',
        total_images: 3,
        completed_images: 0,
        progress: 0,
        current_step: 'pending',
        credits_used: isAdminUser ? 0 : creditsNeeded,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobRecordId = jobRecord.id;

    console.log(`Job created: ${jobRecordId}, Image record: ${imageRecordId}`);

    // Return immediately, process in background via waitUntil
    waitUntil(processGeneration({
      userId,
      imageRecordId,
      jobId: jobRecordId,
      imagePaths: [imagePath, ...validAdditionalPaths],
      validAdditionalPaths,
      sceneId: sceneId || null,
      packageType: packageType || 'standard',
      productType: productType || null,
      metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null,
      aspectRatio,
      creditsNeeded,
      isAdminUser,
    }));

    return sendCorsResponse(res, 200, {
      success: true,
      jobId: jobRecordId,
      imageId: imageRecordId,
      status: 'pending',
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}
