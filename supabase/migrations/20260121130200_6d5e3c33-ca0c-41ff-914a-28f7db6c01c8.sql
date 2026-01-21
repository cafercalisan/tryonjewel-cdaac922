-- First, drop the existing check constraint and add a new one with 'doga' category
ALTER TABLE public.scenes DROP CONSTRAINT IF EXISTS scenes_category_check;

ALTER TABLE public.scenes ADD CONSTRAINT scenes_category_check 
CHECK (category IN ('studio', 'lifestyle', 'urun', 'manken', 'doga'));

-- Add 5 new nature/coastal scenes
INSERT INTO public.scenes (name, name_tr, category, sub_category, description, description_tr, prompt, sort_order, product_type_category)
VALUES
-- Nature scenes (doga category)
('Mediterranean Rocky Coast - Side Light', 'Akdeniz Kayalık Sahil – Yan Işık', 'doga', 'standart', 
 'Rocky coastline with directional side lighting creating dramatic shadows',
 'Yönlü yan ışıkla dramatik gölgeler oluşturan kayalık kıyı',
 'Ultra-realistic editorial jewelry photography on a Mediterranean rocky coastline. Natural limestone and granite rock formations with authentic surface texture. Sea visible in the background, softly blurred, no dominant horizon. Sun positioned at a low side angle (30–40 degrees), creating directional natural light. Clear shadow definition with soft edge falloff. Subtle reflected light bouncing from stone surfaces onto the jewelry. Camera: Full-frame camera, 90mm prime lens. Aperture: f/2.8 for shallow but controlled depth of field. Lighting: natural sunlight only, no artificial fill. Material realism prioritized: exact metal tone, true gemstone refraction. Composition remains product-first, environment supports but never dominates.',
 30, 'genel'),

('Coastal Cliff - Top Light', 'Kıyı Uçurumu – Üstten Işık', 'doga', 'standart',
 'Cliff edge with clean top-down natural illumination',
 'Temiz üstten aydınlatma ile uçurum kenarı',
 'High-end editorial jewelry photography on a coastal cliff edge. Rough stone ground with natural erosion patterns. Open sea far below, atmospheric depth, softly out of focus. Sun positioned high but slightly angled, producing clean top-down illumination. Short, realistic shadows directly under the jewelry. Natural ambient fill from sky and sea. Camera: Full-frame, 85mm lens. Aperture: f/3.2 for clarity and separation. Lighting: outdoor midday daylight, neutral color temperature. No cinematic exaggeration, strictly photographic realism. Jewelry geometry and proportions must remain untouched.',
 31, 'genel'),

('Stone Terrace - Mediterranean Architecture', 'Taş Teras – Akdeniz Mimari', 'doga', 'standart',
 'Natural stone terrace with architectural elements and Mediterranean atmosphere',
 'Mimari öğeler ve Akdeniz atmosferi ile doğal taş teras',
 'Editorial luxury jewelry photography on a natural stone terrace overlooking the Mediterranean. Large-cut stone slabs with subtle imperfections and natural joints. Background architecture hinted but heavily blurred. Sunlight enters from a diagonal angle, creating soft linear shadows. Balanced contrast, no harsh highlights. Warm stone bounce light adds depth without color contamination. Camera: Full-frame camera, 100mm macro lens. Aperture: f/4 for maximum detail on jewelry. Lighting: natural daylight, controlled exposure. Mood: architectural, refined, timeless luxury. No props or decorative elements.',
 32, 'genel'),

('Rocky Cove - Sea Reflection', 'Kayalık Koy – Deniz Yansıması', 'doga', 'standart',
 'Secluded cove with reflected light from water surface',
 'Su yüzeyinden yansıyan ışık ile tenha koy',
 'Ultra-realistic editorial jewelry photography in a secluded rocky cove. Dark and light stone contrast with visible waterline nearby. Sea surface reflects soft light upward onto the jewelry. Sun positioned opposite the camera, indirect lighting dominates. Natural fill light from water reflections enhances gemstone sparkle. No direct glare or blown highlights. Camera: Full-frame camera, 85mm prime lens. Aperture: f/2.8 with precise focus on the product. Lighting: natural reflected daylight only. Extremely realistic surface interaction between jewelry and environment.',
 33, 'genel'),

