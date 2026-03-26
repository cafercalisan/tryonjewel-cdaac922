// server.ts
import express from "express";

// api/_lib/db.ts
import pg from "pg";
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
});
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});
async function query(text, params) {
  const result = await pool.query(text, params);
  return { rows: result.rows, rowCount: result.rowCount };
}
async function queryOne(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] ?? null;
}

// api/_lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
var MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://localhost:9000";
var MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || "";
var s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin"
  },
  forcePathStyle: true
});
async function uploadFile(bucket, path, body, contentType, upsert = false) {
  try {
    const buffer = body instanceof Buffer ? body : Buffer.from(body);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType
    }));
    return { error: null };
  } catch (err) {
    console.error("Storage upload error:", err?.message || err);
    return { error: { message: err?.message || "Upload failed" } };
  }
}
async function getSignedUrl(bucket, path, expiresIn = 7 * 24 * 60 * 60) {
  try {
    if (MINIO_PUBLIC_ENDPOINT) {
      const publicUrl = `${MINIO_PUBLIC_ENDPOINT}/${bucket}/${path}`;
      return { data: { signedUrl: publicUrl }, error: null };
    }
    const command = new GetObjectCommand({ Bucket: bucket, Key: path });
    const signedUrl = await s3GetSignedUrl(s3, command, { expiresIn });
    return { data: { signedUrl }, error: null };
  } catch (err) {
    console.error("Storage signed URL error:", err?.message || err);
    return { data: null, error: { message: err?.message || "Signed URL failed" } };
  }
}
function getInternalUrl(bucket, path) {
  return `${MINIO_ENDPOINT}/${bucket}/${path}`;
}
async function deleteFile(bucket, path) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
    return { error: null };
  } catch (err) {
    console.error("Storage delete error:", err?.message || err);
    return { error: { message: err?.message || "Delete failed" } };
  }
}

// api/_lib/auth-local.ts
import * as jose from "jose";
import bcrypt from "bcrypt";
var JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-change-me");
var JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me");
var ACCESS_TOKEN_EXPIRY = "1h";
var REFRESH_TOKEN_EXPIRY = "30d";
var BCRYPT_ROUNDS = 12;
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function generateTokens(userId) {
  const accessToken = await new jose.SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ACCESS_TOKEN_EXPIRY).sign(JWT_SECRET);
  const refreshToken = await new jose.SignJWT({ sub: userId, type: "refresh" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(REFRESH_TOKEN_EXPIRY).sign(JWT_REFRESH_SECRET);
  return { accessToken, refreshToken };
}
async function verifyAccessToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
async function verifyRefreshToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_REFRESH_SECRET);
    if (!payload.sub || payload.type !== "refresh") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// api/_lib/auth.ts
async function authenticateUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.slice(7);
  const result = await verifyAccessToken(token);
  if (!result) {
    return { error: "Unauthorized", status: 401 };
  }
  return { userId: result.userId };
}

// api/_lib/cors.ts
var ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
function getOrigin(req) {
  if (!req) return "*";
  const origin = req.headers.origin;
  if (!origin) return "*";
  if (ALLOWED_ORIGINS.length === 0) return "*";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
function handleCors(res, req) {
  const origin = getOrigin(req);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
  res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
  if (origin !== "*") {
    res.setHeader("Vary", "Origin");
  }
  return null;
}
function sendCorsResponse(res, status, body, req) {
  handleCors(res, req);
  res.status(status).json(body);
}

// api/generate-jewelry.ts
var GOOGLE_IMAGE_API_KEY = process.env.GOOGLE_API_KEY;
var ANALYSIS_MODEL = "gemini-3.1-flash-lite-preview";
var IMAGE_GEN_MODEL = "gemini-3.1-flash-image-preview";
async function callGeminiAnalysis(opts) {
  const apiKey = GOOGLE_IMAGE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");
  const parts = [{ text: opts.prompt }];
  if (opts.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: opts.imageBase64
      }
    });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxTokens ?? 2048
    }
  };
  console.log(`Gemini analysis request to ${ANALYSIS_MODEL}...`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini analysis error ${response.status}:`, errText.substring(0, 500));
    throw new Error(`Gemini analysis API error ${response.status}: ${errText.substring(0, 500)}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    console.error("Gemini analysis: no candidates returned", JSON.stringify(data).substring(0, 500));
    throw new Error("Gemini analysis returned no candidates");
  }
  if (candidate.finishReason === "SAFETY") {
    console.error("Gemini analysis: blocked by safety filter");
    throw new Error("Gemini analysis blocked by safety filter");
  }
  const text = candidate.content?.parts?.[0]?.text || "{}";
  console.log(`Gemini analysis response: ${text.length} chars`);
  return text;
}
var MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
var EDITORIAL_SCENE_POOL = [
  // ── Outdoor / Dis Cekim (6) ──
  {
    name: "Golden Hour Rooftop",
    category: "outdoor",
    prompt: "Luxury rooftop terrace at golden hour. City skyline softly blurred in bokeh behind the jewelry. Warm amber directional light from setting sun. Polished stone ledge as placement surface. Cinematic depth, aspirational metropolitan luxury."
  },
  {
    name: "Mediterranean Garden Terrace",
    category: "outdoor",
    prompt: "Olive tree garden terrace in Provence style. Dappled sunlight filtering through leaves creates organic light patterns on the jewelry. Weathered stone table surface. Soft green and warm gold color palette. Editorial travel-luxury atmosphere."
  },
  {
    name: "Beach at Dawn",
    category: "outdoor",
    prompt: "Blue hour beach scene at dawn. Jewelry placed on wet sand with mirror-like reflections. Cool blue-silver atmosphere with first warm light on horizon. Gentle wave traces nearby. Serene, ethereal coastal luxury."
  },
  {
    name: "Autumn Vineyard",
    category: "outdoor",
    prompt: "Vineyard estate during golden hour in autumn. Wine barrel or aged wood surface. Warm amber and burgundy fall foliage softly blurred behind. Rich harvest atmosphere. European heritage luxury editorial."
  },
  {
    name: "Desert Dunes Sunset",
    category: "outdoor",
    prompt: "Desert sand dune at sunset. Jewelry on smooth sand ridge with long dramatic shadows. Warm orange-to-purple gradient sky. Exotic, adventurous luxury. Wind-sculpted sand patterns frame the piece."
  },
  {
    name: "Snow Alpine Morning",
    category: "outdoor",
    prompt: "Crisp alpine winter morning. Jewelry on ice crystal surface with snow-capped mountains in soft focus behind. Pure white and pale blue palette. Sharp cold light with prismatic highlights. Clean, pure winter luxury."
  },
  // ── Luks Reklam Kampanya (6) ──
  {
    name: "Cartier Window Display",
    category: "campaign",
    prompt: "High-end jewelry boutique window display at night. Deep navy blue velvet platform with museum-grade spot lighting. Warm gold accent lights. Dark exterior reflections in glass. Exclusive, prestigious campaign atmosphere."
  },
  {
    name: "Tiffany Blue Perfection",
    category: "campaign",
    prompt: "Pristine white lacquered surface with iconic soft blue gradient backdrop. Perfect three-point studio lighting. Immaculate, minimal, aspirational. Luxury brand campaign precision with zero distractions."
  },
  {
    name: "Van Cleef Garden Fantasy",
    category: "campaign",
    prompt: "Fresh white peony flowers arranged artfully around the jewelry. Sage green watercolor-wash background. Soft diffused natural light. Romantic garden luxury. Poetic, feminine campaign editorial."
  },
  {
    name: "Noir Glamour Campaign",
    category: "campaign",
    prompt: "Single dramatic spotlight on glossy black lacquered surface. Deep chiaroscuro lighting \u2014 jewelry emerges from darkness. Strong contrast, film-noir mood. Bold, seductive luxury campaign."
  },
  {
    name: "Heritage Auction House",
    category: "campaign",
    prompt: "Antique mahogany display with burgundy leather inlay. Gilt gold frame partially visible. Warm museum lighting with focused spot on jewelry. Rich patina, heritage storytelling. Auction house prestige."
  },
  {
    name: "Modern Minimalist Campaign",
    category: "campaign",
    prompt: "Pure white studio cyclorama with three-point professional lighting. Clean infinity curve background. No shadows, no distractions. Surgical precision lighting reveals every facet. Contemporary luxury brand campaign."
  },
  // ── Fashion Editorial (6) ──
  {
    name: "Backstage Fashion Week",
    category: "fashion",
    prompt: "Fashion week backstage styling table. Ring light reflections visible. Raw, energetic atmosphere with hairspray mist in air. Professional chaos aesthetic. Behind-the-scenes editorial energy."
  },
  {
    name: "Editorial Studio Infinity",
    category: "fashion",
    prompt: "Desaturated mauve seamless backdrop. Profoto beauty dish overhead creating soft wraparound light. Minimal styling. High-fashion editorial simplicity with muted color palette. Magazine cover quality."
  },
  {
    name: "Haute Couture Atelier",
    category: "fashion",
    prompt: "Couture atelier cutting table with raw silk organza fabric partially draped nearby. Soft north-facing atelier window light. Pins, thread spools subtly blurred in background. Artisan craftsmanship atmosphere."
  },
  {
    name: "Vogue Still Life",
    category: "fashion",
    prompt: "Moody editorial flat-lay composition with luxury accessories. Dark textured surface. Dramatic overhead spotlight with deep shadows. Art-directed styling with negative space. Magazine spread quality."
  },
  {
    name: "Paris Apartment Morning",
    category: "fashion",
    prompt: "Haussmann-style Parisian apartment. Jewelry on marble mantelpiece. Sheer tulle curtain diffusing soft morning light. Ornate molding softly blurred. Romantic Parisian editorial lifestyle."
  },
  {
    name: "Fashion Film Set",
    category: "fashion",
    prompt: "Cinematic film set atmosphere. Fresnel light beam cutting through atmospheric dust particles. Moody, dramatic. Jewelry catches the focused beam. Behind-the-scenes fashion film production aesthetic."
  },
  // ── Mimari / Ic Mekan (5) ──
  {
    name: "Marble Foyer Grand Entrance",
    category: "architectural",
    prompt: "Grand Calacatta marble foyer. Crystal chandelier creating sparkling highlights overhead. Palatial architecture with arched doorways in soft focus. Warm ambient luxury. Five-star hotel entrance grandeur."
  },
  {
    name: "Art Gallery White Cube",
    category: "architectural",
    prompt: "Contemporary art gallery white plinth display. Track lighting from above creating precise illumination. White cube gallery space. Clean, curated, institutional luxury presentation."
  },
  {
    name: "Luxury Hotel Suite",
    category: "architectural",
    prompt: "Five-star hotel suite marble bathroom counter. Brass vanity lighting casting warm glow. Plush white towels and luxury amenities softly blurred. Intimate luxury lifestyle editorial."
  },
  {
    name: "Boutique Vitrine",
    category: "architectural",
    prompt: "High-end boutique glass display vitrine at night. Black suede platform inside. Exterior street lights creating soft bokeh through glass. Exclusive window shopping moment. Aspirational retail luxury."
  },
  {
    name: "Library Private Collection",
    category: "architectural",
    prompt: "Private library with leather-bound books and dark wood paneling. Brass reading lamp providing warm focused light. Rich intellectual luxury. Old-world sophistication and collector aesthetic."
  },
  // ── Klasik Yuzey (2) ──
  {
    name: "Black Velvet Classic",
    category: "surface",
    prompt: "Placed on rich black velvet fabric with deep texture folds, creating luxurious depth. Soft overhead lighting reveals velvet fiber texture. Dark, moody atmosphere with subtle warm highlights on the jewelry."
  },
  {
    name: "Reflective Black Glass",
    category: "surface",
    prompt: "Displayed on polished black glass surface creating mirror-like reflections of the jewelry. Dramatic rim lighting. Ultra-modern, sleek, high-tech luxury presentation."
  },
  // ── Lüks Doku / Texture (5) ──
  {
    name: "Silk Cascade",
    category: "texture",
    prompt: "Jewelry resting on cascading folds of cream silk fabric, the fabric draping in soft organic waves. Soft diffused overhead light creates delicate shadow-light interplay along the silk curves. Warm champagne and ivory tonal palette. The silk texture is tactile and inviting, creating a bed of luxury. Intimate, sensual, haute couture still life. Shallow depth of field keeps jewelry razor-sharp while silk edges dissolve into creamy bokeh."
  },
  {
    name: "Raw Marble Quarry",
    category: "texture",
    prompt: "Jewelry placed on a raw Calacatta marble block, natural gold veins running through white stone. The marble surface is unpolished on one edge, polished on the placement area. Hard natural daylight from above creates stark shadows. Industrial luxury aesthetic \u2014 raw meets refined. The gold veins in the marble echo and complement the jewelry metal. Museum-quality mineral specimen presentation."
  },
  {
    name: "Liquid Gold Pour",
    category: "texture",
    prompt: "Surreal campaign image: jewelry appears to float on a surface of liquid molten gold. The metallic liquid creates rippling reflections and warm golden light from below. Ultra-luxury, avant-garde advertising aesthetic. The background transitions from liquid gold to deep black. Dramatic rim lighting separates the jewelry from the molten surface. Hyper-real yet dreamlike, high-fashion surrealism."
  },
  {
    name: "Crushed Velvet Midnight",
    category: "texture",
    prompt: "Deep midnight navy-purple crushed velvet fabric beneath the jewelry, the crushed texture creating rich directional light patterns. A single focused spotlight illuminates only the jewelry while the velvet texture falls into dramatic bokeh. Rich, sumptuous, deeply saturated. The velvet fibers catch light at different angles creating a dimensional tapestry of dark luxury. Intimate boudoir campaign aesthetic."
  },
  {
    name: "Petrified Wood Ancient",
    category: "texture",
    prompt: "Jewelry displayed on a cross-section of petrified wood, revealing millions of years of mineralized tree rings in amber, brown, and crystalline patterns. Natural museum lighting from above. The ancient organic texture creates a powerful contrast with the precision-crafted modern jewelry. Natural history museum meets luxury campaign. Earthy, primal, timeless. Warm amber undertones throughout."
  },
  // ── Yaratıcı Konsept / Creative (5) ──
  {
    name: "Underwater Pearl Garden",
    category: "creative",
    prompt: "Ethereal underwater atmosphere surrounding the jewelry. Tiny air bubbles float upward through blue-green water. Scattered sea shells, natural pearls, and smooth ocean pebbles on a sandy bed below. Caustic light patterns dance across the scene from a surface above. Cool blue-green color palette with warm highlights where light hits the jewelry. Dreamlike, poetic, otherworldly luxury. The jewelry appears weightless, suspended in liquid beauty."
  },
  {
    name: "Frozen in Crystal",
    category: "creative",
    prompt: "Jewelry encased in or resting upon crystal-clear ice formations. Arctic blue-white color palette with prismatic light refractions creating rainbow spectra. Frost crystals frame the edges. Cold studio lighting with sharp highlights. The ice surface is cracked and faceted like a giant gemstone. Ultra-clean, pure, winter luxury campaign. Breath-visible cold atmosphere. Sharp contrasts between warm jewelry metal and cold ice environment."
  },
  {
    name: "Volcanic Obsidian",
    category: "creative",
    prompt: "Jewelry placed on glossy black obsidian volcanic glass surface. In the far background, subtle orange-red volcanic glow creates dramatic warm accent light. The obsidian surface has natural conchoidal fracture patterns creating geometric reflections. Extreme contrast between the deep black surface and brilliantly lit jewelry. Primordial luxury \u2014 ancient earth power meets refined craftsmanship. Moody, powerful, elemental."
  },
  {
    name: "Midnight Orchid",
    category: "creative",
    prompt: "Jewelry nestled among dark, almost-black orchid petals. Deep purple-to-black gradients in the botanical elements. Macro-level detail on the orchid textures. A single soft light source from above-left creates intimate, mysterious illumination. Dark botanical luxury \u2014 where nature meets haute joaillerie. Moody, romantic, gothic elegance. Shallow depth of field blurs distant petals into dark velvet bokeh."
  },
  {
    name: "Mercury Mirror",
    category: "creative",
    prompt: "Jewelry on an antique mercury mirror surface creating surreal, slightly distorted silvery-chromatic reflections. The mercury glass has characteristic dark spots and clouding at edges. Cool silver-grey color palette with iridescent highlights. Science-fiction meets haute couture aesthetic. The reflection is imperfect, artistic, haunting. Soft diffused overhead light creates an otherworldly metallic glow. Avant-garde luxury editorial."
  },
  // ── Mimari Statement / Architectural Statement (5) ──
  {
    name: "Brutalist Concrete Gallery",
    category: "architectural_statement",
    prompt: "Jewelry displayed on raw exposed concrete in a brutalist gallery space. Board-formed concrete texture visible on walls. A single dramatic spotlight from above creates a precise circle of light on the jewelry, leaving surrounding concrete in deep shadow. Contemporary art museum aesthetic \u2014 the jewelry as sculptural art object. Minimal, austere, powerful. Cool grey palette with warm light only on the piece."
  },
  {
    name: "Japanese Zen Garden",
    category: "architectural_statement",
    prompt: "Jewelry placed on a smooth river stone within a miniature Japanese zen garden. Raked white sand with precise parallel lines surrounds the stone. Minimalist composition with asymmetric balance. Soft, even natural light suggesting an overcast sky. Meditative calm, wabi-sabi aesthetic. Muted earth tones \u2014 white, grey, subtle green. The simplicity of the setting amplifies the complexity of the jewelry."
  },
  {
    name: "Art Nouveau Greenhouse",
    category: "architectural_statement",
    prompt: "Jewelry placed on a wrought-iron shelf inside an Art Nouveau glass conservatory. Ornate iron scrollwork frames visible. Tropical leaves cast dappled green-filtered shadows. Warm humid atmosphere with slight lens condensation effect at edges. Natural greenhouse light \u2014 bright but diffused through glass panels. Verdant, organic, romantic architectural luxury. The ironwork echoes jewelry craftsmanship."
  },
  {
    name: "Underground Wine Cellar",
    category: "architectural_statement",
    prompt: "Jewelry displayed on aged oak wine barrel surface in a stone-walled wine cellar. Rough-hewn limestone walls with centuries of patina. Warm amber candlelight from multiple points creates rich, dimensional illumination. Oak barrel staves and iron hoops visible. Vintage, heritage, old-world sophistication. Deep warm amber and burgundy color palette. The scent of aged wood and wine implied through visual warmth."
  },
  {
    name: "Floating Glass Platform",
    category: "architectural_statement",
    prompt: "Jewelry on a perfectly clear glass platform that appears to float in mid-air. Below the glass, a dramatic cloudscape or sky gradient is visible, creating a surreal floating-above-clouds illusion. Ultra-modern architectural concept. Clean, precise lighting from multiple angles eliminates shadows on the glass. The jewelry appears suspended in space between earth and sky. Minimalist, futuristic, architectural marvel."
  },
  // ── Sinematik Atmosfer / Cinematic (5) ──
  {
    name: "Film Noir Detective Desk",
    category: "cinematic",
    prompt: "Film noir atmosphere: jewelry on a dark wooden desk in a 1940s detective office. Hard light strips from venetian blinds create dramatic parallel shadow lines across the scene. Cigarette smoke haze in the air catches the light beams. Near-monochromatic palette \u2014 deep blacks, bright whites, minimal warm sepia. Mysterious, atmospheric, storytelling luxury. The jewelry glints in one precise stripe of window light."
  },
  {
    name: "Baroque Opera Box",
    category: "cinematic",
    prompt: "Jewelry placed on the gilded velvet railing of a baroque opera box seat. Rich red velvet upholstery and ornate gold-leaf carved decorations surround the scene. Warm theatrical stage lighting creates a dramatic golden glow from below-left. The opera house interior is visible in soft bokeh beyond. Theatrical, opulent, grandiose. Deep reds and golds dominate. The jewelry belongs to royalty attending opening night."
  },
  {
    name: "Cyberpunk Neon Alley",
    category: "cinematic",
    prompt: "Jewelry on a rain-wet dark surface in a futuristic neon-lit alleyway. Blue, purple, and hot pink neon signs reflect off the wet ground creating colorful light streaks. Atmospheric rain mist catches the neon glow. The jewelry is lit by a precise white spotlight contrasting with the colored neon environment. Blade Runner aesthetic meets luxury advertising. Future-noir, tech-luxury, urban edge."
  },
  {
    name: "Old Hollywood Vanity",
    category: "cinematic",
    prompt: "Jewelry placed on a classic Old Hollywood vanity table. Makeup mirror with exposed warm bulbs creates soft, flattering light. Satin fabric draped nearby. Powder compact and vintage perfume bottles in soft focus background. Golden age glamour \u2014 1950s starlet dressing room. Warm, intimate, nostalgic. Soft-focus glow effect at edges. The jewelry awaits its red carpet moment."
  },
  {
    name: "Eclipse Horizon",
    category: "cinematic",
    prompt: "Cosmic-scale backdrop: jewelry in the foreground with a total solar eclipse visible on the horizon behind. The corona of the eclipse creates a dramatic golden rim-light halo effect that illuminates the jewelry from behind. Deep space-dark sky with the brilliant ring of coronal light. Awe-inspiring, cosmic, once-in-a-lifetime moment. The jewelry is lit by the eclipse corona \u2014 nature's most dramatic lighting. Ultra-dramatic, mythic scale."
  }
];
var COLOR_GRADE_MODIFIERS = {
  outdoor: "COLOR GRADE: Warm natural tones, lifted shadows to deep brown, golden highlights with soft roll-off. Film grain 5%. REFERENCE: Peter Lindbergh outdoor editorial.",
  campaign: "COLOR GRADE: Precise, controlled commercial. Neutral WB with subtle warmth. Pure blacks, clean whites. Zero grain. REFERENCE: Cartier campaign precision.",
  fashion: "COLOR GRADE: Moody editorial desaturation. Cool shadows, warm highlights. Muted except jewelry (full saturation). REFERENCE: Vogue Italia, Steven Meisel.",
  architectural: "COLOR GRADE: Warm amber with cool shadow accents. Rich mid-tones. Subtle vignette. REFERENCE: Architectural Digest meets luxury campaign.",
  surface: "COLOR GRADE: Deep dramatic. Rich blacks with warm undertone. Jewelry brightest element. High contrast, smooth transitions. REFERENCE: Patek Philippe campaign.",
  texture: "COLOR GRADE: Rich material emphasis, tactile quality in lighting. Warm mid-tones with deep shadows revealing fabric/surface texture. Jewelry maintains full brilliance against textured backgrounds. REFERENCE: Celine campaign material study.",
  creative: "COLOR GRADE: Surreal color grading, heightened saturation on jewelry while environment stays dreamlike. Chromatic contrasts between warm jewelry and cool/fantastical surroundings. REFERENCE: Tim Walker meets luxury campaign.",
  architectural_statement: "COLOR GRADE: Geometric light patterns, structural shadows define the space. Precise architectural lighting with warm accents on jewelry. Clean lines, controlled palette. REFERENCE: Tadao Ando concrete meets Bulgari campaign.",
  cinematic: "COLOR GRADE: Film-grade color science, anamorphic lens feel with subtle halation on highlights. Rich shadows, cinematic contrast ratios. Warm practicals, cool ambient. REFERENCE: Roger Deakins meets luxury brand film."
};
var LIGHTING_ANGLES = [
  "Golden hour warm directional light from upper-left (10 o'clock), soft diffused fill",
  "Dramatic rim lighting from behind with subtle front fill, creating luminous edge glow",
  "Overhead butterfly lighting with subtle shadow beneath, classic beauty light setup",
  "Soft 45-degree key light from right with reflector fill, studio portrait style",
  "Cool-toned window light from left side, natural and editorial atmosphere",
  "Low-angle warm light creating long shadows and dramatic depth",
  "Split lighting: half illuminated, half in shadow, high-fashion editorial contrast",
  "Broad soft lighting from both sides with subtle top accent, even luxury illumination"
];
var CAMERA_PERSPECTIVES = [
  "Flat-lay, perfectly top-down 90\xB0 overhead view",
  "45-degree macro angle, shallow depth of field with creamy bokeh",
  "Eye-level straight-on view, product centered in frame",
  "Low-angle looking slightly upward, making the piece appear grand and monumental"
];
var CHARACTER_GAZE = [
  "Direct eye contact with camera \u2014 confident, magnetic, editorial intensity",
  "Looking slightly past camera (10\xB0 off-axis) \u2014 mysterious, editorial detachment",
  "Downcast eyes with subtle smile \u2014 intimate, contemplative luxury moment",
  "Gazing at the jewelry piece with admiration \u2014 drawing viewer attention to product",
  "Three-quarter profile gaze toward soft light source \u2014 cinematic, painterly",
  "Eyes closed, serene expression \u2014 meditative, haute-couture editorial stillness"
];
var CHARACTER_EXPRESSIONS = [
  "Confident and poised \u2014 strong jawline, relaxed brow, slight knowing smile",
  "Softly sensual \u2014 parted lips, relaxed gaze, effortless allure",
  "Editorial stoic \u2014 neutral expression, high-fashion detachment, angular features",
  "Warm and natural \u2014 genuine soft smile, crow's feet visible, approachable luxury",
  "Regal and commanding \u2014 chin slightly raised, strong posture, aristocratic bearing",
  "Dreamy and ethereal \u2014 soft focus expression, luminous skin, romantic atmosphere"
];
var OUTFIT_POOL = [
  {
    name: "Power Tailoring",
    description: "Oversized blazer in neutral tone over silk camisole, tailored wide-leg trousers. Sharp shoulders, clean lines.",
    colorPalette: "Charcoal, navy, camel, ivory, black",
    fabrics: "Wool crepe blazer, silk charmeuse camisole, pressed wool trousers",
    neckline: "Deep V from blazer lapels revealing camisole \u2014 ideal for necklace visibility",
    sleeveType: "Long blazer sleeves, slightly pushed up at forearm \u2014 wrist partially exposed for bracelet/watch",
    accessoryNotes: "Structured leather clutch or no bag. No scarf. Minimal.",
    bestFor: ["kolye", "kupe", "saat", "bileklik"]
  },
  {
    name: "Mediterranean Luxe",
    description: "Flowing linen blouse with relaxed drape, wide-leg palazzo trousers or midi skirt. Effortless summer elegance.",
    colorPalette: "White, sand, terracotta, olive, soft gold",
    fabrics: "Washed linen, raw silk, light cotton voile",
    neckline: "Open collar or boat neck \u2014 d\xE9colletage visible for necklace display",
    sleeveType: "Rolled-up or three-quarter sleeves \u2014 full wrist exposure",
    accessoryNotes: "Woven straw bag, tortoiseshell sunglasses pushed up on head",
    bestFor: ["kolye", "bileklik", "yuzuk", "kupe"]
  },
  {
    name: "Evening Minimalist",
    description: "One-shoulder or strapless column dress in solid color. Floor-length, body-skimming silhouette. Architectural simplicity.",
    colorPalette: "Black, midnight navy, champagne, deep burgundy, emerald",
    fabrics: "Silk crepe, satin, structured jersey",
    neckline: "One-shoulder or strapless \u2014 maximum neck/ear/d\xE9colletage exposure",
    sleeveType: "Sleeveless or one-shoulder \u2014 arms fully exposed for bracelet/watch display",
    accessoryNotes: "No bag visible. No scarf. Dress is the canvas, jewelry is the art.",
    bestFor: ["kupe", "kolye", "bileklik", "yuzuk"]
  },
  {
    name: "Street Luxe Editorial",
    description: "Fitted leather jacket over black turtleneck, slim tailored trousers, ankle boots. Urban edge meets luxury.",
    colorPalette: "Black, charcoal, burgundy, dark chocolate",
    fabrics: "Soft leather, fine merino wool turtleneck, stretch wool trousers",
    neckline: "High turtleneck \u2014 frames face for earring focus, no necklace competition",
    sleeveType: "Jacket sleeves ending at wrist \u2014 watch/bracelet peek from cuff",
    accessoryNotes: "Structured leather ankle boots, no bag visible in frame",
    bestFor: ["kupe", "saat", "yuzuk"]
  },
  {
    name: "White Canvas",
    description: "Crisp white button-down shirt (top 2 buttons open) tucked into classic indigo jeans. Timeless, clean backdrop for any jewelry.",
    colorPalette: "Pure white, classic indigo denim",
    fabrics: "Crisp cotton poplin shirt, premium denim",
    neckline: "Open collar V \u2014 versatile for necklaces, shows collarbone for earring context",
    sleeveType: "Sleeves rolled to mid-forearm \u2014 ideal wrist exposure",
    accessoryNotes: "Simple leather belt. No other accessories competing with jewelry.",
    bestFor: ["kolye", "kupe", "yuzuk", "bileklik", "saat", "genel"]
  }
];
var CHARACTER_PERSONAS = [
  {
    name: "Defne Aydin",
    age: 27,
    heritage: "Turkish-Mediterranean",
    skinTone: "Olive gold",
    skinUndertone: "warm",
    hairColor: "Dark chestnut with honey highlights",
    hairTexture: "waves",
    hairSignature: "Loose cascading waves with sun-kissed honey highlights",
    eyeColor: "Amber-brown",
    faceShape: "Oval with elegant jawline",
    bodyType: "Slim-athletic",
    height: "175cm",
    signatureLook: "Cartier & Bulgari campaign warmth",
    fashionVibe: "Mediterranean luxury, warm golden tones",
    bestFor: ["yuzuk", "kolye", "kupe"],
    postureLanguage: "Spine elongated, shoulders pulled back and dropped \u2014 like a dancer. Weight shifted to one hip creating S-curve. Chin naturally elevated 5 degrees.",
    editorialEnergy: "Quiet Mediterranean confidence \u2014 she does not SEEK attention, she RECEIVES it. Every movement unhurried, deliberate, warm.",
    signatureMannerism: "One hand always finds a surface or body contact \u2014 collarbone, railing, hair. Never both hands idle.",
    outfitArchetype: "Structured blazer over silk camisole OR tailored linen separates.",
    outfitPalette: "Warm neutrals: camel, ivory, terracotta, olive. One accent in burgundy or forest green.",
    accessoryStyle: "Oversized tortoiseshell sunglasses, structured leather bag in cognac or black",
    fabricPreference: "Silk, linen, cashmere, fine leather \u2014 natural fibers catching light with organic texture",
    editorialReference: "Pamela Hanson for Vogue Travel, Mario Testino Gucci campaigns",
    strengthAsModel: "Skin catches golden hour light like bronze. Natural warmth makes jewelry feel personal, not staged."
  },
  {
    name: "Elif Kara",
    age: 24,
    heritage: "Turkish-Anatolian",
    skinTone: "Fair porcelain",
    skinUndertone: "cool pink",
    hairColor: "Jet black",
    hairTexture: "straight sleek",
    hairSignature: "Perfectly sleek straight hair with mirror-like shine",
    eyeColor: "Green-hazel",
    faceShape: "Heart-shaped",
    bodyType: "Slim",
    height: "178cm",
    signatureLook: "Chanel haute couture editorial",
    fashionVibe: "Cool-toned elegance, high-fashion precision",
    bestFor: ["kupe", "kolye", "saat"],
    postureLanguage: "Military-precise posture softened by a slight forward lean. Shoulders blade-sharp. Weight centered, balletic stillness.",
    editorialEnergy: "Ice-cool haute couture detachment \u2014 the kind of beauty that makes people nervous. Zero wasted movement.",
    signatureMannerism: "Chin micro-tilt downward before looking up through lashes \u2014 creates dramatic reveal moments.",
    outfitArchetype: "Minimalist column dress OR sharp black turtleneck with tailored trousers.",
    outfitPalette: "Black, white, charcoal, midnight navy. No warm tones.",
    accessoryStyle: "Geometric structured clutch in black patent, no sunglasses \u2014 her eyes are the accessory",
    fabricPreference: "Heavy silk crepe, cashmere, structured wool, Japanese denim \u2014 architectural fabrics",
    editorialReference: "Karl Lagerfeld Chanel campaigns, Peter Lindbergh monochrome portraits",
    strengthAsModel: "Porcelain skin creates maximum contrast with jewelry metals. Green-hazel eyes add unexpected warmth to cool styling."
  },
  {
    name: "Zeynep Demir",
    age: 30,
    heritage: "Turkish-Aegean",
    skinTone: "Warm honey-tan",
    skinUndertone: "golden",
    hairColor: "Rich dark brown",
    hairTexture: "loose waves",
    hairSignature: "Voluminous loose waves with natural movement",
    eyeColor: "Deep brown",
    faceShape: "Angular diamond with high cheekbones",
    bodyType: "Proportional",
    height: "173cm",
    signatureLook: "Piaget & Van Cleef warmth",
    fashionVibe: "Warm approachable luxury, natural radiance",
    bestFor: ["bileklik", "yuzuk", "genel"],
    postureLanguage: "Relaxed but present \u2014 like someone who just finished yoga and put on couture. Core engaged, limbs soft.",
    editorialEnergy: "Approachable luxury \u2014 the woman at the gala you actually want to talk to. Warm, grounded, real.",
    signatureMannerism: "Unconsciously rotates rings or touches bracelets \u2014 creates organic jewelry interaction on camera.",
    outfitArchetype: "Flowing Mediterranean linen separates OR cashmere wrap with wide trousers.",
    outfitPalette: "Sand, honey, soft gold, warm white, muted terracotta.",
    accessoryStyle: "Woven leather sandals, simple gold-frame sunglasses, canvas tote in natural tones",
    fabricPreference: "Washed linen, soft cashmere, raw silk \u2014 fabrics that move and breathe",
    editorialReference: "Cass Bird natural light portraits, Inez & Vinoodh for Van Cleef & Arpels",
    strengthAsModel: "High cheekbones create beautiful shadow play. Hands are particularly photogenic \u2014 ideal for ring/bracelet work."
  },
  {
    name: "Selin Ozturk",
    age: 26,
    heritage: "Turkish-Balkan",
    skinTone: "Light olive",
    skinUndertone: "neutral",
    hairColor: "Dark auburn",
    hairTexture: "structured updo",
    hairSignature: "Architecturally structured updo revealing neck and ears",
    eyeColor: "Hazel with gold flecks",
    faceShape: "Square jawline, strong features",
    bodyType: "Athletic",
    height: "176cm",
    signatureLook: "Tom Ford & Saint Laurent edge",
    fashionVibe: "Sharp editorial power, modern edge",
    bestFor: ["saat", "bileklik", "yuzuk"],
    postureLanguage: "Shoulders squared, spine steel-straight. Occupies space unapologetically. Athletic tension visible in forearms.",
    editorialEnergy: "Corporate power meets fashion edge \u2014 she just closed a deal and walked onto set without breaking stride.",
    signatureMannerism: "Adjusts watch or cuff instinctively \u2014 executive gesture that creates natural product interaction.",
    outfitArchetype: "Sharp leather jacket over turtleneck OR power-cut blazer with slim trousers.",
    outfitPalette: "Black, charcoal, burgundy, dark olive. Maximum contrast.",
    accessoryStyle: "Structured leather portfolio, no-nonsense ankle boots, thin leather belt",
    fabricPreference: "Butter-soft leather, heavy silk, structured wool gabardine \u2014 power fabrics",
    editorialReference: "Tom Ford campaign precision, Hedi Slimane Saint Laurent edge",
    strengthAsModel: "Strong jawline and architectural updo create perfect frame for earrings. Athletic wrists ideal for watch/bracelet shots."
  },
  {
    name: "Naz Yilmaz",
    age: 32,
    heritage: "Turkish-Persian",
    skinTone: "Rich warm olive",
    skinUndertone: "deep golden",
    hairColor: "Black voluminous",
    hairTexture: "wavy",
    hairSignature: "Full voluminous black waves with dramatic body",
    eyeColor: "Dark brown",
    faceShape: "Oval, soft features",
    bodyType: "Curvy-proportional",
    height: "170cm",
    signatureLook: "Dolce & Gabbana Mediterranean glam",
    fashionVibe: "Rich, sensual Mediterranean glamour",
    bestFor: ["kolye", "kupe", "genel"],
    postureLanguage: "Languid, feline grace. Head often tilted 10 degrees. Weight on back foot creating elongated silhouette despite shorter height.",
    editorialEnergy: "Sensual Mediterranean warmth \u2014 like a Fellini actress between takes. Magnetic, unhurried, deeply present.",
    signatureMannerism: "Runs fingers through voluminous hair \u2014 creates dramatic movement and reveals earrings naturally.",
    outfitArchetype: "Evening column dress with one shoulder OR flowing silk wrap dress.",
    outfitPalette: "Deep burgundy, emerald, black, champagne gold. Rich jewel tones.",
    accessoryStyle: "Vintage-style evening clutch, silk hair clip, delicate wrist scarf",
    fabricPreference: "Heavy silk satin, velvet, fine jersey \u2014 fabrics that drape around curves",
    editorialReference: "Dolce & Gabbana Alta Moda campaigns, Paolo Roversi soft focus portraits",
    strengthAsModel: "Voluminous hair creates dramatic frame for earring/necklace shots. Deep skin tone makes gold jewelry glow."
  },
  {
    name: "Ceren Aksoy",
    age: 25,
    heritage: "Turkish-Circassian",
    skinTone: "Fair luminous",
    skinUndertone: "warm peach",
    hairColor: "Platinum-highlighted brown",
    hairTexture: "tousled",
    hairSignature: "Effortlessly tousled platinum-highlighted waves",
    eyeColor: "Blue-grey",
    faceShape: "High cheekbones, delicate features",
    bodyType: "Slim",
    height: "177cm",
    signatureLook: "Dior & Tiffany ethereal",
    fashionVibe: "Ethereal, dreamlike, luminous beauty",
    bestFor: ["kupe", "kolye", "yuzuk"],
    postureLanguage: "Weightless, floating quality \u2014 as if gravity is optional. Shoulders naturally dropped, neck impossibly long.",
    editorialEnergy: "Dreamy ethereal presence \u2014 she exists slightly outside of time. Romantic without being soft, delicate without being fragile.",
    signatureMannerism: "Looks away then slowly turns toward camera \u2014 creates cinematic reveal moments for jewelry.",
    outfitArchetype: "Sheer layered blouse over camisole OR ethereal midi dress with delicate straps.",
    outfitPalette: "Ivory, blush, pale grey, soft lavender, champagne. Pastel luminosity.",
    accessoryStyle: "Silk ribbon in hair, vintage porcelain-handle clutch, pearl hair pins",
    fabricPreference: "Silk organza, chiffon, fine lace, soft tulle \u2014 transparent and light-catching fabrics",
    editorialReference: "Tim Walker fantasy editorials, Dior J'adore campaign romanticism",
    strengthAsModel: "Luminous fair skin makes diamonds and white gold sparkle. Blue-grey eyes create otherworldly contrast with warm gold jewelry."
  },
  {
    name: "Asli Korkmaz",
    age: 29,
    heritage: "Turkish-Kurdish",
    skinTone: "Medium-tan",
    skinUndertone: "warm caramel",
    hairColor: "Very dark brown",
    hairTexture: "slicked-back",
    hairSignature: "Sleek slicked-back hair emphasizing strong bone structure",
    eyeColor: "Brown-amber",
    faceShape: "Strong angular, defined jawline",
    bodyType: "Athletic-slim",
    height: "174cm",
    signatureLook: "Versace & Boucheron power",
    fashionVibe: "Powerful, commanding, bold luxury",
    bestFor: ["saat", "bileklik", "genel"],
    postureLanguage: "Commanding stillness. Chin level, gaze direct. Stands like a monument \u2014 completely motionless, completely present.",
    editorialEnergy: "Raw power channeled through stillness \u2014 like a panther at rest. Intensity without aggression.",
    signatureMannerism: "Crosses arms with one wrist forward \u2014 naturally showcases watch/bracelet with authority.",
    outfitArchetype: "All-black power ensemble \u2014 sharp blazer, silk shirt, tailored trousers.",
    outfitPalette: "Black, deep charcoal, midnight. Monochromatic power.",
    accessoryStyle: "Structured leather briefcase-style bag, minimal pointed-toe heels",
    fabricPreference: "Matte black wool, heavy silk charmeuse, structured leather \u2014 zero-sheen power fabrics",
    editorialReference: "Versace Medusa campaigns, Mert & Marcus high-contrast editorial",
    strengthAsModel: "Slicked-back hair fully exposes ears and neck \u2014 ideal for earring/necklace drama. Strong bone structure creates editorial shadow play."
  },
  {
    name: "Ipek Sahin",
    age: 28,
    heritage: "Turkish-Levantine",
    skinTone: "Medium olive",
    skinUndertone: "neutral-warm",
    hairColor: "Dark brown",
    hairTexture: "side-parted elegant",
    hairSignature: "Elegant side-parted dark brown with soft drape",
    eyeColor: "Warm brown",
    faceShape: "Soft round, gentle features",
    bodyType: "Proportional",
    height: "171cm",
    signatureLook: "Chopard & Bvlgari classic",
    fashionVibe: "Timeless classic elegance, refined warmth",
    bestFor: ["yuzuk", "kolye", "bileklik", "genel"],
    postureLanguage: "Classic elegance \u2014 spine straight but not stiff, shoulders relaxed, hands always graceful. Old-money posture.",
    editorialEnergy: "Timeless sophistication \u2014 she could be in a 1960s Audrey Hepburn scene or a 2026 Chopard campaign. Era-transcendent.",
    signatureMannerism: "Delicately touches pendant or necklace while thinking \u2014 creates intimate jewelry interaction.",
    outfitArchetype: "Classic white button-down with premium denim OR simple cashmere turtleneck with midi skirt.",
    outfitPalette: "Cream, navy, camel, soft grey, white. Classic neutrals.",
    accessoryStyle: "Vintage-style leather handbag, silk neck scarf (when no necklace), classic pumps",
    fabricPreference: "Fine cotton poplin, premium cashmere, brushed wool, classic leather \u2014 heritage fabrics",
    editorialReference: "Chopard Red Carpet campaigns, Irving Penn classic portraits",
    strengthAsModel: "Gentle features make jewelry the star. Neutral-warm skin flatters every metal color equally. Versatile across all jewelry types."
  }
];
var PRODUCT_TYPE_MODEL_CONFIG = {
  yuzuk: {
    bodyRegion: "hand and fingers",
    poses: [
      // Classic editorial
      "Model's hand gracefully touching collarbone, ring prominently visible on finger. Fingers slightly spread for clarity. Natural hand curvature, visible knuckle detail, elegant wrist angle.",
      "Hand gently framing face near jawline, ring in razor-sharp focus. Ring finger positioned at eye-level. Dreamy expression with soft eye contact. Skin texture visible on fingers.",
      "Hand running through tousled hair, ring catching a spark of light. Candid editorial moment frozen in time. Natural finger spacing shows ring from optimal angle.",
      "Both hands together near chin in contemplative pose, ring as absolute centerpiece. Interlocked fingers create elegant geometry. Ring positioned toward camera for maximum visibility.",
      "Hand resting on bare shoulder, ring visible against luminous skin. Three-quarter profile with chin slightly raised. Ring catches rim light creating a golden highlight.",
      "Hand elegantly draped over the edge of a dark surface, fingers cascading downward, ring catching dramatic side-light. Architectural hand pose, editorial precision.",
      "Model examining the ring on her own hand at close range \u2014 intimate, admiring moment. Ring is the sharp focus point. Background softly blurred.",
      // Artistic / avant-garde
      "Hand pressing against frosted glass \u2014 ring prominent against diffused backlight. Ethereal, artistic atmosphere. Fingers spread for maximum ring visibility.",
      "Fingers interlaced with fresh flowers \u2014 ring as organic jewelry-nature contrast. Botanical editorial styling. Ring catches natural light among petals.",
      "Hand emerging from dark water surface \u2014 ring catching first light, dramatic. Only hand and wrist visible above water line. Cinematic editorial moment.",
      "Palm open, fingers spread wide, ring catching overhead spotlight \u2014 editorial power pose. Strong geometric hand shape. Ring as the focal anchor of the composition.",
      "Hand resting on vintage leather-bound book spine \u2014 ring as intellectual luxury accent. Warm amber tones. Scholarly, refined atmosphere."
    ]
  },
  bileklik: {
    bodyRegion: "wrist",
    poses: [
      // Classic editorial
      "Wrist resting elegantly on a marble surface, bracelet draped naturally with golden catch-light. Relaxed confidence, fingers slightly curled. Bracelet chain follows wrist contour perfectly.",
      "Arm raised with hand in hair, bracelet sliding naturally on wrist. Gravity pulls bracelet to optimal viewing angle. Light catches each link/stone. Editorial movement frozen.",
      "Both wrists crossed casually at collarbone level, bracelet as focal point. One wrist stacked, editorial symmetry. Bracelet creates visual anchor.",
      "Hand touching neckline from below, wrist and bracelet naturally framed against d\xE9colletage. Bracelet catches warm skin-reflected light. Intimate gesture.",
      "Wrist extended gracefully forward toward camera, bracelet in sharp macro focus. Arm angle creates depth. Background model face softly blurred. Product hero shot.",
      "Forearm resting on knee in seated editorial pose, bracelet centered in frame. Natural wrist angle, visible skin texture around bracelet. Sophisticated luxury moment.",
      // Dynamic / lifestyle
      "Hand reaching for a champagne flute on a marble counter \u2014 bracelet sliding toward wrist bone. Candid luxury lifestyle moment. Warm golden hour lighting.",
      "Arms stretched overhead in a ballet-inspired pose \u2014 bracelet catching overhead stage lighting. Artistic, movement-inspired editorial. Graceful arm lines.",
      "Wrist draped over the arm of a velvet chair \u2014 bracelet dangling with gravity. Relaxed elegance. Side lighting creates golden rim on bracelet links.",
      "Hand adjusting sunglasses on top of head \u2014 wrist fully exposed, bracelet prominent. Casual luxury, resort editorial aesthetic. Natural outdoor light.",
      "Forearm resting on a window ledge with soft natural light streaming in \u2014 bracelet glowing in warm daylight. Contemplative, intimate morning moment."
    ]
  },
  kupe: {
    bodyRegion: "ear and profile",
    poses: [
      // Classic editorial
      "Pure side profile with hair swept completely behind ear. Earring fully visible from lobe to lowest point. Clean jawline, neck elongated. Earring catches dramatic rim light. Magazine cover composition.",
      "Three-quarter view looking over shoulder, earring prominent against neck silhouette. Chin slightly raised. Earring creates elegant line from ear to shoulder. Mysterious editorial gaze.",
      "Head tilted 15\xB0 toward camera, earring swaying with captured micro-movement. Natural motion blur on hair tips, earring frozen sharp. Editorial action moment.",
      "Profile with chin raised at 20\xB0, earring creating sculptural silhouette against negative space. Strong jawline emphasized. Architectural, fashion-forward composition.",
      "Hair swept up in elegant chignon, both earrings visible from frontal three-quarter angle. Neck fully exposed. Earrings frame the face symmetrically. Classic portrait.",
      "Close-up profile from behind, showing ear and earring with shoulder and neck. Hair pulled to opposite side. Intimate, revealing angle that showcases earring construction.",
      // Intimate / artistic
      "Model laughing naturally with head tilted \u2014 earring caught in mid-swing. Joy and movement captured. Earring creates dynamic arc of light. Candid editorial warmth.",
      "Extreme close-up of ear and jawline only \u2014 earring filling the frame. Skin texture, ear lobe detail visible. Macro-portrait hybrid. Intimate product showcase.",
      "Model with wet hair slicked back after rain \u2014 earring stark against glistening skin. Dramatic, fashion-forward. High-contrast editorial with water droplet details.",
      "Hand tucking hair behind ear, revealing earring in a natural gesture. Earring just coming into view. Authentic, unposed moment. Soft editorial lighting.",
      "Model resting chin on palm, face at three-quarter angle \u2014 earring framed between jawline and shoulder. Thoughtful expression. Earring catches warm side light."
    ]
  },
  kolye: {
    bodyRegion: "neck and d\xE9colletage",
    poses: [
      // Classic editorial
      "Straight-on d\xE9colletage view, necklace centered on chest. Clean neckline \u2014 off-shoulder or strapless to maximize visibility. Pendant rests at natural drape point. Even skin tone, collar bones visible.",
      "Slight head tilt with eyes lowered toward necklace, creating viewer's gaze path from face to product. Soft smile. Necklace draping naturally following gravity. Warm editorial portrait.",
      "Profile view showing necklace chain line flowing along neck curve. Artistic negative space composition. Chain catches light creating a golden path. Sculptural beauty.",
      "Looking directly at camera, chin slightly lowered, necklace pendant catching spotlight. Intimate eye contact draws viewer in, then gaze falls to jewelry. Power editorial.",
      "Three-quarter view with one hand delicately touching pendant \u2014 drawing attention to it. Fingers gentle, not gripping. Natural interaction between model and jewelry.",
      "Head thrown back slightly with closed eyes, necklace displayed on elongated neck. Sensual, luxury fragrance campaign aesthetic. Necklace catches overhead light beautifully.",
      // Movement / dynamic
      "Model mid-turn, hair flying \u2014 necklace catching light in motion. Dynamic editorial energy. Necklace chain creates elegant arc. Sharp focus on jewelry amid movement.",
      "Looking over bare shoulder, necklace clasp and back chain visible. Unusual perspective showing craftsmanship from behind. Intimate, fashion-editorial angle.",
      "Model leaning forward slightly, pendant hanging free from chest \u2014 gravity creates beautiful drape. Necklace swinging gently. Three-dimensional depth showcase.",
      "Standing in doorframe silhouette, necklace catching the only light source. Dramatic chiaroscuro. Necklace is the brightest element in the composition.",
      "Hands clasped behind neck, elbows out \u2014 necklace displayed on fully open d\xE9colletage. Athletic yet elegant. Strong, confident body language."
    ]
  },
  saat: {
    bodyRegion: "wrist",
    poses: [
      // Classic editorial
      "Wrist check pose \u2014 glancing at watch face with quiet confidence. Business editorial. Watch dial readable, crystal catching overhead light. Subtle smile of satisfaction.",
      "Forearm resting on dark wood surface, watch dial angled toward camera for maximum readability. Crown and pushers visible. Relaxed luxury lifestyle moment.",
      "Hand adjusting jacket sleeve cuff, revealing watch in a natural, unposed moment. Sophisticated lifestyle editorial. Watch partially emerging from fabric creates anticipation.",
      "Wrist resting on knee in seated pose, watch dial facing outward. Full watch visible \u2014 crystal, bezel, bracelet links all sharp. Executive editorial power.",
      "Crossed arms with watch prominently visible on top wrist, facing camera. Power pose, confident direct gaze. Watch as status symbol, editorial authority.",
      "Hand gripping steering wheel or armrest, watch visible at natural wrist angle. Luxury lifestyle context. Watch catches dashboard ambient light.",
      // Lifestyle / context
      "Hand writing with fountain pen on fine paper \u2014 watch visible on writing wrist. Intellectual luxury lifestyle. Warm desk lamp lighting on watch crystal.",
      "Wrist resting on balcony railing with city skyline bokeh behind \u2014 watch prominent in foreground. Urban luxury. Golden hour backlighting creates warm rim on watch case.",
      "Hand holding espresso cup at caf\xE9 \u2014 watch casually visible. European lifestyle editorial. Natural morning light on watch face. Effortless sophistication.",
      "Jacket sleeve pulled back deliberately, wrist raised to display watch \u2014 confident, intentional. Studio fashion editorial. Clean background, focused lighting on timepiece.",
      "Hand reaching for car door handle \u2014 watch prominent on extended wrist. Dynamic luxury lifestyle. Motion-implied editorial with sharp watch detail."
    ]
  },
  genel: {
    bodyRegion: "full portrait",
    poses: [
      "Elegant three-quarter portrait with jewelry as natural complement to minimal styling. Strong posture, confident expression. Jewelry catches light and draws eye naturally.",
      "Editorial fashion pose \u2014 angular body position, architectural composition. Jewelry as statement piece creating visual focal point. High-fashion magazine aesthetic.",
      "Soft natural portrait with genuine expression, jewelry adding sophistication. Approachable luxury \u2014 like a brand ambassador campaign. Warm, inviting, aspirational.",
      "Dramatic profile silhouette with jewelry catching rim light. Dark background, moody atmosphere. Jewelry creates luminous accent in shadow. Art-house editorial.",
      "Model seated on high stool, relaxed editorial pose \u2014 jewelry visible and prominent. Casual luxury lifestyle. Natural posture, confident ease. Studio background.",
      "Walking toward camera with slight motion blur on clothing \u2014 jewelry frozen sharp. Dynamic editorial energy. Jewelry as the constant in a world of motion.",
      "Leaning against textured wall, arms relaxed \u2014 jewelry catching directional light. Street-style editorial meets luxury. Urban sophistication with natural charm.",
      "Close-up portrait from chest up, minimal background \u2014 jewelry framed by clean neckline. Intimate, direct. Jewelry as the primary visual element after the eyes."
    ]
  }
};
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickOutfitForProduct(productType) {
  const matching = OUTFIT_POOL.filter((o) => o.bestFor.includes(productType));
  if (matching.length > 0) return pickRandom(matching);
  return pickRandom(OUTFIT_POOL);
}
function buildOutfitBlock(outfit) {
  return `
OUTFIT \u2014 ${outfit.name.toUpperCase()}:
- ${outfit.description}
- Color Palette: ${outfit.colorPalette}
- Fabrics: ${outfit.fabrics}
- Neckline: ${outfit.neckline}
- Sleeves: ${outfit.sleeveType}
- Accessories: ${outfit.accessoryNotes}`;
}
var EDITORIAL_ENERGY_DIRECTIVE = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
EDITORIAL ENERGY DIRECTIVE (MANDATORY FOR ALL MODEL SHOTS)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
- Model is NOT posing for a photo. She is EXISTING in a moment that happens to be photographed.
- Body tension: 30% \u2014 not rigid, not collapsed. Like someone who just sat down at a beautiful restaurant.
- Every gesture has INTENTION \u2014 touching face because thinking, not because directed.
- Weight distribution NATURAL \u2014 one hip bears more weight, organic S-curve.
- Spine LONG \u2014 string pulling gently from crown.
- Shoulders DOWN and BACK \u2014 never hunched, never military-stiff.
- Jaw RELAXED \u2014 mouth naturally closed or barely parted.
- Eyes have DEPTH \u2014 thinking about something specific, not staring at lens.
- Overall impression: "This person has somewhere important to be after this photo."
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`;
async function enhanceScenePrompt(templatePrompt, analysisResult, sceneType) {
  try {
    const prompt = `You are a world-class luxury jewelry photography art director. Your task is to enhance and optimize an image generation prompt for a jewelry piece.

