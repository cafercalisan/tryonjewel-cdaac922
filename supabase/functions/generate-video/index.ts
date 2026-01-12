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

// Poll for operation completion
async function pollOperation(
  operationName: string,
  apiKey: string,
  supabase: any,
  videoId: string,
  maxAttempts: number = 60,
  intervalMs: number = 10000
): Promise<void> {
  console.log(`Starting to poll operation: ${operationName}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`Poll attempt ${attempt + 1}/${maxAttempts}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Poll error: ${response.status} - ${errorText}`);
        
        // If operation not found, mark as error
        if (response.status === 404) {
          await supabase
            .from("videos")
            .update({ 
              status: "error",
              error_message: "Video generation operation not found"
            })
            .eq("id", videoId);
          return;
        }
        
        // Wait and retry for other errors
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        continue;
      }

      const operationData = await response.json();
      console.log(`Operation status:`, JSON.stringify(operationData));

      // Check if operation is done
      if (operationData.done === true) {
        console.log("Operation completed!");
        
        // Check for error
        if (operationData.error) {
          console.error("Operation error:", operationData.error);
          await supabase
            .from("videos")
            .update({ 
              status: "error",
              error_message: operationData.error.message || "Video generation failed"
            })
            .eq("id", videoId);
          return;
        }

        // Get video URL from response
        const videoUri = operationData.response?.generatedVideos?.[0]?.video?.uri ||
                        operationData.response?.predictions?.[0]?.video?.uri ||
                        operationData.result?.generatedVideos?.[0]?.video?.uri;

        if (videoUri) {
          console.log("Video generated successfully:", videoUri);
          
          // Download and upload to Supabase storage
          try {
            const videoResponse = await fetch(videoUri);
            if (videoResponse.ok) {
              const videoBlob = await videoResponse.arrayBuffer();
              const fileName = `${videoId}.mp4`;
              const storagePath = `videos/${fileName}`;
              
              const { error: uploadError } = await supabase.storage
                .from("jewelry-images")
                .upload(storagePath, videoBlob, {
                  contentType: "video/mp4",
                  upsert: true
                });

              if (uploadError) {
                console.error("Upload error:", uploadError);
                // Use original URL if upload fails
                await supabase
                  .from("videos")
                  .update({ 
                    status: "completed",
                    video_url: videoUri
                  })
                  .eq("id", videoId);
              } else {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                  .from("jewelry-images")
                  .getPublicUrl(storagePath);

                await supabase
                  .from("videos")
                  .update({ 
                    status: "completed",
                    video_url: publicUrlData.publicUrl
                  })
                  .eq("id", videoId);
                
                console.log("Video uploaded to storage:", publicUrlData.publicUrl);
              }
            } else {
              // Use original URL
              await supabase
                .from("videos")
                .update({ 
                  status: "completed",
                  video_url: videoUri
                })
                .eq("id", videoId);
            }
          } catch (uploadErr) {
            console.error("Error uploading video:", uploadErr);
            await supabase
              .from("videos")
              .update({ 
                status: "completed",
                video_url: videoUri
              })
              .eq("id", videoId);
          }
        } else {
          console.error("No video URL in response:", operationData);
          await supabase
            .from("videos")
            .update({ 
              status: "error",
              error_message: "No video URL received from API"
            })
            .eq("id", videoId);
        }
        return;
      }

      // Operation still in progress
      const progress = operationData.metadata?.progress || "unknown";
      console.log(`Operation in progress: ${progress}%`);
      
      // Update status with progress info
      await supabase
        .from("videos")
        .update({ 
          status: "processing",
          error_message: `Generating... ${progress}%`
        })
        .eq("id", videoId);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
    } catch (pollError) {
      console.error("Poll error:", pollError);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Max attempts reached
  console.error("Max polling attempts reached");
  await supabase
    .from("videos")
    .update({ 
      status: "error",
      error_message: "Video generation timed out. Please try again."
    })
    .eq("id", videoId);
}

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
    // Use Deno's base64 encoder to avoid stack overflow with large images
    const base64Image = base64Encode(imageBuffer);
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    console.log("Image fetched, size:", imageBuffer.byteLength, "bytes");

    // Call Google Veo API
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
      
      if (videoId) {
        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: `API Error: ${veoResponse.status}`
          })
          .eq("id", videoId);
      }
      
      throw new Error(`Video API error: ${errorText}`);
    }

    const operationData = await veoResponse.json();
    console.log("Veo API response:", JSON.stringify(operationData));

    // Handle long-running operation
    if (operationData.name) {
      console.log("Got operation ID, starting background polling:", operationData.name);
      
      // Update status to processing
      if (videoId) {
        await supabase
          .from("videos")
          .update({ 
            status: "processing",
            prompt: fullPrompt,
            error_message: "Generating... 0%"
          })
          .eq("id", videoId);
      }

      // Start background polling using EdgeRuntime.waitUntil
      const pollingPromise = pollOperation(
        operationData.name,
        GOOGLE_API_KEY,
        supabase,
        videoId
      );

      // Use EdgeRuntime.waitUntil for background processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(pollingPromise);
      } else {
        // Fallback: don't await, let it run in background
        pollingPromise.catch(err => console.error("Polling error:", err));
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing",
          operationId: operationData.name,
          videoId: videoId,
          message: "Video generation started. It will be ready in a few minutes."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we get immediate result (unlikely for video)
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
