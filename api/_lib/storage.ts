import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
// Public endpoint for browser-accessible URLs.
// Set to '/storage' to proxy through nginx, or full external URL.
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || '';

const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

export async function uploadFile(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
  upsert: boolean = false,
): Promise<{ error: any }> {
  try {
    const buffer = body instanceof Buffer ? body : Buffer.from(body);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }));
    return { error: null };
  } catch (err: any) {
    console.error('Storage upload error:', err?.message || err);
    return { error: { message: err?.message || 'Upload failed' } };
  }
}

/**
 * Get a URL for a stored file.
 * - For public buckets with MINIO_PUBLIC_ENDPOINT: returns a browser-accessible public URL.
 * - Otherwise: returns a signed internal URL (works from server-side fetch).
 * 
 * IMPORTANT: The returned URL may be a relative path (e.g. /storage/bucket/file)
 * when MINIO_PUBLIC_ENDPOINT is set. Use getInternalUrl() when you need a URL
 * that can be fetched from server-side code.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 7 * 24 * 60 * 60,
): Promise<{ data: { signedUrl: string } | null; error: any }> {
  try {
    // If bucket is public and we have a public endpoint, return direct public URL.
    if (MINIO_PUBLIC_ENDPOINT) {
      const publicUrl = `${MINIO_PUBLIC_ENDPOINT}/${bucket}/${path}`;
      return { data: { signedUrl: publicUrl }, error: null };
    }

    // Fallback: generate a signed URL via S3 (internal, but absolute)
    const command = new GetObjectCommand({ Bucket: bucket, Key: path });
    const signedUrl = await s3GetSignedUrl(s3, command, { expiresIn });
    return { data: { signedUrl }, error: null };
  } catch (err: any) {
    console.error('Storage signed URL error:', err?.message || err);
    return { data: null, error: { message: err?.message || 'Signed URL failed' } };
  }
}

/**
 * Get an internal URL that can be fetched from server-side code.
 * Always returns a full absolute URL using the internal MinIO endpoint.
 */
export function getInternalUrl(bucket: string, path: string): string {
  return `${MINIO_ENDPOINT}/${bucket}/${path}`;
}

export async function deleteFile(
  bucket: string,
  path: string,
): Promise<{ error: any }> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
    return { error: null };
  } catch (err: any) {
    console.error('Storage delete error:', err?.message || err);
    return { error: { message: err?.message || 'Delete failed' } };
  }
}

export { s3 };
