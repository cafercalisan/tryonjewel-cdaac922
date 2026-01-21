import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cinematic Editorial Video Prompts - Subtle Dolly Zoom, No Sparkle
const JEWELRY_VIDEO_PROMPTS = {
  default: `CINEMATIC EDITORIAL JEWELRY VIDEO

MOTION DIRECTIVE:
- 24fps cinematic smoothness
- Extremely slow, almost imperceptible dolly-in zoom
- Camera gradually closes in on jewelry over 8 seconds
- Movement so subtle viewer barely notices
- No jerky transitions, silky smooth

CAMERA:
- Very slow push-in / dolly zoom toward product
- Start slightly wide, end slightly tighter
- Zero shake, tripod-mounted cinema feel
- Focal point locked on jewelry center

FORBIDDEN:
- NO sparkle effects
- NO shimmer bursts
- NO lens flares
- NO CGI light effects
- NO exaggerated reflections
- NO rainbow dispersion on stones

PRODUCT PRESERVATION (CRITICAL):
- Metal color: EXACT match to source
- Jewelry proportions: Unchanged
- Stone colors: Identical to input
- Natural light behavior only

MOOD: Quiet luxury advertising. Slow reveal. Editorial intimacy.
Think: Cartier campaign, subtle dolly closing in on the piece.`,
  
  model: `CINEMATIC MODEL EDITORIAL - JEWELRY FOCUS

MOTION DIRECTIVE:
- 24fps buttery smooth motion
- Very slow camera push-in toward model/jewelry
- Model: barely perceptible breathing
- One micro-gesture maximum
- Camera does the movement, not the subject

CAMERA:
- Gentle dolly-in zoom over 8 seconds
- Starts at medium shot, ends slightly closer
- Focus stays locked on jewelry
- Cinema-grade stability

MODEL BEHAVIOR:
- Near-statuesque presence
- Minimal breathing movement only
- Eyes may shift once, very slowly
- Hands absolutely still
- Natural skin, no smoothing

FORBIDDEN:
- NO sparkle or shimmer effects
- NO artificial light bursts
- NO lens flares or glows
- NO exaggerated jewelry reflections

PRODUCT PRESERVATION (CRITICAL):
- Jewelry: EXACT replication from source
- Metal color: Zero deviation
- No artistic reinterpretation

MOOD: High-fashion film. Camera slowly draws viewer into the jewelry.
The model is still, camera movement creates intimacy.`,

  product: `PURE PRODUCT CINEMATIC - ADVERTISING GRADE

MOTION DIRECTIVE:
- Smooth 24fps commercial quality
- Slow deliberate dolly-in toward product
- Camera gradually tightens frame
- No rotation, just gentle forward movement
- 8 second slow approach

CAMERA:
- Professional cinema dolly feel
- Starts slightly wide, ends on product detail
- Zero shake, studio-grade stability
- Smooth continuous motion

FORBIDDEN:
- NO sparkle effects whatsoever
- NO shimmer or glitter
- NO CGI light effects
- NO lens flares
- NO exaggerated stone brilliance
- Light behaves naturally only

PRODUCT PRESERVATION (CRITICAL):
- 100% faithful to input image
- Metal color: EXACT
- Proportions: UNCHANGED
- No enhancement, no beautification

MOOD: E-commerce elevated to cinema. Slow reveal approach.
Think: Bulgari commercial, camera drawing you closer to desire.`
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

    // Full luxury jewelry prompt with cinematic editorial locks
    const fullPrompt = `${basePrompt}

GLOBAL CINEMATIC LOCKS:
- Frame rate feel: 24fps smooth cinematic
- Motion speed: 0.1x perceived speed
- Camera shake: ZERO
- Movement type: Micro-gestures only
- Transition style: Silk-smooth, no cuts
- Color grading: Neutral, preserves metal truth
- Metal color: EXACT source match (gold/silver/rose gold)
- Duration: 8 seconds of elegant stillness
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
            durationSeconds: 8,
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
      
      // Return upstream status code instead of 500
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Video API error: ${veoResponse.status}`,
          details: errorText
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