('Coastal Path - Natural Perspective', 'Kıyı Patikası – Doğal Perspektif', 'doga', 'standart',
 'Natural walking path with depth and organic textures',
 'Derinlik ve organik dokular ile doğal yürüyüş patikası',
 'High-end editorial jewelry photography on a natural coastal walking path. Stone and compact earth surface with organic irregularities. Background fades into coastal landscape depth. Sunlight enters from behind the camera at a slight angle. Natural perspective compression creates depth and scale. Soft shadows define form without overpowering. Camera: Full-frame camera, 105mm lens. Aperture: f/3.5 for balanced depth. Lighting: natural daylight, no enhancement. Mood: authentic outdoor editorial, fashion-campaign ready. Absolute realism in material rendering.',
 34, 'genel'),

-- Model scenes (manken category)
('Mediterranean Rocky Coast - Lying Model', 'Akdeniz Kayalık Sahil – Model Uzanan', 'manken', 'standart',
 'Fashion model lying naturally on Mediterranean coastal rocks',
 'Akdeniz kayalıklarında doğal uzanan moda modeli',
 'Ultra-realistic editorial jewelry photography with a fashion model lying naturally on Mediterranean coastal rocks. Model positioned diagonally across the frame, relaxed posture, body aligned with rock formations. Jewelry clearly visible and unobstructed. Low-angle side sunlight (30–40 degrees) sculpting facial features and jewelry. Natural skin texture, no plastic smoothing. Soft shadow transitions across rocks and skin. Camera: Full-frame camera, 85mm prime lens. Aperture: f/2.8 to separate model and jewelry from background. Lighting: natural sunlight only, no studio lighting. Mood: effortless luxury, coastal editorial. Model expression calm, confident, non-commercial.',
 40, 'genel'),

('Coastal Cliff - Standing Model', 'Kıyı Uçurumu – Ayakta Model', 'manken', 'standart',
 'Fashion model standing near cliff edge with natural wind effect',
 'Doğal rüzgar etkisi ile uçurum kenarında ayakta duran model',
 'High-end editorial jewelry photography featuring a fashion model standing near a coastal cliff edge. Model facing slightly away from camera, head turned softly toward light. Hair and fabric subtly affected by natural wind. Sun positioned high and slightly angled, producing clean top-down illumination. Jewelry catches natural highlights without glare. Shadows remain short and realistic. Camera: Full-frame camera, 90mm lens. Aperture: f/3.2 for balanced sharpness. Lighting: outdoor daylight, neutral color balance. Mood: strong, modern, fashion-forward luxury. No exaggerated poses or expressions.',
 41, 'genel'),

('Stone Terrace - Seated Model', 'Taş Teras – Oturan Model', 'manken', 'standart',
 'Fashion model seated on Mediterranean stone terrace',
 'Akdeniz taş terasında oturan moda modeli',
 'Editorial luxury jewelry photography with a fashion model seated on a Mediterranean stone terrace. Model posture relaxed yet composed, hands naturally placed to showcase jewelry. Stone textures visible but secondary. Diagonal sunlight creates linear shadow patterns. Warm stone bounce light enhances skin and metal tones. No harsh contrast. Camera: Full-frame camera, 100mm macro lens. Aperture: f/4 for maximum jewelry detail. Lighting: natural daylight only. Mood: architectural elegance, timeless editorial. Model styling minimal, no dominant clothing elements.',
 42, 'genel'),

('Rocky Cove - Hand Detail Model', 'Kayalık Koy – El Detaylı Model', 'manken', 'standart',
 'Model with hand touching stone or water, jewelry focus',
 'Eli taşa veya suya değen model, mücevher odağı',
 'Ultra-realistic editorial jewelry photography with a fashion model positioned at a rocky cove. Model''s hand gently touching stone or shallow water, jewelry fully visible. Focus on interaction between skin, jewelry, and natural elements. Indirect lighting dominates, sunlight reflected from sea surface. Soft highlights on gemstones, no blown reflections. Skin remains natural with visible texture. Camera: Full-frame camera, 85mm prime lens. Aperture: f/2.8 with precise focus control. Lighting: natural reflected daylight. Mood: intimate, tactile, premium editorial. No dramatic gestures or artificial poses.',
 43, 'genel'),

('Coastal Path - Walking Model', 'Kıyı Patikası – Yürüyen Model', 'manken', 'standart',
 'Fashion model walking along coastal path, candid moment',
 'Kıyı patikasında yürüyen model, doğal an',
 'High-end editorial jewelry photography featuring a fashion model walking along a coastal path. Captured mid-step, natural movement, candid editorial moment. Jewelry remains clearly framed and readable. Sunlight enters slightly behind and to the side of the camera. Natural depth created through perspective compression. Soft shadows define form without distraction. Camera: Full-frame camera, 105mm lens. Aperture: f/3.5 for balanced depth and motion clarity. Lighting: natural daylight only. Mood: lifestyle luxury, fashion campaign realism. Model expression neutral, confident, unposed.',
 44, 'genel');