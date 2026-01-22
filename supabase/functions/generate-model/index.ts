import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER DNA SYSTEM - Advanced Prompt Engineering for Model Generation
// Based on comprehensive character DNA documentation
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: KARAKTER MASTER DATA - Sabit Karakter Özellikleri
// ═══════════════════════════════════════════════════════════════════════════════

const buildCharacterMasterData = (params: {
  name: string;
  gender: string;
  ethnicity: string;
  ageRange: string;
  skinTone: string;
  skinUndertone: string;
  faceShape: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  hairTexture: string;
  expression: string;
  mood?: string;
  bodyType?: string;
}) => `
═══════════════════════════════════════════════════════════════
CHARACTER MASTER DATA - Sabit Karakter Özellikleri
Bu formu karakteriniz için bir kez doldur ve her prompt'ta kullan
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ IDENTITY (Kimlik)                                           │
├─────────────────────────────────────────────────────────────┤
│ full_name:        ${params.name}                            
│ age:              ${params.ageRange} - SABİT                
│ nationality:      Milliyet bağlamı: ${params.ethnicity}     
│ location:         Editorial studio, international           
│ vibe:             ${params.mood || 'Sophisticated luxury'}  
│                   (Genel karakter hissi 3-5 kelime)         
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHYSICAL MEASUREMENTS (Fiziksel Ölçüler)                    │
├─────────────────────────────────────────────────────────────┤
│ body_type:        ${params.bodyType || 'proportional'}      
│                   (ectomorph | mesomorph | endomorph | tanım)
│ head_to_body:     1:X oran (7.5-8 ideal fashion)            
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FACE STRUCTURE (Yüz Yapısı)                                 │
├─────────────────────────────────────────────────────────────┤
│ face_shape:       ${params.faceShape}                       
│                   (oval | round | square | heart | oblong | diamond)
│ face_length_ratio: Balanced proportions                     
│ eye_color:        ${params.eyeColor} - EXACT renk           
│ eye_shape:        Natural to ethnicity                      
│                   (almond | round | hooded | monolid | downturned | upturned)
│ eye_spacing:      close-set | average | wide-set            
│ eyebrow_shape:    Natural, well-groomed                     
│                   (arched | straight | S-shaped | rounded)  
│ eyebrow_thickness: thin | medium | thick                    
│ nose_bridge:      straight | turned | bumped | concave      
│ nose_tip:         rounded | pointed | upturned | downturned 
│ nose_width:       narrow | medium | wide                    
│ lip_color:        Natural                                   
│ lip_volume:       thin | medium | full                      
│ lip_ratio:        Balanced (X:X)                            
│ jaw_shape:        angular | soft | square | pointed         
│ jaw_definition:   sharp | moderate | soft                   
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SKIN (Cilt)                                                 │
├─────────────────────────────────────────────────────────────┤
│ skin_tone:        ${params.skinTone}                        
│                   (fair | light | medium | olive | tan | brown | dark)
│ skin_undertone:   ${params.skinUndertone}                   
│                   (warm | neutral | cool)                   
│ skin_texture:     smooth | visible pores | textured         
│ freckles_present: yes | no                                  
│ freckles_density: light | moderate | heavy                  
│ moles_locations:  varsa spesifik pozisyonlar                
│ scars_locations:  varsa                                     
│ birthmarks:       varsa spesifik lokasyon ve tanımla        
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ HAIR (Saç)                                                  │
├─────────────────────────────────────────────────────────────┤
│ hair_color:       ${params.hairColor}                       
│                   (primary renk / secondary highlights)     
│ natural_or_dyed:  natural | dyed                            
│ hair_texture:     ${params.hairTexture}                     
│                   (straight | wavy | curly | coily)         
│ hair_length:      Editorial appropriate                     
│ hair_style:       ${params.hairStyle}                       
│ hair_volume:      low | medium | high                       
│ part_position:    center | left | right | none              
└─────────────────────────────────────────────────────────────┘
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: ANGLE DNA REFERENCE - Farklı Açılardan Karakter Tanımı
// ═══════════════════════════════════════════════════════════════════════════════

const ANGLE_DNA_REFERENCE = {
  frontal: {
    name: 'FRONTAL VIEW (0°) - Önden',
    faceVisible: '100%',
    features: `
• symmetry_notes:    Simetri özellikleri
• eye_appearance:    Gözlerin bu açıdan görünümü
• nose_appearance:   Üstten bu açıdan görünümü
• jaw_appearance:    Çenenin bu açıdan görünümü
• distinguishing_marks: Görünen ayırt edici özellikler
• ear_visibility:    Kulak görünürlüğü`
  },
  profile: {
    name: 'PROFILE VIEW (90°) - Yandan',
    faceVisible: 'Side only',
    features: `