RULES:
- Keep ALL existing product identity, fidelity constraints, and technical specs EXACTLY as they are
- NEVER modify product description, stone counts, prong counts, metal details, or any identity card content
- ONLY enhance: scene description, lighting details, mood, creative direction, color grading, and composition guidance
- Add specific, vivid sensory details that make the scene feel cinematic and real
- Add lighting nuances based on the jewelry's metal type and stone characteristics
- Suggest specific color harmonies between the jewelry and the scene/background
- Keep the output as a single enhanced prompt text \u2014 same format, just richer and more detailed
- Output ONLY the enhanced prompt as a JSON object: {"enhanced_prompt": "..."}
- Keep it under 2000 words

Scene type: ${sceneType}

Jewelry analysis summary:
- Type: ${analysisResult.type || "jewelry"}
- Metal: ${analysisResult.metal?.type || "unknown"} ${analysisResult.metal?.finish || ""} ${analysisResult.metal?.karat || ""}
- Stones: ${JSON.stringify(analysisResult.stones?.map((s) => `${s.count}x ${s.type} ${s.cut}`) || ["none"])}
- Style: ${analysisResult.design_elements?.style || "classic"}
- Visual fingerprint: ${analysisResult.visual_fingerprint || "N/A"}

Original prompt to enhance:
${templatePrompt}`;
    const text = await callGeminiAnalysis({ prompt, temperature: 0.4, maxTokens: 3e3 });
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    const enhanced = parsed.enhanced_prompt || parsed.prompt || text;
    if (typeof enhanced === "string" && enhanced.length > 100) {
      console.log(`Gemini enhanced ${sceneType} prompt (${enhanced.length} chars)`);
      return enhanced;
    }
    return templatePrompt;
  } catch (err) {
    console.error(`Gemini prompt enhancement failed for ${sceneType}:`, err?.message || err);
    return templatePrompt;
  }
}
function buildProductIdentityCard(analysisResult, imageIndex, totalImages) {
  const crossImageLine = imageIndex != null && totalImages != null ? `
CROSS-IMAGE CONSISTENCY: This is image ${imageIndex} of ${totalImages}. The jewelry MUST be INDISTINGUISHABLE from the same piece in other images of this set.
` : "";
  const visualDna = analysisResult.visual_dna;
  const dnaBlock = visualDna ? `
VISUAL DNA:
- Silhouette: ${visualDna.silhouette_descriptor || "N/A"}
- Visual Axis: ${visualDna.dominant_visual_axis || "N/A"}
- Light Signature: ${visualDna.light_signature || "N/A"}
- Color Map: ${visualDna.color_relationship_map || "N/A"}
- Scale: ${visualDna.scale_anchor || "N/A"}
- Asymmetries: ${visualDna.distinguishing_asymmetries || "none"}
- Optical Weight Center: ${visualDna.optical_weight_center || "center"}` : "";
  return `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PRODUCT IDENTITY CARD \u2014 THIS JEWELRY MUST LOOK IDENTICAL IN EVERY IMAGE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${crossImageLine}
This is a CROSS-IMAGE CONSISTENCY ANCHOR. The jewelry piece described below
MUST appear IDENTICALLY in this image as in all other images of this set.

TYPE: ${analysisResult.type || "jewelry"}
${analysisResult.visual_fingerprint ? `FINGERPRINT: ${analysisResult.visual_fingerprint}` : ""}
${dnaBlock}

STONES: Exactly ${analysisResult.structure?.center_stone_count ?? "?"} center + ${analysisResult.structure?.accent_stone_count ?? "0"} accent stones.
DO NOT add, remove, or reposition ANY stone. Count must be EXACT.

PRONGS: Exactly ${analysisResult.structure?.total_prong_count ?? "as shown"} prongs in ${analysisResult.structure?.prong_style ?? "original"} style.
DO NOT modify prong count or style.

PROPORTIONS: ${analysisResult.proportions?.length_to_width_ratio ?? "1.0"} L:W ratio, ${analysisResult.proportions?.overall_profile ?? "standard"} profile.
DO NOT alter proportions. The piece must maintain its EXACT shape.

ANY deviation from this identity card is a CRITICAL ERROR.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`.trim();
}
function buildEditorialPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard) {
  const categories = [...new Set(EDITORIAL_SCENE_POOL.map((s) => s.category))];
  const chosenCategory = pickRandom(categories);
  const scenesInCategory = EDITORIAL_SCENE_POOL.filter((s) => s.category === chosenCategory);
  const scene = pickRandom(scenesInCategory);
  const lighting = pickRandom(LIGHTING_ANGLES);
  const camera = pickRandom(CAMERA_PERSPECTIVES);
  console.log(`Editorial scene: ${scene.name} [${scene.category}], Lighting: ${lighting.substring(0, 40)}..., Camera: ${camera.substring(0, 30)}...`);
  return `${identityCard}

EDITORIAL / CREATIVE LUXURY JEWELRY PHOTOGRAPHY \u2014 Magazine campaign quality, high-fashion editorial.

${productExtractionBlock}

${fidelityBlock}

SCENE: ${scene.name}
${scene.prompt}

${COLOR_GRADE_MODIFIERS[scene.category] || ""}

LIGHTING: ${lighting}

CAMERA: ${camera}

CREATIVE DIRECTION:
- Natural, realistic luxury product photography
- Shallow depth of field with soft bokeh background
- The jewelry is the clear focal point \u2014 scene complements, never distracts
- Authentic color grading \u2014 warm, natural, not over-processed

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic \u2014 natural look, no CGI artifacts
- Sharp focus on jewelry, natural lighting`;
}
function buildEcommercePrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard) {
  return `${identityCard}

E-COMMERCE PROFESSIONAL PRODUCT PHOTOGRAPHY \u2014 Clean, commercial, marketplace-ready.

${productExtractionBlock}

${fidelityBlock}

BACKGROUND:
- Pure white to very light grey gradient background (RGB 248-255)
- Absolutely NO props, NO environment elements, NO decorations
- NO model, NO hands, NO skin \u2014 product only
- Clean infinity curve / seamless white backdrop

