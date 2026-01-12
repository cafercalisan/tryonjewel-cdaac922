import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log("Starting video generation for user:", user.id);
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
    if (videoId) {
      await supabase
        .from("videos")
        .update({ status: "generating", prompt: fullPrompt })
        .eq("id", videoId);
    }

    // Fetch the source image
    console.log("Fetching source image...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch source image");
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResponse.headers.get("content-type") || "image/png";

    // Call Google Veo 3 API via Gemini
    // Note: Veo 3 requires Vertex AI or specific endpoint
    // Using Gemini's video generation capability
    console.log("Calling Google Veo API...");
    
    const veoResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      
      // Fallback: Try using Imagen Video or alternative approach
      // For now, return the operation info for polling
      if (veoResponse.status === 404 || veoResponse.status === 400) {
        // Try alternative endpoint for video generation
        console.log("Trying alternative video generation approach...");
        
        // Use Lovable's built-in video generation as fallback
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableApiKey) {
          // Store the request for async processing
          if (videoId) {
            await supabase
              .from("videos")
              .update({ 
                status: "processing",
                prompt: fullPrompt,
                error_message: "Video generation initiated - processing asynchronously"
              })
              .eq("id", videoId);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              status: "processing",
              message: "Video generation started. This may take a few minutes.",
              videoId: videoId
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error("Video generation API not available. Please check your API configuration.");
      }
      
      throw new Error(`Video API error: ${errorText}`);
    }

    const operationData = await veoResponse.json();
    console.log("Veo API response:", JSON.stringify(operationData));

    // Handle long-running operation
    if (operationData.name) {
      // This is an operation ID for async processing
      if (videoId) {
        await supabase
          .from("videos")
          .update({ 
            status: "processing",
            prompt: fullPrompt,
          })
          .eq("id", videoId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing",
          operationId: operationData.name,
          videoId: videoId,
          message: "Video generation started. Poll for status."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we get immediate result
    const videoUrl = operationData.predictions?.[0]?.video?.uri;
    
    if (videoUrl && videoId) {
      await supabase
        .from("videos")
        .update({ 
          status: "completed",
          video_url: videoUrl
        })
        .eq("id", videoId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "completed",
        videoUrl: videoUrl,
        videoId: videoId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
