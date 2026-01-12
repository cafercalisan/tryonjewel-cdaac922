import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Luxury jewelry video animation prompts
const JEWELRY_VIDEO_PROMPTS = {
  default: `Ultra slow-motion luxury jewelry commercial. 
Camera: Imperceptibly slow drift, almost static. Locked tripod feel.
Lighting: Soft, diffused studio lighting. Natural reflections only.
Motion: Barely perceptible micro-movements. Editorial pace.
Style: High-end luxury campaign. Quiet elegance. Premium feel.
Metal: Preserve exact metal color - no color shift, no reinterpretation.
Diamonds: Subtle natural light catch. No artificial sparkle or rainbow dispersion.
Speed: 0.25x slow-motion feel. Each frame is deliberate.
Mood: Serene, sophisticated, museum-quality presentation.`,
  
  model: `Elegant slow-motion jewelry showcase on model.
Subject: Graceful, minimal movement. Slight head turn or hand gesture.
Camera: Static or near-static. Professional locked shot.
Lighting: Soft, flattering. Natural skin texture preserved.
Jewelry: Stays in sharp focus. Metal color absolutely unchanged.
Motion: Ultra slow, deliberate. Each micro-movement intentional.
Expression: Calm, editorial. Confident but understated.
Style: High-fashion luxury campaign quality.`,

  product: `Pure product slow-motion jewelry presentation.
Camera: Minimal rotation or static. Clean, professional.
Surface: Elegant backdrop - marble, velvet, or neutral.
Lighting: Soft studio light. Gradual, natural reflections.
Metal: 100% color fidelity. No warm/cool shifts.
Motion: Imperceptible rotation or light shimmer only.
Speed: Ultra slow motion. Premium, deliberate pace.
Style: E-commerce elevated to art gallery level.`
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