LIGHTING:
- Soft omnidirectional studio lighting from all sides
- Minimal shadows \u2014 just enough for depth/grounding
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
function buildModelPrompt(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard) {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG["genel"];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const outfit = pickOutfitForProduct(productType);
  console.log(`Model prompt \u2014 Persona: ${persona.name}, Outfit: ${outfit.name}, Type: ${productType}, Region: ${config.bodyRegion}`);
  return `${identityCard}

EDITORIAL MODEL PHOTOGRAPHY \u2014 High-fashion portrait with real human model wearing the jewelry piece.

${productExtractionBlock}

${fidelityBlock}

\u26A0\uFE0F MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY \u26A0\uFE0F
- A real, photographic human model MUST be visible and wearing the jewelry
- NO product-only output \u2014 the model IS required
- NO mannequins, NO floating jewelry, NO disembodied body parts

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
CHARACTER DNA \u2014 ${persona.name.toUpperCase()} (${persona.heritage})
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

SKIN & COMPLEXION:
- Skin tone: ${persona.skinTone} with ${persona.skinUndertone} undertone
- Real skin texture mandatory: visible pores, natural micro-imperfections, subtle vein patterns on hands/wrists
- Absolutely NO plastic/CGI/airbrushed/beauty-filtered look
- Natural skin sheen \u2014 not matte, not oily, just healthy luminous skin
- Subsurface scattering visible in ear lobes, fingertips, and thin skin areas

HAIR:
- Color: ${persona.hairColor}, texture: ${persona.hairTexture}
- Signature: ${persona.hairSignature}
- Individual hair strands visible, natural flyaways for realism
- Hair must not obstruct the jewelry \u2014 styled to reveal it

FACE & EYES:
- Eye color: ${persona.eyeColor}
- Face shape: ${persona.faceShape}
- Realistic iris detail with natural catch-lights

EXPRESSION & GAZE:
- ${expression}
- ${gaze}
- Micro-expression details: subtle muscle tension, natural lip position

BODY & ANATOMY:
- Age: ${persona.age}, ${persona.heritage}
- Body type: ${persona.bodyType}, Height: ${persona.height}
- Fashion vibe: ${persona.fashionVibe}
- Anatomical accuracy: correct finger count (5 per hand), natural proportions
- Natural body weight \u2014 realistic, not idealized
- Visible collarbone definition, natural neck length

EDITORIAL PRESENCE:
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Signature mannerism: ${persona.signatureMannerism}
- Strength: ${persona.strengthAsModel}
- Reference: ${persona.editorialReference}
${buildOutfitBlock(outfit)}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
POSE & JEWELRY PLACEMENT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

BODY REGION: ${config.bodyRegion.toUpperCase()}
POSE: ${pose}

${EDITORIAL_ENERGY_DIRECTIVE}

JEWELRY INTERACTION:
- The jewelry must be the HERO \u2014 model supports, never competes
- Sharp focus on jewelry, model slightly softer (but still detailed)
- Natural jewelry-skin interaction: realistic weight, drape, and contact
- Light must highlight the jewelry more than the model's features

ENVIRONMENT:
- Soft editorial lighting \u2014 cinematic and flattering
- Neutral to warm luxury setting (not distracting)
- Shallow depth of field \u2014 f/1.8 to f/2.8 bokeh
- Background suggestion: soft gradient, architectural detail out of focus, or natural light source

COLOR GRADING:
- Warm, rich tones \u2014 luxury editorial palette
- Skin tones accurate and flattering
- Metal color of jewelry preserved exactly

TECHNICAL:
- 4K ultra-high resolution output
- Ultra photorealistic portrait photography
- Fashion editorial meets luxury advertising campaign quality
- Shot on 85mm f/1.4 \u2014 classic portrait compression and bokeh`;
}
function buildMacroPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard) {
  return `${identityCard}

MACRO DETAIL PHOTOGRAPHY \u2014 Extreme close-up, ultra-high magnification jewelry detail shot.

${productExtractionBlock}

${fidelityBlock}

MACRO APPROACH:
- Full-frame macro at near 1:1 magnification ratio
- Focus on the most visually striking detail area of the piece
- Metal grain texture, prong construction, stone facet detail all visible
- Individual metal surface scratches and tooling marks become visible art

DEPTH OF FIELD:
- Very shallow DOF (f/2.8-4) \u2014 only the center detail plane is sharp
- Beautiful bokeh transition from sharp to soft across the piece
- Creates dramatic three-dimensionality

LIGHTING:
- Single focused key light to reveal surface micro-texture
- Dark gradient or black background \u2014 no distractions
- Specular highlights on metal edges create luminous outlines
- Stone facets catch individual light points

COMPOSITION:
- The camera is extremely close \u2014 filling 90% of frame with detail
- Off-center composition following rule of thirds
- Negative space in dark areas for dramatic contrast

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic macro photography
- Shot on 100mm macro lens with ring light`;
}
function buildModelCloseUpPrompt(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard) {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG["genel"];
  const pose = pickRandom(config.poses);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const outfit = pickOutfitForProduct(productType);
  console.log(`Model Close-Up \u2014 Persona: ${persona.name}, Outfit: ${outfit.name}`);
  return `${identityCard}

MODEL CLOSE-UP PHOTOGRAPHY \u2014 Tight crop, intimate detail shot of jewelry on a real model.

${productExtractionBlock}

${fidelityBlock}

\u26A0\uFE0F MANDATORY: A REAL HUMAN MODEL MUST BE WEARING THE JEWELRY \u26A0\uFE0F

CLOSE-UP FRAMING:
- Extreme close-up / tight crop on the ${config.bodyRegion} area
- The jewelry fills 60-70% of the frame
- Model skin visible as context \u2014 natural pores, texture, warmth
- Very shallow depth of field: f/1.8-2.0, only jewelry plane is sharp

MODEL \u2014 ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone} with ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Real skin texture: visible pores, natural imperfections
- No plastic/CGI look \u2014 authentic human warmth
- Age ${persona.age}, ${persona.heritage}
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Strength: ${persona.strengthAsModel}
${buildOutfitBlock(outfit)}

POSE:
- ${pose}
- Natural, relaxed interaction with the jewelry
- Body region: ${config.bodyRegion}

${EDITORIAL_ENERGY_DIRECTIVE}

LIGHTING:
- Soft, warm directional light from one side
- Gentle skin glow with natural highlights on jewelry
- Subtle shadow on the opposite side for depth
- No harsh studio lighting \u2014 intimate, natural feel

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic close-up portrait photography
- Shot on 85mm f/1.4 \u2014 shallow DOF, beautiful bokeh`;
}
function buildModelLifestylePrompt(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard) {
  const config = PRODUCT_TYPE_MODEL_CONFIG[productType] || PRODUCT_TYPE_MODEL_CONFIG["genel"];
  const pose = pickRandom(config.poses);
  const gaze = pickRandom(CHARACTER_GAZE);
  const expression = pickRandom(CHARACTER_EXPRESSIONS);
  const persona = pickRandom(CHARACTER_PERSONAS);
  const outfit = pickOutfitForProduct(productType);
  const lifestyleScene = pickRandom([
    { setting: "Parisian caf\xE9 terrace at golden hour", mood: "warm, romantic, European luxury" },
    { setting: "Luxury hotel suite with soft morning light through sheer curtains", mood: "intimate, serene, private luxury" },
    { setting: "Art gallery opening with warm ambient lighting", mood: "sophisticated, cultural, modern elegance" },
    { setting: "Rooftop bar at sunset with city skyline bokeh", mood: "urban, cosmopolitan, aspirational" },
    { setting: "Mediterranean seaside restaurant with natural daylight", mood: "effortless, sun-kissed, resort luxury" }
  ]);
  console.log(`Model Lifestyle \u2014 Persona: ${persona.name}, Outfit: ${outfit.name}`);
  return `${identityCard}

MODEL LIFESTYLE PHOTOGRAPHY \u2014 Real model wearing jewelry in a natural luxury setting.

${productExtractionBlock}

${fidelityBlock}

\u26A0\uFE0F MANDATORY: A REAL HUMAN MODEL MUST BE WEARING THE JEWELRY \u26A0\uFE0F

CHARACTER \u2014 ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone} with ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Expression: ${expression}
- Gaze: ${gaze}
- Age ${persona.age}, ${persona.heritage}
- Body: ${persona.bodyType}, ${persona.height}
- Fashion vibe: ${persona.fashionVibe}
- Real skin texture, natural beauty \u2014 no airbrushing

EDITORIAL PRESENCE:
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Signature mannerism: ${persona.signatureMannerism}
- Strength: ${persona.strengthAsModel}
${buildOutfitBlock(outfit)}

POSE & PLACEMENT:
- Body region: ${config.bodyRegion}
- ${pose}
- Natural, candid moment \u2014 as if captured mid-life
- Jewelry is prominent but the scene feels authentic, not staged

${EDITORIAL_ENERGY_DIRECTIVE}

SCENE:
- ${lifestyleScene.setting}
- Mood: ${lifestyleScene.mood}
- Background softly blurred (f/2.0-2.8 bokeh)
- Environment adds context without competing with jewelry

LIGHTING:
- Natural, warm lighting appropriate to the setting
- Soft directional light that flatters both model and jewelry
- No harsh studio lighting \u2014 environmental and authentic

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic lifestyle photography
- Shot on 50mm f/1.8 \u2014 natural perspective, soft background`;
}
function buildCustomPrompt(analysisResult, fidelityBlock, productExtractionBlock, identityCard, customText) {
  return `${identityCard}

CUSTOM JEWELRY PHOTOGRAPHY \u2014 User-directed creative vision.

${productExtractionBlock}

${fidelityBlock}

USER CREATIVE DIRECTION:
${customText}

IMPORTANT CONSTRAINTS:
- The jewelry piece MUST be the hero of the image
- Preserve ALL jewelry details exactly as analyzed
- Apply the user's creative direction to scene, lighting, and atmosphere
- Maintain photorealistic quality \u2014 4K, no CGI artifacts
- If user mentions a model/person, include a real human model wearing the jewelry

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic professional photography`;
}
function buildStyleTransferPrompt(styleAnalysis, productType, fidelityBlock, productExtractionBlock, identityCard) {
  const productTypePlacement = {
    "yuzuk": { bodyPart: "hand/finger", placement: "Place the ring on the finger in the exact position shown in the style reference.", removal: "Remove any existing rings from the style reference model." },
    "bileklik": { bodyPart: "wrist", placement: "Place the bracelet on the wrist as shown in the style reference.", removal: "Remove any existing bracelets or wrist accessories." },
    "kupe": { bodyPart: "ear", placement: "Place the earring on the ear. If only one ear visible, render only ONE earring.", removal: "Remove any existing earrings." },
    "kolye": { bodyPart: "neck/d\xE9colletage", placement: "Place the necklace around the neck/d\xE9colletage area.", removal: "Remove any existing necklaces." },
    "saat": { bodyPart: "wrist", placement: "Place the watch on the wrist with dial face clearly visible.", removal: "Remove any existing watches or wrist accessories." }
  };
  const selectedPlacement = productTypePlacement[productType || ""] || {
    bodyPart: "appropriate body part",
    placement: "Place the jewelry on the model naturally.",
    removal: "Remove any existing jewelry from the target body part."
  };
  const sceneBlock = styleAnalysis ? `
SCENE RECREATION:
- Setting: ${styleAnalysis.scene.setting}
- Background: ${styleAnalysis.scene.background_elements}
- Surface: ${styleAnalysis.scene.surface}
- Time/Season: ${styleAnalysis.scene.season_time}
Recreate this EXACT scene environment.` : "";
  const lightingBlock = styleAnalysis ? `
LIGHTING RECREATION:
- Type: ${styleAnalysis.lighting.type}
- Direction: ${styleAnalysis.lighting.direction}
- Quality: ${styleAnalysis.lighting.quality}
- Color Temperature: ${styleAnalysis.lighting.color_temperature}
Match this EXACT lighting setup.` : "";
  const compositionBlock = styleAnalysis ? `
COMPOSITION RECREATION:
- Framing: ${styleAnalysis.composition.framing}
- Camera Angle: ${styleAnalysis.composition.camera_angle}
- Depth of Field: ${styleAnalysis.composition.depth_of_field}
Match this EXACT camera setup.` : "";
  const modelBlock = styleAnalysis?.model?.present ? `
MODEL RECREATION:
- Pose: ${styleAnalysis.model.pose_description}
- Visible: ${styleAnalysis.model.body_parts_visible}
- Expression: ${styleAnalysis.model.expression_mood}
- Clothing: ${styleAnalysis.model.clothing}
- Skin Tone: ${styleAnalysis.model.skin_tone}
Recreate this model pose and appearance.` : "";
  const moodBlock = styleAnalysis ? `
MOOD & STYLE:
- Atmosphere: ${styleAnalysis.mood.overall_atmosphere}
- Color Palette: ${styleAnalysis.mood.color_palette}
- Style: ${styleAnalysis.mood.style_reference}
- Genre: ${styleAnalysis.mood.editorial_genre}
Match this EXACT mood and color grading.` : "";
  const jewelryRemovalBlock = styleAnalysis?.existing_jewelry?.present ? `
JEWELRY REPLACEMENT:
- Remove existing: ${styleAnalysis.existing_jewelry.description} at ${styleAnalysis.existing_jewelry.location}
- Replace with the product from reference images` : "";
  return `${identityCard}

[STYLE REFERENCE TRANSFER - ANALYZED PRODUCT INJECTION MODE]

\u26A0\uFE0F PRE-PROCESSING: ACCESSORY REMOVAL \u26A0\uFE0F
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

PRODUCT TYPE: ${productType?.toUpperCase() || "JEWELRY"}
TARGET: ${selectedPlacement.bodyPart.toUpperCase()}
PLACEMENT: ${selectedPlacement.placement}

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.
Ultra high resolution output.`;
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
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
  aspectRatio = "3:4"
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;
  const parts = [{ text: prompt }];
  for (const base64Image of base64Images) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Image } });
  }
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature,
        imageConfig: {
          aspectRatio,
          imageSize: "4K"
        }
      }
    })
  });
}
async function generateSingleImage(base64Images, prompt, userId, imageRecordId, index, _unused, jobId, aspectRatio = "3:4", startTemperature = 0.12) {
  const temperatures = [startTemperature, startTemperature + 0.05, startTemperature + 0.1];
  const delays = [0, 3e3, 5e3];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!GOOGLE_IMAGE_API_KEY) {
        console.error("Missing GOOGLE_API_KEY");
        return null;
      }
      if (attempt > 0) {
        console.log(`Retry ${attempt}/2 for image ${index} with temperature ${temperatures[attempt]}...`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      const genResponse = await callGeminiImageGeneration({
        base64Images,
        prompt,
        temperature: temperatures[attempt],
        aspectRatio
      });
      if (!genResponse.ok) {
        const errText = await genResponse.text();
        console.error(`Generation ${index} API error (${genResponse.status}) attempt ${attempt + 1}:`, errText);
        if (attempt >= 2) {
          try {
            await query("UPDATE processing_jobs SET error_message = $1 WHERE id = $2", [`Gemini API error ${genResponse.status}: ${errText.substring(0, 500)}`, jobId]);
          } catch (_) {
          }
          return null;
        }
        continue;
      }
      const genData = await genResponse.json();
      const parts = genData.candidates?.[0]?.content?.parts || [];
      let generatedImage = null;
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
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
      generatedImage = null;
      const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
      const { error: uploadError } = await uploadFile("jewelry-images", filePath, imageBuffer, "image/png");
      if (!uploadError) {
        const { data: signedUrlData, error: signedUrlError } = await getSignedUrl("jewelry-images", filePath, 7 * 24 * 60 * 60);
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
async function analyzeStyleReference(styleBase64) {
  try {
    const stylePrompt = `You are an expert photography and art director. Analyze this style reference image with extreme precision for the purpose of recreating its visual style in a new jewelry photograph.

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
    "present": true,
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
    "present": true,
    "description": "description of any jewelry visible",
    "location": "where on the body/scene the jewelry is"
  }
}

ONLY valid JSON.`;
    const content = await callGeminiAnalysis({ prompt: stylePrompt, imageBase64: styleBase64 });
    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    console.log("Style reference analysis:", JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error("Style reference analysis failed:", err);
    return null;
  }
}
async function processGeneration(params) {
  const {
    userId,
    imageRecordId,
    jobId,
    imagePaths,
    validAdditionalPaths,
    sceneId,
    packageType,
    productType,
    metalColorOverride,
    styleReferencePath,
    aspectRatio,
    creditsNeeded,
    isAdminUser,
    selectedScenes: paramSelectedScenes,
    customPrompt: paramCustomPrompt
  } = params;
  console.log(`Using model: Analysis=Gemini 2.5 Flash, Generation=Gemini 3 Pro (4K), Package=${packageType}`);
  const isRetouchPackage = packageType === "retouch";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    await query("UPDATE processing_jobs SET status = $1, current_step = $2, progress = $3 WHERE id = $4", ["generating", "downloading", 2, jobId]);
    const allImagePaths = [imagePaths[0], ...validAdditionalPaths];
    const imageUrls = [];
    for (const path of allImagePaths) {
      imageUrls.push(getInternalUrl("jewelry-images", path));
    }
    if (imageUrls.length === 0) {
      throw new Error("Failed to access images");
    }
    await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [5, "downloading", jobId]);
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === "string" && styleReferencePath.startsWith(`${userId}/style-references/`);
    let styleReferenceBase64 = null;
    if (hasStyleReference) {
      try {
        const styleUrl = getInternalUrl("jewelry-images", styleReferencePath);
        const styleResponse = await fetch(styleUrl);
        const styleBuffer = await styleResponse.arrayBuffer();
        if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
          styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
          console.log("Style reference converted to base64");
        }
      } catch (err) {
        console.error("Failed to fetch style reference:", err);
      }
    }
    let styleAnalysis = null;
    if (styleReferenceBase64) {
      console.log("Analyzing style reference...");
      await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["analyzing_style", 12, jobId]);
      styleAnalysis = await analyzeStyleReference(styleReferenceBase64);
    }
    let scene = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
      scene = await queryOne("SELECT * FROM scenes WHERE id = $1", [sceneId]);
    }
    await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["analyzing", 10, jobId]);
    const base64Images = [];
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
        console.warn("Failed to fetch image:", err);
      }
    }
    if (base64Images.length === 0) {
      throw new Error("Image too large. Max 1.5MB.");
    }
    const base64Image = base64Images[0];
    console.log("Step 1: Analyzing jewelry...");
    await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [15, jobId]);
    const analysisPrompt = `You are an expert jewelry and luxury watch analyst. Analyze this piece with extreme precision.

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
    "dial_finish": "sunburst|guilloch\xE9|enamel|textured|plain",
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
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "guilloch\xE9", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "unique features including brand indicators, logo placement, signature design elements",
  "visual_fingerprint": "5-7 DETAILED sentences (see instructions below)",
  "visual_dna": {
    "silhouette_descriptor": "outline shape of the piece from its primary viewing angle",
    "dominant_visual_axis": "horizontal|vertical|radial|diagonal",
    "light_signature": "how this piece interacts with light \u2014 reflections, refractions, glow patterns",
    "color_relationship_map": "interaction between metal color and stone colors \u2014 contrast type, harmony",
    "scale_anchor": "size relative to body reference (e.g., covers fingertip-to-knuckle, spans earlobe, etc.)",
    "distinguishing_asymmetries": "any asymmetric features, manufacturing marks, or intentional irregularities",
    "optical_weight_center": "where the eye is drawn first \u2014 the visual gravity point of the piece"
  }
}

CRITICAL: Count EVERY stone precisely. Describe EXACT positions.
For rings: describe the band profile, prong count, gallery style.
For necklaces: describe chain type, pendant attachment, clasp style.
For watches: describe dial indices, hand style, subdial positions.

"visual_fingerprint" MUST be 5-7 DETAILED sentences functioning as a VERBAL PHOTOGRAPH:
1. Overall silhouette and profile from primary viewing angle
2. Single most distinctive visual feature (what would be noticed from 2 metres away?)
3. Stone geometry \u2014 not just count, but SPATIAL ARRANGEMENT (triangle? line? cluster? halo?)
4. Metal-stone color interaction (warm/cool contrast? monochromatic? complementary?)
5. Asymmetry or signature detail that makes this piece uniquely identifiable
6-7. Any additional unique characteristics (optional but encouraged)

"visual_dna" provides the RECONSTRUCTION BLUEPRINT \u2014 enough data to rebuild this piece from text alone.

NOTE: If analyzing a WATCH, pay special attention to:
- Pearl/mother-of-pearl dial details
- Diamond-set bezel or indices
- Metal bracelet link patterns
- Crown and pusher designs
- Visible mechanical movement details

ONLY valid JSON.`;
    let analysisResult = { type: "jewelry", design_elements: { style: "classic" } };
    try {
      const analysisContent = await callGeminiAnalysis({
        prompt: analysisPrompt,
        imageBase64: base64Image
      });
      console.log("Raw analysis content (first 500 chars):", analysisContent.substring(0, 500));
      analysisResult = JSON.parse(analysisContent.replace(/```json\n?|\n?```/g, "").trim());
    } catch (err) {
      console.error("Jewelry analysis failed:", err?.message || err);
      await query("UPDATE processing_jobs SET error_message = $1 WHERE id = $2", [`Analiz hatas\u0131: ${err?.message?.substring(0, 200) || "parse error"}`, jobId]);
    }
    console.log("Analysis result:", JSON.stringify(analysisResult, null, 2));
    await query("UPDATE images SET status = $1, analysis_data = $2 WHERE id = $3", ["generating", JSON.stringify(analysisResult), imageRecordId]);
    await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["generating", 25, jobId]);
    const metalColorOverrideMap = {
      "yellow_gold": { type: "gold", category: "YELLOW GOLD" },
      "white_gold": { type: "white_gold", category: "WHITE GOLD" },
      "rose_gold": { type: "rose_gold", category: "ROSE GOLD" },
      "platinum": { type: "platinum", category: "PLATINUM" },
      "silver": { type: "silver", category: "SILVER" }
    };
    const userMetalOverride = metalColorOverride ? metalColorOverrideMap[metalColorOverride] : null;
    const metalType = userMetalOverride?.type || analysisResult.metal?.type || "gold";
    const metalFinish = analysisResult.metal?.finish || "polished";
    const metalKarat = analysisResult.metal?.karat || "18k";
    const metalColorHex = analysisResult.metal?.color_hex || "";
    let metalColorCategory = userMetalOverride?.category || "YELLOW GOLD";
    if (!userMetalOverride) {
      if (metalType === "white_gold" || metalType === "platinum" || metalType === "silver") {
        metalColorCategory = "WHITE/SILVER METAL";
      } else if (metalType === "rose_gold") {
        metalColorCategory = "ROSE GOLD";
      } else if (metalType === "gold") {
        metalColorCategory = "YELLOW GOLD";
      }
    }
    console.log("Metal color decision:", { userOverride: metalColorOverride, finalType: metalType, finalCategory: metalColorCategory });
    const metalDesc = `${metalFinish} ${metalType.replace("_", " ")} (${metalKarat})`;
    const stoneDesc = analysisResult.stones?.length > 0 ? analysisResult.stones.map(
      (s) => `${s.count || 1} ${s.color || ""} ${s.type || "gemstone"}(s) in ${s.cut || "round"} cut with ${s.setting || "prong"} setting`
    ).join(", ") : "";
    const stoneDetailBlock = analysisResult.stones?.length > 0 ? analysisResult.stones.map(
      (s, i) => `Stone ${i + 1}: ${s.count || 1}x ${s.color || ""} ${s.type || "gemstone"}, ${s.cut || "round"} cut, ${s.setting || "prong"} setting, position: ${s.position || "center"}, relative size: ${s.relative_size || "medium"}`
    ).join("\n  ") : "No gemstones";
    const structureBlock = analysisResult.structure ? `
STRUCTURAL IDENTITY (MUST BE PRESERVED EXACTLY):
- Center stones: ${analysisResult.structure.center_stone_count ?? "unknown"}
- Accent stones: ${analysisResult.structure.accent_stone_count ?? 0}
- Total prongs: ${analysisResult.structure.total_prong_count ?? "standard"}
- Prong style: ${analysisResult.structure.prong_style ?? "classic"}
- Band: ${analysisResult.structure.band_width_mm ?? "?"}mm ${analysisResult.structure.band_profile ?? "standard"}
- Shank: ${analysisResult.structure.shank_design ?? "plain"}
- Gallery: ${analysisResult.structure.gallery_detail ?? "standard"}` : "";
    const proportionsBlock = analysisResult.proportions ? `
PROPORTIONS (CRITICAL FOR CONSISTENCY):
- L:W ratio: ${analysisResult.proportions.length_to_width_ratio ?? "1.0"}
- Stone/Metal balance: ${analysisResult.proportions.stone_to_metal_ratio ?? "balanced"}
- Profile height: ${analysisResult.proportions.overall_profile ?? "medium_set"}
- Symmetry: ${analysisResult.proportions.symmetry_grade ?? "good"}` : "";
    const surfaceBlock = analysisResult.surface_details ? [
      "\nSURFACE DETAILS (MUST APPEAR IN ALL IMAGES):",
      analysisResult.surface_details.milgrain ? "- Milgrain edge detail PRESENT \u2014 must be visible" : "",
      analysisResult.surface_details.filigree ? "- Filigree work PRESENT \u2014 must be visible" : "",
      analysisResult.surface_details.engravings ? `- Engraving: ${analysisResult.surface_details.engraving_description}` : "",
      analysisResult.surface_details.texture_zones ? `- Texture: ${analysisResult.surface_details.texture_zones}` : ""
    ].filter(Boolean).join("\n") : "";
    const fingerprintBlock = analysisResult.visual_fingerprint ? `
VISUAL FINGERPRINT (UNIQUE IDENTITY):
${analysisResult.visual_fingerprint}` : "";
    const userOverrideNote = metalColorOverride ? `
\u26A0\uFE0F USER SPECIFIED METAL COLOR: ${metalColorCategory} - THIS TAKES ABSOLUTE PRIORITY \u26A0\uFE0F
The user has explicitly specified that this jewelry is ${metalColorCategory}. Ignore any visual ambiguity and render as ${metalColorCategory}.
` : "";
    const productExtractionBlock = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SYSTEM INSTRUCTION \u2014 PRODUCT EXTRACTION MODE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The uploaded image is used STRICTLY to extract the jewelry product.

EXTRACTION RULES (MANDATORY):
- Extract ONLY the jewelry object from the reference image(s)
- IGNORE and DISCARD all non-jewelry elements including:
  \u2022 hands, skin, fingers, nails
  \u2022 background, reflections, shadows, environment
  \u2022 camera angle, lighting conditions
  \u2022 any contextual elements

THE OUTPUT MUST CONTAIN:
- \u2714 ONLY the jewelry piece detected in the image
- \u2714 Accurate geometry, proportions, stone placement, metal structure
- \u2714 Neutralized reference orientation (product isolated)

The jewelry must be reconstructed as a STANDALONE OBJECT, as if scanned in a vacuum.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
STAGE 2 \u2014 SCENE APPLICATION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Using the ISOLATED jewelry object:
- Place the product into the selected scene
- Lighting, background, camera, and composition must be defined ONLY by the scene prompt
- The product's intrinsic properties (metal color, stone type, design) are preserved
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`.trim();
    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === "watch" ? `
LUXURY WATCH SPECIFICATIONS:
- Dial: ${watchDetails.dial_color || "classic"} ${watchDetails.dial_finish || ""} finish
- Case Shape: ${watchDetails.case_shape || "round"}
- Bezel: ${watchDetails.bezel_style || "smooth"}
- Strap/Bracelet: ${watchDetails.strap_type || "metal_bracelet"}
- Crystal: ${watchDetails.crystal_type || "sapphire"}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(", ")}` : ""}
` : "";
    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || "jewelry piece"}
- Metal: ${metalDesc}
- Metal Color Category: ${metalColorCategory}
${metalColorHex ? `- Exact Metal Color Hex: ${metalColorHex}` : ""}
${stoneDesc ? `- Stones: ${stoneDesc}` : ""}
- Style: ${analysisResult.design_elements?.style || "classic"}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ""}
${watchDesc}
${userOverrideNote}

DETAILED STONE MAP:
  ${stoneDetailBlock}
${structureBlock}
${proportionsBlock}
${surfaceBlock}
${fingerprintBlock}

\u26A0\uFE0F ABSOLUTE METAL COLOR PRESERVATION (HIGHEST PRIORITY) \u26A0\uFE0F
THE METAL COLOR MUST BE: ${metalColorCategory}
- Metal type: ${metalType.replace("_", " ").toUpperCase()}
- Metal color: ${metalColorCategory}
${metalColorHex ? `- Hex color: ${metalColorHex}` : ""}

STRICT METAL RULES:
- If the original is YELLOW GOLD \u2192 output MUST be YELLOW GOLD (warm golden hue)
- If the original is WHITE GOLD/PLATINUM/SILVER \u2192 output MUST be WHITE/SILVER metal
- If the original is ROSE GOLD \u2192 output MUST be ROSE GOLD (pinkish golden hue)
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

ANTI-HALLUCINATION PROTOCOL:
1. STONE COUNT LOCK: EXACTLY ${analysisResult.structure?.center_stone_count ?? "?"} center + ${analysisResult.structure?.accent_stone_count ?? "0"} accent stones. NO additions. NO omissions.
2. PRONG INTEGRITY: Setting type NEVER changes (prong to bezel FORBIDDEN, bezel to prong FORBIDDEN)
3. SILHOUETTE LOCK: Piece outline${analysisResult.visual_dna?.silhouette_descriptor ? ` \u2014 ${analysisResult.visual_dna.silhouette_descriptor}` : ""} MUST match original
4. SCALE PRESERVATION:${analysisResult.visual_dna?.scale_anchor ? ` ${analysisResult.visual_dna.scale_anchor}` : " maintain original body-relative size"}
5. LIGHT BEHAVIOR:${analysisResult.visual_dna?.light_signature ? ` ${analysisResult.visual_dna.light_signature}` : " preserve original light interaction patterns"}
6. NO INVENTION: NEVER add design elements that do not exist in the original piece
7. NO SIMPLIFICATION: NEVER remove small details (milgrain, filigree, micro-pave, engravings)

FORBIDDEN:
- \u274C CHANGING METAL COLOR - ABSOLUTELY FORBIDDEN
- \u274C No text, watermarks, logos
- \u274C No design alterations
- \u274C No additional jewelry pieces
- \u274C No artificial CGI gemstones`.trim();
    let brandDnaBlock = "";
    try {
      const brandProfile = await queryOne(
        "SELECT brand_dna_prompt, is_active FROM brand_profiles WHERE user_id = $1 AND is_active = true LIMIT 1",
        [userId]
      );
      if (brandProfile?.brand_dna_prompt) {
        brandDnaBlock = `

${brandProfile.brand_dna_prompt}
`;
        console.log("Brand DNA applied for user:", userId);
      }
    } catch {
    }
    const fidelityBlockWithBrand = brandDnaBlock ? `${fidelityBlock}
