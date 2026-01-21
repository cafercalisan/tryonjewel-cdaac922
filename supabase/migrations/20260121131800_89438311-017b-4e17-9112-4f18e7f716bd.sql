-- Update existing manken scenes with new cinematic prompts

-- 1. Akdeniz Kayalık Sahil - Sinematik Uzanan Model
UPDATE public.scenes 
SET 
  name = 'Mediterranean Rocky Coast - Cinematic Lying Model',
  name_tr = 'Akdeniz Kayalık Sahil – Sinematik Uzanan Model',
  prompt = 'Ultra-realistic cinematic editorial jewelry photography on a Mediterranean rocky coastline.
A fashion model with refined facial structure, natural symmetry, healthy skin texture.
Age range 23–30, slim but strong body proportions, relaxed elegance.
Hair slightly tousled by sea breeze, natural movement, no rigid styling.

Model lying naturally on warm coastal rocks, body aligned with the landscape.
Hands positioned intentionally to frame and highlight the jewelry.
Expression calm, introspective, distant gaze — not posing for camera.

Low-angle side sunlight (golden Mediterranean afternoon).
Soft cinematic diffusion, subtle halation around highlights.
Natural shadow gradients across skin, stone, and metal.

Camera: Full-frame cinema-grade sensor look, 85mm prime lens.
Aperture: f/2.8 with creamy background separation.
Color science: filmic, soft contrast, gentle highlight roll-off.
No artificial glow, no beauty filter, skin remains real.
Jewelry remains the sharpest and brightest element in frame.

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose
- jewelry_focus_priority = maximum
- NO stone enlargement, NO nail structure changes, NO stone cut modifications'
WHERE name_tr = 'Akdeniz Kayalık Sahil – Model Uzanan';

-- 2. Kıyı Uçurumu - Sinematik Güçlü Model
UPDATE public.scenes 
SET 
  name = 'Coastal Cliff - Cinematic Strong Model',
  name_tr = 'Kıyı Uçurumu – Sinematik Güçlü Model',
  prompt = 'High-end cinematic editorial jewelry photography on a coastal cliff edge.
Fashion model with sharp bone structure, confident posture.
Minimal makeup, natural skin sheen, no artificial perfection.
Wardrobe neutral, flowing fabric responding subtly to wind.

Model standing tall near cliff edge, body slightly angled.
Hair and fabric gently moved by coastal wind.
Jewelry positioned to catch natural light without exaggeration.

Sunlight high but angled, creating controlled top-down illumination.
Soft cinematic contrast, realistic highlights.
Atmospheric depth between foreground and distant sea.

Camera: Full-frame cinema look, 90mm lens.
Aperture: f/3.2 for balanced sharpness.
Film-inspired color grading, restrained saturation.
Mood: strength, independence, modern luxury.

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose
- jewelry_focus_priority = maximum
- NO stone enlargement, NO nail structure changes, NO stone cut modifications'
WHERE name_tr = 'Kıyı Uçurumu – Ayakta Model';

-- 3. Taş Teras - Sinematik Mimari
UPDATE public.scenes 
SET 
  name = 'Stone Terrace - Cinematic Architectural',
  name_tr = 'Taş Teras – Sinematik Mimari',
  prompt = 'Cinematic editorial jewelry photography on a Mediterranean stone terrace.
Model with elegant proportions, calm presence, editorial facial expression.
Skin shows real texture, pores visible, no smoothing.

Model seated naturally, posture relaxed yet intentional.
Hands positioned close to body to frame jewelry organically.
Stone architecture interacts visually with body lines.

Diagonal sunlight enters scene, creating soft linear shadows.
Warm stone bounce light subtly illuminates skin and jewelry.
Soft cinematic diffusion without loss of detail.

Camera: Full-frame sensor, 100mm macro lens.
Aperture: f/4 for jewelry clarity and depth control.
Color palette neutral-warm, filmic tonal transitions.
Mood: timeless, architectural, editorial luxury.

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose
- jewelry_focus_priority = maximum
- NO stone enlargement, NO nail structure changes, NO stone cut modifications'
WHERE name_tr = 'Taş Teras – Oturan Model';

-- 4. Kayalık Koy - Sinematik Dokunuş
UPDATE public.scenes 
SET 
  name = 'Rocky Cove - Cinematic Touch',
  name_tr = 'Kayalık Koy – Sinematik Dokunuş',
  prompt = 'Ultra-realistic cinematic editorial jewelry photography in a secluded rocky cove.
Focus on tactile interaction between model and environment.
Model with refined hands, natural nails, realistic skin creases.

Hand gently touching stone or shallow water.
Jewelry fully visible, interacting with reflected light.
Water movement minimal, calm surface.

Indirect sunlight reflected from sea surface.
Soft shimmering highlights on metal and gemstones.
Cinematic softness with precise focus on jewelry.

Camera: Full-frame cinema-grade look, 85mm prime lens.
Aperture: f/2.8 with razor-sharp focal plane.
Film-inspired color science, gentle contrast curve.
Mood: intimate, sensual, premium editorial.

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose
- jewelry_focus_priority = maximum
- NO stone enlargement, NO nail structure changes, NO stone cut modifications'
WHERE name_tr = 'Kayalık Koy – El Detaylı Model';

-- 5. Kıyı Patikası - Sinematik Hareket
UPDATE public.scenes 
SET 
  name = 'Coastal Path - Cinematic Movement',
  name_tr = 'Kıyı Patikası – Sinematik Hareket',
  prompt = 'Cinematic editorial jewelry photography featuring a fashion model walking along a coastal path.
Model captured mid-motion, natural stride, unforced elegance.
Expression neutral, inward-focused, not engaging camera.

Jewelry framed naturally through arm and body movement.
Environment provides depth without distraction.

Sunlight positioned slightly behind and to the side.
Soft rim light outlines silhouette.
Cinematic softness with controlled motion clarity.

Camera: Full-frame sensor, 105mm lens.
Aperture: f/3.5 for depth and motion balance.
Subtle motion blur only in background, subject remains crisp.
Mood: lifestyle luxury, fashion film still.

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose
- jewelry_focus_priority = maximum
- NO stone enlargement, NO nail structure changes, NO stone cut modifications'
WHERE name_tr = 'Kıyı Patikası – Yürüyen Model';