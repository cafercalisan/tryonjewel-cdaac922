const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/jewelry-images/`;
const RENDER_BASE = `${SUPABASE_URL}/storage/v1/render/image/public/jewelry-images/`;

/**
 * Extract file path from any Supabase storage URL format.
 */
function extractFilePath(url: string): string | null {
  if (!url) return null;

  // Already a bare file path (no http)
  if (!url.startsWith('http')) return url;

  try {
    const pathname = new URL(url).pathname;

    // /storage/v1/render/image/public/jewelry-images/...
    const render = pathname.match(/\/storage\/v1\/render\/image\/public\/jewelry-images\/(.+)/);
    if (render) return decodeURIComponent(render[1]);

    // /storage/v1/object/public/jewelry-images/...
    const pub = pathname.match(/\/storage\/v1\/object\/public\/jewelry-images\/(.+)/);
    if (pub) return decodeURIComponent(pub[1]);

    // /storage/v1/object/sign/jewelry-images/...
    const sign = pathname.match(/\/storage\/v1\/object\/sign\/jewelry-images\/(.+)/);
    if (sign) return decodeURIComponent(sign[1]);

    // Any other path containing jewelry-images/
    const gen = pathname.match(/jewelry-images\/(.+)/);
    if (gen) return decodeURIComponent(gen[1]);

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert any stored image URL to a working public URL.
 * Pure synchronous function — zero API calls.
 * Bucket must be public for this to work.
 */
export function getPublicImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null;
  if (originalUrl.startsWith('data:')) return originalUrl;

  // Always extract file path and rebuild — handles expired signed URLs,
  // stale query params, and any other URL format consistently.
  const filePath = extractFilePath(originalUrl);
  if (!filePath) return originalUrl;

  return `${PUBLIC_BASE}${filePath}`;
}

/**
 * Get a resized thumbnail URL via Supabase image transforms.
 * Falls back to full public URL if the source can't be parsed.
 */
export function getThumbnailUrl(
  originalUrl: string | null | undefined,
  width = 400,
  height = 500,
  quality = 60,
): string | null {
  if (!originalUrl) return null;
  if (originalUrl.startsWith('data:')) return originalUrl;

  const filePath = extractFilePath(originalUrl);
  if (!filePath) return originalUrl;

  return `${RENDER_BASE}${filePath}?width=${width}&height=${height}&resize=cover&quality=${quality}`;
}

/**
 * Async wrapper — kept for backward compatibility.
 * Now just delegates to the sync version.
 */
export async function getSignedImageUrl(originalUrl: string | null | undefined): Promise<string | null> {
  return getPublicImageUrl(originalUrl);
}

export async function getSignedImageUrls(urls: (string | null | undefined)[]): Promise<(string | null)[]> {
  return urls.map(url => getPublicImageUrl(url));
}

export function clearSignedUrlCache(): void {
  // No-op — no cache needed for public URLs
}