${brandDnaBlock}` : fidelityBlock;
    const generatedUrls = [];
    if (isRetouchPackage) {
      console.log("Retouch Package: Professional photo enhancement...");
      const retouchPrompt = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PROFESSIONAL JEWELRY RETOUCHING \u2014 8-STEP MASTER WORKFLOW
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.

ABSOLUTE PRODUCT INTEGRITY RULES (CRITICAL):
- Do NOT change product geometry, proportions, or scale
- Do NOT add, remove, resize or reshape stones
- Do NOT modify stone count, cut, setting or prong structure
- Do NOT change metal structure, engravings or design language

STEP 1 \u2014 DUST & DEFECT REMOVAL
Remove all dust particles, fingerprints, micro-scratches, lint fibers.
Clean sensor spots and environmental contamination. Surface should be immaculate.

STEP 2 \u2014 FREQUENCY SEPARATION
Separate texture from color. Preserve real metal grain/texture on high-frequency layer.
Smooth color transitions on low-frequency layer. NO plastic/airbrushed look.

STEP 3 \u2014 BACKGROUND ISOLATION
Precision edge masking. Pure white background (RGB 255,255,255).
Sub-pixel edge accuracy. No halo, no fringing, no lost detail at edges.
Preserve fine elements: chain links, prong tips, filigree details.

STEP 4 \u2014 COLOR CORRECTION
White balance to D65 (6500K daylight equivalent).
Metal accuracy: yellow gold warm, white gold/platinum cool neutral, rose gold pink-warm.
Stone color: true-to-life saturation, no oversaturation.

STEP 5 \u2014 METAL SURFACE REFINEMENT
Remove handling marks. Restore surface uniformity.
Polished: mirror-clean reflections. Matte/brushed: preserve grain direction.
Enhance specular highlights naturally \u2014 no HDR artifacts.

STEP 6 \u2014 GEMSTONE ENHANCEMENT
Increase facet definition and internal light paths.
Enhance brilliance (white light return), fire (spectral dispersion), scintillation.
Preserve natural inclusions. NO artificial sparkle overlay.

STEP 7 \u2014 SHADOW & DIMENSION
Add subtle ground shadow for depth (soft, diffused, 10-15% opacity).
Enhance three-dimensionality through subtle dodge & burn.
Contact shadow where product meets surface.

STEP 8 \u2014 FINAL SHARPENING
Selective high-pass sharpening on edges and detail areas.
Avoid sharpening smooth metal surfaces (prevents noise amplification).
Output: commercially clean, catalog-ready image.

OUTPUT: Single professionally retouched jewelry image on pure white background.
Ultra high resolution output.`.trim();
      await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [28, jobId]);
      const retouchUrl = await generateSingleImage(base64Images, retouchPrompt, userId, imageRecordId, 0, null, jobId, aspectRatio);
      if (retouchUrl) {
        generatedUrls.push(retouchUrl);
        console.log("Retouch complete");
      }
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else if (packageType === "single") {
      console.log("Single (Tekil) Package: Custom single image generation...");
      const identityCard = buildProductIdentityCard(analysisResult);
      let singlePrompt;
      let singleImages;
      if (hasStyleReference && styleReferenceBase64) {
        singlePrompt = buildStyleTransferPrompt(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard);
        singlePrompt = await enhanceScenePrompt(singlePrompt, analysisResult, "style_transfer");
        singleImages = [styleReferenceBase64, ...base64Images];
      } else if (paramCustomPrompt) {
        singlePrompt = buildCustomPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard, paramCustomPrompt);
        singlePrompt = await enhanceScenePrompt(singlePrompt, analysisResult, "custom");
        singleImages = base64Images;
      } else {
        singlePrompt = buildEditorialPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard);
        singlePrompt = await enhanceScenePrompt(singlePrompt, analysisResult, "editorial");
        singleImages = base64Images;
      }
      await query("UPDATE processing_jobs SET progress = $1, current_step = $2, total_images = $3 WHERE id = $4", [28, "generating", 1, jobId]);
      const url = await generateSingleImage(singleImages, singlePrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else if (hasStyleReference && styleReferenceBase64 && packageType !== "standard") {
      console.log("Standalone style reference generation mode...");
      const identityCard = buildProductIdentityCard(analysisResult);
      let styleTransferPrompt = buildStyleTransferPrompt(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard);
      styleTransferPrompt = await enhanceScenePrompt(styleTransferPrompt, analysisResult, "style_transfer");
      await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [28, jobId]);
      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      const url = await generateSingleImage(styleTransferImages, styleTransferPrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else {
      console.log(`Master Paket generation (${paramSelectedScenes ? paramSelectedScenes.length : 6} images, 4K)...`);
      const resolvedProductType = productType || (() => {
        const analysisType = analysisResult?.type?.toLowerCase() || "";
        const typeMap = {
          ring: "yuzuk",
          necklace: "kolye",
          bracelet: "bileklik",
          earring: "kupe",
          pendant: "kolye",
          watch: "saat",
          choker: "kolye",
          brooch: "genel",
          piercing: "kupe"
        };
        return typeMap[analysisType] || "genel";
      })();
      console.log(`Resolved product type: ${resolvedProductType}`);
      const buildIdentityCardForStep = (stepIndex, totalSteps) => buildProductIdentityCard(analysisResult, stepIndex + 1, totalSteps);
      console.log("Product Identity Card (base):", buildProductIdentityCard(analysisResult));
      const masterSteps = [
        {
          key: "editorial",
          step: "generating_editorial",
          label: "Editorial",
          buildPrompt: (ic) => {
            if (hasStyleReference && styleReferenceBase64) {
              return buildStyleTransferPrompt(styleAnalysis, resolvedProductType, fidelityBlockWithBrand, productExtractionBlock, ic);
            }
            return buildEditorialPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic);
          },
          getImages: () => {
            if (hasStyleReference && styleReferenceBase64) {
              return [styleReferenceBase64, ...base64Images];
            }
            return base64Images;
          },
          startTemperature: 0.12
        },
        {
          key: "ecommerce",
          step: "generating_ecommerce",
          label: "E-Commerce",
          buildPrompt: (ic) => buildEcommercePrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic),
          startTemperature: 0.1
        },
        {
          key: "model",
          step: "generating_model",
          label: "Model",
          buildPrompt: (ic) => buildModelPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic),
          startTemperature: 0.12
        },
        {
          key: "macro",
          step: "generating_macro",
          label: "Macro Detail",
          buildPrompt: (ic) => buildMacroPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic),
          startTemperature: 0.12
        },
        {
          key: "model_closeup",
          step: "generating_model_closeup",
          label: "Model Close-Up",
          buildPrompt: (ic) => buildModelCloseUpPrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic),
          startTemperature: 0.12
        },
        {
          key: "model_lifestyle",
          step: "generating_model_lifestyle",
          label: "Model Lifestyle",
          buildPrompt: (ic) => buildModelLifestylePrompt(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic),
          startTemperature: 0.12
        }
      ];
      const filteredSteps = paramSelectedScenes ? masterSteps.filter((s) => paramSelectedScenes.includes(s.key)) : masterSteps;
      console.log(`Generating ${filteredSteps.length} scenes: ${filteredSteps.map((s) => s.key).join(", ")}`);
      if (paramSelectedScenes) {
        await query("UPDATE processing_jobs SET total_images = $1 WHERE id = $2", [filteredSteps.length, jobId]);
      }
      for (let i = 0; i < filteredSteps.length; i++) {
        const ms = filteredSteps[i];
        console.log(`Generating ${ms.label} image (${i + 1}/${filteredSteps.length})...`);
        const progressRange = 65;
        const perStep = progressRange / filteredSteps.length;
        const startProgress = Math.round(25 + i * perStep);
        const endProgress = Math.round(25 + (i + 1) * perStep);
        await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [startProgress, ms.step, jobId]);
        const stepIdentityCard = buildIdentityCardForStep(i, filteredSteps.length);
        const basePrompt = ms.buildPrompt(stepIdentityCard);
        const prompt = await enhanceScenePrompt(basePrompt, analysisResult, ms.key);
        const images = ms.getImages ? ms.getImages() : base64Images;
        const temperature = ms.startTemperature ?? 0.12;
        const url = await generateSingleImage(images, prompt, userId, imageRecordId, i + 1, null, jobId, aspectRatio, temperature);
        if (url) generatedUrls.push(url);
        await query("UPDATE processing_jobs SET completed_images = $1, current_step = $2, progress = $3 WHERE id = $4", [generatedUrls.length, i < filteredSteps.length - 1 ? filteredSteps[i + 1].step : "saving", endProgress, jobId]);
        console.log(`${ms.label} image done. Progress: ${endProgress}%`);
      }
    }
    await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [90, "saving", jobId]);
    if (generatedUrls.length === 0) {
      if (!isAdminUser) {
        try {
          await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
          console.log(`Credits refunded: ${creditsNeeded}`);
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
        }
      }
      await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", "G\xF6rsel olu\u015Fturulamad\u0131", imageRecordId]);
      await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", "G\xF6rsel olu\u015Fturulamad\u0131", 100, "failed", jobId]);
      return;
    }
    await query("UPDATE images SET status = $1, generated_image_urls = $2 WHERE id = $3", ["completed", generatedUrls, imageRecordId]);
    await query("UPDATE processing_jobs SET status = $1, progress = $2, current_step = $3, result_urls = $4, completed_images = $5 WHERE id = $6", ["completed", 100, "completed", JSON.stringify(generatedUrls), generatedUrls.length, jobId]);
    console.log("Generation complete:", generatedUrls.length, "images");
  } catch (error) {
    console.error("Processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (!isAdminUser) {
      try {
        await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
        console.log(`Credits refunded on error: ${creditsNeeded}`);
      } catch (refundErr) {
        console.error("Refund on error failed:", refundErr);
      }
    }
    await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", errorMessage, imageRecordId]);
    await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", errorMessage, 100, "failed", jobId]);
  }
}
async function handler(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  let userId = "";
  let creditsNeeded = 0;
  let creditsDeducted = false;
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    userId = authResult.userId;
    console.log("Authenticated user:", userId);
    const { imagePath, additionalImagePaths, sceneId, packageType, productType, metalColorOverride, styleReferencePath, aspectRatio: requestedRatio, selectedScenes, customPrompt } = req.body;
    const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const aspectRatio = validRatios.includes(requestedRatio) ? requestedRatio : "3:4";
    console.log("Generate request:", { imagePath, sceneId, packageType, productType, aspectRatio, userId, selectedScenes, customPrompt: customPrompt?.substring(0, 50) });
    if (!imagePath || typeof imagePath !== "string" || !imagePath.startsWith(`${userId}/originals/`)) {
      return sendCorsResponse(res, 400, { error: "Invalid image path" });
    }
    const validAdditionalPaths = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === "string" && path.startsWith(`${userId}/originals/`)) {
          validAdditionalPaths.push(path);
        }
      }
    }
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === "string" && styleReferencePath.startsWith(`${userId}/style-references/`);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRetouchPackage = packageType === "retouch";
    const isStandardPackage = packageType === "standard" || !packageType;
    const isSinglePackage = packageType === "single";
    if (!hasStyleReference && !isRetouchPackage && !isStandardPackage && !isSinglePackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return sendCorsResponse(res, 400, { error: "Invalid scene ID" });
    }
    const validSceneKeys = ["editorial", "ecommerce", "model", "macro", "model_closeup", "model_lifestyle"];
    let validatedSelectedScenes;
    if (Array.isArray(selectedScenes) && selectedScenes.length > 0) {
      validatedSelectedScenes = selectedScenes.filter((s) => validSceneKeys.includes(s));
      if (validatedSelectedScenes.length === 0) validatedSelectedScenes = void 0;
    }
    const validatedCustomPrompt = isSinglePackage && typeof customPrompt === "string" ? customPrompt.trim().substring(0, 500) : void 0;
    const stuckResult = await query(
      "SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[]) AND updated_at < $3",
      [userId, ["pending", "generating"], new Date(Date.now() - 2 * 60 * 1e3).toISOString()]
    );
    const stuckJobs = stuckResult.rows;
    if (stuckJobs && stuckJobs.length > 0) {
      const stuckJobIds = stuckJobs.map((j) => j.id);
      const stuckImageIds = stuckJobs.map((j) => j.image_record_id).filter(Boolean);
      await query("UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Auto-cleaned: stuck job (timeout)", stuckJobIds]);
      if (stuckImageIds.length > 0) {
        await query("UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Auto-cleaned: generation timed out", stuckImageIds]);
      }
      console.log(`Auto-cleaned ${stuckJobs.length} stuck jobs`);
    }
    const activeResult = await query(
      "SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[])",
      [userId, ["pending", "generating"]]
    );
    const activeJobsList = activeResult.rows;
    if (activeJobsList && activeJobsList.length > 0) {
      const activeJobIds = activeJobsList.map((j) => j.id);
      const activeImageIds = activeJobsList.map((j) => j.image_record_id).filter(Boolean);
      await query("UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["cancelled", "Yeni \xFCretim ba\u015Flat\u0131ld\u0131", activeJobIds]);
      if (activeImageIds.length > 0) {
        await query("UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Yeni \xFCretim ba\u015Flat\u0131ld\u0131", activeImageIds]);
      }
      console.log(`Auto-cancelled ${activeJobsList.length} previous active jobs for new generation`);
    }
    const adminRow = await queryOne("SELECT has_role($1, $2) as result", [userId, "admin"]);
    const isAdminUser = adminRow?.result === true;
    creditsNeeded = 10;
    if (!isAdminUser) {
      const deductRow = await queryOne("SELECT deduct_credits($1, $2) as result", [userId, creditsNeeded]);
      const deductResult = deductRow?.result;
      if (!deductRow) {
        return sendCorsResponse(res, 500, { error: "Kredi kontrol\xFC s\u0131ras\u0131nda hata olu\u015Ftu." });
      }
      if (!deductResult?.success) {
        return sendCorsResponse(res, 402, {
          error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.`
        });
      }
      console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
      creditsDeducted = true;
    }
    const imageRecord = await queryOne(
      "INSERT INTO images (user_id, scene_id, original_image_url, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, sceneId || null, imagePath, "analyzing"]
    );
    if (!imageRecord) throw new Error("Failed to create image record");
    const imageRecordId = imageRecord.id;
    const totalImages = isSinglePackage || isRetouchPackage ? 1 : validatedSelectedScenes ? validatedSelectedScenes.length : 6;
    const jobRecord = await queryOne(
      "INSERT INTO processing_jobs (user_id, image_record_id, status, total_images, completed_images, progress, current_step, credits_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [userId, imageRecordId, "pending", totalImages, 0, 0, "pending", isAdminUser ? 0 : creditsNeeded]
    );
    if (!jobRecord) throw new Error("Failed to create processing job");
    const jobRecordId = jobRecord.id;
    console.log(`Job created: ${jobRecordId}, Image record: ${imageRecordId}`);
    processGeneration({
      userId,
      imageRecordId,
      jobId: jobRecordId,
      imagePaths: [imagePath, ...validAdditionalPaths],
      validAdditionalPaths,
      sceneId: sceneId || null,
      packageType: packageType || "standard",
      productType: productType || null,
      metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null,
      aspectRatio,
      creditsNeeded,
      isAdminUser,
      selectedScenes: validatedSelectedScenes,
      customPrompt: validatedCustomPrompt
    }).catch((err) => console.error("Background generation error:", err));
    return sendCorsResponse(res, 200, {
      success: true,
      jobId: jobRecordId,
      imageId: imageRecordId,
      status: "pending"
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (creditsDeducted) {
      console.log(`Handler failed after credit deduction \u2014 refunding ${creditsNeeded} credits to user ${userId}`);
      try {
        await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
        console.log("Credits refunded successfully after handler failure");
      } catch (refundErr) {
        console.error("CRITICAL: Failed to refund credits after handler error:", refundErr);
      }
    }
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}

// api/generate-jewelry-v2.ts
var GOOGLE_IMAGE_API_KEY2 = process.env.GOOGLE_API_KEY;
var ANALYSIS_MODEL2 = "gemini-3.1-flash-lite-preview";
var IMAGE_GEN_MODEL2 = "gemini-3.1-flash-image-preview";
async function callGeminiAnalysis2(opts) {
  const apiKey = GOOGLE_IMAGE_API_KEY2;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");
  const parts = [{ text: opts.prompt }];
  if (opts.imageBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: opts.imageBase64 } });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL2}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.1,
        maxOutputTokens: opts.maxTokens ?? 2048
      }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini analysis error ${response.status}:`, errText.substring(0, 500));
    throw new Error(`Gemini analysis API error ${response.status}: ${errText.substring(0, 500)}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("Gemini analysis returned no candidates");
  if (candidate.finishReason === "SAFETY") throw new Error("Gemini analysis blocked by safety filter");
  const text = candidate.content?.parts?.[0]?.text || "{}";
  console.log(`Gemini analysis response: ${text.length} chars`);
  return text;
}
var MAX_IMAGE_SIZE2 = 1.5 * 1024 * 1024;
function arrayBufferToBase642(buffer) {
  return Buffer.from(buffer).toString("base64");
}
async function callGeminiImageGeneration2({
  base64Images,
  prompt,
  temperature = 0.12,
  aspectRatio = "3:4"
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL2}:generateContent?key=${GOOGLE_IMAGE_API_KEY2}`;
  const parts = [{ text: prompt }];
  for (const b64 of base64Images) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } });
  }
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature,
        imageConfig: { aspectRatio, imageSize: "4K" }
      }
    })
  });
}
async function generateSingleImage2(base64Images, prompt, userId, imageRecordId, index, _unused, jobId, aspectRatio = "3:4", startTemperature = 0.12) {
  const temperatures = [startTemperature, startTemperature + 0.05, startTemperature + 0.1];
  const delays = [0, 3e3, 5e3];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!GOOGLE_IMAGE_API_KEY2) return null;
      if (attempt > 0) {
        console.log(`Retry ${attempt}/2 for image ${index} with temperature ${temperatures[attempt]}...`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      const genResponse = await callGeminiImageGeneration2({
        base64Images,
        prompt,
        temperature: temperatures[attempt],
        aspectRatio
      });
      if (!genResponse.ok) {
        const errText = await genResponse.text();
        console.error(`Generation ${index} API error (${genResponse.status}) attempt ${attempt + 1}:`, errText);
        if (attempt >= 2) {
          try {
            await query("UPDATE processing_jobs SET error_message = $1 WHERE id = $2", [`Gemini API error ${genResponse.status}: ${errText.substring(0, 500)}`, jobId]);
          } catch (_) {
          }
          return null;
        }
        continue;
      }
      const genData = await genResponse.json();
      const parts = genData.candidates?.[0]?.content?.parts || [];
      let generatedImage = null;
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          generatedImage = part.inlineData.data;
          part.inlineData.data = null;
          break;
        }
      }
      if (!generatedImage) {
        if (attempt < 2) continue;
        return null;
      }
      const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
      generatedImage = null;
      const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
      const { error: uploadError } = await uploadFile("jewelry-images", filePath, imageBuffer, "image/png");
      if (!uploadError) {
        const { data: signedUrlData, error: signedUrlError } = await getSignedUrl("jewelry-images", filePath, 7 * 24 * 60 * 60);
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
function pickRandom2(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
var AESTHETIC_STYLES = [
  {
    key: "editorial_luxury",
    name: "Editorial Luxury",
    lightingMod: "Hard directional key light, deep shadows, high contrast. Single focused light source with minimal fill.",
    colorGrade: "Rich blacks, controlled highlights, slight warm lift in midtones. Zero grain. Clean commercial precision.",
    mood: "Powerful, authoritative, exclusive. The jewelry commands the frame.",
    reference: 'Cartier "Clash" campaign, Mario Sorrenti for Tiffany, Steven Meisel Vogue Italia.'
  },
  {
    key: "romantic_soft",
    name: "Romantic Soft",
    lightingMod: "Soft diffused light from large source. Gentle wrap-around illumination. Minimal shadows, ethereal glow.",
    colorGrade: "Warm pastel tones, lifted shadows to cream/blush. Soft roll-off on highlights. Slight haze effect.",
    mood: "Intimate, dreamy, tender. The jewelry feels like a love letter.",
    reference: `Van Cleef & Arpels "Poetry of Time", Paolo Roversi soft portraits, Dior J'adore.`
  },
  {
    key: "modern_minimal",
    name: "Modern Minimal",
    lightingMod: "Clean even lighting from overhead softbox. Sharp, controlled. No dramatic shadows.",
    colorGrade: "Neutral white balance, desaturated background, product at full saturation. Clinical precision.",
    mood: "Clean, architectural, contemporary. Less is more \u2014 the jewelry speaks for itself.",
    reference: "Celine by Phoebe Philo campaigns, Jil Sander, COS editorial."
  },
  {
    key: "bold_colorful",
    name: "Bold & Colorful",
    lightingMod: "Vibrant colored gels on accent lights. Strong rim light with complementary color fill.",
    colorGrade: "Saturated, punchy colors. High contrast with vivid midtones. Bold color blocking.",
    mood: "Energetic, youthful, daring. The jewelry is a statement piece.",
    reference: 'Bulgari "Magnifica", David LaChapelle color work, Versace campaigns.'
  },
  {
    key: "vintage_retro",
    name: "Vintage / Retro",
    lightingMod: "Warm tungsten-like light. Soft vignette at edges. Slightly diffused through vintage glass.",
    colorGrade: "Warm sepia undertone, faded blacks to brown, orange-shifted highlights. Film grain 8%. Halation on bright points.",
    mood: "Nostalgic, timeless, heritage. The jewelry carries stories from another era.",
    reference: "Helmut Newton 1970s editorial, Peter Lindbergh monochrome, Guy Bourdin color."
  },
  {
    key: "futuristic",
    name: "Futuristic",
    lightingMod: "Cool neon accents (blue/purple/cyan). Sharp geometric light patterns. Metallic reflections.",
    colorGrade: "Cool blue-silver base, neon accent colors. High contrast. Chrome-like highlights. Zero warmth.",
    mood: "Cutting-edge, otherworldly, tech-luxury. The jewelry is from tomorrow.",
    reference: "Blade Runner 2049 aesthetics, Iris van Herpen campaigns, Zaha Hadid architectural."
  }
];
var LENS_OPTIONS = [
  {
    key: "35mm",
    focal: "35mm f/2.0",
    description: "Wide-angle: captures environment context alongside jewelry. Slight perspective distortion adds dynamic energy. Full scene visible.",
    bestFor: ["model_lifestyle", "editorial"]
  },
  {
    key: "50mm",
    focal: "50mm f/1.8",
    description: "Standard natural perspective: closest to human eye. No distortion. Balanced framing between subject and environment.",
    bestFor: ["model_lifestyle", "editorial", "model"]
  },
  {
    key: "85mm",
    focal: "85mm f/1.4",
    description: "Portrait lens: beautiful background compression and bokeh. Flattering perspective for model shots. Jewelry sharp, background creamy.",
    bestFor: ["model", "model_closeup", "editorial"]
  },
  {
    key: "100mm_macro",
    focal: "100mm f/2.8 Macro (1:1)",
    description: "Macro lens: extreme detail resolution. Metal grain, stone facets, prong tips all visible. Near 1:1 magnification ratio.",
    bestFor: ["macro", "ecommerce"]
  }
];
var CAMERA_ANGLES = [
  { key: "eye_level", description: "Eye-level straight-on view, product/model centered", effect: "Neutral, direct connection. Product appears natural and approachable." },
  { key: "45_degree", description: "45-degree elevated angle looking down", effect: "Classic jewelry photography angle. Reveals top surface and dimension simultaneously." },
  { key: "birds_eye", description: "Flat-lay 90\xB0 overhead top-down view", effect: "Graphic, design-focused. Product becomes a pattern element. Instagram-optimized." },
  { key: "low_angle", description: "Low angle looking slightly upward at 15-20\xB0", effect: "Makes the piece appear grand, monumental, powerful. Dramatic hero shot." },
  { key: "pov", description: "Point-of-view as if looking at own hand/wrist/d\xE9colletage", effect: "Intimate first-person perspective. Viewer imagines wearing the piece." }
];
var LIGHTING_SETUPS = [
  {
    key: "soft_box",
    name: "Studio Softbox",
    description: "Large diffused softbox overhead and at 45\xB0 key position. Even, controlled illumination. Gentle shadow transitions. Professional studio standard.",
    temperature: "5500K daylight neutral",
    bestFor: ["ecommerce", "macro", "modern_minimal"]
  },
  {
    key: "rim_light",
    name: "Dramatic Rim Light",
    description: "Strong backlight creating luminous edge glow around the jewelry silhouette. Minimal front fill. Metal edges glow brilliantly.",
    temperature: "5000K neutral-cool",
    bestFor: ["editorial", "macro", "futuristic"]
  },
  {
    key: "golden_hour",
    name: "Golden Hour",
    description: "Warm directional light from low angle (10 o'clock position). Long shadows, golden highlights. Natural outdoor feeling.",
    temperature: "3200K warm golden",
    bestFor: ["editorial", "model_lifestyle", "romantic_soft"]
  },
  {
    key: "window_light",
    name: "Natural Window Light",
    description: "Soft side light from large window source. Beautiful gradient from lit to shadow side. Natural, editorial atmosphere.",
    temperature: "4500K warm neutral",
    bestFor: ["model", "model_closeup", "romantic_soft"]
  },
  {
    key: "dramatic_shadow",
    name: "Dramatic Shadow (Chiaroscuro)",
    description: "Single hard point light source. Deep chiaroscuro contrast \u2014 jewelry emerges from darkness. Film-noir mood.",
    temperature: "4000K warm-neutral",
    bestFor: ["editorial", "macro", "editorial_luxury"]
  },
  {
    key: "butterfly",
    name: "Butterfly / Paramount Light",
    description: "Key light directly above and in front. Classic beauty lighting. Subtle shadow beneath nose/chin on model. Even illumination on jewelry.",
    temperature: "5500K daylight",
    bestFor: ["model", "model_closeup", "editorial_luxury"]
  },
  {
    key: "split",
    name: "Split Light",
    description: "Light from exact 90\xB0 side \u2014 half illuminated, half in deep shadow. Maximum drama and editorial edge.",
    temperature: "5000K neutral",
    bestFor: ["editorial", "model", "bold_colorful"]
  }
];
var EDITORIAL_SCENE_POOL2 = [
  { name: "Golden Hour Rooftop", category: "outdoor", prompt: "Luxury rooftop terrace at golden hour. City skyline softly blurred in bokeh behind the jewelry. Warm amber directional light from setting sun. Polished stone ledge as placement surface. Cinematic depth, aspirational metropolitan luxury." },
  { name: "Mediterranean Garden Terrace", category: "outdoor", prompt: "Olive tree garden terrace in Provence style. Dappled sunlight filtering through leaves creates organic light patterns on the jewelry. Weathered stone table surface. Soft green and warm gold color palette. Editorial travel-luxury atmosphere." },
  { name: "Beach at Dawn", category: "outdoor", prompt: "Blue hour beach scene at dawn. Jewelry placed on wet sand with mirror-like reflections. Cool blue-silver atmosphere with first warm light on horizon. Gentle wave traces nearby. Serene, ethereal coastal luxury." },
  { name: "Autumn Vineyard", category: "outdoor", prompt: "Vineyard estate during golden hour in autumn. Wine barrel or aged wood surface. Warm amber and burgundy fall foliage softly blurred behind. Rich harvest atmosphere. European heritage luxury editorial." },
  { name: "Desert Dunes Sunset", category: "outdoor", prompt: "Desert sand dune at sunset. Jewelry on smooth sand ridge with long dramatic shadows. Warm orange-to-purple gradient sky. Exotic, adventurous luxury. Wind-sculpted sand patterns frame the piece." },
  { name: "Snow Alpine Morning", category: "outdoor", prompt: "Crisp alpine winter morning. Jewelry on ice crystal surface with snow-capped mountains in soft focus behind. Pure white and pale blue palette. Sharp cold light with prismatic highlights. Clean, pure winter luxury." },
  { name: "Cartier Window Display", category: "campaign", prompt: "High-end jewelry boutique window display at night. Deep navy blue velvet platform with museum-grade spot lighting. Warm gold accent lights. Dark exterior reflections in glass. Exclusive, prestigious campaign atmosphere." },
  { name: "Tiffany Blue Perfection", category: "campaign", prompt: "Pristine white lacquered surface with iconic soft blue gradient backdrop. Perfect three-point studio lighting. Immaculate, minimal, aspirational. Luxury brand campaign precision with zero distractions." },
  { name: "Van Cleef Garden Fantasy", category: "campaign", prompt: "Fresh white peony flowers arranged artfully around the jewelry. Sage green watercolor-wash background. Soft diffused natural light. Romantic garden luxury. Poetic, feminine campaign editorial." },
  { name: "Noir Glamour Campaign", category: "campaign", prompt: "Single dramatic spotlight on glossy black lacquered surface. Deep chiaroscuro lighting \u2014 jewelry emerges from darkness. Strong contrast, film-noir mood. Bold, seductive luxury campaign." },
  { name: "Heritage Auction House", category: "campaign", prompt: "Antique mahogany display with burgundy leather inlay. Gilt gold frame partially visible. Warm museum lighting with focused spot on jewelry. Rich patina, heritage storytelling. Auction house prestige." },
  { name: "Modern Minimalist Campaign", category: "campaign", prompt: "Pure white studio cyclorama with three-point professional lighting. Clean infinity curve background. No shadows, no distractions. Surgical precision lighting reveals every facet. Contemporary luxury brand campaign." },
  { name: "Backstage Fashion Week", category: "fashion", prompt: "Fashion week backstage styling table. Ring light reflections visible. Raw, energetic atmosphere with hairspray mist in air. Professional chaos aesthetic. Behind-the-scenes editorial energy." },
  { name: "Editorial Studio Infinity", category: "fashion", prompt: "Desaturated mauve seamless backdrop. Profoto beauty dish overhead creating soft wraparound light. Minimal styling. High-fashion editorial simplicity with muted color palette. Magazine cover quality." },
  { name: "Haute Couture Atelier", category: "fashion", prompt: "Couture atelier cutting table with raw silk organza fabric partially draped nearby. Soft north-facing atelier window light. Pins, thread spools subtly blurred in background. Artisan craftsmanship atmosphere." },
  { name: "Vogue Still Life", category: "fashion", prompt: "Moody editorial flat-lay composition with luxury accessories. Dark textured surface. Dramatic overhead spotlight with deep shadows. Art-directed styling with negative space. Magazine spread quality." },
  { name: "Paris Apartment Morning", category: "fashion", prompt: "Haussmann-style Parisian apartment. Jewelry on marble mantelpiece. Sheer tulle curtain diffusing soft morning light. Ornate molding softly blurred. Romantic Parisian editorial lifestyle." },
  { name: "Marble Foyer Grand Entrance", category: "architectural", prompt: "Grand Calacatta marble foyer. Crystal chandelier creating sparkling highlights overhead. Palatial architecture with arched doorways in soft focus. Warm ambient luxury. Five-star hotel entrance grandeur." },
  { name: "Art Gallery White Cube", category: "architectural", prompt: "Contemporary art gallery white plinth display. Track lighting from above creating precise illumination. White cube gallery space. Clean, curated, institutional luxury presentation." },
  { name: "Silk Cascade", category: "texture", prompt: "Jewelry resting on cascading folds of cream silk fabric. Soft diffused overhead light creates delicate shadow-light interplay along the silk curves. Warm champagne and ivory tonal palette. Intimate, sensual, haute couture still life." },
  { name: "Raw Marble Quarry", category: "texture", prompt: "Jewelry placed on a raw Calacatta marble block, natural gold veins running through white stone. Hard natural daylight from above creates stark shadows. Industrial luxury \u2014 raw meets refined." },
  { name: "Liquid Gold Pour", category: "texture", prompt: "Surreal campaign: jewelry appears to float on a surface of liquid molten gold. Metallic liquid creates rippling reflections and warm golden light from below. Ultra-luxury, avant-garde advertising aesthetic." },
  { name: "Underwater Pearl Garden", category: "creative", prompt: "Ethereal underwater atmosphere surrounding the jewelry. Tiny air bubbles float upward through blue-green water. Scattered sea shells on sandy bed below. Caustic light patterns dance across the scene. Dreamlike, poetic, otherworldly luxury." },
  { name: "Frozen in Crystal", category: "creative", prompt: "Jewelry resting upon crystal-clear ice formations. Arctic blue-white color palette with prismatic light refractions creating rainbow spectra. Frost crystals frame the edges. Ultra-clean, pure, winter luxury campaign." },
  { name: "Volcanic Obsidian", category: "creative", prompt: "Jewelry placed on glossy black obsidian volcanic glass surface. Subtle orange-red volcanic glow in far background. Extreme contrast between deep black surface and brilliantly lit jewelry. Primordial luxury \u2014 ancient earth meets refined craftsmanship." },
  { name: "Brutalist Concrete Gallery", category: "architectural_statement", prompt: "Jewelry displayed on raw exposed concrete in a brutalist gallery space. Single dramatic spotlight from above creates precise circle of light. Contemporary art museum aesthetic \u2014 jewelry as sculptural art object." },
  { name: "Japanese Zen Garden", category: "architectural_statement", prompt: "Jewelry on smooth river stone within miniature Japanese zen garden. Raked white sand with precise parallel lines. Meditative calm, wabi-sabi aesthetic. Muted earth tones." },
  { name: "Film Noir Detective Desk", category: "cinematic", prompt: "Film noir: jewelry on dark wooden desk. Hard light strips from venetian blinds create dramatic parallel shadow lines. Near-monochromatic palette \u2014 deep blacks, bright whites, minimal warm sepia." },
  { name: "Baroque Opera Box", category: "cinematic", prompt: "Jewelry on gilded velvet railing of baroque opera box seat. Rich red velvet and ornate gold-leaf decorations. Warm theatrical stage lighting creates dramatic golden glow. Theatrical, opulent, grandiose." },
  { name: "Cyberpunk Neon Alley", category: "cinematic", prompt: "Jewelry on rain-wet dark surface in futuristic neon-lit alleyway. Blue, purple, and hot pink neon reflections off wet ground. Blade Runner aesthetic meets luxury advertising. Future-noir, tech-luxury." },
  { name: "Old Hollywood Vanity", category: "cinematic", prompt: "Jewelry on classic Old Hollywood vanity table. Makeup mirror with exposed warm bulbs creates soft flattering light. Golden age glamour \u2014 1950s starlet dressing room." },
  { name: "Eclipse Horizon", category: "cinematic", prompt: "Cosmic backdrop: jewelry in foreground with total solar eclipse on horizon behind. Corona creates dramatic golden rim-light halo illuminating the jewelry from behind. Awe-inspiring, cosmic, mythic scale." }
];
var COLOR_GRADE_MODIFIERS2 = {
  outdoor: "Warm natural tones, lifted shadows to deep brown, golden highlights with soft roll-off. Film grain 5%. REFERENCE: Peter Lindbergh outdoor editorial.",
  campaign: "Precise, controlled commercial. Neutral WB with subtle warmth. Pure blacks, clean whites. Zero grain. REFERENCE: Cartier campaign precision.",
  fashion: "Moody editorial desaturation. Cool shadows, warm highlights. Muted except jewelry (full saturation). REFERENCE: Vogue Italia, Steven Meisel.",
  architectural: "Warm amber with cool shadow accents. Rich mid-tones. Subtle vignette. REFERENCE: Architectural Digest meets luxury campaign.",
  surface: "Deep dramatic. Rich blacks with warm undertone. Jewelry brightest element. High contrast, smooth transitions. REFERENCE: Patek Philippe campaign.",
  texture: "Rich material emphasis, tactile quality. Warm mid-tones with deep shadows. Jewelry maintains full brilliance. REFERENCE: Celine campaign material study.",
  creative: "Surreal color grading, heightened saturation on jewelry. Chromatic contrasts between warm jewelry and fantastical surroundings. REFERENCE: Tim Walker meets luxury.",
  architectural_statement: "Geometric light patterns, structural shadows. Precise architectural lighting with warm accents on jewelry. REFERENCE: Tadao Ando meets Bulgari.",
  cinematic: "Film-grade color science, anamorphic feel with subtle halation. Rich shadows, cinematic contrast. Warm practicals, cool ambient. REFERENCE: Roger Deakins meets luxury."
};
var CHARACTER_GAZE2 = [
  "Direct eye contact with camera \u2014 confident, magnetic, editorial intensity",
  "Looking slightly past camera (10\xB0 off-axis) \u2014 mysterious, editorial detachment",
  "Downcast eyes with subtle smile \u2014 intimate, contemplative luxury moment",
  "Gazing at the jewelry piece with admiration \u2014 drawing viewer attention to product",
  "Three-quarter profile gaze toward soft light source \u2014 cinematic, painterly",
  "Eyes closed, serene expression \u2014 meditative, haute-couture editorial stillness"
];
var CHARACTER_EXPRESSIONS2 = [
  "Confident and poised \u2014 strong jawline, relaxed brow, slight knowing smile",
  "Softly sensual \u2014 parted lips, relaxed gaze, effortless allure",
  "Editorial stoic \u2014 neutral expression, high-fashion detachment, angular features",
  "Warm and natural \u2014 genuine soft smile, approachable luxury",
  "Regal and commanding \u2014 chin slightly raised, strong posture, aristocratic bearing",
  "Dreamy and ethereal \u2014 soft focus expression, luminous skin, romantic atmosphere"
];
var CHARACTER_PERSONAS2 = [
  {
    name: "Defne Aydin",
    age: 27,
    heritage: "Turkish-Mediterranean",
    skinTone: "Olive gold",
    skinUndertone: "warm",
    hairColor: "Dark chestnut with honey highlights",
    hairTexture: "waves",
    hairSignature: "Loose cascading waves with sun-kissed honey highlights",
    eyeColor: "Amber-brown",
    faceShape: "Oval with elegant jawline",
    bodyType: "Slim-athletic",
    height: "175cm",
    signatureLook: "Cartier & Bulgari campaign warmth",
    fashionVibe: "Mediterranean luxury, warm golden tones",
    bestFor: ["yuzuk", "kolye", "kupe"],
    postureLanguage: "Spine elongated, shoulders pulled back and dropped \u2014 like a dancer. Weight shifted to one hip creating S-curve.",
    editorialEnergy: "Quiet Mediterranean confidence \u2014 she does not SEEK attention, she RECEIVES it.",
    signatureMannerism: "One hand always finds a surface or body contact \u2014 collarbone, railing, hair.",
    outfitArchetype: "Structured blazer over silk camisole OR tailored linen separates.",
    outfitPalette: "Warm neutrals: camel, ivory, terracotta, olive.",
    accessoryStyle: "Oversized tortoiseshell sunglasses, structured leather bag",
    fabricPreference: "Silk, linen, cashmere, fine leather \u2014 natural fibers catching light",
    editorialReference: "Pamela Hanson for Vogue Travel, Mario Testino Gucci campaigns",
    strengthAsModel: "Skin catches golden hour light like bronze. Natural warmth makes jewelry feel personal."
  },
  {
    name: "Elif Kara",
    age: 24,
    heritage: "Turkish-Anatolian",
    skinTone: "Fair porcelain",
    skinUndertone: "cool pink",
    hairColor: "Jet black",
    hairTexture: "straight sleek",
    hairSignature: "Perfectly sleek straight hair with mirror-like shine",
    eyeColor: "Green-hazel",
    faceShape: "Heart-shaped",
    bodyType: "Slim",
    height: "178cm",
    signatureLook: "Chanel haute couture editorial",
    fashionVibe: "Cool-toned elegance, high-fashion precision",
    bestFor: ["kupe", "kolye", "saat"],
    postureLanguage: "Military-precise posture softened by slight forward lean. Shoulders blade-sharp.",
    editorialEnergy: "Ice-cool haute couture detachment \u2014 the kind of beauty that makes people nervous.",
    signatureMannerism: "Chin micro-tilt downward before looking up through lashes \u2014 dramatic reveal.",
    outfitArchetype: "Minimalist column dress OR sharp black turtleneck with tailored trousers.",
    outfitPalette: "Black, white, charcoal, midnight navy. No warm tones.",
    accessoryStyle: "Geometric structured clutch in black patent",
    fabricPreference: "Heavy silk crepe, cashmere, structured wool \u2014 architectural fabrics",
    editorialReference: "Karl Lagerfeld Chanel campaigns, Peter Lindbergh monochrome",
    strengthAsModel: "Porcelain skin creates maximum contrast with jewelry metals."
  },
  {
    name: "Zeynep Demir",
    age: 30,
    heritage: "Turkish-Aegean",
    skinTone: "Warm honey-tan",
    skinUndertone: "golden",
    hairColor: "Rich dark brown",
    hairTexture: "loose waves",
    hairSignature: "Voluminous loose waves with natural movement",
    eyeColor: "Deep brown",
    faceShape: "Angular diamond with high cheekbones",
    bodyType: "Proportional",
    height: "173cm",
    signatureLook: "Piaget & Van Cleef warmth",
    fashionVibe: "Warm approachable luxury, natural radiance",
    bestFor: ["bileklik", "yuzuk", "genel"],
    postureLanguage: "Relaxed but present \u2014 like someone who just finished yoga and put on couture.",
    editorialEnergy: "Approachable luxury \u2014 the woman at the gala you actually want to talk to.",
    signatureMannerism: "Unconsciously rotates rings or touches bracelets \u2014 organic jewelry interaction.",
    outfitArchetype: "Flowing Mediterranean linen separates OR cashmere wrap with wide trousers.",
    outfitPalette: "Sand, honey, soft gold, warm white, muted terracotta.",
    accessoryStyle: "Woven leather sandals, simple gold-frame sunglasses",
    fabricPreference: "Washed linen, soft cashmere, raw silk \u2014 fabrics that move and breathe",
    editorialReference: "Cass Bird natural light portraits, Inez & Vinoodh for Van Cleef",
    strengthAsModel: "High cheekbones create beautiful shadow play. Hands particularly photogenic."
  },
  {
    name: "Selin Ozturk",
    age: 26,
    heritage: "Turkish-Balkan",
    skinTone: "Light olive",
    skinUndertone: "neutral",
    hairColor: "Dark auburn",
    hairTexture: "structured updo",
    hairSignature: "Architecturally structured updo revealing neck and ears",
    eyeColor: "Hazel with gold flecks",
    faceShape: "Square jawline, strong features",
    bodyType: "Athletic",
    height: "176cm",
    signatureLook: "Tom Ford & Saint Laurent edge",
    fashionVibe: "Sharp editorial power, modern edge",
    bestFor: ["saat", "bileklik", "yuzuk"],
    postureLanguage: "Shoulders squared, spine steel-straight. Occupies space unapologetically.",
    editorialEnergy: "Corporate power meets fashion edge.",
    signatureMannerism: "Adjusts watch or cuff instinctively \u2014 executive gesture.",
    outfitArchetype: "Sharp leather jacket over turtleneck OR power-cut blazer.",
    outfitPalette: "Black, charcoal, burgundy, dark olive.",
    accessoryStyle: "Structured leather portfolio, ankle boots",
    fabricPreference: "Butter-soft leather, heavy silk, structured wool gabardine",
    editorialReference: "Tom Ford campaign precision, Hedi Slimane Saint Laurent",
    strengthAsModel: "Strong jawline and architectural updo create perfect frame for earrings."
  },
  {
    name: "Naz Yilmaz",
    age: 32,
    heritage: "Turkish-Persian",
    skinTone: "Rich warm olive",
    skinUndertone: "deep golden",
    hairColor: "Black voluminous",
    hairTexture: "wavy",
    hairSignature: "Full voluminous black waves with dramatic body",
    eyeColor: "Dark brown",
    faceShape: "Oval, soft features",
    bodyType: "Curvy-proportional",
    height: "170cm",
    signatureLook: "Dolce & Gabbana Mediterranean glam",
    fashionVibe: "Rich, sensual Mediterranean glamour",
    bestFor: ["kolye", "kupe", "genel"],
    postureLanguage: "Languid, feline grace. Head often tilted 10 degrees.",
    editorialEnergy: "Sensual Mediterranean warmth \u2014 like a Fellini actress between takes.",
    signatureMannerism: "Runs fingers through voluminous hair \u2014 dramatic movement, reveals earrings.",
    outfitArchetype: "Evening column dress with one shoulder OR flowing silk wrap dress.",
    outfitPalette: "Deep burgundy, emerald, black, champagne gold.",
    accessoryStyle: "Vintage-style evening clutch, silk hair clip",
    fabricPreference: "Heavy silk satin, velvet, fine jersey \u2014 fabrics that drape around curves",
    editorialReference: "Dolce & Gabbana Alta Moda, Paolo Roversi soft focus",
    strengthAsModel: "Voluminous hair creates dramatic frame. Deep skin tone makes gold glow."
  },
  {
    name: "Ceren Aksoy",
    age: 25,
    heritage: "Turkish-Circassian",
    skinTone: "Fair luminous",
    skinUndertone: "warm peach",
    hairColor: "Platinum-highlighted brown",
    hairTexture: "tousled",
    hairSignature: "Effortlessly tousled platinum-highlighted waves",
    eyeColor: "Blue-grey",
    faceShape: "High cheekbones, delicate features",
    bodyType: "Slim",
    height: "177cm",
    signatureLook: "Dior & Tiffany ethereal",
    fashionVibe: "Ethereal, dreamlike, luminous beauty",
    bestFor: ["kupe", "kolye", "yuzuk"],
    postureLanguage: "Weightless, floating quality \u2014 as if gravity is optional.",
    editorialEnergy: "Dreamy ethereal presence \u2014 she exists slightly outside of time.",
    signatureMannerism: "Looks away then slowly turns toward camera \u2014 cinematic reveal.",
    outfitArchetype: "Sheer layered blouse over camisole OR ethereal midi dress.",
    outfitPalette: "Ivory, blush, pale grey, soft lavender, champagne.",
    accessoryStyle: "Silk ribbon in hair, vintage porcelain-handle clutch",
    fabricPreference: "Silk organza, chiffon, fine lace, soft tulle \u2014 transparent fabrics",
    editorialReference: "Tim Walker fantasy editorials, Dior J'adore romanticism",
    strengthAsModel: "Luminous fair skin makes diamonds sparkle. Blue-grey eyes create otherworldly contrast."
  },
  {
    name: "Asli Korkmaz",
    age: 29,
    heritage: "Turkish-Kurdish",
    skinTone: "Medium-tan",
    skinUndertone: "warm caramel",
    hairColor: "Very dark brown",
    hairTexture: "slicked-back",
    hairSignature: "Sleek slicked-back hair emphasizing strong bone structure",
    eyeColor: "Brown-amber",
    faceShape: "Strong angular, defined jawline",
    bodyType: "Athletic-slim",
    height: "174cm",
    signatureLook: "Versace & Boucheron power",
    fashionVibe: "Powerful, commanding, bold luxury",
    bestFor: ["saat", "bileklik", "genel"],
    postureLanguage: "Commanding stillness. Chin level, gaze direct. Stands like a monument.",
    editorialEnergy: "Raw power channeled through stillness \u2014 like a panther at rest.",
    signatureMannerism: "Crosses arms with one wrist forward \u2014 natural watch/bracelet showcase.",
    outfitArchetype: "All-black power ensemble \u2014 sharp blazer, silk shirt, tailored trousers.",
    outfitPalette: "Black, deep charcoal, midnight. Monochromatic power.",
    accessoryStyle: "Structured leather briefcase-style bag, minimal pointed-toe heels",
    fabricPreference: "Matte black wool, heavy silk charmeuse, structured leather",
    editorialReference: "Versace Medusa campaigns, Mert & Marcus high-contrast",
    strengthAsModel: "Slicked-back hair fully exposes ears/neck \u2014 ideal for earring/necklace drama."
  },
  {
    name: "Ipek Sahin",
    age: 28,
    heritage: "Turkish-Levantine",
    skinTone: "Medium olive",
    skinUndertone: "neutral-warm",
    hairColor: "Dark brown",
    hairTexture: "side-parted elegant",
    hairSignature: "Elegant side-parted dark brown with soft drape",
    eyeColor: "Warm brown",
    faceShape: "Soft round, gentle features",
    bodyType: "Proportional",
    height: "171cm",
    signatureLook: "Chopard & Bvlgari classic",
    fashionVibe: "Timeless classic elegance, refined warmth",
    bestFor: ["yuzuk", "kolye", "bileklik", "genel"],
    postureLanguage: "Classic elegance \u2014 spine straight but not stiff, hands always graceful.",
    editorialEnergy: "Timeless sophistication \u2014 era-transcendent.",
    signatureMannerism: "Delicately touches pendant or necklace \u2014 intimate jewelry interaction.",
    outfitArchetype: "Classic white button-down with premium denim OR cashmere turtleneck.",
    outfitPalette: "Cream, navy, camel, soft grey, white. Classic neutrals.",
    accessoryStyle: "Vintage-style leather handbag, silk neck scarf, classic pumps",
    fabricPreference: "Fine cotton poplin, premium cashmere, brushed wool \u2014 heritage fabrics",
    editorialReference: "Chopard Red Carpet campaigns, Irving Penn classic portraits",
    strengthAsModel: "Gentle features make jewelry the star. Neutral-warm skin flatters every metal."
  }
];
var OUTFIT_POOL2 = [
  { name: "Power Tailoring", description: "Oversized blazer in neutral tone over silk camisole, tailored wide-leg trousers.", colorPalette: "Charcoal, navy, camel, ivory, black", fabrics: "Wool crepe blazer, silk charmeuse camisole", neckline: "Deep V from blazer lapels \u2014 ideal for necklace visibility", sleeveType: "Long blazer sleeves slightly pushed up \u2014 wrist partially exposed", accessoryNotes: "Structured leather clutch. Minimal.", bestFor: ["kolye", "kupe", "saat", "bileklik"] },
  { name: "Mediterranean Luxe", description: "Flowing linen blouse with relaxed drape, wide-leg palazzo trousers.", colorPalette: "White, sand, terracotta, olive, soft gold", fabrics: "Washed linen, raw silk, light cotton voile", neckline: "Open collar or boat neck \u2014 d\xE9colletage visible", sleeveType: "Rolled-up or three-quarter \u2014 full wrist exposure", accessoryNotes: "Woven straw bag, tortoiseshell sunglasses", bestFor: ["kolye", "bileklik", "yuzuk", "kupe"] },
  { name: "Evening Minimalist", description: "One-shoulder or strapless column dress in solid color.", colorPalette: "Black, midnight navy, champagne, deep burgundy, emerald", fabrics: "Silk crepe, satin, structured jersey", neckline: "One-shoulder or strapless \u2014 maximum exposure", sleeveType: "Sleeveless \u2014 arms fully exposed", accessoryNotes: "No bag. Dress is canvas, jewelry is art.", bestFor: ["kupe", "kolye", "bileklik", "yuzuk"] },
  { name: "Street Luxe Editorial", description: "Fitted leather jacket over black turtleneck, slim trousers.", colorPalette: "Black, charcoal, burgundy, dark chocolate", fabrics: "Soft leather, fine merino wool turtleneck", neckline: "High turtleneck \u2014 frames face for earring focus", sleeveType: "Jacket sleeves ending at wrist \u2014 bracelet peek", accessoryNotes: "Structured ankle boots, no bag", bestFor: ["kupe", "saat", "yuzuk"] },
  { name: "White Canvas", description: "Crisp white button-down shirt tucked into classic indigo jeans.", colorPalette: "Pure white, classic indigo denim", fabrics: "Crisp cotton poplin, premium denim", neckline: "Open collar V \u2014 versatile for necklaces", sleeveType: "Sleeves rolled to mid-forearm \u2014 ideal wrist exposure", accessoryNotes: "Simple leather belt. No competing accessories.", bestFor: ["kolye", "kupe", "yuzuk", "bileklik", "saat", "genel"] }
];
var PRODUCT_TYPE_MODEL_CONFIG2 = {
  yuzuk: {
    bodyRegion: "hand and fingers",
    poses: [
      "Model's hand gracefully touching collarbone, ring prominently visible on finger. Fingers slightly spread for clarity.",
      "Hand gently framing face near jawline, ring in razor-sharp focus. Dreamy expression with soft eye contact.",
      "Hand running through tousled hair, ring catching a spark of light. Candid editorial moment.",
      "Both hands together near chin in contemplative pose, ring as absolute centerpiece.",
      "Hand resting on bare shoulder, ring visible against luminous skin. Three-quarter profile.",
      "Hand elegantly draped over edge of dark surface, ring catching dramatic side-light.",
      "Model examining ring on her own hand \u2014 intimate, admiring moment."
    ]
  },
  bileklik: {
    bodyRegion: "wrist",
    poses: [
      "Wrist resting elegantly on marble surface, bracelet draped naturally with golden catch-light.",
      "Arm raised with hand in hair, bracelet sliding naturally on wrist.",
      "Wrist extended forward toward camera, bracelet in sharp macro focus.",
      "Hand reaching for champagne flute \u2014 bracelet sliding toward wrist bone. Candid luxury.",
      "Wrist draped over arm of velvet chair \u2014 bracelet dangling with gravity.",
      "Forearm resting on window ledge with soft natural light \u2014 bracelet glowing."
    ]
  },
  kupe: {
    bodyRegion: "ear and profile",
    poses: [
      "Pure side profile with hair swept behind ear. Earring fully visible. Clean jawline, neck elongated.",
      "Three-quarter view looking over shoulder, earring prominent against neck silhouette.",
      "Head tilted 15\xB0 toward camera, earring swaying with captured micro-movement.",
      "Hair swept up in elegant chignon, both earrings visible from frontal three-quarter angle.",
      "Extreme close-up of ear and jawline \u2014 earring filling the frame. Macro-portrait hybrid.",
      "Model laughing naturally with head tilted \u2014 earring caught in mid-swing. Candid warmth."
    ]
  },
  kolye: {
    bodyRegion: "neck and d\xE9colletage",
    poses: [
      "Straight-on d\xE9colletage view, necklace centered. Clean neckline \u2014 off-shoulder or strapless.",
      "Slight head tilt with eyes lowered toward necklace \u2014 creating viewer gaze path to product.",
      "Profile view showing necklace chain flowing along neck curve. Artistic negative space.",
      "Three-quarter view with hand delicately touching pendant \u2014 drawing attention.",
      "Head thrown back slightly, necklace displayed on elongated neck. Sensual luxury.",
      "Standing in doorframe silhouette, necklace catching the only light source."
    ]
  },
  saat: {
    bodyRegion: "wrist",
    poses: [
      "Wrist check pose \u2014 glancing at watch face with quiet confidence. Business editorial.",
      "Forearm on dark wood surface, watch dial angled toward camera. Relaxed luxury.",
      "Hand adjusting jacket sleeve cuff, revealing watch naturally.",
      "Crossed arms with watch prominently visible on top wrist. Power pose.",
      "Hand writing with fountain pen \u2014 watch visible on writing wrist. Intellectual luxury.",
      "Wrist on balcony railing with city skyline bokeh \u2014 watch prominent."
    ]
  },
  genel: {
    bodyRegion: "full portrait",
    poses: [
      "Elegant three-quarter portrait with jewelry as natural complement.",
      "Editorial fashion pose \u2014 angular body position, architectural composition.",
      "Soft natural portrait with genuine expression. Approachable luxury.",
      "Dramatic profile silhouette with jewelry catching rim light.",
      "Close-up portrait from chest up \u2014 jewelry framed by clean neckline."
    ]
  }
};
var EDITORIAL_ENERGY_DIRECTIVE2 = `
MODEL BEHAVIOR (MANDATORY):
- Model is EXISTING in a moment, not posing for a photo.
- Body tension: 30% \u2014 not rigid, not collapsed.
- Every gesture has INTENTION.
- Weight distribution NATURAL \u2014 organic S-curve.
- Spine LONG, shoulders DOWN and BACK.
- Eyes have DEPTH \u2014 thinking, not staring.
- Overall: "This person has somewhere important to be after this photo."`;
function buildSixBlockJSON(blocks) {
  return `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
V2 PROMPT ENGINE \u2014 6-BLOCK STRUCTURED FORMAT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

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
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`;
}
function selectLens(sceneType, userLens) {
  if (userLens) {
    const found = LENS_OPTIONS.find((l) => l.key === userLens);
    if (found) return found;
  }
  const matching = LENS_OPTIONS.filter((l) => l.bestFor.includes(sceneType));
  return matching.length > 0 ? pickRandom2(matching) : pickRandom2(LENS_OPTIONS);
}
function selectAngle(userAngle) {
  if (userAngle) {
    const found = CAMERA_ANGLES.find((a) => a.key === userAngle);
    if (found) return found;
  }
  return pickRandom2(CAMERA_ANGLES);
}
function selectLighting(sceneType, aestheticKey, userLighting) {
  if (userLighting) {
    const found = LIGHTING_SETUPS.find((l) => l.key === userLighting);
    if (found) return found;
  }
  const byAesthetic = aestheticKey ? LIGHTING_SETUPS.filter((l) => l.bestFor.includes(aestheticKey)) : [];
  if (byAesthetic.length > 0) return pickRandom2(byAesthetic);
  const byScene = LIGHTING_SETUPS.filter((l) => l.bestFor.includes(sceneType));
  return byScene.length > 0 ? pickRandom2(byScene) : pickRandom2(LIGHTING_SETUPS);
}
function selectAesthetic(userAesthetic) {
  if (userAesthetic) {
    const found = AESTHETIC_STYLES.find((a) => a.key === userAesthetic);
    if (found) return found;
  }
  return pickRandom2(AESTHETIC_STYLES);
}
function buildProductIdentityCard2(analysisResult, imageIndex, totalImages) {
  const crossImageLine = imageIndex != null && totalImages != null ? `
CROSS-IMAGE CONSISTENCY: This is image ${imageIndex} of ${totalImages}. The jewelry MUST be INDISTINGUISHABLE from the same piece in other images.
` : "";
  const visualDna = analysisResult.visual_dna;
  const dnaBlock = visualDna ? `
VISUAL DNA:
- Silhouette: ${visualDna.silhouette_descriptor || "N/A"}
- Visual Axis: ${visualDna.dominant_visual_axis || "N/A"}
- Light Signature: ${visualDna.light_signature || "N/A"}
- Color Map: ${visualDna.color_relationship_map || "N/A"}
- Scale: ${visualDna.scale_anchor || "N/A"}
- Asymmetries: ${visualDna.distinguishing_asymmetries || "none"}
- Optical Weight Center: ${visualDna.optical_weight_center || "center"}` : "";
  return `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PRODUCT IDENTITY CARD \u2014 THIS JEWELRY MUST LOOK IDENTICAL IN EVERY IMAGE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${crossImageLine}
TYPE: ${analysisResult.type || "jewelry"}
${analysisResult.visual_fingerprint ? `FINGERPRINT: ${analysisResult.visual_fingerprint}` : ""}
${dnaBlock}

STONES: Exactly ${analysisResult.structure?.center_stone_count ?? "?"} center + ${analysisResult.structure?.accent_stone_count ?? "0"} accent stones.
PRONGS: Exactly ${analysisResult.structure?.total_prong_count ?? "as shown"} prongs in ${analysisResult.structure?.prong_style ?? "original"} style.
PROPORTIONS: ${analysisResult.proportions?.length_to_width_ratio ?? "1.0"} L:W ratio, ${analysisResult.proportions?.overall_profile ?? "standard"} profile.

ANY deviation from this identity card is a CRITICAL ERROR.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`.trim();
}
function buildEditorialPromptV2(analysisResult, fidelityBlock, productExtractionBlock, identityCard, aesthetic, userLens, userAngle, userLighting) {
  const categories = Array.from(new Set(EDITORIAL_SCENE_POOL2.map((s) => s.category)));
  const chosenCategory = pickRandom2(categories);
  const scenesInCategory = EDITORIAL_SCENE_POOL2.filter((s) => s.category === chosenCategory);
  const scene = pickRandom2(scenesInCategory);
  const lens = selectLens("editorial", userLens);
  const angle = selectAngle(userAngle);
  const lighting = selectLighting("editorial", aesthetic.key, userLighting);
  console.log(`V2 Editorial \u2014 Scene: ${scene.name} [${scene.category}], Aesthetic: ${aesthetic.name}, Lens: ${lens.key}, Angle: ${angle.key}, Light: ${lighting.key}`);
  const sixBlock = buildSixBlockJSON({
    shot: `Editorial luxury jewelry photography. ${scene.prompt}`,
    lens: `${lens.focal} \u2014 ${lens.description}`,
    light: `${lighting.name}: ${lighting.description} Color temp: ${lighting.temperature}. AESTHETIC MOD: ${aesthetic.lightingMod}`,
    texture: `Metal: ${analysisResult.metal?.type || "gold"} ${analysisResult.metal?.finish || "polished"} \u2014 realistic surface reflections and micro-texture. Stone: natural light behavior with fire, brilliance, scintillation. Scene surface: as defined by scene setting.`,
    composition: `${angle.description}. ${angle.effect} The jewelry is the clear focal point \u2014 scene complements, never distracts. Shallow depth of field with soft bokeh.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood} ${aesthetic.reference}. COLOR GRADE: ${aesthetic.colorGrade}. SCENE COLOR: ${COLOR_GRADE_MODIFIERS2[scene.category] || ""}`
  });
  return `${identityCard}

EDITORIAL / CREATIVE LUXURY JEWELRY PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

SCENE: ${scene.name}
${scene.prompt}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic \u2014 natural look, no CGI artifacts
- Sharp focus on jewelry`;
}
function buildEcommercePromptV2(analysisResult, fidelityBlock, productExtractionBlock, identityCard, userLens, userAngle) {
  const lens = selectLens("ecommerce", userLens);
  const angle = userAngle ? selectAngle(userAngle) : CAMERA_ANGLES.find((a) => a.key === "45_degree") ?? CAMERA_ANGLES[0];
  const sixBlock = buildSixBlockJSON({
    shot: `E-commerce product photography. Product fills 60-70% of frame. Clean commercial catalog shot.`,
    lens: `${lens.focal} \u2014 ${lens.description}. Deep depth of field for maximum detail visibility.`,
    light: `Studio Softbox: Soft omnidirectional studio lighting from all sides. Minimal shadows \u2014 just enough for depth/grounding. 5500K neutral daylight. Even, balanced illumination revealing all product details.`,
    texture: `Metal: accurate color-true representation. Stone: precise facet rendering. Surface: pure white to very light grey gradient (RGB 248-255). NO props, NO environment.`,
    composition: `${angle.description}. Product centered. Sharp focus across entire product (deep DOF). No artistic blur. No distractions.`,
    style_reference: `Amazon / Trendyol / Shopify product listing quality. Professional packshot, catalog photography. Zero creative interpretation \u2014 pure commercial accuracy. COLOR: Neutral, precise, controlled.`
  });
  return `${identityCard}

E-COMMERCE PROFESSIONAL PRODUCT PHOTOGRAPHY \u2014 V2 ENGINE

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
function buildModelPromptV2(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard, aesthetic, userLens, userAngle, userLighting) {
  const config = PRODUCT_TYPE_MODEL_CONFIG2[productType] || PRODUCT_TYPE_MODEL_CONFIG2["genel"];
  const pose = pickRandom2(config.poses);
  const gaze = pickRandom2(CHARACTER_GAZE2);
  const expression = pickRandom2(CHARACTER_EXPRESSIONS2);
  const persona = pickRandom2(CHARACTER_PERSONAS2);
  const outfit = pickRandom2(OUTFIT_POOL2.filter((o) => o.bestFor.includes(productType)) || OUTFIT_POOL2);
  const lens = selectLens("model", userLens);
  const angle = selectAngle(userAngle);
  const lighting = selectLighting("model", aesthetic.key, userLighting);
  console.log(`V2 Model \u2014 Persona: ${persona.name}, Aesthetic: ${aesthetic.name}, Lens: ${lens.key}, Light: ${lighting.key}`);
  const sixBlock = buildSixBlockJSON({
    shot: `Editorial model photography. Real human model wearing jewelry. Focus on ${config.bodyRegion}. Fashion editorial meets luxury advertising.`,
    lens: `${lens.focal} \u2014 ${lens.description}. Classic portrait compression and bokeh.`,
    light: `${lighting.name}: ${lighting.description}. ${lighting.temperature}. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone} with ${persona.skinUndertone} undertone. Real skin texture \u2014 visible pores, natural micro-imperfections. NO plastic/CGI. Metal: accurate color preservation. Stone: natural light behavior.`,
    composition: `${angle.description}. ${angle.effect} Model supports jewelry \u2014 jewelry is the HERO. Sharp focus on jewelry, model slightly softer. Body region: ${config.bodyRegion.toUpperCase()}.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood} ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Model ref: ${persona.editorialReference}.`
  });
  return `${identityCard}

EDITORIAL MODEL PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

\u26A0\uFE0F MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY \u26A0\uFE0F

CHARACTER DNA \u2014 ${persona.name.toUpperCase()} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Age: ${persona.age}, Body: ${persona.bodyType}, ${persona.height}
- Fashion: ${persona.fashionVibe}
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Strength: ${persona.strengthAsModel}

OUTFIT \u2014 ${outfit.name.toUpperCase()}:
- ${outfit.description}
- Palette: ${outfit.colorPalette}
- Fabrics: ${outfit.fabrics}
- Neckline: ${outfit.neckline}
- Sleeves: ${outfit.sleeveType}

POSE: ${pose}
EXPRESSION: ${expression}
GAZE: ${gaze}

${EDITORIAL_ENERGY_DIRECTIVE2}

TECHNICAL:
- 4K ultra-high resolution
- Ultra photorealistic portrait photography`;
}
function buildMacroPromptV2(analysisResult, fidelityBlock, productExtractionBlock, identityCard, aesthetic, userLighting) {
  const lighting = selectLighting("macro", aesthetic.key, userLighting);
  const sixBlock = buildSixBlockJSON({
    shot: `Extreme macro close-up at near 1:1 magnification. Focus on the most visually striking detail area. Metal grain, stone facets, prong tips all visible.`,
    lens: `100mm f/2.8 Macro (1:1) \u2014 extreme detail resolution. Individual metal surface texture and tooling marks become visible art.`,
    light: `${lighting.name}: ${lighting.description}. Single focused key light to reveal surface micro-texture. Specular highlights on metal edges create luminous outlines.`,
    texture: `Metal: ${analysisResult.metal?.type || "gold"} ${analysisResult.metal?.finish || "polished"} \u2014 grain texture, reflection patterns, surface characteristics at microscopic level. Stone: individual facet edges visible, internal light refraction paths, natural inclusions. HYPER-REAL material rendering.`,
    composition: `Camera extremely close \u2014 filling 90% of frame with detail. Off-center rule of thirds. Very shallow DOF (f/2.8-4) \u2014 only center detail plane sharp. Beautiful bokeh transition. Dark gradient background.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. COLOR: ${aesthetic.colorGrade}. Macro jewelry photography at its finest \u2014 Graff Diamonds campaign detail shots, Harry Winston close-up studies.`
  });
  return `${identityCard}

MACRO DETAIL PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Ultra photorealistic macro photography`;
}
function buildModelCloseUpPromptV2(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard, aesthetic, userLighting) {
  const config = PRODUCT_TYPE_MODEL_CONFIG2[productType] || PRODUCT_TYPE_MODEL_CONFIG2["genel"];
  const pose = pickRandom2(config.poses);
  const persona = pickRandom2(CHARACTER_PERSONAS2);
  const outfit = pickRandom2(OUTFIT_POOL2.filter((o) => o.bestFor.includes(productType)) || OUTFIT_POOL2);
  const lighting = selectLighting("model_closeup", aesthetic.key, userLighting);
  console.log(`V2 Model Close-Up \u2014 Persona: ${persona.name}, Aesthetic: ${aesthetic.name}`);
  const sixBlock = buildSixBlockJSON({
    shot: `Tight crop intimate detail shot of jewelry on real model. Extreme close-up on ${config.bodyRegion}. Jewelry fills 60-70% of frame. Model skin visible as context.`,
    lens: `85mm f/1.4 \u2014 portrait compression, beautiful bokeh. Very shallow DOF: f/1.8-2.0, only jewelry plane sharp.`,
    light: `${lighting.name}: ${lighting.description}. Soft, warm directional light from one side. Gentle skin glow with natural highlights on jewelry. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone} \u2014 real texture, visible pores, natural warmth. NO plastic/CGI. Metal and stone: maximum detail at close range.`,
    composition: `Extreme close-up / tight crop on ${config.bodyRegion}. Natural relaxed interaction with jewelry. Body region fills frame.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Intimate luxury close-up photography.`
  });
  return `${identityCard}