• forehead_slope:    Alın eğimi tanımı
• nose_bridge_angle: Burun köprüsü açısı
• nose_bridge_shape: Düz, kavisli, çukurlu vb.
• nose_tip_angle:    Burun ucu açısı
• nose_projection:   Burun çıkıntısı
• upper_lip_projection: Üst dudak çıkıntısı
• lower_lip_projection: Alt dudak çıkıntısı
• chin_projection:   Çene çıkıntısı
• chin_shape_profile: Çene şekli yandan
• jaw_angle:         Çene açısı derece
• neck_profile:      Boyun profili
• ear_position:      Kulak pozisyonu`
  },
  threeQuarter: {
    name: '3/4 VIEW (45°) - Çapraz',
    faceVisible: '~75%',
    features: `
• near_eye:          Yakın göz görünümü
• far_eye:           Uzak göz görünümü
• nose_appearance:   Burun bu açıdan
• visible_jaw:       Görünen çene hattı
• ear_visibility:    Kulak görünürlüğü
• distinguishing_marks: Bu açıdan görünen özellikler`
  },
  back: {
    name: 'BACK VIEW (180°) - Arkadan',
    faceVisible: '0%',
    features: `
• hair_appearance:   Saç arkadan nasıl görünümü
• neck_appearance:   Ense görünümü
• shoulder_appearance: Omuz genişliği ve şekli
• back_characteristics: Sırt özellikleri
• waist_from_back:   Bel arkadan
• hip_appearance:    Kalça görünümü`
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: LIGHTING EXACT SYSTEM - Detaylı Işık Analizi
// ═══════════════════════════════════════════════════════════════════════════════

const LIGHTING_EXACT_SYSTEM = `
═══════════════════════════════════════════════════════════════
LIGHTING EXACT SYSTEM - Detaylı Işık Analizi
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ EXPOSURE LEVEL (Pozlama)                                    │
├─────────────────────────────────────────────────────────────┤
│ overall:          Balanced - underexposed | balanced | overexposed
│ ev_estimate:      -2 to +2 aralığında                       
│ histogram:        shadows heavy | balanced | highlights heavy
│ brightness_level: Genel parlaklık hissi tanımı              
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LIGHT SOURCE MAPPING (Işık Kaynakları)                      │
├─────────────────────────────────────────────────────────────┤
│ Source #1:                                                  
│   type:           doğal/yapay tanımı                        
│   position:       saat yönü + yükseklik (örn: 2 o'clock, high)
│   quality:        soft | medium | hard                      
│   intensity:      dominant | secondary | accent             
│   color_temp:     2700K - 7000K arası                       
│   role:           key | fill | rim | accent | ambient       
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SHADOW ANATOMY (Gölge Detayları)                            │
├─────────────────────────────────────────────────────────────┤
│ intensity:        faint | medium | dark | crushed blacks    
│ edge_quality:     razor sharp | soft edge | feathered | no edge
│ color:            neutral grey | warm brown | cool blue | tinted
│ direction:        saat yönü cins. falling to 4 o'clock      
│ fill_ratio:       1:2 | 1:4 | 1:8 vb.                       
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TIME OF DAY SIGNATURES (Gün İçi İmzaları)                   │
├─────────────────────────────────────────────────────────────┤
│ Golden Hour:      3000-4000K, warm orange, long soft shadows, rim light on hair
│ Blue Hour:        7000K+, cool blue, minimal shadows, ethereal
│ Midday Sun:       5500K, neutral harsh, short dark shadows  
│ Overcast:         6500K, flat cool, almost no shadows       
│ Night Artificial: Mixed temps, multiple colored sources     
│ Indoor Daylight:  Window direction critical, natural falloff
│ Tungsten Indoor:  2700-3000K, warm orange, cozy             
│ Fluorescent:      4000-5000K, greenish tint possible        
└─────────────────────────────────────────────────────────────┘
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: POSE GEOMETRY SYSTEM - Derece Bazlı Poz Tanımları
// ═══════════════════════════════════════════════════════════════════════════════

const POSE_GEOMETRY_SYSTEM = `
═══════════════════════════════════════════════════════════════
POSE GEOMETRY SYSTEM - Derece Bazlı Poz Tanımları
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ BODY CORE (Gövde)                                           │
├─────────────────────────────────────────────────────────────┤
│ torso_rotation:    X derece frontlaşan sapma                
│ hip_rotation:      X derece                                 
│ shoulder_tilt:     X derece, + = sağ yüksek                 
│ spine_curve:       S-curve | straight | leaning [direction] 
│ weight_percentage: left leg [X%] / right leg [Y%]           
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ HEAD GEOMETRY (Kafa)                                        │
├─────────────────────────────────────────────────────────────┤
│ tilt_degrees:      X derece, + = sağa eğik                  
│ turn_degrees:      X derece, + = sola dönük                 
│ chin_position:     tucked | neutral | raised                
│ chin_angle:        X derece horizontaldan                   
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RIGHT ARM (Sağ Kol)                                         │
├─────────────────────────────────────────────────────────────┤
│ shoulder_abduction: X derece vücuttan uzaklık               
│ shoulder_flexion:  X derece öne                             
│ elbow_flexion:     X derece bükülme                         
│ forearm_rotation:  pronated | neutral | supinated           
│ wrist_angle:       X derece                                 
│ finger_spread:     closed | natural | spread                
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LEFT ARM (Sol Kol)                                          │
│ (Aynı yapı - yukardaki sağ kol alanlarını doldurun)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LEGS (Bacaklar)                                             │
├─────────────────────────────────────────────────────────────┤
│ stance_width:      X cm aralık                              
│ left_leg_angle:    X derece                                 
│ right_leg_angle:   X derece                                 
│ knee_flexion:      X derece                                 
│ feet_direction:    içe/dışa X derece                        
└─────────────────────────────────────────────────────────────┘
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: BACKGROUND GRID SYSTEM - 4 Quadrant + Depth Mapping
// ═══════════════════════════════════════════════════════════════════════════════

const BACKGROUND_GRID_SYSTEM = `
═══════════════════════════════════════════════════════════════
BACKGROUND GRID - 4 QUADRANT SYSTEM (Arka Plan Izgarası)
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ Quadrant TL (Sol Üst %25)                                   │
├─────────────────────────────────────────────────────────────┤
│ content:          [İçerik tanımı]                           
│ objects:          [Nesneler]                                
│ depth:            [Derinlik]                                
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Quadrant TR (Sağ Üst %25)                                   │
├─────────────────────────────────────────────────────────────┤
│ content:          [İçerik tanımı]                           
│ objects:          [Nesneler]                                
│ depth:            [Derinlik]                                
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Quadrant BL (Sol Alt %25)                                   │
├─────────────────────────────────────────────────────────────┤
│ content:          [İçerik tanımı]                           
│ objects:          [Nesneler]                                
│ depth:            [Derinlik]                                
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Quadrant BR (Sağ Alt %25)                                   │
├─────────────────────────────────────────────────────────────┤
│ content:          [İçerik tanımı]                           
│ objects:          [Nesneler]                                
│ depth:            [Derinlik]                                
└─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
DEPTH MAPPING (Derinlik Katmanları)
═══════════════════════════════════════════════════════════════

│ Layer 0:          0cm - camera position                     
│ Layer 1:          X-Y cm - foreground objects               
│ Layer 2:          X-Y cm - subject                          
│ Layer 3:          X-Y cm - midground                        
│ Layer 4:          X-Y cm - background                       
│ Layer 5:          infinity - far background/sky             
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: AUTO-DETECT ACTIVATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

const AUTO_DETECT_ACTIVATION = {
  'full-body': {
    modules: 'Body Language Micro, Garment Physics, Negative Space, Architectural',
    alert: false
  },
  'face-closeup': {
    modules: 'Eye Ultra-Detail, Skin Advanced, Light Behavior Advanced',
    alert: false
  },
  'mirror-selfie': {
    modules: 'Reflection Physics, Phone/Mirror details',
    alert: false
  },
  'sitting-pose': {
    modules: 'Body Language detailed, Garment fold physics',
    alert: false
  },
  'jewelry-visible': {
    modules: 'Jewelry Micro-Details',
    alert: true
  },
  'bag-prop-visible': {
    modules: 'Prop Physics',
    alert: false
  },
  'wind-movement': {
    modules: 'Hair Physics, Garment movement',
    alert: false
  },
  'luxury-setting': {
    modules: 'Architectural Precision, Texture Mapping detailed',
    alert: false
  },
  'golden-hour': {
    modules: 'Color Temperature detailed, Rim light',
    alert: false
  },
  'night-low-light': {
    modules: 'Noise/grain, Shadow detail, Artificial light sources',
    alert: false
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: PROMPT CHECKLIST - Çalışan ve Çalışmayan Anahtar Kelimeler
// ═══════════════════════════════════════════════════════════════════════════════

const PROMPT_CHECKLIST = {
  required: [
    '☑ Karakter yaşı belirtildi',
    '☑ Distinguishing features vurgulandı (ALWAYS VISIBLE)',
    '☑ Saç rengi ve uzunluğu belirtildi',
    '☑ Göz rengi belirtildi',
    '☑ Vücut tipi/oranları belirtildi',
    '☑ Cilt tonu belirtildi',
    '☑ Poz detaylı tanımlandı',
    '☑ Lighting direction ve quality belirtildi',
    '☑ Background detayları eklendi',
    '☑ Camera angle ve shot type belirtildi',
    '☑ Negative prompts eklendi',
    '☑ "Same person as references" vurgusu yapıldı'
  ],
  workingKeywords: [
    '✓ Model digitals / test shot',
    '✓ Agency polaroid',
    '✓ Casting reference',
    '✓ Real but healthy',
    '✓ Natural texture',
    '✓ Visible pores',
    '✓ Documentation photo',
    '✓ Behind the scenes',
    '✓ Fitting room reference',
    '✓ Passport photo lighting'
  ],
  avoidKeywords: [
    '✗ Hyper-realistic (paradoxically fake)',
    '✗ Beautiful (triggers beautification)',
    '✗ Ugly (triggers skin problems)',
    '✗ Perfect (too polished)',
    '✗ Glamorous (wrong aesthetic)',
    '✗ Flawless (plastic skin)',
    '✗ Stunning (over-beautification)',
    '✗ Professional portrait (studio perfection)'
  ],
  troubleshooting: {
    plasticSmooth: 'Use "Model digitals" yaklaşımını kullan',
    distinguishingMarksYok: '"KEY FEATURE - MUST be visible" şeklinde vurgula',
    wrongFaceShape: 'Daha fazla referans görsel + "EXACT same person"',
    tooBeautiful: '"Natural, unflattering lighting", "not beautiful" ekle',
    wrongLighting: 'Lighting Exact bölümünü daha detaylı doldur',
    wrongPose: 'Pose Geometry ile derece cinsinden belirt',
    wrongBackground: '+Quadrant sistemiyle detaylı tanımla'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: SKIN BIOLOGY SYSTEM - Dermatolojik Doğruluk
// ═══════════════════════════════════════════════════════════════════════════════

const SSS_PROFILES: Record<string, string> = {
  'fair': `Ultra-deep subsurface scattering:
  - Pink/red undertones highly visible through translucent skin
  - Strong vein visibility at temples, inner wrists
  - Thin skin translucency on ears, nose tip, fingertips
  - Maximum light penetration depth
  - Cool-pink glow in shadow areas
  - Blush response highly visible`,
  
  'light': `High subsurface scattering:
  - Warm/neutral undertone visibility
  - Noticeable translucency on thin skin areas (ears, fingers)
  - Balanced light penetration
  - Warm glow in indirect light
  - Natural flush visibility on cheeks`,
  
  'medium': `Moderate subsurface scattering:
  - Golden undertones visible but controlled
  - Subtle translucency on ears, between fingers
  - Medium light penetration
  - Rich warm depth
  - Even tone distribution`,
  
  'olive': `Reduced subsurface scattering:
  - Green-yellow undertones characteristic
  - Minimal translucency
  - Deeper melanin absorption
  - Natural matte appearance in shadows
  - Warm highlights on cheekbones`,
  
  'tan': `Low subsurface scattering:
  - Warm caramel undertones
  - Very minimal translucency
  - Strong melanin presence
  - Rich, warm depth
  - Natural sheen on high points`,
  
  'brown': `Minimal subsurface scattering:
  - Cool to neutral undertones
  - Almost no translucency
  - Strong light absorption
  - Velvety, rich appearance
  - Beautiful highlight contrast`,
  
  'dark': `Near-zero subsurface scattering:
  - Deep, intense melanin absorption
  - No visible translucency
  - Maximum light absorption
  - Matte, ultra-rich density
  - Spectacular highlight definition`
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: POSE LIBRARY - Enhanced with Jewelry Context
// ═══════════════════════════════════════════════════════════════════════════════

const POSE_LIBRARY = {
  portrait: {
    name: 'Editorial Portrait',
    camera: `Focal: 85mm f/1.8 portrait prime
Aperture: f/2.8 (subject sharp, background soft)
Focus: Eyes (critical sharpness), smooth falloff to ears
Framing: Head + shoulders, rule of thirds
Angle: 10-15° above eye level (editorial flattering)
Distance: 1.2m (natural perspective)`,
    
    lighting: `PRIMARY: 45° camera-right, 30° elevated (modified Rembrandt)
FILL: Large white v-flat camera-left (2:1 ratio)
RIM: Hair light back-right, 45° (subtle separation)
COLOR TEMP: 5500K neutral daylight
BACKGROUND: Gradient from key side`,
    
    composition: `Face: 60-70% frame occupancy
Gaze: 2 o'clock or 10 o'clock (NOT direct)
Ears: Both visible (earring context)
Neck/décolletage: Clear (necklace context)
Shoulders: Relaxed, slight angle for dimension
Hair: Styled to reveal jewelry zones`,
    
    direction: `Expression: Serene confidence, editorial restraint
Neck: Gently extended, elegant posture
Jaw: Relaxed, natural position
Eyes: Soft focus, distant contemplation
NO commercial smile, NO forced emotion`,

    jewelryZones: ['earrings', 'necklace', 'pendant']
  },

  'hand-close': {
    name: 'Hand Close-Up (Ring/Bracelet Focus)',
    camera: `Focal: 100mm f/2.8 macro
Aperture: f/5.6 (hands + jewelry sharp)
Focus: Jewelry contact point (knuckle/finger/wrist)
Framing: Tight crop, hands fill 80% of frame
Angle: 45° overhead, slight side angle
Distance: 30cm (macro working distance)`,
    
    lighting: `PRIMARY: Large overhead softbox (90x60cm) - even, flat illumination
FILL: White acrylic base under hands (upward bounce)
ACCENT: Small gridded spot for jewelry catchlights
COLOR TEMP: 5000-5500K neutral
AMBIENT: Minimal, absorbed by black v-flats on sides`,
    
    composition: `Hands: Natural elegance, relaxed positioning
Fingers: Gentle curves, NOT stiff extension
Nails: Clean, neutral, short (non-distracting)
Knuckles: Natural compression, visible texture
Jewelry: Centered, properly oriented to camera
Background: Ultra-soft, 2-3 stops underexposed`,
    
    direction: `Hand gesture: Organic grace, zero tension
Positioning: Overlapping or single hand rest
Skin detail: Knuckle texture, finger-side pores visible
Jewelry contact: Realistic pressure/fit indication`,

    jewelryZones: ['rings', 'bracelets', 'bangles']
  },

  'neck-focus': {
    name: 'Neck/Décolletage Focus (Necklace/Pendant)',
    camera: `Focal: 85mm f/1.8
Aperture: f/4 (neck sharp, face/chest soft)
Focus: Collarbone/necklace drape point
Framing: Chin to sternum, vertical orientation
Angle: Straight-on or 10° upward tilt
Distance: 1m`,
    
    lighting: `PRIMARY: Beauty dish directly in front, 20° elevated
FILL: Large clamshell reflector below (under-chin fill)
RIM: Minimal or none (maintains soft aesthetic)
COLOR TEMP: 5500K neutral
BACKGROUND: Soft gradient, slightly darker than skin`,
    
    composition: `Neck: Extended elegantly, clear muscle definition
Collarbone: Prominent, casting delicate shadow
Décolletage: Smooth, even tone, detailed texture
Jawline: Visible but soft focus
Face: Partial (chin/lower), background element
Necklace: Centered on sternum line`,
    
    direction: `Head: Tilted slightly back (natural neck extension)
Chin: Elevated, graceful angle
Expression: Serene, eyes may be closed
Shoulders: Rolled back slightly, open chest
Breathing: Visible collar definition`,

    jewelryZones: ['necklaces', 'pendants', 'chokers']
  },

  'ear-profile': {
    name: 'Ear Profile (Earring Focus)',
    camera: `Focal: 100mm f/2.8
Aperture: f/4 (ear sharp, hair soft)
Focus: Ear cartilage/earring
Framing: Ear to shoulder, side profile
Angle: Perpendicular to profile plane
Distance: 80cm`,
    
    lighting: `PRIMARY: 90° side light (profile/edge lighting)
FILL: Minimal reflector opposite (just to lift shadows)
RIM: Strong backlight to separate hair from background
COLOR TEMP: 5000-5500K neutral
BACKGROUND: Darker gradient for silhouette contrast`,
    
    composition: `Profile: Clean contour line, defined jawline
Ear: Fully exposed, separated from hair
Earring: Natural hang or lobe position
Hair: Pulled back/tucked, or styled away
Jawline: Sharp definition
Background: 30% darker than skin for separation`,
    
    direction: `Face: Perfect 90° profile or slight 3/4 turn
Ear: Complete exposure, clear earring visibility
Expression: Distant, calm, eyes closed or horizon gaze
Neck: Extended, elegant line
Hair: Styled away from ear completely`,

    jewelryZones: ['earrings', 'ear-cuffs']
  },

  'full-portrait': {
    name: 'Full Portrait (Multi-Jewelry Display)',
    camera: `Focal: 70mm f/2.8
Aperture: f/5.6 (more depth coverage)
Focus: Face/upper chest (split focus)
Framing: Head to mid-torso, vertical
Angle: Eye level or slightly elevated
Distance: 1.8m`,
    
    lighting: `PRIMARY: Large octabox 45° camera-right
FILL: White bounce opposite (3:1 ratio)
RIM: Dual rim lights (hair + shoulder separation)
COLOR TEMP: 5500K neutral daylight
BACKGROUND: Graduated sweep, professional studio`,
    
    composition: `Full jewelry display: Ears, neck, chest, hands if visible
Posture: Elegant, editorial stance
Clothing: Simple neckline (jewelry focus)
Hands: Visible if applicable, naturally positioned
Expression: Confident, editorial presence
Frame balance: 60% subject, 40% negative space`,
    
    direction: `Posture: Elongated spine, open shoulders
Expression: Serene confidence with editorial restraint
Hands: Graceful positioning near body
Gaze: Slightly off-camera, contemplative
Overall: Quiet power, understated luxury`,

    jewelryZones: ['earrings', 'necklaces', 'rings', 'bracelets']
  },

  'hand-elegant': {
    name: 'Elegant Hand/Wrist (Bracelet Focus)',
    camera: `Focal: 100mm f/2.8 macro
Aperture: f/4 (wrist + hand sharp)
Focus: Wrist area for bracelet display
Framing: Hand and wrist centered
Angle: 30° from horizontal
Distance: 40cm`,
    
    lighting: `PRIMARY: Large diffused panel overhead
FILL: White reflector from below
ACCENT: Spot for bracelet catchlights
COLOR TEMP: 5000-5500K neutral
AMBIENT: Minimal, controlled`,
    
    composition: `Wrist: Elegantly turned, bracelet visible
Hand: Graceful gesture, relaxed fingers
Fingers: Natural curves, feminine elegance
Background: Soft, out of focus
Jewelry: Clear, centered, hero element`,
    
    direction: `Hand gesture: Flowing, organic movement
Wrist: Slightly rotated for bracelet display
Fingers: Soft, not rigid
Skin: Natural texture, visible detail`,

    jewelryZones: ['bracelets', 'bangles', 'watches']
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: NEGATIVE CONSTRAINTS - AI Artifact Elimination
// ═══════════════════════════════════════════════════════════════════════════════

const NEGATIVE_CONSTRAINTS = `
═══════════════════════════════════════════════════════════════
STRICT AVOIDANCE [AI Artifact Elimination]
═══════════════════════════════════════════════════════════════

DIGITAL ARTIFACTS (CRITICAL - INSTANT REJECTION):
✗ Smoothed/plastic skin (beauty filter appearance)
✗ Airbrush effect (Instagram/FaceTune style)
✗ Over-sharpening halos around edges
✗ 3D render look (CGI, game-engine quality)
✗ Digital painting/illustration aesthetic
✗ Fake bokeh with perfect geometric circles
✗ HDR over-processing (halos, local contrast abuse)
✗ Unrealistic color saturation
✗ Porcelain/doll-like skin uniformity
✗ Luminescent glow effects
✗ Waxy, mannequin-like appearance

ANATOMICAL ERRORS (ZERO TOLERANCE):
✗ Extra/missing fingers (must be exactly 5 per hand)
✗ Merged or fused digits
✗ Distorted hand proportions
✗ Incorrect ear anatomy or placement
✗ Unnatural asymmetry (beyond biological normal)
✗ Neck length/thickness distortion
✗ Shoulder/clavicle misalignment
✗ Impossible joint angles
✗ Deformed facial features
✗ Incorrect eye placement or size

JEWELRY ISSUES (IF APPLICABLE):
✗ Floating or disconnected pieces
✗ Duplicate items (e.g., two earrings on one ear)
✗ Perfect mirror symmetry (unnatural)
✗ Scale errors (jewelry too large/small)
✗ Blurred jewelry at focus point
✗ Excessive sparkle/rainbow effects
✗ Incorrect material rendering

LIGHTING FAILURES:
✗ Blown highlights (no detail in whites)
✗ Blocked shadows (pure black, no detail)
✗ Unnatural skin glow/luminescence
✗ Multiple conflicting shadows
✗ Visible artificial light sources in reflections
✗ Color temperature contamination

POST-PROCESSING RED FLAGS:
✗ Over-saturation (especially skin tones)
✗ Excessive contrast/posterization
✗ Color banding in gradients
✗ Digital noise artifacts
✗ Sharpening halos (edge ringing)
✗ Compression artifacts/pixelation
✗ Watermarks, text, logos

FORBIDDEN TERMS IN OUTPUT:
✗ "beautiful" (triggers over-beautification)
✗ "perfect" (triggers artificial perfection)
✗ "flawless" (triggers plastic skin)
✗ "stunning" (triggers glamour filters)
✗ "glamorous" (wrong aesthetic entirely)
✗ "hyper-realistic" (paradoxically fake)
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER - Combining All Systems
// ═══════════════════════════════════════════════════════════════════════════════

function buildAdvancedPrompt(params: {
  // Core identity
  name: string;
  skinTone: string;
  skinUndertone: string;
  ethnicity: string;
  hairColor: string;
  hairTexture: string;
  gender: string;
  ageRange: string;
  
  // Enhanced features
  faceShape?: string;
  eyeColor?: string;
  expression?: string;
  hairStyle?: string;
  mood?: string;
  bodyType?: string;
  
  // Generation type
  isPoseGeneration?: boolean;
  poseType?: keyof typeof POSE_LIBRARY;
  poseDescription?: string;
}): string {
  
  const poseConfig = params.poseType ? POSE_LIBRARY[params.poseType] : POSE_LIBRARY.portrait;
  const sssProfile = SSS_PROFILES[params.skinTone] || SSS_PROFILES['medium'];
  
  // Build the comprehensive DNA prompt
  const prompt = `
═══════════════════════════════════════════════════════════════
MODEL AGENCY TEST SHOT / DIGITALS - Not a final photo, just a reference snap.
═══════════════════════════════════════════════════════════════

This is a MODEL AGENCY POLAROID - the kind taken for records, not for beauty.

SKIN - REAL BUT HEALTHY:
- Natural texture, visible pores on nose/cheeks
- [Distinguishing features] clearly visible - KEY FEATURE
- Normal healthy skin - not perfect, not diseased
- No makeup or minimal natural
- NOT smooth/filtered BUT also NOT acne/sick

WHAT WE DON'T WANT:
- NO acne, NO pimples, NO breakouts
- NO skin conditions or blemishes
- NO heavy retouching either

${buildCharacterMasterData({
  name: params.name,
  gender: params.gender,
  ethnicity: params.ethnicity,
  ageRange: params.ageRange,
  skinTone: params.skinTone,
  skinUndertone: params.skinUndertone,
  faceShape: params.faceShape || 'balanced',
  eyeColor: params.eyeColor || 'natural',
  hairColor: params.hairColor,
  hairStyle: params.hairStyle || 'natural',
  hairTexture: params.hairTexture,
  expression: params.expression || 'serene',
  mood: params.mood,
  bodyType: params.bodyType
})}

═══════════════════════════════════════════════════════════════
IDENTITY PERMANENCE PROTOCOL [HIGHEST PRIORITY]
═══════════════════════════════════════════════════════════════

You are generating a REAL biological human being with permanent, immutable characteristics.
This is NOT digital art, NOT illustration, NOT stylization - this is PHOTOGRAPHIC REALISM.

BIOLOGICAL FINGERPRINT - These create an unchangeable person:
• Cranial structure: Orbital ridge, cheekbone prominence, jaw angle, chin shape
• Proportional ratios: Face width-to-height, neck length, shoulder breadth
• Skin signature: Melanin density map, subsurface scattering depth, pore distribution pattern
• Micro-features: Specific freckle/mole placement, natural asymmetries, skin texture fingerprint

CONSISTENCY LAW: Every subsequent generation MUST be immediately recognizable as this EXACT person.
Identity drift = Generation failure.

${params.isPoseGeneration ? `
⚠️ IDENTITY CONSISTENCY MODE ACTIVE ⚠️
This is a SUBSEQUENT generation of an EXISTING person.
The biological identity established in the first generation is IMMUTABLE.
Face must be INSTANTLY recognizable as the same person.
` : `
🆕 IDENTITY FOUNDATION MODE ACTIVE 🆕
This is the FIRST generation - establishing permanent identity.
This image will serve as the reference for ALL future poses.
Create a complete, detailed biological person with memorable features.
`}

═══════════════════════════════════════════════════════════════
SKIN BIOLOGY SYSTEM [Medical-Grade Accuracy]
═══════════════════════════════════════════════════════════════

Skin classification: ${params.skinTone} with ${params.skinUndertone} undertone

SUBSURFACE SCATTERING PROFILE:
${sssProfile}

MICRO-TEXTURE REQUIREMENTS:
• Pore visibility: High-density on nose/cheeks, medium forehead, minimal eyelids
• Pore size: Biologically accurate 0.05-0.2mm apparent diameter
• Distribution: Natural randomness, NOT uniform grid
• Fine lines: Age-appropriate, expression-based
• Vellus hair: Visible in rim/backlight, natural density and direction

COLOR VARIATION (Natural):
• Warmth concentration: Around eyes, nose bridge
• Cooler zones: Temples, sides of neck
• Micro-redness: Capillary show-through (lighter tones only)
• Pigmentation: Random freckles/beauty marks (ethnicity-appropriate)

SURFACE PROPERTIES:
• T-zone: Slight natural sheen (sebum)
• Cheeks/periphery: More matte finish
• NO plastic appearance, NO waxy buildup, NO porcelain smoothing
• Skin must look ALIVE: tangible, warm, textured

${LIGHTING_EXACT_SYSTEM}

═══════════════════════════════════════════════════════════════
POSE SPECIFICATION: ${poseConfig.name}
═══════════════════════════════════════════════════════════════

CAMERA SETUP:
${poseConfig.camera}

LIGHTING SETUP:
${poseConfig.lighting}

COMPOSITION:
${poseConfig.composition}

DIRECTION:
${poseConfig.direction}

${params.poseDescription ? `
ADDITIONAL DIRECTION:
${params.poseDescription}
` : ''}

${POSE_GEOMETRY_SYSTEM}

═══════════════════════════════════════════════════════════════
EDITORIAL AESTHETIC [Luxury Standard]
═══════════════════════════════════════════════════════════════

MOOD REFERENCE: Vogue Italia, high-fashion lookbook, quiet luxury campaign
NOT: E-commerce, commercial catalog, Instagram beauty, glamour shots

COLOR SCIENCE:
• Palette: Cool-neutral bias, elegant desaturation
• Contrast: Soft and refined (NOT punchy/HDR)
• Black point: Lifted to charcoal (NOT crushed)
• White point: Clean cream (NOT blown/stark)
• Midtones: Rich detail retention

TONAL REPRODUCTION:
• Skin: Natural but slightly desaturated for editorial feel
• Hair: Rich depth, natural highlights
• Background: 15-20% darker than subject for natural separation

COMPOSITIONAL RESTRAINT:
• Negative space: Intentional, balanced
• Framing: Editorial precision, NOT snapshot
• Energy: Calm contemplation, NOT excitement
• Timelessness: Could be today or 20 years ago

${NEGATIVE_CONSTRAINTS}

═══════════════════════════════════════════════════════════════
OUTPUT SPECIFICATIONS
═══════════════════════════════════════════════════════════════

• Resolution: Minimum 4K (3840×2160 or higher)
• Quality: Publication-ready, magazine cover standard
• Realism: Indistinguishable from professional photography
• Consistency: ${params.isPoseGeneration ? 'Perfect identity match' : 'Establish permanent identity'}
• Aesthetic: Quiet luxury editorial, NOT commercial catalog
• File quality: RAW-equivalent tonal range, NO compression artifacts

FINAL VALIDATION CHECKLIST:
✓ Does this look CAPTURED by a photographer? (NOT generated)
✓ Could this be in Vogue or a luxury brand campaign?
✓ Is the skin ALIVE and textured? (NOT smoothed)
✓ Are jewelry-display areas clearly visible and sharp?
✓ Is the identity ${params.isPoseGeneration ? 'perfectly consistent' : 'clearly established'}?
✓ Is the expression editorial, not commercial?
✓ Are there visible pores, micro-textures, natural imperfections?

This must be PHOTOGRAPHIC PERFECTION with EDITORIAL RESTRAINT.
Ultra high resolution output.
`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Parse request
    const requestBody = await req.json();
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
    } = requestBody;

    const isPoseGeneration = !!modelData && !!poseType;
    
    console.log('Request type:', isPoseGeneration ? 'Pose generation' : 'New model creation');
    console.log('Character DNA System: ACTIVE');

    if (!isPoseGeneration) {
      if (!name || !skinTone || !skinUndertone || !ethnicity || !hairColor || !hairTexture || !gender || !ageRange) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields for new model' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build prompt using advanced Character DNA system
    const modelPrompt = buildAdvancedPrompt({
      name: isPoseGeneration ? modelData.name : name,
      skinTone: isPoseGeneration ? modelData.skinTone : skinTone,
      skinUndertone: isPoseGeneration ? modelData.skinUndertone : (skinUndertone || 'neutral'),
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
      poseType: poseType as keyof typeof POSE_LIBRARY,
      poseDescription: poseDescription || undefined,
    });

    console.log('Character DNA Prompt generated');
    console.log('Prompt length:', modelPrompt.length, 'characters');

    // Generate image with Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          {
            role: 'user',
            content: modelPrompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI generation error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageDataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      throw new Error('No valid image generated');
    }

    // Process and upload image
    const commaIndex = imageDataUrl.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid data URL format');
    const base64Image = imageDataUrl.slice(commaIndex + 1);
    const imageBuffer = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const filePath = `${userId}/models/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image');
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      throw new Error('Failed to generate image URL');
    }

    const imageUrl = signedUrlData.signedUrl;

    if (isPoseGeneration) {
      console.log('Pose generated successfully with Character DNA system');
      return new Response(
        JSON.stringify({ success: true, imageUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save new model
    const { data: modelRecord, error: insertError } = await supabase
      .from('user_models')
      .insert({
        user_id: userId,
        name,
        skin_tone: skinTone,
        skin_undertone: skinUndertone || 'neutral',
        ethnicity,
        hair_color: hairColor,
        hair_texture: hairTexture,
        gender,
        age_range: ageRange,
        face_shape: faceShape,
        eye_color: eyeColor,
        expression,
        hair_style: hairStyle,
        preview_image_url: imageUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw new Error('Failed to save model');
    }

    console.log('Model created successfully with Character DNA:', modelRecord.id);

    return new Response(
      JSON.stringify({ success: true, model: modelRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
