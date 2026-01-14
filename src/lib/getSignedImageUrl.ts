import { supabase } from "@/integrations/supabase/client";

// Cache for signed URLs to avoid redundant API calls
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Cache duration: 1 hour (slightly less than actual expiry to be safe)
const CACHE_DURATION_MS = 60 * 60 * 1000;

/**
 * Extract file path from various URL formats
 * Handles both public URLs and signed URLs from Supabase storage
 */
function extractFilePath(url: string): string | null {
  if (!url) return null;
  
  // Check if it's already a file path (no http)
  if (!url.startsWith('http')) {
    return url;
  }
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Pattern 1: Public URL - /storage/v1/object/public/jewelry-images/...
    const publicMatch = pathname.match(/\/storage\/v1\/object\/public\/jewelry-images\/(.+)/);
    if (publicMatch) {
      return publicMatch[1];
    }
    
    // Pattern 2: Signed URL - /storage/v1/object/sign/jewelry-images/...
    const signedMatch = pathname.match(/\/storage\/v1\/object\/sign\/jewelry-images\/(.+)/);
    if (signedMatch) {
      return signedMatch[1];
    }
    
    // Pattern 3: Direct path after bucket name
    const directMatch = pathname.match(/jewelry-images\/(.+)/);
    if (directMatch) {
      return directMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a signed URL is still valid
 */
function isSignedUrlValid(url: string): boolean {
  if (!url.includes('token=')) return false;
  
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');
    if (!token) return false;
    
    // Try to decode the JWT-like token to check expiry
    // Supabase signed URLs contain a base64 encoded payload
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        // Check if expired (with 5 minute buffer)
        return payload.exp * 1000 > Date.now() + 5 * 60 * 1000;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get a working signed URL for a Supabase storage image
 * Handles various URL formats and caches results
 */
export async function getSignedImageUrl(originalUrl: string | null | undefined): Promise<string | null> {
  if (!originalUrl) return null;
  
  // If it's a data URL, return as-is
  if (originalUrl.startsWith('data:')) {
    return originalUrl;
  }
  
  // If it's already a valid signed URL, return as-is
  if (isSignedUrlValid(originalUrl)) {
    return originalUrl;
  }
  
  // Check cache
  const cached = signedUrlCache.get(originalUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  
  // Extract file path
  const filePath = extractFilePath(originalUrl);
  if (!filePath) {
    console.warn('Could not extract file path from URL:', originalUrl);
    return originalUrl; // Return original as fallback
  }
  
  try {
    // Generate signed URL (2 hours expiry)
    const { data, error } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(filePath, 2 * 60 * 60); // 2 hours
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return originalUrl; // Return original as fallback
    }
    
    if (data?.signedUrl) {
      // Cache the result
      signedUrlCache.set(originalUrl, {
        url: data.signedUrl,
        expiresAt: Date.now() + CACHE_DURATION_MS,
      });
      return data.signedUrl;
    }
    
    return originalUrl;
  } catch (err) {
    console.error('Error getting signed URL:', err);
    return originalUrl;
  }
}

/**
 * Hook-friendly version that returns a loading state
 * Use with React Query or useEffect
 */
export async function getSignedImageUrls(urls: (string | null | undefined)[]): Promise<(string | null)[]> {
  return Promise.all(urls.map(url => getSignedImageUrl(url)));
}

/**
 * Clear the URL cache (useful for logout or refresh)
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}