MODEL CLOSE-UP PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

\u26A0\uFE0F MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY \u26A0\uFE0F

MODEL \u2014 ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Age ${persona.age}, ${persona.heritage}
- Strength: ${persona.strengthAsModel}

OUTFIT: ${outfit.name} \u2014 ${outfit.description}

POSE: ${pose}

${EDITORIAL_ENERGY_DIRECTIVE2}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic close-up portrait photography`;
}
function buildModelLifestylePromptV2(analysisResult, fidelityBlock, productExtractionBlock, productType, identityCard, aesthetic, userLens, userLighting) {
  const config = PRODUCT_TYPE_MODEL_CONFIG2[productType] || PRODUCT_TYPE_MODEL_CONFIG2["genel"];
  const pose = pickRandom2(config.poses);
  const gaze = pickRandom2(CHARACTER_GAZE2);
  const expression = pickRandom2(CHARACTER_EXPRESSIONS2);
  const persona = pickRandom2(CHARACTER_PERSONAS2);
  const outfit = pickRandom2(OUTFIT_POOL2.filter((o) => o.bestFor.includes(productType)) || OUTFIT_POOL2);
  const lens = selectLens("model_lifestyle", userLens);
  const lighting = selectLighting("model_lifestyle", aesthetic.key, userLighting);
  const lifestyleScenes = [
    { setting: "Parisian caf\xE9 terrace at golden hour", mood: "warm, romantic, European luxury" },
    { setting: "Luxury hotel suite with soft morning light through sheer curtains", mood: "intimate, serene, private luxury" },
    { setting: "Art gallery opening with warm ambient lighting", mood: "sophisticated, cultural, modern elegance" },
    { setting: "Rooftop bar at sunset with city skyline bokeh", mood: "urban, cosmopolitan, aspirational" },
    { setting: "Mediterranean seaside restaurant with natural daylight", mood: "effortless, sun-kissed, resort luxury" }
  ];
  const lifestyleScene = pickRandom2(lifestyleScenes);
  console.log(`V2 Model Lifestyle \u2014 Persona: ${persona.name}, Aesthetic: ${aesthetic.name}, Scene: ${lifestyleScene.setting.substring(0, 30)}`);
  const sixBlock = buildSixBlockJSON({
    shot: `Lifestyle photography. Real model wearing jewelry in natural luxury setting: ${lifestyleScene.setting}. Candid editorial moment captured mid-life.`,
    lens: `${lens.focal} \u2014 ${lens.description}. Natural perspective, soft background.`,
    light: `${lighting.name}: ${lighting.description}. Natural warm lighting appropriate to setting. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Skin: ${persona.skinTone}, natural real texture. Environment: authentic setting materials. Metal/stone: preserved accurately.`,
    composition: `Body region: ${config.bodyRegion}. Jewelry prominent but scene feels authentic, not staged. Background softly blurred (f/2.0-2.8 bokeh). Environment adds context without competing.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. ${aesthetic.reference}. COLOR: ${aesthetic.colorGrade}. Scene mood: ${lifestyleScene.mood}.`
  });
  return `${identityCard}

