import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
No fast cuts, no dramatic effects, no artificial glow.`;

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
    const base64Image = base64Encode(imageBuffer);
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    console.log("Image fetched, size:", imageBuffer.byteLength, "bytes, type:", mimeType);

    // Update status
    await supabase
      .from("videos")
      .update({ error_message: "Google Veo API çağrılıyor..." })
      .eq("id", videoId);

    // Try Veo 2.0 (imagen-3.0-generate-001 for video is not available, use veo-2.0)
    // Using the correct endpoint format for video generation
    console.log("Calling Google Veo 2.0 API...");
    
    const veoResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: fullPrompt,
              image: {
                bytesBase64Encoded: base64Image,
                mimeType: mimeType
              }
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

    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      console.error("Veo API error:", veoResponse.status, errorText);
      
      // Try alternative model if first one fails
      console.log("Trying alternative video generation approach...");
      
      // Update with specific error
      await supabase
        .from("videos")
        .update({ 
          status: "error",
          error_message: `Video API hatası (${veoResponse.status}): ${errorText.substring(0, 200)}`
        })
        .eq("id", videoId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Video API error: ${veoResponse.status}`,
          details: errorText,
          hint: "Video generation API may not be available in your region or API key may not have access."
        }),
        { 
          status: veoResponse.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const operationData = await veoResponse.json();
    console.log("Veo API response:", JSON.stringify(operationData));

    // Handle long-running operation
    if (operationData.name) {
      console.log("Got operation ID:", operationData.name);
      
      // Save operation_id to database for client-side polling
      await supabase
        .from("videos")
        .update({ 
          status: "processing",
          operation_id: operationData.name,
          error_message: "Video oluşturuluyor... Bu birkaç dakika sürebilir."
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing",
          operationId: operationData.name,
          videoId: videoId,
          message: "Video oluşturma başlatıldı. Durum otomatik olarak güncellenecek."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we get immediate result (unlikely for video)
    const videoUrl = operationData.predictions?.[0]?.video?.uri 
      || operationData.predictions?.[0]?.videoUri
      || operationData.response?.predictions?.[0]?.video?.uri;
    
    if (videoUrl) {
      await supabase
        .from("videos")
        .update({ 
          status: "completed",
          video_url: videoUrl,
          error_message: null
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "completed",
          videoUrl: videoUrl,
          videoId: videoId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No operation ID and no immediate result - log full response for debugging
    console.error("Unexpected response structure:", JSON.stringify(operationData, null, 2));
    
    await supabase
      .from("videos")
      .update({ 
        status: "error",
        error_message: "API yanıt formatı beklenenden farklı. Lütfen tekrar deneyin."
      })
      .eq("id", videoId);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "No video URL received from API",
        response: operationData,
        hint: "The API response format may have changed. Check logs for details."
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
