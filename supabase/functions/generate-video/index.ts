import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Luxury jewelry video animation prompts - CONSISTENCY FOCUSED
const JEWELRY_VIDEO_PROMPTS = {
  default: `TASK: Animate this exact jewelry image with ultra-subtle slow motion.

CRITICAL - DO NOT CHANGE:
- Metal color must remain EXACTLY as source
- Jewelry design, shape, proportions - UNCHANGED  
- Stone colors and placement - UNCHANGED
- No additions, no modifications, no enhancements
- No sparkle effects, no rainbow dispersion
- No color grading that affects the jewelry

ANIMATION STYLE:
- Ultra slow motion (0.25x speed feel)
- Barely perceptible movement
- Soft, natural light shimmer only
- Camera: Nearly static, locked tripod
- Duration: 5 seconds of elegant stillness

MOOD: Museum-quality presentation. Quiet luxury. Editorial calm.
The jewelry should look exactly as photographed, only with subtle life.`,
  
  model: `TASK: Animate this jewelry-on-model image with minimal, elegant motion.

CRITICAL - DO NOT CHANGE:
- Metal color: EXACT preservation required
- Jewelry appearance: No modifications
- Skin texture: Keep natural, no beauty filter
- Model features: Unchanged

ANIMATION STYLE:
- Ultra slow, almost imperceptible movement
- Slight breath motion only
- No dramatic gestures or expressions
- Camera: Completely static
- Natural light play on jewelry surface

MOOD: High-fashion editorial. Serene. Premium.
Subject barely moves. Jewelry stays sharp and true to source.`,

  product: `TASK: Animate this product jewelry shot with micro-motion only.

CRITICAL - DO NOT CHANGE:
- Metal color: 100% faithful to source
- No artistic reinterpretation
- No added effects or enhancements
- Jewelry must look identical to input

ANIMATION STYLE:
- Near-static presentation
- Extremely subtle light reflection shifts
- No rotation unless barely perceptible
- Camera: Locked, professional studio feel

MOOD: E-commerce elevated to art. Pure product truth.
This is about subtle life, not transformation.`
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
    const basePrompt = JEWELRY_VIDEO_PROMPTS[promptType as keyof typeof JEWELRY_VIDEO_PROMPTS] 
      || JEWELRY_VIDEO_PROMPTS.default;

    // Full luxury jewelry prompt with strict color preservation
    const fullPrompt = `${basePrompt}

CRITICAL REQUIREMENTS:
- Metal color MUST remain EXACTLY as in the source image
- No color grading that affects metal hue
- No artistic reinterpretation of materials
- Preserve exact gold/silver/rose gold tone
- Ultra slow motion - premium, deliberate pace
- Minimal movement - editorial elegance
- Professional locked camera feel`;

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
    console.log("Image fetched, size:", imageBuffer.byteLength, "bytes");

    // Update status
    await supabase
      .from("videos")
      .update({ error_message: "Google Veo API çağrılıyor..." })
      .eq("id", videoId);

    // Call Google Veo API (using Veo 3.1 - latest model)
    console.log("Calling Google Veo 3.1 API...");
    
    // Use x-goog-api-key header as per documentation
    const veoResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning`,
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
            resolution: "720p",
            numberOfVideos: 1,
            durationSeconds: 5,
            personGeneration: "allow_adult"
          }
        }),
      }
    );

    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      console.error("Veo API error:", veoResponse.status, errorText);
      
      await supabase
        .from("videos")
        .update({ 
          status: "error",
          error_message: `API Hatası: ${veoResponse.status} - Lütfen tekrar deneyin`
        })
        .eq("id", videoId);
      
      throw new Error(`Video API error: ${errorText}`);
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
    const videoUrl = operationData.predictions?.[0]?.video?.uri;
    
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

    // No operation ID and no immediate result - unexpected
    await supabase
      .from("videos")
      .update({ 
        status: "error",
        error_message: "Beklenmeyen API yanıtı"
      })
      .eq("id", videoId);

    throw new Error("Unexpected API response - no operation ID or video URL");

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
