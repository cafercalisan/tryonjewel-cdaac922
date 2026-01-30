import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Vertex AI Imagen upscale endpoint
const UPSCALE_MODEL = 'imagen-3.0-generate-001';
const PROJECT_ID = 'lovable-cloud'; // Replace with actual project if needed
const LOCATION = 'us-central1';

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Helper: Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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
    console.log('Upscale request from user:', userId);

    // Parse request
    const { imageUrl, upscaleFactor = 'x4' } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Upscaling image:', imageUrl.substring(0, 100) + '...');
    console.log('Upscale factor:', upscaleFactor);

    // Fetch the original image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch original image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = arrayBufferToBase64(imageBuffer);
    const mimeType = imageResponse.headers.get('content-type') || 'image/png';

    console.log(`Original image size: ${imageBuffer.byteLength} bytes`);

    // Call Vertex AI Imagen Upscale API using REST
    // Using the Generative Language API endpoint for Imagen
    const upscaleUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GOOGLE_API_KEY}`;

    const upscaleResponse = await fetch(upscaleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{
          prompt: "Upscale this jewelry image to 4K resolution while preserving all fine details, metal textures, gemstone brilliance, and color accuracy. Maintain photorealistic quality.",
          image: {
            bytesBase64Encoded: base64Image
          }
        }],
        parameters: {
          sampleCount: 1,
          mode: "upscale",
          upscaleConfig: {
            upscaleFactor: upscaleFactor
          }
        }
      }),
    });

    if (!upscaleResponse.ok) {
      const errorText = await upscaleResponse.text();
      console.error('Upscale API error:', errorText);
      
      // Fallback: Use Gemini to regenerate at higher resolution
      console.log('Falling back to Gemini regeneration for upscale...');
      
      const geminiUrl = `https://generativelanguage.googleapis.com/v1alpha/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`;
      
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { 
                text: `You are a professional image upscaler. Take this jewelry image and recreate it at maximum resolution (4K/UHD quality).

CRITICAL RULES:
1. PRESERVE exact product appearance - same jewelry, same angle, same lighting
2. PRESERVE exact metal colors - no color shifts allowed
3. PRESERVE exact stone placement, count, and appearance
4. ENHANCE only: sharpness, detail clarity, texture definition
5. DO NOT add, remove, or modify any design elements
6. Output the highest resolution version possible

The output must be indistinguishable from the input except for improved resolution and clarity.`
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            temperature: 0.1,
          },
        }),
      });

      if (!geminiResponse.ok) {
        const geminiError = await geminiResponse.text();
        console.error('Gemini fallback error:', geminiError);
        
        // Return original image as base64 if all upscale attempts fail
        return new Response(
          JSON.stringify({ 
            success: true, 
            upscaledImageBase64: base64Image,
            mimeType: mimeType,
            message: 'Upscale unavailable, returning original quality'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const geminiData = await geminiResponse.json();
      const parts = geminiData.candidates?.[0]?.content?.parts || [];
      
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          console.log('Gemini upscale successful');
          return new Response(
            JSON.stringify({ 
              success: true, 
              upscaledImageBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // No image in response, return original
      return new Response(
        JSON.stringify({ 
          success: true, 
          upscaledImageBase64: base64Image,
          mimeType: mimeType,
          message: 'Upscale processing, returning original'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upscaleData = await upscaleResponse.json();
    const upscaledBase64 = upscaleData.predictions?.[0]?.bytesBase64Encoded;

    if (!upscaledBase64) {
      console.error('No upscaled image in response');
      return new Response(
        JSON.stringify({ 
          success: true, 
          upscaledImageBase64: base64Image,
          mimeType: mimeType,
          message: 'Upscale returned no image, using original'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Upscale successful');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        upscaledImageBase64: upscaledBase64,
        mimeType: upscaleData.predictions?.[0]?.mimeType || 'image/png'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(
      JSON.stringify({ error: 'Upscale failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
