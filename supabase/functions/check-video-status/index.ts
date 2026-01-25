import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIDEO_CREDIT_COST = 2;

async function refundCredits(supabase: any, userId: string, amount: number): Promise<void> {
  console.log(`Attempting to refund ${amount} credits to user ${userId}`);
  const { data, error } = await supabase.rpc('refund_credits', { _user_id: userId, _amount: amount });
  if (error) {
    console.error('Refund error:', error);
  } else {
    console.log(`Credits refunded successfully. New balance: ${data?.new_credits}`);
  }
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

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    const isAdminUser = isAdmin === true;

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
      
      // If operation not found (404), mark as error and refund
      if (response.status === 404) {
        // Refund credits for non-admin users
        if (!isAdminUser) {
          await refundCredits(supabase, user.id, VIDEO_CREDIT_COST);
        }

        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: "Video üretimi başarısız - işlem bulunamadı. Krediniz iade edildi."
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: "Video generation failed - operation not found. Credits refunded.",
            refunded: !isAdminUser
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

      // Some responses complete without a video URI because the provider filtered the media.
      // Veo 3.x can return this under generateVideoResponse.raiMediaFilteredReasons.
      const raiFilteredReasons: string[] | undefined =
        operationData?.response?.generateVideoResponse?.raiMediaFilteredReasons;
      const raiFilteredCount: number | undefined =
        operationData?.response?.generateVideoResponse?.raiMediaFilteredCount;

      if ((raiFilteredCount && raiFilteredCount > 0) || (raiFilteredReasons && raiFilteredReasons.length > 0)) {
        const reasonText = (raiFilteredReasons && raiFilteredReasons.length > 0)
          ? raiFilteredReasons.join(" ")
          : "İçerik politikası nedeniyle çıktı üretilemedi.";

        // Refund credits for content filter issues
        if (!isAdminUser) {
          await refundCredits(supabase, user.id, VIDEO_CREDIT_COST);
        }

        const friendly =
          `Video üretimi içerik filtresine takıldı. Krediniz iade edildi. ` +
          `Lütfen gerçek kişi/ünlü içeren görseller veya isim/benzerlik çağrışımı yapan içerikler kullanmadan tekrar deneyin. ` +
          `\n\nSağlayıcı mesajı: ${reasonText}`;

        console.error("RAI media filtered:", { raiFilteredCount, raiFilteredReasons });

        await supabase
          .from("videos")
          .update({
            status: "error",
            error_message: friendly,
          })
          .eq("id", videoId);

        return new Response(
          JSON.stringify({
            success: true,
            status: "error",
            errorMessage: friendly,
            refunded: !isAdminUser
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check for error
      if (operationData.error) {
        console.error("Operation error:", operationData.error);
        
        // Refund credits for API errors
        if (!isAdminUser) {
          await refundCredits(supabase, user.id, VIDEO_CREDIT_COST);
        }

        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: (operationData.error.message || "Video üretimi başarısız") + " Krediniz iade edildi."
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: operationData.error.message || "Video generation failed",
            refunded: !isAdminUser
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
        
        // Refund credits when no URL received
        if (!isAdminUser) {
          await refundCredits(supabase, user.id, VIDEO_CREDIT_COST);
        }

        await supabase
          .from("videos")
          .update({ 
            status: "error",
            error_message: "Video tamamlandı ancak URL alınamadı. Krediniz iade edildi. Lütfen farklı bir görsel ile tekrar deneyin (özellikle gerçek kişi/ünlü benzerliği içeren görseller filtrelenebilir)."
          })
          .eq("id", videoId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "error",
            errorMessage: "Video tamamlandı ancak URL alınamadı. Krediniz iade edildi.",
            refunded: !isAdminUser
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
