-- Insert 5 new outdoor/nature scenes for model shots
INSERT INTO public.scenes (name, name_tr, category, sub_category, description, description_tr, prompt, product_type_category, sort_order, is_premium)
VALUES
-- 1. Yaz / Kumsal – Gün Işığı Sahnesi
(
  'Summer Beach Daylight',
  'Yaz Kumsal Gün Işığı',
  'manken',
  'Beach',
  'High-end editorial jewelry photography on a minimal sandy beach with soft natural daylight.',
  'Minimal kumsal ortamında yumuşak doğal gün ışığıyla lüks editöryal mücevher fotoğrafçılığı.',
  'High-end editorial jewelry photography set on a minimal sandy beach environment. Soft natural sand texture in the foreground, subtle ocean horizon blurred in the background. Bright natural daylight, realistic sun direction with soft shadows. No props competing with the jewelry. The uploaded jewelry product is the absolute focal point. Accurate metal color preservation, no recoloring. Diamonds show realistic light refraction and true facet behavior. Camera: 85mm lens, shallow depth of field. Lighting: natural daylight, slightly diffused, no artificial highlights. Mood: fresh, elegant, summer luxury. Background elements must remain secondary and softly out of focus. Ultra-realistic, non-plastic materials.',
  'all',
  100,
  false
),
-- 2. Çöl / Kum Tepeleri – Editorial Lüks
(
  'Desert Dunes Editorial',
  'Çöl Kum Tepeleri',
  'manken',
  'Desert',
  'Luxury editorial jewelry photography in a desert dune environment with golden daylight.',
  'Çöl kum tepeleri ortamında altın gün ışığıyla lüks editöryal mücevher fotoğrafçılığı.',
  'Luxury editorial jewelry photography in a desert dune environment. Soft rolling sand dunes with clean, uninterrupted lines. No vegetation, no human elements. Low-angle natural sunlight creating long, realistic shadows. Warm desert tones without overpowering the jewelry. The jewelry remains perfectly color-accurate. Camera: 70–100mm lens, medium depth of field. Lighting: natural golden daylight, physically correct shadow falloff. Mood: powerful, timeless, high-end editorial. Sand texture must appear natural and fine-grain, not stylized. Product-first composition at all times.',
  'all',
  101,
  false
),
-- 3. Akdeniz Kayalık Sahil
(
  'Mediterranean Rocky Coast',
  'Akdeniz Kayalık Sahil',
  'manken',
  'Coastal',
  'Editorial luxury jewelry scene on a Mediterranean rocky coastline with turquoise sea.',
  'Turkuaz deniz arka planıyla Akdeniz kayalık sahilinde lüks editöryal mücevher sahnesi.',
  'Editorial luxury jewelry scene on a Mediterranean rocky coastline. Natural stone textures in neutral gray tones. Turquoise sea softly blurred in the background. Strong natural sunlight with crisp but realistic shadows. Subtle light reflections from the sea onto the jewelry. Exact material fidelity: metal color and gemstone clarity preserved. Camera: 90mm lens, shallow depth of field. Lighting: direct natural sunlight, balanced exposure. Mood: premium lifestyle, fresh coastal elegance. No exaggerated saturation or artificial glow.',
  'all',
  102,
  false
),
-- 4. Tropikal Minimal (Palmiyesiz)
(
  'Minimal Tropical Light',
  'Minimal Tropikal Işık',
  'manken',
  'Tropical',
  'Minimal tropical-inspired editorial jewelry photography with warm natural light.',
  'Sıcak doğal ışıkla minimal tropikal ilhamlı editöryal mücevher fotoğrafçılığı.',
  'Minimal tropical-inspired editorial jewelry photography. Clean, warm-toned background suggesting tropical daylight without visible plants. No palm trees, no exotic props. Soft, warm natural light wrapping the jewelry gently. Even illumination with realistic highlights and shadows. The product remains dominant and sharply defined. Camera: 85mm lens, controlled depth of field. Lighting: warm daylight, diffused, skin- and metal-friendly. Mood: relaxed luxury, modern and clean. Avoid decorative distractions and color shifts.',
  'all',
  103,
  false
),
-- 5. Gün Batımı – Golden Hour Editorial
(
  'Golden Hour Sunset',
  'Golden Hour Gün Batımı',
  'manken',
  'Sunset',
  'High-end editorial jewelry photography during golden hour with warm sunset tones.',
  'Sıcak gün batımı tonlarıyla altın saat editöryal mücevher fotoğrafçılığı.',
  'High-end editorial jewelry photography during golden hour. Soft sunset sky tones in the background, fully out of focus. No visible sun disk, only ambient golden light. Warm, low-contrast illumination with smooth tonal transitions. Natural reflections on metal and gemstones. Strict preservation of original product geometry and color. Camera: 85–105mm lens, shallow depth of field. Lighting: natural sunset light only, no artificial effects. Mood: emotional, refined, premium campaign aesthetic. No lens flare unless extremely subtle and realistic.',
  'all',
  104,
  false
);