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
// EDITORIAL SCENE POOL (27 scenes, 5 categories)
// ═══════════════════════════════════════════════════
interface EditorialScene {
  name: string;
  category: 'outdoor' | 'campaign' | 'fashion' | 'architectural' | 'surface';
  prompt: string;
}

const EDITORIAL_SCENE_POOL: EditorialScene[] = [
  // ── Outdoor / Dis Cekim (6) ──
  { name: 'Golden Hour Rooftop', category: 'outdoor',
    prompt: 'Luxury rooftop terrace at golden hour. City skyline softly blurred in bokeh behind the jewelry. Warm amber directional light from setting sun. Polished stone ledge as placement surface. Cinematic depth, aspirational metropolitan luxury.' },
  { name: 'Mediterranean Garden Terrace', category: 'outdoor',
    prompt: 'Olive tree garden terrace in Provence style. Dappled sunlight filtering through leaves creates organic light patterns on the jewelry. Weathered stone table surface. Soft green and warm gold color palette. Editorial travel-luxury atmosphere.' },
  { name: 'Beach at Dawn', category: 'outdoor',
    prompt: 'Blue hour beach scene at dawn. Jewelry placed on wet sand with mirror-like reflections. Cool blue-silver atmosphere with first warm light on horizon. Gentle wave traces nearby. Serene, ethereal coastal luxury.' },
  { name: 'Autumn Vineyard', category: 'outdoor',
    prompt: 'Vineyard estate during golden hour in autumn. Wine barrel or aged wood surface. Warm amber and burgundy fall foliage softly blurred behind. Rich harvest atmosphere. European heritage luxury editorial.' },
  { name: 'Desert Dunes Sunset', category: 'outdoor',
    prompt: 'Desert sand dune at sunset. Jewelry on smooth sand ridge with long dramatic shadows. Warm orange-to-purple gradient sky. Exotic, adventurous luxury. Wind-sculpted sand patterns frame the piece.' },
  { name: 'Snow Alpine Morning', category: 'outdoor',
    prompt: 'Crisp alpine winter morning. Jewelry on ice crystal surface with snow-capped mountains in soft focus behind. Pure white and pale blue palette. Sharp cold light with prismatic highlights. Clean, pure winter luxury.' },

  // ── Luks Reklam Kampanya (6) ──
  { name: 'Cartier Window Display', category: 'campaign',
    prompt: 'High-end jewelry boutique window display at night. Deep navy blue velvet platform with museum-grade spot lighting. Warm gold accent lights. Dark exterior reflections in glass. Exclusive, prestigious campaign atmosphere.' },
  { name: 'Tiffany Blue Perfection', category: 'campaign',
    prompt: 'Pristine white lacquered surface with iconic soft blue gradient backdrop. Perfect three-point studio lighting. Immaculate, minimal, aspirational. Luxury brand campaign precision with zero distractions.' },
  { name: 'Van Cleef Garden Fantasy', category: 'campaign',
    prompt: 'Fresh white peony flowers arranged artfully around the jewelry. Sage green watercolor-wash background. Soft diffused natural light. Romantic garden luxury. Poetic, feminine campaign editorial.' },
  { name: 'Noir Glamour Campaign', category: 'campaign',
    prompt: 'Single dramatic spotlight on glossy black lacquered surface. Deep chiaroscuro lighting — jewelry emerges from darkness. Strong contrast, film-noir mood. Bold, seductive luxury campaign.' },
  { name: 'Heritage Auction House', category: 'campaign',
    prompt: 'Antique mahogany display with burgundy leather inlay. Gilt gold frame partially visible. Warm museum lighting with focused spot on jewelry. Rich patina, heritage storytelling. Auction house prestige.' },
  { name: 'Modern Minimalist Campaign', category: 'campaign',
    prompt: 'Pure white studio cyclorama with three-point professional lighting. Clean infinity curve background. No shadows, no distractions. Surgical precision lighting reveals every facet. Contemporary luxury brand campaign.' },

  // ── Fashion Editorial (6) ──
  { name: 'Backstage Fashion Week', category: 'fashion',
    prompt: 'Fashion week backstage styling table. Ring light reflections visible. Raw, energetic atmosphere with hairspray mist in air. Professional chaos aesthetic. Behind-the-scenes editorial energy.' },
  { name: 'Editorial Studio Infinity', category: 'fashion',
    prompt: 'Desaturated mauve seamless backdrop. Profoto beauty dish overhead creating soft wraparound light. Minimal styling. High-fashion editorial simplicity with muted color palette. Magazine cover quality.' },
  { name: 'Haute Couture Atelier', category: 'fashion',
    prompt: 'Couture atelier cutting table with raw silk organza fabric partially draped nearby. Soft north-facing atelier window light. Pins, thread spools subtly blurred in background. Artisan craftsmanship atmosphere.' },
  { name: 'Vogue Still Life', category: 'fashion',
    prompt: 'Moody editorial flat-lay composition with luxury accessories. Dark textured surface. Dramatic overhead spotlight with deep shadows. Art-directed styling with negative space. Magazine spread quality.' },
  { name: 'Paris Apartment Morning', category: 'fashion',
    prompt: 'Haussmann-style Parisian apartment. Jewelry on marble mantelpiece. Sheer tulle curtain diffusing soft morning light. Ornate molding softly blurred. Romantic Parisian editorial lifestyle.' },
  { name: 'Fashion Film Set', category: 'fashion',
    prompt: 'Cinematic film set atmosphere. Fresnel light beam cutting through atmospheric dust particles. Moody, dramatic. Jewelry catches the focused beam. Behind-the-scenes fashion film production aesthetic.' },

  // ── Mimari / Ic Mekan (5) ──
  { name: 'Marble Foyer Grand Entrance', category: 'architectural',
    prompt: 'Grand Calacatta marble foyer. Crystal chandelier creating sparkling highlights overhead. Palatial architecture with arched doorways in soft focus. Warm ambient luxury. Five-star hotel entrance grandeur.' },
  { name: 'Art Gallery White Cube', category: 'architectural',
    prompt: 'Contemporary art gallery white plinth display. Track lighting from above creating precise illumination. White cube gallery space. Clean, curated, institutional luxury presentation.' },
  { name: 'Luxury Hotel Suite', category: 'architectural',
    prompt: 'Five-star hotel suite marble bathroom counter. Brass vanity lighting casting warm glow. Plush white towels and luxury amenities softly blurred. Intimate luxury lifestyle editorial.' },
  { name: 'Boutique Vitrine', category: 'architectural',
    prompt: 'High-end boutique glass display vitrine at night. Black suede platform inside. Exterior street lights creating soft bokeh through glass. Exclusive window shopping moment. Aspirational retail luxury.' },
  { name: 'Library Private Collection', category: 'architectural',
    prompt: 'Private library with leather-bound books and dark wood paneling. Brass reading lamp providing warm focused light. Rich intellectual luxury. Old-world sophistication and collector aesthetic.' },

  // ── Klasik Yuzey (2) ──
  { name: 'Black Velvet Classic', category: 'surface',
    prompt: 'Placed on rich black velvet fabric with deep texture folds, creating luxurious depth. Soft overhead lighting reveals velvet fiber texture. Dark, moody atmosphere with subtle warm highlights on the jewelry.' },
  { name: 'Reflective Black Glass', category: 'surface',
    prompt: 'Displayed on polished black glass surface creating mirror-like reflections of the jewelry. Dramatic rim lighting. Ultra-modern, sleek, high-tech luxury presentation.' },
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
      // Classic editorial
      'Model\'s hand gracefully touching collarbone, ring prominently visible on finger. Fingers slightly spread for clarity. Natural hand curvature, visible knuckle detail, elegant wrist angle.',
      'Hand gently framing face near jawline, ring in razor-sharp focus. Ring finger positioned at eye-level. Dreamy expression with soft eye contact. Skin texture visible on fingers.',
      'Hand running through tousled hair, ring catching a spark of light. Candid editorial moment frozen in time. Natural finger spacing shows ring from optimal angle.',
      'Both hands together near chin in contemplative pose, ring as absolute centerpiece. Interlocked fingers create elegant geometry. Ring positioned toward camera for maximum visibility.',
      'Hand resting on bare shoulder, ring visible against luminous skin. Three-quarter profile with chin slightly raised. Ring catches rim light creating a golden highlight.',
      'Hand elegantly draped over the edge of a dark surface, fingers cascading downward, ring catching dramatic side-light. Architectural hand pose, editorial precision.',
      'Model examining the ring on her own hand at close range — intimate, admiring moment. Ring is the sharp focus point. Background softly blurred.',
      // Artistic / avant-garde
      'Hand pressing against frosted glass — ring prominent against diffused backlight. Ethereal, artistic atmosphere. Fingers spread for maximum ring visibility.',
      'Fingers interlaced with fresh flowers — ring as organic jewelry-nature contrast. Botanical editorial styling. Ring catches natural light among petals.',
      'Hand emerging from dark water surface — ring catching first light, dramatic. Only hand and wrist visible above water line. Cinematic editorial moment.',
      'Palm open, fingers spread wide, ring catching overhead spotlight — editorial power pose. Strong geometric hand shape. Ring as the focal anchor of the composition.',
      'Hand resting on vintage leather-bound book spine — ring as intellectual luxury accent. Warm amber tones. Scholarly, refined atmosphere.',
    ],
  },
  bileklik: {
    bodyRegion: 'wrist',
    poses: [
      // Classic editorial
      'Wrist resting elegantly on a marble surface, bracelet draped naturally with golden catch-light. Relaxed confidence, fingers slightly curled. Bracelet chain follows wrist contour perfectly.',
      'Arm raised with hand in hair, bracelet sliding naturally on wrist. Gravity pulls bracelet to optimal viewing angle. Light catches each link/stone. Editorial movement frozen.',
      'Both wrists crossed casually at collarbone level, bracelet as focal point. One wrist stacked, editorial symmetry. Bracelet creates visual anchor.',
      'Hand touching neckline from below, wrist and bracelet naturally framed against décolletage. Bracelet catches warm skin-reflected light. Intimate gesture.',
      'Wrist extended gracefully forward toward camera, bracelet in sharp macro focus. Arm angle creates depth. Background model face softly blurred. Product hero shot.',
      'Forearm resting on knee in seated editorial pose, bracelet centered in frame. Natural wrist angle, visible skin texture around bracelet. Sophisticated luxury moment.',
      // Dynamic / lifestyle
      'Hand reaching for a champagne flute on a marble counter — bracelet sliding toward wrist bone. Candid luxury lifestyle moment. Warm golden hour lighting.',
      'Arms stretched overhead in a ballet-inspired pose — bracelet catching overhead stage lighting. Artistic, movement-inspired editorial. Graceful arm lines.',
      'Wrist draped over the arm of a velvet chair — bracelet dangling with gravity. Relaxed elegance. Side lighting creates golden rim on bracelet links.',
      'Hand adjusting sunglasses on top of head — wrist fully exposed, bracelet prominent. Casual luxury, resort editorial aesthetic. Natural outdoor light.',
      'Forearm resting on a window ledge with soft natural light streaming in — bracelet glowing in warm daylight. Contemplative, intimate morning moment.',
    ],
  },
  kupe: {
    bodyRegion: 'ear and profile',
    poses: [
      // Classic editorial
      'Pure side profile with hair swept completely behind ear. Earring fully visible from lobe to lowest point. Clean jawline, neck elongated. Earring catches dramatic rim light. Magazine cover composition.',
      'Three-quarter view looking over shoulder, earring prominent against neck silhouette. Chin slightly raised. Earring creates elegant line from ear to shoulder. Mysterious editorial gaze.',
      'Head tilted 15° toward camera, earring swaying with captured micro-movement. Natural motion blur on hair tips, earring frozen sharp. Editorial action moment.',
      'Profile with chin raised at 20°, earring creating sculptural silhouette against negative space. Strong jawline emphasized. Architectural, fashion-forward composition.',
      'Hair swept up in elegant chignon, both earrings visible from frontal three-quarter angle. Neck fully exposed. Earrings frame the face symmetrically. Classic portrait.',
      'Close-up profile from behind, showing ear and earring with shoulder and neck. Hair pulled to opposite side. Intimate, revealing angle that showcases earring construction.',
      // Intimate / artistic
      'Model laughing naturally with head tilted — earring caught in mid-swing. Joy and movement captured. Earring creates dynamic arc of light. Candid editorial warmth.',
      'Extreme close-up of ear and jawline only — earring filling the frame. Skin texture, ear lobe detail visible. Macro-portrait hybrid. Intimate product showcase.',
      'Model with wet hair slicked back after rain — earring stark against glistening skin. Dramatic, fashion-forward. High-contrast editorial with water droplet details.',
      'Hand tucking hair behind ear, revealing earring in a natural gesture. Earring just coming into view. Authentic, unposed moment. Soft editorial lighting.',
      'Model resting chin on palm, face at three-quarter angle — earring framed between jawline and shoulder. Thoughtful expression. Earring catches warm side light.',
    ],
  },
  kolye: {
    bodyRegion: 'neck and décolletage',
    poses: [
      // Classic editorial
      'Straight-on décolletage view, necklace centered on chest. Clean neckline — off-shoulder or strapless to maximize visibility. Pendant rests at natural drape point. Even skin tone, collar bones visible.',
      'Slight head tilt with eyes lowered toward necklace, creating viewer\'s gaze path from face to product. Soft smile. Necklace draping naturally following gravity. Warm editorial portrait.',
      'Profile view showing necklace chain line flowing along neck curve. Artistic negative space composition. Chain catches light creating a golden path. Sculptural beauty.',
      'Looking directly at camera, chin slightly lowered, necklace pendant catching spotlight. Intimate eye contact draws viewer in, then gaze falls to jewelry. Power editorial.',
      'Three-quarter view with one hand delicately touching pendant — drawing attention to it. Fingers gentle, not gripping. Natural interaction between model and jewelry.',
      'Head thrown back slightly with closed eyes, necklace displayed on elongated neck. Sensual, luxury fragrance campaign aesthetic. Necklace catches overhead light beautifully.',
      // Movement / dynamic
      'Model mid-turn, hair flying — necklace catching light in motion. Dynamic editorial energy. Necklace chain creates elegant arc. Sharp focus on jewelry amid movement.',
      'Looking over bare shoulder, necklace clasp and back chain visible. Unusual perspective showing craftsmanship from behind. Intimate, fashion-editorial angle.',
      'Model leaning forward slightly, pendant hanging free from chest — gravity creates beautiful drape. Necklace swinging gently. Three-dimensional depth showcase.',
      'Standing in doorframe silhouette, necklace catching the only light source. Dramatic chiaroscuro. Necklace is the brightest element in the composition.',
      'Hands clasped behind neck, elbows out — necklace displayed on fully open décolletage. Athletic yet elegant. Strong, confident body language.',
    ],
  },
  saat: {
    bodyRegion: 'wrist',
    poses: [
      // Classic editorial
      'Wrist check pose — glancing at watch face with quiet confidence. Business editorial. Watch dial readable, crystal catching overhead light. Subtle smile of satisfaction.',
      'Forearm resting on dark wood surface, watch dial angled toward camera for maximum readability. Crown and pushers visible. Relaxed luxury lifestyle moment.',
      'Hand adjusting jacket sleeve cuff, revealing watch in a natural, unposed moment. Sophisticated lifestyle editorial. Watch partially emerging from fabric creates anticipation.',
      'Wrist resting on knee in seated pose, watch dial facing outward. Full watch visible — crystal, bezel, bracelet links all sharp. Executive editorial power.',
      'Crossed arms with watch prominently visible on top wrist, facing camera. Power pose, confident direct gaze. Watch as status symbol, editorial authority.',
      'Hand gripping steering wheel or armrest, watch visible at natural wrist angle. Luxury lifestyle context. Watch catches dashboard ambient light.',
      // Lifestyle / context
      'Hand writing with fountain pen on fine paper — watch visible on writing wrist. Intellectual luxury lifestyle. Warm desk lamp lighting on watch crystal.',
      'Wrist resting on balcony railing with city skyline bokeh behind — watch prominent in foreground. Urban luxury. Golden hour backlighting creates warm rim on watch case.',
      'Hand holding espresso cup at café — watch casually visible. European lifestyle editorial. Natural morning light on watch face. Effortless sophistication.',
      'Jacket sleeve pulled back deliberately, wrist raised to display watch — confident, intentional. Studio fashion editorial. Clean background, focused lighting on timepiece.',
      'Hand reaching for car door handle — watch prominent on extended wrist. Dynamic luxury lifestyle. Motion-implied editorial with sharp watch detail.',
    ],
  },
  genel: {
    bodyRegion: 'full portrait',
    poses: [
      'Elegant three-quarter portrait with jewelry as natural complement to minimal styling. Strong posture, confident expression. Jewelry catches light and draws eye naturally.',
      'Editorial fashion pose — angular body position, architectural composition. Jewelry as statement piece creating visual focal point. High-fashion magazine aesthetic.',
      'Soft natural portrait with genuine expression, jewelry adding sophistication. Approachable luxury — like a brand ambassador campaign. Warm, inviting, aspirational.',
      'Dramatic profile silhouette with jewelry catching rim light. Dark background, moody atmosphere. Jewelry creates luminous accent in shadow. Art-house editorial.',
      'Model seated on high stool, relaxed editorial pose — jewelry visible and prominent. Casual luxury lifestyle. Natural posture, confident ease. Studio background.',
      'Walking toward camera with slight motion blur on clothing — jewelry frozen sharp. Dynamic editorial energy. Jewelry as the constant in a world of motion.',
      'Leaning against textured wall, arms relaxed — jewelry catching directional light. Street-style editorial meets luxury. Urban sophistication with natural charm.',
      'Close-up portrait from chest up, minimal background — jewelry framed by clean neckline. Intimate, direct. Jewelry as the primary visual element after the eyes.',
    ],
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════
// PRODUCT IDENTITY CARD (CROSS-IMAGE CONSISTENCY)
// ═══════════════════════════════════════════════════

function buildProductIdentityCard(analysisResult: any): string {
  return `
═══════════════════════════════════════════════════════════════
PRODUCT IDENTITY CARD — THIS JEWELRY MUST LOOK IDENTICAL IN EVERY IMAGE
═══════════════════════════════════════════════════════════════

This is a CROSS-IMAGE CONSISTENCY ANCHOR. The jewelry piece described below
MUST appear IDENTICALLY in this image as in all other images of this set.

TYPE: ${analysisResult.type || 'jewelry'}
${analysisResult.visual_fingerprint ? `FINGERPRINT: ${analysisResult.visual_fingerprint}` : ''}

STONES: Exactly ${analysisResult.structure?.center_stone_count ?? '?'} center + ${analysisResult.structure?.accent_stone_count ?? '0'} accent stones.
DO NOT add, remove, or reposition ANY stone. Count must be EXACT.

PRONGS: Exactly ${analysisResult.structure?.total_prong_count ?? 'as shown'} prongs in ${analysisResult.structure?.prong_style ?? 'original'} style.
DO NOT modify prong count or style.

PROPORTIONS: ${analysisResult.proportions?.length_to_width_ratio ?? '1.0'} L:W ratio, ${analysisResult.proportions?.overall_profile ?? 'standard'} profile.
DO NOT alter proportions. The piece must maintain its EXACT shape.

ANY deviation from this identity card is a CRITICAL ERROR.
═══════════════════════════════════════════════════════════════`.trim();
}

// ═══════════════════════════════════════════════════
// PROMPT BUILDER FUNCTIONS
// ═══════════════════════════════════════════════════

function buildEditorialPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
  identityCard: string,
): string {
  // Category-based selection: each category gets equal chance
  const categories = [...new Set(EDITORIAL_SCENE_POOL.map(s => s.category))];
  const chosenCategory = pickRandom(categories);
  const scenesInCategory = EDITORIAL_SCENE_POOL.filter(s => s.category === chosenCategory);
  const scene = pickRandom(scenesInCategory);
  const lighting = pickRandom(LIGHTING_ANGLES);
  const camera = pickRandom(CAMERA_PERSPECTIVES);

  console.log(`Editorial scene: ${scene.name} [${scene.category}], Lighting: ${lighting.substring(0, 40)}..., Camera: ${camera.substring(0, 30)}...`);

  return `${identityCard}

EDITORIAL / CREATIVE LUXURY JEWELRY PHOTOGRAPHY — Magazine campaign quality, high-fashion editorial.

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
  identityCard: string,
): string {
  return `${identityCard}

E-COMMERCE PROFESSIONAL PRODUCT PHOTOGRAPHY — Clean, commercial, marketplace-ready.

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
  identityCard: string,
): string {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG['genel'];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const skinTone = pickRandom(CHARACTER_SKIN_TONES);
  const hairStyle = pickRandom(CHARACTER_HAIR_STYLES);

  console.log(`Model prompt — Type: ${productType}, Region: ${config.bodyRegion}, Gaze: ${gaze.substring(0, 40)}..., Expression: ${expression.substring(0, 40)}...`);

  return `${identityCard}

EDITORIAL MODEL PHOTOGRAPHY — High-fashion portrait with real human model wearing the jewelry piece.

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

function buildMacroPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
  identityCard: string,
): string {
  return `${identityCard}

MACRO DETAIL PHOTOGRAPHY — Extreme close-up, ultra-high magnification jewelry detail shot.

${productExtractionBlock}

${fidelityBlock}

MACRO APPROACH:
- Full-frame macro at near 1:1 magnification ratio
- Focus on the most visually striking detail area of the piece
- Metal grain texture, prong construction, stone facet detail all visible
- Individual metal surface scratches and tooling marks become visible art

DEPTH OF FIELD:
- Very shallow DOF (f/2.8-4) — only the center detail plane is sharp
- Beautiful bokeh transition from sharp to soft across the piece
- Creates dramatic three-dimensionality

LIGHTING:
- Single focused key light to reveal surface micro-texture
- Dark gradient or black background — no distractions
- Specular highlights on metal edges create luminous outlines
- Stone facets catch individual light points

COMPOSITION:
- The camera is extremely close — filling 90% of frame with detail
- Off-center composition following rule of thirds
- Negative space in dark areas for dramatic contrast

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic macro photography
- Shot on 100mm macro lens with ring light`;
}

function buildFlatLayPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
  identityCard: string,
): string {
  const lifestyleProps = pickRandom([
    'marble tray, dried eucalyptus sprigs, and a folded silk ribbon',
    'linen cloth, fresh white peonies, and a ceramic dish',
    'dark slate board, gold leaf flakes, and velvet pouch',
    'terrazzo surface, dried lavender, and a small perfume bottle',
    'raw wood slice, cotton flowers, and a vintage brass dish',
  ]);

  return `${identityCard}

FLAT LAY STYLING PHOTOGRAPHY — Top-down overhead, lifestyle-curated presentation.

${productExtractionBlock}

${fidelityBlock}

CAMERA:
- Perfect 90° top-down camera angle — absolutely perpendicular to surface
- Product centered in the composition, occupying 40-50% of frame
- Surrounding props arranged in balanced, editorial flat-lay composition

STYLING PROPS:
- ${lifestyleProps}
- Props support the jewelry's luxury aesthetic but never compete
- Careful negative space between elements — airy, not cluttered
- Color palette harmonizes with the jewelry's metal tone

LIGHTING:
- Soft, even overhead lighting with minimal shadows
- Diffused natural daylight quality — bright and airy
- Subtle shadow edges for depth without drama
- Clean, Instagram/Pinterest editorial aesthetic

SURFACE:
- Clean, premium surface as the base layer
- Visible texture adds depth — marble veining, linen weave, wood grain

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic flat-lay photography
- Shot overhead with 35mm lens, even illumination`;
}

function buildDramaticPrompt(
  analysisResult: any,
  fidelityBlock: string,
  productExtractionBlock: string,
  identityCard: string,
): string {
  const dramaticSetup = pickRandom([
    { angle: '15° low angle looking upward', light: 'Single hard spotlight from upper-right, deep shadows on left', mood: 'Chiaroscuro, Rembrandt-inspired' },
    { angle: '20° low angle, slightly off-center', light: 'Rim lighting from behind with warm amber glow, minimal front fill', mood: 'Cinematic noir, mysterious' },
    { angle: '10° low angle, straight-on heroic', light: 'Split lighting — half illuminated in warm gold, half in cool shadow', mood: 'High-fashion editorial drama' },
    { angle: '25° low angle with slight Dutch tilt', light: 'Strong directional beam from upper-left cutting through darkness', mood: 'Art gallery, museum spotlight' },
  ]);

  return `${identityCard}

DRAMATIC ANGLE PHOTOGRAPHY — Low angle, bold directional lighting, powerful presentation.

${productExtractionBlock}

${fidelityBlock}

CAMERA ANGLE:
- ${dramaticSetup.angle}
- Product appears monumental, grand, and imposing
- Perspective distortion adds visual power and presence
- Slight convergence of vertical lines enhances drama

LIGHTING:
- ${dramaticSetup.light}
- Strong contrast ratio — deep blacks and bright highlights coexist
- Light sculpts the form of the jewelry, revealing dimensionality
- Specular highlights on metal are intense but controlled

MOOD:
- ${dramaticSetup.mood}
- Dark, moody atmosphere — background fades to deep black/charcoal
- The jewelry is the only bright element — commanding attention
- Art gallery / auction house / haute-couture campaign presentation

BACKGROUND:
- Deep dark gradient — near-black with subtle tonal variation
- No props, no distractions — pure product hero shot
- Subtle ground reflection or contact shadow for grounding

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic dramatic photography
- Shot on 85mm lens with dramatic studio lighting setup`;
}

function buildStyleTransferPrompt(
  styleAnalysis: StyleReferenceAnalysis | null,
  productType: string | null,
  fidelityBlock: string,
  productExtractionBlock: string,
  identityCard: string,
): string {
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
    removal: 'Remove any existing jewelry from the target body part.',
  };

  // Build conditional blocks from analysis — graceful degrade if null
  const sceneBlock = styleAnalysis ? `
SCENE RECREATION:
- Setting: ${styleAnalysis.scene.setting}
- Background: ${styleAnalysis.scene.background_elements}
- Surface: ${styleAnalysis.scene.surface}
- Time/Season: ${styleAnalysis.scene.season_time}
Recreate this EXACT scene environment.` : '';

  const lightingBlock = styleAnalysis ? `
LIGHTING RECREATION:
- Type: ${styleAnalysis.lighting.type}
- Direction: ${styleAnalysis.lighting.direction}
- Quality: ${styleAnalysis.lighting.quality}
- Color Temperature: ${styleAnalysis.lighting.color_temperature}
Match this EXACT lighting setup.` : '';

  const compositionBlock = styleAnalysis ? `
COMPOSITION RECREATION:
- Framing: ${styleAnalysis.composition.framing}
- Camera Angle: ${styleAnalysis.composition.camera_angle}
- Depth of Field: ${styleAnalysis.composition.depth_of_field}
Match this EXACT camera setup.` : '';

  const modelBlock = styleAnalysis?.model?.present ? `
MODEL RECREATION:
- Pose: ${styleAnalysis.model.pose_description}
- Visible: ${styleAnalysis.model.body_parts_visible}
- Expression: ${styleAnalysis.model.expression_mood}
- Clothing: ${styleAnalysis.model.clothing}
- Skin Tone: ${styleAnalysis.model.skin_tone}
Recreate this model pose and appearance.` : '';

  const moodBlock = styleAnalysis ? `
MOOD & STYLE:
- Atmosphere: ${styleAnalysis.mood.overall_atmosphere}
- Color Palette: ${styleAnalysis.mood.color_palette}
- Style: ${styleAnalysis.mood.style_reference}
- Genre: ${styleAnalysis.mood.editorial_genre}
Match this EXACT mood and color grading.` : '';

  const jewelryRemovalBlock = styleAnalysis?.existing_jewelry?.present ? `
JEWELRY REPLACEMENT:
- Remove existing: ${styleAnalysis.existing_jewelry.description} at ${styleAnalysis.existing_jewelry.location}
- Replace with the product from reference images` : '';

  return `${identityCard}

[STYLE REFERENCE TRANSFER - ANALYZED PRODUCT INJECTION MODE]

⚠️ PRE-PROCESSING: ACCESSORY REMOVAL ⚠️
1. REMOVE all existing jewelry from target: ${selectedPlacement.bodyPart}
2. ${selectedPlacement.removal}
${jewelryRemovalBlock}

IMAGE 1 = STYLE REFERENCE (pose, scene, lighting, atmosphere)
IMAGE 2+ = PRODUCT REFERENCE (jewelry to transfer)

${productExtractionBlock}

${fidelityBlock}
${sceneBlock}
${lightingBlock}
${compositionBlock}
${modelBlock}
${moodBlock}

PRODUCT TYPE: ${productType?.toUpperCase() || 'JEWELRY'}
TARGET: ${selectedPlacement.bodyPart.toUpperCase()}
PLACEMENT: ${selectedPlacement.placement}

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.
Ultra high resolution output.`;
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
  temperature = 0.12,
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
  startTemperature: number = 0.12,
): Promise<string | null> {
  const temperatures = [startTemperature, startTemperature + 0.05, startTemperature + 0.1];
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

// ═══════════════════════════════════════════════════
// STYLE REFERENCE ANALYSIS
// ═══════════════════════════════════════════════════
interface StyleReferenceAnalysis {
  scene: {
    setting: string;
    background_elements: string;
    surface: string;
    season_time: string;
  };
  lighting: {
    type: string;
    direction: string;
    quality: string;
    color_temperature: string;
  };
  composition: {
    framing: string;
    camera_angle: string;
    depth_of_field: string;
  };
  model: {
    present: boolean;
    pose_description: string;
    body_parts_visible: string;
    expression_mood: string;
    clothing: string;
    skin_tone: string;
  };
  mood: {
    overall_atmosphere: string;
    color_palette: string;
    style_reference: string;
    editorial_genre: string;
  };
  existing_jewelry: {
    present: boolean;
    description: string;
    location: string;
  };
}

async function analyzeStyleReference(styleBase64: string): Promise<StyleReferenceAnalysis | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_ANALYSIS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are an expert photography and art director. Analyze this style reference image with extreme precision for the purpose of recreating its visual style in a new jewelry photograph.

Return JSON:
{
  "scene": {
    "setting": "description of the environment/location",
    "background_elements": "key background elements, blurred or sharp",
    "surface": "what surface the subject is on, or 'none' if model wearing",
    "season_time": "time of day, season, weather conditions"
  },
  "lighting": {
    "type": "natural/studio/mixed and specific type",
    "direction": "where light comes from, angle",
    "quality": "hard/soft, diffused, quality description",
    "color_temperature": "warm/cool/neutral with estimated Kelvin"
  },
  "composition": {
    "framing": "tight/medium/wide, what is included in frame",
    "camera_angle": "eye-level/overhead/low-angle with degree estimate",
    "depth_of_field": "shallow/deep with estimated f-stop"
  },
  "model": {
    "present": true/false,
    "pose_description": "detailed pose description if present",
    "body_parts_visible": "which body parts are visible",
    "expression_mood": "facial expression and mood if visible",
    "clothing": "what the model is wearing if present",
    "skin_tone": "skin tone description if visible"
  },
  "mood": {
    "overall_atmosphere": "overall feeling and atmosphere",
    "color_palette": "dominant colors and tones",
    "style_reference": "closest brand campaign or photography style",
    "editorial_genre": "high-fashion/lifestyle/commercial/etc"
  },
  "existing_jewelry": {
    "present": true/false,
    "description": "description of any jewelry visible",
    "location": "where on the body/scene the jewelry is"
  }
}

ONLY valid JSON.`
              },
              { inline_data: { mime_type: 'image/jpeg', data: styleBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        }),
      }
    );

    if (!response.ok) {
      console.error('Style reference analysis API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    console.log('Style reference analysis:', JSON.stringify(result, null, 2));
    return result as StyleReferenceAnalysis;
  } catch (err) {
    console.error('Style reference analysis failed:', err);
    return null;
  }
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

    // Analyze style reference if available
    let styleAnalysis: StyleReferenceAnalysis | null = null;
    if (styleReferenceBase64) {
      console.log('Analyzing style reference...');
      await supabase.from('processing_jobs').update({
        current_step: 'analyzing_style', progress: 12,
      }).eq('id', jobId);
      styleAnalysis = await analyzeStyleReference(styleReferenceBase64);
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
    for (const url of imageUrls) {
      try {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        if (buf.byteLength <= MAX_IMAGE_SIZE) {
          base64Images.push(arrayBufferToBase64(buf));
        } else {
          console.warn(`Skipping image (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB exceeds limit)`);
        }
      } catch (err) {
        console.warn('Failed to fetch image:', err);
      }
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
      "setting": "prong|bezel|channel|pave|tension|cluster|halo",
      "position": "center|side_left|side_right|halo|band|accent|bezel",
      "relative_size": "dominant|medium|small|tiny",
      "facet_count": number,
      "clarity_visible": "eye_clean|included|heavily_included"
    }
  ],
  "structure": {
    "center_stone_count": number,
    "accent_stone_count": number,
    "total_prong_count": number,
    "prong_style": "classic_4|classic_6|shared|cathedral|basket|tension",
    "band_width_mm": number,
    "band_profile": "flat|domed|knife_edge|comfort_fit",
    "shank_design": "plain|split|tapered|twisted|pave_set",
    "gallery_detail": "open|closed|basket|cathedral",
    "setting_height_mm": number
  },
  "proportions": {
    "length_to_width_ratio": number,
    "stone_to_metal_ratio": "stone_dominant|balanced|metal_dominant",
    "overall_profile": "low_set|medium_set|high_set",
    "symmetry_grade": "excellent|very_good|good|fair"
  },
  "surface_details": {
    "engravings": boolean,
    "engraving_description": "description or empty",
    "milgrain": boolean,
    "filigree": boolean,
    "texture_zones": "description of texture variation across the piece",
    "hallmarks_visible": boolean
  },
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
    "estimated_height_mm": number,
    "estimated_depth_mm": number
  },
  "design_elements": {
    "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian|sports|dress",
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "guilloché", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "unique features including brand indicators, logo placement, signature design elements",
  "visual_fingerprint": "2-3 sentences describing what makes this piece UNIQUELY identifiable"
}