MODEL LIFESTYLE PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

\u26A0\uFE0F MANDATORY: REAL HUMAN MODEL WEARING THE JEWELRY \u26A0\uFE0F

CHARACTER \u2014 ${persona.name} (${persona.heritage}):
- Skin: ${persona.skinTone}, ${persona.skinUndertone} undertone
- Hair: ${persona.hairColor}, ${persona.hairSignature}
- Eyes: ${persona.eyeColor}, Face: ${persona.faceShape}
- Expression: ${expression}
- Gaze: ${gaze}
- Age ${persona.age}, Body: ${persona.bodyType}, ${persona.height}
- Posture: ${persona.postureLanguage}
- Energy: ${persona.editorialEnergy}
- Strength: ${persona.strengthAsModel}

OUTFIT: ${outfit.name} \u2014 ${outfit.description}

POSE: ${pose}

${EDITORIAL_ENERGY_DIRECTIVE2}

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution
- Photorealistic lifestyle photography`;
}
function buildCustomPromptV2(analysisResult, fidelityBlock, productExtractionBlock, identityCard, customText, aesthetic) {
  const sixBlock = buildSixBlockJSON({
    shot: `Custom user-directed creative vision: ${customText}`,
    lens: `Automatically selected based on scene requirements`,
    light: `As appropriate for user's creative direction. AESTHETIC: ${aesthetic.lightingMod}`,
    texture: `Metal and stone: preserved exactly as analyzed. Scene textures as described by user.`,
    composition: `As directed by user. Jewelry is the hero of the image.`,
    style_reference: `${aesthetic.name}: ${aesthetic.mood}. COLOR: ${aesthetic.colorGrade}.`
  });
  return `${identityCard}

CUSTOM JEWELRY PHOTOGRAPHY \u2014 V2 ENGINE

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

USER CREATIVE DIRECTION:
${customText}

CONSTRAINTS:
- Jewelry MUST be the hero
- Preserve ALL jewelry details exactly
- Maintain photorealistic quality \u2014 4K, no CGI artifacts

TECHNICAL:
- 4:5 portrait aspect ratio
- 4K ultra-high resolution output
- Photorealistic professional photography`;
}
async function analyzeStyleReference2(styleBase64) {
  try {
    const stylePrompt = `You are an expert photography and art director. Analyze this style reference image with extreme precision for recreating its visual style in a new jewelry photograph.

Return JSON:
{
  "scene": { "setting": "", "background_elements": "", "surface": "", "season_time": "" },
  "lighting": { "type": "", "direction": "", "quality": "", "color_temperature": "" },
  "composition": { "framing": "", "camera_angle": "", "depth_of_field": "" },
  "model": { "present": true, "pose_description": "", "body_parts_visible": "", "expression_mood": "", "clothing": "", "skin_tone": "" },
  "mood": { "overall_atmosphere": "", "color_palette": "", "style_reference": "", "editorial_genre": "" },
  "existing_jewelry": { "present": true, "description": "", "location": "" }
}
ONLY valid JSON.`;
    const content = await callGeminiAnalysis2({ prompt: stylePrompt, imageBase64: styleBase64 });
    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    return result;
  } catch (err) {
    console.error("Style reference analysis failed:", err);
    return null;
  }
}
function buildStyleTransferPromptV2(styleAnalysis, productType, fidelityBlock, productExtractionBlock, identityCard, aesthetic) {
  const placementMap = {
    "yuzuk": { bodyPart: "hand/finger", placement: "Place the ring on the finger as shown in style reference.", removal: "Remove any existing rings." },
    "bileklik": { bodyPart: "wrist", placement: "Place the bracelet on the wrist.", removal: "Remove any existing bracelets." },
    "kupe": { bodyPart: "ear", placement: "Place the earring on the ear. If only one ear visible, render ONE earring.", removal: "Remove any existing earrings." },
    "kolye": { bodyPart: "neck/d\xE9colletage", placement: "Place the necklace around the neck.", removal: "Remove any existing necklaces." },
    "saat": { bodyPart: "wrist", placement: "Place the watch on the wrist with dial visible.", removal: "Remove any existing watches." }
  };
  const pl = placementMap[productType || ""] || { bodyPart: "appropriate body part", placement: "Place the jewelry naturally.", removal: "Remove any existing jewelry from target." };
  const sceneBlock = styleAnalysis ? `SCENE: ${styleAnalysis.scene.setting}. BG: ${styleAnalysis.scene.background_elements}. Surface: ${styleAnalysis.scene.surface}.` : "";
  const lightBlock = styleAnalysis ? `LIGHT: ${styleAnalysis.lighting.type}, ${styleAnalysis.lighting.direction}, ${styleAnalysis.lighting.quality}, ${styleAnalysis.lighting.color_temperature}.` : "";
  const compBlock = styleAnalysis ? `COMPOSITION: ${styleAnalysis.composition.framing}, ${styleAnalysis.composition.camera_angle}, DOF: ${styleAnalysis.composition.depth_of_field}.` : "";
  const modelBlock = styleAnalysis?.model?.present ? `MODEL: ${styleAnalysis.model.pose_description}. Visible: ${styleAnalysis.model.body_parts_visible}. Expression: ${styleAnalysis.model.expression_mood}. Clothing: ${styleAnalysis.model.clothing}.` : "";
  const moodBlock = styleAnalysis ? `MOOD: ${styleAnalysis.mood.overall_atmosphere}. Palette: ${styleAnalysis.mood.color_palette}. Style: ${styleAnalysis.mood.style_reference}. Genre: ${styleAnalysis.mood.editorial_genre}.` : "";
  const sixBlock = buildSixBlockJSON({
    shot: `Style reference transfer \u2014 recreate the reference image's visual style with the analyzed jewelry. ${sceneBlock}`,
    lens: `Match reference: ${compBlock}`,
    light: `Match reference: ${lightBlock} AESTHETIC overlay: ${aesthetic.lightingMod}`,
    texture: `Metal/stone from product reference preserved exactly. Scene textures from style reference.`,
    composition: `${compBlock} ${modelBlock}`,
    style_reference: `${moodBlock} AESTHETIC: ${aesthetic.name} \u2014 ${aesthetic.colorGrade}`
  });
  return `${identityCard}

[STYLE REFERENCE TRANSFER \u2014 V2 ENGINE]

\u26A0\uFE0F PRE-PROCESSING: ACCESSORY REMOVAL \u26A0\uFE0F
1. REMOVE all existing jewelry from target: ${pl.bodyPart}
2. ${pl.removal}

IMAGE 1 = STYLE REFERENCE (pose, scene, lighting, atmosphere)
IMAGE 2+ = PRODUCT REFERENCE (jewelry to transfer)

${productExtractionBlock}

${fidelityBlock}

${sixBlock}

PRODUCT TYPE: ${productType?.toUpperCase() || "JEWELRY"}
TARGET: ${pl.bodyPart.toUpperCase()}
PLACEMENT: ${pl.placement}

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.`;
}
async function enhanceScenePromptV2(templatePrompt, analysisResult, sceneType) {
  try {
    const prompt = `You are a world-class luxury jewelry photography art director. Enhance this V2 6-block structured prompt.

RULES:
- Keep ALL product identity, fidelity constraints, and 6-block structure EXACTLY
- NEVER modify product description, stone counts, prong counts, metal details
- ONLY enhance: scene vividness, lighting nuances, mood depth, creative details
- Add specific sensory details that make the scene cinematic and real
- Add lighting nuances based on the jewelry's metal type and stone characteristics
- Keep output as enhanced prompt text \u2014 same format, richer and more detailed
- Output ONLY as JSON: {"enhanced_prompt": "..."}
- Keep under 2000 words

Scene type: ${sceneType}
Jewelry: ${analysisResult.type || "jewelry"}, Metal: ${analysisResult.metal?.type || "unknown"} ${analysisResult.metal?.finish || ""}, Stones: ${JSON.stringify(analysisResult.stones?.map((s) => `${s.count}x ${s.type} ${s.cut}`) || ["none"])}

Original prompt:
${templatePrompt}`;
    const text = await callGeminiAnalysis2({ prompt, temperature: 0.4, maxTokens: 3e3 });
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    const enhanced = parsed.enhanced_prompt || parsed.prompt || text;
    if (typeof enhanced === "string" && enhanced.length > 100) {
      console.log(`V2 enhanced ${sceneType} prompt (${enhanced.length} chars)`);
      return enhanced;
    }
    return templatePrompt;
  } catch (err) {
    console.error(`V2 prompt enhancement failed for ${sceneType}:`, err?.message || err);
    return templatePrompt;
  }
}
async function processGeneration2(params) {
  const {
    userId,
    imageRecordId,
    jobId,
    imagePaths,
    validAdditionalPaths,
    sceneId,
    packageType,
    productType,
    metalColorOverride,
    styleReferencePath,
    aspectRatio,
    creditsNeeded,
    isAdminUser,
    selectedScenes: paramSelectedScenes,
    customPrompt: paramCustomPrompt,
    aesthetic: userAesthetic,
    lens: userLens,
    cameraAngle: userAngle,
    lighting: userLighting
  } = params;
  console.log(`V2 ENGINE \u2014 Analysis=${ANALYSIS_MODEL2}, Generation=${IMAGE_GEN_MODEL2} (4K), Package=${packageType}`);
  const isRetouchPackage = packageType === "retouch";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const aesthetic = selectAesthetic(userAesthetic);
  console.log(`V2 Aesthetic: ${aesthetic.name} (${aesthetic.key})`);
  try {
    await query("UPDATE processing_jobs SET status = $1, current_step = $2, progress = $3 WHERE id = $4", ["generating", "downloading", 2, jobId]);
    const allImagePaths = [imagePaths[0], ...validAdditionalPaths];
    const imageUrls = [];
    for (const path of allImagePaths) {
      imageUrls.push(getInternalUrl("jewelry-images", path));
    }
    if (imageUrls.length === 0) throw new Error("Failed to access images");
    await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [5, "downloading", jobId]);
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === "string" && styleReferencePath.startsWith(`${userId}/style-references/`);
    let styleReferenceBase64 = null;
    if (hasStyleReference) {
      try {
        const styleUrl = getInternalUrl("jewelry-images", styleReferencePath);
        const styleResponse = await fetch(styleUrl);
        const styleBuffer = await styleResponse.arrayBuffer();
        if (styleBuffer.byteLength <= MAX_IMAGE_SIZE2) {
          styleReferenceBase64 = arrayBufferToBase642(styleBuffer);
        }
      } catch (err) {
        console.error("Failed to fetch style reference:", err);
      }
    }
    let styleAnalysis = null;
    if (styleReferenceBase64) {
      await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["analyzing_style", 12, jobId]);
      styleAnalysis = await analyzeStyleReference2(styleReferenceBase64);
    }
    let scene = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
      scene = await queryOne("SELECT * FROM scenes WHERE id = $1", [sceneId]);
    }
    await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["analyzing", 10, jobId]);
    const base64Images = [];
    let lastFetchError = null;
    for (const url of imageUrls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          lastFetchError = `Image download failed: HTTP ${resp.status}`;
          console.warn(lastFetchError);
          continue;
        }
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_SIZE2) {
          lastFetchError = `Image too large: ${(buf.byteLength / (1024 * 1024)).toFixed(2)}MB (max 1.5MB)`;
          console.warn(lastFetchError);
          continue;
        }
        base64Images.push(arrayBufferToBase642(buf));
      } catch (err) {
        lastFetchError = `Image fetch error: ${err?.message || "network error"}`;
        console.warn(lastFetchError);
      }
    }
    if (base64Images.length === 0) throw new Error(lastFetchError || "No images could be loaded");
    const base64Image = base64Images[0];
    console.log("V2 Step 1: Analyzing jewelry...");
    await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [15, jobId]);
    const analysisPrompt = `You are an expert jewelry and luxury watch analyst. Analyze this piece with extreme precision.

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
  "visual_dna": { "silhouette_descriptor": "", "dominant_visual_axis": "", "light_signature": "", "color_relationship_map": "", "scale_anchor": "", "distinguishing_asymmetries": "", "optical_weight_center": "" }
}

CRITICAL: Count EVERY stone precisely. "visual_fingerprint" = 5-7 sentences. "visual_dna" = reconstruction blueprint.
ONLY valid JSON.`;
    let analysisResult = { type: "jewelry", design_elements: { style: "classic" } };
    try {
      const analysisContent = await callGeminiAnalysis2({ prompt: analysisPrompt, imageBase64: base64Image });
      analysisResult = JSON.parse(analysisContent.replace(/```json\n?|\n?```/g, "").trim());
    } catch (err) {
      console.error("V2 Jewelry analysis failed:", err?.message || err);
      await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", `Analiz hatas\u0131: ${err?.message?.substring(0, 200) || "parse error"}`, 100, "failed", jobId]);
      await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", `Analiz hatas\u0131: ${err?.message?.substring(0, 200) || "parse error"}`, imageRecordId]);
      if (!isAdminUser) {
        try {
          await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
        } catch {
        }
      }
      throw new Error(`Jewelry analysis failed: ${err?.message || "parse error"}`);
    }
    console.log("V2 Analysis result:", JSON.stringify(analysisResult, null, 2));
    await query("UPDATE images SET status = $1, analysis_data = $2 WHERE id = $3", ["generating", JSON.stringify(analysisResult), imageRecordId]);
    await query("UPDATE processing_jobs SET current_step = $1, progress = $2 WHERE id = $3", ["generating", 25, jobId]);
    const metalColorOverrideMap = {
      "yellow_gold": { type: "gold", category: "YELLOW GOLD" },
      "white_gold": { type: "white_gold", category: "WHITE GOLD" },
      "rose_gold": { type: "rose_gold", category: "ROSE GOLD" },
      "platinum": { type: "platinum", category: "PLATINUM" },
      "silver": { type: "silver", category: "SILVER" }
    };
    const userMetalOverride = metalColorOverride ? metalColorOverrideMap[metalColorOverride] : null;
    const metalType = userMetalOverride?.type || analysisResult.metal?.type || "gold";
    const metalFinish = analysisResult.metal?.finish || "polished";
    const metalKarat = analysisResult.metal?.karat || "18k";
    const metalColorHex = analysisResult.metal?.color_hex || "";
    let metalColorCategory = userMetalOverride?.category || "YELLOW GOLD";
    if (!userMetalOverride) {
      if (metalType === "white_gold" || metalType === "platinum" || metalType === "silver") metalColorCategory = "WHITE/SILVER METAL";
      else if (metalType === "rose_gold") metalColorCategory = "ROSE GOLD";
      else if (metalType === "gold") metalColorCategory = "YELLOW GOLD";
    }
    const metalDesc = `${metalFinish} ${metalType.replace("_", " ")} (${metalKarat})`;
    const stoneDesc = analysisResult.stones?.length > 0 ? analysisResult.stones.map((s) => `${s.count || 1} ${s.color || ""} ${s.type || "gemstone"}(s) in ${s.cut || "round"} cut with ${s.setting || "prong"} setting`).join(", ") : "";
    const stoneDetailBlock = analysisResult.stones?.length > 0 ? analysisResult.stones.map((s, i) => `Stone ${i + 1}: ${s.count || 1}x ${s.color || ""} ${s.type || "gemstone"}, ${s.cut || "round"} cut, ${s.setting || "prong"} setting, position: ${s.position || "center"}, size: ${s.relative_size || "medium"}`).join("\n  ") : "No gemstones";
    const structureBlock = analysisResult.structure ? `
STRUCTURAL IDENTITY:
- Center stones: ${analysisResult.structure.center_stone_count ?? "unknown"}
- Accent stones: ${analysisResult.structure.accent_stone_count ?? 0}
- Total prongs: ${analysisResult.structure.total_prong_count ?? "standard"}
- Prong style: ${analysisResult.structure.prong_style ?? "classic"}
- Band: ${analysisResult.structure.band_width_mm ?? "?"}mm ${analysisResult.structure.band_profile ?? "standard"}
- Shank: ${analysisResult.structure.shank_design ?? "plain"}
- Gallery: ${analysisResult.structure.gallery_detail ?? "standard"}` : "";
    const proportionsBlock = analysisResult.proportions ? `
PROPORTIONS:
- L:W ratio: ${analysisResult.proportions.length_to_width_ratio ?? "1.0"}
- Stone/Metal: ${analysisResult.proportions.stone_to_metal_ratio ?? "balanced"}
- Profile: ${analysisResult.proportions.overall_profile ?? "medium_set"}
- Symmetry: ${analysisResult.proportions.symmetry_grade ?? "good"}` : "";
    const surfaceBlock = analysisResult.surface_details ? [
      "\nSURFACE DETAILS:",
      analysisResult.surface_details.milgrain ? "- Milgrain edge detail PRESENT" : "",
      analysisResult.surface_details.filigree ? "- Filigree work PRESENT" : "",
      analysisResult.surface_details.engravings ? `- Engraving: ${analysisResult.surface_details.engraving_description}` : "",
      analysisResult.surface_details.texture_zones ? `- Texture: ${analysisResult.surface_details.texture_zones}` : ""
    ].filter(Boolean).join("\n") : "";
    const fingerprintBlock = analysisResult.visual_fingerprint ? `
VISUAL FINGERPRINT:
${analysisResult.visual_fingerprint}` : "";
    const userOverrideNote = metalColorOverride ? `
\u26A0\uFE0F USER METAL COLOR: ${metalColorCategory} \u2014 ABSOLUTE PRIORITY \u26A0\uFE0F
` : "";
    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === "watch" ? `
WATCH SPECS:
- Dial: ${watchDetails.dial_color || "classic"} ${watchDetails.dial_finish || ""} finish
- Case: ${watchDetails.case_shape || "round"}, Bezel: ${watchDetails.bezel_style || "smooth"}
- Strap: ${watchDetails.strap_type || "metal_bracelet"}, Crystal: ${watchDetails.crystal_type || "sapphire"}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(", ")}` : ""}` : "";
    const productExtractionBlock = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PRODUCT EXTRACTION MODE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Extract ONLY the jewelry from reference image(s).
IGNORE: hands, skin, background, reflections, shadows, environment.
Reconstruct as STANDALONE OBJECT, then place into scene.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`.trim();
    const fidelityBlock = `
JEWELRY SPECS (PRESERVE EXACTLY):
- Type: ${analysisResult.type || "jewelry piece"}
- Metal: ${metalDesc}, Category: ${metalColorCategory}
${metalColorHex ? `- Hex: ${metalColorHex}` : ""}
${stoneDesc ? `- Stones: ${stoneDesc}` : ""}
- Style: ${analysisResult.design_elements?.style || "classic"}
${analysisResult.unique_identifiers ? `- Unique: ${analysisResult.unique_identifiers}` : ""}
${watchDesc}${userOverrideNote}

STONE MAP:
  ${stoneDetailBlock}
${structureBlock}${proportionsBlock}${surfaceBlock}${fingerprintBlock}

\u26A0\uFE0F METAL COLOR: ${metalColorCategory} \u2014 MUST PRESERVE \u26A0\uFE0F
YELLOW GOLD \u2192 YELLOW GOLD | WHITE GOLD/PLATINUM/SILVER \u2192 WHITE/SILVER | ROSE GOLD \u2192 ROSE GOLD

FIDELITY: EXACT metal color, EXACT stone count, EXACT setting, EXACT proportions, EXACT surface finish.
DIAMOND REALISM: fire, brilliance, scintillation, natural inclusions, depth.
ANTI-HALLUCINATION: No stone additions/removals, no prong changes, no silhouette changes, no invention, no simplification.
FORBIDDEN: \u274C Metal color change \u274C Text/watermarks \u274C Design alterations \u274C Additional jewelry \u274C CGI gemstones`.trim();
    let brandDnaBlock = "";
    try {
      const brandProfile = await queryOne(
        "SELECT brand_dna_prompt, is_active FROM brand_profiles WHERE user_id = $1 AND is_active = true LIMIT 1",
        [userId]
      );
      if (brandProfile?.brand_dna_prompt) {
        brandDnaBlock = `

${brandProfile.brand_dna_prompt}
`;
        console.log("V2 Brand DNA applied");
      }
    } catch {
    }
    const fidelityBlockWithBrand = brandDnaBlock ? `${fidelityBlock}
${brandDnaBlock}` : fidelityBlock;
    const generatedUrls = [];
    if (isRetouchPackage) {
      console.log("V2 Retouch Package...");
      const retouchPrompt = `
PROFESSIONAL JEWELRY RETOUCHING \u2014 8-STEP MASTER WORKFLOW (V2)

ABSOLUTE PRODUCT INTEGRITY \u2014 Do NOT change geometry, proportions, stones, metal structure.

STEP 1 \u2014 DUST & DEFECT REMOVAL: Remove dust, fingerprints, scratches, lint.
STEP 2 \u2014 FREQUENCY SEPARATION: Preserve real metal grain. NO plastic look.
STEP 3 \u2014 BACKGROUND ISOLATION: Pure white (255,255,255). Sub-pixel edge accuracy.
STEP 4 \u2014 COLOR CORRECTION: D65 (6500K). Metal accuracy. Stone color true-to-life.
STEP 5 \u2014 METAL SURFACE: Remove handling marks. Enhance specular highlights naturally.
STEP 6 \u2014 GEMSTONE: Increase facet definition, brilliance, fire. NO artificial sparkle.
STEP 7 \u2014 SHADOW & DIMENSION: Subtle ground shadow (10-15% opacity). Dodge & burn.
STEP 8 \u2014 SHARPENING: Selective high-pass on edges. Avoid noise on smooth surfaces.

OUTPUT: Commercially clean, catalog-ready image on pure white. Ultra high resolution.`.trim();
      await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [28, jobId]);
      const retouchUrl = await generateSingleImage2(base64Images, retouchPrompt, userId, imageRecordId, 0, null, jobId, aspectRatio);
      if (retouchUrl) generatedUrls.push(retouchUrl);
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else if (packageType === "single") {
      console.log("V2 Single Package...");
      const identityCard = buildProductIdentityCard2(analysisResult);
      let singlePrompt;
      let singleImages;
      if (hasStyleReference && styleReferenceBase64) {
        singlePrompt = buildStyleTransferPromptV2(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, "style_transfer");
        singleImages = [styleReferenceBase64, ...base64Images];
      } else if (paramCustomPrompt) {
        singlePrompt = buildCustomPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard, paramCustomPrompt, aesthetic);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, "custom");
        singleImages = base64Images;
      } else {
        singlePrompt = buildEditorialPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic, userLens, userAngle, userLighting);
        singlePrompt = await enhanceScenePromptV2(singlePrompt, analysisResult, "editorial");
        singleImages = base64Images;
      }
      await query("UPDATE processing_jobs SET progress = $1, current_step = $2, total_images = $3 WHERE id = $4", [28, "generating", 1, jobId]);
      const url = await generateSingleImage2(singleImages, singlePrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else if (hasStyleReference && styleReferenceBase64 && packageType !== "standard") {
      console.log("V2 Standalone style reference...");
      const identityCard = buildProductIdentityCard2(analysisResult);
      let styleTransferPrompt = buildStyleTransferPromptV2(styleAnalysis, productType, fidelityBlockWithBrand, productExtractionBlock, identityCard, aesthetic);
      styleTransferPrompt = await enhanceScenePromptV2(styleTransferPrompt, analysisResult, "style_transfer");
      await query("UPDATE processing_jobs SET progress = $1 WHERE id = $2", [28, jobId]);
      const url = await generateSingleImage2([styleReferenceBase64, ...base64Images], styleTransferPrompt, userId, imageRecordId, 1, null, jobId, aspectRatio);
      if (url) generatedUrls.push(url);
      await query("UPDATE processing_jobs SET completed_images = $1, progress = $2 WHERE id = $3", [generatedUrls.length, 90, jobId]);
    } else {
      const resolvedProductType = productType || (() => {
        const t = analysisResult?.type?.toLowerCase() || "";
        const map = {
          ring: "yuzuk",
          necklace: "kolye",
          bracelet: "bileklik",
          earring: "kupe",
          pendant: "kolye",
          watch: "saat",
          choker: "kolye",
          brooch: "genel",
          piercing: "kupe"
        };
        return map[t] || "genel";
      })();
      console.log(`V2 Master Paket \u2014 Product: ${resolvedProductType}, Aesthetic: ${aesthetic.name}`);
      const buildIdentityCardForStep = (i, total) => buildProductIdentityCard2(analysisResult, i + 1, total);
      const masterSteps = [
        {
          key: "editorial",
          step: "generating_editorial",
          label: "Editorial",
          buildPrompt: (ic) => {
            if (hasStyleReference && styleReferenceBase64) return buildStyleTransferPromptV2(styleAnalysis, resolvedProductType, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic);
            return buildEditorialPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic, userLens, userAngle, userLighting);
          },
          getImages: () => hasStyleReference && styleReferenceBase64 ? [styleReferenceBase64, ...base64Images] : base64Images,
          startTemperature: 0.12
        },
        {
          key: "ecommerce",
          step: "generating_ecommerce",
          label: "E-Commerce",
          buildPrompt: (ic) => buildEcommercePromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, userLens, userAngle),
          startTemperature: 0.1
        },
        {
          key: "model",
          step: "generating_model",
          label: "Model",
          buildPrompt: (ic) => buildModelPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLens, userAngle, userLighting),
          startTemperature: 0.12
        },
        {
          key: "macro",
          step: "generating_macro",
          label: "Macro Detail",
          buildPrompt: (ic) => buildMacroPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, ic, aesthetic, userLighting),
          startTemperature: 0.12
        },
        {
          key: "model_closeup",
          step: "generating_model_closeup",
          label: "Model Close-Up",
          buildPrompt: (ic) => buildModelCloseUpPromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLighting),
          startTemperature: 0.12
        },
        {
          key: "model_lifestyle",
          step: "generating_model_lifestyle",
          label: "Model Lifestyle",
          buildPrompt: (ic) => buildModelLifestylePromptV2(analysisResult, fidelityBlockWithBrand, productExtractionBlock, resolvedProductType, ic, aesthetic, userLens, userLighting),
          startTemperature: 0.12
        }
      ];
      const filteredSteps = paramSelectedScenes && paramSelectedScenes.length > 0 ? masterSteps.filter((s) => paramSelectedScenes.includes(s.key)) : masterSteps;
      console.log(`V2 Generating ${filteredSteps.length} scenes: ${filteredSteps.map((s) => s.key).join(", ")}`);
      await query("UPDATE processing_jobs SET total_images = $1 WHERE id = $2", [filteredSteps.length, jobId]);
      for (let i = 0; i < filteredSteps.length; i++) {
        const ms = filteredSteps[i];
        console.log(`V2 Generating ${ms.label} (${i + 1}/${filteredSteps.length})...`);
        const perStep = 65 / filteredSteps.length;
        const startProgress = Math.round(25 + i * perStep);
        const endProgress = Math.round(25 + (i + 1) * perStep);
        await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [startProgress, ms.step, jobId]);
        const stepIdentityCard = buildIdentityCardForStep(i, filteredSteps.length);
        const basePrompt = ms.buildPrompt(stepIdentityCard);
        const prompt = await enhanceScenePromptV2(basePrompt, analysisResult, ms.key);
        const images = ms.getImages ? ms.getImages() : base64Images;
        const temperature = ms.startTemperature ?? 0.12;
        const url = await generateSingleImage2(images, prompt, userId, imageRecordId, i + 1, null, jobId, aspectRatio, temperature);
        if (url) generatedUrls.push(url);
        await query("UPDATE processing_jobs SET completed_images = $1, current_step = $2, progress = $3 WHERE id = $4", [generatedUrls.length, i < filteredSteps.length - 1 ? filteredSteps[i + 1].step : "saving", endProgress, jobId]);
      }
    }
    await query("UPDATE processing_jobs SET progress = $1, current_step = $2 WHERE id = $3", [90, "saving", jobId]);
    if (generatedUrls.length === 0) {
      if (!isAdminUser) {
        try {
          await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
          console.log(`Credits refunded: ${creditsNeeded}`);
        } catch {
        }
      }
      await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", "G\xF6rsel olu\u015Fturulamad\u0131", imageRecordId]);
      await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", "G\xF6rsel olu\u015Fturulamad\u0131", 100, "failed", jobId]);
      return;
    }
    await query("UPDATE images SET status = $1, generated_image_urls = $2 WHERE id = $3", ["completed", generatedUrls, imageRecordId]);
    await query("UPDATE processing_jobs SET status = $1, progress = $2, current_step = $3, result_urls = $4, completed_images = $5 WHERE id = $6", ["completed", 100, "completed", generatedUrls, generatedUrls.length, jobId]);
    console.log("V2 Generation complete:", generatedUrls.length, "images");
  } catch (error) {
    console.error("V2 Processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (!isAdminUser) {
      try {
        await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
      } catch {
      }
    }
    await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", errorMessage, imageRecordId]);
    await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", errorMessage, 100, "failed", jobId]);
  }
}
async function handler2(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  let userId = "";
  let creditsNeeded = 0;
  let creditsDeducted = false;
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) return sendCorsResponse(res, authResult.status, { error: authResult.error });
    userId = authResult.userId;
    console.log("V2 Authenticated user:", userId);
    const {
      imagePath,
      additionalImagePaths,
      sceneId,
      packageType,
      productType,
      metalColorOverride,
      styleReferencePath,
      aspectRatio: requestedRatio,
      selectedScenes,
      customPrompt,
      // V2 params
      aesthetic,
      lens,
      cameraAngle,
      lighting
    } = req.body;
    const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const aspectRatio = validRatios.includes(requestedRatio) ? requestedRatio : "3:4";
    console.log("V2 Generate request:", {
      imagePath,
      sceneId,
      packageType,
      productType,
      aspectRatio,
      userId,
      selectedScenes,
      aesthetic,
      lens,
      cameraAngle,
      lighting,
      customPrompt: customPrompt?.substring(0, 50)
    });
    if (!imagePath || typeof imagePath !== "string" || !imagePath.startsWith(`${userId}/originals/`)) {
      return sendCorsResponse(res, 400, { error: "Invalid image path" });
    }
    const validAdditionalPaths = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === "string" && path.startsWith(`${userId}/originals/`)) validAdditionalPaths.push(path);
      }
    }
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === "string" && styleReferencePath.startsWith(`${userId}/style-references/`);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRetouchPackage = packageType === "retouch";
    const isStandardPackage = packageType === "standard" || !packageType;
    const isSinglePackage = packageType === "single";
    if (!hasStyleReference && !isRetouchPackage && !isStandardPackage && !isSinglePackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return sendCorsResponse(res, 400, { error: "Invalid scene ID" });
    }
    const validAesthetics = AESTHETIC_STYLES.map((a) => a.key);
    const validLenses = LENS_OPTIONS.map((l) => l.key);
    const validAngles = CAMERA_ANGLES.map((a) => a.key);
    const validLights = LIGHTING_SETUPS.map((l) => l.key);
    const validatedAesthetic = validAesthetics.includes(aesthetic) ? aesthetic : void 0;
    const validatedLens = validLenses.includes(lens) ? lens : void 0;
    const validatedAngle = validAngles.includes(cameraAngle) ? cameraAngle : void 0;
    const validatedLighting = validLights.includes(lighting) ? lighting : void 0;
    const validSceneKeys = ["editorial", "ecommerce", "model", "macro", "model_closeup", "model_lifestyle"];
    let validatedSelectedScenes;
    if (Array.isArray(selectedScenes) && selectedScenes.length > 0) {
      validatedSelectedScenes = selectedScenes.filter((s) => validSceneKeys.includes(s));
      if (validatedSelectedScenes.length === 0) validatedSelectedScenes = void 0;
    }
    const validatedCustomPrompt = isSinglePackage && typeof customPrompt === "string" ? customPrompt.trim().substring(0, 500) : void 0;
    const stuckResult = await query(
      "SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[]) AND updated_at < $3",
      [userId, ["pending", "generating"], new Date(Date.now() - 2 * 60 * 1e3).toISOString()]
    );
    const stuckJobs = stuckResult.rows;
    if (stuckJobs && stuckJobs.length > 0) {
      await query("UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Auto-cleaned: stuck job", stuckJobs.map((j) => j.id)]);
      const stuckImageIds = stuckJobs.map((j) => j.image_record_id).filter(Boolean);
      if (stuckImageIds.length > 0) await query("UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Auto-cleaned: timeout", stuckImageIds]);
    }
    const activeResult = await query(
      "SELECT id, image_record_id FROM processing_jobs WHERE user_id = $1 AND status = ANY($2::text[])",
      [userId, ["pending", "generating"]]
    );
    const activeJobsList = activeResult.rows;
    if (activeJobsList && activeJobsList.length > 0) {
      await query("UPDATE processing_jobs SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["cancelled", "Yeni \xFCretim ba\u015Flat\u0131ld\u0131", activeJobsList.map((j) => j.id)]);
      const activeImageIds = activeJobsList.map((j) => j.image_record_id).filter(Boolean);
      if (activeImageIds.length > 0) await query("UPDATE images SET status = $1, error_message = $2 WHERE id = ANY($3::uuid[])", ["failed", "Yeni \xFCretim ba\u015Flat\u0131ld\u0131", activeImageIds]);
    }
    const adminRow = await queryOne("SELECT has_role($1, $2) as result", [userId, "admin"]);
    const isAdminUser = adminRow?.result === true;
    creditsNeeded = 10;
    if (!isAdminUser) {
      const deductRow = await queryOne("SELECT deduct_credits($1, $2) as result", [userId, creditsNeeded]);
      const deductResult = deductRow?.result;
      if (!deductRow) return sendCorsResponse(res, 500, { error: "Kredi kontrol\xFC s\u0131ras\u0131nda hata olu\u015Ftu." });
      if (!deductResult?.success) return sendCorsResponse(res, 402, { error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` });
      console.log(`V2 Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
      creditsDeducted = true;
    }
    const imageRecord = await queryOne(
      "INSERT INTO images (user_id, scene_id, original_image_url, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, sceneId || null, imagePath, "analyzing"]
    );
    if (!imageRecord) throw new Error("Failed to create image record");
    const totalImages = isSinglePackage || isRetouchPackage ? 1 : validatedSelectedScenes && validatedSelectedScenes.length > 0 ? validatedSelectedScenes.length : 6;
    const jobRecord = await queryOne(
      "INSERT INTO processing_jobs (user_id, image_record_id, status, total_images, completed_images, progress, current_step, credits_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [userId, imageRecord.id, "pending", totalImages, 0, 0, "pending", isAdminUser ? 0 : creditsNeeded]
    );
    if (!jobRecord) throw new Error("Failed to create processing job");
    console.log(`V2 Job: ${jobRecord.id}, Image: ${imageRecord.id}`);
    processGeneration2({
      userId,
      imageRecordId: imageRecord.id,
      jobId: jobRecord.id,
      imagePaths: [imagePath, ...validAdditionalPaths],
      validAdditionalPaths,
      sceneId: sceneId || null,
      packageType: packageType || "standard",
      productType: productType || null,
      metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null,
      aspectRatio,
      creditsNeeded,
      isAdminUser,
      selectedScenes: validatedSelectedScenes,
      customPrompt: validatedCustomPrompt,
      aesthetic: validatedAesthetic,
      lens: validatedLens,
      cameraAngle: validatedAngle,
      lighting: validatedLighting
    }).catch(async (err) => {
      console.error("V2 Background generation error:", err);
      try {
        const errorMsg = err instanceof Error ? err.message : "Background generation failed";
        await query("UPDATE processing_jobs SET status = $1, error_message = $2, progress = $3, current_step = $4 WHERE id = $5", ["failed", errorMsg, 100, "failed", jobRecord.id]);
        await query("UPDATE images SET status = $1, error_message = $2 WHERE id = $3", ["failed", errorMsg, imageRecord.id]);
        if (!isAdminUser) {
          try {
            await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
          } catch {
          }
        }
      } catch (cleanupErr) {
        console.error("V2 Failed to cleanup after background error:", cleanupErr);
      }
    });
    return sendCorsResponse(res, 200, {
      success: true,
      jobId: jobRecord.id,
      imageId: imageRecord.id,
      status: "pending",
      engine: "v2"
    });
  } catch (error) {
    console.error("V2 Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (creditsDeducted) {
      try {
        await queryOne("SELECT refund_credits($1, $2) as result", [userId, creditsNeeded]);
      } catch (refundErr) {
        console.error("CRITICAL: Failed to refund credits:", refundErr);
      }
    }
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}

// api/generate-video.ts
import { GoogleGenAI } from "@google/genai";
var ANIMATION_CORE = `IMAGE-TO-VIDEO ANIMATION \u2014 Animate the provided image.

RULES:
- The provided image is your first frame \u2014 preserve it exactly
- DO NOT create new products, objects, scenes, or compositions
- DO NOT add sparkle effects, lens flares, glowing halos, or artificial light bursts
- DO NOT add particle effects, dust, or atmospheric fog that isn't in the original
- Product shape, metal color, stone count, proportions \u2014 ALL UNCHANGED
- Add ONLY subtle, physically realistic motion to what already exists

REALISM:
- Light behaves like real physics \u2014 soft, gradual, no sudden flashes
- Metal reflects like real metal \u2014 smooth, continuous highlights, no digital shimmer
- Stones refract naturally \u2014 no exaggerated fire, no CGI sparkle overlay
- Everything must look like it was filmed with a real cinema camera on a tripod

FORBIDDEN:
- NO sparkle/glitter particle effects
- NO lens flare or light burst overlays
- NO artificial glow or bloom on metal or stones
- NO celebrity references or real person likeness
- NO text, watermarks, logos`;
var MULTI_FRAME_PROMPT = `${ANIMATION_CORE}

TRANSITION: Smooth cinematic transition from the first frame to the last frame.
The camera performs a fluid, continuous motion connecting both compositions.
Every intermediate frame must be physically plausible \u2014 no morphing, no dissolves, no jump cuts.
The jewelry product must remain consistent and recognizable throughout the entire transition.
Maintain continuous lighting and color temperature across all frames.
The motion should feel like a single continuous camera take \u2014 natural, elegant, unhurried.`;
var JEWELRY_VIDEO_PROMPTS = {
  default: `${ANIMATION_CORE}

MOTION: Very slow camera push-in toward the jewelry. The camera advances barely a centimeter over 6 seconds. Tripod-mounted, zero shake. As the camera gets closer, finer surface details become visible \u2014 metal grain, setting construction.

LIGHTING: The existing light in the image stays exactly as-is. As the camera angle shifts minutely, reflections on polished metal surfaces drift slowly and naturally \u2014 the way they would in real life when you lean slightly closer to look at a piece.

ATMOSPHERE: Still, quiet, contemplative. Like examining a piece in a museum vitrine. No drama, no effects \u2014 just the honest beauty of real materials under real light.

TECHNICAL: 24fps, locked tripod feel, natural color grading matching the source image.`,
  model: `${ANIMATION_CORE}

MOTION: The model breathes \u2014 a gentle chest rise, an almost imperceptible weight shift. Nothing more. The jewelry moves naturally with the body: a necklace sways a millimeter, a ring shifts with finger micro-movement. Camera holds perfectly still.

REALISM: Skin looks real \u2014 visible pores, natural sheen, no beauty filter. Hair doesn't move unless there's a reason. The model is nearly still, like a living photograph. No exaggerated gestures, no dramatic turns.

ATMOSPHERE: The quiet moment between shots in a real photo session. Natural, unstaged, authentic. The jewelry is prominent because the model is still, not because of effects.

TECHNICAL: 24fps, locked camera, natural skin tones, no color manipulation beyond the source image.`,
  product: `${ANIMATION_CORE}

MOTION: The product sits on its surface and does not move. The camera performs an extremely slow, barely perceptible lateral drift \u2014 shifting perspective by only a few degrees over the entire clip. This reveals how light falls differently across the metal and stone surfaces.

LIGHTING: No changes to lighting. The existing light in the image produces natural reflections that shift subtly as the viewing angle changes. Polished metal shows smooth, continuous highlight movement. Matte surfaces stay still. Stones show natural internal refraction \u2014 no added sparkle.

ATMOSPHERE: Clean, professional, catalog-quality. Like a high-end product video for an auction house. Precision and restraint.

TECHNICAL: 24fps, locked smooth dolly movement, deep focus, true-to-life colors.`,
  closeup: `${ANIMATION_CORE}

MOTION: Ultra-slow lateral pan across the jewelry surface at macro scale. The camera drifts horizontally, revealing different areas of the piece in sequence \u2014 a stone, a prong, a section of metalwork. Movement is glacially slow and perfectly smooth.

LIGHTING: As the macro camera position shifts, the angle of incidence changes on reflective surfaces. This creates natural, physics-based highlight movement on polished metal. No added effects \u2014 just real optics.

ATMOSPHERE: Intimate, reverent, documentary. Like a craftsman examining their own work through a loupe. The beauty comes from the real craftsmanship, not from effects.

TECHNICAL: 24fps, macro depth of field, focus plane may shift gently, natural color.`
};
async function handler3(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const GOOGLE_API_KEY3 = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY3) throw new Error("GOOGLE_VEO_API_KEY or GOOGLE_API_KEY is not configured");
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    const { imageUrl, endImageUrl, videoId, promptType = "default", videoFormat = "9:16" } = req.body;
    if (!imageUrl) return sendCorsResponse(res, 400, { error: "Image URL is required" });
    if (!videoId) return sendCorsResponse(res, 400, { error: "Video ID is required" });
    const isMultiFrame = !!endImageUrl;
    console.log("Starting video generation for user:", userId);
    const VIDEO_CREDIT_COST2 = 200;
    const adminRow = await queryOne("SELECT has_role($1, $2) as result", [userId, "admin"]);
    const isAdminUser = adminRow?.result === true;
    if (!isAdminUser) {
      const deductRow = await queryOne("SELECT deduct_credits($1, $2) as result", [userId, VIDEO_CREDIT_COST2]);
      const deductResult = deductRow?.result;
      if (!deductRow) {
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Kredi kontrol\xFC s\u0131ras\u0131nda hata olu\u015Ftu", videoId]);
        return sendCorsResponse(res, 500, { error: "Kredi kontrol\xFC s\u0131ras\u0131nda hata olu\u015Ftu" });
      }
      if (!deductResult?.success) {
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", `Yetersiz kredi. ${VIDEO_CREDIT_COST2} kredi gerekli.`, videoId]);
        return sendCorsResponse(res, 402, { error: `Yetersiz kredi. ${VIDEO_CREDIT_COST2} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` });
      }
    }
    const selectedPrompt = isMultiFrame ? MULTI_FRAME_PROMPT : JEWELRY_VIDEO_PROMPTS[promptType] || JEWELRY_VIDEO_PROMPTS.default;
    const fullPrompt = `${selectedPrompt}

GLOBAL LOCKS:
- 24fps, 6-8 seconds duration
- Zero camera shake \u2014 locked tripod
- Motion speed: barely perceptible, real-time slow
- Color grading: match the source image exactly, no stylization
- NO post-processing effects: no sparkle, no glow, no flare, no bloom, no particles
- The video should look like it was shot on a RED or ARRI cinema camera \u2014 clean, real, unprocessed`;
    await query("UPDATE videos SET status = $1, prompt = $2, error_message = $3 WHERE id = $4", ["generating", fullPrompt, "Video API'ye ba\u011Flan\u0131l\u0131yor...", videoId]);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Kaynak g\xF6rsel y\xFCklenemedi", videoId]);
      throw new Error("Failed to fetch source image");
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    await query("UPDATE videos SET error_message = $1 WHERE id = $2", [isMultiFrame ? "Multi-frame video haz\u0131rlan\u0131yor..." : "Google Veo 3.1 API \xE7a\u011Fr\u0131l\u0131yor...", videoId]);
    let base64EndImage;
    let endMimeType;
    if (isMultiFrame && endImageUrl) {
      try {
        const endImageResponse = await fetch(endImageUrl);
        if (endImageResponse.ok) {
          const endImageBuffer = await endImageResponse.arrayBuffer();
          const endUint8Array = new Uint8Array(endImageBuffer);
          let endBinary = "";
          for (let i = 0; i < endUint8Array.length; i++) {
            endBinary += String.fromCharCode(endUint8Array[i]);
          }
          base64EndImage = btoa(endBinary);
          endMimeType = endImageResponse.headers.get("content-type") || "image/png";
          console.log("End frame image loaded for multi-frame video");
        }
      } catch (err) {
        console.error("Failed to fetch end image:", err);
      }
    }
    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY3 });
    let veo31OperationName;
    let veo31ErrorText;
    try {
      const veoConfig = { aspectRatio: videoFormat === "16:9" ? "16:9" : "9:16" };
      if (base64EndImage && endMimeType) {
        veoConfig.lastFrame = { imageBytes: base64EndImage, mimeType: endMimeType };
        console.log("Using multi-frame mode with lastFrame");
      }
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-fast-generate-preview",
        prompt: fullPrompt,
        image: { imageBytes: base64Image, mimeType },
        config: veoConfig
      });
      veo31OperationName = operation?.name;
    } catch (err) {
      veo31ErrorText = err instanceof Error ? err.message : String(err);
      console.error("Veo 3.1 error:", err);
    }
    if (!veo31OperationName) {
      console.log("Trying Veo 2.0 text-to-video fallback...");
      const veo2Response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GOOGLE_API_KEY3}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: fullPrompt }],
            parameters: { aspectRatio: videoFormat === "16:9" ? "16:9" : "9:16", sampleCount: 1, durationSeconds: 5, personGeneration: "allow_adult" }
          })
        }
      );
      if (!veo2Response.ok) {
        const veo2ErrorText = await veo2Response.text();
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", `Video API hatas\u0131: ${(veo31ErrorText || "").substring(0, 100)}`, videoId]);
        return sendCorsResponse(res, 400, { success: false, error: "Video API error", veo31Error: veo31ErrorText, veo2Error: veo2ErrorText });
      }
      const veo2Data = await veo2Response.json();
      if (veo2Data.name) {
        await query("UPDATE videos SET status = $1, operation_id = $2, error_message = $3 WHERE id = $4", ["processing", veo2Data.name, "Video olu\u015Fturuluyor (Veo 2.0)...", videoId]);
        return sendCorsResponse(res, 200, { success: true, status: "processing", operationId: veo2Data.name, videoId });
      }
    }
    if (veo31OperationName) {
      await query("UPDATE videos SET status = $1, operation_id = $2, error_message = $3 WHERE id = $4", ["processing", veo31OperationName, "Video olu\u015Fturuluyor...", videoId]);
      return sendCorsResponse(res, 200, { success: true, status: "processing", operationId: veo31OperationName, videoId });
    }
    await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Video ba\u015Flat\u0131lamad\u0131", videoId]);
    return sendCorsResponse(res, 500, { success: false, error: "No operation ID received" });
  } catch (error) {
    console.error("Error in generate-video:", error);
    return sendCorsResponse(res, 500, { success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}

// api/generate-design.ts
var GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
async function handler4(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    console.log("Design generation request received");
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    console.log("Authenticated user:", authResult.userId);
    if (!GOOGLE_API_KEY) {
      return sendCorsResponse(res, 500, { error: "AI is not configured (missing GOOGLE_API_KEY)" });
    }
    const { productImageUrls, logoBase64, campaignText, designType, designMode, aspectRatio } = req.body;
    console.log("Request params:", {
      imageCount: productImageUrls?.length,
      hasLogo: !!logoBase64,
      designType,
      designMode,
      aspectRatio
    });
    if (!productImageUrls || productImageUrls.length === 0) {
      return sendCorsResponse(res, 400, { error: "No product images provided" });
    }
    const productImageDataUrls = [];
    for (const url of productImageUrls.slice(0, 3)) {
      try {
        console.log("Fetching image:", url);
        const response = await fetch(url);
        if (!response.ok) {
          console.error("Failed to fetch image:", response.status);
          continue;
        }
        const contentType = response.headers.get("content-type") || "image/png";
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const b64 = btoa(binary);
        productImageDataUrls.push(`data:${contentType};base64,${b64}`);
        console.log("Image fetched successfully, size:", buffer.byteLength);
      } catch (e) {
        console.error("Error fetching product image:", e);
      }
    }
    if (productImageDataUrls.length === 0) {
      return sendCorsResponse(res, 400, { error: "Could not fetch product images" });
    }
    const modePrompts = {
      kampanya: "High-end luxury sale campaign aesthetic. Bold yet elegant typography placement. Premium fashion brand advertising style like Cartier or Tiffany campaigns.",
      koleksiyon: "Exclusive collection launch visual. Editorial fashion photography style. Vogue magazine aesthetic with sophisticated minimalism.",
      reklam: "Cinematic luxury advertisement. Hollywood-style glamour lighting. Premium brand commercial aesthetic like Bulgari or Van Cleef & Arpels.",
      sinematik: "Ultra cinematic movie poster style. Dramatic lighting and shadows. Anamorphic lens flare effects. Epic and luxurious mood."
    };
    const typePrompts = {
      instagram: `Instagram post design (${aspectRatio || "3:4"} aspect ratio). Modern luxury social media aesthetic. Clean composition with elegant typography space.`,
      banner: `Web banner design (${aspectRatio || "16:9"} aspect ratio). Premium website hero banner. Sophisticated horizontal composition for luxury jewelry brand.`
    };
    const selectedMode = modePrompts[designMode] || modePrompts.kampanya;
    const selectedType = typePrompts[designType] || typePrompts.instagram;
    const designPrompt = `Create a stunning luxury jewelry marketing design with REAL design elements.

DESIGN TYPE:
${selectedType}

STYLE & MOOD:
${selectedMode}

CRITICAL DESIGN ELEMENTS TO INCLUDE:
- Geometric patterns: Art deco lines, golden ratio spirals, diamond shapes
- Luxury textures: Subtle marble veins, brushed gold accents, silk textures
- Premium borders: Elegant frames with ornate corners
- Decorative motifs: Subtle filigree patterns, jewel-inspired ornaments
- Typography layout: Create visual hierarchy with styled text blocks
- Visual depth: Layered elements, shadows, reflections

PRODUCT INTEGRATION:
- Place the jewelry as the hero centerpiece
- Create visual harmony between design elements and product
- Maintain exact product details and proportions
- Surround with complementary decorative elements

${campaignText ? `CAMPAIGN TEXT TO INCLUDE:
"${campaignText}"
- Use premium luxury serif typography (Didot, Bodoni, Playfair Display style)
- Create typographic art - stylized letter spacing, elegant ligatures
- Text should be part of the design composition, not just overlaid
- Add decorative flourishes around key text` : ""}

${logoBase64 ? `LOGO INTEGRATION:
- Place logo with decorative frame or border
- Integrate naturally into the overall design composition
- Professional brand placement with design context` : ""}

COLOR PALETTE:
- Rich jewel tones: deep emerald, sapphire blue, ruby red, amethyst purple
- Luxury metallics: gold, rose gold, platinum, champagne
- Elegant neutrals: ivory, charcoal, soft black
- Accent gradients: subtle color transitions for depth

DESIGN COMPOSITION:
- Use rule of thirds for balanced layout
- Create visual flow that guides eye to product
- Include breathing space balanced with decorative richness
- Layer elements: background texture \u2192 patterns \u2192 product \u2192 text \u2192 accents

OUTPUT REQUIREMENTS:
- Complete, polished marketing design (not just product on plain background)
- Cartier/Tiffany/Vogue advertisement quality
- Print-ready professional composition
- Every element intentionally designed`;
    console.log("Generating design with Google Gemini API...");
    const contentParts = [{ text: designPrompt }];
    for (const dataUrl of productImageDataUrls) {
      const commaIdx = dataUrl.indexOf(",");
      const base64Data = dataUrl.slice(commaIdx + 1);
      const mimeType = dataUrl.slice(5, commaIdx).split(";")[0] || "image/png";
      contentParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }
    if (logoBase64) {
      const commaIdx = logoBase64.indexOf(",");
      const base64Data = logoBase64.slice(commaIdx + 1);
      const mimeType = logoBase64.slice(5, commaIdx).split(";")[0] || "image/png";
      contentParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }
    const modelsResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}`, { method: "GET" });
    const modelsJson = modelsResp.ok ? await modelsResp.json() : null;
    const modelCandidates = Array.isArray(modelsJson?.models) ? modelsJson.models.filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")).map((m) => String(m.name || "")).filter(Boolean) : [];
    const preferred = modelCandidates.filter((n) => n.toLowerCase().includes("image"));
    const chosenModel = preferred[0] || modelCandidates[0];
    if (!chosenModel) {
      return sendCorsResponse(res, 503, { error: "AI model is not available right now" });
    }
    const genResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.5
          }
        })
      }
    );
    if (!genResponse.ok) {
      const t = await genResponse.text();
      console.error("Gemini API error:", genResponse.status, t);
      if (genResponse.status === 429) {
        return sendCorsResponse(res, 429, { error: "Rate limit a\u015F\u0131ld\u0131, l\xFCtfen biraz sonra tekrar deneyin." });
      }
      return sendCorsResponse(res, 500, { error: "Design generation failed" });
    }
    const genData = await genResponse.json();
    console.log("Generation response received");
    const parts = genData.candidates?.[0]?.content?.parts || [];
    let generatedImage = null;
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        generatedImage = part.inlineData.data;
        break;
      }
    }
    if (!generatedImage) {
      return sendCorsResponse(res, 500, { error: "No image generated" });
    }
    const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
    const fileName = `designs/${Date.now()}-${designType}-${designMode}.png`;
    const { error: uploadError } = await uploadFile("jewelry-images", fileName, imageBuffer, "image/png");
    if (uploadError) {
      return sendCorsResponse(res, 500, { error: "Failed to save design" });
    }
    const { data: signedUrlData, error: signedUrlError } = await getSignedUrl("jewelry-images", fileName, 7 * 24 * 60 * 60);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Failed to create signed URL for design:", signedUrlError);
      return sendCorsResponse(res, 500, { error: "Failed to generate design URL" });
    }
    console.log("Design generated and uploaded:", signedUrlData.signedUrl);
    return sendCorsResponse(res, 200, { success: true, designUrl: signedUrlData.signedUrl });
  } catch (error) {
    console.error("Error:", error);
    return sendCorsResponse(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}

// api/generate-model.ts
var buildCharacterMasterData = (params) => {
  let base = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
CHARACTER MASTER DATA - Sabit Karakter \xD6zellikleri
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 IDENTITY                                                     \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 full_name:        ${params.name}
\u2502 age:              ${params.ageRange} - SAB\u0130T
\u2502 nationality:      ${params.ethnicity}
\u2502 vibe:             ${params.mood || "Sophisticated luxury"}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 FACE STRUCTURE                                               \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 face_shape:       ${params.faceShape}
\u2502 eye_color:        ${params.eyeColor} - EXACT
\u2502 eyebrow_shape:    Natural, well-groomed
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 SKIN                                                         \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 skin_tone:        ${params.skinTone}
\u2502 skin_undertone:   ${params.skinUndertone}
\u2502 skin_texture:     smooth with natural pore visibility
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 HAIR                                                         \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 hair_color:       ${params.hairColor}
\u2502 hair_texture:     ${params.hairTexture}
\u2502 hair_style:       ${params.hairStyle}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
  if (params.makeupStyle || params.eyeMakeup || params.lipColor || params.skinFinish) {
    base += `
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 MAKEUP & APPEARANCE                                          \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 makeup_style:     ${params.makeupStyle || "natural"}
\u2502 eye_makeup:       ${params.eyeMakeup || "natural"}
\u2502 lip_color:        ${params.lipColor || "nude"}
\u2502 skin_finish:      ${params.skinFinish || "satin"}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
  }
  if (params.editorialReference || params.jewelryAffinity) {
    base += `
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 EDITORIAL IDENTITY                                           \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 editorial_ref:    ${params.editorialReference || "quiet-luxury"}
\u2502 jewelry_affinity: ${params.jewelryAffinity || "general"}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
  }
  if (params.bodyProportions) {
    base += `
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 BODY STRUCTURE                                               \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502 proportions:      ${params.bodyProportions}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
  }
  if (params.distinctiveFeatures && Object.keys(params.distinctiveFeatures).length > 0) {
    const features = Object.entries(params.distinctiveFeatures).map(([k, v]) => `\u2502 ${k}: ${v}`).join("\n");
    base += `
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 DISTINCTIVE FEATURES                                         \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
${features}
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
  }
  return base;
};
var SSS_PROFILES = {
  "fair": "Ultra-deep subsurface scattering: Pink/red undertones, strong vein visibility, maximum light penetration.",
  "light": "High subsurface scattering: Warm/neutral undertone, noticeable translucency on thin skin areas.",
  "medium": "Moderate subsurface scattering: Golden undertones, subtle translucency, rich warm depth.",
  "olive": "Reduced subsurface scattering: Green-yellow undertones, minimal translucency, natural matte appearance.",
  "tan": "Low subsurface scattering: Warm caramel undertones, very minimal translucency, natural sheen.",
  "brown": "Minimal subsurface scattering: Cool to neutral undertones, velvety rich appearance.",
  "dark": "Near-zero subsurface scattering: Deep melanin absorption, spectacular highlight definition."
};
var POSE_LIBRARY = {
  portrait: {
    name: "Editorial Portrait",
    camera: "Focal: 85mm f/1.8. Aperture: f/2.8. Focus: Eyes. Framing: Head + shoulders. Angle: 10-15\xB0 above eye level. Distance: 1.2m.",
    lighting: "PRIMARY: 45\xB0 camera-right, 30\xB0 elevated (modified Rembrandt). FILL: Large white v-flat. RIM: Hair light back-right. COLOR TEMP: 5500K.",
    composition: "Face: 60-70% frame occupancy. Gaze: 2 or 10 o'clock. Ears: Both visible. Neck/d\xE9colletage: Clear.",
    direction: "Expression: Serene confidence. Neck: Extended. Jaw: Relaxed. Eyes: Soft focus, distant contemplation."
  },
  "hand-close": {
    name: "Hand Close-Up (Ring/Bracelet)",
    camera: "Focal: 100mm f/2.8 macro. Aperture: f/5.6. Focus: Jewelry contact point. Framing: Hands 80%. Angle: 45\xB0 overhead.",
    lighting: "PRIMARY: Large overhead softbox. FILL: White base bounce. ACCENT: Gridded spot for catchlights. COLOR TEMP: 5000-5500K.",
    composition: "Hands: Natural elegance. Fingers: Gentle curves. Nails: Clean, neutral. Jewelry: Centered.",
    direction: "Hand gesture: Organic grace. Positioning: Overlapping or single hand rest. Skin detail: Knuckle texture visible."
  },
  "neck-focus": {
    name: "Neck/D\xE9colletage Focus",
    camera: "Focal: 85mm f/1.8. Aperture: f/4. Focus: Collarbone/necklace drape. Framing: Chin to sternum.",
    lighting: "PRIMARY: Beauty dish, 20\xB0 elevated. FILL: Clamshell reflector below. COLOR TEMP: 5500K.",
    composition: "Neck: Extended. Collarbone: Prominent. D\xE9colletage: Smooth. Necklace: Centered.",
    direction: "Head: Tilted slightly back. Chin: Elevated. Expression: Serene. Shoulders: Open chest."
  },
  "ear-profile": {
    name: "Ear Profile (Earring)",
    camera: "Focal: 100mm f/2.8. Aperture: f/4. Focus: Ear/earring. Framing: Ear to shoulder.",
    lighting: "PRIMARY: 90\xB0 side light. FILL: Minimal reflector. RIM: Strong backlight. COLOR TEMP: 5000-5500K.",
    composition: "Profile: Clean contour. Ear: Fully exposed. Earring: Natural hang. Hair: Styled away.",
    direction: "Face: 90\xB0 profile. Ear: Complete exposure. Expression: Calm, distant. Neck: Extended."
  },
  "full-portrait": {
    name: "Full Portrait (Multi-Jewelry)",
    camera: "Focal: 70mm f/2.8. Aperture: f/5.6. Focus: Face/upper chest. Framing: Head to mid-torso.",
    lighting: "PRIMARY: Large octabox 45\xB0. FILL: White bounce 3:1. RIM: Dual rim lights. COLOR TEMP: 5500K.",
    composition: "Full jewelry display: Ears, neck, chest, hands. Posture: Elegant. Clothing: Simple neckline.",
    direction: "Posture: Elongated spine. Expression: Serene confidence. Gaze: Slightly off-camera."
  },
  "hand-elegant": {
    name: "Elegant Hand/Wrist (Bracelet)",
    camera: "Focal: 100mm f/2.8 macro. Aperture: f/4. Focus: Wrist area. Framing: Hand and wrist.",
    lighting: "PRIMARY: Large diffused panel overhead. FILL: White reflector below. ACCENT: Spot for catchlights.",
    composition: "Wrist: Elegantly turned. Hand: Graceful gesture. Jewelry: Clear, centered.",
    direction: "Hand gesture: Flowing. Wrist: Slightly rotated for display. Fingers: Soft, not rigid."
  }
};
var EDITORIAL_STYLE_MAP = {
  "quiet-luxury": {
    aesthetic: "Vogue Italia, quiet luxury campaign",
    colorScience: "Muted tones, elegant desaturation, lifted blacks",
    lighting: "Soft directional light, subtle shadows"
  },
  "avant-garde": {
    aesthetic: "i-D Magazine, boundary-pushing editorial",
    colorScience: "Bold contrast, saturated accents, deep blacks",
    lighting: "Dramatic shadows, hard directional light"
  },
  "classic-elegance": {
    aesthetic: "Harper's Bazaar, timeless luxury",
    colorScience: "Warm golden tones, rich midtones",
    lighting: "Rembrandt lighting, warm color temperature"
  },
  "modern-power": {
    aesthetic: "Vogue US, power editorial",
    colorScience: "High contrast, clean whites, strong blacks",
    lighting: "Strong key light, minimal fill, defined shadows"
  },
  "mediterranean-warm": {
    aesthetic: "Mediterranean lifestyle campaign, sun-kissed",
    colorScience: "Warm amber, honey tones, soft highlights",
    lighting: "Golden hour, warm diffused natural light"
  },
  "minimalist-edge": {
    aesthetic: "Scandinavian minimal, clean editorial",
    colorScience: "Cool neutral, near-monochrome, soft gradients",
    lighting: "Even, flat light, subtle directional accent"
  }
};
function buildAdvancedPrompt(params) {
  const poseConfig = params.poseType && POSE_LIBRARY[params.poseType] ? POSE_LIBRARY[params.poseType] : POSE_LIBRARY.portrait;
  const sssProfile = SSS_PROFILES[params.skinTone] || SSS_PROFILES["medium"];
  const editorial = EDITORIAL_STYLE_MAP[params.editorialReference || "quiet-luxury"] || EDITORIAL_STYLE_MAP["quiet-luxury"];
  const makeupDirective = params.makeupStyle && params.makeupStyle !== "no-makeup" ? `Makeup applied: ${params.makeupStyle} style. Eye: ${params.eyeMakeup || "natural"}. Lip: ${params.lipColor || "nude"}. Finish: ${params.skinFinish || "satin"}.` : "No makeup or minimal natural";
  return `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
MODEL AGENCY TEST SHOT / DIGITALS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

SKIN - REAL BUT HEALTHY:
- Natural texture, visible pores on nose/cheeks
- Normal healthy skin - not perfect, not diseased
- ${makeupDirective}

${buildCharacterMasterData({
    name: params.name,
    gender: params.gender,
    ethnicity: params.ethnicity,
    ageRange: params.ageRange,
    skinTone: params.skinTone,
    skinUndertone: params.skinUndertone,
    faceShape: params.faceShape || "balanced",
    eyeColor: params.eyeColor || "natural",
    hairColor: params.hairColor,
    hairStyle: params.hairStyle || "natural",
    hairTexture: params.hairTexture,
    expression: params.expression || "serene",
    mood: params.mood,
    bodyType: params.bodyType,
    makeupStyle: params.makeupStyle,
    eyeMakeup: params.eyeMakeup,
    lipColor: params.lipColor,
    skinFinish: params.skinFinish,
    editorialReference: params.editorialReference,
    jewelryAffinity: params.jewelryAffinity,
    bodyProportions: params.bodyProportions,
    distinctiveFeatures: params.distinctiveFeatures
  })}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
IDENTITY PERMANENCE PROTOCOL [HIGHEST PRIORITY]
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

BIOLOGICAL FINGERPRINT:
\u2022 Cranial structure, proportional ratios, skin signature, micro-features

${params.isPoseGeneration ? `\u26A0\uFE0F IDENTITY CONSISTENCY MODE - Same person as references. Face INSTANTLY recognizable.` : `\u{1F195} IDENTITY FOUNDATION MODE - Establishing permanent identity.`}

SKIN BIOLOGY: ${params.skinTone} with ${params.skinUndertone} undertone
${sssProfile}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
POSE: ${poseConfig.name}
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
CAMERA: ${poseConfig.camera}
LIGHTING: ${poseConfig.lighting}. ${editorial.lighting}
COMPOSITION: ${poseConfig.composition}
DIRECTION: ${poseConfig.direction}
${params.poseDescription ? `
ADDITIONAL: ${params.poseDescription}` : ""}

EDITORIAL AESTHETIC: ${editorial.aesthetic}.
COLOR SCIENCE: ${editorial.colorScience}.

STRICT AVOIDANCE:
\u2717 Smoothed/plastic skin \u2717 3D render look \u2717 Extra/missing fingers
\u2717 Unrealistic color \u2717 Waxy appearance \u2717 Watermarks/text

OUTPUT: 4K+, publication-ready, indistinguishable from professional photography.
Ultra high resolution output.
`;
}
async function handler5(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const userId = authResult.userId;
    console.log("Authenticated user:", userId);
    const {
      name,
      skinTone,
      skinUndertone,
      ethnicity,
      hairColor,
      hairTexture,
      gender,
      ageRange,
      faceShape,
      eyeColor,
      expression,
      hairStyle,
      mood,
      bodyType,
      modelData,
      poseType,
      poseDescription,
      makeupStyle,
      eyeMakeup,
      lipColor,
      skinFinish,
      editorialReference,
      jewelryAffinity,
      bodyProportions,
      distinctiveFeatures
    } = req.body;
    const isPoseGeneration = !!modelData && !!poseType;
    console.log("Request type:", isPoseGeneration ? "Pose generation" : "New model creation");
    if (!isPoseGeneration) {
      if (!name || !skinTone || !skinUndertone || !ethnicity || !hairColor || !hairTexture || !gender || !ageRange) {
        return sendCorsResponse(res, 400, { error: "Missing required fields for new model" });
      }
    }
    const modelPrompt = buildAdvancedPrompt({
      name: isPoseGeneration ? modelData.name : name,
      skinTone: isPoseGeneration ? modelData.skinTone : skinTone,
      skinUndertone: isPoseGeneration ? modelData.skinUndertone : skinUndertone || "neutral",
      ethnicity: isPoseGeneration ? modelData.ethnicity : ethnicity,
      hairColor: isPoseGeneration ? modelData.hairColor : hairColor,
      hairTexture: isPoseGeneration ? modelData.hairTexture : hairTexture,
      gender: isPoseGeneration ? modelData.gender : gender,
      ageRange: isPoseGeneration ? modelData.ageRange : ageRange,
      faceShape: isPoseGeneration ? modelData.faceShape : faceShape,
      eyeColor: isPoseGeneration ? modelData.eyeColor : eyeColor,
      expression: isPoseGeneration ? modelData.expression : expression,
      hairStyle: isPoseGeneration ? modelData.hairStyle : hairStyle,
      mood: isPoseGeneration ? modelData.mood : mood,
      bodyType: isPoseGeneration ? modelData.bodyType : bodyType,
      isPoseGeneration,
      poseType,
      poseDescription: poseDescription || void 0,
      makeupStyle: isPoseGeneration ? modelData.makeup_style : makeupStyle,
      eyeMakeup: isPoseGeneration ? modelData.eye_makeup : eyeMakeup,
      lipColor: isPoseGeneration ? modelData.lip_color : lipColor,
      skinFinish: isPoseGeneration ? modelData.skin_finish : skinFinish,
      editorialReference: isPoseGeneration ? modelData.editorial_reference : editorialReference,
      jewelryAffinity: isPoseGeneration ? modelData.jewelry_affinity : jewelryAffinity,
      bodyProportions: isPoseGeneration ? modelData.body_proportions : bodyProportions,
      distinctiveFeatures: isPoseGeneration ? modelData.distinctive_features : distinctiveFeatures
    });
    const GOOGLE_API_KEY3 = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY3) {
      throw new Error("GOOGLE_API_KEY not configured");
    }
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY3
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: modelPrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI generation error:", response.status, errorText);
      if (response.status === 429) {
        return sendCorsResponse(res, 429, { error: "Rate limit exceeded. Please try again later." });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData?.data) {
      throw new Error("No valid image generated");
    }
    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageBuffer = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const fileExtension = mimeType.includes("png") ? "png" : "jpg";
    const filePath = `${userId}/models/${Date.now()}.${fileExtension}`;
    const { error: uploadError } = await uploadFile("jewelry-images", filePath, imageBuffer, mimeType);
    if (uploadError) throw new Error("Failed to upload image");
    const { data: signedUrlData, error: signedUrlError } = await getSignedUrl("jewelry-images", filePath, 7 * 24 * 60 * 60);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to generate image URL");
    }
    const imageUrl = signedUrlData.signedUrl;
    if (isPoseGeneration) {
      return sendCorsResponse(res, 200, { success: true, imageUrl });
    }
    const modelRecord = await queryOne(
      `INSERT INTO user_models (
        user_id, name, skin_tone, skin_undertone, ethnicity, hair_color, hair_texture,
        gender, age_range, face_shape, eye_color, expression, hair_style,
        preview_image_url, makeup_style, eye_makeup, lip_color, skin_finish,
        editorial_reference, jewelry_affinity, body_proportions, distinctive_features
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [
        userId,
        name,
        skinTone,
        skinUndertone || "neutral",
        ethnicity,
        hairColor,
        hairTexture,
        gender,
        ageRange,
        faceShape,
        eyeColor,
        expression,
        hairStyle,
        imageUrl,
        makeupStyle || null,
        eyeMakeup || null,
        lipColor || null,
        skinFinish || null,
        editorialReference || null,
        jewelryAffinity || null,
        bodyProportions || null,
        JSON.stringify(distinctiveFeatures || {})
      ]
    );
    if (!modelRecord) throw new Error("Failed to save model");
    return sendCorsResponse(res, 200, { success: true, model: modelRecord });
  } catch (error) {
    console.error("Error:", error);
    return sendCorsResponse(res, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}

// api/admin-set-credits.ts
var RATE_LIMIT_WINDOW = 6e4;
var RATE_LIMIT_MAX = 10;
var rateLimitMap = /* @__PURE__ */ new Map();
function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}
async function handler6(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(`admin-ip:${clientIp}`)) {
    return sendCorsResponse(res, 429, { error: "Too many requests. Try again later." });
  }
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const callerUserId = authResult.userId;
    const body = req.body || {};
    const { userId, credits: rawCredits } = body;
    const credits = Number(rawCredits);
    if (!userId || typeof userId !== "string") {
      return sendCorsResponse(res, 400, { error: "userId is required" });
    }
    if (!Number.isFinite(credits) || credits < 0 || credits > 1e6) {
      return sendCorsResponse(res, 400, { error: "Invalid credits" });
    }
    const roleRow = await queryOne("SELECT has_role($1, $2) as result", [callerUserId, "admin"]);
    if (!roleRow) {
      return sendCorsResponse(res, 500, { error: "Role check failed" });
    }
    if (roleRow.result !== true) {
      return sendCorsResponse(res, 403, { error: "Forbidden" });
    }
    const updateRow = await queryOne("SELECT admin_set_credits($1, $2) as result", [userId, credits]);
    if (!updateRow) {
      return sendCorsResponse(res, 500, { error: "Update failed" });
    }
    console.log(`Admin ${callerUserId} set credits for user ${userId} to ${credits}`);
    return sendCorsResponse(res, 200, { success: true, ...updateRow.result });
  } catch (e) {
    console.error("admin-set-credits error:", e);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/check-video-status.ts
var VIDEO_CREDIT_COST = 200;
async function refundCredits(userId, amount) {
  console.log(`Attempting to refund ${amount} credits to user ${userId}`);
  try {
    await queryOne("SELECT refund_credits($1, $2) as result", [userId, amount]);
    console.log("Credits refunded successfully");
  } catch (error) {
    console.error("Refund error:", error);
  }
}
async function handler7(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const GOOGLE_API_KEY3 = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY3) throw new Error("GOOGLE_VEO_API_KEY or GOOGLE_API_KEY is not configured");
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    const { videoId } = req.body;
    if (!videoId) return sendCorsResponse(res, 400, { error: "Video ID is required" });
    const video = await queryOne("SELECT * FROM videos WHERE id = $1 AND user_id = $2", [videoId, userId]);
    if (!video) throw new Error("Video not found");
    const adminRow = await queryOne("SELECT has_role($1, $2) as result", [userId, "admin"]);
    const isAdminUser = adminRow?.result === true;
    if (video.status === "completed" || video.status === "error") {
      return sendCorsResponse(res, 200, { success: true, status: video.status, videoUrl: video.video_url, errorMessage: video.error_message });
    }
    if (!video.operation_id) {
      return sendCorsResponse(res, 200, { success: true, status: video.status, message: "Video generation starting..." });
    }
    console.log(`Checking operation: ${video.operation_id}`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${video.operation_id}`,
      { method: "GET", headers: { "Content-Type": "application/json", "x-goog-api-key": GOOGLE_API_KEY3 } }
    );
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Video \xFCretimi ba\u015Far\u0131s\u0131z. Krediniz iade edildi.", videoId]);
        return sendCorsResponse(res, 200, { success: true, status: "error", errorMessage: "Operation not found. Credits refunded.", refunded: !isAdminUser });
      }
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    const operationData = await response.json();
    if (operationData.done === true) {
      const raiFilteredReasons = operationData?.response?.generateVideoResponse?.raiMediaFilteredReasons;
      const raiFilteredCount = operationData?.response?.generateVideoResponse?.raiMediaFilteredCount;
      if (raiFilteredCount && raiFilteredCount > 0 || raiFilteredReasons && raiFilteredReasons.length > 0) {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        const friendly = "Video \xFCretimi i\xE7erik filtresine tak\u0131ld\u0131. Krediniz iade edildi.";
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", friendly, videoId]);
        return sendCorsResponse(res, 200, { success: true, status: "error", errorMessage: friendly, refunded: !isAdminUser });
      }
      if (operationData.error) {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", (operationData.error.message || "Video \xFCretimi ba\u015Far\u0131s\u0131z") + " Krediniz iade edildi.", videoId]);
        return sendCorsResponse(res, 200, { success: true, status: "error", errorMessage: operationData.error.message, refunded: !isAdminUser });
      }
      const videoUri = operationData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || operationData.response?.generatedVideos?.[0]?.video?.uri || operationData.response?.predictions?.[0]?.video?.uri || operationData.result?.generatedVideos?.[0]?.video?.uri || operationData.result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || operationData.response?.video?.uri;
      if (videoUri) {
        try {
          const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY3}`);
          if (!videoResponse.ok) {
            throw new Error(`Video download failed: ${videoResponse.status}`);
          }
          const videoBlob = await videoResponse.arrayBuffer();
          const storagePath = `videos/${videoId}.mp4`;
          const { error: uploadError } = await uploadFile("jewelry-images", storagePath, Buffer.from(videoBlob), "video/mp4", true);
          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }
          const { data: signedUrlData } = await getSignedUrl("jewelry-images", storagePath, 7 * 24 * 60 * 60);
          const videoUrl = signedUrlData?.signedUrl;
          if (!videoUrl) throw new Error("Could not generate signed URL for video");
          await query("UPDATE videos SET status = $1, video_url = $2, error_message = $3 WHERE id = $4", ["completed", videoUrl, null, videoId]);
          return sendCorsResponse(res, 200, { success: true, status: "completed", videoUrl });
        } catch (uploadErr) {
          console.error("Error uploading video:", uploadErr);
          if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
          await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Video depolanamad\u0131, krediniz iade edildi.", videoId]);
          return sendCorsResponse(res, 200, { success: true, status: "error", errorMessage: "Video upload failed. Credits refunded.", refunded: !isAdminUser });
        }
      } else {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["error", "Video tamamland\u0131 ancak URL al\u0131namad\u0131. Krediniz iade edildi.", videoId]);
        return sendCorsResponse(res, 200, { success: true, status: "error", errorMessage: "No video URL", refunded: !isAdminUser });
      }
    }
    const progress = operationData.metadata?.progress || 0;
    await query("UPDATE videos SET status = $1, error_message = $2 WHERE id = $3", ["processing", progress > 0 ? `\u0130\u015Fleniyor... ${progress}%` : "Video olu\u015Fturuluyor...", videoId]);
    return sendCorsResponse(res, 200, { success: true, status: "processing", progress, message: progress > 0 ? `\u0130\u015Fleniyor... ${progress}%` : "Video olu\u015Fturuluyor..." });
  } catch (error) {
    console.error("Error in check-video-status:", error);
    return sendCorsResponse(res, 500, { success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}

// api/analyze-brand.ts
var GOOGLE_API_KEY2 = process.env.GOOGLE_API_KEY;
var ANALYSIS_MODEL3 = "gemini-3.1-flash-lite-preview";
async function callGeminiForBrand(prompt) {
  if (!GOOGLE_API_KEY2) throw new Error("GOOGLE_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL3}:generateContent?key=${GOOGLE_API_KEY2}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.substring(0, 300)}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}
async function handler8(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
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
      referenceImageUrls
    } = req.body;
    if (!brandName || typeof brandName !== "string") {
      return sendCorsResponse(res, 400, { error: "Brand name is required" });
    }
    if (brandName.length > 100) {
      return sendCorsResponse(res, 400, { error: "Brand name too long (max 100 chars)" });
    }
    if (moodDescription && typeof moodDescription === "string" && moodDescription.length > 500) {
      return sendCorsResponse(res, 400, { error: "Mood description too long (max 500 chars)" });
    }
    const analysisPrompt = `You are an expert brand identity consultant specializing in luxury jewelry brands. Analyze the following brand profile and create a Brand DNA summary that can be used to maintain visual consistency across AI-generated jewelry photography.

BRAND PROFILE:
- Name: ${brandName}
- Primary Color: ${primaryColor || "not specified"}
- Secondary Color: ${secondaryColor || "not specified"}
- Accent Color: ${accentColor || "not specified"}
- Style Keywords: ${(styleKeywords || []).join(", ") || "not specified"}
- Lighting Preference: ${lightingPreference || "not specified"}
- Background Preference: ${backgroundPreference || "not specified"}
- Mood Description: ${moodDescription || "not specified"}
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
    let parsed;
    try {
      parsed = JSON.parse(rawResult.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      parsed = {
        analysis: {
          dominant_mood: moodDescription || "luxury",
          consistency_score: 75
        },
        brandDnaPrompt: null
      };
    }
    const brandDnaPrompt = parsed.brand_dna_prompt || parsed.brandDnaPrompt || `BRAND IDENTITY LAYER:
Brand: ${brandName}
Color DNA: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}
Lighting: ${lightingPreference === "warm_golden" ? "Warm golden with soft fill, matching brand warmth" : lightingPreference === "cool_studio" ? "Cool precise studio lighting, clinical luxury" : lightingPreference === "natural" ? "Natural window light, organic and authentic" : lightingPreference === "dramatic" ? "High contrast dramatic lighting, bold shadows" : "Soft diffused lighting, gentle and refined"}
Mood: ${moodDescription || (styleKeywords || []).join(", ") || "elegant, sophisticated"}
Background Tendency: ${backgroundPreference === "dark" ? "Dark, moody with subtle texture" : backgroundPreference === "light" ? "Light, airy, clean" : backgroundPreference === "neutral" ? "Neutral tones, understated" : "Rich and colorful"}
Style Signature: ${(styleKeywords || []).includes("minimal") ? "Minimal composition, centered product, clean negative space" : (styleKeywords || []).includes("dramatic") ? "Bold composition, strong shadows, theatrical presence" : (styleKeywords || []).includes("vintage") ? "Vintage-inspired, warm patina, heritage feel" : "Balanced composition, refined styling"}
CRITICAL: All brand colors, lighting mood, and style must be consistent across every generated image.`;
    return sendCorsResponse(res, 200, {
      success: true,
      analysis: parsed.analysis || null,
      brandDnaPrompt
    });
  } catch (error) {
    console.error("Brand analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Brand analysis failed";
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}

// api/auth-signup.ts
async function handler9(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const { email, password, metadata } = req.body;
    if (!email || !password) {
      return sendCorsResponse(res, 400, { error: "Email and password are required" });
    }
    if (password.length < 6) {
      return sendCorsResponse(res, 400, { error: "Password must be at least 6 characters" });
    }
    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing) {
      return sendCorsResponse(res, 409, { error: "User already exists" });
    }
    const passwordHash = await hashPassword(password);
    const user = await queryOne(
      "INSERT INTO users (email, password_hash, metadata) VALUES ($1, $2, $3) RETURNING id",
      [email.toLowerCase(), passwordHash, JSON.stringify(metadata || {})]
    );
    if (!user) throw new Error("Failed to create user");
    await query(
      `INSERT INTO profiles (id, email, first_name, last_name, phone, company, credits)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        email.toLowerCase(),
        metadata?.first_name || "",
        metadata?.last_name || "",
        metadata?.phone || null,
        metadata?.company || null,
        100
        // default credits
      ]
    );
    const tokens = await generateTokens(user.id);
    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: email.toLowerCase() },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });
  } catch (err) {
    console.error("Signup error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/auth-login.ts
async function handler10(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendCorsResponse(res, 400, { error: "Email and password are required" });
    }
    const user = await queryOne(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (!user) {
      return sendCorsResponse(res, 401, { error: "Invalid credentials" });
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return sendCorsResponse(res, 401, { error: "Invalid credentials" });
    }
    const tokens = await generateTokens(user.id);
    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: email.toLowerCase() },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });
  } catch (err) {
    console.error("Login error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/auth-refresh.ts
async function handler11(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return sendCorsResponse(res, 400, { error: "Refresh token is required" });
    }
    const result = await verifyRefreshToken(refresh_token);
    if (!result) {
      return sendCorsResponse(res, 401, { error: "Invalid refresh token" });
    }
    const user = await queryOne(
      "SELECT id, email FROM users WHERE id = $1",
      [result.userId]
    );
    if (!user) {
      return sendCorsResponse(res, 401, { error: "User not found" });
    }
    const tokens = await generateTokens(user.id);
    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: user.email },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/auth-me.ts
async function handler12(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const user = await queryOne(
      "SELECT id, email, metadata, created_at FROM users WHERE id = $1",
      [authResult.userId]
    );
    if (!user) {
      return sendCorsResponse(res, 404, { error: "User not found" });
    }
    return sendCorsResponse(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.metadata || {},
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/scenes.ts
async function handler13(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { rows } = await query(
      "SELECT * FROM scenes ORDER BY sort_order ASC, created_at ASC"
    );
    return sendCorsResponse(res, 200, { data: rows });
  } catch (err) {
    console.error("Scenes error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/images.ts
async function handler14(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    if (req.method === "GET") {
      const { rows } = await query(
        "SELECT * FROM images WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (req.method === "DELETE") {
      const imageId = req.body?.id || req.query?.id;
      if (!imageId) {
        return sendCorsResponse(res, 400, { error: "Image ID is required" });
      }
      const image = await queryOne(
        "SELECT id, user_id, original_image_url FROM images WHERE id = $1 AND user_id = $2",
        [imageId, userId]
      );
      if (!image) {
        return sendCorsResponse(res, 404, { error: "Image not found" });
      }
      await query("DELETE FROM images WHERE id = $1", [imageId]);
      if (image.original_image_url) {
        await deleteFile("jewelry-images", image.original_image_url);
      }
      return sendCorsResponse(res, 200, { success: true });
    }
    return sendCorsResponse(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Images error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/processing-jobs.ts
async function handler15(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const jobId = req.params?.id || req.query?.id || req.body?.id;
    if (!jobId) {
      return sendCorsResponse(res, 400, { error: "Job ID is required" });
    }
    const job = await queryOne(
      "SELECT * FROM processing_jobs WHERE id = $1 AND user_id = $2",
      [jobId, authResult.userId]
    );
    if (!job) {
      return sendCorsResponse(res, 404, { error: "Job not found" });
    }
    return sendCorsResponse(res, 200, { data: job });
  } catch (err) {
    console.error("Processing jobs error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/profile.ts
async function handler16(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    if (req.method === "GET" || req.method === "POST" && !req.body?.action) {
      const profile = await queryOne(
        "SELECT * FROM profiles WHERE id = $1",
        [userId]
      );
      if (!profile) {
        return sendCorsResponse(res, 404, { error: "Profile not found" });
      }
      return sendCorsResponse(res, 200, { data: profile });
    }
    if (req.method === "PUT" || req.body?.action === "update") {
      const { first_name, last_name, phone, company } = req.body;
      const profile = await queryOne(
        `UPDATE profiles SET
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          phone = COALESCE($4, phone),
          company = COALESCE($5, company),
          updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [userId, first_name, last_name, phone, company]
      );
      return sendCorsResponse(res, 200, { data: profile });
    }
    return sendCorsResponse(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Profile error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/videos.ts
async function handler17(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    if (req.method === "GET") {
      const { rows } = await query(
        "SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (req.method === "DELETE") {
      const videoId = req.body?.id || req.query?.id;
      if (!videoId) {
        return sendCorsResponse(res, 400, { error: "Video ID is required" });
      }
      const video = await queryOne(
        "SELECT id FROM videos WHERE id = $1 AND user_id = $2",
        [videoId, userId]
      );
      if (!video) {
        return sendCorsResponse(res, 404, { error: "Video not found" });
      }
      await query("DELETE FROM videos WHERE id = $1", [videoId]);
      return sendCorsResponse(res, 200, { success: true });
    }
    return sendCorsResponse(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Videos error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/user-models.ts
async function handler18(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    if (req.method === "GET") {
      const { rows } = await query(
        "SELECT * FROM user_models WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (req.method === "DELETE") {
      const modelId = req.body?.id || req.query?.id;
      if (!modelId) {
        return sendCorsResponse(res, 400, { error: "Model ID is required" });
      }
      await query("DELETE FROM user_models WHERE id = $1 AND user_id = $2", [modelId, userId]);
      return sendCorsResponse(res, 200, { success: true });
    }
    return sendCorsResponse(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("User models error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/brand-profiles.ts
async function handler19(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    if (req.method === "GET") {
      const { rows } = await query(
        "SELECT * FROM brand_profiles WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (req.method === "POST") {
      const body = req.body;
      const result = await queryOne(
        `INSERT INTO brand_profiles (user_id, brand_name, brand_style, brand_colors, brand_mood, logo_url, brand_dna_prompt, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, body.brand_name, body.brand_style, body.brand_colors, body.brand_mood, body.logo_url, body.brand_dna_prompt, body.is_active ?? true]
      );
      return sendCorsResponse(res, 200, { data: result });
    }
    if (req.method === "PUT") {
      const { id, ...updates } = req.body;
      if (!id) return sendCorsResponse(res, 400, { error: "ID is required" });
      const setClauses = [];
      const values = [id, userId];
      let paramIndex = 3;
      for (const [key, value] of Object.entries(updates)) {
        if (["brand_name", "brand_style", "brand_colors", "brand_mood", "logo_url", "brand_dna_prompt", "is_active"].includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      if (setClauses.length === 0) return sendCorsResponse(res, 400, { error: "No valid fields to update" });
      setClauses.push(`updated_at = NOW()`);
      const result = await queryOne(
        `UPDATE brand_profiles SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
        values
      );
      return sendCorsResponse(res, 200, { data: result });
    }
    return sendCorsResponse(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Brand profiles error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/admin-data.ts
async function handler20(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    const isAdmin = await queryOne(
      "SELECT has_role($1, $2) as result",
      [userId, "admin"]
    );
    if (!isAdmin?.result) {
      return sendCorsResponse(res, 403, { error: "Forbidden" });
    }
    const { table } = req.body || req.query || {};
    if (table === "profiles") {
      const { rows } = await query("SELECT * FROM profiles ORDER BY created_at DESC");
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (table === "images") {
      const { rows } = await query("SELECT * FROM images ORDER BY created_at DESC LIMIT 100");
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (table === "videos") {
      const { rows } = await query("SELECT * FROM videos ORDER BY created_at DESC LIMIT 100");
      return sendCorsResponse(res, 200, { data: rows });
    }
    if (table === "user_roles") {
      const { rows } = await query("SELECT * FROM user_roles ORDER BY created_at DESC");
      return sendCorsResponse(res, 200, { data: rows });
    }
    return sendCorsResponse(res, 400, { error: "Invalid table parameter" });
  } catch (err) {
    console.error("Admin data error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/upload.ts
async function handler21(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;
    const { bucket, path, contentType, data } = req.body;
    if (!bucket || !path || !data) {
      return sendCorsResponse(res, 400, { error: "bucket, path, and data are required" });
    }
    if (!path.startsWith(`${userId}/`)) {
      return sendCorsResponse(res, 403, { error: "Cannot upload to this path" });
    }
    const buffer = Buffer.from(data, "base64");
    const { error } = await uploadFile(bucket, path, buffer, contentType || "application/octet-stream");
    if (error) {
      return sendCorsResponse(res, 500, { error: error.message });
    }
    return sendCorsResponse(res, 200, { success: true, path });
  } catch (err) {
    console.error("Upload error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// api/signed-url.ts
async function handler22(req, res) {
  handleCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { bucket, path, expiresIn } = req.body;
    if (!bucket || !path) {
      return sendCorsResponse(res, 400, { error: "bucket and path are required" });
    }
    const { data, error } = await getSignedUrl(bucket, path, expiresIn || 7 * 24 * 60 * 60);
    if (error || !data) {
      return sendCorsResponse(res, 500, { error: error?.message || "Failed to generate signed URL" });
    }
    return sendCorsResponse(res, 200, { signedUrl: data.signedUrl });
  } catch (err) {
    console.error("Signed URL error:", err);
    return sendCorsResponse(res, 500, { error: "Internal error" });
  }
}

// server.ts
var REQUIRED_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
  "GOOGLE_API_KEY"
];
var missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env variables: ${missing.join(", ")}`);
  console.error("Server will start but some API calls will fail.");
}
var OPTIONAL_ENV = ["GOOGLE_ANALYSIS_API_KEY", "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "JWT_REFRESH_SECRET"];
var missingOptional = OPTIONAL_ENV.filter((k) => !process.env[k]);
if (missingOptional.length > 0) {
  console.warn(`Missing optional env variables: ${missingOptional.join(", ")}`);
}
var app = express();
var PORT = process.env.API_PORT || 3001;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} \u2192 ${res.statusCode} (${duration}ms)`);
  });
  next();
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      MINIO_ENDPOINT: !!process.env.MINIO_ENDPOINT
    }
  });
});
app.all("/api/auth/signup", handler9);
app.all("/api/auth/login", handler10);
app.all("/api/auth/refresh", handler11);
app.all("/api/auth/me", handler12);
app.all("/api/generate-jewelry", handler);
app.all("/api/generate-jewelry-v2", handler2);
app.all("/api/generate-video", handler3);
app.all("/api/generate-design", handler4);
app.all("/api/generate-model", handler5);
app.all("/api/check-video-status", handler7);
app.all("/api/analyze-brand", handler8);
app.all("/api/admin-set-credits", handler6);
app.all("/api/admin-data", handler20);
app.all("/api/scenes", handler13);
app.all("/api/images", handler14);
app.get("/api/processing-jobs/:id", handler15);
app.all("/api/processing-jobs", handler15);
app.all("/api/profile", handler16);
app.all("/api/videos", handler17);
app.all("/api/user-models", handler18);
app.all("/api/brand-profiles", handler19);
app.all("/api/upload", handler21);
app.all("/api/signed-url", handler22);
app.get("/storage/{*path}", async (req, res) => {
  try {
    const minioEndpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";
    const targetPath = "/" + (req.params.path || req.params[0] || "");
    const queryString = req.originalUrl.split("?")[1] || "";
    const targetUrl = `${minioEndpoint}${targetPath}${queryString ? "?" + queryString : ""}`;
    const minioUrl = new URL(minioEndpoint);
    const minioHost = minioUrl.host;
    const upstream = await fetch(targetUrl, {
      headers: { "Host": minioHost }
    });
    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Storage proxy error:", err?.message);
    res.status(502).json({ error: "Storage proxy error" });
  }
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled Express error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  setTimeout(() => process.exit(1), 1e3);
});
async function validateGeminiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY not set \u2014 Gemini calls will fail");
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      console.log("Gemini API key validated successfully");
    } else {
      const text = await res.text();
      console.error(`Gemini API key validation failed (${res.status}): ${text.substring(0, 200)}`);
    }
  } catch (err) {
    console.error("Gemini API key validation error:", err?.message || err);
  }
}
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  validateGeminiKey();
});
