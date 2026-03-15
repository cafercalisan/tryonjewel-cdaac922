/**
 * Storage URL helper — MinIO via /storage proxy.
 *
 * DB stores two formats:
 *   - generated_image_urls: "/storage/jewelry-images/<user>/<path>"  (already browser-ready)
 *   - original_image_url:   "<user>/originals/<file>"                (bare path, needs prefix)
 *   - legacy Supabase URLs:  "https://...supabase.co/storage/v1/..." (extract & rewrite)
 */

const STORAGE_PREFIX = '/storage/jewelry-images/';

/**
 * Extract the bare file path from any stored URL format.
 */
function extractFilePath(url: string): string | null {
  if (!url) return null;

  // Already a /storage/ path — extract the file part after jewelry-images/
  if (url.startsWith('/storage/jewelry-images/')) {
    return url.slice('/storage/jewelry-images/'.length);
  }

  // Full URL (legacy Supabase or external)
  if (url.startsWith('http')) {
    try {
      const pathname = new URL(url).pathname;

      // Supabase: /storage/v1/object/public/jewelry-images/...
      const supaMatch = pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/jewelry-images\/(.+)/);
      if (supaMatch) return decodeURIComponent(supaMatch[1]);

      // MinIO proxy: /storage/jewelry-images/...
      const minioMatch = pathname.match(/\/storage\/jewelry-images\/(.+)/);
      if (minioMatch) return decodeURIComponent(minioMatch[1]);

      // Generic fallback: anything after jewelry-images/
      const gen = pathname.match(/jewelry-images\/(.+)/);
      if (gen) return decodeURIComponent(gen[1]);

      return null;
    } catch {
      return null;
    }
  }

  // Bare relative path (e.g. "uuid/originals/file.webp")
  return url;
}

/**
 * Convert any stored image URL to a working public URL.
 * Pure synchronous function — zero API calls.
 * Uses the /storage proxy backed by MinIO.
 */
export function getPublicImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null;
  if (originalUrl.startsWith('data:')) return originalUrl;

  // Already a working /storage/ path
  if (originalUrl.startsWith('/storage/')) return originalUrl;

  const filePath = extractFilePath(originalUrl);
  if (!filePath) return originalUrl;

  return `${STORAGE_PREFIX}${filePath}`;
}

/**
 * Get a thumbnail URL.
 * MinIO doesn't support server-side transforms like Supabase,
 * so we return the full image URL and rely on client-side sizing.
 */
export function getThumbnailUrl(
  originalUrl: string | null | undefined,
  _width = 400,
  _height = 500,
  _quality = 60,
): string | null {
  // MinIO has no image transform pipeline — return the full URL.
  // The <ProgressiveImage> component handles client-side display sizing.
  return getPublicImageUrl(originalUrl);
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
