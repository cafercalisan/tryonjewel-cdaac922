import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    // Get video record
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (videoError || !video) {
      throw new Error("Video not found");
    }

    // If video is already completed or error, just return status
    if (video.status === "completed" || video.status === "error") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: video.status,
          videoUrl: video.video_url,
          errorMessage: video.error_message
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no operation_id, video hasn't started properly
    if (!video.operation_id) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: video.status,
          message: "Video generation starting..."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll Google API for operation status using x-goog-api-key header
    console.log(`Checking operation: ${video.operation_id}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${video.operation_id}`,
      {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status} - ${errorText}`);
      
      // If operation not found (404), mark as error
      if (response.status === 404) {
        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: "Video generation failed - operation not found"
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: "Video generation failed - operation not found"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const operationData = await response.json();
    console.log(`Operation response:`, JSON.stringify(operationData));

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
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: operationData.error.message || "Video generation failed"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get video URL from response - check all possible paths including Veo 3.1 format
      const videoUri = operationData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                      operationData.response?.generatedVideos?.[0]?.video?.uri ||
                      operationData.response?.predictions?.[0]?.video?.uri ||
                      operationData.result?.generatedVideos?.[0]?.video?.uri ||
                      operationData.result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                      operationData.response?.video?.uri;
      
      console.log("Parsed video URI:", videoUri);

      if (videoUri) {
        console.log("Video generated successfully:", videoUri);
        
        // Download video with API key auth (required for Google's file download endpoint)
        try {
          const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`);
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
                  video_url: videoUri,
                  error_message: null
                })
                .eq("id", videoId);
              
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  status: "completed",
                  videoUrl: videoUri
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from("jewelry-images")
              .getPublicUrl(storagePath);

            await supabase
              .from("videos")
              .update({ 
                status: "completed",
                video_url: publicUrlData.publicUrl,
                error_message: null
              })
              .eq("id", videoId);
            
            console.log("Video uploaded to storage:", publicUrlData.publicUrl);
            
            return new Response(
              JSON.stringify({ 
                success: true, 
                status: "completed",
                videoUrl: publicUrlData.publicUrl
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (uploadErr) {
          console.error("Error uploading video:", uploadErr);
        }
        
        // Fallback: use original URL
        await supabase
          .from("videos")
          .update({ 
            status: "completed",
            video_url: videoUri,
            error_message: null
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "completed",
            videoUrl: videoUri
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.error("No video URL in response:", operationData);
        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: "No video URL received from API"
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: "No video URL received from API"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Operation still in progress
    const progress = operationData.metadata?.progress || 0;
    console.log(`Operation in progress: ${progress}%`);
    
    // Update status with progress info
    await supabase
      .from("videos")
      .update({ 
        status: "processing",
        error_message: progress > 0 ? `İşleniyor... ${progress}%` : "Video oluşturuluyor..."
      })
      .eq("id", videoId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "processing",
        progress: progress,
        message: progress > 0 ? `İşleniyor... ${progress}%` : "Video oluşturuluyor..."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-video-status:", error);
    
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