CRITICAL: Count EVERY stone precisely. Describe EXACT positions.
For rings: describe the band profile, prong count, gallery style.
For necklaces: describe chain type, pendant attachment, clasp style.
For watches: describe dial indices, hand style, subdial positions.
"visual_fingerprint" should be 2-3 sentences describing what makes this piece
UNIQUELY identifiable — the features that distinguish it from similar pieces.

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

    const stoneDetailBlock = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any, i: number) =>
          `Stone ${i + 1}: ${s.count || 1}x ${s.color || ''} ${s.type || 'gemstone'}, ` +
          `${s.cut || 'round'} cut, ${s.setting || 'prong'} setting, ` +
          `position: ${s.position || 'center'}, ` +
          `relative size: ${s.relative_size || 'medium'}`
        ).join('\n  ')
      : 'No gemstones';

    const structureBlock = analysisResult.structure ? `
STRUCTURAL IDENTITY (MUST BE PRESERVED EXACTLY):
- Center stones: ${analysisResult.structure.center_stone_count ?? 'unknown'}
- Accent stones: ${analysisResult.structure.accent_stone_count ?? 0}
- Total prongs: ${analysisResult.structure.total_prong_count ?? 'standard'}
- Prong style: ${analysisResult.structure.prong_style ?? 'classic'}
- Band: ${analysisResult.structure.band_width_mm ?? '?'}mm ${analysisResult.structure.band_profile ?? 'standard'}
- Shank: ${analysisResult.structure.shank_design ?? 'plain'}
- Gallery: ${analysisResult.structure.gallery_detail ?? 'standard'}` : '';

    const proportionsBlock = analysisResult.proportions ? `
PROPORTIONS (CRITICAL FOR CONSISTENCY):
- L:W ratio: ${analysisResult.proportions.length_to_width_ratio ?? '1.0'}
- Stone/Metal balance: ${analysisResult.proportions.stone_to_metal_ratio ?? 'balanced'}
- Profile height: ${analysisResult.proportions.overall_profile ?? 'medium_set'}
- Symmetry: ${analysisResult.proportions.symmetry_grade ?? 'good'}` : '';

    const surfaceBlock = analysisResult.surface_details ? [
      '\nSURFACE DETAILS (MUST APPEAR IN ALL IMAGES):',
      analysisResult.surface_details.milgrain ? '- Milgrain edge detail PRESENT — must be visible' : '',
      analysisResult.surface_details.filigree ? '- Filigree work PRESENT — must be visible' : '',
      analysisResult.surface_details.engravings ? `- Engraving: ${analysisResult.surface_details.engraving_description}` : '',
      analysisResult.surface_details.texture_zones ? `- Texture: ${analysisResult.surface_details.texture_zones}` : '',
    ].filter(Boolean).join('\n') : '';

    const fingerprintBlock = analysisResult.visual_fingerprint
      ? `\nVISUAL FINGERPRINT (UNIQUE IDENTITY):\n${analysisResult.visual_fingerprint}` : '';

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

