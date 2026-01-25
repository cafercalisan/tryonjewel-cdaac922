import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== LUXURY JEWELRY VIDEO PROMPTS ==========
// Core Framework: High-end editorial jewelry video with minimal, controlled motion

const CORE_FRAMEWORK = `High-end editorial jewelry video.
Minimal, controlled motion.
Slow cinematic pacing, no exaggerated movement.
Natural light behavior, soft highlights, realistic reflections.
Camera movement is subtle and intentional.
Luxury fashion campaign aesthetic.
No fast cuts, no dramatic effects, no artificial glow.

COMPLIANCE (CRITICAL):
- No celebrity references
- No real person's name
- No real person's likeness
- Use generic, non-identifiable model only (if a model is visible)`;

const JEWELRY_VIDEO_PROMPTS = {
  // Default: Slow Push-In (Most Premium & Safe)
  default: `${CORE_FRAMEWORK}

CAMERA MOVEMENT: Slow Push-In
Slow cinematic push-in camera movement.
Camera advances very slightly toward the jewelry.
Motion is almost imperceptible.
Macro depth of field, realistic metal and gemstone reflections.
Editorial fashion film style.

LIGHTING & LENS:
Natural diffused light.
No artificial light flares.
Soft shadows, realistic contrast.
Cinematic lens simulation (50mm or 85mm).
Shallow depth of field, realistic focus breathing.

PRODUCT PRESERVATION (CRITICAL):
- Metal color: EXACT match to source image
- Jewelry proportions: UNCHANGED
- Stone colors: Identical to input
- Natural light behavior only

FORBIDDEN KEYWORDS:
NO dramatic, NO dynamic motion, NO fast camera
NO cinematic explosion, NO glowing effects
NO intense lighting, NO flashy transitions`,
  
  // Model Shot: Slow Side Drift (Editorial Fashion Feel)
  model: `${CORE_FRAMEWORK}

MODEL BEHAVIOR:
Model is standing still.
Only natural breathing motion.
Very subtle weight shift.
Hands relaxed, no posing.
Jewelry moves naturally with the body.

CAMERA MOVEMENT: Slow Horizontal Drift
Slow horizontal camera drift.
Movement is smooth and continuous.
Model remains relaxed and natural.
Jewelry stays in sharp focus.
Editorial fashion film lighting.
No posing, no dramatic gestures.

LIGHTING & LENS:
Natural diffused light.
No artificial light flares.
Soft shadows, realistic contrast.
Cinematic lens simulation (50mm or 85mm).
Shallow depth of field, realistic focus breathing.

PRODUCT PRESERVATION (CRITICAL):
- Metal color: EXACT match to source image
- Jewelry: EXACT replication, no artistic reinterpretation
- Natural skin texture, pores visible
- No beauty blur, no plastic skin

FORBIDDEN KEYWORDS:
NO dramatic, NO dynamic motion, NO fast camera
NO cinematic explosion, NO glowing effects
NO intense lighting, NO flashy transitions`,

  // Product: Micro Parallax (Static but Alive)
  product: `${CORE_FRAMEWORK}

CAMERA MOVEMENT: Micro Parallax
Very subtle parallax motion.
Foreground and background shift minimally.
Jewelry remains perfectly stable.
Camera movement is calm and controlled.
Feels like a luxury magazine video loop.

LIGHTING & LENS:
Natural diffused light.
No artificial light flares.
Soft shadows, realistic contrast.
Cinematic lens simulation (50mm or 85mm).
Shallow depth of field, realistic focus breathing.

PRODUCT PRESERVATION (CRITICAL):
- 100% faithful to input image
- Metal color: EXACT, zero deviation
- Proportions: UNCHANGED
- No enhancement, no beautification

FORBIDDEN KEYWORDS:
NO dramatic, NO dynamic motion, NO fast camera
NO cinematic explosion, NO glowing effects
NO intense lighting, NO flashy transitions`,

  // Hand/Ring Close-up: Minimal Hand Movement
  closeup: `${CORE_FRAMEWORK}

HAND BEHAVIOR:
Hand remains mostly still.
Very slow finger relaxation movement.
Skin texture and veins are natural.
Jewelry scale remains accurate.
No hand acting or posing.

CAMERA MOVEMENT: Slow Push-In
Slow cinematic push-in camera movement.
Camera advances very slightly toward the jewelry.
Motion is almost imperceptible.
Macro depth of field.

LIGHTING & LENS:
Natural diffused light.
No artificial light flares.
Soft shadows, realistic contrast.
Cinematic lens simulation (85mm macro).
Shallow depth of field, realistic focus breathing.

PRODUCT PRESERVATION (CRITICAL):
- Metal color: EXACT match to source
- Ring/bracelet proportions: UNCHANGED
- Natural skin texture preserved
- No artificial smoothing

FORBIDDEN KEYWORDS:
NO dramatic, NO dynamic motion, NO fast camera
NO cinematic explosion, NO glowing effects
NO intense lighting, NO flashy transitions`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user identification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Invalid authentication");
    }

    const { imageUrl, videoId, promptType = "default" } = await req.json();

    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    console.log("Starting video generation for user:", user.id);
    console.log("Video ID:", videoId);
    console.log("Source image:", imageUrl);
    console.log("Prompt type:", promptType);

    // ========== CREDIT CHECK & DEDUCTION ==========
    const VIDEO_CREDIT_COST = 2; // Video costs 2 credits

    // Check if user is admin (unlimited generation)
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    const isAdminUser = isAdmin === true;
    console.log(`User ${user.id} admin status: ${isAdminUser}`);

    // Deduct credits for non-admin users
    if (!isAdminUser) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: user.id, _amount: VIDEO_CREDIT_COST });

      if (deductError) {
        console.error('Credit deduction error:', deductError);
        await supabase
          .from("videos")
          .update({ status: "error", error_message: "Kredi kontrolü sırasında hata oluştu" })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ error: 'Kredi kontrolü sırasında hata oluştu' }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!deductResult?.success) {
        const currentCredits = deductResult?.current_credits ?? 0;
        await supabase
          .from("videos")
          .update({ status: "error", error_message: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli.` })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            error: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli, mevcut: ${currentCredits}.`,
            required: VIDEO_CREDIT_COST,
            available: currentCredits
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Credits deducted: ${VIDEO_CREDIT_COST}, remaining: ${deductResult.remaining_credits}`);
    } else {
      console.log('Admin user - skipping credit deduction');
    }
    // ========== END CREDIT CHECK ==========

    // Select appropriate prompt
    const selectedPrompt = JEWELRY_VIDEO_PROMPTS[promptType as keyof typeof JEWELRY_VIDEO_PROMPTS] 
      || JEWELRY_VIDEO_PROMPTS.default;

    // Full prompt with global locks
    const fullPrompt = `${selectedPrompt}

GLOBAL CINEMATIC LOCKS:
- Frame rate: 24fps smooth cinematic feel
- Duration: 5-8 seconds of elegant stillness
- Motion speed: Very slow, almost imperceptible
- Camera shake: ZERO (tripod-mounted cinema feel)
- Color grading: Neutral, preserves metal truth
- Quality: Advertising-grade production value`;

    console.log("Using prompt:", fullPrompt);

    // Update video status to generating
    await supabase
      .from("videos")
      .update({ 
        status: "generating", 
        prompt: fullPrompt,
        error_message: "Video API'ye bağlanılıyor..."
      })
      .eq("id", videoId);

    // Fetch the source image
    console.log("Fetching source image...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      await supabase
        .from("videos")
        .update({ 
          status: "error",
          error_message: "Kaynak görsel yüklenemedi"
        })
        .eq("id", videoId);
      throw new Error("Failed to fetch source image");
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    // Convert to base64 manually
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    console.log("Image fetched, size:", imageBuffer.byteLength, "bytes, type:", mimeType);

    // Update status
    await supabase
      .from("videos")
      .update({ error_message: "Google Veo 3.1 API çağrılıyor..." })
      .eq("id", videoId);

    // Use official Google GenAI client to avoid param-shape mismatches
    // (This is the most reliable way to ensure we never send referenceImage/referenceImages.)
    console.log("Calling Google Veo 3.1 via @google/genai (image-to-video)...");

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    let veo31OperationName: string | undefined;
    let veo31ErrorText: string | undefined;

    try {
      // Per docs: `image` is the starting frame for Image-to-Video
      const operation: any = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: fullPrompt,
        image: {
          imageBytes: base64Image,
          mimeType,
        },
        // Keep config minimal to reduce schema mismatch risk
        config: {
          aspectRatio: "9:16",
        },
      });

      veo31OperationName = operation?.name;
      console.log("Veo 3.1 operation:", JSON.stringify(operation));
    } catch (err) {
      veo31ErrorText = err instanceof Error ? err.message : String(err);
      console.error("Veo 3.1 generateVideos error:", err);
    }

    if (!veo31OperationName) {
      const errorText = veo31ErrorText || "Unknown Veo 3.1 error";
      console.error("Veo 3.1 API error:", errorText);
      
      // Try with Veo 2.0 as fallback (without image parameter for text-to-video)
      console.log("Trying Veo 2.0 text-to-video fallback...");
      
      const veo2Response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [
              {
                prompt: fullPrompt
              }
            ],
            parameters: {
              aspectRatio: "9:16",
              sampleCount: 1,
              durationSeconds: 5,
              personGeneration: "allow_adult"
            }
          }),
        }
      );
      
      if (!veo2Response.ok) {
        const veo2ErrorText = await veo2Response.text();
        console.error("Veo 2.0 API error:", veo2Response.status, veo2ErrorText);
        
        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: `Video API hatası: Veo 3.1 (${errorText.substring(0, 100)}), Veo 2.0 (${veo2ErrorText.substring(0, 100)})`
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "Video API error",
            veo31Error: errorText,
            veo2Error: veo2ErrorText,
            hint: "Video generation API may not be available. Check API key permissions."
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      // Process Veo 2.0 response
      const veo2Data = await veo2Response.json();
      console.log("Veo 2.0 response:", JSON.stringify(veo2Data));
      
      if (veo2Data.name) {
        await supabase
          .from("videos")
          .update({ 
            status: "processing",
            operation_id: veo2Data.name,
            error_message: "Video oluşturuluyor (Veo 2.0)... Bu birkaç dakika sürebilir."
          })
          .eq("id", videoId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "processing",
            operationId: veo2Data.name,
            videoId: videoId,
            message: "Video oluşturma başlatıldı (Veo 2.0)."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle long-running operation from Veo 3.1 client
    if (veo31OperationName) {
      console.log("Got operation ID:", veo31OperationName);
      
      // Save operation_id to database for client-side polling
      await supabase
        .from("videos")
        .update({ 
          status: "processing",
          operation_id: veo31OperationName,
          error_message: "Video oluşturuluyor... Bu birkaç dakika sürebilir."
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing",
          operationId: veo31OperationName,
          videoId: videoId,
          message: "Video oluşturma başlatıldı. Durum otomatik olarak güncellenecek."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we didn't get an operation id, treat as error (client library should return one)
    await supabase
      .from("videos")
      .update({
        status: "error",
        error_message: "Video başlatılamadı (operation id alınamadı). Lütfen tekrar deneyin."
      })
      .eq("id", videoId);

    return new Response(
      JSON.stringify({
        success: false,
        error: "No operation ID received from API",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in generate-video:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