DETAILED STONE MAP:
  ${stoneDetailBlock}
${structureBlock}
${proportionsBlock}
${surfaceBlock}
${fingerprintBlock}

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
PROFESSIONAL JEWELRY RETOUCHING — 8-STEP MASTER WORKFLOW
═══════════════════════════════════════════════════════════════

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.

ABSOLUTE PRODUCT INTEGRITY RULES (CRITICAL):
- Do NOT change product geometry, proportions, or scale
- Do NOT add, remove, resize or reshape stones
- Do NOT modify stone count, cut, setting or prong structure
- Do NOT change metal structure, engravings or design language

STEP 1 — DUST & DEFECT REMOVAL
Remove all dust particles, fingerprints, micro-scratches, lint fibers.
Clean sensor spots and environmental contamination. Surface should be immaculate.

STEP 2 — FREQUENCY SEPARATION
Separate texture from color. Preserve real metal grain/texture on high-frequency layer.
Smooth color transitions on low-frequency layer. NO plastic/airbrushed look.

STEP 3 — BACKGROUND ISOLATION
Precision edge masking. Pure white background (RGB 255,255,255).
Sub-pixel edge accuracy. No halo, no fringing, no lost detail at edges.
Preserve fine elements: chain links, prong tips, filigree details.

STEP 4 — COLOR CORRECTION
White balance to D65 (6500K daylight equivalent).
Metal accuracy: yellow gold warm, white gold/platinum cool neutral, rose gold pink-warm.
Stone color: true-to-life saturation, no oversaturation.

STEP 5 — METAL SURFACE REFINEMENT
Remove handling marks. Restore surface uniformity.
Polished: mirror-clean reflections. Matte/brushed: preserve grain direction.
Enhance specular highlights naturally — no HDR artifacts.

STEP 6 — GEMSTONE ENHANCEMENT
Increase facet definition and internal light paths.
Enhance brilliance (white light return), fire (spectral dispersion), scintillation.
Preserve natural inclusions. NO artificial sparkle overlay.

STEP 7 — SHADOW & DIMENSION
Add subtle ground shadow for depth (soft, diffused, 10-15% opacity).
Enhance three-dimensionality through subtle dodge & burn.
Contact shadow where product meets surface.

STEP 8 — FINAL SHARPENING
Selective high-pass sharpening on edges and detail areas.
Avoid sharpening smooth metal surfaces (prevents noise amplification).
Output: commercially clean, catalog-ready image.

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

    } else if (hasStyleReference && styleReferenceBase64 && packageType !== 'standard') {
      // STANDALONE STYLE REFERENCE MODE (non-standard package, 1 image)
      console.log('Standalone style reference generation mode...');

      const identityCard = buildProductIdentityCard(analysisResult);
      const styleTransferPrompt = buildStyleTransferPrompt(styleAnalysis, productType, fidelityBlock, productExtractionBlock, identityCard);

      await supabase.from('processing_jobs').update({ progress: 28 }).eq('id', jobId);
      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      const url = await generateSingleImage(styleTransferImages, styleTransferPrompt, userId, imageRecordId, 1, supabase, jobId, aspectRatio);
      if (url) generatedUrls.push(url);

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

    } else {
      // MASTER PAKET: 6 fundamentally different images
      // 1) Editorial  2) E-Commerce  3) Model  4) Macro  5) Flat Lay  6) Dramatic
      console.log('Master Paket generation (6 images, 4K)...');

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

      const identityCard = buildProductIdentityCard(analysisResult);
      console.log('Product Identity Card:', identityCard);

      const masterSteps = [
        { key: 'editorial', step: 'generating_editorial', label: 'Editorial',
          buildPrompt: () => {
            if (hasStyleReference && styleReferenceBase64) {
              return buildStyleTransferPrompt(styleAnalysis, resolvedProductType, fidelityBlock, productExtractionBlock, identityCard);
            }
            return buildEditorialPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard);
          },
          getImages: (): string[] => {
            if (hasStyleReference && styleReferenceBase64) {
              return [styleReferenceBase64, ...base64Images];
            }
            return base64Images;
          },
          startTemperature: 0.12,
        },
        { key: 'ecommerce', step: 'generating_ecommerce', label: 'E-Commerce',
          buildPrompt: () => buildEcommercePrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard),
          startTemperature: 0.10 },
        { key: 'model', step: 'generating_model', label: 'Model',
          buildPrompt: () => buildModelPrompt(analysisResult, fidelityBlock, productExtractionBlock, resolvedProductType, identityCard),
          startTemperature: 0.12 },
        { key: 'macro', step: 'generating_macro', label: 'Macro Detail',
          buildPrompt: () => buildMacroPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard),
          startTemperature: 0.12 },
        { key: 'flatlay', step: 'generating_flatlay', label: 'Flat Lay',
          buildPrompt: () => buildFlatLayPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard),
          startTemperature: 0.12 },
        { key: 'dramatic', step: 'generating_dramatic', label: 'Dramatic',
          buildPrompt: () => buildDramaticPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard),
          startTemperature: 0.12 },
      ];

      for (let i = 0; i < masterSteps.length; i++) {
        const ms = masterSteps[i];
        console.log(`Generating ${ms.label} image (${i + 1}/${masterSteps.length})...`);

        const startProgress = 25 + (i * 10);
        const endProgress = 35 + (i * 10);

        await supabase.from('processing_jobs').update({
          progress: startProgress,
          current_step: ms.step,
        }).eq('id', jobId);

        const prompt = ms.buildPrompt();
        const images = (ms as any).getImages ? (ms as any).getImages() : base64Images;
        const temperature = (ms as any).startTemperature ?? 0.12;
        const url = await generateSingleImage(images, prompt, userId, imageRecordId, i + 1, supabase, jobId, aspectRatio, temperature);

        if (url) generatedUrls.push(url);

        await supabase.from('processing_jobs').update({
          completed_images: generatedUrls.length,
          current_step: i < masterSteps.length - 1 ? masterSteps[i + 1].step : 'saving',
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
        total_images: 6,
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
